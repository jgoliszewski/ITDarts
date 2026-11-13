import { describe, expect, it } from 'vitest';
import { BOARD_ORDER, parseDart } from './darts.ts';
import { football } from './football.ts';
import type { TurnEvent } from './turns.ts';
import { seeded } from './turns.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];
const o = { ...football.defaults, goalsOn: 'doubles' as const };

describe('football', () => {
  it('scores doubles only with the ball, and the ball can come in the same visit', () => {
    let v = football.view([d('D20')], 2, o);
    expect([v.goals, v.ball, v.visit.good]).toEqual([[0, 0], null, [false]]);
    v = football.view([d('D20'), d('S25'), d('D16')], 2, o);
    expect([v.goals, v.ball, v.visit.good]).toEqual([[1, 0], 0, [false, true, true]]);
    expect(v.visit.verdict).toEqual({ text: 'Goal!', tone: 'good' });
    expect(v.hero.note).toBe('Your ball · doubles score');
  });

  it('keeps the ball after a goal until a rival wins it with a bull', () => {
    const log = [...visit('25', 'D1', 'D2'), ...visit('S20', 'D3')];
    let v = football.view(log, 2, o);
    expect([v.goals, v.ball]).toEqual([[2, 0], 0]);
    v = football.view([...log, ...visit('D4'), d('Bull'), d('D5')], 2, o);
    expect([v.goals, v.ball, v.wonFrom]).toEqual([[3, 1], 1, 0]);
    expect(v.rows.map(r => r.meta)).toEqual(['3 goals', '⚽ Ball']);
  });

  it('never scores with a bull, and a bull of the holder does nothing', () => {
    const v = football.view([d('25'), d('Bull'), d('25')], 2, o);
    expect([v.goals, v.ball, v.visit.good]).toEqual([[0, 0], 0, [true, false, false]]);
    expect(v.visit.verdict).toEqual({ text: 'Ball won', tone: 'good' });
    expect(v.wonFrom).toBeNull();
  });

  it('takes the ball only on the bullseye with Bull only', () => {
    const bullOnly = { ...o, kickOff: 'bullseye' as const };
    expect(football.view([d('25')], 2, bullOnly).ball).toBeNull();
    expect(football.view([d('Bull')], 2, bullOnly).ball).toBe(0);
    expect(football.describe(bullOnly, 2)).toBe('Football · Bull only · Doubles · First to 5');
    expect(football.describe(o, 2)).toBe('Football · 25/50 · Doubles · First to 5');
    expect(football.describe(football.defaults, 2)).toBe('Football · 25/50 · Big singles · First to 5');
  });

  it('wins at once on the last goal, even mid-visit', () => {
    const v = football.view([...visit('25', 'D1', 'D2'), ...visit('S1'), d('D3')], 2, { ...o, goals: 3 });
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
    expect(v.visit.dartsLeft).toBe(0);
    expect(v.visit.verdict).toEqual({ text: 'Goal!', tone: 'good' });
    expect(v.stats).toEqual([{ goals: 3 }, { goals: 0 }]);
  });

  it('counts two goals in a visit on the turn card', () => {
    const v = football.view([d('25'), d('D1'), d('D2')], 2, o);
    expect(v.visit.verdict).toEqual({ text: '2 goals!', tone: 'good' });
  });

  it('ends on Save with the most goals winning, ties sharing and nobody at 0–0', () => {
    const end: TurnEvent = { t: 'end' };
    const lead = [...visit('25', 'D1'), ...visit('S1')];
    expect(football.view([...lead, end], 2, o).winners).toEqual([0]);
    const tie = [...visit('25', 'D1'), ...visit('25', 'D1')];
    expect(football.view([...tie, end], 2, o).winners).toEqual([0, 1]);
    const none = football.view([...visit('S1'), end], 2, o);
    expect([none.phase, none.winners]).toEqual(['matchWon', []]);
    expect(football.happenings([...visit('S1'), end], 2, o).some(h => h.fact.kind === 'matchWon')).toBe(false);
  });

  it('undoes a goal and the ball with Undo', () => {
    const v = football.view([d('25'), d('D1'), { t: 'undo' }, { t: 'undo' }], 2, o);
    expect([v.goals, v.ball]).toEqual([[0, 0], null]);
  });
});

// Goals on Big singles: four sectors drawn from the logged seed at each take of the ball.
const singles = { ...football.defaults, goalsOn: 'singles' as const };
const seed = (n: number): TurnEvent => ({ t: 'seed', seed: n });
const BIG = { x: 0, y: 0.8 }; // 136 mm: between the middle of the treble (103 mm) and the double (162 mm)
const SMALL = { x: 0, y: 0.35 }; // 60 mm: the inner single
const dc = (s: string, coords: { x: number; y: number }): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, coords, at: ++clock });
const fixTo = (index: number, s: string, coords?: { x: number; y: number }): TurnEvent => ({ t: 'fix', index, dart: parseDart(s)!, coords });
/** The starts (0–4) of the first draws a seed gives. */
const draws = (sd: number, n = 3) => { const r = seeded(sd); return Array.from({ length: n }, () => Math.floor(r() * 5)); };
const seedWith = (k: number) => { let n = 1; while (draws(n)[0] !== k) n++; return n; };
const setFor = (k: number) => [0, 5, 10, 15].map(i => BOARD_ORDER[k + i]);
const sectors = (events: TurnEvent[], opts = singles) => football.view(events, 2, opts).sectors;
const goalsOf = (events: TurnEvent[]) => football.view(events, 2, singles).goals;

describe('football, goals on big singles', () => {
  const s0 = seed(seedWith(0)); // sectors 20 · 6 · 3 · 11

  it('draws four sectors a quarter of the board apart, from the seed, at the first take of the ball', () => {
    expect(sectors([s0])).toBeNull();
    expect(sectors([s0, d('S20')])).toBeNull();
    expect(sectors([s0, d('25')])).toEqual([20, 6, 3, 11]);
    expect(sectors([seed(seedWith(3)), d('25')])).toEqual(setFor(3));
  });

  it('always draws every fifth place of the board', () => {
    for (let n = 1; n <= 60; n++) {
      const got = sectors([seed(n), d('25')])!;
      const i = got.map(x => BOARD_ORDER.indexOf(x));
      expect(got).toHaveLength(4);
      expect(i.map((x, j) => (x - i[0] + 20) % 20 === j * 5), `seed ${n}: ${got}`).toEqual([true, true, true, true]);
    }
  });

  it('scores the big single of a drawn sector, with or without coords', () => {
    expect(goalsOf([s0, d('25'), dc('S20', BIG)])).toEqual([1, 0]);
    expect(goalsOf([s0, d('25'), dc('S3', BIG)])).toEqual([1, 0]);
    expect(goalsOf([s0, d('25'), d('S6')])).toEqual([1, 0]);
  });

  it('splits the single at 103 mm, like Bullseye: 103 mm itself is a big single', () => {
    const mm = (v: number) => ({ x: v / 170, y: 0 });
    expect(goalsOf([s0, d('25'), dc('S20', mm(103))])).toEqual([1, 0]);
    expect(goalsOf([s0, d('25'), dc('S20', mm(102))])).toEqual([0, 0]);
    expect(goalsOf([s0, d('25'), dc('S20', mm(105))])).toEqual([1, 0]);
  });

  it('does not score the inner single, a double, a treble or another sector', () => {
    expect(goalsOf([s0, d('25'), dc('S20', SMALL)])).toEqual([0, 0]);
    expect(goalsOf([s0, d('25'), d('D20'), d('T20'), d('D6')])).toEqual([0, 0]);
    expect(goalsOf([s0, d('25'), dc('S1', BIG), d('S25'), d('Bull')])).toEqual([0, 0]);
    const v = football.view([s0, d('25'), dc('S11', SMALL), dc('S11', BIG)], 2, singles);
    expect(v.visit.good).toEqual([true, false, true]);
  });

  it('scores only with the ball', () => {
    expect(goalsOf([s0, d('S20')])).toEqual([0, 0]);
    expect(goalsOf([s0, ...visit('25'), dc('S20', BIG)])).toEqual([0, 0]);
  });

  it('a fix with coords decides between the inner and the outer single', () => {
    const base = [s0, d('25'), dc('S20', BIG)];
    expect(goalsOf([...base, fixTo(1, 'S20', SMALL)])).toEqual([0, 0]);
    expect(goalsOf([...base, fixTo(1, 'S20', SMALL), fixTo(1, 'S20', BIG)])).toEqual([1, 0]);
    // A fix without coords counts as big, also over a dart that had inner coords.
    expect(goalsOf([s0, d('25'), dc('S20', SMALL), fixTo(1, 'S20')])).toEqual([1, 0]);
    expect(goalsOf([...base, fixTo(1, 'S1', BIG)])).toEqual([0, 0]);
  });

  it('draws again at every take of the ball, from the centre and from a rival, not for the holder', () => {
    let sd = 1;
    // Three different starts, so each new draw shows.
    while (new Set(draws(sd)).size < 3) sd++;
    const ks = draws(sd);
    const first = [seed(sd), ...visit('25', 'Bull')]; // the second bull is the holder's: no draw
    expect(sectors(first)).toEqual(setFor(ks[0]));
    const second = [...first, ...visit('Bull')]; // the rival takes it
    expect(sectors(second)).toEqual(setFor(ks[1]));
    const third = [...second, ...visit('25')]; // and the first player takes it back
    expect(sectors(third)).toEqual(setFor(ks[2]));
    expect(sectors(third)).not.toEqual(sectors(second));
  });

  it('keeps the sectors when the ball is freed, and draws new ones at the next take', () => {
    let sd = 1;
    while (draws(sd, 2)[0] === draws(sd, 2)[1]) sd++;
    const three = (events: TurnEvent[]) => football.view(events, 3, singles);
    const freed = [seed(sd), ...visit('25'), { t: 'remove', player: 0, scope: 'match' } as TurnEvent];
    expect(three(freed).ball).toBeNull();
    expect(three(freed).sectors).toEqual(setFor(draws(sd)[0]));
    const taken = three([...freed, d('25')]);
    expect(taken.ball).toBe(1);
    expect(taken.sectors).toEqual(setFor(draws(sd)[1]));
  });

  it('gives the same sectors after Undo and after a fix of an earlier dart', () => {
    const log = [s0, ...visit('25', 'S1'), ...visit('Bull')];
    const want = sectors(log);
    expect(sectors([...log, d('25'), { t: 'undo' }])).toEqual(want);
    expect(sectors([...log, { t: 'undo' }, { t: 'undo' }, d('Bull')])).toEqual(want);
    // A fix that keeps the take of the ball keeps the draws.
    expect(sectors([s0, d('25'), fixTo(0, 'Bull'), next, d('Bull')])).toEqual(sectors([s0, d('Bull'), next, d('Bull')]));
  });

  it('shows the sectors and the way to score on the hero', () => {
    expect(football.view([s0, d('25')], 2, singles).hero.note).toBe('Your ball · big singles 20 · 6 · 3 · 11 score');
    expect(football.view([d('25')], 2, o).hero.note).toBe('Your ball · doubles score');
    expect(football.view([d('25')], 2, o).sectors).toBeNull();
  });

  it('loads options saved before Goals on as Doubles, and the setup default as Big singles', () => {
    const old = { kickOff: 'any', goals: 5, bullOff: 'off' };
    expect(football.normalizeOptions(old).goalsOn).toBe('doubles');
    expect(football.normalizeOptions({ ...old, goalsOn: 'singles' }).goalsOn).toBe('singles');
    expect(football.normalizeOptions({ ...old, goalsOn: 'nonsense' }).goalsOn).toBe('doubles');
    expect(football.defaults.goalsOn).toBe('singles');
  });

  it('still scores every double in Doubles, whatever the seed', () => {
    expect(football.view([seed(5), d('25'), d('D7'), dc('S20', BIG)], 2, o).goals).toEqual([1, 0]);
  });
});
