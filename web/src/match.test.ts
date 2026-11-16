import { describe, expect, it } from 'vitest';
import { parseDart } from '../../games/darts.ts';
import type { MiniMatch } from './match.ts';
import { controls, dartTone } from './match.ts';
import type { ClientState } from '../../server/protocol.ts';

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
