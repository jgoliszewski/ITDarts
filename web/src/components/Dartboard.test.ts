import { describe, expect, it } from 'vitest';
import type { Dart } from '../../../games/darts.ts';
import { BOARD_ORDER } from '../../../games/darts.ts';
import { DOT, R, SHOWN, coordsSpot, dartSpot } from './Dartboard.tsx';

// The scoreboard board widens trebles, doubles and the bulls, so check every dot still sits wholly in its own field.
describe('dart dots on the scoreboard board', () => {
  const fields: [1 | 2 | 3, number, number][] = [[1, SHOWN[3], SHOWN[4]], [3, SHOWN[2], SHOWN[3]], [2, SHOWN[4], SHOWN[5]]];

  it('keeps each dart inside its sector and ring', () => {
    for (const n of BOARD_ORDER) for (const [m, inner, outer] of fields) for (const i of [0, 1, 2]) {
      const [x, y] = dartSpot({ n, m }, i, SHOWN);
      const r = Math.hypot(x, y);
      expect(r - DOT, `${m}×${n} dart ${i}`).toBeGreaterThanOrEqual(inner);
      expect(r + DOT, `${m}×${n} dart ${i}`).toBeLessThanOrEqual(outer);
      const angle = (Math.atan2(x, -y) * 180) / Math.PI;
      const off = Math.abs(((angle - BOARD_ORDER.indexOf(n) * 18 + 540) % 360) - 180);
      expect(off + (Math.asin(DOT / r) * 180) / Math.PI, `${m}×${n} dart ${i}`).toBeLessThanOrEqual(9);
    }
  });

  it('keeps 25 in the outer bull and the bull in the bullseye', () => {
    for (const i of [0, 1, 2]) {
      const outer: Dart = { n: 25, m: 1 }, bull: Dart = { n: 25, m: 2 };
      const r25 = Math.hypot(...dartSpot(outer, i, SHOWN));
      expect(r25 - DOT).toBeGreaterThanOrEqual(SHOWN[0]);
      expect(r25 + DOT).toBeLessThanOrEqual(SHOWN[1]);
      expect(Math.hypot(...dartSpot(bull, i, SHOWN)) + DOT).toBeLessThanOrEqual(SHOWN[0]);
    }
  });
});

describe('Board Manager coords on the scoreboard board', () => {
  it('keeps the ring and the angle', () => {
    const r = (x: number, y: number) => Math.hypot(...coordsSpot(x, y));
    expect(r(0, 103 / 170)).toBeCloseTo((SHOWN[2] + SHOWN[3]) / 2); // middle of the treble
    expect(r(166 / 170, 0)).toBeCloseTo((SHOWN[4] + SHOWN[5]) / 2); // middle of the double
    expect(r(0, 3 / 170)).toBeLessThan(SHOWN[0]); // bullseye
    expect(r(0, 1.1)).toBeGreaterThan(SHOWN[5]); // outside
    const [x, y] = coordsSpot(0, 0.6);
    expect(x).toBeCloseTo(0);
    expect(y).toBeLessThan(0); // up on the screen
  });
});

describe('Board Manager coords on the input board', () => {
  it('lands in the field it lights up, at the real angle', () => {
    const [x, y] = coordsSpot(0, 103 / 170, R); // middle of the treble 20
    expect(x).toBeCloseTo(0);
    expect(-y).toBeCloseTo((R[2] + R[3]) / 2); // SHOWN would give 201
    const [x2, y2] = coordsSpot(0.3, 0.3, R); // 45 degrees, up and right
    expect(x2).toBeCloseTo(-y2);
    expect(coordsSpot(0, 0, R)).toEqual([0, 0]);
  });
});
