import type { GameId } from '../../../games/index.ts';
import type { X01Stats } from '../../../games/x01/stats.ts';
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
    case 'cricket': return [['MPR', t.darts ? ((t.marks / t.darts) * 3).toFixed(2) : '–', 'marks per round'], ['Darts', String(t.darts ?? 0)]];
    case '121': return [['Attempts won', pct(t.checkouts, t.attempts), `${t.checkouts ?? 0} / ${t.attempts ?? 0}`]];
    case 'killer': return [['Lives taken', String(t.taken ?? 0)]];
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

const X01_ROWS: [string, (x: X01Stats) => number | null, (x: X01Stats) => string, 'higher' | 'lower' | undefined][] = [
  ['Average', x => x.avg, x => fmtAvg(x.avg), 'higher'],
  ['First 9', x => x.first9, x => fmtAvg(x.first9), 'higher'],
  ['Until 170', x => x.until170, x => fmtAvg(x.until170), 'higher'],
  ['Checkout %', x => x.checkoutPct, x => (x.checkoutPct === null ? '–' : `${x.checkoutPct}%`), 'higher'],
  ['Highest checkout', x => x.highestCheckout, x => fmtNum(x.highestCheckout), 'higher'],
  ['Best leg', x => x.bestLeg, x => fmtNum(x.bestLeg), 'lower'],
  ['60+', x => x.c60, x => String(x.c60), 'higher'],
  ['80+', x => x.c80, x => String(x.c80), 'higher'],
  ['100+', x => x.c100, x => String(x.c100), 'higher'],
  ['Darts', () => null, x => String(x.darts), undefined],
];

export const x01Rows = (xs: X01Stats[]): Row[] =>
  X01_ROWS.map(([label, num, fmt, better]) => ({ label, values: xs.map(fmt), nums: xs.map(num), better }));

/** Minigame rows: every value counts as better when higher, except plain dart counts. */
export function gameRows(game: GameId, totals: Record<string, number>[]): Row[] {
  const per = totals.map(t => gameStats(game, t));
  return (per[0] ?? []).map(([label], i) => ({
    label,
    values: per.map(p => p[i][1]),
    nums: per.map(p => (Number.isFinite(parseFloat(p[i][1])) ? parseFloat(p[i][1]) : null)),
    better: label === 'Darts' ? undefined : 'higher',
  }));
}

export const fmtDistance = (metres: number) => (metres >= 1000 ? `${(metres / 1000).toFixed(2)} km` : `${Math.round(metres)} m`);
export const fmtKm = (metres: number) => `${(metres / 1000).toFixed(2)} km`;

function bestOf(r: Row): Set<number> {
  if (!r.better || !r.nums) return new Set();
  const ok = r.nums.filter((n): n is number => n !== null);
  if (ok.length < 2 || ok.every(n => n === ok[0])) return new Set();
  const best = r.better === 'higher' ? Math.max(...ok) : Math.min(...ok);
  return new Set(r.nums.flatMap((n, i) => (n === best ? [i] : [])));
}

/** Players side by side: a column per player in their colour, the best value of each row lit. */
export function CompareTable({ names, rows }: { names: string[]; rows: Row[] }) {
  return (
    <div className="compare-scroll">
      <table className="compare">
        <thead>
          <tr>
            <th />
            {names.map((n, i) => <th key={i} style={{ color: playerColor(i), borderColor: playerColor(i) }}>{n}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const best = bestOf(r);
            return (
              <tr key={r.label}>
                <th>{r.label}</th>
                {r.values.map((v, i) => <td key={i} className={best.has(i) ? 'best' : ''}>{v}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
