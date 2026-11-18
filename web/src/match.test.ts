import { describe, expect, it } from 'vitest';
import { parseDart } from '../../games/darts.ts';
import type { MiniMatch, X01Match } from './match.ts';
import { controls, dartTone, heroCorner, initials, turnPanel, visitScored } from './match.ts';
import type { ClientState, LiveMatch } from '../../server/protocol.ts';

// Bug reports: ATC and Cricket darts on the main screen were orange, the summary showed green and red.
describe('minigame dart tile colour', () => {
  const tone = (game: string, good: boolean) => dartTone({ game } as MiniMatch, good);

  it('shows hits green and misses red in games counted in hits', () => {
    for (const game of ['atc', 'cricket', 'fullboard', 'shanghai', 'football']) {
      expect(tone(game, true)).toBe('hit');
      expect(tone(game, false)).toBe('miss');
    }
  });

  it('colours Bullseye darts by their points: a gain green, −1 red, 0 grey', () => {
    const t = (s: string, coords?: { x: number; y: number }) => dartTone({ game: 'bullseye' } as MiniMatch, false, { dart: parseDart(s)!, coords, at: 0 });
    expect([t('Bull'), t('25'), t('S20'), t('S20', { x: 0.9, y: 0 }), t('T20'), t('Miss')]).toEqual(['hit', 'hit', 'dead', 'miss', 'miss', 'miss']);
  });

  it('dims darts that did nothing in scoring games', () => {
    for (const game of ['hol', '121', 'randomco', 'gotcha', 'knockout']) {
      expect(tone(game, true)).toBe('');
      expect(tone(game, false)).toBe('dead');
    }
  });
});

describe('Finish in Free throw', () => {
  const st = (game: string, phase: string, takeout = false) =>
    ({ match: { game, intro: false, bullTakeout: false, options: {}, view: { phase, visit: { darts: [], dartsLeft: 3 } } }, board: { connected: true, takeout: { active: takeout } } }) as unknown as ClientState;

  it('shows while throwing, also during the takeout, and only in Free throw', () => {
    expect(controls(st('freethrow', 'throwing')).finish).toBe(true);
    expect(controls(st('freethrow', 'throwing', true)).finish).toBe(true);
    expect(controls(st('freethrow', 'matchWon')).finish).toBe(false);
    expect(controls(st('randomco', 'throwing')).finish).toBe(false);
  });
});

// Variant D (DECISIONS.md): the hero's corner pill only for "Checked out" and "Needs a double to start"; a bust shows as BUST.
describe('X01 hero corner', () => {
  const x = (visit: object, checkedIn = true) => ({ game: 'x01', view: { current: 0, checkedIn: [checkedIn], visit: { bust: false, checkout: false, ...visit } } }) as unknown as X01Match;

  it('shows a checkout in green', () => {
    expect(heroCorner(x({ checkout: true }))).toEqual({ text: 'Checked out', tone: 'good' });
  });

  it('asks for a double in amber until the player is in', () => {
    expect(heroCorner(x({}, false))).toEqual({ text: 'Needs a double to start', tone: 'warn' });
  });

  it('shows nothing for a bust (the big BUST says it) or a plain visit', () => {
    expect(heroCorner(x({ bust: true }, false))).toBeNull();
    expect(heroCorner(x({}))).toBeNull();
  });
});

describe('visit total', () => {
  const d = (s: string) => ({ dart: parseDart(s)!, at: 0 });
  const mini = (game: string, view: object) => ({ game, view: { visit: { darts: [d('T20'), d('S5'), d('S1')], good: [true, false, true] }, ...view } }) as unknown as LiveMatch;

  it('is the X01 visit total, 0 after a bust', () => {
    expect(visitScored({ game: 'x01', view: { visit: { total: 85, bust: false } } } as unknown as LiveMatch)).toBe(85);
    expect(visitScored({ game: 'x01', view: { visit: { total: 85, bust: true } } } as unknown as LiveMatch)).toBe(0);
  });

  it('counts only the darts that scored in 121, Random Checkouts and Gotcha', () => {
    for (const game of ['121', 'randomco', 'gotcha']) expect(visitScored(mini(game, {}))).toBe(61);
  });

  it('takes the game\'s own number elsewhere, and none in games counted in hits', () => {
    expect(visitScored(mini('knockout', { visitScore: 66 }))).toBe(66);
    expect(visitScored(mini('freethrow', { visitTotal: 70 }))).toBe(70);
    expect(visitScored(mini('hol', { sum: 41 }))).toBe(41);
    expect(visitScored(mini('atc', {}))).toBeNull();
  });
});

describe('hero with a This turn panel', () => {
  it('is X01 and the minigames that score a visit without a board', () => {
    for (const game of ['x01', '121', 'randomco', 'gotcha', 'knockout']) expect(turnPanel({ game } as LiveMatch)).toBe(true);
    for (const game of ['hol', 'atc', 'cricket', 'killer', 'shanghai', 'freethrow', 'football', 'bullseye']) expect(turnPanel({ game } as LiveMatch)).toBe(false);
  });
});

describe('Cricket column initials (5+ players)', () => {
  it('takes two letters of a name, a guest keeps its number', () => {
    expect(['Anna', 'Aleksandra', 'Guest 2', 'Guest 12', 'Bo', 'Ż'].map(initials)).toEqual(['AN', 'AL', 'G2', 'G12', 'BO', 'Ż']);
  });
});
