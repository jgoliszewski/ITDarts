// Catch 40 from event logs (docs/GRY.md#catch-40).
import { describe, expect, it } from 'vitest';
import { catch40 as c40, checkoutPoints } from './catch40.ts';
import { label, parseDart } from './darts.ts';
import type { TurnEvent } from './turns.ts';
import { hint } from './x01/checkout.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const undo: TurnEvent = { t: 'undo' };
const end: TurnEvent = { t: 'end' };
const remove = (player: number): TurnEvent => ({ t: 'remove', player, scope: 'match' });
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];
const nothing = () => visit('M', 'M', 'M');
const view = (log: TurnEvent[], players = 1) => c40.view(log, players, c40.defaults);
const facts = (log: TurnEvent[], players = 1) => c40.happenings(log, players, c40.defaults);
const kinds = (log: TurnEvent[], players = 1) => facts(log, players).map(h => (h.fact.kind === 'game' ? h.fact.event : h.fact.kind));
/** One visit that checks out n (2 or 3 darts, always possible from 61 to 100). */
const out = (n: number) => visit(...hint(n, 3, 'double')!.darts.map(x => label(x)));
/** Every target from 61 up to and including `to`, each checked out in one visit. */
const outs = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => out(from + i)).flat();
// 61: T11 + D14 in 2 darts; S20 S1 D20 in 3 darts. 62: T10 + D16.
const TWO = ['T11', 'D14'];
const THREE = ['S20', 'S1', 'D20'];

describe('catch 40: points', () => {
  it('scores 3, 2 and 1 for a checkout in 2, 3 and 4 to 6 darts', () => {
    expect([2, 3, 4, 5, 6].map(checkoutPoints)).toEqual([3, 2, 1, 1, 1]);
    expect(view(visit(...TWO)).points).toEqual([3]);
    expect(view(visit(...THREE)).points).toEqual([2]);
    // 5 darts: a visit of misses, then 2 darts. 6 darts: misses, then 3.
    expect(view([...nothing(), ...visit(...TWO)]).points).toEqual([1]);
    expect(view([...nothing(), ...visit(...THREE)]).points).toEqual([1]);
  });

  it('scores nothing for an attempt that fails in 2 visits and moves on', () => {
    const v = view([...nothing(), ...nothing()]);
    expect(v.points).toEqual([0]);
    expect(v.progress).toEqual([1]);
    expect(v.target).toBe(62);
    expect(v.remaining).toBe(62);
    expect(v.stats[0]).toMatchObject({ attempts: 1, checkouts: 0 });
  });

  it('moves on to the next target after a checkout, with a fresh attempt', () => {
    const v = view([...visit(...TWO), d('S20')]);
    expect(v.target).toBe(62);
    expect(v.remaining).toBe(42);
    expect(v.attemptLeft).toBe(5);
    expect(v.progress).toEqual([1]);
  });

  it('keeps the finished visit on screen until the takeout', () => {
    const v = view([d(TWO[0]), d(TWO[1])]);
    expect(v.target).toBe(61);
    expect(v.remaining).toBe(0);
    expect(v.points).toEqual([3]);
  });

  it('takes a checkout back with Undo and with a fix of its last dart', () => {
    const out2 = [d(TWO[0]), d(TWO[1])];
    const undone = view([...out2, undo]);
    expect(undone).toMatchObject({ points: [0], progress: [0], remaining: 61 - 33, attemptLeft: 5 });
    expect(undone.visit.verdict).toBeNull();
    // D14 fixed to a miss: 28 left, the attempt goes on.
    const fixed = view([...out2, { t: 'fix', index: 1, dart: parseDart('M')! }]);
    expect(fixed).toMatchObject({ points: [0], progress: [0], remaining: 28, attemptLeft: 4 });
    expect(fixed.visit.verdict).toBeNull();
    // Undo after the takeout brings the finished visit back on screen with its card.
    const back = view([...out2, next, undo]);
    expect(back).toMatchObject({ points: [3], progress: [1], remaining: 0, attemptLeft: 0, target: 61 });
    expect(back.visit.verdict).toEqual({ text: '+3', tone: 'good' });
    expect(view([...out2, next])).toMatchObject({ remaining: 62, target: 62, attemptLeft: 6 });
  });

  it('headlines a checkout with the points it gave', () => {
    expect(view([d(TWO[0]), d(TWO[1])]).visit.verdict).toEqual({ text: '+3', tone: 'good' });
    expect(view(visit(...THREE).slice(0, 3)).visit.verdict).toEqual({ text: '+2', tone: 'good' });
    expect(view([...nothing(), d(TWO[0]), d(TWO[1])]).visit.verdict).toEqual({ text: '+1', tone: 'good' });
  });

  it('names the visit of the attempt and the target in the list', () => {
    expect(view([]).hero).toEqual({ big: '61', caption: 'Target 61', note: 'Visit 1 of 2' });
    expect(view(nothing()).hero.note).toBe('Visit 2 of 2');
    // The finished visit is held with its target, in the hero and in the player's row.
    const held = view([d(TWO[0]), d(TWO[1])], 2);
    expect(held.hero.note).toBe('Visit 1 of 2');
    expect(held.rows.map(r => r.meta)).toEqual(['Target 61', 'Target 61']);
    expect(view(visit(...TWO), 2).rows.map(r => r.meta)).toEqual(['Target 62', 'Target 61']);
    const done = view(outs(61, 100));
    expect(done.hero.note).toBe('All 40 targets done');
    expect(done.rows[0].meta).toBe('Finished');
  });
});

describe('catch 40: bust and the second visit', () => {
  it('puts the score back after a bust in the first visit; the attempt goes on', () => {
    // T20 leaves 1: a bust on double out.
    const v = view(visit('T20'));
    expect(v.remaining).toBe(61);
    expect(v.target).toBe(61);
    expect(v.attemptLeft).toBe(3);
    expect(v.progress).toEqual([0]);
    expect(kinds(visit('T20'))).toContain('bust');
    // Darts scored earlier in the visit are taken back too.
    expect(view(visit('S20', 'T20')).remaining).toBe(61);
    // A visit that busts counts as 3 darts: then a 2-dart checkout is 5 darts, 1 point, as after 3 misses.
    const busted = view([...visit('T20'), ...visit(...TWO)]);
    expect(busted.points).toEqual([1]);
    expect(busted.points).toEqual(view([...nothing(), ...visit(...TWO)]).points);
    expect(busted.stats[0]).toMatchObject({ checkouts: 1, checkoutDarts: 5 });
    // The Darts left card counts the same 3 darts.
    expect(view(visit('T20')).attemptLeft).toBe(3);
  });

  it('fails the attempt on a bust in the second visit', () => {
    const log = [...nothing(), ...visit('T20')];
    const v = view(log);
    expect(v.points).toEqual([0]);
    expect(v.target).toBe(62);
    expect(v.remaining).toBe(62);
    expect(kinds(log)).toEqual(expect.arrayContaining(['bust', 'attemptFailed']));
  });

  it('labels a failed attempt on the turn card', () => {
    const v = view([...nothing(), ...visit('M', 'M', 'M').slice(0, 3)]);
    expect(v.visit.verdict).toEqual({ text: 'Attempt failed', tone: 'bad' });
  });

  it('ends the second visit as soon as the darts left cannot check out', () => {
    // 61: S20 = 41, S20 = 21 and one dart left on an odd score.
    const log = [...nothing(), d('S20'), d('S20')];
    const v = view(log);
    expect(v.visit.dartsLeft).toBe(0);
    expect(kinds(log)).toContain('attemptFailed');
    expect(view([...log, next]).target).toBe(62);
    // The same darts in the first visit leave the third dart to throw.
    expect(view([d('S20'), d('S20')]).visit.dartsLeft).toBe(1);
  });

  it('calls the visit total and the checkout', () => {
    expect(facts(visit('S20', 'S5', 'M')).find(h => h.fact.kind === 'calledTotal')?.fact).toEqual({ kind: 'calledTotal', total: 25 });
    expect(kinds(visit(...TWO))).toContain('checkout');
  });
});

describe('catch 40: players', () => {
  it('takes turns, each player on their own target', () => {
    const log = [...visit(...TWO), ...nothing(), d('S20')];
    const v = view(log, 2);
    // Ann checked out 61 and is on 62; Bob is still on 61 with a visit left.
    expect(v.progress).toEqual([1, 0]);
    expect(v.points).toEqual([3, 0]);
    expect(v.current).toBe(0);
    expect(v.target).toBe(62);
    expect(view([...visit(...TWO), ...nothing(), ...visit('S20')], 2).current).toBe(1);
    expect(view([...visit(...TWO), ...nothing(), ...visit('S20')], 2).target).toBe(61);
  });

  it('skips a removed player', () => {
    const v = view([...visit('S20'), remove(1)], 2);
    expect(v.current).toBe(0);
    expect(v.removed).toEqual([null, 'match']);
    expect(v.phase).toBe('throwing');
  });
});

describe('catch 40: the end', () => {
  /** `first`: per player the visits on 61, as many for everyone; then everyone checks out 62 to 100 in one visit each. */
  const full = (first: TurnEvent[][][]) => [
    ...Array.from({ length: first[0].length }, (_, i) => first.flatMap(f => f[i])).flat(),
    ...Array.from({ length: 39 }, (_, i) => first.flatMap(() => out(62 + i))).flat(),
  ];

  it('ends when the only player has played all 40 targets, scoring for the record', () => {
    const log = outs(61, 100);
    const v = view(log);
    expect(v.phase).toBe('matchWon');
    expect(v.progress).toEqual([40]);
    expect(v.winners).toEqual([0]);
    expect(v.scores).toEqual([v.points[0]]);
    expect(v.points[0]).toBeGreaterThanOrEqual(40 * 2);
    expect(kinds(log)).toContain('matchWon');
    expect(view(outs(61, 99)).phase).toBe('throwing');
  });

  it('plays on until every player has finished the 40', () => {
    const half = full([[visit(...TWO)], [visit(...TWO)]]).slice(0, -out(100).length);
    const v = view(half, 2);
    expect(v.phase).toBe('throwing');
    expect(v.progress).toEqual([40, 39]);
    expect(v.current).toBe(1);
  });

  it('gives the win to the most points, then to fewer darts', () => {
    // Ann checks out 61 in 5 darts (1 point), Bob needs 6 darts (also 1 point); the rest is the same.
    const log = full([[nothing(), visit(...TWO)], [nothing(), visit(...THREE)]]);
    const v = view(log, 2);
    expect(v.phase).toBe('matchWon');
    expect(v.points[0]).toBe(v.points[1]);
    expect(v.winners).toEqual([0]);
    expect(v.result).toBe(`${v.points[0]} points`);
  });

  it('gives a full tie to everyone level on points and darts', () => {
    const same = [visit(...TWO)];
    const v = view(full([same, same]), 2);
    expect(v.winners).toEqual([0, 1]);
    expect(v.result).toMatch(/^Shared win/);
    expect(kinds(full([same, same]), 2)).toContain('matchWon');
  });

  it('gives the win to more points even with more darts', () => {
    const v = view(full([[visit(...TWO)], [visit(...THREE)]]), 2);
    expect(v.points[0]).toBeGreaterThan(v.points[1]);
    expect(v.winners).toEqual([0]);
  });

  it('ends on End match with the winner from the points so far', () => {
    const log = [...visit(...TWO), ...nothing(), end];
    const v = view(log, 2);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
    expect(kinds(log, 2)).toContain('matchWon');
    // An early end is no full game: nothing for the record.
    expect(v.scores).toEqual([null, null]);
    expect(view([...log, undo], 2).phase).toBe('throwing');
  });

  it('has no winner on End match with no points', () => {
    const log = [...nothing(), end];
    const v = view(log, 2);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([]);
    expect(kinds(log, 2)).not.toContain('matchWon');
  });

  it('keeps no record from a game ended on the last target either', () => {
    const v = view([...outs(61, 99), end]);
    expect(v.phase).toBe('matchWon');
    expect(v.scores).toEqual([null]);
  });

  it('leaves a removed player out of the winners', () => {
    const both = [...visit(...TWO), ...visit(...TWO), remove(0), end];
    expect(view(both, 2).winners).toEqual([1]);
  });
});

describe('catch 40: stats, record and options', () => {
  it('counts points, attempts, checkouts and darts on checkouts', () => {
    const v = view([...visit(...TWO), ...visit(...THREE).slice(0, 3), ...nothing(), ...nothing()]);
    expect(v.stats[0]).toEqual({ points: 3, attempts: 2, checkouts: 1, checkoutDarts: 2 });
  });

  it('keeps one record: most points, with the best still reachable as the bound', () => {
    const rec = c40.record!;
    expect(rec.variant(c40.defaults, 1)).toEqual(rec.variant(c40.defaults, 5));
    expect(rec.better).toBe('higher');
    expect(rec.bound!(view(visit(...TWO)), 0, c40.defaults)).toBe(3 + 3 * 39);
  });

  it('takes 1 to 8 players and only the bull-off option', () => {
    expect(c40.minPlayers).toBe(1);
    expect(c40.maxPlayers).toBeUndefined();
    expect(c40.options.map(o => o.key)).toEqual(['bullOff']);
    expect(c40.normalizeOptions({ bullOff: 'nope' })).toEqual({ bullOff: 'off' });
  });
});
