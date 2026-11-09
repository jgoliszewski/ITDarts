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

  it('wins at once on reaching the target, even mid-visit', () => {
    const v = bullseye.view([...visit('Bull', 'Bull'), ...visit('Miss'), d('25')], 2, o);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
    expect(v.visit.dartsLeft).toBe(0);
    expect(v.stats).toEqual([{ points: 5 }, { points: -1 }]);
    expect(bullseye.happenings([...visit('Bull', 'Bull'), ...visit('Miss'), d('25')], 2, o).some(h => h.fact.kind === 'matchWon')).toBe(true);
  });

  it('wins by going past the target too, with First to 3', () => {
    const three = { ...o, firstTo: 3 as const };
    const v = bullseye.view([d('25'), d('Bull')], 2, three);
    expect([v.phase, v.winners, v.points]).toEqual(['matchWon', [0], [3, 0]]);
    expect(bullseye.view([d('25'), d('25')], 2, three).phase).toBe('throwing');
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

  it('plays solo to the target', () => {
    const v = bullseye.view([...visit('Bull', 'Bull'), d('25')], 1, o);
    expect([v.phase, v.winners]).toEqual(['matchWon', [0]]);
    expect(bullseye.view([...visit('Miss'), end], 1, o).winners).toEqual([]);
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
