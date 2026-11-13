import { describe, expect, it } from 'vitest';
import { GAMES, GAME_GROUPS } from './index.ts';

describe('game groups', () => {
  it('cover every game exactly once, in the order of docs/GRY.md', () => {
    expect(GAME_GROUPS.map(g => [g.title, g.ids])).toEqual([
      ['Classic', ['x01']],
      ['Practice', ['atc', 'fullboard', '121', 'randomco', 'freethrow']],
      ['Versus', ['cricket', 'killer', 'hol', 'shanghai', 'gotcha', 'knockout', 'football', 'bullseye']],
    ]);
    expect(GAME_GROUPS.flatMap(g => g.ids).sort()).toEqual(Object.keys(GAMES).sort());
  });
});
