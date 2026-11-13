import type { MouseEvent, ReactNode } from 'react';
import type { Coords, Dart } from '../../../games/darts.ts';
import { BOARD_ORDER, BOARD_RADIUS_MM as R_MM } from '../../../games/darts.ts';

// Rings drawn fatter than real ones so a finger can hit doubles and trebles (UI.md).
// bull, outer bull, treble in, treble out, double in, double out
export const R = [20, 46, 168, 220, 290, 340];
// Near real proportions for boards that are only looked at; trebles, doubles and the bulls a bit wider so they read on the big screen.
export const SHOWN = [16, 36, 188, 214, 314, 340];
/** Radius of a dart's dot. Without coords dots sit in the middle of their field, so a single never shows on a treble. */
export const DOT = 7;

export const pt = (r: number, deg: number) => [r * Math.sin((deg * Math.PI) / 180), -r * Math.cos((deg * Math.PI) / 180)] as const;

export function arc(r1: number, r2: number, a1: number, a2: number) {
  const [x1, y1] = pt(r2, a1), [x2, y2] = pt(r2, a2), [x3, y3] = pt(r1, a2), [x4, y4] = pt(r1, a1);
  const f = (n: number) => n.toFixed(2);
  return `M${f(x1)} ${f(y1)}A${r2} ${r2} 0 0 1 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${r1} ${r1} 0 0 0 ${f(x4)} ${f(y4)}Z`;
}

/** Where the i-th dart of a visit is drawn: the middle of its field, nudged by i so darts in one field don't overlap. */
export function dartSpot(d: Dart, i: number, rings = R): readonly [number, number] {
  if (d.n === 0) return pt(368, 200 + i * 14);
  if (d.n === 25) return d.m === 2 ? [i * 8 - 8, 0] : pt((rings[0] + rings[1]) / 2, 90 + i * 40);
  const a = BOARD_ORDER.indexOf(d.n) * 18 + (i - 1) * 4;
  const r = d.m === 3 ? (rings[2] + rings[3]) / 2 : d.m === 2 ? (rings[4] + rings[5]) / 2 : (rings[3] + rings[4]) / 2;
  return pt(r, a);
}

// Ring edges in board units (1 = 170 mm) and where SHOWN draws them.
const REAL = [0, 6.35 / R_MM, 15.9 / R_MM, 99 / R_MM, 107 / R_MM, 162 / R_MM, 1];

/** Where Board Manager's coords (1 = 170 mm, y up) fall on a board with these rings (SHOWN by default): same angle, radius stretched ring by ring, so a dot's centre always sits in its own field (with Board Manager's standard ring radii). */
export function coordsSpot(x: number, y: number, rings = SHOWN): readonly [number, number] {
  const DRAWN = [0, ...rings];
  const d = Math.hypot(x, y);
  // Past the double the last ring's scale carries on.
  const f = REAL.findIndex(r => r >= d), i = f < 0 ? REAL.length - 1 : Math.max(1, f);
  const k = (d - REAL[i - 1]) / (REAL[i] - REAL[i - 1]);
  const r = DRAWN[i - 1] + k * (DRAWN[i] - DRAWN[i - 1]);
  return d ? [(x / d) * r, (-y / d) * r] : [0, 0];
}

/** A dart with coords on a board with these rings (the input board's by default): where it stuck, but no further out than the ring of numbers, so a miss stays in view on its side of the board. */
export function inputSpot(x: number, y: number, rings = R): readonly [number, number] {
  const [sx, sy] = coordsSpot(x, y, rings), r = Math.hypot(sx, sy), k = r > 368 ? 368 / r : 1;
  return [sx * k, sy * k];
}

/** Board Manager's coords (1 = 170 mm, y up) for a spot on a board with these rings: the inverse of coordsSpot, so a tap lands in the field it was made in. */
export function spotCoords(sx: number, sy: number, rings = R): Coords {
  const DRAWN = [0, ...rings];
  const r = Math.hypot(sx, sy);
  // Past the double the last ring's scale carries on.
  const f = DRAWN.findIndex(v => v >= r), i = f < 0 ? DRAWN.length - 1 : Math.max(1, f);
  const d = REAL[i - 1] + ((r - DRAWN[i - 1]) / (DRAWN[i] - DRAWN[i - 1])) * (REAL[i] - REAL[i - 1]);
  return r ? { x: (sx / r) * d, y: (-sy / r) * d } : { x: 0, y: 0 };
}

/** Where a click fell on the board, as Board Manager coords. */
function tapCoords(e: MouseEvent<SVGElement>): Coords | undefined {
  // Through the SVG's own matrix, so a letterboxed board (a rectangle around the square viewBox) still maps right.
  const m = e.currentTarget.ownerSVGElement?.getScreenCTM();
  if (!m) return undefined;
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
  return spotCoords(p.x, p.y);
}

export function Dartboard({ marks, selected, hot, onPick, size = 760 }: {
  marks: { dart: Dart; coords?: { x: number; y: number } }[];
  selected: Dart | null;
  /** Index of the dart being fixed: drawn bigger with a thicker rim (its field is orange already). */
  hot?: number;
  /** With where the tap fell, so the fix keeps it (Football and Bullseye tell the inner from the outer single). */
  onPick: (d: Dart, coords?: Coords) => void;
  size?: number;
}) {
  const isSel = (n: number, m: number) => !!selected && selected.n === n && selected.m === m;
  return (
    <svg className="dartboard" width={size} height={size} viewBox="-380 -380 760 760" role="img" aria-label="Dartboard: tap where the dart landed">
      <circle className="hit" cx="0" cy="0" r="380" fill="#141416" onClick={e => onPick({ n: 0, m: 1 }, tapCoords(e))} />
      {BOARD_ORDER.map((n, k) => {
        const [x, y] = pt(360, k * 18);
        return <text key={`t${n}`} x={x} y={y} fill="#A1A1A6" fontSize="24" fontWeight="700" fontFamily="Barlow Condensed, Inter, sans-serif" textAnchor="middle" dominantBaseline="central">{n}</text>;
      })}
      {BOARD_ORDER.map((n, k) => {
        const a1 = k * 18 - 9, a2 = k * 18 + 9, dark = k % 2 === 0;
        const single = dark ? '#232327' : '#4A4A50', ring = dark ? '#B8322F' : '#1F8A52';
        const parts: [number, number, 1 | 2 | 3, string][] = [[R[1], R[2], 1, single], [R[2], R[3], 3, ring], [R[3], R[4], 1, single], [R[4], R[5], 2, ring]];
        return parts.map(([r1, r2, m, fill], j) => (
          <path key={`${n}-${j}`} d={arc(r1, r2, a1, a2)} fill={isSel(n, m) ? '#F58224' : fill} stroke="#0A0A0B" strokeWidth="2" onClick={e => onPick({ n, m }, tapCoords(e))}>
            <title>{`${m === 3 ? 'T' : m === 2 ? 'D' : 'S'}${n}`}</title>
          </path>
        ));
      })}
      <circle className="hit" cx="0" cy="0" r={R[1]} fill={isSel(25, 1) ? '#F58224' : '#1F8A52'} stroke="#0A0A0B" strokeWidth="2" onClick={e => onPick({ n: 25, m: 1 }, tapCoords(e))} />
      <circle className="hit" cx="0" cy="0" r={R[0]} fill={isSel(25, 2) ? '#F58224' : '#B8322F'} stroke="#0A0A0B" strokeWidth="2" onClick={e => onPick({ n: 25, m: 2 }, tapCoords(e))} />
      {marks.map(({ dart, coords }, i) => {
        // Where the dart really stuck when the board told us; the middle of its field for a dart typed in by hand.
        const [x, y] = coords ? inputSpot(coords.x, coords.y) : dartSpot(dart, i);
        return <circle key={i} pointerEvents="none" cx={x} cy={y} r={i === hot ? DOT + 4 : DOT} fill="#FFFFFF" stroke="#0A0A0B" strokeWidth={i === hot ? 3 : 2} />;
      })}
    </svg>
  );
}

// The input board's colours (Dartboard above). Cleared targets are hatched grey; the target keeps its colours
// and gets a dashed orange outline that runs around it.
const SINGLE = ['#232327', '#4A4A50'], RING = ['#B8322F', '#1F8A52'], CLEARED = 'url(#tb-hatch)', HIT_DOT = '#3CCB7F', MISS_DOT = '#FF5A5F';

/**
 * Read-only board for ATC and Full Board (docs/GRY.md, mockup O): cleared targets hatched, the target outlined
 * (only its ring with Doubles or Trebles) and this visit's darts as dots, green for a hit, red otherwise.
 */
export function TargetBoard({ cleared, target, ring, darts, label, children }: {
  cleared: number[];
  /** A sector or the bull (25), 'ring': the whole of `ring` all round (Football with the ball), or sectors (the big singles of Football's Big singles). */
  target: number | number[] | 'ring' | null;
  /** The ring that counts on the target: null for any segment, 1 the big single, 2 doubles, 3 trebles. */
  ring: 1 | 2 | 3 | null;
  /** With coords a dot sits where the dart stuck; without (fixed or added by hand) in the middle of its field. */
  darts: { dart: Dart; good: boolean; coords?: { x: number; y: number } }[];
  label: string;
  /** Drawn over the board (Test board). */
  children?: ReactNode;
}) {
  const S = SHOWN;
  const done = new Set(cleared);
  const paint = (n: number, normal: string) => done.has(n) ? CLEARED : normal;
  const tk = typeof target === 'number' && target !== 25 ? BOARD_ORDER.indexOf(target) : -1;
  const [o1, o2] = ring === 1 ? [S[3], S[4]] : ring === 3 ? [S[2], S[3]] : ring === 2 ? [S[4], S[5]] : [S[1], S[5]];
  // Only the bullseye counts for the bull with Doubles or Trebles.
  const outline = target === null ? null
    : Array.isArray(target) ? target.map(n => <path key={n} className="tb-outline" d={arc(o1, o2, BOARD_ORDER.indexOf(n) * 18 - 9, BOARD_ORDER.indexOf(n) * 18 + 9)} />)
    : target === 'ring' ? <><circle className="tb-outline" cx="0" cy="0" r={o1} /><circle className="tb-outline" cx="0" cy="0" r={o2} /></>
    : target === 25 ? <circle className="tb-outline" cx="0" cy="0" r={ring === null ? S[1] : S[0]} />
    : <path className="tb-outline" d={arc(o1, o2, tk * 18 - 9, tk * 18 + 9)} />;
  return (
    <svg className="target-board" viewBox="-380 -380 760 760" role="img" aria-label={label}>
      <defs>
        <pattern id="tb-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          {/* About 15% darker than the live singles, so cleared sectors drop back (docs/UI.md, Ekran wyników). */}
          <rect width="14" height="14" fill="#1C1C1F" />
          <rect width="5" height="14" fill="#3B3B40" />
        </pattern>
      </defs>
      <circle cx="0" cy="0" r="380" fill="#141416" />
      {BOARD_ORDER.map((n, k) => {
        const parts: [number, number, 1 | 2 | 3][] = [[S[1], S[2], 1], [S[2], S[3], 3], [S[3], S[4], 1], [S[4], S[5], 2]];
        return parts.map(([r1, r2, m], j) => (
          <path key={`${n}-${j}`} d={arc(r1, r2, k * 18 - 9, k * 18 + 9)} fill={paint(n, m === 1 ? SINGLE[k % 2] : RING[k % 2])} stroke="#0A0A0B" strokeWidth="2" />
        ));
      })}
      <circle cx="0" cy="0" r={S[1]} fill={paint(25, RING[1])} stroke="#0A0A0B" strokeWidth="2" />
      <circle cx="0" cy="0" r={S[0]} fill={paint(25, RING[0])} stroke="#0A0A0B" strokeWidth="2" />
      {outline}
      {darts.map(({ dart, good, coords }, i) => {
        // Board Manager reports some misses at (0, 0) or on the board; only a miss off the board is drawn where it landed.
        const landed = coords && (dart.n !== 0 || Math.hypot(coords.x, coords.y) > 1);
        const [x, y] = landed ? inputSpot(coords.x, coords.y, S) : dartSpot(dart, i, S);
        return <circle key={i} cx={x} cy={y} r={DOT} fill={good ? HIT_DOT : MISS_DOT} stroke="#FFFFFF" strokeWidth="3" />;
      })}
      {/* The numbers go over the darts: a miss is drawn on their ring and must not hide one. */}
      {BOARD_ORDER.map((n, k) => {
        const [x, y] = pt(360, k * 18);
        return <text key={`t${n}`} x={x} y={y} fill={done.has(n) ? '#5A5A60' : '#A1A1A6'} fontSize="30" fontWeight="700" fontFamily="Barlow Condensed, Inter, sans-serif" textAnchor="middle" dominantBaseline="central">{n}</text>;
      })}
      {children}
    </svg>
  );
}
