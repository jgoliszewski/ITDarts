// Bull-off from the board: one dart each at the bull, the server measures who is closest. Pure, no I/O.
import type { Coords, Dart } from './darts.ts';
import type { BullOff } from './x01/rules.ts';

/** Board Manager coords are normalized: 1 is the outer edge of the double ring, 170 mm from the centre. */
const BOARD_RADIUS_MM = 170;
/** Closest: a dart less than this from the leader's is a tie (docs/UI.md, Bull-off z tarczy). */
export const TIE_MM = 5;

export type BullEvent = { t: 'bull'; dart: Dart; coords?: Coords; at: number };

export interface BullDart {
  dart: Dart;
  coords?: Coords;
  at: number;
}

export interface BullThrow extends BullDart {
  player: number;
  round: number;
  /** Distance from the centre; null without coords, which ranks last. */
  mm: number | null;
}

export interface BullOffView {
  rule: 'closest' | 'pdc';
  throws: BullThrow[];
  /** Players still in, in this round's throwing order. */
  contenders: number[];
  round: number;
  /** Who throws next, null once decided. */
  next: number | null;
  winner: number | null;
  /** Playing order once decided: the winner, then everyone by standings. */
  order: number[] | null;
}

const mmOf = (d: BullDart) => (d.coords ? Math.hypot(d.coords.x, d.coords.y) * BOARD_RADIUS_MM : null);
const rank = (t: BullThrow) => t.mm ?? Infinity;
const bed = (d: Dart) => (d.n === 25 ? d.m : 0);
const cmp = (a: number, b: number) => (a === b ? 0 : a < b ? -1 : 1);

/** Players tied for the lead after a round, in the order they threw. Closest: under TIE_MM from the leader. PDC: the same bull or 25. */
function leaders(round: BullThrow[], rule: 'closest' | 'pdc'): number[] {
  const best = round.reduce((a, b) => (rank(b) < rank(a) ? b : a));
  const sameBed = rule === 'pdc' && bed(best.dart) > 0;
  const tied = (t: BullThrow) =>
    rank(t) === rank(best) || (rule === 'closest' ? rank(t) - rank(best) < TIE_MM : sameBed && bed(t.dart) === bed(best.dart));
  return round.filter(tied).map(t => t.player);
}

/**
 * Everyone by their last throw: a later round first, then closer, then setup order (no coords ranks after coords).
 * Players with no throw yet come last.
 */
export function standings(throws: BullThrow[], players: number): number[] {
  const last = new Map(throws.map(t => [t.player, t]));
  return Array.from({ length: players }, (_, i) => i).sort((a, b) => {
    const ta = last.get(a), tb = last.get(b);
    if (!ta || !tb) return cmp(ta ? 0 : 1, tb ? 0 : 1) || a - b;
    return tb.round - ta.round || cmp(rank(ta), rank(tb)) || a - b;
  });
}

/** One dart each in roster order; tied leaders throw again in reverse order until one is left. */
export function bullOff(darts: BullDart[], players: number, rule: 'closest' | 'pdc'): BullOffView {
  const throws: BullThrow[] = [];
  let contenders = Array.from({ length: players }, (_, i) => i);
  let round = 0, used = 0;
  let winner: number | null = players === 1 ? 0 : null;
  while (winner === null) {
    const r = darts.slice(used, used + contenders.length).map((d, k) => ({ ...d, player: contenders[k], round, mm: mmOf(d) }));
    throws.push(...r);
    used += r.length;
    if (r.length < contenders.length) break;
    const lead = leaders(r, rule);
    if (lead.length === 1) winner = lead[0];
    else {
      contenders = lead.reverse();
      round++;
    }
  }
  const thrown = throws.filter(t => t.round === round).length;
  const order = winner === null ? null : [winner, ...standings(throws, players).filter(p => p !== winner)];
  return { rule, throws, contenders, round, next: winner === null ? contenders[thrown] : null, winner, order };
}

/** Setup order from `starter` on: a pick on the pilot, or no bull-off. */
export const fromStarter = (starter: number, players: number) => Array.from({ length: players }, (_, k) => (starter + k) % players);

/** An event before the playing order is known: a bull dart, its undo, or a pick on the pilot. Returns the order once decided. */
export function beforeStart(bull: BullDart[], e: { t: string; [k: string]: unknown }, players: number, rule: BullOff): number[] | null {
  if (e.t === 'start') {
    const s = e.starter as number;
    return s >= 0 && s < players ? fromStarter(s, players) : null;
  }
  if (rule === 'off') return null;
  if (e.t === 'undo') bull.pop();
  else if (e.t === 'bull') {
    const b = e as BullEvent;
    bull.push({ dart: b.dart, coords: b.coords, at: b.at });
  } else return null;
  return bullOff(bull, players, rule).order;
}

/** Undo of the start: drops the bull dart that decided it. A pick on the pilot leaves the darts as they were. */
export function undoStart(bull: BullDart[], players: number, rule: BullOff) {
  if (rule !== 'off' && bullOff(bull, players, rule).winner !== null) bull.pop();
}

export const bullView = (bull: BullDart[], players: number, rule: BullOff): BullOffView | null =>
  rule === 'off' ? null : bullOff(bull, players, rule);
