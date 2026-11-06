import { describe, expect, it } from 'vitest';
import { callerLines121, oneTwentyOne } from './121.ts';
import { changes } from './effects.ts';
import { cricket } from './cricket.ts';
import { parseDart } from './darts.ts';
import { hol } from './hol.ts';
import { killer } from './killer.ts';
import { atc, atcTargets, fullBoard } from './race.ts';
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

  it('draws a random order from the logged seed, with the bull last', () => {
    const random = { ...o, order: 'random' as const };
    const seed = (n: number): TurnEvent => ({ t: 'seed', seed: n });
    const targets = atc.view([seed(3)], 1, random).targets;
    expect([...targets].slice(0, 20).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(targets[20]).toBe(25);
    expect(atc.view([seed(3)], 1, random).targets).toEqual(targets);
    expect(atc.view([seed(4)], 1, random).targets).not.toEqual(targets);
    expect(targets).not.toEqual(atcTargets(o));
    // Skips go along the drawn order: a treble on the first target moves three targets on.
    const v = atc.view([seed(3), d(`T${targets[0]}`)], 1, random);
    expect(v.targets[v.progress[0]]).toBe(targets[3]);
    expect(atc.describe(random, 1)).toBe('ATC · Any · Random · Skips');
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

  it('counts a co-op attempt and its checkout for everyone who threw in it', () => {
    const log = [
      ...visit('T20'), ...visit('T17', 'D5'), // 121 out together
      ...visit('S1', 'S1', 'S1'), ...visit('S1', 'S1', 'S1'), ...visit('S1', 'S1', 'S1'), // 122 failed together, started by the second player
      ...visit('T20', 'T20', 'D1'), // 122 out by the first player alone, whose turn it is to start
    ];
    expect(oneTwentyOne.view(log, 2, o).stats).toEqual([{ attempts: 3, checkouts: 2 }, { attempts: 2, checkouts: 1 }]);
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

  it('counts the marks of the visit on screen, again after a fix', () => {
    // From a bug report: S2 fixed to T17 on a closed 17 left the turn card unchanged.
    const log = [...visit('T17'), ...visit('S1'), d('S2'), d('S17'), d('S4')];
    const o3 = { ...o, mode: 'cutthroat' as const };
    expect(cricket.view(log, 2, o3).visitMarks).toBe(1);
    expect(cricket.view([...log, { t: 'fix', index: 0, dart: parseDart('T17')! }], 2, o3).visitMarks).toBe(4);
    expect(cricket.view([...log, next], 2, o3).visitMarks).toBe(0);
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
    expect(hol.view([d('S20'), d('S5'), d('S1')], 3, o).visit.verdict).toEqual({ text: 'Life lost', tone: 'bad' });
    expect(hol.view([d('S20'), d('S5'), d('S1')], 3, { ...o, lives: 1 }).visit.verdict).toEqual({ text: 'Out', tone: 'bad' });
    expect(hol.view([d('T20'), d('S5'), d('S1')], 3, o).visit.verdict).toBeNull();
  });

  it('a sum on the edge, inside the range or a miss costs a life and leaves the range as it was', () => {
    for (const log of [visit('S20', 'S5', 'S1'), visit('S20', 'S10', 'S5'), visit('S20', 'S20', 'S5'), [d('T20'), d('Miss'), next]]) { // 26, 35, 45, miss
      const v = hol.view(log, 3, o);
      expect(v.lives).toEqual([2, 3, 3]);
      expect(v.rows[0].out).toBe(false);
      expect([v.lo, v.hi]).toEqual([26, 45]);
      expect(v.current).toBe(1);
    }
    const miss = hol.view([d('T20'), d('Miss')], 3, o);
    expect(miss.visit.dartsLeft).toBe(0);
  });

  it('shows the visit red while its sum is inside the range or it has a miss', () => {
    expect(hol.view([d('S20'), d('S10')], 2, o).failed).toBe(true); // 30
    expect(hol.view([d('S20')], 2, o).failed).toBe(false);
    expect(hol.view([d('T20')], 2, o).failed).toBe(false);
    expect(hol.view([d('S1'), d('Miss')], 2, o).failed).toBe(true);
    expect(hol.view([], 2, o).failed).toBe(false);
  });

  it('holds the life on screen until the takeout, then takes it', () => {
    const held = hol.view([d('S20'), d('S10'), d('S5')], 2, o);
    expect(held.lives).toEqual([3, 3]);
    expect(held.losing).toBe(true);
    const after = hol.view(visit('S20', 'S10', 'S5'), 2, o);
    expect(after.lives).toEqual([2, 3]);
    expect(after.losing).toBe(false);
    expect(hol.view([d('T20'), d('S1'), d('S1')], 2, o).losing).toBe(false);
  });

  it('puts a player out after the last life and fires a life lost each time', () => {
    const fail = visit('S10', 'S10', 'S10');
    const log = [fail, fail, fail, fail, fail].flat(); // Ada and Ola fail in turn: Ada loses her third life first
    const v = hol.view(log, 2, o);
    expect(v.lives).toEqual([0, 1]);
    expect(v.rows[0].out).toBe(true);
    expect(v.winners).toEqual([1]);
    const facts = hol.happenings(log, 2, o).map(h => h.fact);
    expect(facts.filter(f => f.kind === 'game' && f.event === 'lifeLost')).toHaveLength(5);
    expect(facts.filter(f => f.kind === 'game' && f.event === 'eliminated')).toHaveLength(1);
  });
  it('ends the game at once when one player is left, even if he has not thrown this round', () => {
    const v = hol.view([...visit('S10', 'S10', 'S10'), ...visit('S10', 'S10', 'S10')], 3, { ...o, lives: 1 });
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([2]);
    expect(v.points).toEqual([0, 0, 1]);
  });

  it('no longer voids a round where everyone fails', () => {
    const all = hol.view([...visit('S10', 'S10', 'S10'), ...visit('S10', 'S10', 'S10')], 2, o);
    expect(all.lives).toEqual([2, 2]);
    expect([all.lo, all.hi]).toEqual([26, 45]);
    expect(all.current).toBe(0);
    const one = hol.view(visit('S10', 'S10', 'S10'), 2, { ...o, lives: 1 });
    expect(one.phase).toBe('matchWon');
    expect(one.winners).toEqual([1]);
  });

  it('wins the match at first to N and restarts the range and lives for the next game', () => {
    const game = [...visit('T20', 'S1', 'S1'), ...visit('S10', 'S10', 'S10')]; // 62 passes, 30 fails
    const one = { ...o, lives: 1 };
    expect(hol.view(game, 2, one).phase).toBe('matchWon');
    const v = hol.view([...visit('S10', 'S10', 'S10'), ...visit('S10', 'S10', 'S10'), ...game], 2, { ...one, firstTo: 2, lives: 2 }); // both fail, then Ada goes high and Ola fails
    expect(v.points).toEqual([1, 0]);
    expect([v.lo, v.hi]).toEqual([26, 45]);
    expect(v.lives).toEqual([2, 2]);
    expect(v.rows.map(r => r.out)).toEqual([false, false]);
    expect(v.current).toBe(1); // the next game starts with the next player
  });

  it('gives the life back when a fix or an undo turns a failed visit into a good one', () => {
    const fix = (index: number, s: string): TurnEvent => ({ t: 'fix', index, dart: parseDart(s)! });
    const failed = [d('S10'), d('S10'), d('S10')]; // 30, inside 26–45
    expect(hol.view(failed, 2, o).losing).toBe(true);
    const fixed = [...failed, fix(0, 'T20'), next]; // 80
    const v = hol.view(fixed, 2, o);
    expect(v.lives).toEqual([3, 3]);
    expect([v.lo, v.hi]).toEqual([26, 80]);
    const facts = hol.happenings(fixed, 2, o).map(h => h.fact);
    expect(facts.some(f => f.kind === 'game' && (f.event === 'lifeLost' || f.event === 'eliminated'))).toBe(false);
    const undone = hol.view([...failed, next, { t: 'undo' }, { t: 'undo' }, d('T20'), next], 2, o); // reopen, drop the last S10, then T20: 80
    expect(undone.lives).toEqual([3, 3]);
    expect([undone.lo, undone.hi]).toEqual([26, 80]);
  });

  it('takes the last life when a fix turns a good visit into a failed one', () => {
    const one = { ...o, lives: 1 };
    const log = [d('T20'), d('S5'), d('S1'), { t: 'fix', index: 0, dart: parseDart('S20')! } as TurnEvent]; // 66, fixed to 26: the edge
    const v = hol.view(log, 2, one);
    expect(v.lives[0]).toBe(0);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([1]);
    const facts = hol.happenings(log, 2, one).map(h => h.fact);
    expect(facts.some(f => f.kind === 'game' && f.event === 'eliminated')).toBe(true);
  });

  it('reads old logs without lives as 3 lives', () => {
    expect(hol.normalizeOptions({ firstTo: 2, bullOff: 'off' })).toEqual({ firstTo: 2, bullOff: 'off', lives: 3 });
    expect(hol.normalizeOptions({ firstTo: 1, bullOff: 'off', lives: 5 }).lives).toBe(5);
    expect(hol.describe({ firstTo: 2, bullOff: 'off', lives: 1 }, 2)).toBe('Higher or Lower · First to 2 · 1 life');
  });

  it('counts T1 as zero, so a visit can go below the range', () => {
    const v = hol.view(visit('T1', 'T1', 'S5'), 3, o);
    expect([v.lo, v.hi]).toEqual([5, 45]);
    expect(hol.view([d('T1')], 3, o).hero.big).toBe('0');
    expect(hol.view([], 3, o).hero.big).toBe('0');
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
    expect(said([...visit('T20', 'S20', 'S1')])).toEqual(['require_40']);
    expect(said([...visit('T20', 'S20', 'S1'), d('S20'), d('S19')])).toEqual(['busted']);
  });

  it('calls a checkout as its score and the new target at the next visit', () => {
    expect(said([d('T20'), d('T17'), d('D5')])).toEqual(['121']);
    expect(said(visit('T20', 'T17', 'D5'))).toEqual(['require_122']);
  });

  it('calls a fixed visit again', () => {
    expect(said([d('T20'), d('S20'), d('S1'), { t: 'fix', index: 2, dart: parseDart('S5')! }])).toEqual(['85']);
  });
});
