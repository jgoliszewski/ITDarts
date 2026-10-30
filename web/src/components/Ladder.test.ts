import { describe, expect, it } from 'vitest';
import { ladderWindow } from './Ladder.tsx';

describe('121 ladder window', () => {
  it('starts with an empty field behind 121 and three ahead', () => {
    const w = ladderWindow(121, null);
    expect(w.map(r => r.target)).toEqual([null, 121, 122, 123, 124]);
    expect(w.map(r => r.done)).toEqual([false, false, false, false, false]);
    expect(w[1].current).toBe(true);
    expect(w.every(r => r.flag === null)).toBe(true);
  });

  it('shows the last checkout as done', () => {
    const w = ladderWindow(123, null);
    expect(w.map(r => r.target)).toEqual([122, 123, 124, 125, 126]);
    expect(w[0].done).toBe(true);
    expect(w[1].current).toBe(true);
  });

  it('puts the flag on the record field', () => {
    expect(ladderWindow(121, 123).map(r => r.flag)).toEqual([null, null, null, 'here', null]);
    expect(ladderWindow(121, 121)[1].flag).toBe('here');
  });

  it('pins the flag to the right edge while the record is further ahead', () => {
    expect(ladderWindow(121, 135).map(r => r.flag)).toEqual([null, null, null, null, 'far']);
    expect(ladderWindow(132, 135).map(r => r.flag)).toEqual([null, null, null, null, 'here']);
  });

  it('leaves the flag on a beaten record while it is in the window, then drops it', () => {
    expect(ladderWindow(124, 123).map(r => r.flag)).toEqual(['here', null, null, null, null]);
    expect(ladderWindow(125, 123).every(r => r.flag === null)).toBe(true);
  });
});
