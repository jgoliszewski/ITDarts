import type { Delta } from '../stats.ts';
import { MIN_TREND, chartScale } from '../stats.ts';

/** The change against the previous Okno: green for better, red for worse. */
export function DeltaTag({ d }: { d: Delta | null }) {
  return d ? <span className={`delta ${d.tone}`}>{d.text}</span> : null;
}

export interface StatProps {
  l: string;
  v: string;
  s?: string;
  hl?: boolean;
  main?: boolean;
  delta?: Delta | null;
  /** Small print next to the change, e.g. “vs previous 30 days”. */
  vs?: string;
}

export function Stat({ l, v, s, hl, main, delta, vs }: StatProps) {
  return (
    <div className={`stat ${hl ? 'hl' : ''} ${main ? 'main' : ''}`}>
      <span className="l">{l}</span>
      <div className="vrow"><span className="num">{v}</span><DeltaTag d={delta ?? null} />{delta && vs && <span className="vs-note">{vs}</span>}</div>
      {s && <span className="s">{s}</span>}
    </div>
  );
}

/**
 * Average match by match: a line with points, the Average of the whole Okno dashed (the figure above the chart,
 * weighted by darts), the last value labelled. Nothing below 3 matches.
 */
export function TrendChart({ points, avg }: { points: number[]; avg: number | null }) {
  if (points.length < MIN_TREND) return null;
  const W = 600, H = 240, px = 40, py = 26;
  const { lo, hi, step } = chartScale(avg === null ? points : [...points, avg]);
  const x = (i: number) => px + (i * (W - px - 12)) / (points.length - 1);
  const y = (v: number) => H - py - ((v - lo) / (hi - lo)) * (H - 2 * py);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const last = points.length - 1;
  // The label goes under the point when the line comes down to it, so it does not sit on the line.
  const below = points[last] < points[last - 1];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Average match by match">
      {ticks.map(v => (
        <g key={v}>
          <line x1={px} x2={W - 12} y1={y(v)} y2={y(v)} className="grid" />
          <text x={px - 8} y={y(v) + 5} textAnchor="end" className="tick">{v}</text>
        </g>
      ))}
      {avg !== null && <line x1={px} x2={W - 12} y1={y(avg)} y2={y(avg)} className="mean" />}
      <polyline className="line" points={points.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
      {points.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={5} className="dot" />)}
      <text x={x(last)} y={y(points[last]) + (below ? 26 : -12)} textAnchor="end" className="last">{points[last].toFixed(1)}</text>
    </svg>
  );
}
