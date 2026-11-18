import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPresence, listboxKey, stepOf } from './interaction.ts';

describe('createPresence', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('mounts at once when shown', () => {
    const p = createPresence(150, () => {});
    expect(p.state()).toBe('gone');
    p.set(true);
    expect(p.state()).toBe('shown');
  });

  it('keeps the content while it leaves, then unmounts after the exit time', () => {
    const changes: string[] = [];
    const p = createPresence(150, s => changes.push(s));
    p.set(true);
    p.set(false);
    expect(p.state()).toBe('leaving');
    vi.advanceTimersByTime(149);
    expect(p.state()).toBe('leaving');
    vi.advanceTimersByTime(1);
    expect(p.state()).toBe('gone');
    expect(changes).toEqual(['shown', 'leaving', 'gone']);
  });

  it('comes back without unmounting when shown again while leaving', () => {
    const p = createPresence(150, () => {});
    p.set(true);
    p.set(false);
    vi.advanceTimersByTime(100);
    p.set(true);
    expect(p.state()).toBe('shown');
    vi.advanceTimersByTime(200);
    expect(p.state()).toBe('shown');
  });

  it('does nothing when hidden while already gone', () => {
    const changes: string[] = [];
    const p = createPresence(150, s => changes.push(s));
    p.set(false);
    vi.advanceTimersByTime(500);
    expect(p.state()).toBe('gone');
    expect(changes).toEqual([]);
  });

  it('stops its timer when disposed', () => {
    const changes: string[] = [];
    const p = createPresence(150, s => changes.push(s));
    p.set(true);
    p.set(false);
    p.dispose();
    vi.advanceTimersByTime(500);
    expect(changes).toEqual(['shown', 'leaving']);
  });
});

describe('listboxKey', () => {
  it('moves down and up, stopping at the ends', () => {
    expect(listboxKey('ArrowDown', 0, 3)).toEqual({ focus: 1 });
    expect(listboxKey('ArrowDown', 2, 3)).toEqual({ focus: 2 });
    expect(listboxKey('ArrowUp', 1, 3)).toEqual({ focus: 0 });
    expect(listboxKey('ArrowUp', 0, 3)).toEqual({ focus: 0 });
  });

  it('jumps to the first and the last option', () => {
    expect(listboxKey('Home', 2, 4)).toEqual({ focus: 0 });
    expect(listboxKey('End', 0, 4)).toEqual({ focus: 3 });
  });

  it('picks the focused option on Enter and Space', () => {
    expect(listboxKey('Enter', 1, 3)).toEqual({ pick: 1 });
    expect(listboxKey(' ', 2, 3)).toEqual({ pick: 2 });
  });

  it('closes on Escape and Tab', () => {
    expect(listboxKey('Escape', 1, 3)).toEqual({ close: true });
    expect(listboxKey('Tab', 1, 3)).toEqual({ close: true });
  });

  it('ignores other keys', () => {
    expect(listboxKey('a', 1, 3)).toBeNull();
  });
});

describe('stepOf', () => {
  it('starts without a step', () => {
    expect(stepOf(null, 121)).toEqual({ value: 121, step: 0 });
  });

  it('records the step when the value changes', () => {
    expect(stepOf({ value: 121, step: 0 }, 122)).toEqual({ value: 122, step: 1 });
    expect(stepOf({ value: 122, step: 1 }, 120)).toEqual({ value: 120, step: -2 });
  });

  it('keeps the last step through renders with the same value', () => {
    const moved = stepOf({ value: 121, step: 0 }, 122);
    expect(stepOf(moved, 122)).toBe(moved);
  });
});
