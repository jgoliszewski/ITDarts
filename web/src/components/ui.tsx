import type { ReactNode } from 'react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
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
  qr: (s?: number) => svg(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></>, s),
  board: (s?: number) => svg(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>, s),
  close: (s?: number) => svg(<path d="M18 6 6 18M6 6l12 12" />, s),
  back: (s?: number) => svg(<path d="m15 18-6-6 6-6" />, s),
  undo: (s?: number) => svg(<><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></>, s),
  play: (s?: number) => <svg width={s ?? 20} height={s ?? 20} viewBox="0 0 24 24" fill="#F58224" aria-hidden="true"><path d="M6 4l14 8-14 8z" /></svg>,
  grip: (s?: number) => <svg width={s ?? 18} height={s ?? 18} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>,
  plus: (s?: number) => svg(<path d="M12 5v14M5 12h14" />, s),
  down: (s?: number) => svg(<path d="m6 9 6 6 6-6" />, s),
  spinner: () => (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="24" r="20" stroke="#4A3F22" strokeWidth="5" /><path d="M24 4a20 20 0 0 1 20 20" stroke="#F5B83D" strokeWidth="5" strokeLinecap="round" /></svg>
  ),
};

/** A dropdown in the app's own style: a button with a colour mark, opening a list. Closes on a pick, a click outside or Escape. */
export function Dropdown<T extends string | number>({ value, options, color, onChange }: {
  value: T;
  options: { value: T; label: string }[];
  color: string;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    addEventListener('pointerdown', out);
    addEventListener('keydown', esc);
    return () => { removeEventListener('pointerdown', out); removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div className="pick" ref={ref}>
      <button className={`pick-btn ${open ? 'open' : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <i style={{ background: color }} />
        <span>{options.find(o => o.value === value)?.label ?? '–'}</span>
        {Icon.down(18)}
      </button>
      {open && (
        <ul className="pick-list" role="listbox">
          {options.map(o => (
            <li key={o.value} role="option" aria-selected={o.value === value} className={o.value === value ? 'on' : ''}
              onClick={() => { setOpen(false); if (o.value !== value) onChange(o.value); }}>
              {o.label}
            </li>
          ))}
        </ul>
      )}
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
  toasts = toasts.filter(t => t.id !== id);
  toastListeners.forEach(l => l());
}

export function Toasts() {
  const list = useSyncExternalStore(l => (toastListeners.add(l), () => toastListeners.delete(l)), () => toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map(t => (
        <div key={t.id} className={`toast ${t.kind ?? ''}`}>
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

export function Dialog({ title, children, actions, onClose }: { title: string; children?: ReactNode; actions: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dialog" role="dialog" aria-modal="true" aria-label={title}>
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
