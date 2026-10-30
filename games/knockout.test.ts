import { describe, expect, it } from 'vitest';
import { parseDart } from './darts.ts';
import { knockout, roundEndText } from './knockout.ts';
import type { TurnEvent } from './turns.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];
const o = knockout.defaults;
const events = (log: TurnEvent[], players: number) => knockout.happenings(log, players, o).map(h => h.fact.kind === 'game' ? `${h.slot} ${h.fact.event}` : null).filter(Boolean);

describe('knockout', () => {
  it('takes a life from the lowest visit at the end of the round', () => {
    const log = [...visit('S20', 'S20', 'S20'), ...visit('S5', 'S1', 'S1'), ...visit('T20', 'S1', 'S1')];
    const mid = knockout.view(log.slice(0, 8), 3, o);
    expect(mid.lives).toEqual([3, 3, 3]);
    expect(mid.lowest).toBe(7);
    expect(mid.hero.note).toBe('Lowest so far: 7');
    const v = knockout.view(log, 3, o);
    expect(v.lives).toEqual([3, 2, 3]);
    expect(v.roundEnd).toEqual({ losers: [1], out: [], replayed: false });
    expect(events(log, 3)).toEqual(['R1:life:1 lifeLost']);
  });

  it('takes a life from everyone tied on the lowest visit', () => {
    const v = knockout.view([...visit('S10'), ...visit('S10'), ...visit('S20')], 3, o);
    expect(v.lives).toEqual([2, 2, 3]);
    expect(roundEndText(v.roundEnd!, ['Kuba', 'Ola', 'Ada'])).toBe('Kuba, Ola lose a life');
  });

  it('moves the starter on by one each round and skips players who are out', () => {
    // Round 1 starts with player 0, round 2 with player 1.
    let v = knockout.view([...visit('S1'), ...visit('S20'), ...visit('S20')], 3, o);
    expect(v.current).toBe(1);
    v = knockout.view([...visit('S1'), ...visit('S20'), ...visit('S20'), ...visit('S20'), ...visit('S20')], 3, o);
    expect(v.current).toBe(0);
  });

  it('puts a player out with the last life and lets the last one standing win', () => {
    // Player 1 throws lowest three rounds running; with two players that ends the game.
    const round = (lo: number) => (lo === 0 ? [...visit('S1'), ...visit('S20')] : [...visit('S20'), ...visit('S1')]);
    const log = [...round(1), ...round(0), ...round(1)];
    const v = knockout.view(log, 2, o);
    expect(v.lives).toEqual([3, 0]);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
    expect(v.rows[1]).toMatchObject({ meta: 'Out', out: true });
    expect(v.roundEnd).toEqual({ losers: [1], out: [1], replayed: false });
    expect(events(log, 2).slice(-2)).toEqual(['R3:life:1 lifeLost', 'R3:out:1 eliminated']);
  });

  it('does not count a round that would put everyone out', () => {
    // Two players, one life each after two tied rounds; a third tie would put both out.
    const tie = [...visit('S10'), ...visit('S10')];
    let v = knockout.view([...tie, ...tie], 2, o);
    expect(v.lives).toEqual([1, 1]);
    v = knockout.view([...tie, ...tie, ...tie], 2, o);
    expect(v.lives).toEqual([1, 1]);
    expect(v.phase).toBe('throwing');
    expect(roundEndText(v.roundEnd!, ['Kuba', 'Ola'])).toBe('Round replayed: everyone would be out');
  });

  it('puts out every tied player on the last life while someone is left', () => {
    // Players 0 and 1 tie lowest three rounds running; player 2 wins. Visits go in throwing order: 0 1 2, 1 2 0, 2 0 1.
    const r = (a: string, b: string, c: string) => [...visit(a), ...visit(b), ...visit(c)];
    const log = [...r('S1', 'S1', 'S20'), ...r('S1', 'S20', 'S1'), ...r('S20', 'S1', 'S1')];
    const v = knockout.view(log, 3, o);
    expect(v.lives).toEqual([0, 0, 3]);
    expect(v.winners).toEqual([2]);
  });

  it('keeps the finished round on screen until the takeout, then clears the totals', () => {
    const log = [...visit('S20'), d('S1'), d('S1'), d('S1')];
    const open = knockout.view(log, 2, o);
    expect(open.roundTotals).toEqual([20, 3]);
    expect(open.roundEnd?.losers).toEqual([1]);
    const closed = knockout.view([...log, next], 2, o);
    expect(closed.roundTotals).toEqual([null, null]);
    expect(closed.roundEnd?.losers).toEqual([1]);
    expect(knockout.view([...log, next, d('S5')], 2, o).roundEnd).toBeNull();
  });

  it('counts a miss as zero and keeps points and visits for the average', () => {
    const v = knockout.view([...visit('MISS', 'T20', 'S5'), ...visit('S1')], 2, o);
    expect(v.stats).toEqual([{ points: 65, visits: 1 }, { points: 1, visits: 1 }]);
  });

  it('calls each visit total and undoes a lost life with Undo', () => {
    const log = [...visit('S20'), ...visit('S1')];
    expect(knockout.happenings(log, 2, o).filter(h => h.fact.kind === 'calledTotal').map(h => h.fact)).toEqual([
      { kind: 'calledTotal', total: 20 }, { kind: 'calledTotal', total: 1 },
    ]);
    expect(knockout.view([...log, { t: 'undo' }], 2, o).lives).toEqual([3, 3]);
  });
});
