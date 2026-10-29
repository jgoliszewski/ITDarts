import { describe, expect, it } from 'vitest';
import { changes } from './effects.ts';
import { parseDart } from './darts.ts';
import { shanghai } from './shanghai.ts';
import type { TurnEvent } from './turns.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];
/** A visit that scores nothing in any round. */
const blank = visit('Miss', 'Miss', 'Miss');
/** `rounds` full rounds of blanks for `players` players. */
const blanks = (rounds: number, players: number) => Array.from({ length: rounds * players }, () => blank).flat();

const o7 = { ...shanghai.defaults };
const o20 = { ...shanghai.defaults, rounds: 20 as const };

describe('shanghai scoring', () => {
  it('scores only the round sector, number times multiplier', () => {
    // Round 1: S1 = 1, T1 = 3, D20 and the bull score nothing.
    const v = shanghai.view([d('S1'), d('T1'), d('D20')], 2, o7);
    expect(v.points).toEqual([4, 0]);
    expect(v.visitPoints).toBe(4);
    expect(v.visit.good).toEqual([true, true, false]);
    // Round 5: S5 = 5, D5 = 10, T5 = 15.
    const r5 = shanghai.view([...blanks(4, 2), ...visit('S5', 'D5'), d('T5')], 2, o7);
    expect(r5.round).toBe(5);
    expect(r5.sector).toBe(5);
    expect(r5.points).toEqual([15, 15]);
  });

  it('counts a bull and a miss as nothing', () => {
    const v = shanghai.view([d('Bull'), d('25'), d('Miss')], 1, o7);
    expect(v.points).toEqual([0]);
    expect(v.visit.good).toEqual([false, false, false]);
  });

  it('moves to the next player and the next round in order', () => {
    let v = shanghai.view(visit('S1'), 2, o7);
    expect(v.current).toBe(1);
    expect(v.sector).toBe(1);
    v = shanghai.view([...visit('S1'), ...visit('S1')], 2, o7);
    expect(v.current).toBe(0);
    expect(v.sector).toBe(2);
    expect(v.hero.caption).toBe('Round 2 / 7');
  });

  it('closes a short visit with misses', () => {
    const v = shanghai.view([d('S1'), next], 1, o7);
    expect(v.round).toBe(2);
    expect(v.points).toEqual([1]);
  });
});

describe('shanghai', () => {
  it('ends the game at once with 2+ players, even if the other has more points', () => {
    // Player 1 leads 27 to 0 after two rounds, then player 0 throws S3 D3 T3 (18 points) in round 3.
    const win = [...blank, ...visit('T1', 'T1', 'T1'), ...blank, ...visit('T2', 'T2', 'T2'), ...visit('S3', 'T3', 'D3')];
    const v = shanghai.view(win, 2, o7);
    expect(v.points).toEqual([18, 27]);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
    expect(v.stats[0].shanghais).toBe(1);
    expect(v.result).toContain('Shanghai');
    // No more darts after the win.
    expect(shanghai.view([...win, d('S3')], 2, o7).points).toEqual(v.points);
  });

  it('does not count S, D and T of another number, or two of the same ring', () => {
    expect(shanghai.view([d('S2'), d('D2'), d('T2')], 2, o7).phase).toBe('throwing'); // round 1
    expect(shanghai.view([d('S1'), d('S1'), d('T1')], 2, o7).stats[0].shanghais).toBe(0);
    expect(shanghai.view([d('S1'), d('D1'), d('T1')], 2, o7).stats[0].shanghais).toBe(1);
  });

  it('is only a Moment when alone, and the game goes on', () => {
    const log = [...visit('S1', 'D1', 'T1'), ...visit('S2')];
    const v = shanghai.view(log, 1, o7);
    expect(v.phase).toBe('throwing');
    expect(v.points).toEqual([6 + 2]);
    expect(v.stats[0].shanghais).toBe(1);
    const fx = shanghai.happenings(log, 1, o7).filter(h => h.fact.kind === 'game');
    expect(fx).toEqual([{ slot: 'V1:shanghai', fact: { kind: 'game', event: 'shanghai' } }]);
  });

  it('fires the Shanghai Moment, and the win with it, once the third dart is in', () => {
    const before = shanghai.happenings([d('S1'), d('D1')], 2, o7);
    const after = shanghai.happenings([d('S1'), d('D1'), d('T1')], 2, o7);
    expect(changes(before, after, 'other').some(c => c.fact.kind === 'game' && c.fact.event === 'shanghai')).toBe(true);
    expect(after.some(h => h.fact.kind === 'matchWon')).toBe(true);
  });
});

describe('shanghai end of the game', () => {
  it('ends after round 7 with the most points winning', () => {
    const rounds = [...blanks(6, 2), ...visit('S7'), ...visit('S7', 'S7')];
    const v = shanghai.view(rounds, 2, o7);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([1]);
    expect(v.points).toEqual([7, 14]);
  });

  it('plays 20 rounds when asked', () => {
    const v = shanghai.view([...blanks(7, 2), ...visit('S8')], 2, o20);
    expect(v.phase).toBe('throwing');
    expect(v.round).toBe(8);
    const end = shanghai.view([...blanks(19, 2), ...visit('S20'), ...visit('Miss')], 2, o20);
    expect(end.phase).toBe('matchWon');
    expect(end.winners).toEqual([0]);
  });

  it('solo: ends after the last round, the score is the record', () => {
    const log = [...visit('S1'), ...blanks(5, 1), ...visit('D7')];
    const v = shanghai.view(log, 1, o7);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
    expect(v.scores).toEqual([15]);
    expect(shanghai.view([d('S1')], 1, o7).scores).toEqual([null]);
    expect(shanghai.record!.variant(o7, 1)).toMatchObject({ key: 'shanghai:solo:7' });
    expect(shanghai.record!.variant(o20, 1)).toMatchObject({ key: 'shanghai:solo:20' });
    expect(shanghai.record!.variant(o7, 2)).toBeNull();
  });
});

describe('shanghai tiebreak', () => {
  // Three players: 0 and 1 tie on 7, player 2 has 0.
  const tie = [...blanks(6, 3), ...visit('S7'), ...visit('S7'), ...visit('Miss')];

  it('is played on 20 by the tied players only', () => {
    const v = shanghai.view(tie, 3, o7);
    expect(v.phase).toBe('throwing');
    expect(v.tiebreak).toBe(true);
    expect(v.sector).toBe(20);
    expect(v.hero.caption).toBe('Tiebreak');
    expect(v.current).toBe(0);
    expect(v.rows.map(r => r.out)).toEqual([false, false, true]);
    // Player 2 is skipped.
    expect(shanghai.view([...tie, ...visit('S20')], 3, o7).current).toBe(1);
  });

  it('is won by the most points in the round', () => {
    const v = shanghai.view([...tie, ...visit('S20'), ...visit('D20')], 3, o7);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([1]);
    expect(v.result).toMatch(/tiebreak/i);
  });

  it('goes on to a second round on 20 with those still tied', () => {
    const second = [...tie, ...visit('S20'), ...visit('S20')];
    const v = shanghai.view(second, 3, o7);
    expect(v.phase).toBe('throwing');
    expect(v.tiebreak).toBe(true);
    expect(v.current).toBe(0);
    const win = shanghai.view([...second, ...visit('Miss'), ...visit('S20')], 3, o7);
    expect(win.winners).toEqual([1]);
  });

  it('drops a player who scored less in a round from the next one', () => {
    // Three tied on 0; round 1 of the tiebreak: 0 scores 20, 1 scores 20, 2 scores 0.
    const log = [...blanks(7, 3), ...visit('S20'), ...visit('S20'), ...visit('Miss')];
    const v = shanghai.view(log, 3, o7);
    expect(v.rows.map(r => r.out)).toEqual([false, false, true]);
    expect(v.current).toBe(0);
  });

  it('is won outright by a Shanghai on 20', () => {
    const v = shanghai.view([...tie, ...visit('S20'), ...visit('S20', 'D20', 'T20')], 3, o7);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([1]);
  });

  it('a Shanghai on 20 by the first tied player ends it too', () => {
    const v = shanghai.view([...tie, ...visit('T20', 'D20', 'S20')], 3, o7);
    expect(v.winners).toEqual([0]);
  });
});

describe('shanghai screen', () => {
  it('keeps the round and sector of the last visit until Takeout', () => {
    const third = [...visit('S1'), d('S1'), d('Miss'), d('Miss')];
    const open = shanghai.view(third, 2, o7);
    expect(open.round).toBe(1);
    expect(open.sector).toBe(1);
    expect(open.hero.caption).toBe('Round 1 / 7');
    expect(open.visit.good).toEqual([true, false, false]);
    const closed = shanghai.view([...third, next], 2, o7);
    expect(closed.round).toBe(2);
    expect(closed.sector).toBe(2);
  });

  it('keeps the last round, and everyone in, until Takeout when the round ends in a tie', () => {
    const tie = [...blanks(6, 3), ...visit('S7'), ...visit('S7'), d('Miss'), d('Miss'), d('Miss')];
    const open = shanghai.view(tie, 3, o7);
    expect(open.tiebreak).toBe(false);
    expect(open.sector).toBe(7);
    expect(open.rows.map(r => r.out)).toEqual([false, false, false]);
    const closed = shanghai.view([...tie, next], 3, o7);
    expect(closed.tiebreak).toBe(true);
    expect(closed.rows.map(r => r.out)).toEqual([false, false, true]);
  });

  it('keeps players who sat out the tiebreak greyed on the win screen', () => {
    const tie = [...blanks(6, 3), ...visit('S7'), ...visit('S7'), ...visit('Miss')];
    const won = shanghai.view([...tie, ...visit('S20'), ...visit('D20')], 3, o7);
    expect(won.phase).toBe('matchWon');
    expect(won.rows.map(r => r.out)).toEqual([false, false, true]);
  });
});

describe('shanghai undo and fix', () => {
  it('recomputes from the log: undo takes back a win and a tiebreak', () => {
    const win = [...blank, ...visit('T1', 'T1', 'T1'), ...blank, ...visit('T2', 'T2', 'T2'), ...visit('S3', 'T3', 'D3')];
    expect(shanghai.view(win, 2, o7).phase).toBe('matchWon');
    expect(shanghai.view([...win, { t: 'undo' }], 2, o7).phase).toBe('throwing');
    const tie = [...blanks(6, 2), ...visit('S7'), ...visit('S7')];
    expect(shanghai.view(tie, 2, o7).tiebreak).toBe(true);
    expect(shanghai.view([...tie, { t: 'undo' }], 2, o7).tiebreak).toBe(false);
    expect(shanghai.view([...tie, { t: 'undo' }], 2, o7).phase).toBe('throwing');
  });

  it('a fix changes the points, and can make or break a Shanghai', () => {
    const log = [d('S1'), d('D1'), d('S1')];
    expect(shanghai.view(log, 2, o7).phase).toBe('throwing');
    const fixed = shanghai.view([...log, { t: 'fix', index: 2, dart: parseDart('T1')! }], 2, o7);
    expect(fixed.phase).toBe('matchWon');
    const broken = shanghai.view([...log, { t: 'fix', index: 2, dart: parseDart('T1')! }, { t: 'fix', index: 2, dart: parseDart('S5')! }], 2, o7);
    expect(broken.phase).toBe('throwing');
    expect(broken.points[0]).toBe(3);
  });

  it('a fix can break a tie', () => {
    const tie = [...blanks(6, 2), ...visit('S7'), d('S7'), d('Miss'), d('Miss')];
    expect(shanghai.view([...tie, next], 2, o7).tiebreak).toBe(true);
    const fixed = shanghai.view([...tie, { t: 'fix', index: 1, dart: parseDart('D7')! }], 2, o7);
    expect(fixed.phase).toBe('matchWon');
    expect(fixed.winners).toEqual([1]);
  });
});

describe('shanghai view and stats', () => {
  it('keeps the visit points on screen after the visit, then resets', () => {
    const v = shanghai.view([d('T1'), d('S1'), d('Miss')], 2, o7);
    expect(v.visitPoints).toBe(4);
    expect(v.visit.verdict).toBeNull();
    expect(shanghai.view([d('T1'), d('S1'), d('Miss'), next], 2, o7).visitPoints).toBe(0);
  });

  it('headlines a Shanghai visit on the turn card', () => {
    const v = shanghai.view([d('T1'), d('S1'), d('D1')], 2, o7);
    expect(v.visit.verdict).toEqual({ text: 'Shanghai', tone: 'good' });
  });

  it('keeps darts, hits and Shanghais for the stats, hit rate being hits / darts', () => {
    const v = shanghai.view([...visit('S1', 'Miss', 'S5'), ...visit('S1')], 1, o7);
    expect(v.stats).toEqual([{ darts: 6, hits: 1, shanghais: 0 }]);
  });

  it('describes itself and normalizes options', () => {
    expect(shanghai.describe(o7, 2)).toBe('Shanghai · 7 rounds');
    expect(shanghai.describe(o20, 2)).toBe('Shanghai · 20 rounds');
    expect(shanghai.normalizeOptions({ rounds: 13 }).rounds).toBe(7);
    expect(shanghai.normalizeOptions({ rounds: 20 }).rounds).toBe(20);
    expect(shanghai.normalizeOptions(null).rounds).toBe(7);
    expect(shanghai.minPlayers).toBe(1);
  });

  it('compacts the visits and the winner for history', () => {
    const win = [...visit('S1'), ...visit('T1'), ...visit('S2', 'T2', 'D2')];
    const legs = shanghai.compact(win, 2, o7);
    expect(legs).toHaveLength(1);
    expect(legs[0].winner).toBe(0);
    expect(legs[0].visits).toHaveLength(3);
  });
});
