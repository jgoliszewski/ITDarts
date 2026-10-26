// The single source of truth: live match, pilot, board status. Browsers only send commands and get state.
import { randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import type { WebSocket } from 'ws';
import { isValidDart } from '../games/darts.ts';
import type { GameId } from '../games/index.ts';
import { GAMES, MAX_PLAYERS, isGameId } from '../games/index.ts';
import type { HolView } from '../games/hol.ts';
import { drawNumbers } from '../games/killer.ts';
import type { MiniView } from '../games/turns.ts';
import type { X01View } from '../games/x01/index.ts';
import type { Board } from './board.ts';
import type { Config } from './config.ts';
import type { Db, LiveRecord } from './db.ts';
import { UserError, cleanName } from './db.ts';
import type { ClientMessage, ClientState, Command, LiveMatch, PlayerCommand, RecordInfo, RosterEntry, ServerMessage } from './protocol.ts';

interface Client {
  clientId: string;
  deviceName: string;
  isLocal: boolean;
}

interface Live {
  rec: LiveRecord;
  view: X01View | MiniView;
  resumed: boolean;
  lastFix: LiveMatch['lastFix'];
  record: RecordInfo | null;
  intro: boolean;
  newRecord: LiveMatch['newRecord'];
  turnPass: number;
}

const QR_TIMEOUT_MS = 60_000;
const INTRO_MS = 4_000;

// Phones reach the laptop over Wi-Fi, so typical LAN ranges go first. VPNs (Tailscale's 100.64/10) and
// link-local addresses are unreachable from the phone and get dropped.
function lanRank(ip: string): number {
  if (ip.startsWith('192.168.')) return 0;
  if (ip.startsWith('10.')) return 1;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip) || ip.startsWith('169.254.')) return -1;
  return 3;
}

export function lanUrls(port: number): string[] {
  const ips: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) if (a.family === 'IPv4' && !a.internal && lanRank(a.address) >= 0) ips.push(a.address);
  }
  return ips.sort((a, b) => lanRank(a) - lanRank(b)).map(ip => `http://${ip}:${port}/`);
}

const beats = (better: 'lower' | 'higher', v: number, best: number) => (better === 'lower' ? v < best : v > best);

export class Hub {
  private clients = new Map<WebSocket, Client>();
  private pilot: { clientId: string; deviceName: string } | null = null;
  private live: Live | null = null;
  private showQr = false;
  private qrTimer: NodeJS.Timeout | null = null;
  private introTimer: NodeJS.Timeout | null = null;
  private howTo: ClientState['howTo'] = null;
  /** A bull-off dart is in the board: the next dart counts only after the takeout. */
  private bullOut = false;
  private urls: string[];

  constructor(
    private db: Db,
    private board: Board,
    private cfg: Config,
    private closeApp: () => void,
  ) {
    this.urls = lanUrls(cfg.port);
    const rec = db.loadLive();
    if (rec) {
      this.live = { rec, view: this.compute(rec), resumed: true, lastFix: null, record: this.recordInfo(rec), intro: false, newRecord: null, turnPass: 0 };
      this.live.newRecord = this.newRecords(this.live);
    }

    // Darts in the board during a visit are already in the match; later ones are new.
    board.countedOnBoard = () => {
      const v = this.live?.view;
      return v && v.phase === 'throwing' ? v.visit.darts.length : Infinity;
    };
    board.on('status', () => this.broadcast());
    board.on('throw', (dart, coords) => {
      const v = this.live?.view;
      if (!v || this.bullOut) return;
      if (v.phase === 'bulloff') {
        this.bullOut = true;
        this.apply({ t: 'bull', dart, coords, at: Date.now() });
        return;
      }
      if (v.phase !== 'throwing' || v.visit.dartsLeft === 0) return;
      this.apply({ t: 'dart', dart, coords, at: Date.now() });
    });
    board.on('takeoutStarted', () => this.broadcast());
    board.on('takeoutFinished', () => {
      if (this.bullOut) {
        this.bullOut = false;
        this.broadcast();
        return;
      }
      const l = this.live;
      const v = l?.view;
      const nextLeg = v?.phase === 'legWon' && l!.rec.game === 'x01' && l!.rec.options.matchMode.kind !== 'off';
      if (v && ((v.phase === 'throwing' && v.visit.darts.length > 0) || nextLeg)) {
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
      match: l && ({
        key: l.rec.key,
        game: l.rec.game,
        options: l.rec.options,
        description: GAMES[l.rec.game].describe(l.rec.options, l.rec.roster.length),
        roster: l.rec.roster,
        startedAt: l.rec.startedAt,
        view: l.view,
        resumed: l.resumed,
        lastFix: l.lastFix,
        record: l.record,
        intro: l.intro,
        newRecord: l.newRecord,
        bullTakeout: this.bullOut,
        turnPass: l.turnPass,
      } as LiveMatch),
      lastMatch: this.db.lastMatch(),
      players: this.db.players(),
      recentPlayerIds: this.db.recentPlayerIds(),
      urls: this.urls,
      showQr: this.showQr,
      howTo: this.howTo,
    };
  }

  // ---------- match ----------

  private compute(rec: LiveRecord): X01View | MiniView {
    return GAMES[rec.game].view(rec.events, rec.roster.length, rec.options);
  }

  private apply(e: { t: string; [k: string]: unknown }) {
    const l = this.live;
    if (!l) throw new UserError('No match in progress');
    if (!GAMES[l.rec.game].isValidEvent(e)) throw new UserError('Invalid input');
    l.rec.events.push(e);
    this.db.appendLive(e);
    const before = l.view.phase;
    l.view = this.compute(l.rec);
    // The visit went to the next player, or the next leg started: not the end of the match.
    if ((e.t === 'next' || e.t === 'nextLeg') && (before === 'throwing' || before === 'legWon') && l.view.phase === 'throwing') l.turnPass++;
    l.newRecord = this.newRecords(l);
    if (e.t !== 'fix') l.lastFix = null;
    // The first dart closes the record screen and “How to play”.
    if (e.t === 'dart' || e.t === 'bull') {
      this.endIntro();
      this.howTo = null;
    }
    this.broadcast();
  }

  private endIntro() {
    if (this.introTimer) clearTimeout(this.introTimer);
    this.introTimer = null;
    if (this.live) this.live.intro = false;
  }

  private variant(rec: LiveRecord) {
    const game = GAMES[rec.game];
    const v = game.record?.variant(rec.options, rec.roster.length);
    return v && game.record ? { ...v, ...game.record } : null;
  }

  /** The office record of the variant, for the record screen. */
  private recordInfo(rec: LiveRecord): RecordInfo | null {
    const v = this.variant(rec);
    if (!v) return null;
    const best = this.db.records(v.key, v.better, 1)[0];
    return { label: v.label, value: best ? v.format(best.value) : null, by: best?.who ?? null, at: best?.at ?? null };
  }

  /** Scores that count for records: finished games only, registered players only, and no co-op with guests. */
  private recordScores(l: Live): (number | null)[] | null {
    const v = this.variant(l.rec);
    if (!v || l.view.phase !== 'matchWon' || !('scores' in l.view)) return null;
    if (v.key.endsWith(':coop') && l.rec.roster.some(r => r.playerId === null)) return null;
    return l.view.scores.map((s, i) => (l.rec.roster[i].playerId === null ? null : s));
  }

  /** New office or personal records, checked against history at the end of the game. */
  private newRecords(l: Live): Live['newRecord'] {
    const v = this.variant(l.rec);
    const scores = this.recordScores(l);
    if (!v || !scores) return null;
    const mine = scores.flatMap(s => (s === null ? [] : [s]));
    if (mine.length === 0) return null;
    const top = mine.reduce((a, b) => (beats(v.better, b, a) ? b : a));
    const office = this.db.records(v.key, v.better, 1)[0];
    const personal = v.key.endsWith(':coop') ? [] : l.rec.roster.flatMap((r, i) => {
      const s = scores[i];
      if (s === null || r.playerId === null) return [];
      const best = this.db.records(v.key, v.better, 1, r.playerId)[0];
      return !best || beats(v.better, s, best.value) ? [r.name] : [];
    });
    const isOffice = !office || beats(v.better, top, office.value);
    return isOffice || personal.length ? { office: isOffice, personal } : null;
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

  private startMatch(gameId: unknown, options: unknown, rosterInput: unknown) {
    if (this.live) throw new UserError('A match is already in progress');
    if (!isGameId(gameId)) throw new UserError('Unknown game');
    const game = GAMES[gameId];
    const roster = this.checkRoster(rosterInput);
    if (roster.length < game.minPlayers) throw new UserError(`${game.name} needs at least ${game.minPlayers} players`);
    const rec: LiveRecord = { key: randomUUID(), game: gameId, options: game.normalizeOptions(options), roster, startedAt: Date.now(), events: [] };
    this.db.startLive(rec);
    if (gameId === 'killer') {
      const e = { t: 'numbers', numbers: drawNumbers(roster.length) };
      rec.events.push(e);
      this.db.appendLive(e);
    }
    const record = this.recordInfo(rec);
    this.live = { rec, view: this.compute(rec), resumed: false, lastFix: null, record, intro: !!record, newRecord: null, turnPass: 0 };
    this.howTo = null;
    this.bullOut = false;
    if (record) {
      this.introTimer = setTimeout(() => {
        this.endIntro();
        this.broadcast();
      }, INTRO_MS);
    }
    // Darts still sitting in the board belong to no one.
    void this.board.action('reset').catch(() => undefined);
  }

  /** Saves or drops the live match. Returns the saved setup for a rematch. */
  private finish(save: boolean) {
    const l = this.live;
    if (!l) throw new UserError('No match in progress');
    const { rec, view } = l;
    const game = GAMES[rec.game];
    const n = rec.roster.length;
    let status: 'finished' | 'ended' = 'ended';
    let winner: number | null = null;
    if (view.phase === 'matchWon') {
      status = 'finished';
      winner = 'winners' in view ? (view.winners.length === 1 ? view.winners[0] : null) : view.matchWinner;
    } else if (view.phase === 'legWon' && rec.game === 'x01' && rec.options.matchMode.kind === 'off') {
      // Without match mode, ending after a leg is the normal end; most legs wins.
      status = 'finished';
      const legs = (view as X01View).legs;
      const best = Math.max(...legs);
      winner = legs.filter(x => x === best).length === 1 ? legs.indexOf(best) : null;
    }
    if (status === 'finished' || save) {
      const mini = 'winners' in view ? view : null;
      const scores = this.recordScores(l);
      this.db.saveMatch({
        game: rec.game, options: rec.options, roster: rec.roster, startedAt: rec.startedAt, endedAt: Date.now(),
        status, winner, sets: 'sets' in view ? view.sets : [], legs: game.compact(rec.events, n, rec.options),
        legsWon: rec.game === 'hol' ? (view as HolView).points : undefined,
        variant: scores ? this.variant(rec)!.key : null,
        scores: scores ?? undefined,
        stats: mini?.stats,
      });
      this.backup();
    } else {
      this.db.clearLive();
    }
    this.endIntro();
    this.live = null;
    this.bullOut = false;
    return rec;
  }

  backup() {
    try {
      this.db.backup([`${this.cfg.dataDir}/backups`, ...(this.cfg.extraBackupDir ? [this.cfg.extraBackupDir] : [])]);
    } catch (e) {
      console.error('Backup failed', e);
    }
  }

  private rematch(game: GameId, options: LiveRecord['options'], roster: RosterEntry[]) {
    // The next player in order starts, so no bull-off.
    const rotated = [...roster.slice(1), roster[0]];
    this.startMatch(game, { ...options, bullOff: 'off' }, rotated);
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
        this.startMatch(cmd.game, cmd.options, cmd.roster);
        return {};
      case 'rematch': {
        const last = this.db.lastMatchSetup();
        if (!last) throw new UserError('No match to repeat');
        this.rematch(last.game, last.options, last.roster);
        return {};
      }
      case 'skipIntro':
        this.endIntro();
        return {};
      case 'reroll':
        if (!v || !('canReroll' in v) || !v.canReroll) throw new UserError('Numbers are fixed once the first dart is in');
        this.apply({ t: 'numbers', numbers: drawNumbers(this.live!.rec.roster.length) });
        return {};
      case 'showHowTo':
        this.howTo = isGameId(cmd.game) ? { game: cmd.game, options: cmd.options ?? this.live?.rec.options ?? null } : null;
        return {};
      case 'bullOff':
        if (v?.phase !== 'bulloff') throw new UserError('Bull-off is over');
        this.bullOut = false;
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
        // An undone bull-off dart was a bad detection; don't wait for its takeout.
        if (v?.phase === 'bulloff') this.bullOut = false;
        this.apply({ t: 'undo' });
        return {};
      case 'next':
        if (this.board.status.takeout.active || this.bullOut) await this.board.takeoutDone();
        if (this.bullOut) {
          this.bullOut = false;
          return {};
        }
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
        if (cmd.then === 'rematch') this.rematch(rec.game, rec.options, rec.roster);
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
