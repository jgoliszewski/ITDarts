import { describe, expect, it } from 'vitest';
import type { LadderMark } from '../records.ts';
import { ladderWindow } from './Ladder.tsx';

const best = (value: number): LadderMark => ({ value, kind: 'best', label: 'Best' });
const pb = (value: number): LadderMark => ({ value, kind: 'pb', label: 'PB' });
/** Per rung: the flags as “label value far/beaten”. */
const flags = (target: number, marks: LadderMark[]) =>
  ladderWindow(target, marks).map(r => r.flags.map(f => `${f.label} ${f.value}${f.far ? ' far' : ''}${f.beaten ? ' beaten' : ''}`));

describe('121 ladder window', () => {
  it('starts with an empty field behind 121 and three ahead', () => {
    const w = ladderWindow(121, []);
    expect(w.map(r => r.target)).toEqual([null, 121, 122, 123, 124]);
    expect(w.map(r => r.done)).toEqual([false, false, false, false, false]);
    expect(w[1].current).toBe(true);
    expect(w.every(r => r.flags.length === 0)).toBe(true);
  });

  it('shows the last checkout as done', () => {
    const w = ladderWindow(123, []);
    expect(w.map(r => r.target)).toEqual([122, 123, 124, 125, 126]);
    expect(w[0].done).toBe(true);
    expect(w[1].current).toBe(true);
  });

  it('puts the flag on the record field', () => {
    expect(flags(121, [best(123)])).toEqual([[], [], [], ['Best 123'], []]);
    expect(flags(121, [best(121)])[1]).toEqual(['Best 121']);
  });

  it('pins the flag to the right edge while the record is further ahead', () => {
    expect(flags(121, [best(135)])).toEqual([[], [], [], [], ['Best 135 far']]);
    expect(flags(132, [best(135)])).toEqual([[], [], [], [], ['Best 135']]);
  });

  it('leaves a beaten record on its green field while it is in the window, then drops it', () => {
    expect(flags(124, [best(123)])).toEqual([['Best 123 beaten'], [], [], [], []]);
    expect(ladderWindow(124, [best(123)])[0].done).toBe(true);
    expect(flags(125, [best(123)]).flat()).toEqual([]);
  });

  it('shows the PB next to the Best, each on its own field or both on the edge', () => {
    expect(flags(126, [pb(128), best(135)])).toEqual([[], [], [], ['PB 128'], ['Best 135 far']]);
    expect(flags(121, [pb(128), best(135)])).toEqual([[], [], [], [], ['PB 128 far', 'Best 135 far']]);
    expect(flags(129, [pb(128), best(135)])).toEqual([['PB 128 beaten'], [], [], [], ['Best 135 far']]);
  });
});
