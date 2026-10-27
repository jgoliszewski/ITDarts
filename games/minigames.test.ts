import { describe, expect, it } from 'vitest';
import { callerLines121, oneTwentyOne } from './121.ts';
import { changes } from './effects.ts';
import { cricket } from './cricket.ts';
import { parseDart } from './darts.ts';
import { hol } from './hol.ts';
import { killer } from './killer.ts';
import { atc, fullBoard } from './race.ts';
import type { TurnEvent } from './turns.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];

describe('around the clock', () => {
  const o = { ...atc.defaults };

  it('moves on after a hit and skips with doubles and trebles', () => {
    let v = atc.view([d('S1'), d('D2'), d('T4')], 1, o);
    expect(v.targets[v.progress[0]]).toBe(7); // S1 → 2, D2 → 4, T4 → 7
    expect(v.visit.good).toEqual([true, true, true]);
    v = atc.view([d('S1'), d('D2')], 1, { ...o, skips: false });
    expect(v.progress).toEqual([2]);
  });

  it('counts only the ring in Doubles, and only 50 for the bull', () => {
    const doubles = { ...o, target: 'doubles' as const };
    expect(atc.view([d('S1'), d('T1'), d('D1')], 1, doubles).progress).toEqual([1]);
    const events = Array.from({ length: 20 }, (_, i) => visit(`D${i + 1}`)).flat();
    expect(atc.view([...events, d('25')], 1, doubles).phase).toBe('throwing');
    expect(atc.view([...events, d('Bull')], 1, doubles).phase).toBe('matchWon');
  });

  it('follows the clockwise order', () => {
    expect(atc.view([d('S20'), d('S1')], 1, { ...o, order: 'clockwise', skips: false }).progress).toEqual([2]);
  });

  it('never skips past the bull', () => {
    const v = atc.view([...visit('T1', 'T4', 'T7'), ...visit('T10', 'T13', 'T16'), d('T19')], 1, o);
    expect(v.targets[v.progress[0]]).toBe(25);
  });

  it('plays out the round and lets the fewest darts win', () => {
    // Player 0 hits everything with skips; player 1 throws the same and finishes too, in the same number of darts.
    const run = [...visit('T1', 'T4', 'T7'), ...visit('T1', 'T4', 'T7'), ...visit('T10', 'T13', 'T16'), ...visit('T10', 'T13', 'T16'), ...visit('T19', 'S20', '25')];
    const v = atc.view(run, 2, o);
    expect(v.phase).toBe('throwing'); // player 1 still has a visit in this round
    const done = atc.view([...run, d('T19'), d('S20'), d('Bull')], 2, o);
    expect(done.phase).toBe('matchWon');
    expect(done.winners).toEqual([0, 1]);
    expect(done.scores).toEqual([9, 9]);
    const slower = atc.view([...run, d('T19'), d('S1'), d('S20'), next, ...visit()], 2, o);
    expect(slower.phase).toBe('matchWon');
    expect(slower.winners).toEqual([0]);
  });

  it('shares progress in co-op', () => {
    const v = atc.view([...visit('S1', 'S2', 'S3'), d('S4')], 2, { ...o, coop: true });
    expect(v.progress).toEqual([4, 4]);
    expect(v.current).toBe(1);
    expect(v.stats.map(s => s.hits)).toEqual([3, 1]);
  });

  it('undoes and fixes through the log', () => {
    expect(atc.view([d('S1'), { t: 'undo' }], 1, o).progress).toEqual([0]);
    expect(atc.view([d('S5'), { t: 'fix', index: 0, dart: { n: 1, m: 1 } }], 1, o).progress).toEqual([1]);
  });
});

describe('full board', () => {
  it('clears each sector once, in any order', () => {
    const v = fullBoard.view([d('T20'), d('S20'), d('25')], 1, fullBoard.defaults);
    expect(v.cleared[0].sort()).toEqual([20, 25]);
    expect(v.visit.good).toEqual([true, false, true]);
  });

  it('ends when all 21 are cleared', () => {
    const all = [...Array.from({ length: 20 }, (_, i) => `S${i + 1}`), '25'];
    const events = all.map(d);
    const v = fullBoard.view(events.flatMap((e, i) => (i % 3 === 2 ? [e, next] : [e])), 1, fullBoard.defaults);
    expect(v.phase).toBe('matchWon');
    expect(v.scores).toEqual([21]);
  });
});

describe('121', () => {
  const o = oneTwentyOne.defaults;

  it('moves the target up after a checkout and refills lives', () => {
    const v = oneTwentyOne.view([d('T20'), d('T17'), d('D5'), next], 1, o);
    expect(v.target).toBe(122);
    expect(v.remaining).toBe(122);
    expect(v.lives).toBe(3);
    expect(v.attemptLeft).toBe(9);
  });

  it('keeps the finished visit on screen until it is closed', () => {
    const out = oneTwentyOne.view([d('T20'), d('T17'), d('D5')], 1, o);
    expect([out.target, out.remaining, out.attemptLeft, out.checkout]).toEqual([121, 0, 0, null]);
    expect(out.visit.verdict).toEqual({ text: 'Checkout', tone: 'good' });
    const failed = oneTwentyOne.view([...visit('S1'), ...visit('S1'), d('S1')], 1, o);
    expect([failed.target, failed.remaining, failed.lives]).toEqual([121, 118, 3]);
    expect(failed.visit.verdict).toEqual({ text: 'Life lost', tone: 'bad' });
    expect(oneTwentyOne.view([d('S1')], 1, o).visit.verdict).toBeNull();
  });

  it('loses a life after the visits run out and keeps the target', () => {
    const v = oneTwentyOne.view([...visit('S1'), ...visit('S1'), ...visit('S1')], 1, o);
    expect(v.target).toBe(121);
    expect(v.remaining).toBe(121);
    expect(v.lives).toBe(2);
  });

  it('busts back to the start of the visit and the attempt goes on', () => {
    // 41 left after the first visit; S20 S20 would leave 1, which is a bust.
    const v = oneTwentyOne.view([...visit('T20', 'S20'), d('S20'), d('S20')], 1, o);
    expect(v.remaining).toBe(41);
    expect(v.visit.dartsLeft).toBe(0);
    expect(v.visit.verdict).toEqual({ text: 'Bust', tone: 'bad' });
    const b = oneTwentyOne.view([...visit('T20', 'S20'), d('S20'), d('S20'), next], 1, o);
    expect(b.remaining).toBe(41);
    expect(b.attemptLeft).toBe(3);
  });

  it('ends after the last life and records the highest target', () => {
    const fail = Array.from({ length: 9 }, () => visit('S1')).flat();
    const v = oneTwentyOne.view([d('T20'), d('T17'), d('D5'), next, ...fail], 1, { ...o, refill: false });
    expect(v.phase).toBe('matchWon');
    expect(v.scores).toEqual([121]);
  });

  it('ends the last visit once the darts left cannot check out', () => {
    const log = [...visit('S20', 'S20', 'S20'), ...visit('S20', 'S20', 'S1'), d('D5')];
    expect(oneTwentyOne.view(log, 1, o).visit.dartsLeft).toBe(2);
    // 5 left with one dart: no double finishes an odd score.
    const v = oneTwentyOne.view([...log, d('S5')], 1, o);
    expect([v.remaining, v.visit.dartsLeft, v.visit.verdict?.text]).toEqual([5, 0, 'Life lost']);
    expect(oneTwentyOne.view([...log, d('S5'), next], 1, o).lives).toBe(2);
  });

  it('ends the hopeless last visit from the bug report (co-op, 4 visits)', () => {
    const log = [...visit('D20', 'S19', 'S15'), ...visit('S7', 'S1', 'S8'), ...visit('S15', 'MISS', 'MISS'), d('MISS'), d('S11')];
    const v = oneTwentyOne.view(log, 2, { ...o, visits: 4 });
    expect([v.remaining, v.visit.dartsLeft, v.visit.verdict?.text]).toEqual([5, 0, 'Life lost']);
  });

  it('plays co-op with two players on one attempt', () => {
    const v = oneTwentyOne.view([...visit('T20'), d('T17')], 2, o);
    expect(v.current).toBe(1);
    expect(v.remaining).toBe(10);
  });
});

describe('cricket', () => {
  const o = cricket.defaults;

  it('marks, closes and scores on open sectors', () => {
    const v = cricket.view([d('S20'), d('T20')], 2, o);
    expect(v.marks[0][0]).toBe(3);
    expect(v.points[0]).toBe(20);
  });

  it('scores nothing on a sector everyone closed', () => {
    const v = cricket.view([...visit('T20'), ...visit('T20'), d('T20')], 2, o);
    expect(v.points).toEqual([0, 0]);
    expect(v.dead[0]).toBe(true);
  });

  it('gives points to open rivals in cut-throat', () => {
    const v = cricket.view([d('T20'), d('S20')], 3, { ...o, mode: 'cutthroat' });
    expect(v.points).toEqual([0, 20, 20]);
  });

  it('wins by closing everything when not behind', () => {
    const close = visit('T20', 'T19', 'T18').concat(visit('S1'), visit('T17', 'T16', 'T15'), visit('S1'));
    const v = cricket.view([...close, d('Bull'), d('25')], 2, o);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
  });

  it('counts darts in solo', () => {
    const v = cricket.view([...visit('T20', 'T19', 'T18'), ...visit('T17', 'T16', 'T15'), d('Bull'), d('25')], 1, o);
    expect(v.phase).toBe('matchWon');
    expect(v.scores).toEqual([8]);
  });
});

describe('killer', () => {
  const o = killer.defaults;
  const numbers: TurnEvent = { t: 'numbers', numbers: [5, 9, 13] };

  it('needs your own double to become a killer', () => {
    const v = killer.view([numbers, d('D9'), d('D5'), d('D9')], 3, o);
    expect(v.killer).toEqual([true, false, false]);
    expect(v.lives).toEqual([3, 2, 3]);
    expect(v.visit.good).toEqual([false, true, true]);
  });

  it('a killer on their own double loses a life', () => {
    expect(killer.view([numbers, d('D5'), d('D5')], 3, o).lives).toEqual([2, 3, 3]);
  });

  it('eliminates at once and skips the dead', () => {
    const v = killer.view([numbers, d('D5'), d('D9'), next], 3, { ...o, lives: 1 });
    expect(v.rows[1].out).toBe(true);
    expect(v.current).toBe(2);
  });

  it('the last one standing wins', () => {
    const v = killer.view([numbers, d('D5'), d('D9'), d('D13')], 3, { ...o, lives: 1 });
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
  });

  it('allows a reroll only before the first dart', () => {
    expect(killer.view([numbers, { t: 'numbers', numbers: [1, 2, 3] }], 3, o).numbers).toEqual([1, 2, 3]);
    expect(killer.view([numbers, d('S1'), { t: 'numbers', numbers: [1, 2, 3] }], 3, o).numbers).toEqual([5, 9, 13]);
  });
});

describe('higher or lower', () => {
  const o = hol.defaults;

  it('widens the range on a success', () => {
    let v = hol.view(visit('S20', 'S20', 'S20'), 3, o);
    expect([v.lo, v.hi]).toEqual([26, 60]);
    v = hol.view([...visit('S20', 'S20', 'S20'), ...visit('S5', 'S5', 'S5')], 3, o);
    expect([v.lo, v.hi]).toEqual([15, 60]);
  });

  it('keeps the old range until the visit is closed', () => {
    const v = hol.view([d('S20'), d('S20'), d('S20')], 3, o);
    expect([v.lo, v.hi, v.sum]).toEqual([26, 45, 60]);
    expect(v.visit.verdict).toBeNull();
    expect(hol.view([d('S20'), d('S5'), d('S1')], 3, o).visit.verdict).toEqual({ text: 'Out', tone: 'bad' });
  });

  it('a sum on the edge or a miss fails the visit', () => {
    expect(hol.view(visit('S20', 'S5', 'S1'), 3, o).rows[0].out).toBe(true); // 26
    const miss = hol.view([d('T20'), d('Miss')], 3, o);
    expect(miss.rows[0].out).toBe(true);
    expect(miss.visit.dartsLeft).toBe(0);
  });

  it('voids a round where everyone fails', () => {
    const all = hol.view([...visit('S10', 'S10', 'S10'), ...visit('S10', 'S10', 'S10')], 2, o);
    expect(all.rows.map(r => r.out)).toEqual([false, false]);
    expect([all.lo, all.hi]).toEqual([26, 45]);
  });

  it('wins the match at first to N and restarts the range for the next game', () => {
    const game = [...visit('T20', 'S1', 'S1'), ...visit('S10', 'S10', 'S10')]; // 62 passes, 30 fails
    expect(hol.view(game, 2, o).phase).toBe('matchWon');
    const v = hol.view(game, 2, { ...o, firstTo: 2 });
    expect(v.points).toEqual([1, 0]);
    expect([v.lo, v.hi]).toEqual([26, 45]);
    expect(v.current).toBe(1); // the next game starts with the next player
  });
});

describe('121 caller', () => {
  const o = { ...oneTwentyOne.defaults };
  const said = (log: TurnEvent[]) => {
    const last = log.at(-1)!;
    const cause = last.t === 'fix' ? 'fix' : last.t === 'undo' ? 'undo' : 'other';
    const cs = changes(oneTwentyOne.happenings(log.slice(0, -1), 1, o), oneTwentyOne.happenings(log, 1, o), cause);
    return callerLines121(cs, oneTwentyOne.view(log, 1, o), last.t === 'next' || last.t === 'start');
  };

  it('calls the visit, no score on a bust, and you require at the next visit', () => {
    expect(said([d('T20'), d('S20'), d('S1')])).toEqual(['81']);
    expect(said([...visit('T20', 'S20', 'S1')])).toEqual(['you_require', '40']);
    expect(said([...visit('T20', 'S20', 'S1'), d('S20'), d('S19')])).toEqual(['busted']);
  });

  it('calls a checkout as its score and the new target at the next visit', () => {
    expect(said([d('T20'), d('T17'), d('D5')])).toEqual(['121']);
    expect(said(visit('T20', 'T17', 'D5'))).toEqual(['you_require', '122']);
  });

  it('calls a fixed visit again', () => {
    expect(said([d('T20'), d('S20'), d('S1'), { t: 'fix', index: 2, dart: parseDart('S5')! }])).toEqual(['85']);
  });
});
