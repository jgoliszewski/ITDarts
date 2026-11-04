// Co-op 121: attempts start with the players in turn (docs/GRY.md#121), from event logs.
import { describe, expect, it } from 'vitest';
import { parseDart } from './darts.ts';
import { oneTwentyOne } from './121.ts';
import type { O121 } from './121.ts';
import type { TurnEvent } from './turns.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];
/** `n` visits that score nothing. */
const misses = (n: number) => Array.from({ length: n }, () => visit()).flat();
const undo: TurnEvent = { t: 'undo' };
const remove = (player: number): TurnEvent => ({ t: 'remove', player, scope: 'match' });
const play = (log: TurnEvent[], players: number, o: Partial<O121> = {}) =>
  oneTwentyOne.view(log, players, { ...oneTwentyOne.defaults, ...o });

describe('co-op 121: who starts an attempt', () => {
  it('alternates the starter with 2 players and 4 visits: A, B, A', () => {
    const o = { visits: 4 as const };
    expect(play(misses(3), 2, o).current).toBe(1);
    expect(play(misses(4), 2, o).current).toBe(1);
    expect(play(misses(5), 2, o).current).toBe(0);
    expect(play(misses(8), 2, o).current).toBe(0);
    // The next visit goes to the player the screen shows.
    expect(play([...misses(4), d('S1')], 2, o).visit.player).toBe(1);
  });

  it('moves the starter on with 3 players and 3 visits: A, B, C, then A', () => {
    expect(play(misses(3), 3).current).toBe(1);
    expect(play(misses(4), 3).current).toBe(2);
    expect(play(misses(6), 3).current).toBe(2);
    expect(play(misses(6), 3, { refill: false }).lives).toBe(1);
  });

  it('gives the next attempt to the next starter after an early checkout', () => {
    // Ann misses, Bob checks out 121 on the attempt's second visit: the next attempt is Bob's to start.
    const v = play([...misses(1), ...visit('T20', 'T17', 'D5')], 3);
    expect(v.target).toBe(122);
    expect(v.current).toBe(1);
  });

  it('skips a removed player as the starter', () => {
    expect(play([...misses(3), remove(1)], 3).current).toBe(2);
  });

  it('follows Undo back across the end of an attempt', () => {
    const o = { visits: 4 as const };
    const log = [...misses(4), d('S1'), undo];
    expect(play(log, 2, o).current).toBe(1);
    // Back into attempt 1: Bob's last visit is open again, then attempt 2 is still his to start.
    expect(play([...log, undo], 2, o).current).toBe(1);
    expect(play([...log, undo, ...misses(1)], 2, o).current).toBe(1);
    expect(play([...log, undo, ...misses(2)], 2, o).current).toBe(0);
  });

  it('starts from the playing order after a bull-off', () => {
    const v = play([{ t: 'start', starter: 1 }, ...misses(4)], 2, { visits: 4, bullOff: 'closest' });
    expect(v.current).toBe(0);
    expect(play([{ t: 'start', starter: 1 }, ...misses(5)], 2, { visits: 4, bullOff: 'closest' }).current).toBe(1);
  });

  it('keeps solo unchanged', () => {
    expect(play(misses(4), 1).current).toBe(0);
  });
});
