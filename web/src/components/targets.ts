// What the hero board shows (docs/UI.md, Ekran wyników): a state per segment of the number ring, the ring that counts and
// up to three ticks (five in Killer). Pure: the games map their view to this, HeroBoard draws it.
import { BOARD_ORDER } from '../../../games/darts.ts';

/**
 * target: hit it now (orange). done: closed or cleared by the player (green). danger: hitting it hurts you (red, Killer's own double).
 * off: out of play (grey, wedge dimmed). closedAll: closed by every player (grey, wedge hatched). none: no target, full colours (Free throw).
 */
export type SegmentState = 'target' | 'done' | 'danger' | 'off' | 'closedAll' | 'none';

/** The part of the wedge that counts: any segment, the big single (1), the double (2) or the treble (3). For the bull 2 is the bullseye. */
export type TargetRing = 'any' | 1 | 2 | 3;

export interface Segment {
  state: SegmentState;
  /** The lit part of the wedge; without it the wedge is dimmed. A numeric ring on a target or danger segment is outlined. */
  ring?: TargetRing;
  /** Ticks on the segment's inner edge, filled or empty: Cricket marks, Shanghai S / D / T, Killer lives. */
  ticks?: boolean[];
}

export interface BoardTargets {
  /** Sectors 1–20 and the bull (25). */
  segments: Record<number, Segment>;
  /** The whole ring counts all round (Football doubles): only it is lit, outlined by two circles. */
  wholeRing?: 1 | 2 | 3;
}

export const BULL = 25;
export const ALL = [...BOARD_ORDER, BULL];

/** Every sector and the bull in one state, then the given segments over it. */
export function boardOf(base: Segment, over: [number, Segment][] = [], wholeRing?: 1 | 2 | 3): BoardTargets {
  const segments: Record<number, Segment> = {};
  for (const n of ALL) segments[n] = base;
  for (const [n, s] of over) segments[n] = s;
  return wholeRing ? { segments, wholeRing } : { segments };
}

/** n of `of` ticks filled. */
export const ticks = (n: number, of = 3): boolean[] => Array.from({ length: of }, (_, i) => i < n);

export interface Run<K> {
  /** Index in BOARD_ORDER where the run starts. */
  k: number;
  len: number;
  key: K;
}

/**
 * Neighbouring sectors (by BOARD_ORDER, 5 wraps to 20) with the same key, one run each; null keys belong to no run.
 * A ring all in one key is one run of 20 starting at 20.
 */
export function runs<K>(keys: (K | null)[]): Run<K>[] {
  const N = keys.length;
  if (N === 0) return [];
  if (keys.every(x => x !== null && x === keys[0])) return [{ k: 0, len: N, key: keys[0] as K }];
  // Start where a run starts, so none is cut by the 5 / 20 seam.
  const s = keys.findIndex((x, i) => x !== keys[(i + N - 1) % N]);
  if (s < 0) return [];
  const out: Run<K>[] = [];
  for (let i = 0; i < N;) {
    const k = (s + i) % N, key = keys[k];
    let len = 1;
    while (len < N - i && keys[(k + len) % N] === key) len++;
    if (key !== null) out.push({ k, len, key });
    i += len;
  }
  return out;
}

/** Numbers within this many degrees of the bottom (3) turn round to read from below: “Below 11 / 6”. */
export const FLIP_DEG = 72;

/** A number's turn on the board: radial, top of the digits outward, and turned round below 11 and 6 (8, 16, 7, 19, 3, 17, 2, 15, 10). */
export function numberTurn(n: number): { angle: number; flipped: boolean } {
  const angle = BOARD_ORDER.indexOf(n) * 18;
  const flipped = Math.abs(angle - 180) <= FLIP_DEG;
  return { angle, flipped };
}

/** Is this part of the wedge drawn in full colours? `part` is 'in' or 'big' for the singles, 2 or 3 for the rings; the bull's are 'big' (25) and 2 (50). */
export function isLit(b: BoardTargets, n: number, part: 'in' | 'big' | 2 | 3): boolean {
  const s = b.segments[n];
  // A whole ring (Football Doubles) is the twenty sectors' ring: the bull never scores there, so it stays dimmed.
  if (s.state === 'none') return !b.wholeRing || (n !== BULL && part === b.wholeRing);
  if (s.state === 'closedAll' || s.ring === undefined) return false;
  if (s.ring === 'any') return true;
  return s.ring === 1 ? part === 'big' : s.ring === part;
}

/** The key that merges neighbouring outlines: same ring and same colour. Null for a segment without an outline. */
export function outlineKey(s: Segment): string | null {
  if (typeof s.ring !== 'number' || (s.state !== 'target' && s.state !== 'danger')) return null;
  return `${s.ring}|${s.state}`;
}
