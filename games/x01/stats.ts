// X01 history statistics, computed from stored visits (docs/STATYSTYKI.md). Pure.
import type { Dart } from '../darts.ts';
import { value } from '../darts.ts';
import type { CheckOut } from './rules.ts';
import { oneDartFinish } from './rules.ts';

/** One stored visit of the player, with what the leg needs to know. */
export interface StatVisit {
  legId: number;
  /** The leg was played to the end (somebody checked out). */
  legFinished: boolean;
  visitNo: number;
  start: number;
  scored: number;
  bust: boolean;
  checkout: boolean;
  dartsCount: number;
  darts: Dart[];
  checkOut: CheckOut;
}

export interface X01Stats {
  legs: number;
  legsWon: number;
  darts: number;
  avg: number | null;
  first9: number | null;
  until170: number | null;
  checkoutPct: number | null;
  checkoutHits: number;
  checkoutAttempts: number;
  highestCheckout: number | null;
  bestLeg: number | null;
  c100: number;
  c140: number;
  c180: number;
}

const avg = (points: number, darts: number) => (darts > 0 ? Math.round((points / darts) * 300) / 100 : null);

export function x01Stats(visits: StatVisit[]): X01Stats {
  let points = 0, darts = 0, p9 = 0, d9 = 0, p170 = 0, d170 = 0;
  let hits = 0, attempts = 0, highest: number | null = null, c100 = 0, c140 = 0, c180 = 0;
  const legDarts = new Map<number, number>();
  const won = new Set<number>();

  for (const v of visits) {
    points += v.scored;
    darts += v.dartsCount;
    if (v.visitNo <= 3) {
      p9 += v.scored;
      d9 += v.dartsCount;
    }
    // Average until 170: whole visits started above 170, including the one that drops below.
    if (v.start > 170) {
      p170 += v.scored;
      d170 += v.dartsCount;
    }
    if (v.scored === 180) c180++;
    else if (v.scored >= 140) c140++;
    else if (v.scored >= 100) c100++;
    legDarts.set(v.legId, (legDarts.get(v.legId) ?? 0) + v.dartsCount);

    if (!v.legFinished) continue;
    // Checkout %: darts thrown while the score was finishable with one dart.
    let remaining = v.start;
    for (const d of v.darts) {
      if (oneDartFinish(remaining, v.checkOut)) attempts++;
      remaining -= value(d);
      if (remaining <= 0) break;
    }
    if (v.checkout) {
      hits++;
      won.add(v.legId);
      highest = Math.max(highest ?? 0, v.start);
    }
  }

  let bestLeg: number | null = null;
  for (const id of won) bestLeg = Math.min(bestLeg ?? Infinity, legDarts.get(id)!);

  return {
    legs: legDarts.size,
    legsWon: won.size,
    darts,
    avg: avg(points, darts),
    first9: avg(p9, d9),
    until170: avg(p170, d170),
    checkoutPct: attempts > 0 ? Math.round((hits / attempts) * 1000) / 10 : null,
    checkoutHits: hits,
    checkoutAttempts: attempts,
    highestCheckout: highest,
    bestLeg,
    c100,
    c140,
    c180,
  };
}
