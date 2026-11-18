// Pure logic behind shared UI interactions, kept apart from React so it can be tested without a DOM.

/** 'back': shown again while it was leaving; the content never left, so it must not play its entrance again. */
export type PresenceState = 'gone' | 'shown' | 'leaving' | 'back';

/**
 * Keeps content mounted while it plays its exit (DESIGN.md, Ruch): shown at once, 'leaving' for `exitMs` after it is
 * hidden, then gone. Shown again while leaving, it stays without a remount, as 'back'.
 */
export function createPresence(exitMs: number, onChange: (s: PresenceState) => void) {
  let state: PresenceState = 'gone';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const to = (s: PresenceState) => { state = s; onChange(s); };
  return {
    state: () => state,
    set(show: boolean) {
      if (show) {
        clearTimeout(timer);
        if (state === 'leaving') to('back');
        else if (state === 'gone') to('shown');
      } else if (state === 'shown' || state === 'back') {
        to('leaving');
        timer = setTimeout(() => to('gone'), exitMs);
      }
    },
    dispose: () => clearTimeout(timer),
  };
}

/** What a key does in an open listbox: move the focus, pick the focused option or close. */
export function listboxKey(key: string, focused: number, count: number): { focus: number } | { pick: number } | { close: true } | null {
  switch (key) {
    case 'ArrowDown': return { focus: Math.min(count - 1, focused + 1) };
    case 'ArrowUp': return { focus: Math.max(0, focused - 1) };
    case 'Home': return { focus: 0 };
    case 'End': return { focus: count - 1 };
    case 'Enter': case ' ': return { pick: focused };
    case 'Escape': case 'Tab': return { close: true };
    default: return null;
  }
}

export interface Step { value: number; step: number }

/** The last change of a value. Renders with the same value keep the same step, so an animation it started can finish. */
export function stepOf(prev: Step | null, value: number): Step {
  if (!prev) return { value, step: 0 };
  return prev.value === value ? prev : { value, step: value - prev.value };
}

export interface ModalDom<E> {
  contains(box: E, el: E): boolean;
  /** Connected and not inside anything inert. */
  usable(el: E): boolean;
  focus(el: E): void;
  /** Focus the first action inside a box. */
  focusIn(box: E): void;
  active(): E | null;
}

/**
 * Open modals, the last on top. Opening remembers where focus came from (and, when that is inside another modal,
 * that modal's own trigger, for when the first one is gone). Closing gives focus back only when it makes sense: never
 * to something under the modal left on top, and only when focus was in the closing box or nowhere.
 */
export function createModalStack<E>(dom: ModalDom<E>) {
  const stack: { box: E; back: E | null; outer: E | null }[] = [];
  return {
    isTop: (box: E) => stack.at(-1)?.box === box,
    open(box: E, back: E | null) {
      const owner = back === null ? undefined : stack.findLast(m => dom.contains(m.box, back));
      const entry = { box, back, outer: owner?.back ?? null };
      stack.push(entry);
      return () => {
        const i = stack.indexOf(entry);
        if (i < 0) return;
        stack.splice(i, 1);
        const top = stack.at(-1);
        const focus = dom.active();
        if (focus !== null && !dom.contains(box, focus) && dom.usable(focus)) return;
        const to = [entry.back, entry.outer].find(e => e !== null && dom.usable(e) && (!top || dom.contains(top.box, e)));
        if (to) dom.focus(to);
        else if (top) dom.focusIn(top.box);
      };
    },
  };
}
