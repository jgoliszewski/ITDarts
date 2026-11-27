import { describe, expect, it } from 'vitest';
import { bullseye } from '../../../games/bullseye.ts';
import { cricket } from '../../../games/cricket.ts';
import { parseDart } from '../../../games/darts.ts';
import { football } from '../../../games/football.ts';
import { freethrow } from '../../../games/freethrow.ts';
import { killer } from '../../../games/killer.ts';
import { atc, fullBoard } from '../../../games/race.ts';
import { shanghai } from '../../../games/shanghai.ts';
import type { TurnEvent } from '../../../games/turns.ts';
import { boardCaption, boardNote, boardProgress, boardStats } from './boardHero.ts';
import type { BoardMatch } from './boardTargets.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];
const roster = (n: number) => ['Alice', 'Bob', 'Cy', 'Dana', 'Max'].slice(0, n).map(name => ({ name, playerId: null }));
const match = (game: BoardMatch['game'], options: object, view: { rows: unknown[] }) =>
  ({ game, options, view, roster: roster(view.rows.length) }) as unknown as BoardMatch;

describe('ATC and Full Board around the board', () => {
  const o = { ...atc.defaults, order: 'numeric' as const };
  // 1 and 2 cleared with 6 darts, 2 of them hits.
  const m = match('atc', o, atc.view([...visit('S1', 'S5', 'S7'), ...visit('S20', 'S2', 'S9')], 1, o));

  it('shows darts, hit rate and darts per target', () => {
    expect(boardStats(m)).toEqual([['Darts', '6'], ['Hit rate', '33.3%'], ['Per target', '3.0']]);
  });

  it('shows a dash before the first target or dart, never a division by zero', () => {
    expect(boardStats(match('atc', o, atc.view([], 1, o)))).toEqual([['Darts', '0'], ['Hit rate', '–'], ['Per target', '–']]);
  });

  it('keeps the Target kicker and drops the progress line the board and the stats already show', () => {
    expect(boardCaption(m)).toBe('Target');
    expect(boardNote(m)).toBeNull();
  });

  it('fills the bar with the targets cleared, per player', () => {
    const two = match('atc', o, atc.view([...visit('S1', 'S2', 'S3'), d('S1')], 2, o));
    expect(boardProgress(two, 0)).toBeCloseTo(3 / 21);
    expect(boardProgress(two, 1)).toBeCloseTo(1 / 21);
  });

  it('counts darts per sector and fills the bar with the sectors cleared in Full Board', () => {
    const fo = fullBoard.defaults;
    // Player 2 is throwing: two darts, one sector.
    const f = match('fullboard', fo, fullBoard.view([d('S20'), d('S1'), d('T3'), next, d('S5'), d('S5')], 2, fo));
    expect(boardStats(f)).toEqual([['Darts', '2'], ['Hit rate', '50%'], ['Per sector', '2.0']]);
    expect(boardProgress(f, 0)).toBeCloseTo(3 / 21);
    expect(boardProgress(f, 1)).toBeCloseTo(1 / 21);
    expect(boardNote(f)).toBeNull();
  });
});

describe('Cricket around the board', () => {
  const o = { ...cricket.defaults, sectors: 'classic' as const };
  const m = (events: TurnEvent[], players = 2) => match('cricket', o, cricket.view(events, players, o));

  it('drops the Points kicker, keeps MPR under the score and shows marks and darts', () => {
    const c = m([d('T20'), d('S19'), d('S1')]);
    expect(boardCaption(c)).toBeNull();
    expect(boardNote(c)).toBe('MPR 4.00');
    expect(boardStats(c)).toEqual([['Marks', '4'], ['Darts', '3']]);
  });

  it('solo: the darts are the big number with their kicker, so only the marks below', () => {
    const solo = m([d('T20'), d('S19')], 1);
    expect(boardCaption(solo)).toBe('Darts');
    expect(boardStats(solo)).toEqual([['Marks', '4']]);
  });

  it('has no bar: the grid is the list', () => {
    expect(boardProgress(m([]), 0)).toBeNull();
  });
});

describe('Killer around the board', () => {
  const numbers = [14, 5, 17, 9, 11];
  const o = { ...killer.defaults, lives: 1 };
  const m = (events: TurnEvent[], players = 5) => match('killer', o, killer.view([{ t: 'numbers', numbers: numbers.slice(0, players) }, ...events], players, o));

  it('counts lives taken and the rivals still in, without an eliminated one', () => {
    // Player 0 becomes a killer and eliminates 5 (one life).
    expect(boardStats(m([d('D14'), d('D5')]))).toEqual([['Lives taken', '1'], ['Rivals left', '3']]);
    expect(boardStats(m([]))).toEqual([['Lives taken', '0'], ['Rivals left', '4']]);
  });

  it('drops the line about the double to hit: the board shows it', () => {
    expect(boardNote(m([]))).toBeNull();
    expect(boardNote(m([d('D14')]))).toBeNull();
    expect(boardCaption(m([]))).toBe('Your double');
    expect(boardCaption(m([d('D14')]))).toBe('Killer');
  });

  it('has no bar: the hearts are the progress', () => {
    expect(boardProgress(m([]), 1)).toBeNull();
  });
});

describe('Football around the board', () => {
  const o = { ...football.defaults, goalsOn: 'doubles' as const, kickOff: 'any' as const, goals: 5 as const };
  const m = (events: TurnEvent[]) => match('football', o, football.view(events, 2, o));

  it('says who has the ball, not which ring scores', () => {
    expect(boardNote(m([]))).toBe('Ball in the centre');
    expect(boardNote(m([d('25')]))).toBe('⚽ Your ball');
    expect(boardNote(m(visit('25')))).toBe('Alice has the ball');
  });

  it('shows the goals still needed and fills the bar with the goals', () => {
    const g = m([d('25'), d('D20'), d('D20')]);
    expect(boardStats(g)).toEqual([['To win', '3']]);
    expect(boardProgress(g, 0)).toBeCloseTo(2 / 5);
    expect(boardProgress(g, 1)).toBe(0);
  });
});

describe('Shanghai, Bullseye and Free throw around the board', () => {
  it('Shanghai: darts, hit rate and Shanghais; the points stay in the line', () => {
    const o = shanghai.defaults;
    const s = match('shanghai', o, shanghai.view([d('T1'), d('S1'), d('S5')], 1, o));
    expect(boardStats(s)).toEqual([['Darts', '3'], ['Hit rate', '66.7%'], ['Shanghais', '0']]);
    expect(boardNote(s)).toBe(s.view.hero.note);
    expect(boardProgress(s, 0)).toBeNull();
  });

  it('Bullseye: no stats beyond the points, the scoring line stays', () => {
    const b = match('bullseye', bullseye.defaults, bullseye.view([], 1, bullseye.defaults));
    expect(boardStats(b)).toEqual([]);
    expect(boardNote(b)).toBe(b.view.hero.note);
    expect(boardNote(b)).toMatch(/^Bull/);
  });

  it('Free throw: average, darts and highest visit', () => {
    const o = freethrow.defaults;
    const f = match('freethrow', o, freethrow.view([...visit('T20', 'T20', 'S20'), d('S1')], 1, o));
    expect(boardStats(f)).toEqual([['Average', '105.8'], ['Darts', '4'], ['Highest visit', '140']]);
  });
});
