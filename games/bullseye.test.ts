import { describe, expect, it } from 'vitest';
import { parseDart } from './darts.ts';
import type { Coords } from './darts.ts';
import { bullseye, dartPoints } from './bullseye.ts';
import type { TurnEvent } from './turns.ts';

let clock = 0;
const d = (s: string, coords?: Coords): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, coords, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const end: TurnEvent = { t: 'end' };
// A visit closed early fills the rest with misses (−1 each), so short visits are padded with inner singles (0).
const visit = (...s: string[]): TurnEvent[] => [...[...s, 'S1', 'S1', 'S1'].slice(0, 3).map(x => d(x)), next];
const remove = (player: number): TurnEvent => ({ t: 'remove', player, scope: 'match' });
const o = bullseye.defaults;
// Coords are normalized: 1 is 170 mm from the centre; the inner single ends at 103 mm.
const at = (mm: number): Coords => ({ x: mm / 170 / Math.SQRT2, y: mm / 170 / Math.SQRT2 });

describe('bullseye', () => {
  it('scores the bull +2, the 25 +1, an inner single 0 and everything else −1', () => {
    const pts = (s: string, coords?: Coords) => dartPoints({ dart: parseDart(s)!, coords });
    expect(pts('Bull')).toBe(2);
    expect(pts('25')).toBe(1);
    expect(pts('S20', at(60))).toBe(0);
    expect(pts('S20', at(102))).toBe(0);
    expect(pts('S20', at(103))).toBe(-1);
    expect(pts('S20', { x: 103 / 170, y: 0 })).toBe(-1);
    expect(pts('S20', at(104))).toBe(-1);
    expect(pts('S20', at(140))).toBe(-1);
    expect(pts('T20', at(100))).toBe(-1);
    expect(pts('D20')).toBe(-1);
    expect(pts('Miss')).toBe(-1);
  });

  it('counts a single without coords as inner, so a fixed dart loses its coords and scores 0', () => {
    expect(dartPoints({ dart: parseDart('S5')! })).toBe(0);
    const v = bullseye.view([d('S20', at(150)), { t: 'fix', index: 0, dart: parseDart('S20')! }], 2, o);
    expect(v.points).toEqual([0, 0]);
  });

  it('adds up a visit on the score and the turn card, and colours the darts', () => {
    const v = bullseye.view([d('Bull'), d('S1', at(50)), d('T20')], 2, o);
    expect(v.points).toEqual([1, 0]);
    expect(v.visitPoints).toBe(1);
    expect(v.visit.good).toEqual([true, false, false]);
    expect(v.hero).toMatchObject({ big: '1', caption: 'Points' });
  });

  it('lets the score go below zero', () => {
    const v = bullseye.view([...visit('T20', 'D1', 'Miss'), ...visit('25')], 2, o);
    expect(v.points).toEqual([-3, 1]);
    expect(v.rows.map(r => r.value)).toEqual(['−3', '1']);
    expect(v.phase).toBe('throwing');
    const card = bullseye.view([d('T20'), d('D1')], 2, o);
    expect(card.visitPoints).toBe(-2);
    expect(card.hero.big).toBe('−2');
  });

  // The game is decided at the end of the round, not on the dart that reaches the target (docs/GRY.md#bullseye, Koniec).
  const three = { ...o, firstTo: 3 as const };
  const won = (log: TurnEvent[], players: number, opts = three) => {
    const v = bullseye.view(log, players, opts);
    return [v.phase, v.winners];
  };

  it('plays the visit that reaches the target to the end and does not end the game mid-round', () => {
    let v = bullseye.view([d('Bull'), d('Bull')], 2, three);
    expect([v.phase, v.points, v.visit.dartsLeft]).toEqual(['throwing', [4, 0], 1]);
    v = bullseye.view([d('Bull'), d('Bull'), d('T20')], 2, three);
    expect([v.phase, v.points, v.winners]).toEqual(['throwing', [3, 0], []]);
    v = bullseye.view([...visit('Bull', 'Bull'), d('S1')], 2, three);
    expect([v.phase, v.current]).toEqual(['throwing', 1]);
    expect(bullseye.happenings([...visit('Bull', 'Bull')], 2, three).some(h => h.fact.kind === 'matchWon')).toBe(false);
  });

  it('goes on when the one who reached the target falls below it before the round ends', () => {
    const v = bullseye.view([...visit('Bull', '25', 'Miss'), ...visit('S1')], 2, three);
    expect([v.phase, v.points, v.current]).toEqual(['throwing', [2, 0], 0]);
  });

  it('gives the win after the round to the most points when several reach the target', () => {
    const log = [...visit('Bull', 'Bull'), ...visit('Bull', 'Bull', 'Bull'), d('Bull'), d('25'), d('S1')];
    expect(won(log.slice(0, -1), 3)).toEqual(['throwing', []]);
    const v = bullseye.view(log, 3, three);
    expect([v.phase, v.winners, v.points]).toEqual(['matchWon', [1], [4, 6, 3]]);
    expect(v.visit.dartsLeft).toBe(0);
    expect(v.stats).toEqual([{ points: 4 }, { points: 6 }, { points: 3 }]);
    expect(bullseye.happenings(log, 3, three).filter(h => h.fact.kind === 'matchWon')).toHaveLength(1);
  });

  it('ends the round when its last player is removed, and drops a removed leader from it', () => {
    expect(won([...visit('Bull', 'Bull'), ...visit('S1'), remove(2)], 3)).toEqual(['matchWon', [0]]);
    expect(won([...visit('Bull', 'Bull'), ...visit('S1'), remove(0), ...visit('25')], 3)).toEqual(['throwing', []]);
  });

  // Ann (0) and Cy (2) tie on 4, Bob (1) is out of it.
  const tie = [...visit('Bull', 'Bull'), ...visit('S1'), ...visit('Bull', 'Bull')];

  it('sends only the tied leaders to a tiebreak, after the takeout', () => {
    const held = bullseye.view(tie.slice(0, -1), 3, three);
    expect([held.phase, held.hero.caption, held.rows.map(r => r.out)]).toEqual(['throwing', 'Points', [false, false, false]]);
    const v = bullseye.view(tie, 3, three);
    expect([v.phase, v.current, v.hero.caption]).toEqual(['throwing', 0, 'Tiebreak']);
    expect(v.rows.map(r => r.out)).toEqual([false, true, false]);
    expect(v.rows[1].meta).toBe('Out of tiebreak');
    expect(bullseye.view([...tie, ...visit('S1')], 3, three).current).toBe(2);
  });

  it('adds the tiebreak visit to the total and gives the win to the most', () => {
    const v = bullseye.view([...tie, ...visit('25'), d('S1'), d('S1'), d('S1')], 3, three);
    expect([v.phase, v.winners, v.points]).toEqual(['matchWon', [0], [5, 0, 4]]);
  });

  it('gives the tiebreak to the most points even when both fall below the target in it', () => {
    expect(won([...tie, ...visit('T20', 'T20', 'S1'), ...visit('T20', 'T20', 'T20')], 3)).toEqual(['matchWon', [0]]);
  });

  it('plays another tiebreak round on another tie, until someone leads', () => {
    const again = [...tie, ...visit('25'), ...visit('25')];
    const v = bullseye.view(again, 3, three);
    expect([v.phase, v.hero.caption, v.current, v.points]).toEqual(['throwing', 'Tiebreak', 0, [5, 0, 5]]);
    expect(won([...again, ...visit('S1'), d('Bull'), d('S1'), d('S1')], 3)).toEqual(['matchWon', [2]]);
  });

  it('gives the tiebreak at once to the last one left in it', () => {
    expect(won([...tie, remove(2)], 3)).toEqual(['matchWon', [0]]);
    expect(won([...tie, d('Bull'), remove(0)], 3)).toEqual(['matchWon', [2]]);
  });

  it('decides a solo game after each visit', () => {
    expect(won([d('Bull'), d('Bull')], 1)).toEqual(['throwing', []]);
    expect(won([d('Bull'), d('Bull'), d('S1')], 1)).toEqual(['matchWon', [0]]);
    expect(won([...visit('Bull', 'Miss', 'Miss')], 1)).toEqual(['throwing', []]);
    expect(won([...visit('Bull', 'Miss', 'Miss'), d('Bull'), d('Bull'), d('S1')], 1)).toEqual(['matchWon', [0]]);
    expect(bullseye.view([...visit('Miss'), end], 1, o).winners).toEqual([]);
  });

  it('ends the round with the last in the bull-off order', () => {
    const bull = (mm: number): TurnEvent => ({ t: 'bull', dart: parseDart('S20')!, coords: { x: 0, y: mm / 170 }, at: 0 } as TurnEvent);
    const closest = { ...three, bullOff: 'closest' as const };
    const log = [bull(30), bull(10), ...visit('Bull', 'Bull')];
    expect(bullseye.view(log, 2, closest).current).toBe(0);
    expect(won(log, 2, closest)).toEqual(['throwing', []]);
    expect(won([...log, d('S1'), d('S1'), d('S1')], 2, closest)).toEqual(['matchWon', [1]]);
  });

  it('ends on Save with the most points winning, ties sharing and nobody at 0 or below', () => {
    expect(bullseye.view([...visit('Bull'), ...visit('25'), end], 2, o).winners).toEqual([0]);
    expect(bullseye.view([...visit('25'), ...visit('25'), end], 2, o).winners).toEqual([0, 1]);
    const zero = bullseye.view([...visit('S1'), ...visit('Miss'), end], 2, o);
    expect([zero.phase, zero.winners]).toEqual(['matchWon', []]);
    const below = [...visit('Miss'), ...visit('T1'), end];
    expect(bullseye.view(below, 2, o).winners).toEqual([]);
    expect(bullseye.happenings(below, 2, o).some(h => h.fact.kind === 'matchWon')).toBe(false);
  });

  it('does not let a removed player win on Save', () => {
    const log = [...visit('Bull', 'Bull'), ...visit('25'), ...visit('Miss'), remove(0), end];
    expect(bullseye.view(log, 3, o).winners).toEqual([1]);
  });

  it('counts the misses that fill a visit closed early', () => {
    expect(bullseye.view([d('Bull'), next], 2, o).points).toEqual([0, 0]);
  });

  it('undoes a dart', () => {
    expect(bullseye.view([d('Bull'), { t: 'undo' }], 2, o).points).toEqual([0, 0]);
  });

  it('takes First to 3, 5 or 10 and Bull-off, nothing else', () => {
    expect(bullseye.describe(o, 2)).toBe('Bullseye · First to 5');
    expect(bullseye.normalizeOptions({ firstTo: 10, bullOff: 'closest' })).toEqual({ firstTo: 10, bullOff: 'closest' });
    expect(bullseye.normalizeOptions({ firstTo: 7, coop: true })).toEqual({ firstTo: 5, bullOff: 'off' });
    expect(bullseye.minPlayers).toBe(1);
    expect(bullseye.record).toBeUndefined();
  });
});

describe('bullseye, a fix with coords', () => {
  const fixAt = (coords?: Coords): TurnEvent => ({ t: 'fix', index: 0, dart: parseDart('S20')!, coords });
  it('scores an outer single tapped on the board −1, and an inner single 0', () => {
    expect(bullseye.view([d('S20', at(60)), fixAt(at(140))], 2, o).points).toEqual([-1, 0]);
    expect(bullseye.view([d('S20', at(140)), fixAt(at(60))], 2, o).points).toEqual([0, 0]);
    // No coords after the fix still means inner.
    expect(bullseye.view([d('S20', at(140)), fixAt()], 2, o).points).toEqual([0, 0]);
  });
});
