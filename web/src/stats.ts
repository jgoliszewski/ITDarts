// What /stats shows and how: the figures of each game, which direction is better, and the change against the previous Okno. Pure.
import type { GameId } from '../../games/index.ts';
import type { BestLegAt, X01Stats } from '../../games/x01/stats.ts';
import type { GameStatsResponse, PlayerStatsResponse, StatsWindow } from '../../server/protocol.ts';

export type Better = 'higher' | 'lower';

/** `part` as a percentage of `whole`, one decimal; null without a whole. */
export const percent = (part: number | undefined, whole: number | undefined): number | null =>
  whole ? Math.round(((part ?? 0) / whole) * 1000) / 10 : null;

/** The average of a total over matches, one decimal; null without matches. */
export const perMatch = (total: number | undefined, matches: number): number | null =>
  matches > 0 ? Math.round(((total ?? 0) / matches) * 10) / 10 : null;

export const fmtPct = (n: number | null) => (n === null ? '–' : `${n}%`);
export const fmtFixed = (digits: number) => (n: number | null) => (n === null ? '–' : n.toFixed(digits));

export interface Delta {
  /** “▲ 2.4”, “▼ 1.3”, “= 0.0”; a percentage moves in points: “▲ 2.4 pp”. */
  text: string;
  tone: 'good' | 'bad' | 'flat';
}

/** The change from `prev` to `cur`; green when it moved the better way. Null when either side is missing. */
export function delta(cur: number | null | undefined, prev: number | null | undefined, better: Better, digits = 1, unit = ''): Delta | null {
  if (cur == null || prev == null) return null;
  const scale = 10 ** digits;
  const d = Math.round((cur - prev) * scale) / scale;
  const u = unit ? ` ${unit}` : '';
  if (d === 0) return { text: `= ${(0).toFixed(digits)}${u}`, tone: 'flat' };
  const good = better === 'higher' ? d > 0 : d < 0;
  return { text: `${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(digits)}${u}`, tone: good ? 'good' : 'bad' };
}

// ---------- Okna ----------

/** Why a headline has no change: All time has nothing before it; otherwise the previous Okno was too thin (docs/STATYSTYKI.md, Progres). */
export const noTrendNote = (w: StatsWindow, unit: 'legs' | 'matches' = 'legs'): string =>
  w === 'all' ? 'No trend for All time' : `No trend · fewer than 3 ${unit} before`;

/** “the last 30 days”: the Okno in a sentence; leg Okna and All time have no end before which nothing was played. */
export const windowPhrase = (w: StatsWindow): string | null =>
  ({ '7d': 'the last 7 days', '30d': 'the last 30 days', '90d': 'the last 3 months', '365d': 'the last year' } as Partial<Record<StatsWindow, string>>)[w] ?? null;

/** The Okna in picker order; `SHOWN` always, the rest under More (docs/STATYSTYKI.md, Okna). */
export const WINDOWS: StatsWindow[] = ['7d', '30d', '90d', '365d', 'all', 'l10', 'l100'];
const SHOWN: StatsWindow[] = ['30d', '90d', 'all', 'l10'];

/** The Okna the picker shows: the four everyday ones, all of them once More is open or the current one is hidden. */
export const windowsShown = (more: boolean, current: StatsWindow): StatsWindow[] =>
  more || !SHOWN.includes(current) ? WINDOWS : SHOWN;

/** “30D”, “All”, “Last 10 legs”; minigames count matches where X01 counts legs. */
export function windowLabel(w: StatsWindow, unit: 'legs' | 'matches' = 'legs'): string {
  return { '7d': '7D', '30d': '30D', '90d': '3M', '365d': '1Y', all: 'All', l10: `Last 10 ${unit}`, l100: `Last 100 ${unit}` }[w];
}

/** “vs previous 30 days”; minigames count matches where X01 counts legs. */
export function previousLabel(w: StatsWindow, unit: 'legs' | 'matches' = 'legs'): string {
  const n = { '7d': '7 days', '30d': '30 days', '90d': '90 days', '365d': '365 days', l10: `10 ${unit}`, l100: `100 ${unit}` }[w as '7d'];
  return n ? `vs previous ${n}` : '';
}

// ---------- X01 ----------

/** Share of visits in a band (60+, 80+ or 100+), as a percentage. */
export const visitShare = (count: number, x: Pick<X01Stats, 'visits'>) => percent(count, x.visits);

/**
 * Best leg of the start score the two players played most between them (a tie: the higher one), and each player's row there.
 * Null when nobody has played a leg.
 */
export function sharedBestLeg(xs: Pick<X01Stats, 'bestLegs'>[]): { startScore: number; best: (number | null)[] } | null {
  const legs = new Map<number, number>();
  for (const x of xs) for (const b of x.bestLegs) legs.set(b.startScore, (legs.get(b.startScore) ?? 0) + b.legs);
  const top = [...legs].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
  if (!top) return null;
  const at = (x: { bestLegs: BestLegAt[] }) => x.bestLegs.find(b => b.startScore === top[0])?.best ?? null;
  return { startScore: top[0], best: xs.map(at) };
}

/** One X01 figure: its label, value, format and which way is better. Arrows and Compare both read this. */
export interface X01Metric {
  label: string;
  better: Better;
  value: (x: X01Stats) => number | null;
  fmt: (n: number | null) => string;
  /** The number without its unit, for a tile that prints the unit elsewhere (the profile's Checkout %). */
  plain?: (n: number | null) => string;
}

const fmtInt = (n: number | null) => (n === null ? '–' : String(n));

export const X01_METRICS = {
  avg: { label: 'Average', better: 'higher', value: x => x.avg, fmt: fmtFixed(1) },
  first9: { label: 'First 9', better: 'higher', value: x => x.first9, fmt: fmtFixed(1) },
  // Always one decimal (8.0, not 8): `fmt` for Compare and the summary, `plain` (no %) for the profile tile.
  checkoutPct: { label: 'Checkout %', better: 'higher', value: x => x.checkoutPct, fmt: n => (n === null ? '–' : `${n.toFixed(1)}%`), plain: fmtFixed(1) },
  bustRate: { label: 'Bust rate', better: 'lower', value: x => x.bustRate, fmt: fmtPct },
  highestVisit: { label: 'Highest visit', better: 'higher', value: x => x.highestVisit, fmt: fmtInt },
  highestCheckout: { label: 'Highest checkout', better: 'higher', value: x => x.highestCheckout, fmt: fmtInt },
  bestLeg: { label: 'Best leg', better: 'lower', value: x => x.bestLeg, fmt: fmtInt },
} satisfies Record<string, X01Metric>;

/** 60+, 80+ and 100+: more is better, whether shown as counts (one match) or as a share of visits. */
export const X01_BANDS: { label: string; key: 'c60' | 'c80' | 'c100' }[] = [
  { label: '60+', key: 'c60' }, { label: '80+', key: 'c80' }, { label: '100+', key: 'c100' },
];
export const BAND_BETTER: Better = 'higher';

/** The arrow of an X01 figure against the previous Okno; its colour follows the figure's direction. */
export function x01Delta(key: 'avg' | 'first9' | 'checkoutPct', x: X01Stats, prev: PlayerStatsResponse['previous']): Delta | null {
  return delta(X01_METRICS[key].value(x), prev?.[key], X01_METRICS[key].better, 1, key === 'checkoutPct' ? 'pp' : '');
}

export const doubleName = (double: number) => (double === 25 ? 'Bull' : `D${double}`);

// ---------- minigames ----------

/** One figure of a minigame, from the totals of its matches and the number of those matches. */
export interface Metric {
  label: string;
  /** Which way is better; none for plain counts (Darts). */
  better?: Better;
  value: (t: Record<string, number>, matches: number) => number | null;
  fmt: (n: number | null) => string;
  /** Small print under the value. */
  sub?: (t: Record<string, number>, matches: number) => string | undefined;
  /** The game's headline: the big tile with the arrow. */
  main?: boolean;
  /** Decimals of the arrow's difference. */
  digits?: number;
  /** Average over matches: Compare says “/ match”. */
  perMatch?: boolean;
}

const f1 = fmtFixed(1);

/** A counter shown as its average per match, the total in small print. */
const counter = (label: string, key: string, main = false): Metric => ({
  label, better: 'higher', main, perMatch: true, fmt: f1,
  value: (t, m) => perMatch(t[key], m),
  sub: t => `${t[key] ?? 0} in total`,
});

const hitRate = (): Metric => ({
  label: 'Hit rate', better: 'higher', main: true, fmt: fmtPct,
  value: t => percent(t.hits, t.darts),
  sub: t => `${t.hits ?? 0} / ${t.darts ?? 0} darts`,
});

const darts = (): Metric => ({ label: 'Darts', fmt: n => (n === null ? '–' : String(n)), value: t => t.darts ?? 0 });

/** Free throw's 60+, 80+ and 100+ as the share of visits. */
const band = (label: string, key: string): Metric => ({
  label, better: 'higher', fmt: fmtPct, value: t => percent(t[key], t.visits), sub: t => `${t[key] ?? 0} of ${t.visits ?? 0} visits`,
});

export const METRICS: Partial<Record<GameId, Metric[]>> = {
  atc: [hitRate(), darts()],
  fullboard: [hitRate(), darts()],
  shanghai: [hitRate(), counter('Shanghais', 'shanghais')],
  cricket: [
    { label: 'MPR', better: 'higher', main: true, digits: 2, fmt: fmtFixed(2), value: t => (t.darts ? Math.round((t.marks / t.darts) * 300) / 100 : null), sub: () => 'marks per round' },
    darts(),
  ],
  '121': [{ label: 'Attempts won', better: 'higher', main: true, fmt: fmtPct, value: t => percent(t.checkouts, t.attempts), sub: t => `${t.checkouts ?? 0} / ${t.attempts ?? 0}` }],
  randomco: [
    { label: 'Darts per checkout', better: 'lower', main: true, fmt: f1, value: t => (t.checkouts ? Math.round((t.checkoutDarts / t.checkouts) * 10) / 10 : null) },
    counter('Checkouts', 'checkouts'),
    { label: 'First visit', better: 'higher', fmt: fmtPct, value: t => percent(t.firstVisit, t.checkouts), sub: () => 'checkouts in the first visit' },
  ],
  knockout: [{ label: 'Average visit', better: 'higher', main: true, fmt: f1, value: t => (t.visits ? Math.round((t.points / t.visits) * 10) / 10 : null), sub: t => `${t.visits ?? 0} visits` }],
  killer: [counter('Lives taken', 'taken', true)],
  football: [counter('Goals', 'goals', true)],
  gotcha: [counter('Gotchas', 'gotchas', true)],
  bullseye: [counter('Points', 'points', true)],
  hol: [{
    label: 'Visits survived', better: 'higher', main: true, fmt: fmtPct,
    // Matches saved before the figure existed have no visits: no data, not zero.
    value: t => (t.visits ? percent(t.survived, t.visits) : null),
    sub: t => (t.visits ? `${t.survived ?? 0} / ${t.visits} visits` : 'no data yet'),
  }],
  freethrow: [
    { label: 'Average', better: 'higher', main: true, fmt: f1, value: t => (t.darts ? Math.round((t.points / t.darts) * 30) / 10 : null), sub: () => 'per 3 darts' },
    darts(),
    { label: 'Highest visit', better: 'higher', fmt: n => (n === null ? '–' : String(n)), value: t => t.best ?? 0 },
    band('60+', 'v60'),
    band('80+', 'v80'),
    band('100+', 'v100'),
  ],
};

export interface Shown {
  label: string;
  value: string;
  sub?: string;
  delta: Delta | null;
  main: boolean;
}

/** The figures of a game for the profile; the headline carries the change against the previous Okno. */
export function profileMetrics(game: GameId, g: Pick<GameStatsResponse, 'totals' | 'matches' | 'previous'>): Shown[] {
  return (METRICS[game] ?? []).map(m => {
    const cur = m.value(g.totals, g.matches);
    const prev = g.previous ? m.value(g.previous.totals, g.previous.matches) : null;
    return {
      label: m.label,
      value: m.fmt(cur),
      sub: m.sub?.(g.totals, g.matches),
      delta: m.main && m.better ? delta(cur, prev, m.better, m.digits, m.fmt === fmtPct ? 'pp' : '') : null,
      main: !!m.main,
    };
  });
}

/**
 * The solo summary's line: the game's headline figure of this match against the player's average over the Okno
 * (X01: the Average). The match is saved before the summary shows, so it is taken out of the Okno first: the
 * average is the player's other matches. Null without a headline, without the match figure or with no other match.
 */
export function versusAverage(game: GameId, match: { x01?: X01Stats; totals?: Record<string, number> }, avg: PlayerStatsResponse | GameStatsResponse): Delta | null {
  if (game === 'x01') {
    if (!match.x01 || !('x01' in avg)) return null;
    const m = match.x01, w = avg.x01;
    // Average is points per 3 darts, so the points come back as avg × darts / 3.
    const darts = w.darts - m.darts;
    if (m.avg === null || w.avg === null || darts <= 0) return null;
    return delta(m.avg, Math.round(((w.avg * w.darts - m.avg * m.darts) / darts) * 100) / 100, 'higher');
  }
  const m = METRICS[game]?.find(x => x.main && x.better);
  if (!m || !match.totals || !('totals' in avg) || avg.matches <= 1) return null;
  const others = Object.fromEntries(Object.entries(avg.totals).map(([k, v]) => [k, v - (match.totals![k] ?? 0)]));
  return delta(m.value(match.totals, 1), m.value(others, avg.matches - 1), m.better!, m.digits, m.fmt === fmtPct ? 'pp' : '');
}

/** The winrate tile: wins over versus matches; a game with only solo matches shows just how many were played. */
export function winTile(g: Pick<GameStatsResponse, 'played' | 'versus'>): { label: string; value: string; sub?: string } {
  const { versus } = g;
  if (versus.played === 0) return { label: 'Played', value: String(g.played) };
  return {
    label: 'Winrate',
    value: fmtPct(versus.winrate),
    sub: `${versus.won} of ${versus.played} matches${g.played > versus.played ? ` · ${g.played} played` : ''}`,
  };
}

// ---------- Average chart ----------

/** The chart shows from this many matches; fewer make a line that says nothing. */
export const MIN_TREND = 3;

/** Axis of the Average chart: whole steps around the data, never flat. */
export function chartScale(points: number[]): { lo: number; hi: number; step: number } {
  const min = Math.min(...points), max = Math.max(...points);
  const step = max - min > 40 ? 10 : 5;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  return { lo, hi: hi === lo ? hi + step : hi, step };
}
