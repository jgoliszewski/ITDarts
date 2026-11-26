import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BOARD_ORDER } from '../../../games/darts.ts';
import { HeroBoard } from './HeroBoard.tsx';
import type { BoardTargets, Segment } from './targets.ts';
import { boardOf } from './targets.ts';

const svgOf = (board: BoardTargets) => renderToStaticMarkup(createElement(HeroBoard, { board, darts: [], label: 'x' }));
const OFF: Segment = { state: 'off' };
// An outline is a wire path under a coloured path of width 6.
const outlines = (svg: string, colour = '#F58224') => svg.match(new RegExp(`stroke="${colour}" stroke-width="6"`, 'g'))?.length ?? 0;

describe('the hero board', () => {
  it('outlines neighbouring targets in the same ring as one shape, a lone one as another', () => {
    const t: Segment = { state: 'target', ring: 2 };
    expect(outlines(svgOf(boardOf(OFF, [[13, t], [6, t], [19, t]])))).toBe(2);
  });

  it('does not join neighbours in different rings or colours', () => {
    expect(outlines(svgOf(boardOf(OFF, [[13, { state: 'target', ring: 2 }], [6, { state: 'target', ring: 3 }]])))).toBe(2);
    const svg = svgOf(boardOf(OFF, [[13, { state: 'target', ring: 2 }], [6, { state: 'danger', ring: 2 }]]));
    expect(outlines(svg)).toBe(1);
    expect(outlines(svg, '#FF5A5F')).toBe(1);
  });

  it('draws the whole ring as two circles', () => {
    const svg = svgOf(boardOf({ state: 'none' }, [], 2));
    expect(svg.match(/<circle r="(314|340)" fill="none" stroke="#F58224" stroke-width="6"/g)).toHaveLength(2);
  });

  it('outlines the bullseye only when only the bullseye counts', () => {
    expect(svgOf(boardOf(OFF, [[25, { state: 'target', ring: 2 }]]))).toContain('<circle r="16" fill="none" stroke="#F58224" stroke-width="6"');
    expect(outlines(svgOf(boardOf(OFF, [[25, { state: 'target', ring: 'any' }]])))).toBe(0);
  });

  it('hatches a wedge closed by everyone', () => {
    expect(svgOf(boardOf(OFF, [[20, { state: 'closedAll' }]])).match(/fill="url\(#hb-hatch\)"/g)).toHaveLength(4);
    expect(svgOf(boardOf(OFF))).not.toContain('fill="url(#hb-hatch)"');
  });

  it('draws one tick per entry, up to five', () => {
    const arcs = (svg: string) => svg.match(/A350 350 /g)?.length ?? 0;
    expect(arcs(svgOf(boardOf(OFF, [[20, { state: 'target', ring: 'any', ticks: [true, false, false] }]])))).toBe(3);
    expect(arcs(svgOf(boardOf(OFF, [[20, { state: 'danger', ring: 2, ticks: [true, true, true, false, false] }]])))).toBe(5);
  });

  it('turns the numbers below 11 and 6 round, the rest top outward', () => {
    const svg = svgOf(boardOf(OFF));
    const turn = (n: number) => Number(new RegExp(`rotate\\(([-\\d.]+) [^)]*\\)"[^>]*>${n}</text>`).exec(svg)![1]);
    expect(turn(20)).toBe(0);
    expect(turn(3)).toBe(360);
    expect(turn(10)).toBe(288);
    expect(turn(6)).toBe(90);
    expect(turn(11)).toBe(270);
  });

  it('draws a run longer than half the ring the long way round', () => {
    // One target: the other 19 segments are one grey band, 342 degrees.
    const svg = svgOf(boardOf(OFF, [[1, { state: 'target', ring: 'any' }]]));
    expect(svg).toMatch(/A413 413 0 1 1 [^"]+A353 353 0 1 0/);
  });

  it('has no running animation', () => {
    expect(svgOf(boardOf({ state: 'target', ring: 2 }))).not.toMatch(/class="tb-outline|animation/);
  });

  it('labels the board for screen readers and draws all 20 numbers', () => {
    const svg = renderToStaticMarkup(createElement(HeroBoard, { board: boardOf(OFF), darts: [], label: 'Target 7' }));
    expect(svg).toContain('aria-label="Target 7"');
    for (const n of BOARD_ORDER) expect(svg).toContain(`>${n}</text>`);
  });
});
