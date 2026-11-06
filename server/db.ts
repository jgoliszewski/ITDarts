// SQLite storage: players, the live match event log and compacted history (ADR 0004).
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { label } from '../games/darts.ts';
import type { GameId } from '../games/index.ts';
import { GAMES } from '../games/index.ts';
import type { LegRecord } from '../games/x01/index.ts';
import type { Removed } from '../games/turns.ts';
import type { MatchSummary, PlayerInfo, RosterEntry } from './protocol.ts';

// Each entry moves the schema one version up. Never edit a shipped entry; add a new one.
const MIGRATIONS = [
  `
  CREATE TABLE players (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    archived INTEGER NOT NULL DEFAULT 0,
    anonymized INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE live_match (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    match_key TEXT NOT NULL,
    game TEXT NOT NULL,
    options TEXT NOT NULL,
    roster TEXT NOT NULL,
    started_at INTEGER NOT NULL
  );
  CREATE TABLE live_events (
    seq INTEGER PRIMARY KEY,
    event TEXT NOT NULL
  );
  CREATE TABLE matches (
    id INTEGER PRIMARY KEY,
    game TEXT NOT NULL,
    options TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('finished', 'ended')),
    winner_position INTEGER,
    counts_results INTEGER NOT NULL
  );
  CREATE TABLE match_players (
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    player_id INTEGER REFERENCES players(id),
    guest_name TEXT,
    legs_won INTEGER NOT NULL,
    sets_won INTEGER NOT NULL,
    PRIMARY KEY (match_id, position)
  );
  CREATE TABLE legs (
    id INTEGER PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    set_no INTEGER NOT NULL,
    leg_no INTEGER NOT NULL,
    starter_position INTEGER NOT NULL,
    winner_position INTEGER
  );
  CREATE TABLE visits (
    id INTEGER PRIMARY KEY,
    leg_id INTEGER NOT NULL REFERENCES legs(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id),
    visit_no INTEGER NOT NULL,
    score_before INTEGER NOT NULL,
    scored INTEGER NOT NULL,
    bust INTEGER NOT NULL,
    checkout INTEGER NOT NULL,
    darts_count INTEGER NOT NULL,
    at INTEGER NOT NULL
  );
  CREATE TABLE darts (
    visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    idx INTEGER NOT NULL,
    n INTEGER NOT NULL,
    m INTEGER NOT NULL,
    x REAL,
    y REAL,
    at INTEGER NOT NULL,
    PRIMARY KEY (visit_id, idx)
  );
  CREATE INDEX visits_player_at ON visits(player_id, at);
  CREATE INDEX visits_leg ON visits(leg_id);
  CREATE INDEX legs_match ON legs(match_id);
  CREATE INDEX match_players_player ON match_players(player_id);
  `,
  // Minigames: the record variant of the match, and per player the record value and the game's own totals (JSON).
  `
  ALTER TABLE matches ADD COLUMN variant TEXT;
  ALTER TABLE match_players ADD COLUMN score REAL;
  ALTER TABLE match_players ADD COLUMN stats TEXT;
  CREATE INDEX matches_variant ON matches(variant);
  CREATE INDEX matches_game ON matches(game, ended_at);
  `,
  // Effects (docs/EFEKTY.md): settings as JSON per key, the sound library and the rules. Triggers and sound ids are JSON.
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE sounds (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    file TEXT NOT NULL UNIQUE,
    volume INTEGER NOT NULL DEFAULT 100,
    duration_ms INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE effect_rules (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    triggers TEXT NOT NULL,
    sounds TEXT NOT NULL,
    led_preset INTEGER,
    led_seconds REAL NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );
  `,
  // Ties in ATC and Full Board have several winners (docs/GRY.md), which winner_position cannot hold.
  `
  ALTER TABLE match_players ADD COLUMN won INTEGER NOT NULL DEFAULT 0;
  UPDATE match_players SET won = 1 WHERE (match_id, position) IN (SELECT id, winner_position FROM matches);
  `,
  // Wycofanie z meczu (docs/UI.md#wycofanie-gracza): his darts count, the match does not count as played for him.
  `
  ALTER TABLE match_players ADD COLUMN removed INTEGER NOT NULL DEFAULT 0;
  `,
];

// Options and events are whatever the game module takes; the module checks them.
export interface LiveRecord {
  key: string;
  game: GameId;
  options: any;
  roster: RosterEntry[];
  startedAt: number;
  events: any[];
}

export interface SaveMatch {
  game: GameId;
  options: unknown;
  roster: RosterEntry[];
  startedAt: number;
  endedAt: number;
  status: 'finished' | 'ended';
  /** Everyone who won; several on a tie. */
  winners: number[];
  sets: number[];
  legs: LegRecord[];
  /** Legs won per player; counted from `legs` when missing. Higher or Lower stores its games here. */
  legsWon?: number[];
  variant?: string | null;
  scores?: (number | null)[];
  stats?: Record<string, number>[];
  /** Per player: removed from the match. */
  removed?: boolean[];
}

export interface RecordRow {
  value: number;
  who: string;
  at: number;
}

export class UserError extends Error {}

const nameKey = (name: string) => name.trim().toLocaleLowerCase('en');

export function cleanName(name: unknown): string {
  const n = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (!n) throw new UserError('Name is empty');
  if (n.length > 24) throw new UserError('Name is too long (max 24)');
  return n;
}

export class Db {
  readonly sql: DatabaseSync;
  readonly file: string;

  constructor(readonly dir: string) {
    mkdirSync(dir, { recursive: true });
    this.file = join(dir, 'itdarts.db');
    this.sql = new DatabaseSync(this.file);
    this.sql.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;');
    this.migrate();
  }

  private migrate() {
    const { user_version: version } = this.sql.prepare('PRAGMA user_version').get() as { user_version: number };
    for (let v = version; v < MIGRATIONS.length; v++) {
      this.tx(() => {
        this.sql.exec(MIGRATIONS[v]);
        this.sql.exec(`PRAGMA user_version = ${v + 1}`);
      });
    }
  }

  tx<T>(fn: () => T): T {
    this.sql.exec('BEGIN');
    try {
      const r = fn();
      this.sql.exec('COMMIT');
      return r;
    } catch (e) {
      this.sql.exec('ROLLBACK');
      throw e;
    }
  }

  // ---------- board rotation ----------

  boardRotatedAt(): string | null {
    const r = this.sql.prepare("SELECT value FROM settings WHERE key = 'boardRotatedAt'").get() as { value: string } | undefined;
    return r?.value ?? null;
  }

  setBoardRotatedAt(iso: string) {
    this.sql.prepare("INSERT INTO settings (key, value) VALUES ('boardRotatedAt', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(iso);
  }

  // ---------- players ----------

  players(): PlayerInfo[] {
    return (this.sql.prepare('SELECT id, name, archived FROM players ORDER BY name_key').all() as { id: number; name: string; archived: number }[])
      .map(p => ({ id: p.id, name: p.name, archived: !!p.archived }));
  }

  player(id: number): PlayerInfo | null {
    const p = this.sql.prepare('SELECT id, name, archived FROM players WHERE id = ?').get(id) as { id: number; name: string; archived: number } | undefined;
    return p ? { id: p.id, name: p.name, archived: !!p.archived } : null;
  }

  private assertFree(name: string, except?: number) {
    const row = this.sql.prepare('SELECT id FROM players WHERE name_key = ?').get(nameKey(name)) as { id: number } | undefined;
    if (row && row.id !== except) throw new UserError(`“${name}” already exists`);
  }

  createPlayer(raw: string): number {
    const name = cleanName(raw);
    this.assertFree(name);
    const r = this.sql.prepare('INSERT INTO players (name, name_key, created_at) VALUES (?, ?, ?)').run(name, nameKey(name), Date.now());
    return Number(r.lastInsertRowid);
  }

  renamePlayer(id: number, raw: string) {
    const name = cleanName(raw);
    this.assertFree(name, id);
    if (!this.sql.prepare('UPDATE players SET name = ?, name_key = ? WHERE id = ?').run(name, nameKey(name), id).changes) throw new UserError('No such player');
  }

  archivePlayer(id: number, archived: boolean) {
    this.sql.prepare('UPDATE players SET archived = ? WHERE id = ?').run(archived ? 1 : 0, id);
  }

  /** Keeps the matches, drops the name. */
  anonymizePlayer(id: number) {
    this.sql.prepare("UPDATE players SET name = 'Deleted player', name_key = 'deleted#' || id, anonymized = 1, archived = 1 WHERE id = ?").run(id);
  }

  /** Moves all history of `from` to `into` and removes `from`. */
  mergePlayers(from: number, into: number) {
    if (from === into) throw new UserError('Pick two different players');
    if (!this.player(from) || !this.player(into)) throw new UserError('No such player');
    this.tx(() => {
      this.sql.prepare('UPDATE visits SET player_id = ? WHERE player_id = ?').run(into, from);
      this.sql.prepare('UPDATE match_players SET player_id = ? WHERE player_id = ?').run(into, from);
      this.sql.prepare('DELETE FROM players WHERE id = ?').run(from);
    });
  }

  recentPlayerIds(limit = 8): number[] {
    return (this.sql.prepare(`
      SELECT mp.player_id AS id FROM match_players mp JOIN matches m ON m.id = mp.match_id
      JOIN players p ON p.id = mp.player_id
      WHERE p.archived = 0
      GROUP BY mp.player_id ORDER BY MAX(m.ended_at) DESC LIMIT ?`).all(limit) as { id: number }[]).map(r => r.id);
  }

  // ---------- live match ----------

  startLive(rec: Omit<LiveRecord, 'events'>) {
    this.tx(() => {
      this.sql.exec('DELETE FROM live_match; DELETE FROM live_events;');
      this.sql.prepare('INSERT INTO live_match (id, match_key, game, options, roster, started_at) VALUES (1, ?, ?, ?, ?, ?)')
        .run(rec.key, rec.game, JSON.stringify(rec.options), JSON.stringify(rec.roster), rec.startedAt);
    });
  }

  appendLive(event: unknown) {
    this.sql.prepare('INSERT INTO live_events (event) VALUES (?)').run(JSON.stringify(event));
  }

  clearLive() {
    this.sql.exec('DELETE FROM live_match; DELETE FROM live_events;');
  }

  loadLive(): LiveRecord | null {
    const m = this.sql.prepare('SELECT * FROM live_match WHERE id = 1').get() as
      { match_key: string; game: GameId; options: string; roster: string; started_at: number } | undefined;
    if (!m || !(m.game in GAMES)) return null;
    const events = (this.sql.prepare('SELECT event FROM live_events ORDER BY seq').all() as { event: string }[]).map(r => JSON.parse(r.event));
    // Options saved before a game got a new option load with its default (e.g. Higher or Lower lives).
    return { key: m.match_key, game: m.game, options: GAMES[m.game].normalizeOptions(JSON.parse(m.options)), roster: JSON.parse(m.roster), startedAt: m.started_at, events };
  }

  // ---------- history ----------

  saveMatch(s: SaveMatch): number {
    const registered = s.roster.every(r => r.playerId !== null);
    const winner = s.winners.length === 1 ? s.winners[0] : null;
    const counts = s.status === 'finished' && winner !== null && s.roster.length >= 2 && registered;
    const legsWon = s.legsWon ?? s.roster.map((_, i) => s.legs.filter(l => l.winner === i).length);
    return this.tx(() => {
      const matchId = Number(this.sql.prepare(
        'INSERT INTO matches (game, options, started_at, ended_at, status, winner_position, counts_results, variant) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(s.game, JSON.stringify(s.options), s.startedAt, s.endedAt, s.status, winner, counts ? 1 : 0, s.variant ?? null).lastInsertRowid);
      const mp = this.sql.prepare(
        'INSERT INTO match_players (match_id, position, player_id, guest_name, legs_won, sets_won, score, stats, won, removed) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      s.roster.forEach((r, i) => mp.run(matchId, i, r.playerId, r.playerId === null ? r.name : null, legsWon[i], s.sets[i] ?? 0,
        r.playerId === null ? null : (s.scores?.[i] ?? null), s.stats?.[i] ? JSON.stringify(s.stats[i]) : null,
        s.winners.includes(i) ? 1 : 0, s.removed?.[i] ? 1 : 0));
      const legIns = this.sql.prepare('INSERT INTO legs (match_id, set_no, leg_no, starter_position, winner_position) VALUES (?, ?, ?, ?, ?)');
      const visitIns = this.sql.prepare(
        'INSERT INTO visits (leg_id, player_id, visit_no, score_before, scored, bust, checkout, darts_count, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const dartIns = this.sql.prepare('INSERT INTO darts (visit_id, idx, n, m, x, y, at) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const leg of s.legs) {
        const legId = Number(legIns.run(matchId, leg.set, leg.legNo, leg.starter, leg.winner).lastInsertRowid);
        for (const v of leg.visits) {
          const playerId = s.roster[v.player].playerId;
          if (playerId === null) continue; // guests leave no statistics
          const at = v.darts.at(-1)?.at ?? s.endedAt;
          const visitId = Number(visitIns.run(legId, playerId, v.visitNo, v.start, v.scored, v.bust ? 1 : 0, v.checkout ? 1 : 0, v.dartsCount, at).lastInsertRowid);
          v.darts.forEach((d, i) => dartIns.run(visitId, i, d.dart.n, d.dart.m, d.coords?.x ?? null, d.coords?.y ?? null, d.at));
        }
      }
      this.sql.exec('DELETE FROM live_match; DELETE FROM live_events;');
      return matchId;
    });
  }

  /** The last match's full roster with who left it; the hub's rematchSetup turns it into the rematch. */
  lastMatchSetup(): { game: GameId; options: unknown; roster: RosterEntry[]; removed: Removed[] } | null {
    const m = this.sql.prepare('SELECT id, game, options FROM matches ORDER BY ended_at DESC, id DESC LIMIT 1').get() as { id: number; game: GameId; options: string } | undefined;
    if (!m || !(m.game in GAMES)) return null;
    const rows = this.sql.prepare(`
      SELECT mp.player_id AS playerId, COALESCE(p.name, mp.guest_name) AS name, mp.removed FROM match_players mp
      LEFT JOIN players p ON p.id = mp.player_id WHERE mp.match_id = ? ORDER BY mp.position`).all(m.id) as unknown as (RosterEntry & { removed: number })[];
    return {
      game: m.game,
      options: JSON.parse(m.options),
      roster: rows.map(({ playerId, name }) => ({ playerId, name })),
      removed: rows.map(r => (r.removed ? 'match' : null)),
    };
  }

  lastMatch(): MatchSummary | null {
    const m = this.sql.prepare('SELECT * FROM matches ORDER BY ended_at DESC, id DESC LIMIT 1').get() as
      { id: number; game: GameId; options: string; ended_at: number; status: 'finished' | 'ended'; winner_position: number | null } | undefined;
    if (!m || !(m.game in GAMES)) return null;
    const game = GAMES[m.game];
    const players = this.sql.prepare(`
      SELECT mp.position, COALESCE(p.name, mp.guest_name) AS name, mp.won, mp.legs_won, mp.sets_won, mp.score, mp.removed,
        (SELECT SUM(v.scored) * 3.0 / NULLIF(SUM(v.darts_count), 0) FROM visits v JOIN legs l ON l.id = v.leg_id
          WHERE l.match_id = mp.match_id AND v.player_id = mp.player_id) AS avg
      FROM match_players mp LEFT JOIN players p ON p.id = mp.player_id
      WHERE mp.match_id = ? ORDER BY mp.position`).all(m.id) as { position: number; name: string; won: number; legs_won: number; sets_won: number; score: number | null; removed: number; avg: number | null }[];
    const x01 = m.game === 'x01';
    const sets = players.some(p => p.sets_won > 0);
    const value = (p: (typeof players)[number]) =>
      x01 ? String(sets ? p.sets_won : p.legs_won)
      : p.score !== null && game.record ? game.record.format(p.score)
      : m.game === 'hol' ? String(p.legs_won)
      : p.won ? 'Won' : '';
    const last = this.sql.prepare(`
      SELECT d.n, d.m FROM legs l JOIN visits v ON v.leg_id = l.id AND v.checkout = 1
      JOIN darts d ON d.visit_id = v.id WHERE l.match_id = ? ORDER BY l.id DESC, d.idx DESC LIMIT 1`).get(m.id) as { n: number; m: 1 | 2 | 3 } | undefined;
    return {
      id: m.id,
      game: m.game,
      description: game.describe(game.normalizeOptions(JSON.parse(m.options)), players.length),
      endedAt: m.ended_at,
      status: m.status,
      players: players.map(p => ({
        name: p.name,
        value: value(p),
        avg: !x01 || p.avg === null ? null : Math.round(p.avg * 100) / 100,
        winner: !!p.won,
        left: !!p.removed,
      })),
      checkout: x01 && last ? label(last) : null,
    };
  }

  // ---------- records ----------

  /**
   * Best results of a record variant, best first. Co-op variants give one row per match with the whole lineup,
   * the others one row per player and match. `playerId` narrows it to the results of one player.
   */
  records(variant: string, better: 'lower' | 'higher', limit = 10, playerId?: number): RecordRow[] {
    const dir = better === 'lower' ? 'ASC' : 'DESC';
    const mine = playerId === undefined ? '' : 'AND mp.player_id = ?';
    const args = playerId === undefined ? [variant, limit] : [variant, playerId, limit];
    if (variant.endsWith(':coop')) {
      return this.sql.prepare(`
        SELECT MAX(mp.score) AS value, m.ended_at AS at,
          (SELECT GROUP_CONCAT(name, ' & ') FROM (SELECT p2.name FROM match_players o JOIN players p2 ON p2.id = o.player_id
            WHERE o.match_id = m.id AND o.removed = 0 ORDER BY o.position)) AS who
        FROM matches m JOIN match_players mp ON mp.match_id = m.id
        WHERE m.variant = ? AND mp.score IS NOT NULL ${mine}
        GROUP BY m.id ORDER BY value ${dir}, at ASC LIMIT ?`).all(...args) as unknown as RecordRow[];
    }
    return this.sql.prepare(`
      SELECT mp.score AS value, m.ended_at AS at, p.name AS who
      FROM matches m JOIN match_players mp ON mp.match_id = m.id JOIN players p ON p.id = mp.player_id
      WHERE m.variant = ? AND mp.score IS NOT NULL ${mine}
      ORDER BY value ${dir}, at ASC LIMIT ?`).all(...args) as unknown as RecordRow[];
  }

  // ---------- backup ----------

  /** Copies the database with VACUUM INTO and keeps the newest `keep` copies in each folder. */
  backup(dirs: string[], keep = 30): string[] {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const written: string[] = [];
    for (const dir of dirs) {
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `itdarts-${stamp}.db`);
      rmSync(file, { force: true });
      this.sql.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
      written.push(file);
      const old = readdirSync(dir).filter(f => /^itdarts-\d{8}-\d{6}\.db$/.test(f)).sort().reverse().slice(keep);
      for (const f of old) rmSync(join(dir, f), { force: true });
    }
    return written;
  }

  close() {
    this.sql.close();
  }
}
