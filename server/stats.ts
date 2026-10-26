// Read-only statistics over stored history (docs/STATYSTYKI.md). Computed on demand, no cache.
import type { Dart } from '../games/darts.ts';
import type { GameId } from '../games/index.ts';
import { GAMES } from '../games/index.ts';
import type { StatVisit, X01Options } from '../games/x01/index.ts';
import { x01Stats } from '../games/x01/index.ts';
import type { Db } from './db.ts';
import type { GameStatsResponse, H2HResponse, PlayerListItem, PlayerStatsResponse, RecordTable, StatsWindow } from './protocol.ts';

export const WINDOWS: StatsWindow[] = ['7d', '30d', '90d', '365d', 'all', 'l10', 'l100'];

const DAY = 24 * 60 * 60 * 1000;

export const parseWindow = (w: unknown): StatsWindow => (WINDOWS.includes(w as StatsWindow) ? (w as StatsWindow) : '30d');

function since(w: StatsWindow, now: number): number {
  const days = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[w as '7d'];
  return days ? now - days * DAY : 0;
}

const legLimit = (w: StatsWindow) => (w === 'l10' ? 10 : w === 'l100' ? 100 : null);

interface VisitRow {
  id: number;
  leg_id: number;
  match_id: number;
  finished: number;
  visit_no: number;
  score_before: number;
  scored: number;
  bust: number;
  checkout: number;
  darts_count: number;
  options: string;
}

export class Stats {
  constructor(private db: Db, private now = () => Date.now()) {}

  /** Leg ids in the window for one player (null means: no leg limit). */
  private legIds(playerId: number, w: StatsWindow): number[] | null {
    const n = legLimit(w);
    if (n === null) return null;
    return (this.db.sql.prepare(`
      SELECT v.leg_id AS id FROM visits v JOIN legs l ON l.id = v.leg_id JOIN matches m ON m.id = l.match_id
      WHERE v.player_id = ? AND m.game = 'x01'
      GROUP BY v.leg_id ORDER BY MAX(v.at) DESC LIMIT ?`).all(playerId, n) as { id: number }[]).map(r => r.id);
  }

  private visits(playerId: number, w: StatsWindow, matchIds?: number[]): VisitRow[] {
    const legs = this.legIds(playerId, w);
    const where = ['v.player_id = ?', "m.game = 'x01'"];
    const args: (number | string)[] = [playerId];
    if (legs) where.push(`v.leg_id IN (${legs.map(() => '?').join(',') || 'NULL'})`), args.push(...legs);
    else if (since(w, this.now())) where.push('v.at >= ?'), args.push(since(w, this.now()));
    if (matchIds) where.push(`m.id IN (${matchIds.map(() => '?').join(',') || 'NULL'})`), args.push(...matchIds);
    return this.db.sql.prepare(`
      SELECT v.id, v.leg_id, l.match_id, (l.winner_position IS NOT NULL) AS finished, v.visit_no, v.score_before, v.scored,
        v.bust, v.checkout, v.darts_count, m.options
      FROM visits v JOIN legs l ON l.id = v.leg_id JOIN matches m ON m.id = l.match_id
      WHERE ${where.join(' AND ')} ORDER BY v.id`).all(...args) as unknown as VisitRow[];
  }

  private dartsFor(visitIds: number[]): Map<number, Dart[]> {
    const map = new Map<number, Dart[]>();
    if (visitIds.length === 0) return map;
    // Chunked to stay below SQLite's parameter limit.
    for (let i = 0; i < visitIds.length; i += 500) {
      const chunk = visitIds.slice(i, i + 500);
      const rows = this.db.sql.prepare(`SELECT visit_id, n, m FROM darts WHERE visit_id IN (${chunk.map(() => '?').join(',')}) ORDER BY visit_id, idx`)
        .all(...chunk) as { visit_id: number; n: number; m: 1 | 2 | 3 }[];
      for (const r of rows) {
        const list = map.get(r.visit_id) ?? [];
        list.push({ n: r.n, m: r.m });
        map.set(r.visit_id, list);
      }
    }
    return map;
  }

  private x01(playerId: number, w: StatsWindow, matchIds?: number[]) {
    const rows = this.visits(playerId, w, matchIds);
    const darts = this.dartsFor(rows.map(r => r.id));
    const opts = new Map<string, X01Options>();
    const visits: StatVisit[] = rows.map(r => {
      if (!opts.has(r.options)) opts.set(r.options, JSON.parse(r.options));
      return {
        legId: r.leg_id,
        legFinished: !!r.finished,
        visitNo: r.visit_no,
        start: r.score_before,
        scored: r.scored,
        bust: !!r.bust,
        checkout: !!r.checkout,
        dartsCount: r.darts_count,
        darts: darts.get(r.id) ?? [],
        checkOut: opts.get(r.options)!.checkOut,
      };
    });
    return { stats: x01Stats(visits), matchIds: [...new Set(rows.map(r => r.match_id))] };
  }

  /** Matches that count for winrate and head-to-head, within the window. */
  private resultMatches(playerId: number, w: StatsWindow, x01MatchIds: number[]) {
    const where = ['mp.player_id = ?', 'm.counts_results = 1', "m.game = 'x01'"];
    const args: number[] = [playerId];
    if (legLimit(w)) where.push(`m.id IN (${x01MatchIds.map(() => '?').join(',') || 'NULL'})`), args.push(...x01MatchIds);
    else if (since(w, this.now())) where.push('m.ended_at >= ?'), args.push(since(w, this.now()));
    return this.db.sql.prepare(`
      SELECT m.id, (m.winner_position = mp.position) AS won FROM matches m JOIN match_players mp ON mp.match_id = m.id
      WHERE ${where.join(' AND ')}`).all(...args) as { id: number; won: number }[];
  }

  player(playerId: number, w: StatsWindow): PlayerStatsResponse | null {
    const player = this.db.player(playerId);
    if (!player) return null;
    const { stats, matchIds } = this.x01(playerId, w);
    const results = this.resultMatches(playerId, w, matchIds);
    const won = results.filter(r => r.won).length;

    const recent = (this.db.sql.prepare(`
      SELECT m.id, m.game, m.ended_at, m.options, m.status, m.winner_position, mp.position,
        (SELECT COUNT(*) FROM match_players c WHERE c.match_id = m.id) AS players,
        (SELECT GROUP_CONCAT(COALESCE(p2.name, o.guest_name), ', ') FROM match_players o LEFT JOIN players p2 ON p2.id = o.player_id
          WHERE o.match_id = m.id AND o.position != mp.position) AS opponents,
        (SELECT GROUP_CONCAT(o.legs_won, '–') FROM (SELECT legs_won FROM match_players WHERE match_id = m.id ORDER BY position) o) AS score
      FROM matches m JOIN match_players mp ON mp.match_id = m.id
      WHERE mp.player_id = ? ORDER BY m.ended_at DESC LIMIT 10`).all(playerId) as
      { id: number; game: GameId; ended_at: number; options: string; status: string; winner_position: number | null; position: number; players: number; opponents: string | null; score: string }[])
      .filter(r => r.game in GAMES)
      .map(r => {
        const game = GAMES[r.game];
        const result = r.status === 'ended' ? 'saved' : r.winner_position === null ? 'played' : r.winner_position === r.position ? 'won' : 'lost';
        return {
          id: r.id,
          endedAt: r.ended_at,
          description: game.describe(game.normalizeOptions(JSON.parse(r.options)), r.players),
          opponents: r.opponents ?? 'Solo',
          result: result as PlayerStatsResponse['recent'][number]['result'],
          score: r.game === 'x01' || r.game === 'hol' ? r.score : '',
        };
      });

    const ids = results.map(r => r.id);
    const opponents = ids.length === 0 ? [] : (this.db.sql.prepare(`
      SELECT p.id, p.name, COUNT(*) AS played, SUM(m.winner_position = me.position) AS won
      FROM matches m JOIN match_players me ON me.match_id = m.id AND me.player_id = ?
      JOIN match_players o ON o.match_id = m.id AND o.position != me.position JOIN players p ON p.id = o.player_id
      WHERE m.id IN (${ids.map(() => '?').join(',')})
      GROUP BY p.id ORDER BY played DESC`).all(playerId, ...ids) as { id: number; name: string; played: number; won: number }[]);

    return {
      player,
      window: w,
      x01: stats,
      results: { played: results.length, won, winrate: results.length ? Math.round((won / results.length) * 1000) / 10 : null },
      recent,
      opponents,
    };
  }

  h2h(a: number, b: number, w: StatsWindow): H2HResponse | null {
    const pa = this.db.player(a), pb = this.db.player(b);
    if (!pa || !pb || a === b) return null;
    const args: number[] = [a, b];
    let extra = '';
    if (since(w, this.now())) (extra = 'AND m.ended_at >= ?'), args.push(since(w, this.now()));
    const rows = this.db.sql.prepare(`
      SELECT m.id, m.winner_position AS winner, x.position AS pa, y.position AS pb
      FROM matches m JOIN match_players x ON x.match_id = m.id AND x.player_id = ?
      JOIN match_players y ON y.match_id = m.id AND y.player_id = ?
      WHERE m.counts_results = 1 AND m.game = 'x01' ${extra} ORDER BY m.ended_at DESC`).all(...args) as { id: number; winner: number; pa: number; pb: number }[];
    // Leg windows mean "the last N meetings" here.
    const limited = legLimit(w) ? rows.slice(0, legLimit(w)!) : rows;
    const ids = limited.map(r => r.id);
    const avgOf = (p: number) => (ids.length ? this.x01(p, 'all', ids).stats.avg : null);
    return {
      window: w,
      players: [pa, pb],
      played: limited.length,
      wins: [limited.filter(r => r.winner === r.pa).length, limited.filter(r => r.winner === r.pb).length],
      avg: [avgOf(a), avgOf(b)],
    };
  }

  /** A player's results in one minigame: matches, wins, the game's own totals and best result per record variant. */
  game(playerId: number, game: GameId, w: StatsWindow): GameStatsResponse | null {
    const player = this.db.player(playerId);
    if (!player || game === 'x01' || !(game in GAMES)) return null;
    const where = ['mp.player_id = ?', 'm.game = ?'];
    const args: (number | string)[] = [playerId, game];
    if (!legLimit(w) && since(w, this.now())) where.push('m.ended_at >= ?'), args.push(since(w, this.now()));
    // Leg windows mean "the last N matches" here: these games have one leg per match.
    const rows = this.db.sql.prepare(`
      SELECT mp.stats, m.status, m.winner_position = mp.position AS won, m.variant FROM matches m JOIN match_players mp ON mp.match_id = m.id
      WHERE ${where.join(' AND ')} ORDER BY m.ended_at DESC ${legLimit(w) ? `LIMIT ${legLimit(w)}` : ''}`).all(...args) as
      { stats: string | null; status: string; won: number | null; variant: string | null }[];
    const totals: Record<string, number> = {};
    for (const r of rows) for (const [k, v] of Object.entries(JSON.parse(r.stats ?? '{}') as Record<string, number>)) totals[k] = (totals[k] ?? 0) + v;
    const rec = GAMES[game].record;
    const variants = (this.db.sql.prepare(`
      SELECT DISTINCT m.variant FROM matches m JOIN match_players mp ON mp.match_id = m.id
      WHERE mp.player_id = ? AND m.game = ? AND m.variant IS NOT NULL AND mp.score IS NOT NULL`).all(playerId, game) as { variant: string }[]).map(r => r.variant);
    return {
      player,
      game,
      window: w,
      played: rows.length,
      won: rows.filter(r => r.won).length,
      totals,
      bests: !rec ? [] : variants.sort().map(v => {
        const best = this.db.records(v, rec.better, 1, playerId)[0];
        return { label: this.variantLabel(game, v), value: rec.format(best.value) };
      }),
    };
  }

  /** Top 10 of every record variant played so far. */
  records(game: GameId): RecordTable[] {
    const rec = GAMES[game]?.record;
    if (!rec) return [];
    const variants = (this.db.sql.prepare('SELECT DISTINCT variant FROM matches WHERE game = ? AND variant IS NOT NULL').all(game) as { variant: string }[])
      .map(r => r.variant).sort();
    return variants.map(key => ({
      key,
      label: this.variantLabel(game, key),
      rows: this.db.records(key, rec.better).map(r => ({ value: rec.format(r.value), who: r.who, at: r.at })),
    }));
  }

  /** The label of a stored variant, taken from the options of its latest match. */
  private variantLabel(game: GameId, key: string): string {
    const m = this.db.sql.prepare(`
      SELECT m.options, (SELECT COUNT(*) FROM match_players c WHERE c.match_id = m.id) AS players
      FROM matches m WHERE m.variant = ? ORDER BY m.ended_at DESC LIMIT 1`).get(key) as { options: string; players: number } | undefined;
    const g = GAMES[game];
    return (m && g.record?.variant(g.normalizeOptions(JSON.parse(m.options)), m.players)?.label) ?? key;
  }

  list(): PlayerListItem[] {
    const from = this.now() - 30 * DAY;
    return (this.db.sql.prepare(`
      SELECT p.id, p.name,
        (SELECT SUM(v.scored) * 3.0 / NULLIF(SUM(v.darts_count), 0) FROM visits v JOIN legs l ON l.id = v.leg_id JOIN matches m ON m.id = l.match_id
          WHERE v.player_id = p.id AND v.at >= ? AND m.game = 'x01') AS avg,
        (SELECT COUNT(*) FROM match_players mp WHERE mp.player_id = p.id) AS matches,
        (SELECT MAX(m.ended_at) FROM match_players mp JOIN matches m ON m.id = mp.match_id WHERE mp.player_id = p.id) AS lastPlayed
      FROM players p WHERE p.archived = 0 ORDER BY p.name_key`).all(from) as unknown as PlayerListItem[])
      .map(p => ({ ...p, avg: p.avg === null ? null : Math.round(p.avg * 100) / 100 }));
  }
}
