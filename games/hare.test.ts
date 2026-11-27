// Hare and Hounds from event logs (docs/GRY.md#hare-and-hounds).
import { describe, expect, it } from 'vitest';
import { BOARD_ORDER, parseDart } from './darts.ts';
import { hareAndHounds as hh } from './hare.ts';
import type { HareOptions } from './hare.ts';
import type { TurnEvent } from './turns.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const undo: TurnEvent = { t: 'undo' };
const end: TurnEvent = { t: 'end' };
const remove = (player: number): TurnEvent => ({ t: 'remove', player, scope: 'match' });
/** A visit with Takeout. */
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];
const nothing = () => visit('M', 'M', 'M');
const view = (log: TurnEvent[], o: Partial<HareOptions> = {}) => hh.view(log, 2, { ...hh.defaults, ...o });
const facts = (log: TurnEvent[], o: Partial<HareOptions> = {}) => hh.happenings(log, 2, { ...hh.defaults, ...o });
/** The hare runs 20 targets: 1, 18, 4 ... 5, then 20. */
const HARE = [...BOARD_ORDER.slice(1), 20];

describe('hare and hounds: start', () => {
  it('has the first player run as the hare from the 20, aiming at 1', () => {
    const v = view([]);
    expect(v.hare).toBe(0);
    expect(v.hound).toBe(1);
    expect(v.current).toBe(0);
    expect(v.hareSector).toBe(20);
    expect(v.target).toBe(1);
    expect(v.gap).toBe(3);
  });

  it('starts the hound headStart sectors behind: on 9 aiming at 12 with 3', () => {
    // [headStart, sector he stands on, first target]
    for (const [hs, stands, target] of [[2, 12, 5], [3, 9, 12], [4, 14, 9], [5, 11, 14]] as const) {
      const v = view(nothing(), { headStart: hs });
      expect(v.current).toBe(1);
      expect(v.houndSector).toBe(stands);
      expect(v.target).toBe(target);
      expect(v.gap).toBe(hs);
    }
  });

  it('defaults to Any and a head start of 3, and falls back on bad options', () => {
    expect(hh.defaults).toMatchObject({ target: 'any', headStart: 3 });
    expect(hh.normalizeOptions({ headStart: 9, target: 'x' })).toMatchObject({ target: 'any', headStart: 3 });
    expect(hh.normalizeOptions({ headStart: 5, target: 'trebles' })).toMatchObject({ target: 'trebles', headStart: 5 });
    expect(hh.minPlayers).toBe(2);
    expect(hh.maxPlayers).toBe(2);
  });

  it('describes the game with its options', () => {
    expect(hh.describe(hh.defaults, 2)).toBe('Hare and Hounds · Head start 3');
    expect(hh.describe({ ...hh.defaults, target: 'doubles', headStart: 4 }, 2)).toBe('Hare and Hounds · Doubles · Head start 4');
  });
});

describe('hare and hounds: the hare', () => {
  it('moves on within a visit: the next dart goes at the next sector', () => {
    const v = view([d('S1'), d('S18')]);
    expect(v.visit.good).toEqual([true, true]);
    expect(v.hareHits).toBe(2);
    expect(v.hareSector).toBe(18);
    expect(v.target).toBe(4);
  });

  it('does not skip sectors for a double or treble', () => {
    const v = view([d('D1'), d('T18')]);
    expect(v.hareHits).toBe(2);
    expect(v.hareSector).toBe(18);
  });

  it('does not count a wrong sector or the bull', () => {
    const v = view([d('S18'), d('Bull'), d('S25')]);
    expect(v.visit.good).toEqual([false, false, false]);
    expect(v.hareHits).toBe(0);
  });

  it('wins on the 20th target in the middle of a visit', () => {
    const log: TurnEvent[] = [];
    // 18 targets in 6 visits with the hound missing, then 2 more darts of the 7th.
    for (let i = 0; i < 18; i += 3) log.push(...visit(...HARE.slice(i, i + 3).map(n => `S${n}`)), ...nothing());
    log.push(d('S' + HARE[18]));
    expect(view(log).phase).toBe('throwing');
    log.push(d('S20'));
    const v = view(log);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
    expect(v.visit.dartsLeft).toBe(0);
    expect(v.result).toBe('Hare made it round the board');
    expect(v.rows[0].value).toBe('20 / 20');
    expect(v.stats[0]).toMatchObject({ hits: 20, hareWins: 1, houndWins: 0 });
    expect(facts(log).filter(h => h.fact.kind === 'matchWon')).toHaveLength(1);
    // Nothing counts after the win.
    expect(view([...log, d('S1')]).stats[0].darts).toBe(view(log).stats[0].darts);
  });

  it('needs the 20 only at the end: a 20 early on is not his target', () => {
    expect(view([d('S20')]).hareHits).toBe(0);
  });
});

describe('hare and hounds: the hound', () => {
  it('catches a hare who stands still when he reaches the sector the hare stands on', () => {
    // Head start 3: 12, 5, then the 20 the hare stands on.
    const v = view([...nothing(), d('S12'), d('S5')]);
    expect(v.gap).toBe(1);
    expect(v.phase).toBe('throwing');
    const caught = view([...nothing(), d('S12'), d('S5'), d('S20')]);
    expect(caught.phase).toBe('matchWon');
    expect(caught.winners).toEqual([1]);
    expect(caught.result).toBe('Hound caught the hare on 20');
    expect(caught.visit.verdict).toEqual({ text: 'Caught', tone: 'good' });
    expect(caught.stats[1]).toMatchObject({ houndWins: 1, hareWins: 0 });
  });

  it('has to catch up with the sector the hare has reached, not where he started', () => {
    const run = [...visit('S1', 'M', 'M'), d('S5'), d('S20')];
    expect(view(run, { headStart: 2 }).gap).toBe(1);
    expect(view(run, { headStart: 2 }).phase).toBe('throwing');
    expect(view([...run, d('S1')], { headStart: 2 }).winners).toEqual([1]);
  });

  it('loses the rest of his darts when he catches the hare', () => {
    // Head start 2: dart 2 catches, dart 3 is a leftover from before a fix.
    const log = [...nothing(), d('S5'), d('S1'), d('S20')];
    const before = view(log, { headStart: 2 });
    expect(before.visit.good).toEqual([true, false, true]);
    const fixed = view([...log, { t: 'fix', index: 1, dart: parseDart('S20')! }], { headStart: 2 });
    expect(fixed.phase).toBe('matchWon');
    expect(fixed.visit.good).toEqual([true, true, false]);
    expect(fixed.stats[1].hits).toBe(2);
    expect(fixed.stats[1].darts).toBe(2);
  });

  it('falls behind when the hare runs on: the gap grows with each hare hit', () => {
    const v = view([...visit('S1', 'S18', 'S4'), d('S12')]);
    expect(v.gap).toBe(5);
  });
});

describe('hare and hounds: the screen', () => {
  it('shows each role, the hare’s hits of 20 and the hound’s hits of his way to the hare', () => {
    // Hare on 4 (3 hits), hound on 12 (1 hit): the hound has 1 + gap 5 to go, 6 in all.
    const v = view([...visit('S1', 'S18', 'S4'), d('S12')]);
    expect(v.rows).toEqual([
      { value: '3 / 20', meta: 'Hare', out: false },
      { value: '1 / 6', meta: 'Hound', out: false },
    ]);
    expect(v.hero).toEqual({ big: '5', caption: 'Hound', note: 'Gap 5' });
  });

  it('fills the hound’s row once he catches the hare, with no verdict on a plain visit', () => {
    expect(view([...nothing(), d('S12'), d('S5'), d('S20')]).rows[1].value).toBe('3 / 3');
    expect(view(visit('S1', 'M', 'M').slice(0, 3)).visit.verdict).toBeNull();
  });
});

describe('hare and hounds: Doubles and Trebles', () => {
  it('counts only doubles in Doubles', () => {
    const v = view([d('S1'), d('T1'), d('D1'), d('D18')], { target: 'doubles' });
    expect(v.visit.good).toEqual([false, false, true]);
    expect(v.hareSector).toBe(1);
    expect(v.target).toBe(18);
    expect(v.hero.big).toBe('D18');
  });

  it('counts only trebles in Trebles', () => {
    const v = view([d('D1'), d('S1'), d('T1')], { target: 'trebles' });
    expect(v.visit.good).toEqual([false, false, true]);
    expect(v.hero.big).toBe('T18');
  });

  it('applies to the hound as well', () => {
    const v = view([...nothing(), d('S12'), d('T12'), d('D12')], { target: 'doubles' });
    expect(v.stats[1].hits).toBe(1);
    expect(v.gap).toBe(2);
  });
});

describe('hare and hounds: Undo, End match and removal', () => {
  const caught = [...nothing(), d('S12'), d('S5'), d('S20')];

  it('takes a catch back with Undo', () => {
    const v = view([...caught, undo]);
    expect(v.phase).toBe('throwing');
    expect(v.winners).toEqual([]);
    expect(v.gap).toBe(1);
    expect(v.stats[1].houndWins).toBe(0);
    expect(facts([...caught, undo]).some(h => h.fact.kind === 'matchWon')).toBe(false);
  });

  it('ends without a winner on End match', () => {
    const log = [...nothing(), d('S12'), end];
    const v = view(log);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([]);
    expect(v.result).toBe('No winner');
    expect(v.stats.every(s => s.hareWins === 0 && s.houndWins === 0)).toBe(true);
    expect(facts(log).some(h => h.fact.kind === 'matchWon')).toBe(false);
    // Undo takes the ending back.
    expect(view([...log, undo]).phase).toBe('throwing');
    // Darts after the end do nothing.
    expect(view([...log, d('S5')]).stats[1].hits).toBe(1);
  });

  it('gives the game to the one left when the other is removed', () => {
    const hound = view([d('S1'), remove(1)]);
    expect(hound.phase).toBe('matchWon');
    expect(hound.winners).toEqual([0]);
    expect(hound.removed).toEqual([null, 'match']);
    const hare = view([...nothing(), remove(0)]);
    expect(hare.winners).toEqual([1]);
    expect(hare.result).toBe('Hound won');
    expect(hare.visit.verdict).toBeNull();
    expect(view([...nothing(), remove(0), undo]).phase).toBe('throwing');
  });
});

describe('hare and hounds: stats and Wyzwalacze', () => {
  it('counts darts and hits per player and fires Target hit on every counted dart', () => {
    const log = [d('S1'), d('S2'), d('S18'), next, d('S12'), d('S9')];
    const v = view(log);
    expect(v.stats[0]).toMatchObject({ darts: 3, hits: 2 });
    expect(v.stats[1]).toMatchObject({ darts: 2, hits: 1 });
    const hits = facts(log).filter(h => h.fact.kind === 'game' && h.fact.event === 'targetHit');
    expect(hits.map(h => h.slot)).toEqual(['V1D1:hit', 'V1D3:hit', 'V2D1:hit']);
  });

  it('keeps no record', () => {
    expect(hh.record).toBeUndefined();
    expect(view([]).scores).toEqual([null, null]);
  });

  it('stores the match as one leg with the winner', () => {
    const legs = hh.compact([...nothing(), d('S12'), d('S5'), d('S20')], 2, hh.defaults);
    expect(legs).toHaveLength(1);
    expect(legs[0].winner).toBe(1);
  });
});
