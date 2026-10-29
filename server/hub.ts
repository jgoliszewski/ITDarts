// The single source of truth: live match, pilot, board status. Browsers only send commands and get state.
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join, resolve } from 'node:path';
import type { WebSocket } from 'ws';
import { isValidDart } from '../games/darts.ts';
import type { GameId } from '../games/index.ts';
import { GAMES, MAX_PLAYERS, isGameId } from '../games/index.ts';
import type { View121 } from '../games/121.ts';
import { callerLines121 } from '../games/121.ts';
import type { HolView } from '../games/hol.ts';
import { drawNumbers } from '../games/killer.ts';
import type { MiniView } from '../games/turns.ts';
import { dartCue } from '../games/turns.ts';
import type { X01View } from '../games/x01/index.ts';
import { callerLines } from '../games/x01/index.ts';
import type { Change, Fact, Happening } from '../games/effects.ts';
import { changes } from '../games/effects.ts';
import type { MatchReport } from '../games/report.ts';
import { matchReport } from '../games/report.ts';
import type { Board } from './board.ts';
import type { Config } from './config.ts';
import type { Db, LiveRecord } from './db.ts';
import { UserError, cleanName } from './db.ts';
import type { Effects, Fx } from './effects/index.ts';
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
  /** Wyzwalacz occurrences as of the last event, to tell what the next one adds. */
  happenings: Happening[];
}

const QR_TIMEOUT_MS = 60_000;
/** A forgotten Test board would swallow every dart of the match. */
const TEST_TIMEOUT_MS = 10 * 60_000;
const INTRO_MS = 4_000;
const BUGS_DIR = resolve('bugs');
/** The app's version in a bug report; "-dirty" when local changes were running. */
const COMMIT = (() => {
  try {
    const head = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    return execSync('git status --porcelain --untracked-files=no', { encoding: 'utf8' }).trim() ? `${head}-dirty` : head;
  } catch {
    return null;
  }
})();

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
  /** A local Pilot is every browser on the laptop, whatever its profile; a phone is the Pilot only by its clientId. */
  private pilot: Client = { clientId: '', deviceName: 'Laptop', isLocal: true };
  private live: Live | null = null;
  private showQr = false;
  private qrTimer: NodeJS.Timeout | null = null;
  private boardTest: number | null = null;
  private testTimer: NodeJS.Timeout | null = null;
  private introTimer: NodeJS.Timeout | null = null;
  private howTo: ClientState['howTo'] = null;
  /** The summary of the match just saved, up until the pilot moves on (docs/UI.md, Podsumowanie meczu). Lost on restart. */
  private summary: MatchReport | null = null;
  /** A bull-off dart is in the board: the next dart counts only after the takeout. */
  private bullOut = false;
  private urls: string[];

  constructor(
    private db: Db,
    private board: Board,
    private cfg: Config,
    private effects: Effects,
    private closeApp: () => void,
    private useFakeBoard: (on: boolean) => void,
  ) {
    this.urls = lanUrls(cfg.port);
    const rec = db.loadLive();
    if (rec) {
      this.live = {
        rec, view: this.compute(rec), resumed: true, lastFix: null, record: this.recordInfo(rec), intro: false, newRecord: null, turnPass: 0,
        happenings: GAMES[rec.game].happenings(rec.events, rec.roster.length, rec.options),
      };
      this.live.newRecord = this.newRecords(this.live);
    }

    // Darts in the board during a visit are already in the match; later ones are new.
    board.countedOnBoard = () => {
      const v = this.live?.view;
      return v && v.phase === 'throwing' ? v.visit.darts.length : Infinity;
    };
    let online = board.status.connected;
    board.on('status', () => {
      if (board.status.connected !== online) {
        online = board.status.connected;
        this.hubFx({ kind: online ? 'boardOnline' : 'boardOffline' });
      }
      this.broadcast();
    });
    board.on('throw', (dart, coords) => {
      const v = this.live?.view;
      if (!v || this.bullOut || this.boardTest) return;
      if (v.phase === 'bulloff') {
        this.bullOut = true;
        this.apply({ t: 'bull', dart, coords, at: Date.now() });
        return;
      }
      if (v.phase !== 'throwing' || v.visit.dartsLeft === 0) return;
      this.apply({ t: 'dart', dart, coords, at: Date.now() });
    });
    board.on('takeoutStarted', () => {
      this.broadcast();
      if (this.boardTest) return;
      this.hubFx({ kind: 'takeoutStart' });
    });
    board.on('takeoutFinished', () => {
      if (this.boardTest) return this.broadcast();
      this.hubFx({ kind: 'takeoutEnd' });
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

  private isPilot(c: Client) {
    return this.pilot.isLocal ? c.isLocal : this.pilot.clientId === c.clientId;
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  broadcast() {
    const base = this.baseState();
    for (const [ws, c] of this.clients) {
      this.send(ws, {
        type: 'state',
        state: { ...base, you: { clientId: c.clientId, isPilot: this.isPilot(c), isLocal: c.isLocal } },
      });
    }
    const b = this.board.status;
    this.effects.setBase(!b.connected ? 'offline' : b.takeout.active ? 'takeout' : this.live ? 'match' : 'lobby');
  }

  /** Every browser gets the effect; only the kiosk plays the sound and only the scoreboard animates. */
  sendFx(fx: Fx) {
    for (const ws of this.clients.keys()) this.send(ws, { type: 'fx', fx });
  }

  /** A Wyzwalacz that comes from the hub, not from the match log. */
  private hubFx(fact: Fact) {
    this.effects.fire([{ fact, before: null }]);
  }

  private baseState(): Omit<ClientState, 'you'> {
    const pilotConnected = [...this.clients.values()].some(c => this.isPilot(c));
    const l = this.live;
    return {
      pilot: { clientId: this.pilot.clientId, deviceName: this.pilot.deviceName, connected: pilotConnected },
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
      summary: this.summary,
      players: this.db.players(),
      recentPlayerIds: this.db.recentPlayerIds(),
      urls: this.urls,
      showQr: this.showQr,
      boardTest: this.boardTest,
      howTo: this.howTo,
      effects: { ...(({ sounds, caller, leds, volume }) => ({ sounds, caller, leds, volume }))(this.effects.store.settings()), rev: this.effects.store.rev },
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
    const dartsBefore = 'visit' in l.view ? l.view.visit.darts.length : 0;
    l.view = this.compute(l.rec);
    // The visit went to the next player, or the next leg started: not the end of the match.
    const passed = (e.t === 'next' || e.t === 'nextLeg') && (before === 'throwing' || before === 'legWon') && l.view.phase === 'throwing';
    if (passed) l.turnPass++;
    const hadRecord = !!l.newRecord;
    l.newRecord = this.newRecords(l);
    if (e.t !== 'fix') l.lastFix = null;
    // The first dart closes the record screen and “How to play”.
    if (e.t === 'dart' || e.t === 'bull') {
      this.endIntro();
      this.howTo = null;
    }
    const happenings = GAMES[l.rec.game].happenings(l.rec.events, l.rec.roster.length, l.rec.options);
    const cs = changes(l.happenings, happenings, e.t === 'fix' ? 'fix' : e.t === 'undo' ? 'undo' : 'other');
    l.happenings = happenings;
    if (l.newRecord && !hadRecord && e.t !== 'undo') cs.push({ fact: { kind: 'game', event: 'newRecord' }, before: null });
    // Hit and Miss come from a fresh dart only, like the dart triggers.
    const cue = e.t === 'dart' ? dartCue(l.rec.game, l.view as MiniView, dartsBefore) : null;
    if (cue) cs.push({ fact: { kind: cue }, before: null });
    // State first, so the scoreboard animates the visit it already shows.
    this.broadcast();
    this.effects.fire(cs, this.caller(l, cs, e.t === 'next' || e.t === 'nextLeg' || e.t === 'start'));
    // Next player plays on its own, so a visit rule that comes with the same event does not drown it.
    if (passed) this.effects.fire([{ fact: { kind: 'nextPlayer' }, before: null }]);
  }

  /** The caller speaks in X01 and 121 only (docs/EFEKTY.md#caller). */
  private caller(l: Live, cs: Change[], turnStart: boolean): string[] {
    if (l.rec.game === 'x01') return callerLines(cs, l.view as X01View, turnStart);
    return l.rec.game === '121' ? callerLines121(cs, l.view as View121, turnStart) : [];
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
    this.summary = null;
    // Alone there is nobody to bull off against, whatever the setup says.
    const opts = { ...game.normalizeOptions(options), ...(roster.length === 1 && { bullOff: 'off' }) };
    const rec: LiveRecord = { key: randomUUID(), game: gameId, options: opts, roster, startedAt: Date.now(), events: [] };
    this.db.startLive(rec);
    if (gameId === 'killer') {
      const e = { t: 'numbers', numbers: drawNumbers(roster.length) };
      rec.events.push(e);
      this.db.appendLive(e);
    }
    const record = this.recordInfo(rec);
    const happenings = game.happenings(rec.events, roster.length, rec.options);
    this.live = { rec, view: this.compute(rec), resumed: false, lastFix: null, record, intro: !!record, newRecord: null, turnPass: 0, happenings };
    const cs = changes([], happenings, 'other');
    this.effects.fire([{ fact: { kind: 'matchStart' }, before: null }, ...cs], this.caller(this.live, cs, true));
    this.howTo = null;
    this.bullOut = false;
    if (record) {
      this.introTimer = setTimeout(() => {
        this.endIntro();
        this.broadcast();
      }, INTRO_MS);
    }
    // Detection on, and darts still sitting in the board belong to no one.
    void this.board.prepare().catch(() => undefined);
  }

  /** Saves or drops the live match, with `report` also keeping its summary on screen. Returns the saved setup for a rematch. */
  private finish(save: boolean, report = false) {
    const l = this.live;
    if (!l) throw new UserError('No match in progress');
    const { rec, view } = l;
    const game = GAMES[rec.game];
    const n = rec.roster.length;
    let status: 'finished' | 'ended' = 'ended';
    let winners: number[] = [];
    if (view.phase === 'matchWon') {
      status = 'finished';
      winners = 'winners' in view ? view.winners : view.matchWinner === null ? [] : [view.matchWinner];
    } else if (view.phase === 'legWon' && rec.game === 'x01' && rec.options.matchMode.kind === 'off') {
      // Without match mode, ending after a leg is the normal end; most legs wins.
      status = 'finished';
      const legs = (view as X01View).legs;
      const best = Math.max(...legs);
      winners = legs.filter(x => x === best).length === 1 ? [legs.indexOf(best)] : [];
    }
    if (status === 'finished' || save) {
      const mini = 'winners' in view ? view : null;
      const scores = this.recordScores(l);
      const legs = game.compact(rec.events, n, rec.options);
      if (report) {
        this.summary = matchReport({
          game: rec.game, description: game.describe(rec.options, n), names: rec.roster.map(r => r.name), legs, view,
          checkOut: rec.game === 'x01' ? rec.options.checkOut : null, ended: status === 'ended', ocheMeters: this.cfg.ocheMeters,
        });
      }
      this.db.saveMatch({
        game: rec.game, options: rec.options, roster: rec.roster, startedAt: rec.startedAt, endedAt: Date.now(),
        status, winners, sets: 'sets' in view ? view.sets : [], legs,
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
      const dirs = [`${this.cfg.dataDir}/backups`, ...(this.cfg.extraBackupDir ? [this.cfg.extraBackupDir] : [])];
      // Effects live in the repo; git keeps their history (docs/EFEKTY.md).
      this.db.backup(dirs);
    } catch (e) {
      console.error('Backup failed', e);
    }
  }

  /** One file per bug report in bugs/, under git; the fix commit deletes it (docs/UI.md#zgłaszanie-błędów). */
  private report(client: Client, cmd: Extract<Command, { type: 'report' }>) {
    const text = String(cmd.text ?? '').trim().slice(0, 4000);
    if (!text) throw new UserError('Describe the bug first');
    const at = new Date().toISOString();
    mkdirSync(BUGS_DIR, { recursive: true });
    writeFileSync(join(BUGS_DIR, `${at.replace(/[:.]/g, '-')}.json`), JSON.stringify({
      text, at, commit: COMMIT,
      device: { name: client.deviceName, isLocal: client.isLocal, isPilot: this.isPilot(client) },
      where: String(cmd.where ?? '').slice(0, 200),
      userAgent: String(cmd.userAgent ?? '').slice(0, 300),
      // The event log replays the match, so a test can rebuild the exact moment.
      match: this.live?.rec ?? null,
    }, null, 2) + '\n');
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
      this.pilot = { ...client };
      return {};
    }
    // Anyone who sees a bug can report it, not only the Pilot.
    if (cmd.type === 'report') {
      this.report(client, cmd);
      return {};
    }
    if (!this.isPilot(client)) throw new UserError('Take control first');
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
        if (this.board.status.takeout.active || this.bullOut) {
          await this.board.takeoutDone();
          this.hubFx({ kind: 'takeoutEnd' });
        }
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
        this.finish(cmd.save, cmd.save);
        return {};
      case 'closeMatch': {
        const rec = this.finish(true, cmd.then === 'summary');
        if (cmd.then === 'rematch') this.rematch(rec.game, rec.options, rec.roster);
        return {};
      }
      case 'closeSummary':
        this.summary = null;
        return {};
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
      case 'fakeBoard':
        this.useFakeBoard(!!cmd.on);
        return {};
      case 'boardTest':
        this.boardTest = cmd.on ? Date.now() : null;
        if (this.testTimer) clearTimeout(this.testTimer);
        if (cmd.on) this.testTimer = setTimeout(() => ((this.boardTest = null), this.broadcast()), TEST_TIMEOUT_MS);
        return {};
      case 'showQr':
        this.showQr = !!cmd.show;
        if (this.qrTimer) clearTimeout(this.qrTimer);
        if (this.showQr) this.qrTimer = setTimeout(() => ((this.showQr = false), this.broadcast()), QR_TIMEOUT_MS);
        return {};
      case 'player':
        return this.player(cmd.cmd);
      case 'effects': {
        const leds = this.effects.store.settings().leds;
        this.effects.store.updateSettings({
          ...(cmd.sounds !== undefined && { sounds: cmd.sounds }),
          ...(cmd.caller !== undefined && { caller: cmd.caller }),
          ...(cmd.leds !== undefined && { leds: cmd.leds }),
        });
        if (this.effects.store.settings().leds !== leds) this.effects.applyBase();
        return {};
      }
      case 'closeApp':
        setTimeout(() => this.closeApp(), 300);
        return {};
    }
  }
}
