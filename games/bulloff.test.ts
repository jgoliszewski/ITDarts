import { describe, expect, it } from 'vitest';
import { bullOff } from './bulloff.ts';
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
    // Closest only looks at the distance.
    expect(bullOff([at(2), at(5)], 2, 'closest').winner).toBe(0);
  });

  it('a dart off the board still has a distance; one without coords ranks last', () => {
    expect(bullOff([at(200, { n: 0, m: 1 }), at(120)], 2, 'closest').winner).toBe(1);
    expect(bullOff([{ dart: BULL, at: 0 }, at(120)], 2, 'closest').winner).toBe(1);
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

  it('works the same in minigames', () => {
    const co = { ...cricket.defaults, bullOff: 'pdc' as const };
    const v = cricket.view([{ t: 'bull', ...at(30) }, { t: 'bull', ...at(10) }], 2, co);
    expect(v).toMatchObject({ phase: 'throwing', current: 1 });
  });
});
