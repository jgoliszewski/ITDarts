import type { Dart } from '../../../games/darts.ts';
import { BOARD_ORDER } from '../../../games/darts.ts';

// Rings drawn fatter than real ones so a finger can hit doubles and trebles (UI.md).
// bull, outer bull, treble in, treble out, double in, double out
const R = [20, 46, 168, 220, 290, 340];

const pt = (r: number, deg: number) => [r * Math.sin((deg * Math.PI) / 180), -r * Math.cos((deg * Math.PI) / 180)] as const;

function arc(r1: number, r2: number, a1: number, a2: number) {
  const [x1, y1] = pt(r2, a1), [x2, y2] = pt(r2, a2), [x3, y3] = pt(r1, a2), [x4, y4] = pt(r1, a1);
  const f = (n: number) => n.toFixed(2);
  return `M${f(x1)} ${f(y1)}A${r2} ${r2} 0 0 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${r1} ${r1} 0 0 0 ${f(x4)} ${f(y4)}Z`;
}

function where(d: Dart, i: number): readonly [number, number] {
  if (d.n === 0) return pt(368, 200 + i * 14);
  if (d.n === 25) return d.m === 2 ? [i * 8 - 8, 0] : pt((R[0] + R[1]) / 2, 90 + i * 40);
  const a = BOARD_ORDER.indexOf(d.n) * 18 + (i - 1) * 4;
  const r = d.m === 3 ? (R[2] + R[3]) / 2 : d.m === 2 ? (R[4] + R[5]) / 2 : (R[3] + R[4]) / 2;
  return pt(r, a);
}

export function Dartboard({ marks, selected, onPick, size = 760 }: { marks: Dart[]; selected: Dart | null; onPick: (d: Dart) => void; size?: number }) {
  const isSel = (n: number, m: number) => !!selected && selected.n === n && selected.m === m;
  return (
    <svg className="dartboard" width={size} height={size} viewBox="-380 -380 760 760" role="img" aria-label="Dartboard: tap where the dart landed">
      <circle className="hit" cx="0" cy="0" r="380" fill="#141416" onClick={() => onPick({ n: 0, m: 1 })} />
      {BOARD_ORDER.map((n, k) => {
        const [x, y] = pt(360, k * 18);
        return <text key={`t${n}`} x={x} y={y} fill="#A1A1A6" fontSize="24" fontWeight="700" fontFamily="Barlow Condensed, Inter, sans-serif" textAnchor="middle" dominantBaseline="central">{n}</text>;
      })}
      {BOARD_ORDER.map((n, k) => {
        const a1 = k * 18 - 9, a2 = k * 18 + 9, dark = k % 2 === 0;
        const single = dark ? '#232327' : '#4A4A50', ring = dark ? '#B8322F' : '#1F8A52';
        const parts: [number, number, 1 | 2 | 3, string][] = [[R[1], R[2], 1, single], [R[2], R[3], 3, ring], [R[3], R[4], 1, single], [R[4], R[5], 2, ring]];
        return parts.map(([r1, r2, m, fill], j) => (
          <path key={`${n}-${j}`} d={arc(r1, r2, a1, a2)} fill={isSel(n, m) ? '#F58224' : fill} stroke="#0A0A0B" strokeWidth="2" onClick={() => onPick({ n, m })}>
            <title>{`${m === 3 ? 'T' : m === 2 ? 'D' : 'S'}${n}`}</title>
          </path>
        ));
      })}
      <circle className="hit" cx="0" cy="0" r={R[1]} fill={isSel(25, 1) ? '#F58224' : '#1F8A52'} stroke="#0A0A0B" strokeWidth="2" onClick={() => onPick({ n: 25, m: 1 })} />
      <circle className="hit" cx="0" cy="0" r={R[0]} fill={isSel(25, 2) ? '#F58224' : '#B8322F'} stroke="#0A0A0B" strokeWidth="2" onClick={() => onPick({ n: 25, m: 2 })} />
      {marks.map((d, i) => {
        const [x, y] = where(d, i);
        return (
          <g key={i} pointerEvents="none">
            <circle cx={x} cy={y} r="16" fill="#FFFFFF" stroke="#0A0A0B" strokeWidth="3" />
            <text x={x} y={y} fill="#0A0A0B" fontSize="18" fontWeight="800" textAnchor="middle" dominantBaseline="central">{i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}
