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
  /** Start score of the match the leg belongs to. */
  startScore: number;
  visitNo: number;
  start: number;
  scored: number;
  bust: boolean;
  checkout: boolean;
  dartsCount: number;
  darts: Dart[];
  checkOut: CheckOut;
}

/** One start score a player has played: legs played and the fewest darts of a won leg. */
export interface BestLegAt {
  startScore: number;
  legs: number;
  best: number | null;
}

/** One double on the board: `double` is 1-20, or 25 for the bull. */
export interface DoubleRow {
  double: number;
  hits: number;
  attempts: number;
}

export interface X01Stats {
  legs: number;
  legsWon: number;
  darts: number;
  visits: number;
  busts: number;
  /** Percent of visits that busted, one decimal. */
  bustRate: number | null;
  /** The most points of one visit. */
  highestVisit: number | null;
  avg: number | null;
  first9: number | null;
  checkoutPct: number | null;
  checkoutHits: number;
  checkoutAttempts: number;
  highestCheckout: number | null;
  /** Fewest darts of a won leg at the start score the player plays most (ties: the higher one). */
  bestLeg: number | null;
  /** That start score; null without legs. */
  bestLegStart: number | null;
  /** Every start score played, most legs first (ties: higher score first). */
  bestLegs: BestLegAt[];
  /** Doubles with at least one attempt, most attempts first (ties: lower double first). Double out only. */
  doubles: DoubleRow[];
  c60: number;
  c80: number;
  c100: number;
}

function doubleRow(table: Map<number, DoubleRow>, double: number): DoubleRow {
  const row = table.get(double) ?? { double, hits: 0, attempts: 0 };
  table.set(double, row);
  return row;
}

const avg = (points: number, darts: number) => (darts > 0 ? Math.round((points / darts) * 300) / 100 : null);

export function x01Stats(visits: StatVisit[]): X01Stats {
  let points = 0, darts = 0, p9 = 0, d9 = 0, busts = 0, top: number | null = null;
  let hits = 0, attempts = 0, highest: number | null = null, c60 = 0, c80 = 0, c100 = 0;
  const legDarts = new Map<number, number>();
  const legStart = new Map<number, number>();
  const table = new Map<number, DoubleRow>();
  const won = new Set<number>();

  for (const v of visits) {
    points += v.scored;
    darts += v.dartsCount;
    if (v.visitNo <= 3) {
      p9 += v.scored;
      d9 += v.dartsCount;
    }
    if (v.bust) busts++;
    top = Math.max(top ?? 0, v.scored);
    if (v.scored >= 100) c100++;
    else if (v.scored >= 80) c80++;
    else if (v.scored >= 60) c60++;
    legDarts.set(v.legId, (legDarts.get(v.legId) ?? 0) + v.dartsCount);
    legStart.set(v.legId, v.startScore);

    if (!v.legFinished) continue;
    // Checkout %: darts thrown while the score was finishable with one dart.
    let remaining = v.start;
    for (const d of v.darts) {
      const finishable = oneDartFinish(remaining, v.checkOut);
      if (finishable) attempts++;
      // Double table: the attempt belongs to the double the score asks for (50 is the bull).
      const row = finishable && v.checkOut === 'double' ? doubleRow(table, remaining === 50 ? 25 : remaining / 2) : null;
      if (row) row.attempts++;
      remaining -= value(d);
      if (row && v.checkout && remaining === 0) row.hits++;
      if (remaining <= 0) break;
    }
    if (v.checkout) {
      hits++;
      won.add(v.legId);
      highest = Math.max(highest ?? 0, v.start);
    }
  }

  const at = new Map<number, BestLegAt>();
  for (const [id, start] of legStart) {
    const row = at.get(start) ?? { startScore: start, legs: 0, best: null };
    row.legs++;
    if (won.has(id)) row.best = Math.min(row.best ?? Infinity, legDarts.get(id)!);
    at.set(start, row);
  }
  const bestLegs = [...at.values()].sort((a, b) => b.legs - a.legs || b.startScore - a.startScore);

  return {
    legs: legDarts.size,
    legsWon: won.size,
    darts,
    visits: visits.length,
    busts,
    bustRate: visits.length ? Math.round((busts / visits.length) * 1000) / 10 : null,
    highestVisit: top,
    avg: avg(points, darts),
    first9: avg(p9, d9),
    checkoutPct: attempts > 0 ? Math.round((hits / attempts) * 1000) / 10 : null,
    checkoutHits: hits,
    checkoutAttempts: attempts,
    highestCheckout: highest,
    bestLeg: bestLegs[0]?.best ?? null,
    bestLegStart: bestLegs[0]?.startScore ?? null,
    bestLegs,
    doubles: [...table.values()].sort((a, b) => b.attempts - a.attempts || a.double - b.double),
    c60,
    c80,
    c100,
  };
}
