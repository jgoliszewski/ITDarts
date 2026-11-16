import type { CSSProperties } from 'react';
import type { GameId } from '../../../games/index.ts';
import type { X01Stats } from '../../../games/x01/stats.ts';
import type { GameStatsResponse } from '../../../server/protocol.ts';
import { METRICS, sharedBestLeg, visitShare } from '../stats.ts';
import { fmtAvg, fmtNum } from '../util.ts';

/** Fixed player colours by place in the match or comparison (docs/UI.md, Podsumowanie meczu). */
export const PLAYER_COLORS = ['#e0325f', '#16b2c9', '#f0a020', '#3ccb7f'];
export const playerColor = (i: number) => PLAYER_COLORS[i % PLAYER_COLORS.length];

const pct = (a: number | undefined, b: number | undefined) => (b ? `${Math.round(((a ?? 0) / b) * 1000) / 10}%` : '–');

/** The game's own numbers, from the totals the module keeps per match. */
export function gameStats(game: GameId, t: Record<string, number>): [string, string, string?][] {
  switch (game) {
    case 'atc':
    case 'fullboard': return [['Hit rate', pct(t.hits, t.darts), `${t.hits ?? 0} / ${t.darts ?? 0} darts`], ['Darts', String(t.darts ?? 0)]];
    case 'gotcha': return [['Gotchas', String(t.gotchas ?? 0), 'rivals sent back to 0']];
    case 'knockout': return [['Average visit', t.visits ? (t.points / t.visits).toFixed(1) : '–', `${t.visits ?? 0} visits`]];
    case 'football': return [['Goals', String(t.goals ?? 0)]];
    case 'freethrow': return [
      ['Average', t.darts ? ((t.points / t.darts) * 3).toFixed(1) : '–', 'per 3 darts'],
      ['Darts', String(t.darts ?? 0)],
      ['Highest visit', String(t.best ?? 0)],
      ['60+', String(t.v60 ?? 0)],
      ['80+', String(t.v80 ?? 0)],
      ['100+', String(t.v100 ?? 0)],
    ];
    case 'bullseye': return [['Points', String(t.points ?? 0)]];
    case 'shanghai': return [['Hit rate', pct(t.hits, t.darts), `${t.hits ?? 0} / ${t.darts ?? 0} darts`], ['Shanghais', String(t.shanghais ?? 0)]];
    case 'cricket': return [['MPR', t.darts ? ((t.marks / t.darts) * 3).toFixed(2) : '–', 'marks per round'], ['Darts', String(t.darts ?? 0)]];
    case '121': return [['Attempts won', pct(t.checkouts, t.attempts), `${t.checkouts ?? 0} / ${t.attempts ?? 0}`]];
    case 'killer': return [['Lives taken', String(t.taken ?? 0)]];
    case 'randomco': return [
      ['Checkouts', String(t.checkouts ?? 0)],
      ['Darts per checkout', t.checkouts ? (t.checkoutDarts / t.checkouts).toFixed(1) : '–'],
      ['First visit', pct(t.firstVisit, t.checkouts), 'checkouts in the first visit'],
    ];
    default: return [];
  }
}

/** One line of the comparison: a value per player, and which of them is best ('higher', 'lower' or not compared). */
export interface Row {
  label: string;
  values: string[];
  nums?: (number | null)[];
  better?: 'higher' | 'lower';
}

type X01Row = [string, (x: X01Stats) => number | null, (x: X01Stats) => string, 'higher' | 'lower' | undefined];

const pctText = (n: number | null) => (n === null ? '–' : `${n}%`);

const X01_COMMON: X01Row[] = [
  ['Average', x => x.avg, x => fmtAvg(x.avg), 'higher'],
  ['First 9', x => x.first9, x => fmtAvg(x.first9), 'higher'],
  ['Checkout %', x => x.checkoutPct, x => (x.checkoutPct === null ? '–' : `${x.checkoutPct}%`), 'higher'],
  ['Bust rate', x => x.bustRate, x => pctText(x.bustRate), 'lower'],
  ['Highest visit', x => x.highestVisit, x => fmtNum(x.highestVisit), 'higher'],
  ['Highest checkout', x => x.highestCheckout, x => fmtNum(x.highestCheckout), 'higher'],
];

const toRows = (xs: X01Stats[], defs: X01Row[]): Row[] =>
  defs.map(([label, num, fmt, better]) => ({ label, values: xs.map(fmt), nums: xs.map(num), better }));

/** One match (podsumowanie): the bands are counts and Best leg has no start score, a match has one. */
export const x01Rows = (xs: X01Stats[]): Row[] => toRows(xs, [
  ...X01_COMMON,
  ['Best leg', x => x.bestLeg, x => fmtNum(x.bestLeg), 'lower'],
  ['60+', x => x.c60, x => String(x.c60), 'higher'],
  ['80+', x => x.c80, x => String(x.c80), 'higher'],
  ['100+', x => x.c100, x => String(x.c100), 'higher'],
  ['Darts', () => null, x => String(x.darts), undefined],
]);

/** Compare: frequencies, not counts, and Best leg at the start score both played most. */
export function x01CompareRows(xs: X01Stats[]): Row[] {
  const shared = sharedBestLeg(xs);
  const band = (label: string, key: 'c60' | 'c80' | 'c100'): X01Row => [label, x => visitShare(x[key], x), x => pctText(visitShare(x[key], x)), 'higher'];
  return [
    ...toRows(xs, X01_COMMON),
    {
      label: shared ? `Best leg · ${shared.startScore}` : 'Best leg',
      values: (shared?.best ?? xs.map(() => null)).map(fmtNum),
      nums: shared?.best ?? xs.map(() => null),
      better: 'lower',
    },
    ...toRows(xs, [band('60+ (% of visits)', 'c60'), band('80+ (% of visits)', 'c80'), band('100+ (% of visits)', 'c100'), ['Darts', () => null, x => String(x.darts), undefined]]),
  ];
}

/** Minigame rows of one match: the counts as they are; the direction of each comes from the definition in stats.ts. */
export function gameRows(game: GameId, totals: Record<string, number>[]): Row[] {
  const per = totals.map(t => gameStats(game, t));
  return (per[0] ?? []).map(([label], i) => ({
    label,
    values: per.map(p => p[i][1]),
    nums: per.map(p => (Number.isFinite(parseFloat(p[i][1])) ? parseFloat(p[i][1]) : null)),
    better: METRICS[game]?.find(m => m.label === label)?.better,
  }));
}

/** Minigame rows for Compare: frequencies (per match, %), the direction of each from its definition. */
export function gameCompareRows(game: GameId, gs: Pick<GameStatsResponse, 'totals' | 'matches'>[]): Row[] {
  return (METRICS[game] ?? []).map(m => {
    const nums = gs.map(g => m.value(g.totals, g.matches));
    return { label: m.perMatch ? `${m.label} / match` : m.label, values: nums.map(m.fmt), nums, better: m.better };
  });
}

export const fmtDistance = (metres: number) => (metres >= 1000 ? `${(metres / 1000).toFixed(2)} km` : `${Math.round(metres)} m`);
export const fmtKm = (metres: number) => `${(metres / 1000).toFixed(2)} km`;

/** The best value's players; those in `skip` (removed from the match) have no place. */
function bestOf(r: Row, skip: boolean[] = []): Set<number> {
  if (!r.better || !r.nums) return new Set();
  const ok = r.nums.filter((n, i): n is number => n !== null && !skip[i]);
  if (ok.length < 2 || ok.every(n => n === ok[0])) return new Set();
  const best = r.better === 'higher' ? Math.max(...ok) : Math.min(...ok);
  return new Set(r.nums.flatMap((n, i) => (n === best && !skip[i] ? [i] : [])));
}

/** How full a value's bar is: its share of all players' values, like Autodarts; for 'lower' rows the share of 1/value. */
function fill(r: Row, i: number): number | null {
  const v = r.nums?.[i];
  if (!r.better || v == null) return null;
  const score = (n: number) => (r.better === 'lower' ? (n > 0 ? 1 / n : 0) : n);
  const sum = r.nums!.reduce<number>((t, n) => t + (n === null ? 0 : score(n)), 0);
  return sum > 0 ? score(v) / sum : 0;
}

/**
 * Players side by side like Autodarts: per row the label in the middle, values on the sides with the best one
 * in a pill of its player's colour, and bars under them. Two players mirror around the middle; more get a column each.
 */
export function CompareTable({ names, rows, left = [] }: { names: string[]; rows: Row[]; left?: boolean[] }) {
  const two = names.length === 2;
  const value = (r: Row, best: Set<number>, i: number) => (
    <span className={`cmp-val ${best.has(i) ? 'best' : ''}`} style={best.has(i) ? { background: playerColor(i) } : undefined}>{r.values[i]}</span>
  );
  const bar = (r: Row, i: number) => {
    const f = fill(r, i);
    return <div className="cmp-track">{f !== null && <i style={{ width: `${f * 100}%`, background: playerColor(i) }} />}</div>;
  };
  return (
    <div className={`cmp ${two ? 'two' : ''}`} style={{ '--n': names.length } as CSSProperties}>
      <div className="cmp-names">{names.map((n, i) => left[i]
        ? <span key={i} className="left">{n}<small>Left</small></span>
        : <span key={i} style={{ color: playerColor(i) }}>{n}</span>)}</div>
      {rows.map(r => {
        const best = bestOf(r, left);
        const bars = !!r.better && !!r.nums;
        return two ? (
          <div key={r.label} className="cmp-row">
            <div className="cmp-line">{value(r, best, 0)}<span className="cmp-label">{r.label}</span>{value(r, best, 1)}</div>
            {bars && <div className="cmp-bars">{bar(r, 0)}{bar(r, 1)}</div>}
          </div>
        ) : (
          <div key={r.label} className="cmp-row">
            <span className="cmp-label">{r.label}</span>
            <div className="cmp-cols">{names.map((_, i) => <div key={i} className={left[i] ? 'left' : ''}>{value(r, best, i)}{bars && bar(r, i)}</div>)}</div>
          </div>
        );
      })}
    </div>
  );
}
