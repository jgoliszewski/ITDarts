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
import type { Segment } from '../components/targets.ts';
import type { BoardMatch } from './boardTargets.ts';
import { boardTargets } from './boardTargets.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];

// A match as the hero gets it: only game, options and view matter to the board.
const match = (game: BoardMatch['game'], options: object, view: unknown) => ({ game, options, view }) as unknown as BoardMatch;
const board = (m: BoardMatch) => boardTargets(m).board;
/** Sectors in each state, sorted. */
const inState = (m: BoardMatch, state: Segment['state']) =>
  Object.entries(board(m).segments).filter(([, s]) => s.state === state).map(([n]) => Number(n)).sort((a, b) => a - b);

describe('ATC on the board', () => {
  const o = { ...atc.defaults, order: 'numeric' as const };
  it('greens the cleared targets and makes the next one the target, any ring', () => {
    const m = match('atc', o, atc.view([d('S1'), d('S2'), d('S20')], 1, o));
    expect(inState(m, 'done')).toEqual([1, 2]);
    expect(board(m).segments[3]).toEqual({ state: 'target', ring: 'any' });
    expect(inState(m, 'target')).toEqual([3]);
    expect(board(m).segments[20].state).toBe('off');
  });

  it('targets only the ring from the options, and only the bullseye for the bull', () => {
    const t = { ...o, target: 'trebles' as const };
    expect(board(match('atc', t, atc.view([], 1, t))).segments[1]).toEqual({ state: 'target', ring: 3 });
    const dbl = { ...o, target: 'doubles' as const };
    // Three doubles per visit, 1 to 18, then 19 and 20: the bull is next.
    const all = Array.from({ length: 7 }, (_, v) => visit(...[1, 2, 3].map(i => `D${v * 3 + i}`).filter(s => Number(s.slice(1)) <= 20))).flat();
    expect(board(match('atc', dbl, atc.view(all, 1, dbl))).segments[25]).toEqual({ state: 'target', ring: 2 });
    const tr = { ...o, target: 'trebles' as const };
    const trebles = all.map(e => (e.t === 'dart' ? { ...e, dart: { ...e.dart, m: 3 as const } } : e));
    expect(board(match('atc', tr, atc.view(trebles, 1, tr))).segments[25]).toEqual({ state: 'target', ring: 2 });
  });

  it('shows the board of the player throwing', () => {
    const m = match('atc', o, atc.view([...visit('S1', 'S2', 'S3'), d('S20')], 2, o));
    expect(inState(m, 'done')).toEqual([]);
    expect(inState(m, 'target')).toEqual([1]);
  });
});

describe('Full Board on the board', () => {
  it('targets every sector and the bull not cleared yet, in the ring from the options', () => {
    const o = { ...fullBoard.defaults, target: 'doubles' as const };
    const m = match('fullboard', o, fullBoard.view([d('D20'), d('S1'), d('D5')], 1, o));
    expect(inState(m, 'done')).toEqual([5, 20]);
    expect(inState(m, 'target')).toHaveLength(19);
    expect(board(m).segments[1]).toEqual({ state: 'target', ring: 2 });
    expect(board(m).segments[25]).toEqual({ state: 'target', ring: 2 });
  });
});

describe('Shanghai on the board', () => {
  const o = shanghai.defaults;
  it('targets the round sector, any ring, with ticks for its S, D and T hit this Turn', () => {
    const m = match('shanghai', o, shanghai.view([d('T1'), d('S1'), d('S5')], 1, o));
    expect(board(m).segments[1]).toEqual({ state: 'target', ring: 'any', ticks: [true, false, true] });
    expect(inState(m, 'target')).toEqual([1]);
  });

  it('starts a Turn with empty ticks', () => {
    expect(board(match('shanghai', o, shanghai.view([], 1, o))).segments[1].ticks).toEqual([false, false, false]);
  });
});

describe('Football on the board', () => {
  const dbl = { ...football.defaults, goalsOn: 'doubles' as const, kickOff: 'any' as const };
  it('targets the bull, any ring, without the ball', () => {
    const m = match('football', dbl, football.view([], 2, dbl));
    expect(board(m).segments[25]).toEqual({ state: 'target', ring: 'any' });
    expect(inState(m, 'target')).toEqual([25]);
  });

  it('targets only the bullseye with Bull only', () => {
    const o = { ...dbl, kickOff: 'bullseye' as const };
    expect(board(match('football', o, football.view([], 2, o))).segments[25]).toEqual({ state: 'target', ring: 2 });
  });

  it('lights the whole double ring with the ball on Doubles', () => {
    const b = board(match('football', dbl, football.view([d('25')], 2, dbl)));
    expect(b.wholeRing).toBe(2);
    expect(Object.values(b.segments).every(s => s.state === 'none')).toBe(true);
  });

  it('targets the big singles of the four drawn sectors with the ball on Big singles', () => {
    const o = { ...dbl, goalsOn: 'singles' as const };
    const v = football.view([d('25')], 2, o);
    const m = match('football', o, v);
    expect(v.sectors).toHaveLength(4);
    expect(inState(m, 'target')).toEqual([...v.sectors!].sort((a, b) => a - b));
    for (const n of v.sectors!) expect(board(m).segments[n]).toEqual({ state: 'target', ring: 1 });
  });

  it('targets the bull again when a rival has the ball', () => {
    const m = match('football', dbl, football.view(visit('25'), 2, dbl));
    expect(board(m).wholeRing).toBeUndefined();
    expect(inState(m, 'target')).toEqual([25]);
  });
});

describe('Bullseye and Free throw on the board', () => {
  it('Bullseye targets the bull, any ring, nothing else', () => {
    const m = match('bullseye', bullseye.defaults, bullseye.view([], 1, bullseye.defaults));
    expect(board(m).segments[25]).toEqual({ state: 'target', ring: 'any' });
    expect(inState(m, 'off')).toHaveLength(20);
  });

  it('Free throw has no target: every segment in full colours', () => {
    const m = match('freethrow', freethrow.defaults, freethrow.view([], 1, freethrow.defaults));
    expect(inState(m, 'none')).toHaveLength(21);
    expect(board(m).wholeRing).toBeUndefined();
  });
});

describe('Cricket Random on the board', () => {
  // The mapping reads the sectors from the view, so the classic ones stand in for a random draw.
  const o = { ...cricket.defaults, sectors: 'random' as const };
  const view = (events: TurnEvent[]) => cricket.view(events, 2, { ...o, sectors: 'classic' });

  it('ticks the marks of the player throwing on every sector in play, the rest out of play', () => {
    const m = match('cricket', o, view([d('T20'), d('D19'), d('S25')]));
    expect(board(m).segments[20]).toEqual({ state: 'done', ring: 'any', ticks: [true, true, true] });
    expect(board(m).segments[19]).toEqual({ state: 'target', ring: 'any', ticks: [true, true, false] });
    expect(board(m).segments[25]).toEqual({ state: 'target', ring: 'any', ticks: [true, false, false] });
    expect(board(m).segments[18]).toEqual({ state: 'target', ring: 'any', ticks: [false, false, false] });
    expect(inState(m, 'off')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it('hatches a sector closed by everyone and drops it from the label', () => {
    const m = match('cricket', o, view([...visit('T20'), d('T20')]));
    expect(board(m).segments[20]).toEqual({ state: 'closedAll' });
    expect(boardTargets(m).label).toBe('Sectors in play: 19 · 18 · 17 · 16 · 15 · Bull');
  });

  it('shows the rival\'s marks when the rival throws', () => {
    const m = match('cricket', o, view([...visit('T20'), d('S19')]));
    expect(board(m).segments[20]).toEqual({ state: 'target', ring: 'any', ticks: [false, false, false] });
    expect(board(m).segments[19].ticks).toEqual([true, false, false]);
  });
});

describe('Cricket on the board', () => {
  const o = { ...cricket.defaults, sectors: 'classic' as const };
  const m = (events: TurnEvent[], players = 2) => match('cricket', o, cricket.view(events, players, o));

  it('puts 15–20 and the bull in play, everything else out of play', () => {
    expect(inState(m([]), 'target')).toEqual([15, 16, 17, 18, 19, 20, 25]);
    expect(inState(m([]), 'off')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });

  it('keeps neighbours in different states apart: 20 closed by all, 1 out of play, 18 a target', () => {
    // 20, 1 and 18 sit next to each other on the board.
    const b = board(m([...visit('T20'), d('T20'), d('S18')]));
    expect([b.segments[20].state, b.segments[1].state]).toEqual(['closedAll', 'off']);
    expect(b.segments[5].state).toBe('off');
  });

  it('greens a sector closed by the player throwing only, next to a target with marks', () => {
    // 19 and 7: 19 closed by player 1, 3 (out of play) and 17 still open.
    const b = board(m([...visit('T19', 'S17'), ...visit('S20')]));
    expect(b.segments[19]).toEqual({ state: 'done', ring: 'any', ticks: [true, true, true] });
    expect(b.segments[17]).toEqual({ state: 'target', ring: 'any', ticks: [true, false, false] });
  });

  it('works with five players, ticks of the one throwing', () => {
    const b = board(m([...visit('T20'), ...visit('S20'), d('D20')], 5));
    expect(b.segments[20].ticks).toEqual([true, true, false]);
  });
});

describe('Killer on the board', () => {
  // Players 0–4 get numbers 14, 5, 17, 9, 11 (5 and 20 neighbour, 17 and 3 too).
  const numbers = [14, 5, 17, 9, 11];
  const o = { ...killer.defaults, lives: 5 };
  const start = (players = 5): TurnEvent[] => [{ t: 'numbers', numbers: numbers.slice(0, players) }];
  const m = (events: TurnEvent[], players = 5, opts = o) => match('killer', opts, killer.view([...start(players), ...events], players, opts));

  it('before killer status: only the own double is a target, ticks are the own lives', () => {
    const b = board(m([]));
    expect(b.segments[14]).toEqual({ state: 'target', ring: 2, ticks: [true, true, true, true, true] });
    expect(inState(m([]), 'target')).toEqual([14]);
    expect(b.segments[5].state).toBe('off');
  });

  it('as a killer: the doubles of living rivals are targets with their lives, the own double is danger', () => {
    // Player 0 becomes a killer and takes a life from 5.
    const b = board(m([d('D14'), d('D5')]));
    expect(b.segments[14]).toEqual({ state: 'danger', ring: 2, ticks: [true, true, true, true, true] });
    expect(b.segments[5]).toEqual({ state: 'target', ring: 2, ticks: [true, true, true, true, false] });
    expect(inState(m([d('D14'), d('D5')]), 'target')).toEqual([5, 9, 11, 17]);
    expect(b.segments[20].state).toBe('off');
  });

  it('puts an eliminated rival out of play', () => {
    const o1 = { ...o, lives: 1 };
    const mm = m([d('D14'), d('D5')], 5, o1);
    expect(board(mm).segments[5]).toEqual({ state: 'off' });
    expect(inState(mm, 'target')).toEqual([9, 11, 17]);
  });

  it('shows the board of the player throwing', () => {
    const b = board(m([...visit('D14', 'S1', 'S1'), d('S2')]));
    expect(b.segments[5]).toEqual({ state: 'target', ring: 2, ticks: [true, true, true, true, true] });
    expect(b.segments[14].state).toBe('off');
  });

  it('draws as many ticks as the lives option', () => {
    expect(board(m([], 2, { ...o, lives: 3 })).segments[14].ticks).toEqual([true, true, true]);
  });
});
