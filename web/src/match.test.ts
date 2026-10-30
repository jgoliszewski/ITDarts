import { describe, expect, it } from 'vitest';
import type { MiniMatch } from './match.ts';
import { dartTone } from './match.ts';

// Bug reports: ATC and Cricket darts on the main screen were orange, the summary showed green and red.
describe('minigame dart tile colour', () => {
  const tone = (game: string, good: boolean) => dartTone({ game } as MiniMatch, good);

  it('shows hits green and misses red in games counted in hits', () => {
    for (const game of ['atc', 'cricket', 'fullboard', 'shanghai', 'football']) {
      expect(tone(game, true)).toBe('hit');
      expect(tone(game, false)).toBe('miss');
    }
  });

  it('dims darts that did nothing in scoring games', () => {
    for (const game of ['hol', '121', 'randomco', 'gotcha', 'knockout']) {
      expect(tone(game, true)).toBe('');
      expect(tone(game, false)).toBe('dead');
    }
  });
});
