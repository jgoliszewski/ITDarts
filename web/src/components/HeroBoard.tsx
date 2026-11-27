// The hero board of the games with a board (docs/UI.md, Ekran wyników): a ring of numbers round the board, one state per segment
// (targets.ts), the ring that counts outlined, the rest dimmed, and this Turn's darts as dots.
import type { Dart } from '../../../games/darts.ts';
import { BOARD_ORDER } from '../../../games/darts.ts';
import { DOT, SHOWN as S, arc, dartSpot, inputSpot, pt } from './Dartboard.tsx';
import type { BoardTargets, Run, Segment, SegmentState } from './targets.ts';
import { BULL, isLit, numberTurn, outlineKey, runs } from './targets.ts';

const SINGLE = ['#232327', '#4A4A50'], RING = ['#B8322F', '#1F8A52'];
// Dimmed wedge, “Lighter”: dark enough to drop back, light enough to still read as a board.
const DIM_SINGLE = ['#1E1E21', '#2C2C30'], DIM_RING = ['#432D2C', '#26392E'];
const ACCENT = '#F58224', GREEN = '#3CCB7F', RED = '#FF5A5F', INK = '#111111', WIRE = '#0A0A0B';
const BAND = '#1F1F23', INK_OFF = 'rgba(17,17,17,.25)';
const FONT = 'Barlow Condensed, Inter, sans-serif';
// The number ring (S1): a band round the double ring, the number in it, ticks on its inner edge.
const B_IN = 346, B_OUT = 420, NUM_R = 392, NUM_SIZE = 36, TICK = [350, 361] as const;
// The band's gap at a run's end, wider where a run in another state colour touches it (degrees of the outline's trim).
const GAP = 2.5, CLASH_GAP = 9, CLASH_DEG = 2.2;

/** Per state: band fill, number, filled tick, empty tick. */
const LOOK: Record<SegmentState, [string, string, string, string]> = {
  target: [ACCENT, INK, INK, INK_OFF],
  done: ['#1F4D33', GREEN, GREEN, 'rgba(60,203,127,.25)'],
  danger: [RED, INK, INK, INK_OFF],
  off: [BAND, '#7A7A80', '#7A7A80', INK_OFF],
  closedAll: [BAND, '#5A5A60', '#5A5A60', INK_OFF],
  none: [BAND, '#A1A1A6', '#A1A1A6', INK_OFF],
};
const OUTLINE: Partial<Record<SegmentState, string>> = { target: ACCENT, danger: RED };
const RING_R = { 1: [S[3], S[4]], 2: [S[4], S[5]], 3: [S[2], S[3]] } as const;

const f = (n: number) => n.toFixed(2);
const start = (k: number) => k * 18 - 9;

/** For each run: does a run of another colour (not `bg`) touch its start / end? Both then get a wider gap. */
function clashes<K>(rs: Run<K>[], bg: K | null): [boolean, boolean][] {
  const touches = (a: Run<K>, b: Run<K>) => (a.k + a.len) % 20 === b.k;
  return rs.map((r, i) => {
    if (rs.length < 2 || r.key === bg) return [false, false];
    const prev = rs[(i + rs.length - 1) % rs.length], next = rs[(i + 1) % rs.length];
    const diff = (o: Run<K>) => o.key !== r.key && o.key !== bg;
    return [touches(prev, r) && diff(prev), touches(r, next) && diff(next)];
  });
}

/** A run as one band, rounded only at its ends: the shape shrunk by rr, then stroked with rr round joins. */
function Band({ a1, a2, fill, g1, g2 }: { a1: number; a2: number; fill: string; g1: number; g2: number }) {
  const rr = 7;
  if (a2 - a1 >= 360) return <circle r={(B_IN + B_OUT) / 2} fill="none" stroke={fill} strokeWidth={B_OUT - B_IN} />;
  const deg = (g: number) => ((rr + g) / ((B_IN + B_OUT) / 2)) * (180 / Math.PI);
  return <path d={arc(B_IN + rr, B_OUT - rr, a1 + deg(g1), a2 - deg(g2))} fill={fill} stroke={fill} strokeWidth={2 * rr} strokeLinejoin="round" />;
}

function Outline({ d, colour }: { d: string; colour: string }) {
  return <><path d={d} fill="none" stroke={WIRE} strokeWidth="11" strokeLinejoin="round" /><path d={d} fill="none" stroke={colour} strokeWidth="6" strokeLinejoin="round" /></>;
}

function RingOutline({ r, colour = ACCENT }: { r: number; colour?: string }) {
  return <><circle r={r} fill="none" stroke={WIRE} strokeWidth="11" /><circle r={r} fill="none" stroke={colour} strokeWidth="6" /></>;
}

/** Three ticks (3 × 4°) along the arc, or up to five shorter ones; they turn with the number. */
function Ticks({ angle, flipped, on, of: [onCol, offCol] }: { angle: number; flipped: boolean; on: boolean[]; of: [string, string] }) {
  const n = on.length, step = n > 3 ? 3.5 : 5.2, half = n > 3 ? 1.3 : 2, mid = (n - 1) / 2;
  return <>{on.map((v, i) => {
    const a = angle + (flipped ? -1 : 1) * (i - mid) * step;
    return <path key={i} d={arc(TICK[0], TICK[1], a - half, a + half)} fill={v ? onCol : offCol} />;
  })}</>;
}

export function HeroBoard({ board, darts, label }: {
  board: BoardTargets;
  /** With coords a dot sits where the dart stuck; without (fixed or added by hand) in the middle of its field. */
  darts: { dart: Dart; good: boolean; coords?: { x: number; y: number } }[];
  label: string;
}) {
  const seg = (n: number): Segment => board.segments[n];
  const hatched = (n: number) => seg(n).state === 'closedAll';
  const fill = (n: number, part: 'in' | 'big' | 2 | 3, k: number) => {
    const ring = part === 2 || part === 3;
    if (hatched(n)) return 'url(#hb-hatch)';
    return isLit(board, n, part) ? (ring ? RING : SINGLE)[k % 2] : (ring ? DIM_RING : DIM_SINGLE)[k % 2];
  };

  // The ring that counts: one outline per run of neighbours with the same ring and colour, two circles for the whole ring.
  const oRuns = runs(BOARD_ORDER.map(n => outlineKey(seg(n))));
  const oClash = clashes(oRuns, null);
  const bull = seg(BULL);

  // The band: neighbouring segments in the same colour form one band with thin dividers.
  const sRuns = runs(BOARD_ORDER.map(n => LOOK[seg(n).state][0]));
  const sClash = clashes(sRuns, BAND);
  const bullBand = bull.state === 'target' || bull.state === 'done' || bull.state === 'danger' || bull.state === 'closedAll';

  return (
    <svg className="target-board" viewBox="-432 -432 864 864" role="img" aria-label={label}>
      <defs>
        <pattern id="hb-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="14" height="14" fill="#1C1C1F" />
          <rect width="5" height="14" fill="#3B3B40" />
        </pattern>
      </defs>
      <circle r="430" fill="#141416" />
      {BOARD_ORDER.map((n, k) => ([[S[1], S[2], 'in'], [S[2], S[3], 3], [S[3], S[4], 'big'], [S[4], S[5], 2]] as const).map(([r1, r2, part], j) => (
        <path key={`${n}-${j}`} d={arc(r1, r2, start(k), start(k + 1))} fill={fill(n, part, k)} stroke={WIRE} strokeWidth="2" />
      )))}
      <circle r={S[1]} fill={hatched(BULL) ? 'url(#hb-hatch)' : isLit(board, BULL, 'big') ? RING[1] : DIM_RING[1]} stroke={WIRE} strokeWidth="2" />
      <circle r={S[0]} fill={hatched(BULL) ? '#1C1C1F' : isLit(board, BULL, 2) ? RING[0] : DIM_RING[0]} stroke={WIRE} strokeWidth="2" />

      {board.wholeRing && <><RingOutline r={RING_R[board.wholeRing][0]} /><RingOutline r={RING_R[board.wholeRing][1]} /></>}
      {oRuns.map(({ k, len, key }, i) => {
        const [ring, state] = key.split('|') as [`${1 | 2 | 3}`, SegmentState];
        const [r1, r2] = RING_R[Number(ring) as 1 | 2 | 3], colour = OUTLINE[state]!;
        if (len === 20) return <g key={i}><RingOutline r={r1} colour={colour} /><RingOutline r={r2} colour={colour} /></g>;
        const [c1, c2] = oClash[i];
        return <Outline key={i} d={arc(r1, r2, start(k) + (c1 ? CLASH_DEG : 0), start(k + len) - (c2 ? CLASH_DEG : 0))} colour={colour} />;
      })}
      {outlineKey(bull) && <RingOutline r={bull.ring === 2 ? S[0] : S[1]} colour={OUTLINE[bull.state]} />}

      {sRuns.map(({ k, len, key }, i) => (
        <g key={i}>
          <Band a1={start(k)} a2={start(k + len)} fill={key} g1={sClash[i][0] ? CLASH_GAP : GAP} g2={sClash[i][1] ? CLASH_GAP : GAP} />
          {Array.from({ length: len === 20 ? 20 : len - 1 }, (_, j) => {
            const a = start(k + j + 1), [x1, y1] = pt(B_IN + 3, a), [x2, y2] = pt(B_OUT - 3, a);
            return <path key={j} d={`M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`} stroke="rgba(10,10,11,.55)" strokeWidth="2" />;
          })}
        </g>
      ))}
      {BOARD_ORDER.map(n => {
        const s = seg(n);
        if (!s.ticks) return null;
        const { angle, flipped } = numberTurn(n), look = LOOK[s.state];
        return <Ticks key={n} angle={angle} flipped={flipped} on={s.ticks} of={[look[2], look[3]]} />;
      })}

      {/* The bull: a ring round the outer bull in its segment's colour and ticks. */}
      {bullBand && <>
        <circle r="50" fill="none" stroke={WIRE} strokeWidth="22" />
        <circle r="50" fill="none" stroke={LOOK[bull.state][0]} strokeWidth="18" />
        {bull.ticks?.map((v, i, all) => {
          const a = (i - (all.length - 1) / 2) * (all.length > 3 ? 16 : 24);
          return <path key={i} d={arc(43, 57, a - (all.length > 3 ? 5 : 8), a + (all.length > 3 ? 5 : 8))} fill={v ? LOOK[bull.state][2] : LOOK[bull.state][3]} />;
        })}
      </>}

      {darts.map(({ dart, good, coords }, i) => {
        // Board Manager reports some misses at (0, 0) or on the board; only a miss off the board is drawn where it landed.
        const landed = coords && (dart.n !== 0 || Math.hypot(coords.x, coords.y) > 1);
        const [x, y] = landed ? inputSpot(coords.x, coords.y, S) : dartSpot(dart, i, S);
        return <circle key={`d${i}`} cx={x} cy={y} r={DOT} fill={good ? GREEN : RED} stroke="#FFFFFF" strokeWidth="3" />;
      })}
      {/* The numbers go over the darts: a miss is drawn on their ring and must not hide one. */}
      {BOARD_ORDER.map(n => {
        const { angle, flipped } = numberTurn(n), [x, y] = pt(NUM_R, angle);
        return (
          <text key={`t${n}`} x={f(x)} y={f(y)} transform={`rotate(${flipped ? angle + 180 : angle} ${f(x)} ${f(y)})`} fill={LOOK[seg(n).state][1]}
            fontSize={NUM_SIZE} fontWeight="800" fontFamily={FONT} textAnchor="middle" dominantBaseline="central">{n}</text>
        );
      })}
    </svg>
  );
}
