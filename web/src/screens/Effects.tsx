// The “Effects” page (docs/EFEKTY.md): rules, the sound library and WLED. Open to anyone in the LAN; changes apply at once.
import type { ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { CheckoutCond, DartPattern, GameEvent, Trigger, TriggerKind } from '../../../games/effects.ts';
import { GAME_EVENT_LABELS, SIMPLE_LABELS, patternLabel, triggerLabel } from '../../../games/effects.ts';
import type { EffectsResponse } from '../../../server/effects/routes.ts';
import type { BaseState, Rule, RuleInput, Sound } from '../../../server/effects/store.ts';
import type { WledPreset } from '../../../server/effects/wled.ts';
import { Icon, Logo, toast } from '../components/ui.tsx';
import { playFile } from '../sound.ts';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SECONDS = 10;

/** JSON call with the server's error as a toast; null on failure. */
async function call<T = unknown>(method: string, url: string, body?: unknown): Promise<T | null> {
  try {
    const r = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast({ text: (data as { error?: string }).error ?? 'Something went wrong', kind: 'error' });
      return null;
    }
    return data as T;
  } catch {
    toast({ text: 'ITDarts did not answer', kind: 'error' });
    return null;
  }
}

function go(path: string) {
  history.pushState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
}

// ---------- trigger editing ----------

type KindChoice = TriggerKind | `game:${GameEvent}`;

const GROUPS: [string, [KindChoice, string][]][] = [
  ['Darts and visits (X01)', [
    ['dart', 'Dart'], ['total', 'Visit total'], ['range', 'Visit range'], ['combo', 'Combination'],
    ['bust', 'Bust'], ['checkout', SIMPLE_LABELS.checkout], ['setWon', 'Set won'], ['matchWon', 'Match won'],
  ]],
  ['Match and board', [
    ['matchStart', 'Match start'], ['legStart', 'Leg start'], ['takeoutStart', 'Takeout start'], ['takeoutEnd', 'Takeout end'],
    ['boardOffline', 'Board offline'], ['boardOnline', 'Board online'],
  ]],
  ['Minigames', [
    ['game:targetHit', 'Target hit (ATC)'], ['game:sectorCleared', 'Sector cleared (Full Board)'], ['game:attemptFailed', 'Attempt failed (121)'],
    ['game:marks', 'Marks in visit (Cricket)'], ['game:whiteHorse', 'White Horse (Cricket)'], ['game:sectorClosed', 'Sector closed (Cricket)'],
    ['game:becameKiller', 'Became killer (Killer)'], ['game:lifeLost', 'Life lost (Killer)'], ['game:eliminated', 'Player eliminated'],
    ['game:newRecord', GAME_EVENT_LABELS.newRecord],
  ]],
];

function newTrigger(k: KindChoice): Trigger {
  if (k.startsWith('game:')) {
    const event = k.slice(5) as GameEvent;
    return event === 'marks' ? { kind: 'game', event, marks: 5 } : { kind: 'game', event };
  }
  switch (k) {
    case 'dart': return { kind: 'dart', dart: { n: 20, m: 3 } };
    case 'total': return { kind: 'total', total: 180, checkout: 'any' };
    case 'range': return { kind: 'range', min: 100, max: 180, checkout: 'any' };
    case 'combo': return { kind: 'combo', darts: [{ n: 20, m: 3 }, { n: 20, m: 3 }, { n: 20, m: 3 }], ordered: false, checkout: 'any' };
    default: return { kind: k } as Trigger;
  }
}

/** Pick a dart like on the fix keypad, plus “any” for the number or the ring. */
function PatternPicker({ value, onChange }: { value: DartPattern; onChange: (p: DartPattern) => void }) {
  const mults: [DartPattern['m'], string][] = [[null, 'Any'], [1, 'Single'], [2, 'Double'], [3, 'Treble']];
  const setM = (m: DartPattern['m']) => {
    if (value.n === 0) return;
    onChange({ n: value.n === 25 && m === 3 ? null : value.n, m });
  };
  const key = (n: number | null, text: string) => {
    const on = value.n === n;
    const disabled = n === 25 && value.m === 3;
    return (
      <button key={text} className={`key sm ${on ? 'on' : ''}`} disabled={disabled} style={{ opacity: disabled ? 0.3 : 1 }}
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

function CondPicker({ value, onChange }: { value: CheckoutCond; onChange: (c: CheckoutCond) => void }) {
  return (
    <div className="seg">
      {([['any', 'Any'], ['only', 'Only checkout'], ['no', 'No checkout']] as const).map(([c, l]) => (
        <button key={c} aria-pressed={value === c} onClick={() => onChange(c)}>{l}</button>
      ))}
    </div>
  );
}

function NumberField({ value, onChange, min, max, label }: { value: number; onChange: (v: number) => void; min: number; max: number; label: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
      <span className="muted" style={{ fontSize: 13 }}>{label}</span>
      <input className="field" type="number" inputMode="numeric" min={min} max={max} value={value}
        onChange={e => onChange(Math.max(min, Math.min(max, Math.round(Number(e.target.value) || 0))))} />
    </label>
  );
}

function TriggerEditor({ t, onChange, onRemove }: { t: Trigger; onChange: (t: Trigger) => void; onRemove: () => void }) {
  const [slot, setSlot] = useState(0);
  let body: ReactNode = null;
  switch (t.kind) {
    case 'dart':
      body = <PatternPicker value={t.dart} onChange={dart => onChange({ ...t, dart })} />;
      break;
    case 'total':
      body = <><NumberField label="Visit total" value={t.total} min={0} max={180} onChange={total => onChange({ ...t, total })} /><CondPicker value={t.checkout} onChange={checkout => onChange({ ...t, checkout })} /></>;
      break;
    case 'range':
      body = (
        <>
          <div style={{ display: 'flex', gap: 10 }}>
            <NumberField label="From" value={t.min} min={0} max={180} onChange={min => onChange({ ...t, min, max: Math.max(min, t.max) })} />
            <NumberField label="To (180 = and up)" value={t.max} min={0} max={180} onChange={max => onChange({ ...t, max, min: Math.min(max, t.min) })} />
          </div>
          <CondPicker value={t.checkout} onChange={checkout => onChange({ ...t, checkout })} />
        </>
      );
      break;
    case 'combo':
      body = (
        <>
          <div className="fx-slots">
            {t.darts.map((p, i) => <button key={i} className={slot === i ? 'on' : ''} onClick={() => setSlot(i)}>{patternLabel(p)}</button>)}
          </div>
          <PatternPicker value={t.darts[slot]} onChange={p => onChange({ ...t, darts: t.darts.map((x, i) => (i === slot ? p : x)) })} />
          <div className="option-row">
            <span>Order matters</span>
            <div className="seg" style={{ width: 160 }}>
              <button aria-pressed={!t.ordered} onClick={() => onChange({ ...t, ordered: false })}>Off</button>
              <button aria-pressed={t.ordered} onClick={() => onChange({ ...t, ordered: true })}>On</button>
            </div>
          </div>
          <CondPicker value={t.checkout} onChange={checkout => onChange({ ...t, checkout })} />
        </>
      );
      break;
    case 'game':
      if (t.event === 'marks') {
        body = (
          <div className="seg">
            {[5, 6, 7, 8, 9].map(n => <button key={n} aria-pressed={t.marks === n} onClick={() => onChange({ ...t, marks: n })}>{n} marks</button>)}
          </div>
        );
      }
      break;
  }
  return (
    <div className="fx-trigger">
      <div className="head">
        <b>{triggerLabel(t)}</b>
        <button className="icon-btn" aria-label="Remove trigger" onClick={onRemove}>{Icon.close(18)}</button>
      </div>
      {body}
    </div>
  );
}

// ---------- rule editor ----------

function RuleEditor({ rule, sounds, presets, onClose, onSaved }: {
  rule: Rule | null; sounds: Sound[]; presets: WledPreset[] | null; onClose: () => void; onSaved: () => void;
}) {
  const [r, setR] = useState<RuleInput>(rule ?? { name: '', enabled: true, triggers: [], sounds: [], led: null });
  const [adding, setAdding] = useState('');
  const set = (patch: Partial<RuleInput>) => setR({ ...r, ...patch });

  const save = async () => {
    const ok = rule ? await call('PUT', `/api/effects/rules/${rule.id}`, r) : await call('POST', '/api/effects/rules', r);
    if (ok) {
      onSaved();
      onClose();
    }
  };
  const remove = async () => {
    if (rule && (await call('DELETE', `/api/effects/rules/${rule.id}`))) {
      onSaved();
      onClose();
    }
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dialog fx-editor" role="dialog" aria-modal="true" aria-label={rule ? 'Edit rule' : 'New rule'}>
        <h2>{rule ? 'Edit rule' : 'New rule'}</h2>
        <input className="field" placeholder="Name (optional), e.g. Big Fish" value={r.name} maxLength={40} onChange={e => set({ name: e.target.value })} />

        <div className="section">
          <span className="caps">Triggers · any of them plays the rule</span>
          {r.triggers.map((t, i) => (
            <TriggerEditor key={i} t={t}
              onChange={x => set({ triggers: r.triggers.map((y, j) => (j === i ? x : y)) })}
              onRemove={() => set({ triggers: r.triggers.filter((_, j) => j !== i) })} />
          ))}
          <select className="field" value={adding} onChange={e => {
            if (e.target.value) set({ triggers: [...r.triggers, newTrigger(e.target.value as KindChoice)] });
            setAdding('');
          }}>
            <option value="">+ Add trigger…</option>
            {GROUPS.map(([g, items]) => (
              <optgroup key={g} label={g}>{items.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</optgroup>
            ))}
          </select>
        </div>

        <div className="section">
          <span className="caps">Sound · one picked at random each time</span>
          {sounds.length === 0 ? <span className="muted" style={{ fontSize: 14 }}>Upload sounds to the library first.</span> : (
            <div className="chip-row">
              {sounds.map(s => {
                const on = r.sounds.includes(s.id);
                return <button key={s.id} className={`chip ${on ? 'on' : ''}`} onClick={() => set({ sounds: on ? r.sounds.filter(x => x !== s.id) : [...r.sounds, s.id] })}>{s.name}</button>;
              })}
            </div>
          )}
        </div>

        <div className="section">
          <div className="option-row">
            <span className="caps">LEDs</span>
            <div className="seg" style={{ width: 160 }}>
              <button aria-pressed={!r.led} onClick={() => set({ led: null })}>Off</button>
              <button aria-pressed={!!r.led} onClick={() => set({ led: r.led ?? { preset: presets?.[0]?.id ?? 1, seconds: 1 } })}>On</button>
            </div>
          </div>
          {r.led && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              {presets && presets.length > 0 ? (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 2 }}>
                  <span className="muted" style={{ fontSize: 13 }}>Preset</span>
                  <select className="field" value={r.led.preset} onChange={e => set({ led: { ...r.led!, preset: Number(e.target.value) } })}>
                    {presets.map(p => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
                  </select>
                </label>
              ) : <NumberField label="Preset number" value={r.led.preset} min={1} max={250} onChange={preset => set({ led: { ...r.led!, preset } })} />}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <span className="muted" style={{ fontSize: 13 }}>Seconds</span>
                <input className="field" type="number" step={0.5} min={0.5} max={60} value={r.led.seconds}
                  onChange={e => set({ led: { ...r.led!, seconds: Math.max(0.1, Math.min(60, Number(e.target.value) || 1)) } })} />
              </label>
            </div>
          )}
        </div>

        <div className="option-row">
          <span>Enabled</span>
          <div className="seg" style={{ width: 160 }}>
            <button aria-pressed={!r.enabled} onClick={() => set({ enabled: false })}>Off</button>
            <button aria-pressed={r.enabled} onClick={() => set({ enabled: true })}>On</button>
          </div>
        </div>

        <div className="actions" style={{ flexWrap: 'wrap' }}>
          {rule && <button className="btn danger" onClick={remove}>Delete</button>}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Save</button>
        </div>
      </div>
    </>
  );
}

// ---------- sections ----------

function Rules({ data, presets, reload }: { data: EffectsResponse; presets: WledPreset[] | null; reload: () => void }) {
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const soundName = (id: number) => data.sounds.find(s => s.id === id)?.name ?? '?';
  const presetName = (id: number) => presets?.find(p => p.id === id)?.name ?? `Preset ${id}`;
  const toggle = (r: Rule) => call('PUT', `/api/effects/rules/${r.id}`, { ...r, enabled: !r.enabled }).then(reload);
  return (
    <div className="box">
      <div className="option-row">
        <h2>Rules</h2>
        <button className="btn primary" onClick={() => setEditing('new')}>{Icon.plus()}New rule</button>
      </div>
      <span className="muted" style={{ fontSize: 14 }}>One rule plays at a time: the most specific one wins (match won, set won, checkout-only, checkout, bust, … single dart).</span>
      {data.rules.length === 0 && <span className="muted">No rules yet. Animations on the scoreboard work without them.</span>}
      {data.rules.map(r => (
        <div key={r.id} className={`fx-rule ${r.enabled ? '' : 'off'}`}>
          <div className="top">
            <b>{r.name || r.triggers.map(triggerLabel).join(' · ')}</b>
            <button className="btn" style={{ height: 40 }} onClick={() => call('POST', `/api/effects/rules/${r.id}/test`)}>Test</button>
            <button className="btn" style={{ height: 40 }} onClick={() => toggle(r)}>{r.enabled ? 'Disable' : 'Enable'}</button>
            <button className="btn" style={{ height: 40 }} onClick={() => setEditing(r)}>Edit</button>
          </div>
          {r.name && <small>{r.triggers.map(triggerLabel).join(' · ')}</small>}
          <small>
            {r.sounds.length ? `♪ ${r.sounds.map(soundName).join(' / ')}` : 'No sound'}
            {' · '}
            {r.led ? `LEDs: ${presetName(r.led.preset)} for ${r.led.seconds} s` : 'No LEDs'}
          </small>
        </div>
      ))}
      {editing && <RuleEditor rule={editing === 'new' ? null : editing} sounds={data.sounds} presets={presets} onClose={() => setEditing(null)} onSaved={reload} />}
    </div>
  );
}

/** Length of an audio file, measured by the browser before the upload. */
function duration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(a.duration);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    a.src = url;
  });
}

function SoundRow({ s, master, reload }: { s: Sound; master: number; reload: () => void }) {
  const [name, setName] = useState(s.name);
  const [volume, setVolume] = useState(s.volume);
  useEffect(() => setName(s.name), [s.name]);
  useEffect(() => setVolume(s.volume), [s.volume]);
  return (
    <div className="fx-sound">
      <button className="icon-btn" aria-label={`Play ${s.name}`} onClick={() => void playFile(`/sounds/${s.file}`, (master / 100) * (volume / 100))}>
        {Icon.play(18)}
      </button>
      <input className="field" style={{ height: 44 }} value={name} maxLength={40} aria-label="Sound name"
        onChange={e => setName(e.target.value)}
        onBlur={() => name.trim() !== s.name && call('PUT', `/api/sounds/${s.id}`, { name }).then(r => (r ? reload() : setName(s.name)))} />
      <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }} className="muted">
        Volume {volume}%
        <input type="range" min={0} max={200} step={5} value={volume} onChange={e => setVolume(Number(e.target.value))}
          onPointerUp={() => call('PUT', `/api/sounds/${s.id}`, { volume }).then(reload)}
          onKeyUp={() => call('PUT', `/api/sounds/${s.id}`, { volume }).then(reload)} />
      </label>
      <button className="icon-btn" aria-label={`Delete ${s.name}`} disabled={s.usedBy > 0} style={{ opacity: s.usedBy > 0 ? 0.3 : 1 }}
        title={s.usedBy > 0 ? 'Used by a rule' : 'Delete'} onClick={() => call('DELETE', `/api/sounds/${s.id}`).then(reload)}>
        {Icon.close(18)}
      </button>
    </div>
  );
}

function Library({ data, reload }: { data: EffectsResponse; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) return toast({ text: 'File is larger than 5 MB', kind: 'error' });
    let seconds: number;
    try {
      seconds = await duration(file);
    } catch {
      return toast({ text: 'This browser cannot read that file. Use mp3, wav or ogg.', kind: 'error' });
    }
    if (!(seconds > 0) || seconds > MAX_SECONDS) return toast({ text: 'Sound is longer than 10 s', kind: 'error' });
    setBusy(true);
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 40) || 'Sound';
    try {
      const r = await fetch(`/api/sounds?name=${encodeURIComponent(name)}&duration=${Math.ceil(seconds * 1000)}`, {
        method: 'POST', headers: { 'content-type': file.type.startsWith('audio/') ? file.type : 'application/octet-stream' }, body: file,
      });
      if (!r.ok) toast({ text: ((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'Upload failed', kind: 'error' });
      else toast({ text: `Added “${name}”` });
    } finally {
      setBusy(false);
      reload();
    }
  };
  return (
    <div className="box">
      <div className="option-row">
        <h2>Sound library</h2>
        <label className="btn primary" style={{ cursor: 'pointer' }}>
          {Icon.plus()}{busy ? 'Uploading…' : 'Upload'}
          <input type="file" accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg" hidden disabled={busy}
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
        </label>
      </div>
      <span className="muted" style={{ fontSize: 14 }}>mp3, wav or ogg, up to 5 MB and 10 s. Play previews on this device; rules play on the laptop.</span>
      {data.sounds.length === 0 && <span className="muted">No sounds yet.</span>}
      {data.sounds.map(s => <SoundRow key={s.id} s={s} master={data.settings.volume} reload={reload} />)}
    </div>
  );
}

const BASE_LABELS: [BaseState, string][] = [['lobby', 'Lobby'], ['match', 'Match in progress'], ['takeout', 'Takeout'], ['offline', 'Board offline']];

function Leds({ data, presets, presetsError, reload }: { data: EffectsResponse; presets: WledPreset[] | null; presetsError: string | null; reload: () => void }) {
  const w = data.settings.wled;
  const [address, setAddress] = useState(w.address);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => setAddress(w.address), [w.address]);

  const saveAddress = async () => {
    if (await call('PUT', '/api/effects/settings', { wled: { address } })) reload();
  };
  const test = async () => {
    setStatus('Connecting…');
    const r = await fetch('/api/wled/info').then(x => x.json()).catch(() => ({ error: 'ITDarts did not answer' }));
    setStatus(r.error ? r.error : `Connected: ${r.name} · WLED ${r.version}`);
    if (!r.error) reload();
  };
  const setBase = (b: BaseState, v: string) => call('PUT', '/api/effects/settings', { wled: { base: { [b]: v === '' ? null : Number(v) } } }).then(reload);

  return (
    <div className="box">
      <h2>LEDs (WLED)</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <input className="field" placeholder="WLED address, e.g. 192.168.1.50" value={address} onChange={e => setAddress(e.target.value)} />
        <button className="btn" onClick={saveAddress} disabled={address.trim() === w.address}>Save</button>
      </div>
      {w.address && <button className="btn block" onClick={test}>Test connection</button>}
      {status && <span className="muted" style={{ fontSize: 14 }}>{status}</span>}
      {w.address && presetsError && <span style={{ color: 'var(--red)', fontSize: 14 }}>{presetsError}</span>}
      {w.address && (
        <>
          <span className="caps" style={{ fontSize: 13 }}>Base states · lit between effects</span>
          {BASE_LABELS.map(([b, l]) => (
            <div key={b} className="option-row">
              <span>{l}</span>
              {presets ? (
                <select className="field" style={{ maxWidth: 260 }} value={w.base[b] ?? ''} onChange={e => setBase(b, e.target.value)}>
                  <option value="">Leave as is</option>
                  {presets.map(p => <option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}
                </select>
              ) : (
                <input className="field" style={{ maxWidth: 140 }} type="number" min={1} max={250} placeholder="Preset" defaultValue={w.base[b] ?? ''}
                  onBlur={e => setBase(b, e.target.value)} />
              )}
            </div>
          ))}
        </>
      )}
      {!w.address && <span className="muted" style={{ fontSize: 14 }}>Design effects as presets in the WLED app, then pick them here by name.</span>}
    </div>
  );
}

function Playback({ data, reload }: { data: EffectsResponse; reload: () => void }) {
  const s = data.settings;
  const [volume, setVolume] = useState(s.volume);
  useEffect(() => setVolume(s.volume), [s.volume]);
  const put = (patch: object) => call('PUT', '/api/effects/settings', patch).then(reload);
  return (
    <div className="box">
      <h2>Playback</h2>
      <div className="option-row">
        <span>Sounds</span>
        <div className="seg" style={{ width: 160 }}>
          <button aria-pressed={!s.sounds} onClick={() => put({ sounds: false })}>Off</button>
          <button aria-pressed={s.sounds} onClick={() => put({ sounds: true })}>On</button>
        </div>
      </div>
      <div className="option-row">
        <span>LEDs</span>
        <div className="seg" style={{ width: 160 }}>
          <button aria-pressed={!s.leds} onClick={() => put({ leds: false })}>Off</button>
          <button aria-pressed={s.leds} onClick={() => put({ leds: true })}>On</button>
        </div>
      </div>
      <div className="option-row">
        <span>Swoosh on the next player</span>
        <div className="seg" style={{ width: 160 }}>
          <button aria-pressed={!s.swoosh} onClick={() => put({ swoosh: false })}>Off</button>
          <button aria-pressed={s.swoosh} onClick={() => put({ swoosh: true })}>On</button>
        </div>
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Effects volume {volume}%</span>
        <input type="range" min={0} max={100} step={5} value={volume} onChange={e => setVolume(Number(e.target.value))}
          onPointerUp={() => put({ volume })} onKeyUp={() => put({ volume })} />
      </label>
      <span className="muted" style={{ fontSize: 14 }}>The same switches are in the pilot menu. Overall loudness is set in Windows. The caller comes with its voice pack.</span>
    </div>
  );
}

export function EffectsPage() {
  const [data, setData] = useState<EffectsResponse | null>(null);
  const [presets, setPresets] = useState<WledPreset[] | null>(null);
  const [presetsError, setPresetsError] = useState<string | null>(null);

  const reload = useCallback(() => {
    void call<EffectsResponse>('GET', '/api/effects').then(d => d && setData(d));
  }, []);
  useEffect(reload, [reload]);

  // Presets come from the controller each time the address changes.
  const address = data?.settings.wled.address ?? '';
  useEffect(() => {
    setPresets(null);
    setPresetsError(null);
    if (!address) return;
    fetch('/api/wled/presets')
      .then(async r => (r.ok ? setPresets(await r.json()) : setPresetsError(((await r.json()) as { error: string }).error)))
      .catch(() => setPresetsError('ITDarts did not answer'));
  }, [address]);

  return (
    <div className="stats-page fx-page">
      <header className="stats-head">
        <button className="icon-btn" aria-label="Back" onClick={() => go('/')}>{Icon.back(22)}</button>
        <h1>Effects</h1>
        <Logo />
      </header>
      {!data ? <p className="muted">Loading…</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Rules data={data} presets={presets} reload={reload} />
          <Library data={data} reload={reload} />
          <Leds data={data} presets={presets} presetsError={presetsError} reload={reload} />
          <Playback data={data} reload={reload} />
        </div>
      )}
    </div>
  );
}

