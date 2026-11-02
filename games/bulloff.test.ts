import { describe, expect, it } from 'vitest';
import { TIE_MM, bullOff, standings } from './bulloff.ts';
import type { Dart } from './darts.ts';
import { cricket } from './cricket.ts';
import { view, replay } from './x01/engine.ts';
import type { X01Event } from './x01/engine.ts';
import { DEFAULT_OPTIONS } from './x01/rules.ts';

const BULL: Dart = { n: 25, m: 2 }, OUTER: Dart = { n: 25, m: 1 }, S20: Dart = { n: 20, m: 1 };
/** A dart `mm` millimetres from the centre. */
const at = (mm: number, dart: Dart = mm < 6.35 ? BULL : mm < 15.9 ? OUTER : S20) => ({ dart, coords: { x: 0, y: mm / 170 }, at: 0 });

describe('bull-off', () => {
  it('closest to the centre starts', () => {
    const b = bullOff([at(12), at(4), at(30)], 3, 'closest');
    expect(b.winner).toBe(1);
    expect(b.throws.map(t => Math.round(t.mm!))).toEqual([12, 4, 30]);
  });

  it('waits for everyone and says who throws next', () => {
    expect(bullOff([at(12)], 3, 'closest')).toMatchObject({ winner: null, next: 1 });
  });

  it('PDC: the same bull is a tie, thrown again in reverse order', () => {
    const b = bullOff([at(2), at(5), at(40)], 3, 'pdc');
    expect(b).toMatchObject({ winner: null, round: 1, contenders: [1, 0], next: 1 });
    expect(bullOff([at(2), at(5), at(40), at(20), at(9)], 3, 'pdc').winner).toBe(0);
    // Closest only looks at the distance: a bull and a 25 more than 5 mm apart.
    expect(bullOff([at(2), at(8)], 2, 'closest').winner).toBe(0);
  });

  it('a dart off the board still has a distance; one without coords ranks last', () => {
    expect(bullOff([at(200, { n: 0, m: 1 }), at(120)], 2, 'closest').winner).toBe(1);
    expect(bullOff([{ dart: BULL, at: 0 }, at(120)], 2, 'closest').winner).toBe(1);
  });

  it(`closest: under ${TIE_MM} mm from the leader is a tie, ${TIE_MM} mm is not`, () => {
    expect(bullOff([at(4), at(8.9)], 2, 'closest')).toMatchObject({ winner: null, round: 1, contenders: [1, 0], next: 1 });
    expect(bullOff([at(4), at(9)], 2, 'closest')).toMatchObject({ winner: 0, order: [0, 1] });
  });

  it('closest: everyone under the threshold from the leader throws again, the rest are out', () => {
    // 10, 12 and 11 are all within 5 mm of 10; 50 is not.
    const b = bullOff([at(10), at(12), at(11), at(50)], 4, 'closest');
    expect(b).toMatchObject({ winner: null, round: 1, contenders: [2, 1, 0], next: 2, order: null });
  });

  it('PDC has no threshold: two singles 1.5 mm apart are no tie', () => {
    expect(bullOff([at(16.5), at(18)], 2, 'pdc')).toMatchObject({ winner: 0, order: [0, 1] });
  });

  it('playing order: winner, then the tie-break players, then the rest by their first dart', () => {
    // A and C tie (2 mm), C wins the rethrow: C, A, then D (30) and B (60).
    const b = bullOff([at(10), at(60), at(8), at(30), at(3), at(15)], 4, 'closest');
    expect(b).toMatchObject({ winner: 2, order: [2, 0, 3, 1] });
  });

  it('playing order: a later round ranks higher, whatever the distance', () => {
    // Round 1: A, B, C tie. Round 2 (C, B, A): C and B tie, A out at 40. Round 3 (B, C): B wins, C at 45 mm still ranks above A at 40.
    const b = bullOff([at(10), at(12), at(11), at(50), at(20), at(22), at(40), at(5), at(45)], 4, 'closest');
    expect(b).toMatchObject({ round: 2, winner: 1, order: [1, 2, 0, 3] });
  });

  it('playing order: places after the first are not thrown again; equal distance keeps the setup order', () => {
    // B and D both 30 mm, C 31 mm: close, but only the lead is decided by a rethrow.
    expect(bullOff([at(4), at(30), at(31), at(30)], 4, 'closest').order).toEqual([0, 1, 3, 2]);
  });

  it('playing order: a dart without coords comes after every dart with coords', () => {
    expect(bullOff([{ dart: BULL, at: 0 }, at(50), at(10)], 3, 'closest').order).toEqual([2, 1, 0]);
  });

  it('standings put players with no dart yet last', () => {
    expect(standings([{ ...at(10), player: 3, round: 0, mm: 10 }], 4)).toEqual([3, 0, 1, 2]);
  });
});

describe('bull-off in the log', () => {
  const o = { ...DEFAULT_OPTIONS, bullOff: 'closest' as const };
  const bull = (mm: number): X01Event => ({ t: 'bull', ...at(mm) });
  const run = (events: X01Event[]) => view(replay(events, 2, o), 2, o);

  it('starts the match with the winner, and undo reopens it', () => {
    expect(run([bull(20)]).phase).toBe('bulloff');
    const v = run([bull(20), bull(3)]);
    expect(v).toMatchObject({ phase: 'throwing', current: 1 });
    expect(run([bull(20), bull(3), { t: 'undo' }])).toMatchObject({ phase: 'bulloff', bullOff: { next: 1 } });
  });

  it('a pick on the pilot overrides, and its undo keeps the darts', () => {
    const v = run([bull(20), { t: 'start', starter: 1 }, { t: 'undo' }]);
    expect(v).toMatchObject({ phase: 'bulloff', bullOff: { next: 1 } });
  });

  it('plays in the bull-off order, and the next leg starts with the second player in it', () => {
    const o4 = { ...o, startScore: 40 };
    const events: X01Event[] = [bull(10), bull(60), bull(8), bull(30), bull(3), bull(15)];
    const at = (extra: X01Event[]) => view(replay([...events, ...extra], 4, o4), 4, o4);
    const next: X01Event = { t: 'next', at: 0 };
    const miss: X01Event[] = [{ t: 'dart', dart: { n: 0, m: 1 }, at: 0 }, next];
    expect(at([]).current).toBe(2);
    const turns = [0, 1, 2, 3, 4].map(k => at(miss.concat(...Array(k).fill(miss))).current);
    expect(turns).toEqual([0, 3, 1, 2, 0]);
    // C checks out; the next leg starts with A, second in the playing order.
    const leg2 = at([{ t: 'dart', dart: { n: 20, m: 2 }, at: 0 }, next]);
    expect(leg2).toMatchObject({ phase: 'throwing', legNo: 2, current: 0, order: [2, 0, 3, 1] });
    expect(replay([...events, { t: 'dart', dart: { n: 20, m: 2 }, at: 0 }, next], 4, o4).legs.map(l => l.starter)).toEqual([2, 0]);
  });

  it('a pick on the pilot starts with that player, then the setup order', () => {
    expect(view(replay([bull(20), { t: 'start', starter: 2 }], 4, o), 4, o).order).toEqual([2, 3, 0, 1]);
  });

  it('works the same in minigames', () => {
    const co = { ...cricket.defaults, bullOff: 'pdc' as const };
    const v = cricket.view([{ t: 'bull', ...at(30) }, { t: 'bull', ...at(10) }], 2, co);
    expect(v).toMatchObject({ phase: 'throwing', current: 1 });
  });

  it('minigames play in the bull-off order too', () => {
    const co = { ...cricket.defaults, bullOff: 'closest' as const };
    const events = [10, 60, 8, 30, 3, 15].map(mm => ({ t: 'bull' as const, ...at(mm) }));
    const next = { t: 'next' as const };
    const current = (k: number) => cricket.view([...events, ...Array(k).fill(next)], 4, co).current;
    expect([0, 1, 2, 3, 4].map(current)).toEqual([2, 0, 3, 1, 2]);
    expect(cricket.view(events, 4, co).order).toEqual([2, 0, 3, 1]);
  });
});
