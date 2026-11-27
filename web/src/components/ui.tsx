import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { PresenceState } from './interaction.ts';
import { EXIT_MS, createModalStack, createPresence, listboxKey } from './interaction.ts';
import QRCode from 'qrcode';
import type { ClientState, Command } from '../../../server/protocol.ts';
import type { Result } from '../net.ts';
import { send } from '../net.ts';

// ---------- icons ----------

const svg = (path: ReactNode, size = 20) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
);

export const Icon = {
  menu: (s?: number) => svg(<path d="M4 7h16M4 12h16M4 17h16" />, s),
  board: (s?: number) => svg(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>, s),
  heart: (s?: number) => svg(<path d="M12 20.5 4.3 12.9a4.6 4.6 0 0 1 6.5-6.5L12 7.6l1.2-1.2a4.6 4.6 0 0 1 6.5 6.5Z" />, s),
  close: (s?: number) => svg(<path d="M18 6 6 18M6 6l12 12" />, s),
  back: (s?: number) => svg(<path d="m15 18-6-6 6-6" />, s),
  undo: (s?: number) => svg(<><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>, s),
  play: (s?: number) => <svg width={s ?? 20} height={s ?? 20} viewBox="0 0 24 24" fill="#F58224" aria-hidden="true"><path d="M6 4l14 8-14 8z" /></svg>,
  plus: (s?: number) => svg(<path d="M12 5v14M5 12h14" />, s),
  down: (s?: number) => svg(<path d="m6 9 6 6 6-6" />, s),
  spinner: () => (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="20" stroke="#4A3F22" strokeWidth="5" /><path d="M24 4a20 20 0 0 1 20 20" stroke="#F5B83D" strokeWidth="5" strokeLinecap="round" /></svg>
  ),
};

/**
 * A dropdown in the app's own style: a button with a colour mark, opening a list. The list opens on the chosen option
 * and works from the keyboard (↑ ↓ Home End to move, Enter or Space to pick, Escape to close); a click outside closes it.
 */
export function Dropdown<T extends string | number>({ value, options, color, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  color: string;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    addEventListener('pointerdown', out);
    return () => removeEventListener('pointerdown', out);
  }, [open]);
  useEffect(() => {
    if (open) list.current?.querySelectorAll<HTMLButtonElement>('[role=option]')[focused]?.focus({ preventScroll: false });
  }, [open, focused]);

  const show = () => { setFocused(Math.max(0, options.findIndex(o => o.value === value))); setOpen(true); };
  const close = (back: boolean) => { setOpen(false); if (back) btn.current?.focus(); };
  const pick = (i: number) => { close(true); if (options[i].value !== value) onChange(options[i].value); };
  const onKey = (e: ReactKeyboardEvent) => {
    const a = listboxKey(e.key, focused, options.length);
    if (!a) return;
    if (e.key !== 'Tab') e.preventDefault();
    if ('focus' in a) setFocused(a.focus);
    else if ('pick' in a) pick(a.pick);
    else close(e.key !== 'Tab');
  };
  return (
    <div className="pick" ref={ref}>
      <button ref={btn} id={id} className={`pick-btn ${open ? 'open' : ''}`} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={e => { if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); show(); } }}>
        <i style={{ background: color }} />
        <span>{options.find(o => o.value === value)?.label ?? '–'}</span>
        {Icon.down(18)}
      </button>
      {open && (
        <ul className="pick-list" role="listbox" aria-labelledby={id} ref={list} onKeyDown={onKey}>
          {options.map((o, i) => (
            <li key={o.value} role="presentation">
              <button type="button" role="option" aria-selected={o.value === value} tabIndex={i === focused ? 0 : -1}
                className={o.value === value ? 'on' : ''} onFocus={() => setFocused(i)} onClick={() => pick(i)}>
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** An empty state (DESIGN.md, EmptyState): what is missing, one sentence why, at most one action. Never a zero. */
export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export const Logo = () => <div className="logo"><span className="dot accent" />ITDarts</div>;

// ---------- toasts ----------

export interface Toast {
  id: number;
  text: string;
  kind?: 'error';
  action?: { label: string; run: () => void };
  ms?: number;
  /** Playing its exit; removed after EXIT_MS. */
  leaving?: boolean;
}

let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();
let toastId = 1;

export function toast(t: Omit<Toast, 'id'>) {
  const item = { ...t, id: toastId++ };
  toasts = [...toasts.slice(-2), item];
  toastListeners.forEach(l => l());
  setTimeout(() => dismissToast(item.id), t.ms ?? 4000);
}

export function dismissToast(id: number) {
  if (!toasts.some(t => t.id === id && !t.leaving)) return;
  toasts = toasts.map(t => (t.id === id ? { ...t, leaving: true } : t));
  toastListeners.forEach(l => l());
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
    toastListeners.forEach(l => l());
  }, EXIT_MS);
}

export function Toasts() {
  const list = useSyncExternalStore(l => (toastListeners.add(l), () => toastListeners.delete(l)), () => toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map(t => (
        <div key={t.id} className={`toast ${t.kind ?? ''} ${t.leaving ? 'leaving' : ''}`}>
          <span className="spacer">{t.text}</span>
          {t.action && <button className="btn" onClick={() => { t.action!.run(); dismissToast(t.id); }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}

/** Sends a command and shows the server's error, if any. */
export async function act(cmd: Command): Promise<Result> {
  const r = await send(cmd);
  if (!r.ok) toast({ text: r.error ?? 'Something went wrong', kind: 'error' });
  return r;
}

// ---------- dialog ----------

/**
 * Keeps its children on screen while they play their exit: when they turn to nothing, the last ones stay for EXIT_MS
 * inside a `display: contents` box marked `leaving` (CSS plays the exit) and `inert` (no clicks, no focus).
 * Shown again during the exit, the same box comes `back` at once, without its entrance, and focus goes back in.
 * Usage: `<Presence>{open && <Dialog … />}</Presence>`.
 */
export function Presence({ children }: { children: ReactNode }) {
  const show = children !== null && children !== undefined && children !== false;
  const last = useRef<ReactNode>(null);
  if (show) last.current = children;
  const wrap = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<PresenceState>(show ? 'shown' : 'gone');
  const [presence] = useState(() => createPresence(EXIT_MS, setState));
  useEffect(() => presence.set(show), [presence, show]);
  useEffect(() => () => presence.dispose(), [presence]);
  // Inert took the focus away while it was leaving; the modal stayed mounted, so it won't move focus in by itself.
  useEffect(() => {
    const box = wrap.current?.querySelector<HTMLElement>('[aria-modal]');
    if (state === 'back' && box && !box.contains(document.activeElement)) focusFirst(box);
  }, [state]);
  if (!show && state === 'gone') return null;
  const mark = !show ? 'leaving' : state === 'back' ? 'back' : '';
  return <div ref={wrap} className={`presence ${mark}`} inert={!show}>{show ? children : last.current}</div>;
}

const FOCUSABLE = 'button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';
const focusables = (box: HTMLElement) => [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(e => e.getClientRects().length > 0);
/** The first action that isn't destructive, else the box itself. */
function focusFirst(box: HTMLElement) {
  (focusables(box).find(e => !e.classList.contains('danger')) ?? box).focus({ preventScroll: true });
}
/** Open modals: only the top one answers Escape and keeps Tab; closing one puts focus back where it makes sense. */
const modals = createModalStack<HTMLElement>({
  contains: (box, el) => box.contains(el),
  usable: el => el.isConnected && !el.closest('[inert]'),
  focus: el => el.focus({ preventScroll: true }),
  focusIn: focusFirst,
  active: () => (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null),
});

/**
 * A modal box (dialog, menu, sheet, drawer): focus moves in on open (to what has autofocus, else the first action that
 * isn't destructive), Tab and Shift+Tab stay inside, Escape closes the top one (unless something inside already used
 * it, like an open list), and focus goes back to where it came from (createModalStack).
 * Pass `active` false while the box isn't on screen (a component that renders it only sometimes).
 */
export function useModal(ref: RefObject<HTMLElement | null>, onClose: () => void, active = true) {
  const close = useRef(onClose);
  close.current = onClose;
  // Read before the box mounts, so an autofocus inside it doesn't count as where focus came from.
  const [back] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));
  useEffect(() => {
    const box = ref.current;
    if (!active || !box) return;
    const done = modals.open(box, back);
    if (!box.contains(document.activeElement)) focusFirst(box);
    const key = (e: KeyboardEvent) => {
      if (!modals.isTop(box) || e.defaultPrevented) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
      } else if (e.key === 'Tab') {
        const all = focusables(box);
        const inside = box.contains(document.activeElement);
        if (all.length === 0) e.preventDefault();
        else if (e.shiftKey && (!inside || document.activeElement === all[0])) { e.preventDefault(); all.at(-1)!.focus(); }
        else if (!e.shiftKey && (!inside || document.activeElement === all.at(-1))) { e.preventDefault(); all[0].focus(); }
      }
    };
    addEventListener('keydown', key);
    return () => {
      removeEventListener('keydown', key);
      done();
    };
  }, [ref, back, active]);
}

export function Dialog({ title, children, actions, onClose, className = '' }: { title: string; children?: ReactNode; actions: ReactNode; onClose: () => void; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  useModal(box, onClose);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={box} tabIndex={-1} className={`dialog ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
        <div className="actions">{actions}</div>
      </div>
    </>
  );
}

// ---------- QR ----------

// The page's own port, so the QR points at Vite (5173) in dev and at the server in production.
export function pilotUrl(s: ClientState): string {
  const url = s.urls[0];
  return url && location.port ? url.replace(/:\d+\/$/, `:${location.port}/`) : location.origin + '/';
}

export function Qr({ text }: { text: string }) {
  const [markup, setMarkup] = useState('');
  useEffect(() => {
    QRCode.toString(text, { type: 'svg', margin: 0, color: { dark: '#0A0A0B', light: '#F5F5F5' }, errorCorrectionLevel: 'M' })
      .then(setMarkup)
      .catch(() => setMarkup(''));
  }, [text]);
  return <div className="qr-box" role="img" aria-label={`QR code for ${text}`} dangerouslySetInnerHTML={{ __html: markup }} />;
}
