// Small pieces shared by the Effects tabs.
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import type { CheckoutCond, DartPattern } from '../../../../games/effects.ts';
import { patternLabel } from '../../../../games/effects.ts';
import { Icon } from '../../components/ui.tsx';
import type { EffectsData } from './api.ts';
import { tryLed } from './api.ts';

export function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (on: boolean) => void }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={e => { e.stopPropagation(); onChange(!on); }}>
      <span />
    </button>
  );
}

export const Chevron = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
);

/** Lower case without accents, so “papiez” finds “Papież”. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').toLowerCase();

/** Every word of the query appears in one of the texts, in any order. */
export function matchesQuery(q: string, ...texts: string[]): boolean {
  const hay = fold(texts.join(' '));
  return fold(q).split(/\s+/).filter(Boolean).every(w => hay.includes(w));
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="fx-search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
      <input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
      {value && <button aria-label="Clear search" onClick={() => onChange('')}>{Icon.close(16)}</button>}
    </label>
  );
}

/** A preset's colour; a hollow ring when the preset has none. */
export const Dot = ({ color, size = 12 }: { color: string | null | undefined; size?: number }) => (
  <span className={`fx-dot ${color ? '' : 'none'}`} style={{ width: size, height: size, background: color ?? undefined }} aria-hidden="true" />
);

/** Bottom sheet on the phone, a centred dialog on the laptop. */
export function Sheet({ title, wide, onClose, children }: { title: string; wide: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className={wide ? 'dialog fx-sheet-wide' : 'sheet fx-sheet'} role="dialog" aria-modal="true" aria-label={title}>
        {!wide && <div className="grab" />}
        <div className="option-row">
          <h2 style={{ margin: 0, fontSize: 20 }}>{title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>{Icon.close(20)}</button>
        </div>
        {children}
      </div>
    </>
  );
}

export function Seg<T extends string | number | boolean>({ value, options, onChange, label }: {
  value: T; options: [T, string][]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => <button key={String(v)} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

export function CondPicker({ value, onChange }: { value: CheckoutCond; onChange: (c: CheckoutCond) => void }) {
  return <Seg label="Checkout" value={value} onChange={onChange} options={[['any', 'Any'], ['only', 'Checkout'], ['no', 'No checkout']]} />;
}

export function Stepper({ value, min, max, step = 1, label, unit = '', onChange }: {
  value: number; min: number; max: number; step?: number; label: string; unit?: string; onChange: (v: number) => void;
}) {
  const set = (v: number) => onChange(Math.round(Math.max(min, Math.min(max, v)) * 10) / 10);
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button aria-label={`Lower ${label}`} onClick={() => set(value - step)}>−</button>
      <input className="num" inputMode="decimal" aria-label={label} value={`${value}${unit}`}
        onChange={e => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) set(v); }} />
      <button aria-label={`Raise ${label}`} onClick={() => set(value + step)}>+</button>
    </div>
  );
}

/** Pick a dart like on the fix keypad, plus “any” for the number or the ring. */
export function PatternPicker({ value, onChange }: { value: DartPattern; onChange: (p: DartPattern) => void }) {
  const mults: [DartPattern['m'], string][] = [[null, 'Any'], [1, 'Single'], [2, 'Double'], [3, 'Treble']];
  const setM = (m: DartPattern['m']) => {
    if (value.n === 0) return;
    onChange({ n: value.n === 25 && m === 3 ? null : value.n, m });
  };
  const key = (n: number | null, text: string) => {
    const disabled = n === 25 && value.m === 3;
    return (
      <button key={text} className={`key sm ${value.n === n ? 'on' : ''}`} disabled={disabled} style={{ opacity: disabled ? 0.3 : 1 }}
        onClick={() => onChange(n === 0 ? { n: 0, m: 1 } : { n, m: value.n === 0 ? null : value.m })}>
        <b>{text}</b>
      </button>
    );
  };
  return (
    <>
      <div className="mult-row" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {mults.map(([m, l]) => <button key={l} aria-pressed={value.n !== 0 && value.m === m} onClick={() => setM(m)}>{l}</button>)}
      </div>
      <div className="num-grid">
        {key(null, 'Any')}
        {Array.from({ length: 20 }, (_, i) => key(i + 1, String(i + 1)))}
        {key(25, 'Bull')}
        {key(0, 'Miss')}
      </div>
      <span className="muted" style={{ fontSize: 13 }}>{patternLabel(value)}{value.n === null ? ' · numbers 1–20, not the bull' : ''}</span>
    </>
  );
}

/** Choose a WLED preset by name and colour; every row can be tried on the LEDs first. */
export function PresetPicker({ d, value, none, wide, onPick, onClose }: {
  d: EffectsData; value: number | null; none: string | null; wide: boolean; onPick: (id: number | null) => void; onClose: () => void;
}) {
  const list = d.presets.list;
  return (
    <Sheet title="Pick a preset" wide={wide} onClose={onClose}>
      {!d.settings.wled.address && <p className="muted" style={{ margin: 0 }}>Set the WLED address in the LEDs tab to pick presets by name.</p>}
      {d.presets.error && <p style={{ margin: 0, color: 'var(--red)' }}>{d.presets.error}</p>}
      <div className="fx-list">
        {none !== null && (
          <button className={`fx-pick ${value === null ? 'on' : ''}`} onClick={() => { onPick(null); onClose(); }}>
            <Dot color={null} /><span className="grow">{none}</span>
          </button>
        )}
        {list?.map(p => (
          <div key={p.id} className={`fx-pick ${value === p.id ? 'on' : ''}`}>
            <button className="fx-pick-main" onClick={() => { onPick(p.id); onClose(); }}>
              <Dot color={p.color} size={14} /><span className="grow">{p.name}</span><span className="muted">#{p.id}</span>
            </button>
            <button className="btn" style={{ height: 40 }} onClick={() => tryLed(p.id, 3, p.name)}>Try</button>
          </div>
        ))}
      </div>
      {!list && (
        <label className="option-row">
          <span>Preset number</span>
          <input className="field" style={{ maxWidth: 140 }} type="number" min={1} max={250} defaultValue={value ?? ''}
            onKeyDown={e => { if (e.key === 'Enter') { const v = Number((e.target as HTMLInputElement).value); if (v >= 1 && v <= 250) { onPick(v); onClose(); } } }} />
        </label>
      )}
    </Sheet>
  );
}
