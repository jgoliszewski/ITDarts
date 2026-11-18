import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { Delta } from '../stats.ts';
import { MIN_TREND, chartScale } from '../stats.ts';
import { shortDate } from '../util.ts';

/** The change against the previous Okno: green for better, red for worse. */
export function DeltaTag({ d }: { d: Delta | null }) {
  return d ? <span className={`delta ${d.tone}`}>{d.text}</span> : null;
}

export interface StatProps {
  l: string;
  v: string;
  s?: ReactNode;
  hl?: boolean;
  main?: boolean;
  delta?: Delta | null;
  /** Small print next to the change, e.g. “vs previous 30 days”. */
  vs?: string;
  /** A headline without a change says why, e.g. “No trend for All time”. */
  noTrend?: string;
}

export function Stat({ l, v, s, hl, main, delta, vs, noTrend }: StatProps) {
  return (
    <div className={`stat ${hl ? 'hl' : ''} ${main ? 'main' : ''}`}>
      <span className="l">{l}</span>
      <div className="vrow"><span className="num">{v}</span><DeltaTag d={delta ?? null} /></div>
      {delta && vs && <span className="vs-note">{vs}</span>}
      {!delta && noTrend && <span className="vs-note">{noTrend}</span>}
      {s && <span className="s">{s}</span>}
    </div>
  );
}

/** The width an element has on screen, so an SVG can draw its text at true pixel size. */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/**
 * Average match by match: a line with points, the Average of the whole Okno dashed (the figure above the chart,
 * weighted by darts), the last value labelled, dates of the first, middle and last match under the axis.
 * Nothing below 3 matches. Drawn at the box's own width, so ticks stay readable on a phone.
 */
export function TrendChart({ points, avg, dates }: { points: number[]; avg: number | null; dates?: number[] }) {
  const [ref, W] = useWidth(600);
  if (points.length < MIN_TREND) return null;
  const H = W < 500 ? 200 : 240, px = 40, py = 26, foot = dates ? 24 : 0;
  const { lo, hi, step } = chartScale(avg === null ? points : [...points, avg]);
  const x = (i: number) => px + (i * (W - px - 12)) / (points.length - 1);
  const y = (v: number) => H - py - ((v - lo) / (hi - lo)) * (H - 2 * py);
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  const last = points.length - 1;
  const marks = dates ? [...new Set([0, Math.floor(last / 2), last])] : [];
  // The label goes under the point when the line comes down to it, so it does not sit on the line.
  const below = points[last] < points[last - 1];
  const label = `Average match by match: ${points.map(p => p.toFixed(1)).join(', ')}`;
  return (
    <div ref={ref} className="chart-box">
      <svg className="chart" width={W} height={H + foot} viewBox={`0 0 ${W} ${H + foot}`} role="img" aria-label={label}>
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
        {marks.map(i => (
          <text key={i} x={x(i)} y={H + foot - 4} textAnchor={i === 0 ? 'start' : i === last ? 'end' : 'middle'} className="tick">{shortDate(dates![i])}</text>
        ))}
      </svg>
    </div>
  );
}
