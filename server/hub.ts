// The single source of truth: live match, pilot, board status. Browsers only send commands and get state.
import { randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import type { WebSocket } from 'ws';
import { isValidDart } from '../games/darts.ts';
import type { X01Event, X01View } from '../games/x01/index.ts';
import { isValidEvent, x01 } from '../games/x01/index.ts';
import type { Board } from './board.ts';
import type { Config } from './config.ts';
import type { Db, LiveRecord } from './db.ts';
import { UserError, cleanName } from './db.ts';
import type { ClientMessage, ClientState, Command, LiveMatch, PlayerCommand, RosterEntry, ServerMessage } from './protocol.ts';

interface Client {
  clientId: string;
  deviceName: string;
  isLocal: boolean;
}

interface Live {
  rec: LiveRecord;
  view: X01View;
  resumed: boolean;
  lastFix: LiveMatch['lastFix'];
}

const MAX_PLAYERS = 8;
const QR_TIMEOUT_MS = 60_000;

export function lanUrls(port: number): string[] {
  const urls: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')) urls.push(`http://${a.address}:${port}/`);
    }
  }
  return urls;
}

export class Hub {
  private clients = new Map<WebSocket, Client>();
  private pilot: { clientId: string; deviceName: string } | null = null;
  private live: Live | null = null;
  private showQr = false;
  private qrTimer: NodeJS.Timeout | null = null;
  private urls: string[];

  constructor(
    private db: Db,
    private board: Board,
    private cfg: Config,
    private closeApp: () => void,
  ) {
    this.urls = lanUrls(cfg.port);
    const rec = db.loadLive();
    if (rec) this.live = { rec, view: this.compute(rec), resumed: true, lastFix: null };

    // Darts in the board during a visit are already in the match; later ones are new.
    board.countedOnBoard = () => {
      const v = this.live?.view;
      return v && v.phase === 'throwing' ? v.visit.darts.length : Infinity;
    };
    board.on('status', () => this.broadcast());
    board.on('throw', (dart, coords) => {
      const v = this.live?.view;
      if (!v || v.phase !== 'throwing' || v.visit.dartsLeft === 0) return;
      this.apply({ t: 'dart', dart, coords, at: Date.now() });
    });
    board.on('takeoutStarted', () => this.broadcast());
    board.on('takeoutFinished', () => {
      const v = this.live?.view;
      if (v && ((v.phase === 'throwing' && v.visit.darts.length > 0) || (v.phase === 'legWon' && this.live!.rec.options.matchMode.kind !== 'off'))) {
        this.apply({ t: 'next', at: Date.now() });
      } else this.broadcast();
    });
  }

  // ---------- connections ----------

  connect(ws: WebSocket, isLocal: boolean) {
    ws.on('message', raw => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.type === 'hello') {
        const deviceName = String(msg.deviceName || (isLocal ? 'Laptop' : 'Phone')).slice(0, 40);
        this.clients.set(ws, { clientId: String(msg.clientId).slice(0, 64), deviceName, isLocal });
        if (!this.pilot && isLocal) this.pilot = { clientId: String(msg.clientId), deviceName };
        this.broadcast();
      } else if (msg.type === 'cmd') {
        const client = this.clients.get(ws);
        if (!client) return;
        this.run(client, msg.cmd)
          .then(extra => this.send(ws, { type: 'result', id: msg.id, ok: true, ...extra }))
          .catch((e: unknown) => {
            const error = e instanceof UserError ? e.message : 'Something went wrong';
            if (!(e instanceof UserError)) console.error(e);
            this.send(ws, { type: 'result', id: msg.id, ok: false, error });
          })
          .finally(() => this.broadcast());
      }
    });
    ws.on('close', () => {
      this.clients.delete(ws);
      this.broadcast();
    });
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  broadcast() {
    const base = this.baseState();
    for (const [ws, c] of this.clients) {
      this.send(ws, {
        type: 'state',
        state: { ...base, you: { clientId: c.clientId, isPilot: this.pilot?.clientId === c.clientId, isLocal: c.isLocal } },
      });
    }
  }

  private baseState(): Omit<ClientState, 'you'> {
    const pilotConnected = !!this.pilot && [...this.clients.values()].some(c => c.clientId === this.pilot!.clientId);
    const l = this.live;
    return {
      pilot: this.pilot ? { ...this.pilot, connected: pilotConnected } : null,
      board: this.board.status,
      match: l && {
        key: l.rec.key,
        game: 'x01',
        options: l.rec.options,
        description: x01.describe(l.rec.options),
        roster: l.rec.roster,
        startedAt: l.rec.startedAt,
        view: l.view,
        resumed: l.resumed,
        lastFix: l.lastFix,
      },
      lastMatch: this.db.lastMatch(),
      players: this.db.players(),
      recentPlayerIds: this.db.recentPlayerIds(),
      urls: this.urls,
      showQr: this.showQr,
    };
  }

  // ---------- match ----------

  private compute(rec: LiveRecord): X01View {
    return x01.view(rec.events, rec.roster.length, rec.options);
  }

  private apply(e: X01Event) {
    const l = this.live;
    if (!l) throw new UserError('No match in progress');
    if (!isValidEvent(e)) throw new UserError('Invalid input');
    l.rec.events.push(e);
    this.db.appendLive(e);
    l.view = this.compute(l.rec);
    if (e.t !== 'fix') l.lastFix = null;
    this.broadcast();
  }

  private checkRoster(input: unknown): RosterEntry[] {
    if (!Array.isArray(input) || input.length < 1) throw new UserError('Add at least one player');
    if (input.length > MAX_PLAYERS) throw new UserError(`At most ${MAX_PLAYERS} players`);
    const seen = new Set<number>();
    return input.map((r: RosterEntry) => {
      if (r.playerId === null) return { playerId: null, name: cleanName(r.name) };
      const p = this.db.player(Number(r.playerId));
      if (!p) throw new UserError('Unknown player');
      if (seen.has(p.id)) throw new UserError(`${p.name} is in the match twice`);
      seen.add(p.id);
      return { playerId: p.id, name: p.name };
    });
  }

  private startMatch(options: unknown, rosterInput: unknown) {
    if (this.live) throw new UserError('A match is already in progress');
    const roster = this.checkRoster(rosterInput);
    const rec: LiveRecord = { key: randomUUID(), game: 'x01', options: x01.normalizeOptions(options), roster, startedAt: Date.now(), events: [] };
    this.db.startLive(rec);
    this.live = { rec, view: this.compute(rec), resumed: false, lastFix: null };
    // Darts still sitting in the board belong to no one.
    void this.board.action('reset').catch(() => undefined);
  }

  /** Saves or drops the live match. Returns the saved setup for a rematch. */
  private finish(save: boolean) {
    const l = this.live;
    if (!l) throw new UserError('No match in progress');
    const { rec, view } = l;
    const n = rec.roster.length;
    let status: 'finished' | 'ended' = 'ended';
    let winner: number | null = null;
    if (view.phase === 'matchWon') {
      status = 'finished';
      winner = view.matchWinner;
    } else if (view.phase === 'legWon' && rec.options.matchMode.kind === 'off') {
      // Without match mode, ending after a leg is the normal end; most legs wins.
      status = 'finished';
      const best = Math.max(...view.legs);
      winner = view.legs.filter(x => x === best).length === 1 ? view.legs.indexOf(best) : null;
    }
    if (status === 'finished' || save) {
      this.db.saveMatch({
        game: 'x01', options: rec.options, roster: rec.roster, startedAt: rec.startedAt, endedAt: Date.now(),
        status, winner, sets: view.sets, legs: x01.compact(rec.events, n, rec.options),
      });
      this.backup();
    } else {
      this.db.clearLive();
    }
    this.live = null;
    return rec;
  }

  backup() {
    try {
      this.db.backup([`${this.cfg.dataDir}/backups`, ...(this.cfg.extraBackupDir ? [this.cfg.extraBackupDir] : [])]);
    } catch (e) {
      console.error('Backup failed', e);
    }
  }

  private rematch(options: LiveRecord['options'], roster: RosterEntry[]) {
    // The next player in order starts, so no bull-off.
    const rotated = [...roster.slice(1), roster[0]];
    this.startMatch({ ...options, bullOff: 'off' }, rotated);
  }

  private player(c: PlayerCommand): { playerId?: number } {
    switch (c.action) {
      case 'create': return { playerId: this.db.createPlayer(c.name) };
      case 'rename': this.db.renamePlayer(c.id, c.name); return {};
      case 'merge': this.db.mergePlayers(c.from, c.into); return {};
      case 'archive': this.db.archivePlayer(c.id, c.archived); return {};
      case 'anonymize': this.db.anonymizePlayer(c.id); return {};
    }
  }

  // ---------- commands ----------

  private async run(client: Client, cmd: Command): Promise<{ playerId?: number }> {
    if (cmd.type === 'takeControl') {
      this.pilot = { clientId: client.clientId, deviceName: client.deviceName };
      return {};
    }
    if (this.pilot?.clientId !== client.clientId) throw new UserError('Take control first');
    const v = this.live?.view;

    switch (cmd.type) {
      case 'startMatch':
        this.startMatch(cmd.options, cmd.roster);
        return {};
      case 'rematch': {
        const last = this.db.lastMatchSetup();
        if (!last) throw new UserError('No match to repeat');
        this.rematch(last.options, last.roster);
        return {};
      }
      case 'bullOff':
        if (v?.phase !== 'bulloff') throw new UserError('Bull-off is over');
        this.apply({ t: 'start', starter: cmd.starter });
        void this.board.action('reset').catch(() => undefined);
        return {};
      case 'dart':
        if (!isValidDart(cmd.dart)) throw new UserError('Invalid dart');
        if (v?.phase !== 'throwing' || v.visit.dartsLeft === 0) throw new UserError('This visit is complete');
        this.apply({ t: 'dart', dart: cmd.dart, at: Date.now() });
        return {};
      case 'fix':
        this.apply({ t: 'fix', index: cmd.index, dart: cmd.dart });
        this.live!.lastFix = { index: cmd.index, at: Date.now() };
        return {};
      case 'undo':
        this.apply({ t: 'undo' });
        return {};
      case 'next':
        if (this.board.status.takeout.active) await this.board.takeoutDone();
        this.apply({ t: 'next', at: Date.now() });
        return {};
      case 'nextLeg':
        this.apply({ t: 'nextLeg' });
        return {};
      case 'endMatch':
        this.finish(cmd.save);
        return {};
      case 'closeMatch': {
        const rec = this.finish(true);
        if (cmd.then === 'rematch') this.rematch(rec.options, rec.roster);
        return {};
      }
      case 'dismissResumed':
        if (this.live) this.live.resumed = false;
        return {};
      case 'board':
        if (!['reset', 'start', 'stop', 'calibrate', 'restart'].includes(cmd.action)) throw new UserError('Unknown action');
        if (!this.board.status.connected) throw new UserError('Board is offline');
        try {
          await this.board.action(cmd.action);
        } catch (e) {
          throw new UserError(e instanceof Error ? e.message : 'Board Manager did not answer');
        }
        return {};
      case 'showQr':
        this.showQr = !!cmd.show;
        if (this.qrTimer) clearTimeout(this.qrTimer);
        if (this.showQr) this.qrTimer = setTimeout(() => ((this.showQr = false), this.broadcast()), QR_TIMEOUT_MS);
        return {};
      case 'player':
        return this.player(cmd.cmd);
      case 'closeApp':
        setTimeout(() => this.closeApp(), 300);
        return {};
    }
  }
}
