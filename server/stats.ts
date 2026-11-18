// Read-only statistics over stored history (docs/STATYSTYKI.md). Computed on demand, no cache.
import type { Dart } from '../games/darts.ts';
import type { GameId } from '../games/index.ts';
import { GAMES, GAME_GROUPS } from '../games/index.ts';
import type { X01Options, X01Stats } from '../games/x01/index.ts';
import { x01Stats } from '../games/x01/index.ts';
import type { Db } from './db.ts';
import { walked } from '../games/report.ts';
import type { GameStatsResponse, H2HResponse, HeatResponse, LobbyRecord, PlayerListItem, PlayerStatsResponse, RecordTable, StatsWindow } from './protocol.ts';

export const WINDOWS: StatsWindow[] = ['7d', '30d', '90d', '365d', 'all', 'l10', 'l100'];

const DAY = 24 * 60 * 60 * 1000;

export const parseWindow = (w: unknown): StatsWindow => (WINDOWS.includes(w as StatsWindow) ? (w as StatsWindow) : '30d');

function since(w: StatsWindow, now: number): number {
  const days = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 }[w as '7d'];
  return days ? now - days * DAY : 0;
}

/** Time bounds of the window, or of the period of the same length right before it (`[now - 2d, now - d)`). */
function bounds(w: StatsWindow, now: number, prev: boolean): { from: number; to: number | null } {
  const from = since(w, now);
  return prev && from ? { from: now - 2 * (now - from), to: from } : { from, to: null };
}

/** A previous Okno needs this many legs (minigames: matches) to be worth comparing with. */
const MIN_PREVIOUS = 3;
/** Checkout % is compared only when both Okna have this many checkout attempts: one hit out of one is no 100%. */
const MIN_CHECKOUT_ATTEMPTS = 10;

const legLimit = (w: StatsWindow) => (w === 'l10' ? 10 : w === 'l100' ? 100 : null);

interface VisitRow {
  id: number;
  leg_id: number;
  match_id: number;
  ended_at: number;
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
  constructor(private db: Db, private now = () => Date.now(), private ocheMeters = 2.37) {}

  /** Leg ids in the window for one player (null means: no leg limit). Minigames have one leg per match. */
  private legIds(playerId: number, w: StatsWindow, game: GameId = 'x01', prev = false): number[] | null {
    const n = legLimit(w);
    if (n === null) return null;
    return (this.db.sql.prepare(`
      SELECT v.leg_id AS id FROM visits v JOIN legs l ON l.id = v.leg_id JOIN matches m ON m.id = l.match_id
      WHERE v.player_id = ? AND m.game = ?
      GROUP BY v.leg_id ORDER BY MAX(v.at) DESC LIMIT ? OFFSET ?`).all(playerId, game, n, prev ? n : 0) as { id: number }[]).map(r => r.id);
  }

  /** Where each player's darts landed in one game, and how far they walked (docs/UI.md, Heatmapa). */
  heat(ids: number[], game: GameId, w: StatsWindow): HeatResponse {
    return ids.flatMap(id => {
      const player = this.db.player(id);
      if (!player) return [];
      const legs = this.legIds(id, w, game);
      const where = ['v.player_id = ?', 'm.game = ?'];
      const args: (number | string)[] = [id, game];
      if (legs) where.push(`v.leg_id IN (${legs.map(() => '?').join(',') || 'NULL'})`), args.push(...legs);
      else if (since(w, this.now())) where.push('v.at >= ?'), args.push(since(w, this.now()));
      const from = `FROM visits v JOIN legs l ON l.id = v.leg_id JOIN matches m ON m.id = l.match_id WHERE ${where.join(' AND ')}`;
      const visits = (this.db.sql.prepare(`SELECT COUNT(*) AS n ${from}`).get(...args) as { n: number }).n;
      const rows = this.db.sql.prepare(`SELECT d.x, d.y FROM darts d WHERE d.visit_id IN (SELECT v.id ${from})`).all(...args) as { x: number | null; y: number | null }[];
      const darts = rows.filter(r => r.x !== null && r.y !== null).map(r => [r.x, r.y] as [number, number]);
      return [{ player, heat: { darts, noPos: rows.length - darts.length, visits }, distance: walked(visits, this.ocheMeters) }];
    });
  }

  private visits(playerId: number, w: StatsWindow, matchIds?: number[], prev = false): VisitRow[] {
    const legs = this.legIds(playerId, w, 'x01', prev);
    const where = ['v.player_id = ?', "m.game = 'x01'"];
    const args: (number | string)[] = [playerId];
    const { from, to } = bounds(w, this.now(), prev);
    if (legs) where.push(`v.leg_id IN (${legs.map(() => '?').join(',') || 'NULL'})`), args.push(...legs);
    else if (from) where.push('v.at >= ?'), args.push(from);
    if (!legs && to) where.push('v.at < ?'), args.push(to);
    if (matchIds) where.push(`m.id IN (${matchIds.map(() => '?').join(',') || 'NULL'})`), args.push(...matchIds);
    return this.db.sql.prepare(`
      SELECT v.id, v.leg_id, l.match_id, m.ended_at, (l.winner_position IS NOT NULL) AS finished, v.visit_no, v.score_before, v.scored,
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

  private statVisits(playerId: number, w: StatsWindow, matchIds?: number[], prev = false) {
    const rows = this.visits(playerId, w, matchIds, prev);
    const darts = this.dartsFor(rows.map(r => r.id));
    const opts = new Map<string, X01Options>();
    return rows.map(r => {
      if (!opts.has(r.options)) opts.set(r.options, JSON.parse(r.options));
      return {
        matchId: r.match_id,
        endedAt: r.ended_at,
        legId: r.leg_id,
        legFinished: !!r.finished,
        startScore: opts.get(r.options)!.startScore,
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
  }

  private x01(playerId: number, w: StatsWindow, matchIds?: number[]) {
    const visits = this.statVisits(playerId, w, matchIds);
    return { stats: x01Stats(visits), matchIds: [...new Set(visits.map(v => v.matchId))], visits };
  }

  /**
   * Average, First 9 and Checkout % of the Okno before this one; null for All time, for an Okno with no leg of its own,
   * and for fewer than 3 legs there. Checkout % alone is null with fewer than 10 checkout attempts in either Okno.
   */
  private previousX01(playerId: number, w: StatsWindow, current: X01Stats): PlayerStatsResponse['previous'] {
    if (w === 'all' || !current.legs) return null;
    const p = x01Stats(this.statVisits(playerId, w, undefined, true));
    if (p.legs < MIN_PREVIOUS) return null;
    const enough = Math.min(p.checkoutAttempts, current.checkoutAttempts) >= MIN_CHECKOUT_ATTEMPTS;
    return { avg: p.avg, first9: p.first9, checkoutPct: enough ? p.checkoutPct : null };
  }

  /**
   * The player's Average in every X01 match of the Okno, oldest first. A match cut by the edge of the Okno counts
   * with the visits inside it only, like the figures above the chart (docs/STATYSTYKI.md, Progres).
   */
  private trend(visits: ReturnType<Stats['statVisits']>): PlayerStatsResponse['trend'] {
    const byMatch = new Map<number, typeof visits>();
    for (const v of visits) byMatch.set(v.matchId, [...(byMatch.get(v.matchId) ?? []), v]);
    return [...byMatch].flatMap(([matchId, vs]) => {
      const a = x01Stats(vs).avg;
      return a === null ? [] : [{ matchId, endedAt: vs[0].endedAt, avg: a }];
    }).sort((a, b) => a.endedAt - b.endedAt || a.matchId - b.matchId);
  }

  /** Matches that count for winrate and head-to-head, within the window. */
  private resultMatches(playerId: number, w: StatsWindow, x01MatchIds: number[]) {
    const where = ['mp.player_id = ?', 'mp.removed = 0', 'm.counts_results = 1', "m.game = 'x01'"];
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
    const { stats, matchIds, visits } = this.x01(playerId, w);
    const results = this.resultMatches(playerId, w, matchIds);
    const won = results.filter(r => r.won).length;

    // X01 matches of the Okno, as `resultMatches` counts them but without the counts_results filter.
    const rWhere = ['mp.player_id = ?', "m.game = 'x01'"];
    const rArgs: number[] = [playerId];
    if (legLimit(w)) rWhere.push(`m.id IN (${matchIds.map(() => '?').join(',') || 'NULL'})`), rArgs.push(...matchIds);
    else if (since(w, this.now())) rWhere.push('m.ended_at >= ?'), rArgs.push(since(w, this.now()));
    const recent = (this.db.sql.prepare(`
      SELECT m.id, m.game, m.ended_at, m.options, m.status, m.winner_position, mp.won, mp.removed,
        (SELECT COUNT(*) FROM match_players c WHERE c.match_id = m.id) AS players,
        (SELECT GROUP_CONCAT(COALESCE(p2.name, o.guest_name), ', ') FROM match_players o LEFT JOIN players p2 ON p2.id = o.player_id
          WHERE o.match_id = m.id AND o.position != mp.position) AS opponents,
        (SELECT GROUP_CONCAT(o.legs_won, '–') FROM (SELECT legs_won FROM match_players WHERE match_id = m.id ORDER BY position != mp.position, position) o) AS score
      FROM matches m JOIN match_players mp ON mp.match_id = m.id
      WHERE ${rWhere.join(' AND ')} ORDER BY m.ended_at DESC LIMIT 10`).all(...rArgs) as
      { id: number; game: GameId; ended_at: number; options: string; status: string; winner_position: number | null; won: number; removed: number; players: number; opponents: string | null; score: string }[])
      .filter(r => r.game in GAMES)
      .map(r => {
        const game = GAMES[r.game];
        const options = game.normalizeOptions(JSON.parse(r.options));
        const result = r.removed ? 'left' : r.status === 'ended' ? 'saved' : r.won ? 'won' : r.winner_position === null ? 'played' : 'lost';
        return {
          id: r.id,
          endedAt: r.ended_at,
          description: game.describe(options, r.players),
          opponents: r.opponents ?? 'Solo',
          result: result as PlayerStatsResponse['recent'][number]['result'],
          score: r.score,
        };
      });

    const ids = results.map(r => r.id);
    const opponents = ids.length === 0 ? [] : (this.db.sql.prepare(`
      SELECT p.id, p.name, COUNT(*) AS played, SUM(m.winner_position = me.position) AS won
      FROM matches m JOIN match_players me ON me.match_id = m.id AND me.player_id = ?
      JOIN match_players o ON o.match_id = m.id AND o.position != me.position AND o.removed = 0 JOIN players p ON p.id = o.player_id
      WHERE m.id IN (${ids.map(() => '?').join(',')})
      GROUP BY p.id ORDER BY played DESC`).all(playerId, ...ids) as { id: number; name: string; played: number; won: number }[]);

    return {
      player,
      window: w,
      x01: stats,
      previous: this.previousX01(playerId, w, stats),
      trend: this.trend(visits),
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
      FROM matches m JOIN match_players x ON x.match_id = m.id AND x.player_id = ? AND x.removed = 0
      JOIN match_players y ON y.match_id = m.id AND y.player_id = ? AND y.removed = 0
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

  /** One player's rows of one minigame in the Okno, or in the one before it. Leg windows mean "the last N matches": these games have one leg per match. */
  private gameRows(playerId: number, game: GameId, w: StatsWindow, prev = false) {
    const where = ['mp.player_id = ?', 'm.game = ?'];
    const args: (number | string)[] = [playerId, game];
    const n = legLimit(w);
    const { from, to } = bounds(w, this.now(), prev);
    if (!n && from) where.push('m.ended_at >= ?'), args.push(from);
    if (!n && to) where.push('m.ended_at < ?'), args.push(to);
    return this.db.sql.prepare(`
      SELECT mp.stats, m.status, m.counts_results, mp.won, mp.removed, m.variant FROM matches m JOIN match_players mp ON mp.match_id = m.id
      WHERE ${where.join(' AND ')} ORDER BY m.ended_at DESC ${n ? `LIMIT ${n} OFFSET ${prev ? n : 0}` : ''}`).all(...args) as
      { stats: string | null; status: string; counts_results: number; won: number | null; removed: number; variant: string | null }[];
  }

  /** The game's own per-player stats summed over matches. A `best` key is a maximum over matches, all others are sums (docs/STATYSTYKI.md). */
  private static totals(rows: { stats: string | null }[]): Record<string, number> {
    const totals: Record<string, number> = {};
    for (const r of rows) for (const [k, v] of Object.entries(JSON.parse(r.stats ?? '{}') as Record<string, number>)) totals[k] = k === 'best' ? Math.max(totals[k] ?? 0, v) : (totals[k] ?? 0) + v;
    return totals;
  }

  /** A player's results in one minigame: matches, wins, the game's own totals and best result per record variant. */
  game(playerId: number, game: GameId, w: StatsWindow): GameStatsResponse | null {
    const player = this.db.player(playerId);
    if (!player || game === 'x01' || !(game in GAMES)) return null;
    const rows = this.gameRows(playerId, game, w);
    // No comparison with nothing: an empty Okno has no previous either.
    const before = w === 'all' || rows.length === 0 ? [] : this.gameRows(playerId, game, w, true);
    const rec = GAMES[game].record;
    const variants = (this.db.sql.prepare(`
      SELECT DISTINCT m.variant FROM matches m JOIN match_players mp ON mp.match_id = m.id
      WHERE mp.player_id = ? AND m.game = ? AND m.variant IS NOT NULL AND mp.score IS NOT NULL`).all(playerId, game) as { variant: string }[]).map(r => r.variant);
    // Winrate follows X01: finished, two or more players, all registered, nobody tied (matches.counts_results), and the player stayed.
    const versus = rows.filter(r => r.counts_results && !r.removed);
    const versusWon = versus.filter(r => r.won).length;
    return {
      player,
      game,
      window: w,
      // A removed player's darts count in the totals, the match not (docs/UI.md#wycofanie-gracza).
      played: rows.filter(r => !r.removed).length,
      versus: { played: versus.length, won: versusWon, winrate: versus.length ? Math.round((versusWon / versus.length) * 1000) / 10 : null },
      matches: rows.length,
      totals: Stats.totals(rows),
      previous: before.length < MIN_PREVIOUS ? null : { matches: before.length, totals: Stats.totals(before) },
      bests: !rec ? [] : variants.sort().map(v => {
        const best = this.db.records(v, rec.better, 1, playerId)[0];
        return { label: this.variantLabel(game, v), value: rec.format(best.value) };
      }),
    };
  }

  /**
   * The lobby's records (D6): the best result of every minigame variant played, in the order of the game groups and
   * by label within a game, with the options of the record's match so the lobby can set the same game up again.
   */
  lobbyRecords(): LobbyRecord[] {
    const played = this.db.sql.prepare('SELECT DISTINCT game, variant FROM matches WHERE variant IS NOT NULL').all() as { game: GameId; variant: string }[];
    const order = GAME_GROUPS.flatMap(g => g.ids);
    return order.flatMap(game => {
      const g = GAMES[game];
      const rec = g.record;
      if (!rec) return [];
      return played.filter(p => p.game === game).flatMap(({ variant }) => {
        const best = this.db.records(variant, rec.better, 1)[0];
        if (!best) return [];
        return [{ game, key: variant, label: this.variantLabel(game, variant), value: rec.format(best.value), who: best.who, at: best.at,
          options: g.normalizeOptions(JSON.parse(best.options)), players: best.players }];
      }).sort((a, b) => a.label.localeCompare(b.label));
    });
  }

  /** Top 10 of every record variant played so far. */
  records(game: GameId): RecordTable[] {
    if (game === 'x01') return this.x01Records();
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

  /**
   * Office records of X01, all time, players only (guests leave no visits): Highest visit, Highest checkout (finished legs)
   * and Best leg per start score. Same conventions as `Db.records`: one row per player and match, best first, earlier first on a tie.
   */
  private x01Records(): RecordTable[] {
    type Row = { value: number; at: number; who: string; start: number };
    const visits = (select: string, extra: string) => this.db.sql.prepare(`
      SELECT ${select} AS value, m.ended_at AS at, p.name AS who
      FROM visits v JOIN legs l ON l.id = v.leg_id JOIN matches m ON m.id = l.match_id JOIN players p ON p.id = v.player_id
      WHERE m.game = 'x01' ${extra} GROUP BY m.id, v.player_id`).all() as unknown as Row[];
    const top = (list: Row[], dir: 1 | -1) =>
      list.filter(r => r.value > 0).sort((a, b) => (a.value - b.value) * dir || a.at - b.at).slice(0, 10).map(r => ({ value: String(r.value), who: r.who, at: r.at }));
    // A leg's darts are its winner's visits in it; the best leg of each match and player counts.
    const legs = this.db.sql.prepare(`
      SELECT MIN(t.darts) AS value, m.ended_at AS at, p.name AS who, json_extract(m.options, '$.startScore') AS start
      FROM (SELECT v.leg_id, v.player_id, SUM(v.darts_count) AS darts FROM visits v GROUP BY v.leg_id, v.player_id HAVING MAX(v.checkout) = 1) t
      JOIN legs l ON l.id = t.leg_id AND l.winner_position IS NOT NULL JOIN matches m ON m.id = l.match_id JOIN players p ON p.id = t.player_id
      WHERE m.game = 'x01' GROUP BY m.id, t.player_id`).all() as unknown as Row[];
    const starts = [...new Set(legs.map(r => r.start))].sort((a, b) => a - b);
    return [
      { key: 'visit', label: 'Highest visit', rows: top(visits('MAX(v.scored)', ''), -1) },
      { key: 'checkout', label: 'Highest checkout', rows: top(visits('MAX(v.score_before)', 'AND v.checkout = 1 AND l.winner_position IS NOT NULL'), -1) },
      ...starts.map(st => ({
        key: `leg:${st}`,
        label: `Best leg · ${st}`,
        rows: top(legs.filter(r => r.start === st), 1).map(r => ({ ...r, value: `${r.value} darts` })),
      })),
    ].filter(t => t.rows.length > 0);
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
    const from = this.now() - 30 * DAY, before = from - 30 * DAY;
    // X01 visits in [lo, hi): their Average, and the legs behind it to tell whether the period is worth showing.
    const inPeriod = (select: string) => `(SELECT ${select} FROM visits v JOIN legs l ON l.id = v.leg_id JOIN matches m ON m.id = l.match_id
          WHERE v.player_id = p.id AND v.at >= ? AND v.at < ? AND m.game = 'x01')`;
    const avgIn = inPeriod('SUM(v.scored) * 3.0 / NULLIF(SUM(v.darts_count), 0)');
    const legsIn = inPeriod('COUNT(DISTINCT v.leg_id)');
    const round = (a: number | null) => (a === null ? null : Math.round(a * 100) / 100);
    return (this.db.sql.prepare(`
      SELECT p.id, p.name, ${avgIn} AS avg, ${avgIn} AS avgPrev, ${legsIn} AS legsPrev,
        (SELECT COUNT(*) FROM match_players mp JOIN matches m ON m.id = mp.match_id
          WHERE mp.player_id = p.id AND mp.removed = 0 AND m.ended_at >= ?) AS matches,
        (SELECT MAX(m.ended_at) FROM match_players mp JOIN matches m ON m.id = mp.match_id WHERE mp.player_id = p.id) AS lastPlayed
      FROM players p WHERE p.archived = 0 ORDER BY p.name_key`).all(from, Number.MAX_SAFE_INTEGER, before, from, before, from, from) as unknown as (PlayerListItem & { legsPrev: number })[])
      .map(({ legsPrev, ...p }) => ({ ...p, avg: round(p.avg), avgPrev: legsPrev < MIN_PREVIOUS ? null : round(p.avgPrev) }));
  }
}
