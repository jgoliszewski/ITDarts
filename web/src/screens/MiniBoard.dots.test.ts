// Repro: Football hero board draws a dart at the middle of its field, not where Board Manager says it stuck.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../net.ts', () => ({ onFx: () => () => {}, send: async () => ({ ok: true }), useSnapshot: () => ({}) }));
import { football } from '../../../games/football.ts';
import { MiniHero } from './MiniBoard.tsx';
import { DOT, SHOWN, TargetBoard, coordsSpot, dartSpot } from '../components/Dartboard.tsx';

const o = { kickOff: 'any', goals: 5, bullOff: 'off' } as const;
// A single 20 thrown into the INNER single, a bit left of centre.
const coords = { x: -0.05, y: 0.4 }; // 68 mm from the centre, 7 degrees left of the 20 wire
const events = [{ t: 'dart', dart: { n: 20, m: 1 }, coords, at: 1 }] as never[];

describe('Football hero board', () => {
  it('draws a dart with coords where it stuck', () => {
    const view = football.view(events, 2, o as never);
    const m = { game: 'football', options: o, roster: [{ name: 'A' }, { name: 'B' }], view } as never;
    const svg = renderToStaticMarkup(createElement(MiniHero, { m, flash: null, onDart: () => {}, canEdit: false }));
    const dot = /<svg class="target-board"[\s\S]*?<circle cx="([-\d.e]+)" cy="([-\d.e]+)" r="7"/.exec(svg);
    expect(dot, 'a dart dot on the board').not.toBeNull();
    const [ex, ey] = coordsSpot(coords.x, coords.y);
    const off = Math.hypot(Number(dot![1]) - ex, Number(dot![2]) - ey);
    expect(off, `dot at ${dot![1]},${dot![2]}; coords put it at ${ex.toFixed(0)},${ey.toFixed(0)}`).toBeLessThan(2);
  });
});

// The hero board of ATC, Full Board, Shanghai, Football and Bullseye (TargetBoard) with and without coords.
describe('dart dots on the hero board', () => {
  const dots = (darts: { dart: { n: number; m: 1 | 2 | 3 }; good: boolean; coords?: { x: number; y: number } }[]) =>
    [...renderToStaticMarkup(createElement(TargetBoard, { cleared: [], target: null, ring: null, darts, label: 'x' }))
      .matchAll(/<circle cx="([-\d.e]+)" cy="([-\d.e]+)" r="7"/g)].map(m => [Number(m[1]), Number(m[2])]);

  it('keeps a miss with coords far off the board inside the view, on its own side', () => {
    const [[x, y]] = dots([{ dart: { n: 0, m: 1 }, good: false, coords: { x: 3, y: -3 } }]);
    expect(Math.abs(x) + DOT).toBeLessThanOrEqual(380);
    expect(Math.abs(y) + DOT).toBeLessThanOrEqual(380);
    expect(Math.hypot(x, y)).toBeCloseTo(368);
    expect(x).toBeGreaterThan(0); // down and right
    expect(y).toBeGreaterThan(0);
  });

  it('puts a dart without coords in the middle of its field, as before', () => {
    const darts = [{ dart: { n: 20, m: 1 as const }, good: true }, { dart: { n: 5, m: 3 as const }, good: false }];
    expect(dots(darts)).toEqual(darts.map((d, i) => [...dartSpot(d.dart, i, SHOWN)]));
  });
});
