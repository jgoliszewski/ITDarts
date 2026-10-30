import { describe, expect, it } from 'vitest';
import { parseDart } from './darts.ts';
import { football } from './football.ts';
import type { TurnEvent } from './turns.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];
const o = football.defaults;

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
    expect(football.describe(bullOnly, 2)).toBe('Football · Bull only · First to 5');
    expect(football.describe(o, 2)).toBe('Football · 25/50 · First to 5');
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
