import { describe, expect, it } from 'vitest';
import type { Dart } from '../../../games/darts.ts';
import { BOARD_ORDER } from '../../../games/darts.ts';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { isBigSingle } from '../../../games/darts.ts';
import { DOT, R, SHOWN, TargetBoard, coordsSpot, dartSpot, inputSpot, spotCoords } from './Dartboard.tsx';

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

  it('puts the ring edges on the ring radii', () => {
    expect(Math.hypot(...coordsSpot(0, 99 / 170, R))).toBeCloseTo(R[2]);
    expect(Math.hypot(...coordsSpot(162 / 170, 0, R))).toBeCloseTo(R[4]);
  });

  it('keeps a miss in view, on its own side', () => {
    const [x, y] = inputSpot(1.2, 1.2);
    expect(Math.hypot(x, y)).toBeLessThanOrEqual(380);
    expect(x).toBeCloseTo(-y); // 45 degrees, up and right
    expect(x).toBeGreaterThan(0);
    expect(inputSpot(0, 0.5)).toEqual(coordsSpot(0, 0.5, R)); // a hit is not touched
  });
});

describe('a tap on the fix board as Board Manager coords', () => {
  it('is the inverse of coordsSpot, ring by ring', () => {
    for (const [x, y] of [[0, 0.1], [0.05, 0.3], [0, 0.62], [-0.4, 0.5], [0.3, -0.7], [0, 0.97], [0.9, 0.9]]) {
      const [sx, sy] = coordsSpot(x, y, R);
      const c = spotCoords(sx, sy);
      expect(c.x, `${x},${y}`).toBeCloseTo(x);
      expect(c.y, `${x},${y}`).toBeCloseTo(y);
    }
    expect(spotCoords(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('points up for the top and keeps the ring edges on the real radii', () => {
    expect(spotCoords(0, -R[2])).toMatchObject({ x: 0 });
    expect(spotCoords(0, -R[2]).y).toBeCloseTo(99 / 170);
    expect(spotCoords(R[4], 0).x).toBeCloseTo(162 / 170);
    expect(spotCoords(0, -380).y).toBeGreaterThan(1); // the miss area, outside the double
  });

  it('taps in the middle of a field land in that field: outer single is big, inner single is not', () => {
    const tap = (r: number) => spotCoords(0, -r);
    expect(isBigSingle({ dart: { n: 20, m: 1 }, coords: tap((R[3] + R[4]) / 2) })).toBe(true);
    expect(isBigSingle({ dart: { n: 20, m: 1 }, coords: tap((R[1] + R[2]) / 2) })).toBe(false);
  });
});

describe('the Big singles outline on the hero board', () => {
  const outlines = (sectors: number[]) => renderToStaticMarkup(createElement(TargetBoard, { cleared: [], target: sectors, ring: 1, darts: [], label: 'x' })).match(/class="tb-outline"/g) ?? [];
  it('draws one outline per sector', () => {
    expect(outlines([20, 6, 3, 11])).toHaveLength(4);
    expect(outlines([])).toHaveLength(0);
  });

  it('outlines the field between the treble and the double', () => {
    const svg = renderToStaticMarkup(createElement(TargetBoard, { cleared: [], target: [20], ring: 1, darts: [], label: 'x' }));
    const d = /class="tb-outline" d="([^"]+)"/.exec(svg)![1];
    expect(d).toContain(`A${SHOWN[4]} ${SHOWN[4]}`);
    expect(d).toContain(`A${SHOWN[3]} ${SHOWN[3]}`);
  });
});
