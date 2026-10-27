import { describe, expect, it } from 'vitest';
import { parseDart } from '../../games/darts.ts';
import { GAMES } from '../../games/index.ts';
import type { GameId, TurnEvent } from '../../games/turns.ts';
import type { LiveMatch } from '../../server/protocol.ts';
import { dartCue } from './match.ts';

const darts = (...s: string[]): TurnEvent[] => [{ t: 'start', starter: 0 }, ...s.map(x => ({ t: 'dart' as const, dart: parseDart(x)!, at: 0 }))];
const cue = (game: GameId, ...s: string[]) =>
  dartCue({ game, key: 'k', view: GAMES[game].view(darts(...s), 2, GAMES[game].defaults) } as unknown as LiveMatch, s.length - 1);

describe('dart sounds', () => {
  it('sounds every dart in ATC, Full Board and Cricket', () => {
    expect(cue('atc', 'S1')).toBe('hit');
    expect(cue('atc', 'S1', 'S5')).toBe('miss');
    expect(cue('fullboard', 'S7', 'S7')).toBe('miss');
    expect(cue('cricket', 'T20')).toBe('hit');
    expect(cue('cricket', 'S14')).toBe('miss');
  });
  it('sounds Higher or Lower once, when the visit is decided', () => {
    expect(cue('hol', 'S20', 'S20')).toBeNull();
    expect(cue('hol', 'S20', 'S20', 'S20')).toBe('hit');
    expect(cue('hol', 'S20', 'S5', 'S1')).toBe('miss');
    expect(cue('hol', 'T20', 'Miss')).toBe('miss');
  });
  it('stays silent in the other games', () => {
    expect(cue('x01', 'T20')).toBeNull();
    expect(cue('killer', 'D20')).toBeNull();
  });
});
