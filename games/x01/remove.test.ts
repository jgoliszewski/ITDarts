// Wycofanie gracza in X01 (docs/UI.md#wycofanie-gracza): out of the match, or out of one leg.
import { describe, expect, it } from 'vitest';
import { parseDart } from '../darts.ts';
import type { X01Event, X01Options } from './index.ts';
import { compact, replay, view } from './index.ts';
import { removeBlock } from '../turns.ts';

const opts = (o: Partial<X01Options> = {}): X01Options => ({
  startScore: 101, checkIn: 'straight', checkOut: 'double', matchMode: { kind: 'legs', firstTo: 3 }, bullOff: 'off', ...o,
});
let clock = 0;
const d = (s: string): X01Event => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: X01Event = { t: 'next', at: 0 };
const visit = (...s: string[]): X01Event[] => [...s.map(d), next];
const out = (player: number, scope: 'match' | 'leg' = 'match'): X01Event => ({ t: 'remove', player, scope });
const undo: X01Event = { t: 'undo' };
const run = (events: X01Event[], players = 3, o = opts()) => view(replay(events, players, o), players, o);
/** A leg won by `winner` checking out 101 in one visit after the others before him miss. */
const checkout = ['T20', 'S1', 'D20'];

describe('removed from the match', () => {
  it('skips the player for the rest of the match, also in the next leg and in the starter rotation', () => {
    // Leg 1 starts with Kuba (0); Ola (1) leaves; Kuba wins. Leg 2 would start with Ola: Ada starts instead.
    const leg1 = [...visit('M'), out(1), ...visit('S1'), ...checkout.map(d)];
    let v = run(leg1);
    expect(v.removed).toEqual([null, 'match', null]);
    expect(v.phase).toBe('legWon');
    v = run([...leg1, next]);
    expect(v.legNo).toBe(2);
    expect(v.current).toBe(2);
    expect(v.removed).toEqual([null, 'match', null]);
    // Leg 3 goes on from Ada: Kuba starts, not Ada again.
    v = run([...leg1, next, ...checkout.map(d), next]);
    expect(v.current).toBe(0);
  });

  it('ends the visit of the player removed while throwing and goes to the next', () => {
    const v = run([d('T20'), out(0)]);
    expect(v.current).toBe(1);
    expect(v.visit.darts).toEqual([]);
    expect(v.scores).toEqual([41, 101, 101]);
  });

  it('keeps the darts he threw in the match for statistics', () => {
    const o = opts();
    const legs = compact(replay([d('T20'), out(0), ...visit('S1')], 3, o), 3, o);
    expect(legs[0].visits.map(x => [x.player, x.scored])).toEqual([[0, 60], [1, 1]]);
  });

  it('counts only the darts he threw: no misses filled in, so T20 is a 180 average', () => {
    const o = opts();
    const raw = replay([d('T20'), out(0)], 3, o);
    expect(compact(raw, 3, o)[0].visits[0].dartsCount).toBe(1);
    expect(compact(raw, 3, o)[0].visits[0].darts).toHaveLength(1);
    expect(view(raw, 3, o).stats[0].matchAvg).toBe(180);
  });

  it('counts the darts thrown before a bust too, when he is removed after it', () => {
    const o = opts({ startScore: 50 });
    expect(compact(replay([d('T20'), out(0)], 3, o), 3, o)[0].visits[0].dartsCount).toBe(1);
  });
});

describe('removed from the leg', () => {
  it('sits out the rest of the leg and comes back in the next one, where he may start', () => {
    // Kuba starts leg 1; Ola sits it out; Ada wins. Leg 2 starts with Ola as the rotation says.
    const leg1 = [out(1, 'leg'), ...visit('S1'), ...checkout.map(d)];
    let v = run(leg1);
    expect(v.removed).toEqual([null, 'leg', null]);
    expect(v.legs).toEqual([0, 0, 1]);
    v = run([...leg1, next]);
    expect(v.removed).toEqual([null, null, null]);
    expect(v.current).toBe(1);
  });

  it('can still remove from the match a player who sits out the leg', () => {
    const v = run([...visit('M'), out(1, 'leg'), out(1)], 4);
    expect(v.removed).toEqual([null, 'match', null, null]);
    expect(run([...visit('M'), out(1, 'leg'), out(1), undo], 4).removed).toEqual([null, 'leg', null, null]);
  });

  it('skips a removed starter in his leg', () => {
    const v = run([out(0, 'leg')]);
    expect(v.current).toBe(1);
  });
});

describe('undo', () => {
  it('takes back a removal when it is the last thing done, reopening the visit it ended', () => {
    const v = run([d('T20'), out(0), undo]);
    expect(v.removed).toEqual([null, null, null]);
    expect(v.current).toBe(0);
    expect(v.visit.darts).toHaveLength(1);
    expect(v.visit.dartsLeft).toBe(2);
  });

  it('undoes the darts after it first', () => {
    const log = [...visit('S1'), out(1, 'leg'), d('S1')];
    expect(run([...log, undo]).removed).toEqual([null, 'leg', null]);
    expect(run([...log, undo, undo]).removed).toEqual([null, null, null]);
  });
});

describe('when the Pilot may remove a player', () => {
  it('counts those out of the leg for a removal from the leg, and from the match', () => {
    const v = run([out(1, 'leg')]);
    expect(removeBlock('x01', v, 2, 'leg')).toMatch(/End match/);
    // Out of the match would leave only Kuba in this leg too.
    expect(removeBlock('x01', v, 2, 'match')).toMatch(/End match/);
    expect(removeBlock('x01', run([out(1, 'leg')], 4), 2, 'match')).toBeNull();
  });

  it('allows leaving the match between legs, but not the leg', () => {
    const won = run([...['T20', 'S1', 'D20'].map(d)]);
    expect(won.phase).toBe('legWon');
    expect(removeBlock('x01', won, 1, 'match')).toBeNull();
    expect(removeBlock('x01', won, 1, 'leg')).toMatch(/over/);
  });
});
