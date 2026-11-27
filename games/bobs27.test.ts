// Bob's 27 from event logs (docs/GRY.md#bobs-27).
import { describe, expect, it } from 'vitest';
import { bobs27 as b27, doubleValue, roundName } from './bobs27.ts';
import { parseDart } from './darts.ts';
import { dartCue } from './turns.ts';
import type { TurnEvent } from './turns.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const undo: TurnEvent = { t: 'undo' };
const end: TurnEvent = { t: 'end' };
const remove = (player: number): TurnEvent => ({ t: 'remove', player, scope: 'match' });
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];
const blank = () => visit('M', 'M', 'M');
const view = (log: TurnEvent[], players = 1) => b27.view(log, players, b27.defaults);
const facts = (log: TurnEvent[], players = 1) => b27.happenings(log, players, b27.defaults);
const kinds = (log: TurnEvent[], players = 1) => facts(log, players).map(h => (h.fact.kind === 'game' ? h.fact.event : h.fact.kind));
/** The target of round r as a dart: its double, the bullseye in round 21. */
const dbl = (r: number) => (r === 21 ? 'Bull' : `D${r}`);
/** One visit with a single hit on the round's double. */
const hit = (r: number) => visit(dbl(r), 'M', 'M');
/** Rounds from..to for one player, one hit each: +2r per round, +50 in the bull round. */
const hits = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => hit(from + i)).flat();
/** Round r missed by everyone in the lineup. */
const blanks = (n: number) => Array.from({ length: n }, blank).flat();
/** Score after rounds 1..to with one hit each, from 27. */
const after = (to: number) => 27 + Array.from({ length: to }, (_, i) => doubleValue(i + 1)).reduce((a, b) => a + b, 0);

describe("bob's 27: points", () => {
  it('starts on 27 in round 1 on D1', () => {
    const v = view([]);
    expect(v.points).toEqual([27]);
    expect(v.hero.big).toBe('27');
    expect(v.hero.caption).toBe('Round 1 / 21 · D1');
    expect(v.sector).toBe(1);
    expect(v.round).toBe(1);
  });

  it('lists every player with the round they are on, a finished one as Finished', () => {
    const v = view([...hit(1), d('D2')], 2);
    expect(v.rows.map(r => r.meta)).toEqual(['Round 2 · D2', 'Round 1 · D1']);
    expect(view(hits(1, 21)).rows[0].meta).toBe('Finished');
  });

  it('adds the value of the double for every dart that hits it', () => {
    expect(view([d('D1')]).points).toEqual([29]);
    const v = view([d('D1'), d('D1'), d('D1')]);
    expect(v.points).toEqual([33]);
    expect(v.visit.good).toEqual([true, true, true]);
    expect(v.hero.note).toBe('+6 this visit');
    // Round 5 is worth 10 a dart.
    const r5 = view([...hits(1, 4), d('D5'), d('D5')]);
    expect(r5.points).toEqual([after(4) + 20]);
    expect(r5.hero.caption).toBe('Round 5 / 21 · D5');
    expect(r5.sector).toBe(5);
  });

  it('counts singles, trebles, other doubles and misses as no hit', () => {
    const v = view([d('S1'), d('T1')]);
    expect(v.visit.good).toEqual([false, false]);
    expect(v.points).toEqual([27]);
    expect(v.hero.note).toBe('');
  });

  it('takes the value of the double once for a visit with no hit', () => {
    const v = view(blank());
    expect(v.points).toEqual([25]);
    expect(v.round).toBe(2);
    // Round 3 costs 6 whatever the darts did.
    expect(view([...blank(), ...blank(), ...visit('S3', 'T3', 'D4')]).points).toEqual([27 - 2 - 4 - 6]);
  });

  it('applies the penalty when the third dart lands, and shows it with the visit', () => {
    const v = view([d('M'), d('S1'), d('D2')]);
    expect(v.points).toEqual([25]);
    expect(v.hero.note).toBe('−2 · missed visit');
    expect(v.visit.verdict).toEqual({ text: '−2', tone: 'bad' });
    // Still round 1 on screen until the takeout, then round 2.
    expect(v.round).toBe(1);
    expect(view(visit('M', 'M', 'M')).round).toBe(2);
  });

  it('puts a gain on the visit card too', () => {
    const v = view([d('D1'), d('M'), d('D1')]);
    expect(v.visit.verdict).toEqual({ text: '+4', tone: 'good' });
    expect(view([d('D1'), d('M')]).visit.verdict).toBeNull();
  });

  it('does not take the penalty back for a visit that had a hit', () => {
    expect(view(hit(1)).points).toEqual([29]);
    // The third dart hits after two misses.
    expect(view(visit('M', 'M', 'D1')).points).toEqual([29]);
  });

  it('treats darts missing when the visit is closed as misses', () => {
    // Takeout after one miss: two more misses, penalty.
    const v = view([d('S5'), next]);
    expect(v.points).toEqual([25]);
    expect(v.stats[0]).toMatchObject({ darts: 3, hits: 0 });
    // Takeout after a hit: no penalty, the missing darts only count as thrown.
    const h = view([d('D1'), next]);
    expect(h.points).toEqual([29]);
    expect(h.stats[0]).toMatchObject({ darts: 3, hits: 1 });
  });

  it('does not apply the penalty before the visit is complete', () => {
    const v = view([d('M'), d('M')]);
    expect(v.points).toEqual([27]);
    expect(v.round).toBe(1);
    expect(v.visit.dartsLeft).toBe(1);
  });
});

describe("bob's 27: the bull round", () => {
  it('targets the bull in round 21, worth 50', () => {
    const v = view(hits(1, 20));
    expect(v.round).toBe(21);
    expect(v.sector).toBe(25);
    expect(v.hero.caption).toBe('Round 21 / 21 · Bull');
    expect(v.points).toEqual([after(20)]);
    expect(view([...hits(1, 20), d('Bull'), d('Bull')]).points).toEqual([after(20) + 100]);
  });

  it('does not count the outer bull, and a visit with only that costs 50', () => {
    const v = view([...hits(1, 20), d('25'), d('25'), d('25')]);
    expect(v.visit.good).toEqual([false, false, false]);
    expect(v.points).toEqual([after(20) - 50]);
    expect(v.hero.note).toBe('−50 · missed visit');
  });

  it('counts the bullseye as no hit in the rounds before', () => {
    expect(view([d('Bull'), d('Bull'), d('Bull')]).points).toEqual([25]);
    expect(doubleValue(21)).toBe(50);
    expect(roundName(21)).toBe('Bull');
    expect(roundName(20)).toBe('D20');
  });
});

describe("bob's 27: elimination", () => {
  /** Rounds 1 to 4 missed take 20 points, leaving 7; round 5 costs 10. */
  const out5 = blanks(5);

  it('puts a player out when a visit leaves 0 or less', () => {
    const v = view(out5);
    expect(v.points).toEqual([-3]);
    expect(v.eliminated).toEqual([true]);
    expect(v.outAt).toEqual([5]);
    expect(v.rows[0]).toMatchObject({ value: '−3', meta: 'Out at D5', out: true });
    expect(kinds(out5)).toContain('eliminated');
    expect(view(blanks(4)).eliminated).toEqual([false]);
    expect(view(blanks(4)).points).toEqual([7]);
  });

  it('waits for the visit to close: a hit on the last dart saves the player', () => {
    expect(view([...blanks(4), d('M'), d('M'), d('D5')]).eliminated).toEqual([false]);
    expect(view([...blanks(4), d('M'), d('M'), d('M')]).eliminated).toEqual([true]);
    expect(view([...blanks(4), d('M'), d('M')]).eliminated).toEqual([false]);
  });

  it('shows Out on the visit card with the penalty on the hero', () => {
    const v = view(blanks(4).concat([d('M'), d('M'), d('M')]));
    expect(v.visit.verdict).toEqual({ text: 'Out', tone: 'bad' });
    expect(v.hero.note).toBe('−10 · missed visit');
    expect(v.round).toBe(5);
  });

  it('has Undo bring the player back, and a fix of the last dart too', () => {
    const log = [...blanks(4), d('M'), d('M'), d('M')];
    expect(view([...log, undo]).eliminated).toEqual([false]);
    expect(view([...log, undo]).phase).toBe('throwing');
    const fixed = view([...log, { t: 'fix', index: 2, dart: parseDart('D5')! }]);
    expect(fixed.eliminated).toEqual([false]);
    expect(fixed.points).toEqual([17]);
    expect(fixed.phase).toBe('throwing');
  });

  it('skips an eliminated player in the turns and goes on with the rest', () => {
    // Ann (0) misses everything and goes out at D5, Bob (1) and Cy (2) hit.
    let log: TurnEvent[] = [];
    for (let r = 1; r <= 5; r++) log = [...log, ...(r <= 5 ? blank() : []), ...hit(r), ...hit(r)];
    const v = view(log, 3);
    expect(v.eliminated).toEqual([true, false, false]);
    expect(v.phase).toBe('throwing');
    expect(v.current).toBe(1);
    expect(v.round).toBe(6);
    // After Bob and Cy it is Bob again, not Ann.
    expect(view([...log, ...hit(6)], 3).current).toBe(2);
    expect(view([...log, ...hit(6), ...hit(6)], 3).current).toBe(1);
  });
});

describe("bob's 27: the end and the ranking", () => {
  it('ends a solo game that finished the bull round as a win and a record score', () => {
    const log = hits(1, 21);
    const v = view(log);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
    expect(v.points).toEqual([after(21)]);
    expect(v.scores).toEqual([after(21)]);
    expect(v.result).toBe(`${after(21)} points`);
    expect(kinds(log)).toContain('matchWon');
    expect(view(hits(1, 20)).phase).toBe('throwing');
  });

  it('can finish on the bull round with the lowest scores too', () => {
    const v = view([...hits(1, 20), ...visit('M', 'M', 'M')]);
    expect(v.phase).toBe('matchWon');
    expect(v.points).toEqual([after(20) - 50]);
    expect(v.winners).toEqual([0]);
  });

  it('ends a solo game that went out with no winner and no record', () => {
    const log = blanks(5);
    const v = view(log);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([]);
    expect(v.scores).toEqual([null]);
    expect(v.result).toBe('Out at D5');
    expect(kinds(log)).not.toContain('matchWon');
  });

  it('plays on until everyone has finished or is out', () => {
    // Bob (1) goes out at D5; Ann (0) plays on alone to the bull.
    let log: TurnEvent[] = [];
    for (let r = 1; r <= 5; r++) log = [...log, ...hit(r), ...blank()];
    expect(view(log, 2).eliminated).toEqual([false, true]);
    expect(view(log, 2).phase).toBe('throwing');
    log = [...log, ...hits(6, 20)];
    expect(view(log, 2).phase).toBe('throwing');
    const done = [...log, ...hit(21)];
    const v = view(done, 2);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
    // Only the finisher scores for the record.
    expect(v.scores).toEqual([after(21), null]);
  });

  /** Two players: `a` and `b` give each round's darts of a player. */
  const duel = (a: (r: number) => TurnEvent[], b: (r: number) => TurnEvent[], rounds: number) =>
    Array.from({ length: rounds }, (_, i) => [...a(i + 1), ...b(i + 1)]).flat();
  const hit3 = (r: number) => visit(dbl(r), dbl(r), dbl(r));

  it('puts finishers first, the higher score on top', () => {
    const v = view(duel(hit3, hit, 21), 2);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
    expect(v.points[0]).toBeGreaterThan(v.points[1]);
    expect(v.scores).toEqual(v.points);
    expect(view(duel(hit, hit3, 21), 2).winners).toEqual([1]);
  });

  it('gives finishers on the same score a shared win', () => {
    const log = duel(hit, hit, 21);
    expect(view(log, 2).winners).toEqual([0, 1]);
    expect(kinds(log, 2)).toContain('matchWon');
  });

  it('ranks a finisher above one who went out, whatever the scores', () => {
    // Ann goes out at D5; Bob finishes with the lowest score he can make while staying in.
    let log: TurnEvent[] = [];
    for (let r = 1; r <= 5; r++) log = [...log, ...blank(), ...(r % 2 ? hit(r) : blank())];
    // Bob: D1 hit, D2 blank, D3 hit, D4 blank, D5 hit.
    expect(view(log, 2).eliminated).toEqual([true, false]);
    log = [...log, ...hits(6, 21)];
    const v = view(log, 2);
    expect(v.winners).toEqual([1]);
  });

  it('gives the win to the player who went out last when everyone went out', () => {
    // Ann out at D5, Bob out at D6: Bob needs a hit on D5, so he plays one round more.
    let log: TurnEvent[] = [];
    for (let r = 1; r <= 4; r++) log = [...log, ...blank(), ...blank()];
    log = [...log, ...blank(), ...visit('D5', 'M', 'M')];
    expect(view(log, 2).eliminated).toEqual([true, false]);
    // Bob's score after D5: 7 + 10 = 17; D6 costs 12 and D7 costs 14: out at D7.
    log = [...log, ...blank(), ...blank()];
    const v = view(log, 2);
    expect(v.eliminated).toEqual([true, true]);
    expect(v.phase).toBe('matchWon');
    expect(v.outAt).toEqual([5, 7]);
    expect(v.winners).toEqual([1]);
    expect(v.result).toBe('Out at D7');
    expect(v.scores).toEqual([null, null]);
    expect(kinds(log, 2)).toContain('matchWon');
  });

  it('shares the win between players who went out in the same round', () => {
    const v = view(blanks(10), 2);
    expect(v.eliminated).toEqual([true, true]);
    expect(v.winners).toEqual([0, 1]);
  });

  it('ranks a player out in the bull round below one who finished it', () => {
    const log = duel(hit, r => (r === 21 ? blank() : hit(r)), 21);
    const v = view(log, 2);
    expect(v.eliminated).toEqual([false, false]);
    // Bob stayed above zero: his minus 50 still counts as finished, so the better score wins.
    expect(v.winners).toEqual([0]);
  });
});

describe("bob's 27: End match", () => {
  it('names the winner from the scores of those still in, with no record', () => {
    // Ann hits D1 (29), Bob misses (25).
    const log = [...hit(1), ...blank(), end];
    const v = view(log, 2);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
    expect(v.scores).toEqual([null, null]);
    expect(kinds(log, 2)).toContain('matchWon');
    expect(view([...log, undo], 2).phase).toBe('throwing');
  });

  it('shares the win on equal scores and leaves out the eliminated', () => {
    expect(view([end], 2).winners).toEqual([0, 1]);
    // Ann went out at D5 with a score that is lower anyway; Bob leads and wins.
    let log: TurnEvent[] = [];
    for (let r = 1; r <= 5; r++) log = [...log, ...blank(), ...hit(r)];
    expect(view([...log, end], 2).winners).toEqual([1]);
  });

  it('keeps no record from a player who finished before the others when the game is ended', () => {
    // Ann played all 21 rounds, Bob 20: End match ends it with Ann ahead and nothing for the record.
    const log = [...Array.from({ length: 20 }, (_, i) => [...hit(i + 1), ...hit(i + 1)]).flat(), ...hit(21), end];
    const v = view(log, 2);
    expect(v.done).toEqual([21, 20]);
    expect(v.winners).toEqual([0]);
    expect(v.scores).toEqual([null, null]);
  });

  it('is a win for a solo player still in, and nothing for one who is out', () => {
    expect(view([...hit(1), end]).winners).toEqual([0]);
    expect(view([...hit(1), end]).scores).toEqual([null]);
    expect(view([...hits(1, 20), end]).scores).toEqual([null]);
  });
});

describe("bob's 27: a removed player", () => {
  it('never wins and does not hold the game up', () => {
    // Ann (0) has the best score after round 1, then is removed. Bob (1) and Cy (2) finish; Cy scores more.
    const log: TurnEvent[] = [...visit('D1', 'D1', 'D1'), remove(0)];
    expect(view(log, 3).removed).toEqual(['match', null, null]);
    expect(view(log, 3).phase).toBe('throwing');
    const full = [...log, ...visit('M', 'M', 'D1'), ...visit('D1', 'D1', 'D1')];
    expect(view(full, 3).current).toBe(1);
    let more = full;
    for (let r = 2; r <= 21; r++) more = [...more, ...hit(r), ...visit(dbl(r), dbl(r), 'M')];
    const v = view(more, 3);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([2]);
    expect(v.scores[0]).toBeNull();
  });

  it('leaves the score of a visit cut short by the removal as it was', () => {
    // Ann is removed after one miss: the visit never closed, so no penalty and no round.
    const v = view([d('M'), remove(0)], 2);
    expect(v.points).toEqual([27, 27]);
    expect(v.done).toEqual([0, 0]);
  });

  it('is left out of the winners when everyone left went out', () => {
    // Ann is removed after a good first visit; Bob and Cy go out in the same round.
    let log: TurnEvent[] = [...visit('D1', 'D1', 'D1'), remove(0)];
    for (let r = 1; r <= 5; r++) log = [...log, ...blank(), ...blank()];
    const v = view(log, 3);
    expect(v.eliminated).toEqual([false, true, true]);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([1, 2]);
  });
});

describe("bob's 27: stats, record and options", () => {
  it('counts darts, hits, the final score and whether the player finished', () => {
    const v = view([...hit(1), ...blank(), ...visit('D3', 'D3', 'M')]);
    expect(v.stats[0]).toEqual({ darts: 9, hits: 3, score: 27 + 2 - 4 + 12, completed: 0 });
    const done = view(hits(1, 21));
    expect(done.stats[0]).toEqual({ darts: 63, hits: 21, score: after(21), completed: 1 });
    // Out: the final score is 0 whatever the visit left.
    expect(view(blanks(5)).stats[0]).toMatchObject({ score: 0, completed: 0, darts: 15 });
  });

  it('keeps one record: highest score, solo and versus together', () => {
    const rec = b27.record!;
    expect(rec.variant(b27.defaults, 1)).toEqual({ key: 'bobs27', label: "Bob's 27" });
    expect(rec.variant(b27.defaults, 4)).toEqual(rec.variant(b27.defaults, 1));
    expect(rec.better).toBe('higher');
    expect(rec.format(1)).toBe('1 point');
  });

  it('takes 1 to 8 players and only the bull-off option', () => {
    expect(b27.group).toBe('practice');
    expect(b27.minPlayers).toBe(1);
    expect(b27.maxPlayers).toBeUndefined();
    expect(b27.options.map(o => o.key)).toEqual(['bullOff']);
    expect(b27.normalizeOptions({ bullOff: 'nope' })).toEqual({ bullOff: 'off' });
  });

  it('compacts the log to one leg with the winner', () => {
    const leg = b27.compact(hits(1, 21), 1, b27.defaults)[0];
    expect(leg.winner).toBe(0);
    expect(leg.visits).toHaveLength(21);
  });
});

describe("bob's 27: bound", () => {
  const bound = (log: TurnEvent[], players = 1, p = 0) => b27.record!.bound!(view(log, players), p, b27.defaults);
  /** The most rounds r..20 can give with three doubles each, plus the bull round. */
  const rest = (from: number) => Array.from({ length: 22 - from }, (_, i) => 3 * doubleValue(from + i)).reduce((a, b) => a + b, 0);

  it('adds three doubles for every round left to the score', () => {
    expect(bound([])).toBe(27 + rest(1));
    expect(rest(1)).toBe(6 * 210 + 150);
    expect(bound(hit(1))).toBe(29 + rest(2));
  });

  it('counts only the darts left of the round under way', () => {
    // D1 then a miss: 29 and one dart left on D1, then rounds 2 to 21.
    expect(bound([d('D1'), d('M')])).toBe(29 + 2 + rest(2));
    // The visit is complete (held until the takeout): the next round counts in full.
    expect(bound([d('D1'), d('M'), d('M')])).toBe(29 + rest(2));
  });

  it('counts the penalty of a missed visit', () => {
    expect(bound(blank())).toBe(25 + rest(2));
  });

  it('gives the player asked about, not the one throwing', () => {
    // Bob has not thrown yet: his three darts of round 1 are still all his.
    expect(bound(hit(1), 2, 1)).toBe(27 + rest(1));
    expect(bound(hit(1), 2, 0)).toBe(29 + rest(2));
  });

  it('is nothing for a player who is out while the game goes on', () => {
    // Ann went out at D5, Bob is still in.
    let log: TurnEvent[] = [];
    for (let r = 1; r <= 5; r++) log = [...log, ...blank(), ...hit(r)];
    expect(view(log, 2).phase).toBe('throwing');
    expect(bound(log, 2, 0)).toBe(0);
    expect(bound(log, 2, 1)).toBeGreaterThan(0);
  });

  it('is nothing once out and the result itself once the game is over', () => {
    expect(bound(blanks(5))).toBe(0);
    const all = hits(1, 21);
    expect(bound(all)).toBe(after(21));
    // A missed bull round that still leaves points is a finished game: its score stands.
    expect(bound([...hits(1, 20), ...blank()])).toBe(after(20) - 50);
  });
});

describe("bob's 27: Hit and Miss", () => {
  it('judges every dart', () => {
    const v1 = view([d('D1')]);
    expect(dartCue('bobs27', v1, 0)).toBe('hit');
    const v2 = view([d('D1'), d('S1')]);
    expect(dartCue('bobs27', v2, 1)).toBe('miss');
  });

  it('has no new Moment: a hit or a miss and the existing ones', () => {
    expect(kinds(visit('D1'))).toEqual(['legStart', 'dart']);
  });
});
