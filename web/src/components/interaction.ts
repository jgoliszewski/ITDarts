// Pure logic behind shared UI interactions, kept apart from React so it can be tested without a DOM.

export type PresenceState = 'gone' | 'shown' | 'leaving';

/**
 * Keeps content mounted while it plays its exit (DESIGN.md, Ruch): shown at once, 'leaving' for `exitMs` after it is
 * hidden, then gone. Shown again while leaving, it stays without a remount.
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
        if (state !== 'shown') to('shown');
      } else if (state === 'shown') {
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
