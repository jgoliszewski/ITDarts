import { describe, expect, it } from 'vitest';
import { changes } from './effects.ts';
import { parseDart } from './darts.ts';
import { callerLinesGotcha, gotcha } from './gotcha.ts';
import type { TurnEvent } from './turns.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];

const o101 = { ...gotcha.defaults, target: 101 as const };
const o201 = { ...gotcha.defaults };
const totals = (log: TurnEvent[], players: number, o = o201) => gotcha.view(log, players, o).totals;

describe('gotcha scoring', () => {
  it('counts up from zero, doubles and trebles at face value, no double needed', () => {
    const v = gotcha.view([d('T20'), d('D10'), d('S5')], 2, o201);
    expect(v.totals).toEqual([85, 0]);
    expect(v.hero.big).toBe('85');
    expect(v.hero.note).toBe('Left 116');
    expect(v.visit.good).toEqual([true, true, true]);
    expect(v.visitScore).toBe(85);
  });

  it('defaults to 201, plays from 2 players, and sits in the Versus group', () => {
    expect(gotcha.defaults.target).toBe(201);
    expect(gotcha.minPlayers).toBe(2);
    expect(gotcha.group).toBe('versus');
    expect(gotcha.describe(o101, 2)).toBe('Gotcha · 101');
    expect(gotcha.normalizeOptions({ target: 301 }).target).toBe(301);
    expect(gotcha.normalizeOptions({ target: 500 }).target).toBe(201);
    expect(gotcha.record).toBeUndefined();
  });

  it('passes the visit to the next player', () => {
    expect(gotcha.view(visit('S1'), 2, o201).current).toBe(1);
  });
});

describe('gotcha bust', () => {
  // Player 0 sits on 180; player 1 misses.
  const on180 = [...visit('T20', 'T20', 'T20'), ...visit('Miss')];

  it('puts the score back to the start of the visit and ends the visit', () => {
    const v = gotcha.view([...on180, d('S5'), d('T20')], 2, o201); // 185, then 245: bust
    expect(v.totals[0]).toBe(180);
    expect(v.visit.good).toEqual([true, false]);
    expect(v.visit.dartsLeft).toBe(0);
    expect(v.visit.verdict).toEqual({ text: 'Bust', tone: 'bad' });
    expect(v.phase).toBe('throwing');
    // The rest of the visit does nothing.
    expect(gotcha.view([...on180, d('S5'), d('T20'), d('S1')], 2, o201).totals[0]).toBe(180);
  });

  it('does not zero anybody, even if the score passed a rival on the way', () => {
    // Player 1 is on 60. Player 0 throws T20 (60, the same) and T20 again: 120 is over 101, bust.
    const log = [...visit('Miss'), ...visit('T20'), d('T20'), d('T20')];
    const v = gotcha.view(log, 2, o101);
    expect(v.totals).toEqual([0, 60]);
    expect(v.stats).toEqual([{ gotchas: 0 }, { gotchas: 0 }]);
    expect(v.zeroed).toEqual([]);
  });

  it('fires Bust, and an undo takes the bust back', () => {
    const log = [...on180, d('T20')]; // 240: bust with the first dart
    const bust = (l: TurnEvent[]) => gotcha.happenings(l, 2, o201).some(h => h.fact.kind === 'bust');
    expect(bust(log)).toBe(true);
    expect(bust(on180)).toBe(false);
    expect(bust([...log, { t: 'undo' }])).toBe(false);
    expect(totals([...log, { t: 'undo' }], 2)[0]).toBe(180);
  });
});

describe('gotcha win', () => {
  it('wins on the exact target at once, in the middle of a visit', () => {
    // Bull (50) + T17 (51) = 101 with the second dart: the third is never thrown.
    const v = gotcha.view([d('Bull'), d('T17'), d('S1')], 2, o101);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
    expect(v.totals[0]).toBe(101);
    expect(v.visit.darts).toHaveLength(2);
    expect(v.result).toBe('Hit 101 exactly');
  });

  it('wins with the last dart too, and for any player', () => {
    const v = gotcha.view([...visit('Miss'), d('T20'), d('D20'), d('S1')], 2, o101);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([1]);
  });

  it('does not win below or above the target', () => {
    expect(gotcha.view([d('T20'), d('D20'), d('S5')], 2, o101).phase).toBe('throwing'); // 105 is a bust
    expect(gotcha.view([d('T20'), d('D20'), d('Miss')], 2, o101).totals[0]).toBe(100);
  });

  it('an undo takes the win back', () => {
    const win = [d('Bull'), d('T17')];
    expect(gotcha.view([...win, { t: 'undo' }], 2, o101).phase).toBe('throwing');
  });
});

describe('gotcha reset', () => {
  // Player 0 on 60; player 1 lands on 60 with the second dart of a visit.
  const landing = [...visit('T20'), d('D20'), d('S20'), d('Miss')];

  it('sends a rival on the same score back to zero at the end of the visit', () => {
    const v = gotcha.view(landing, 2, o201);
    expect(v.totals).toEqual([0, 60]);
    expect(v.zeroed).toEqual([0]);
    expect(v.stats).toEqual([{ gotchas: 0 }, { gotchas: 1 }]);
  });

  it('waits for the end of the visit: passing a rival on the way does nothing', () => {
    const v = gotcha.view([...visit('T20'), d('D20'), d('S20'), d('S1')], 2, o201);
    expect(v.totals).toEqual([60, 61]);
    expect(v.zeroed).toEqual([]);
    // After two darts the visit is still open: both show 60 and nobody is zeroed yet.
    expect(totals([...visit('T20'), d('D20'), d('S20')], 2)).toEqual([60, 60]);
  });

  it('keeps showing who was zeroed until the next visit starts', () => {
    expect(gotcha.view(landing, 2, o201).zeroed).toEqual([0]);
    expect(gotcha.view([...landing, next], 2, o201).zeroed).toEqual([0]);
    expect(gotcha.view([...landing, next, d('S1')], 2, o201).zeroed).toEqual([]);
  });

  it('also reports it when Next player ends the visit before the third dart', () => {
    const short = [...visit('T20'), d('D20'), d('S20'), next];
    const v = gotcha.view(short, 2, o201);
    expect(v.totals).toEqual([0, 60]);
    expect(v.zeroed).toEqual([0]);
  });

  it('zeroes only a rival with exactly the same score', () => {
    expect(totals([...visit('T20'), ...visit('T19')], 2)).toEqual([60, 57]);
  });

  it('does not zero on 0 → 0, nor a player who threw nothing', () => {
    const v = gotcha.view([...visit('Miss'), ...visit('Miss'), ...visit('Miss')], 3, o201);
    expect(v.totals).toEqual([0, 0, 0]);
    expect(v.zeroed).toEqual([]);
    expect(v.stats.every(s => s.gotchas === 0)).toBe(true);
    // Player 0 was zeroed, then misses: still at 0 and player 1's 60 stays.
    expect(totals([...landing, next, ...visit('Miss')], 2)).toEqual([0, 60]);
  });

  it('fires the Gotcha Moment once, when the visit is complete', () => {
    const gotchas = (l: TurnEvent[]) => gotcha.happenings(l, 2, o201).filter(h => h.fact.kind === 'game' && h.fact.event === 'gotcha');
    expect(gotchas([...visit('T20'), d('D20'), d('S20')])).toHaveLength(0);
    expect(gotchas(landing)).toHaveLength(1);
  });
});

describe('gotcha undo and fix', () => {
  const landing = [...visit('T20'), d('D20'), d('S20'), d('Miss')];

  it('a fix recomputes: a dart that no longer matches takes the Gotcha away', () => {
    expect(totals(landing, 2)).toEqual([0, 60]);
    const fixed = gotcha.view([...landing, { t: 'fix', index: 1, dart: parseDart('S5')! }], 2, o201);
    expect(fixed.totals).toEqual([60, 45]);
    expect(fixed.stats[1].gotchas).toBe(0);
    // ... and a fix can make one.
    const near = [...visit('T20'), d('D20'), d('S1'), d('Miss')];
    expect(totals(near, 2)).toEqual([60, 41]);
    expect(totals([...near, { t: 'fix', index: 1, dart: parseDart('S20')! }], 2)).toEqual([0, 60]);
  });

  it('an undo gives the rival their score back', () => {
    expect(totals([...landing, { t: 'undo' }], 2)).toEqual([60, 60]);
  });
});

describe('gotcha view and caller', () => {
  it('lists scores and what is left', () => {
    const v = gotcha.view([...visit('T20'), d('D20'), d('S20'), d('Miss')], 2, o201);
    expect(v.rows.map(r => r.value)).toEqual(['0', '60']);
    expect(v.rows[0].meta).toBe('Left 201');
    expect(v.rows[1].meta).toBe('Left 141');
    expect(v.visit.verdict).toBeNull();
  });

  it('calls the visit score and busted, never “you require” or a game shot', () => {
    const before = gotcha.happenings([d('T20'), d('T20')], 2, o201);
    const after = gotcha.happenings([d('T20'), d('T20'), d('T20')], 2, o201);
    expect(callerLinesGotcha(changes(before, after, 'other'))).toEqual(['180']);
    // The start of the next visit: no “require”.
    expect(callerLinesGotcha([])).toEqual([]);
    // A bust is called as busted.
    const busted = [...visit('T20', 'T20', 'T20'), ...visit('Miss')];
    const b0 = gotcha.happenings(busted, 2, o201), b1 = gotcha.happenings([...busted, d('T20')], 2, o201);
    expect(callerLinesGotcha(changes(b0, b1, 'other'))).toContain('busted');
    // A win is called as its score only.
    const w0 = gotcha.happenings([d('Bull')], 2, o101), w1 = gotcha.happenings([d('Bull'), d('T17')], 2, o101);
    expect(callerLinesGotcha(changes(w0, w1, 'other'))).toEqual(['101']);
  });

  it('compacts the log with the winner', () => {
    const legs = gotcha.compact([d('Bull'), d('T17')], 2, o101);
    expect(legs).toHaveLength(1);
    expect(legs[0].winner).toBe(0);
  });
});
