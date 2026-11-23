// RecordDef.bound: the best result a game can still reach, for the record pills going out of reach (docs/GRY.md#rekordy-i-ekran-rekordu).
import { describe, expect, it } from 'vitest';
import { cricket } from './cricket.ts';
import { parseDart } from './darts.ts';
import { atc, fullBoard } from './race.ts';
import { shanghai } from './shanghai.ts';
import type { GameModule, TurnEvent } from './turns.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];

function bound<O>(game: GameModule<O>, events: TurnEvent[], players: number, o: O, player = 0) {
  return game.record!.bound!(game.view(events, players, o), player, o);
}

describe('ATC bound', () => {
  const noSkips = { ...atc.defaults, skips: false };

  it('adds one dart per target left to the darts used, without skips', () => {
    expect(bound(atc, [], 1, noSkips)).toBe(21);
    // S1, S2 and a miss: 3 darts, 19 targets left.
    expect(bound(atc, [d('S1'), d('S2'), d('Miss')], 1, noSkips)).toBe(22);
  });

  it('counts the same way with Doubles or Trebles, where skips are off', () => {
    const doubles = { ...atc.defaults, target: 'doubles' as const, skips: true };
    expect(bound(atc, [d('D1'), d('S2')], 1, doubles)).toBe(2 + 20);
  });

  it('counts only the darts used with skips, as a treble can jump targets', () => {
    expect(bound(atc, [], 1, atc.defaults)).toBe(0);
    expect(bound(atc, [d('T1'), d('Miss')], 1, atc.defaults)).toBe(2);
  });

  it('gives the player asked about, not the one throwing', () => {
    const events = [...visit('S1', 'S2', 'S3'), d('Miss')];
    expect(bound(atc, events, 2, noSkips, 0)).toBe(3 + 18);
    expect(bound(atc, events, 2, noSkips, 1)).toBe(1 + 21);
  });

  it('counts the team darts and the shared targets in co-op', () => {
    const coop = { ...noSkips, coop: true };
    const events = [...visit('S1', 'S2', 'Miss'), d('S3')];
    expect(bound(atc, events, 2, coop, 0)).toBe(4 + 18);
    expect(bound(atc, events, 2, coop, 1)).toBe(4 + 18);
  });

  it('is the result itself once the game is over', () => {
    const all = Array.from({ length: 7 }, (_, k) => visit(...[1, 2, 3].map(j => (k * 3 + j === 21 ? 'Bull' : `S${k * 3 + j}`)))).flat();
    const v = atc.view(all, 1, noSkips);
    expect(v.phase).toBe('matchWon');
    expect(atc.record!.bound!(v, 0, noSkips)).toBe(v.scores[0]);
  });
});

describe('Full Board bound', () => {
  it('adds one dart per sector still open to the darts used', () => {
    const o = fullBoard.defaults;
    expect(bound(fullBoard, [], 1, o)).toBe(21);
    // A sector hit twice clears it once.
    expect(bound(fullBoard, [d('S5'), d('S5'), d('T20')], 1, o)).toBe(3 + 19);
  });

  it('counts the team darts in co-op', () => {
    const coop = { ...fullBoard.defaults, coop: true };
    expect(bound(fullBoard, [...visit('S1', 'S2', 'Miss'), d('S3')], 2, coop, 1)).toBe(4 + 18);
  });
});

describe('solo Cricket bound', () => {
  const o = cricket.defaults;

  it('needs a treble per open number and two darts for the bull from the start', () => {
    expect(bound(cricket, [], 1, o)).toBe(6 + 2);
  });

  it('adds the fewest darts that close the missing marks', () => {
    // T20 closes 20, S19 leaves 2 marks on 19 (one dart), D25 leaves 1 on the bull (one dart), 18–15 one treble each.
    expect(bound(cricket, [d('T20'), d('S19'), d('D25')], 1, o)).toBe(3 + 1 + 4 + 1);
  });

  it('counts a miss as a dart used', () => {
    expect(bound(cricket, [d('Miss')], 1, o)).toBe(1 + 8);
  });
});

describe('solo Shanghai bound', () => {
  const o = shanghai.defaults;
  /** Trebles on every round from `from` to 7: 3 darts × 3 × sector. */
  const rest = (from: number) => Array.from({ length: 8 - from }, (_, i) => 9 * (from + i)).reduce((a, b) => a + b, 0);

  it('is three trebles a round from the start', () => {
    expect(bound(shanghai, [], 1, o)).toBe(rest(1));
  });

  it('adds trebles for the darts left in the round and the rounds after it', () => {
    // S1 + D1 = 3 points, one dart left at 1.
    expect(bound(shanghai, [d('S1'), d('D1')], 1, o)).toBe(3 + 3 + rest(2));
  });

  it('gives the same before and after the takeout of the round’s last visit', () => {
    expect(bound(shanghai, [d('S1'), d('D1'), d('Miss')], 1, o)).toBe(3 + rest(2));
    expect(bound(shanghai, visit('S1', 'D1', 'Miss'), 1, o)).toBe(3 + rest(2));
  });

  it('is the points once the game is over', () => {
    const all = Array.from({ length: 7 }, () => visit('Miss', 'Miss', 'S1')).flat();
    const v = shanghai.view(all, 1, o);
    expect(v.phase).toBe('matchWon');
    expect(shanghai.record!.bound!(v, 0, o)).toBe(v.points[0]);
  });
});
