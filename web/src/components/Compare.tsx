import type { CSSProperties } from 'react';
import type { GameId } from '../../../games/index.ts';
import type { X01Stats } from '../../../games/x01/stats.ts';
import { plural } from '../../../games/turns.ts';
import type { GameStatsResponse } from '../../../server/protocol.ts';
import { BAND_BETTER, METRICS, X01_BANDS, X01_METRICS, fmtPct, sharedBestLeg, visitShare } from '../stats.ts';

/** Fixed player colours by place in the match or comparison (docs/UI.md, Podsumowanie meczu): the --p1…--p4 tokens. */
export const playerColor = (i: number) => `var(--p${(i % 4) + 1})`;

const pct = (a: number | undefined, b: number | undefined) => (b ? `${Math.round(((a ?? 0) / b) * 1000) / 10}%` : '–');

/** The game's own numbers, from the totals the module keeps per match. */
export function gameStats(game: GameId, t: Record<string, number>): [string, string, string?][] {
  switch (game) {
    case 'atc':
    case 'fullboard': return [['Hit rate', pct(t.hits, t.darts), `${t.hits ?? 0} / ${t.darts ?? 0} darts`], ['Darts', String(t.darts ?? 0)]];
    case 'gotcha': return [['Gotchas', String(t.gotchas ?? 0), 'rivals sent back to 0']];
    case 'knockout': return [['Average visit', t.visits ? (t.points / t.visits).toFixed(1) : '–', plural(t.visits ?? 0, 'visit')]];
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
    case 'hare': return [['Hits', String(t.hits ?? 0)], ['Darts', String(t.darts ?? 0)], ['Hit rate', pct(t.hits, t.darts), `${t.hits ?? 0} / ${t.darts ?? 0} darts`]];
    case 'catch40': return [
      ['Points', String(t.points ?? 0)],
      ['Checkout %', pct(t.checkouts, t.attempts), `${t.checkouts ?? 0} / ${t.attempts ?? 0}`],
      ['Darts per checkout', t.checkouts ? (t.checkoutDarts / t.checkouts).toFixed(1) : '–'],
    ];
    case 'bobs27': return [['Score', String(t.score ?? 0)], ['Double hit rate', pct(t.hits, t.darts), `${t.hits ?? 0} / ${t.darts ?? 0} darts`]];
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

const metricRow = (xs: X01Stats[], key: keyof typeof X01_METRICS): Row => {
  const m = X01_METRICS[key];
  const nums = xs.map(m.value);
  return { label: m.label, values: nums.map(m.fmt), nums, better: m.better };
};

const COMMON = ['avg', 'first9', 'checkoutPct', 'bustRate', 'highestVisit', 'highestCheckout'] as const;
const dartsRow = (xs: X01Stats[]): Row => ({ label: 'Darts', values: xs.map(x => String(x.darts)) });

/** One match (podsumowanie): the bands are counts and Best leg has no start score, a match has one. */
export const x01Rows = (xs: X01Stats[]): Row[] => [
  ...COMMON.map(k => metricRow(xs, k)),
  metricRow(xs, 'bestLeg'),
  ...X01_BANDS.map(({ label, key }) => ({ label, values: xs.map(x => String(x[key])), nums: xs.map(x => x[key]), better: BAND_BETTER })),
  dartsRow(xs),
];

/**
 * Compare: frequencies, not counts, and Best leg at the start score both played most. `between` goes before Darts
 * (the profile's Winrate), which stays at the bottom with Distance walked.
 */
export function x01CompareRows(xs: X01Stats[], between: Row[] = []): Row[] {
  const shared = sharedBestLeg(xs);
  const bestNums = shared?.best ?? xs.map(() => null);
  return [
    ...COMMON.map(k => metricRow(xs, k)),
    { label: shared ? `${X01_METRICS.bestLeg.label} · ${shared.startScore}` : X01_METRICS.bestLeg.label, values: bestNums.map(X01_METRICS.bestLeg.fmt), nums: bestNums, better: X01_METRICS.bestLeg.better },
    ...X01_BANDS.map(({ label, key }) => {
      const nums = xs.map(x => visitShare(x[key], x));
      return { label: `${label} (% of visits)`, values: nums.map(fmtPct), nums, better: BAND_BETTER };
    }),
    ...between,
    dartsRow(xs),
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
export function gameCompareRows(game: GameId, gs: Pick<GameStatsResponse, 'totals' | 'matches' | 'played' | 'versus'>[]): Row[] {
  const metrics = (METRICS[game] ?? []).map(m => {
    const nums = gs.map(g => m.value(g.totals, g.matches));
    return { label: m.perMatch ? `${m.label} / match` : m.label, values: nums.map(m.fmt), nums, better: m.better };
  });
  const winrate = gs.map(g => g.versus.winrate);
  return [
    ...metrics,
    { label: 'Played', values: gs.map(g => String(g.played)) },
    // Winrate only when somebody has versus matches; a game with solo matches only has none.
    ...(gs.some(g => g.versus.played > 0) ? [{ label: 'Winrate', values: winrate.map(fmtPct), nums: winrate, better: 'higher' as const }] : []),
  ];
}

export const fmtDistance = (metres: number) => (metres >= 1000 ? `${(metres / 1000).toFixed(2)} km` : `${Math.round(metres)} m`);

/** The best value's players; those in `skip` (removed from the match) have no place. */
function bestOf(r: Row, skip: boolean[] = []): Set<number> {
  if (!r.better || !r.nums) return new Set();
  const ok = r.nums.filter((n, i): n is number => n !== null && !skip[i]);
  if (ok.length < 2 || ok.every(n => n === ok[0])) return new Set();
  const best = r.better === 'higher' ? Math.max(...ok) : Math.min(...ok);
  return new Set(r.nums.flatMap((n, i) => (n === best && !skip[i] ? [i] : [])));
}

/**
 * How full a value's bar is: its share of all players' values, like Autodarts; for 'lower' rows the share of 1/value.
 * No bar when there is nothing to compare with: fewer than two values.
 */
export function fill(r: Row, i: number): number | null {
  const v = r.nums?.[i];
  if (!r.better || v == null) return null;
  if (r.nums!.filter(n => n !== null).length < 2) return null;
  const score = (n: number) => (r.better === 'lower' ? (n > 0 ? 1 / n : 0) : n);
  const sum = r.nums!.reduce<number>((t, n) => t + (n === null ? 0 : score(n)), 0);
  return sum > 0 ? score(v) / sum : 0;
}

/**
 * Players side by side like Autodarts: per row the label in the middle, values on the sides with the best one
 * in a pill of its player's colour, and bars under them. Two players mirror around the middle; more get a column each.
 * `hideNames` when the screen names the players already (Compare's pickers).
 */
export function CompareTable({ names, rows, left = [], hideNames = false }: { names: string[]; rows: Row[]; left?: boolean[]; hideNames?: boolean }) {
  const two = names.length === 2;
  const value = (r: Row, best: Set<number>, i: number) => (
    <span className={`cmp-val ${best.has(i) ? 'best' : ''}`} style={best.has(i) ? { background: playerColor(i) } : undefined}>{r.values[i]}</span>
  );
  const bar = (r: Row, i: number) => {
    const f = fill(r, i);
    return <div className="cmp-track">{f !== null && <i style={{ width: `${f * 100}%`, background: left[i] ? 'var(--off)' : playerColor(i) }} />}</div>;
  };
  return (
    <div className={`cmp ${two ? 'two' : ''}`} style={{ '--n': names.length } as CSSProperties}>
      {!hideNames && <div className="cmp-names">{names.map((n, i) => left[i]
        ? <span key={i} className="left">{n}<small>Left</small></span>
        : <span key={i} style={{ color: playerColor(i) }}>{n}</span>)}</div>}
      {rows.map(r => {
        const best = bestOf(r, left);
        // One player has nothing to measure against: no bars at all.
        const bars = !!r.better && !!r.nums && names.length > 1;
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
