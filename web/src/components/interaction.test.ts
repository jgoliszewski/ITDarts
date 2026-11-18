import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createModalStack, createPresence, listboxKey, stepOf } from './interaction.ts';

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

  it('comes back without unmounting when shown again while leaving, marked as back', () => {
    const p = createPresence(150, () => {});
    p.set(true);
    p.set(false);
    vi.advanceTimersByTime(100);
    p.set(true);
    expect(p.state()).toBe('back');
    vi.advanceTimersByTime(200);
    expect(p.state()).toBe('back');
  });

  it('leaves and returns normally after coming back', () => {
    const p = createPresence(150, () => {});
    p.set(true); p.set(false); p.set(true);
    p.set(false);
    expect(p.state()).toBe('leaving');
    vi.advanceTimersByTime(150);
    expect(p.state()).toBe('gone');
    p.set(true);
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

/** A fake DOM: elements with a parent, a connected flag and an inert flag; focus is a variable. */
function fakeDom() {
  type El = { name: string; parent: El | null; connected: boolean; inert: boolean };
  let focused: El | null = null;
  const focusLog: string[] = [];
  const el = (name: string, parent: El | null = null): El => ({ name, parent, connected: true, inert: false });
  const inside = (box: El, e: El) => { for (let x: El | null = e; x; x = x.parent) if (x === box) return true; return false; };
  const dom = {
    contains: inside,
    usable: (e: El) => { if (!e.connected) return false; for (let x: El | null = e; x; x = x.parent) if (x.inert) return false; return true; },
    focus: (e: El) => { focused = e; focusLog.push(e.name); },
    focusIn: (box: El) => { focused = box; focusLog.push(`in ${box.name}`); },
    active: () => focused,
  };
  return { el, dom, focusLog, setFocus: (e: El) => { focused = e; }, focused: () => focused };
}

describe('createModalStack', () => {
  it('gives the focus back to the trigger when the last modal closes', () => {
    const f = fakeDom();
    const stack = createModalStack(f.dom);
    const menuBtn = f.el('menu button'), menu = f.el('menu');
    const close = stack.open(menu, menuBtn);
    f.setFocus(f.el('item', menu));
    close();
    expect(f.focusLog).toEqual(['menu button']);
  });

  it('leaves the focus in a window opened from the menu while the menu plays its exit', () => {
    const f = fakeDom();
    const stack = createModalStack(f.dom);
    const menuBtn = f.el('menu button'), menu = f.el('menu'), endItem = f.el('End match', menu), end = f.el('end dialog');
    const closeMenu = stack.open(menu, menuBtn);
    menu.inert = true; // leaving
    const closeEnd = stack.open(end, endItem);
    f.setFocus(f.el('Keep playing', end));
    closeMenu(); // the menu unmounts after its exit, under the open dialog
    expect(f.focusLog).toEqual([]);
    expect(stack.isTop(end)).toBe(true);
    menu.connected = false; endItem.connected = false;
    closeEnd();
    expect(f.focusLog).toEqual(['menu button']);
  });

  it('gives the focus back to a button inside the modal underneath', () => {
    const f = fakeDom();
    const stack = createModalStack(f.dom);
    const panelBtn = f.el('panel button'), drawer = f.el('drawer'), reset = f.el('Reset', drawer), confirm = f.el('confirm');
    stack.open(drawer, panelBtn);
    const closeConfirm = stack.open(confirm, reset);
    f.setFocus(f.el('Cancel', confirm));
    closeConfirm();
    expect(f.focusLog).toEqual(['Reset']);
  });

  it('moves the focus into the modal left on top when its trigger is gone', () => {
    const f = fakeDom();
    const stack = createModalStack(f.dom);
    const drawer = f.el('drawer'), gone = f.el('gone', drawer), confirm = f.el('confirm');
    stack.open(drawer, f.el('panel button'));
    const closeConfirm = stack.open(confirm, gone);
    gone.connected = false;
    f.setFocus(f.el('Cancel', confirm));
    closeConfirm();
    expect(f.focusLog).toEqual(['in drawer']);
  });

  it('does not focus a trigger that is gone or inert', () => {
    const f = fakeDom();
    const stack = createModalStack(f.dom);
    const btn = f.el('button'), box = f.el('box');
    const close = stack.open(box, btn);
    btn.inert = true;
    close();
    expect(f.focusLog).toEqual([]);
  });

  it('answers Escape only for the top modal', () => {
    const f = fakeDom();
    const stack = createModalStack(f.dom);
    const a = f.el('a'), b = f.el('b');
    stack.open(a, null);
    const closeB = stack.open(b, null);
    expect(stack.isTop(a)).toBe(false);
    expect(stack.isTop(b)).toBe(true);
    closeB();
    expect(stack.isTop(a)).toBe(true);
  });

  it('closes each modal once', () => {
    const f = fakeDom();
    const stack = createModalStack(f.dom);
    const btn = f.el('button'), a = f.el('a'), b = f.el('b');
    const closeA = stack.open(a, btn);
    stack.open(b, null);
    closeA();
    closeA();
    expect(stack.isTop(b)).toBe(true);
  });
});
