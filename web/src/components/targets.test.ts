import { describe, expect, it } from 'vitest';
import { BOARD_ORDER } from '../../../games/darts.ts';
import { boardOf, isLit, numberTurn, outlineKey, runs } from './targets.ts';

/** 20 keys by BOARD_ORDER, `on` sectors keyed 'a' (or their own key), the rest null. */
const keysOf = (on: Record<number, string>) => BOARD_ORDER.map(n => on[n] ?? null);
const sectorsOf = (r: { k: number; len: number }) => Array.from({ length: r.len }, (_, i) => BOARD_ORDER[(r.k + i) % 20]);

describe('runs of neighbouring sectors', () => {
  it('is empty when nothing is keyed', () => {
    expect(runs(keysOf({}))).toEqual([]);
  });

  it('keeps a lone sector as a run of one', () => {
    expect(runs(keysOf({ 19: 'a' })).map(sectorsOf)).toEqual([[19]]);
  });

  it('merges neighbours with the same key', () => {
    expect(runs(keysOf({ 13: 'a', 6: 'a', 19: 'a' })).map(sectorsOf)).toEqual([[13, 6], [19]]);
  });

  it('wraps from 5 to 20 into one run', () => {
    const r = runs(keysOf({ 12: 'a', 5: 'a', 20: 'a', 1: 'a' }));
    expect(r.map(sectorsOf)).toEqual([[12, 5, 20, 1]]);
  });

  it('does not merge neighbours in different states', () => {
    const r = runs(keysOf({ 20: 'a', 1: 'b', 18: 'b' }));
    expect(r.map(x => [x.key, sectorsOf(x)])).toEqual([['a', [20]], ['b', [1, 18]]]);
  });

  it('makes the whole ring one run of 20 from 20', () => {
    expect(runs(BOARD_ORDER.map(() => 'a'))).toEqual([{ k: 0, len: 20, key: 'a' }]);
  });

  it('splits a ring keyed all round but one sector into one run of 19 across the seam', () => {
    const r = runs(BOARD_ORDER.map(n => (n === 6 ? null : 'a')));
    expect(r).toHaveLength(1);
    expect(sectorsOf(r[0])[0]).toBe(10);
    expect(r[0].len).toBe(19);
  });
});

describe('number orientation', () => {
  it('turns round exactly the numbers below 11 and 6', () => {
    const flipped = BOARD_ORDER.filter(n => numberTurn(n).flipped);
    expect(flipped.sort((a, b) => a - b)).toEqual([2, 3, 7, 8, 10, 15, 16, 17, 19]);
  });

  it('turns each number by its sector angle', () => {
    expect(numberTurn(20).angle).toBe(0);
    expect(numberTurn(6).angle).toBe(90);
    expect(numberTurn(3).angle).toBe(180);
    expect(numberTurn(11).angle).toBe(270);
  });
});

describe('lit parts of a wedge', () => {
  const parts = ['in', 3, 'big', 2] as const;
  const litOf = (b: ReturnType<typeof boardOf>, n = 20) => parts.filter(p => isLit(b, n, p));

  it('lights every part with any ring, only its ring otherwise', () => {
    expect(litOf(boardOf({ state: 'target', ring: 'any' }))).toEqual(parts);
    expect(litOf(boardOf({ state: 'target', ring: 3 }))).toEqual([3]);
    expect(litOf(boardOf({ state: 'target', ring: 2 }))).toEqual([2]);
  });

  it('lights only the big single for ring 1, not the inner single', () => {
    expect(litOf(boardOf({ state: 'target', ring: 1 }))).toEqual(['big']);
  });

  it('dims a segment without a ring, out of play or closed by all', () => {
    expect(litOf(boardOf({ state: 'done' }))).toEqual([]);
    expect(litOf(boardOf({ state: 'off' }))).toEqual([]);
    expect(litOf(boardOf({ state: 'closedAll', ring: 'any' }))).toEqual([]);
  });

  it('lights all with no target, only the whole ring when one counts all round', () => {
    expect(litOf(boardOf({ state: 'none' }))).toEqual(parts);
    expect(litOf(boardOf({ state: 'none' }, [], 2))).toEqual([2]);
  });
});

describe('outline key', () => {
  it('outlines a target or danger segment in its numeric ring, keyed by ring and colour', () => {
    expect(outlineKey({ state: 'target', ring: 2 })).toBe('2|target');
    expect(outlineKey({ state: 'danger', ring: 2 })).toBe('2|danger');
    expect(outlineKey({ state: 'target', ring: 3 })).not.toBe(outlineKey({ state: 'target', ring: 2 }));
  });

  it('draws no outline for any ring, or for done, off and closed segments', () => {
    expect(outlineKey({ state: 'target', ring: 'any' })).toBeNull();
    expect(outlineKey({ state: 'done', ring: 2 })).toBeNull();
    expect(outlineKey({ state: 'closedAll', ring: 2 })).toBeNull();
    expect(outlineKey({ state: 'off' })).toBeNull();
  });
});
