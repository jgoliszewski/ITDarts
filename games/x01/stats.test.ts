import { describe, expect, it } from 'vitest';
import { parseDart, value } from '../darts.ts';
import type { StatVisit } from './stats.ts';
import { x01Stats } from './stats.ts';
import type { CheckOut } from './rules.ts';

interface V {
  leg: number;
  start: number;
  darts: string[];
  /** Start score of the match; 301 unless told. */
  startScore?: number;
  checkOut?: CheckOut;
  finished?: boolean;
  bust?: boolean;
  /** The last dart closes the leg. */
  checkout?: boolean;
  no?: number;
}

/** One stored visit; `scored` is what the darts add up to, 0 on a bust. */
const visit = (v: V): StatVisit => {
  const darts = v.darts.map(s => parseDart(s)!);
  return {
    legId: v.leg,
    legFinished: v.finished ?? true,
    startScore: v.startScore ?? 301,
    visitNo: v.no ?? 1,
    start: v.start,
    scored: v.bust ? 0 : darts.reduce((a, d) => a + value(d), 0),
    bust: !!v.bust,
    checkout: !!v.checkout,
    dartsCount: darts.length,
    darts,
    checkOut: v.checkOut ?? 'double',
  };
};

describe('x01Stats: visits, busts, highest visit', () => {
  it('has nothing to show without visits', () => {
    const s = x01Stats([]);
    expect([s.visits, s.busts, s.bustRate, s.highestVisit, s.bestLeg, s.bestLegStart, s.bestLegs, s.doubles]).toEqual([0, 0, null, null, null, null, [], []]);
  });

  it('counts visits and busts and gives the bust rate to one decimal', () => {
    const s = x01Stats([
      visit({ leg: 1, start: 301, darts: ['T20', 'T20', 'S1'] }),
      visit({ leg: 1, start: 180, darts: ['T20', 'T20', 'T20'], bust: true, no: 2 }),
      visit({ leg: 1, start: 180, darts: ['S5', 'S5', 'S5'], no: 3 }),
    ]);
    expect([s.visits, s.busts, s.bustRate]).toEqual([3, 1, 33.3]);
  });

  it('takes the highest visit from the points scored, a bust scores nothing', () => {
    const s = x01Stats([
      visit({ leg: 1, start: 301, darts: ['T20', 'T19', 'S1'] }), // 118
      visit({ leg: 1, start: 183, darts: ['T20', 'T20', 'T20'], bust: true, no: 2 }),
      visit({ leg: 1, start: 183, darts: ['S20', 'S20', 'S20'], no: 3 }), // 60
    ]);
    expect(s.highestVisit).toBe(118);
  });

  it('keeps 60+, 80+ and 100+ as counts of visits in their bands', () => {
    const s = x01Stats([60, 79, 80, 99, 100, 59].map((p, i) => ({ ...visit({ leg: 1, start: 501, darts: ['S1'], no: i + 1 }), scored: p })));
    expect([s.c60, s.c80, s.c100]).toEqual([2, 2, 1]);
  });
});

describe('x01Stats: best leg per start score', () => {
  // A won leg of `n` darts: n - 1 misses-as-singles in earlier visits, the last dart closes.
  const won = (leg: number, startScore: number, n: number): StatVisit[] => [
    visit({ leg, startScore, start: 100, darts: Array(n - 1).fill('S1') }),
    visit({ leg, startScore, start: 40, darts: ['D20'], checkout: true, no: 2 }),
  ];
  const lost = (leg: number, startScore: number): StatVisit[] => [visit({ leg, startScore, start: 100, darts: ['S1', 'S1', 'S1'] })];

  it('gives the best leg of the start score played most, not the best one overall', () => {
    const s = x01Stats([...won(1, 301, 20), ...won(2, 301, 18), ...won(3, 201, 12)]);
    expect([s.bestLeg, s.bestLegStart]).toEqual([18, 301]);
    expect(s.bestLegs).toEqual([{ startScore: 301, legs: 2, best: 18 }, { startScore: 201, legs: 1, best: 12 }]);
  });

  it('takes the higher start score on a tie in legs played', () => {
    const s = x01Stats([...won(1, 201, 12), ...won(2, 301, 20)]);
    expect([s.bestLeg, s.bestLegStart]).toEqual([20, 301]);
  });

  it('counts a lost or unfinished leg as played but never as the best', () => {
    const s = x01Stats([...lost(1, 301), ...won(2, 301, 15), ...lost(3, 201), ...lost(4, 201), ...lost(5, 201)]);
    expect(s.bestLegs).toEqual([{ startScore: 201, legs: 3, best: null }, { startScore: 301, legs: 2, best: 15 }]);
    expect([s.bestLeg, s.bestLegStart]).toEqual([null, 201]); // no fallback to another start score
  });
});

describe('x01Stats: double table', () => {
  const sum = (s: ReturnType<typeof x01Stats>, key: 'hits' | 'attempts') => s.doubles.reduce((a, r) => a + r[key], 0);

  it('gives each attempt to the double the score asked for, and a hit to the one that closed the leg', () => {
    const s = x01Stats([
      visit({ leg: 1, start: 40, darts: ['D20'], checkout: true }),
      visit({ leg: 2, start: 32, darts: ['S10', 'D11'], checkout: true }), // 32 asks D16 (missed), then 22 asks D11
      visit({ leg: 3, start: 40, darts: ['S20', 'S10', 'D5'], checkout: true }), // D20 missed, 20 asks D10 missed, 10 asks D5
    ]);
    expect(s.doubles).toEqual([
      { double: 20, hits: 1, attempts: 2 },
      { double: 5, hits: 1, attempts: 1 },
      { double: 10, hits: 0, attempts: 1 },
      { double: 11, hits: 1, attempts: 1 },
      { double: 16, hits: 0, attempts: 1 },
    ]);
  });

  it('puts the bull on 25 and sorts by attempts, then by the double', () => {
    const s = x01Stats([
      visit({ leg: 1, start: 50, darts: ['Bull'], checkout: true }),
      visit({ leg: 2, start: 50, darts: ['S25', 'S25'] }), // 50 asks the bull; the 25 left asks no double
    ]);
    expect(s.doubles).toEqual([{ double: 25, hits: 1, attempts: 2 }]);
  });

  it('does not count a dart that missed the score or a bust as a hit', () => {
    const s = x01Stats([
      visit({ leg: 1, start: 20, darts: ['S20'], bust: true }), // asks D10, lands on S20: bust
      visit({ leg: 1, start: 20, darts: ['D10'], checkout: true, no: 2 }),
    ]);
    expect(s.doubles).toEqual([{ double: 10, hits: 1, attempts: 2 }]);
  });

  it('skips single and master out and legs that were not finished', () => {
    const s = x01Stats([
      visit({ leg: 1, start: 20, darts: ['S20'], checkout: true, checkOut: 'single' }),
      visit({ leg: 2, start: 40, darts: ['S1', 'S1', 'S1'], finished: false }),
      visit({ leg: 3, start: 36, darts: ['D18'], checkout: true, checkOut: 'master' }),
    ]);
    expect(s.doubles).toEqual([]);
    expect(s.checkoutAttempts).toBe(2); // Checkout % still sees single and master out
  });

  it('adds up to the checkout attempts of a player who plays double out only', () => {
    const s = x01Stats([
      visit({ leg: 1, start: 130, darts: ['T20', 'T20', 'S10'], no: 1 }),
      visit({ leg: 1, start: 40, darts: ['S20', 'D10'], checkout: true, no: 2 }),
      visit({ leg: 2, start: 50, darts: ['S1', 'S1', 'S1'] }),
      visit({ leg: 2, start: 50, darts: ['Bull'], checkout: true, no: 2 }),
      visit({ leg: 3, start: 24, darts: ['S12', 'D6', 'S1'], bust: true }),
      visit({ leg: 3, start: 24, darts: ['D12'], checkout: true, no: 2 }),
    ]);
    expect(s.doubles.length).toBeGreaterThan(0);
    expect(sum(s, 'attempts')).toBe(s.checkoutAttempts);
    expect(sum(s, 'hits')).toBe(s.checkoutHits);
  });
});
