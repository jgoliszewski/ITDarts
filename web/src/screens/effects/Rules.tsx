// Rules tab: the list grouped by trigger, and the When → Then editor (docs/EFEKTY.md, Układ strony).
import { useEffect, useState } from 'react';
import type { GameEvent, Trigger, TriggerKind } from '../../../../games/effects.ts';
import { GAME_EVENT_LABELS, MAX_LEFT, SIMPLE_LABELS, priority, triggerLabel } from '../../../../games/effects.ts';
import type { Rule, RuleInput } from '../../../../server/effects/store.ts';
import { Dialog, Icon } from '../../components/ui.tsx';
import { store } from '../../util.ts';
import { playSound } from '../../sound.ts';
import type { EffectsData } from './api.ts';
import { call, go, presetName, presetOf, setDirtyCheck, tryLed } from './api.ts';
import { Chevron, CondPicker, Dot, PatternPicker, PresetPicker, SearchField, Seg, Sheet, Stepper, Switch, matchesQuery } from './parts.tsx';

// ---------- groups ----------

type Group = 'results' | 'visits' | 'darts' | 'games' | 'match';
const GROUP_TITLES: [Group, string][] = [['results', 'Results'], ['visits', 'Visits'], ['darts', 'Darts'], ['games', 'Minigames'], ['match', 'Match and board']];

const groupOf = (t: Trigger): Group =>
  t.kind === 'game' || t.kind === 'hit' || t.kind === 'miss' ? 'games'
  : t.kind === 'dart' || t.kind === 'left' ? 'darts'
  : t.kind === 'total' || t.kind === 'range' || t.kind === 'combo' ? 'visits'
  : ['bust', 'checkout', 'setWon', 'matchWon'].includes(t.kind) ? 'results'
  : 'match';

const COLLAPSED_KEY = 'itdarts.fx.collapsed';
const loadCollapsed = (): Group[] => {
  try {
    return JSON.parse(store.get(COLLAPSED_KEY) ?? '[]');
  } catch {
    return [];
  }
};

/** A rule's most important trigger decides its group and its place in it. */
const best = (r: Rule) => r.triggers.reduce((a, b) => (priority(b) < priority(a) ? b : a));

function groupRules(rules: Rule[]): { group: Group; title: string; rules: Rule[] }[] {
  // A stable sort: equal priorities keep the file's order, oldest first.
  const sorted = [...rules].sort((a, b) => priority(best(a)) - priority(best(b)));
  return GROUP_TITLES
    .map(([group, title]) => ({ group, title, rules: sorted.filter(r => groupOf(best(r)) === group) }))
    .filter(g => g.rules.length > 0);
}

const whenText = (r: { triggers: Trigger[] }) => r.triggers.map(triggerLabel).join(' · ');

function soundsText(d: EffectsData, ids: string[]) {
  const names = ids.map(id => d.sounds.find(s => s.id === id)?.name).filter(Boolean);
  return names.length === 0 ? null : names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
}

/** The rule as the server takes it, with the switch flipped. */
const toggled = (r: Rule): RuleInput => ({ name: r.name, enabled: !r.enabled, triggers: r.triggers, sounds: r.sounds, led: r.led });

/** Plays the sound here and the LEDs on the controller, even with the rule switched off. */
const testRule = (r: RuleInput) =>
  call<{ sound: { url: string; gain: number } | null }>('POST', '/api/effects/test', r).then(res => res?.sound && playSound(res.sound.url, res.sound.gain));

// ---------- list ----------

/** All rules as tiles over the whole width; a tap opens the rule over the whole screen. */
export function RuleList({ d, wide }: { d: EffectsData; wide: boolean }) {
  const [q, setQ] = useState('');
  // Search by name, triggers and sounds, so “bust” or “papiez” finds the rule.
  const groups = groupRules(d.rules.filter(r => matchesQuery(q, r.name, whenText(r), ...r.sounds.map(id => d.sounds.find(s => s.id === id)?.name ?? id))));
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const toggle = (g: Group) => {
    const next = collapsed.includes(g) ? collapsed.filter(x => x !== g) : [...collapsed, g];
    setCollapsed(next);
    store.set(COLLAPSED_KEY, JSON.stringify(next));
  };
  return (
    <div className="fx-rules">
      <div className="fx-rules-head">
        {wide && <h2 className="fx-h">Rules</h2>}
        {d.rules.length > 0 && <SearchField value={q} onChange={setQ} placeholder="Search rules" />}
        {wide && <button className="btn primary" onClick={() => go('/effects/rules/new')}>{Icon.plus()}New rule</button>}
      </div>
      {d.rules.length > 0 && groups.length === 0 && <p className="muted" style={{ margin: 0 }}>No rule matches “{q}”.</p>}
      {d.rules.length === 0 && (
        <div className="fx-empty">
          <b>No rules yet</b>
          <span>Scoreboard animations work without them. Add a rule to play a sound or light the LEDs on 180, bust, checkout and more.</span>
        </div>
      )}
      {groups.map(g => (
        <section key={g.group} className="section">
          <button className={`option-row fx-group ${collapsed.includes(g.group) ? 'shut' : ''}`} aria-expanded={!collapsed.includes(g.group)} onClick={() => toggle(g.group)}>
            <span className="caps">{g.title}</span><span className="muted">{g.rules.length} {g.rules.length === 1 ? 'rule' : 'rules'}<Chevron /></span>
          </button>
          {(q || !collapsed.includes(g.group)) && (
            <div className="fx-rule-grid">
              {g.rules.map(r => {
                const sound = soundsText(d, r.sounds);
                const preset = r.led && presetOf(d, r.led.preset);
                return (
                  <div key={r.id} className={`fx-rule ${r.enabled ? '' : 'off'}`}>
                    <button className="fx-rule-main" onClick={() => go(`/effects/rules/${r.id}`)}>
                      <b>{r.name || whenText(r)}</b>
                      {r.name && <span className="muted">{whenText(r)}</span>}
                      <span className="fx-what">
                        {sound && <span>♪ {sound}</span>}
                        {r.led && <span><Dot color={preset?.color} size={10} />{presetName(d, r.led.preset)} · {r.led.seconds} s</span>}
                        {!sound && !r.led && <span className="fx-todo">No sound yet</span>}
                      </span>
                    </button>
                    <div className="fx-rule-side">
                      <Switch on={r.enabled} label={`${r.name || whenText(r)} on`} onChange={() => call('PUT', `/api/effects/rules/${r.id}`, toggled(r)).then(d.reload)} />
                      <button className="icon-btn" aria-label={`Test ${r.name || whenText(r)}`} disabled={!sound && !r.led} onClick={() => testRule(r)}>{Icon.play(16)}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

// ---------- trigger picker ----------

type KindChoice = TriggerKind | `game:${GameEvent}`;

const PICKER: [string, [KindChoice, string, string][]][] = [
  ['Darts, visits and results', [
    ['dart', 'Dart', 'One dart: T20, bull, any double, a miss'],
    ['total', 'Visit total', 'An exact total, e.g. 180 or 26 (X01)'],
    ['range', 'Visit range', 'A total in a range, e.g. 100+ (X01)'],
    ['combo', 'Combination', 'Three darts, e.g. 1 · 5 · 20 (X01)'],
    ['left', 'Left on', 'A dart leaves you on a score, e.g. 2 for D1 (X01)'],
    ['bust', 'Bust', 'The visit goes bust (X01, 121)'],
    ['checkout', SIMPLE_LABELS.checkout, 'Checkout or a won leg; a won game in Higher or Lower'],
    ['setWon', 'Set won', 'X01 with sets'],
    ['matchWon', 'Match won', 'The end of every game'],
  ]],
  ['Minigames', [
    ['hit', 'Hit', 'A dart that counts: ATC, Full Board, Cricket, Shanghai; a won visit in Higher or Lower'],
    ['miss', 'Miss', 'A dart that does not count; a lost visit in Higher or Lower'],
    ['game:targetHit', 'Target hit', 'Around the Clock'],
    ['game:sectorCleared', 'Sector cleared', 'Full Board'],
    ['game:attemptFailed', 'Attempt failed', '121: out of darts on a target'],
    ['game:marks', 'Marks in visit', 'Cricket: 5 to 9 marks in one visit'],
    ['game:whiteHorse', 'White Horse', 'Cricket: three fresh trebles'],
    ['game:shanghai', 'Shanghai', 'Shanghai: single, double and treble in one visit'],
    ['game:sectorClosed', 'Sector closed', 'Cricket'],
    ['game:becameKiller', 'Became killer', 'Killer'],
    ['game:lifeLost', 'Life lost', 'Killer'],
    ['game:eliminated', 'Player eliminated', 'Killer, Higher or Lower'],
    ['game:newRecord', GAME_EVENT_LABELS.newRecord, 'An office or personal record at the end'],
  ]],
  ['Match and board', [
    ['matchStart', 'Match start', 'Right after Start'],
    ['legStart', 'Leg start', 'Every leg, the first one too'],
    ['nextPlayer', 'Next player', 'The visit goes to the next player'],
    ['takeoutStart', 'Takeout start', 'Darts are being pulled'],
    ['takeoutEnd', 'Takeout end', 'The board is clear'],
    ['boardOffline', 'Board offline', 'Board Manager lost'],
    ['boardOnline', 'Board online', 'Board Manager back'],
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
    case 'left': return { kind: 'left', score: 2 };
    default: return { kind: k } as Trigger;
  }
}

function TriggerPicker({ wide, onPick, onClose }: { wide: boolean; onPick: (t: Trigger) => void; onClose: () => void }) {
  return (
    <Sheet title="Add trigger" wide={wide} onClose={onClose}>
      {PICKER.map(([group, items]) => (
        <section key={group} className="section">
          <span className="caps">{group}</span>
          <div className="fx-tiles">
            {items.map(([k, label, info]) => (
              <button key={k} className="fx-tile" onClick={() => { onPick(newTrigger(k)); onClose(); }}>
                <b>{label}</b><span>{info}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </Sheet>
  );
}

/** Parameters of the chosen trigger, under the chips. */
function TriggerParams({ t, onChange }: { t: Trigger; onChange: (t: Trigger) => void }) {
  const [slot, setSlot] = useState(0);
  switch (t.kind) {
    case 'dart':
      return <PatternPicker value={t.dart} onChange={dart => onChange({ ...t, dart })} />;
    case 'total':
      return (
        <>
          <div className="option-row"><span>Visit total</span><Stepper label="visit total" value={t.total} min={0} max={180} onChange={total => onChange({ ...t, total })} /></div>
          <CondPicker value={t.checkout} onChange={checkout => onChange({ ...t, checkout })} />
        </>
      );
    case 'range':
      return (
        <>
          <div className="option-row"><span>From</span><Stepper label="lowest total" value={t.min} min={0} max={180} onChange={min => onChange({ ...t, min, max: Math.max(min, t.max) })} /></div>
          <div className="option-row"><span>To <small className="muted">(180 = and up)</small></span><Stepper label="highest total" value={t.max} min={0} max={180} onChange={max => onChange({ ...t, max, min: Math.min(max, t.min) })} /></div>
          <CondPicker value={t.checkout} onChange={checkout => onChange({ ...t, checkout })} />
        </>
      );
    case 'combo':
      return (
        <>
          <div className="fx-slots">
            {t.darts.map((p, i) => <button key={i} className={slot === i ? 'on' : ''} onClick={() => setSlot(i)}>Dart {i + 1}<br /><b>{triggerLabel({ kind: 'dart', dart: p })}</b></button>)}
          </div>
          <PatternPicker value={t.darts[slot]} onChange={p => onChange({ ...t, darts: t.darts.map((x, i) => (i === slot ? p : x)) })} />
          <div className="option-row"><span>Order matters</span><Switch on={t.ordered} label="Order matters" onChange={ordered => onChange({ ...t, ordered })} /></div>
          <CondPicker value={t.checkout} onChange={checkout => onChange({ ...t, checkout })} />
        </>
      );
    case 'left':
      return <div className="option-row"><span>Score left</span><Stepper label="score left" value={t.score} min={1} max={MAX_LEFT} onChange={score => onChange({ ...t, score })} /></div>;
    case 'game':
      if (t.event !== 'marks') return null;
      return <Seg label="Marks" value={t.marks ?? 5} onChange={marks => onChange({ ...t, marks })} options={[5, 6, 7, 8, 9].map(n => [n, `${n}`] as [number, string])} />;
    default:
      return null;
  }
}

/** Library sounds not in the rule yet, with a search for long libraries. */
function SoundPicker({ d, wide, taken, onPick, onClose }: { d: EffectsData; wide: boolean; taken: string[]; onPick: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const free = d.sounds.filter(s => !taken.includes(s.id));
  const shown = free.filter(s => matchesQuery(q, s.name, s.file));
  return (
    <Sheet title="Add a sound" wide={wide} onClose={onClose}>
      {d.sounds.length === 0 && <p className="muted" style={{ margin: 0 }}>The library is empty. Upload sounds in the Sounds tab.</p>}
      {free.length > 0 && <SearchField value={q} onChange={setQ} placeholder="Search sounds" />}
      {free.length > 0 && shown.length === 0 && <p className="muted" style={{ margin: 0 }}>No sound matches “{q}”.</p>}
      <div className="fx-list">
        {shown.map(s => (
          <div key={s.id} className="fx-pick">
            <button className="icon-btn" aria-label={`Play ${s.name}`} onClick={() => playSound(s.id, (d.settings.volume / 100) * (s.volume / 100))}>{Icon.play(16)}</button>
            <button className="fx-pick-main" onClick={() => { onPick(s.id); onClose(); }}>
              <span className="grow">{s.name}</span><span className="muted">{(s.durationMs / 1000).toFixed(1)} s</span>
            </button>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

// ---------- editor ----------

const EMPTY: RuleInput = { name: '', enabled: true, triggers: [], sounds: [], led: null };
const fromRule = (r: Rule | null): RuleInput => (r ? { name: r.name, enabled: r.enabled, triggers: r.triggers, sounds: r.sounds, led: r.led } : EMPTY);

export function RuleEditor({ d, rule, wide }: { d: EffectsData; rule: Rule | null; wide: boolean }) {
  const [saved, setSaved] = useState<RuleInput>(() => fromRule(rule));
  const [r, setR] = useState<RuleInput>(saved);
  const [chip, setChip] = useState(0);
  const [sheet, setSheet] = useState<null | 'trigger' | 'sound' | 'preset'>(null);
  const [askDelete, setAskDelete] = useState(false);
  const set = (patch: Partial<RuleInput>) => setR({ ...r, ...patch });
  const isDirty = JSON.stringify(r) !== JSON.stringify(saved);

  useEffect(() => {
    setDirtyCheck(() => isDirty);
    return () => setDirtyCheck(null);
  }, [isDirty]);

  const list = '/effects/rules';
  const save = async () => {
    const res = rule ? await call('PUT', `/api/effects/rules/${rule.id}`, r) : await call<{ id: string }>('POST', '/api/effects/rules', r);
    if (!res) return;
    setSaved(r);
    setDirtyCheck(null);
    d.reload();
    go(list);
  };
  const remove = async () => {
    setAskDelete(false);
    if (rule && (await call('DELETE', `/api/effects/rules/${rule.id}`))) {
      setDirtyCheck(null);
      d.reload();
      go(list);
    }
  };

  // A base rule (docs/EFEKTY.md, Reguły bazowe): no Delete, and Reset brings back its name, triggers, sound and LEDs.
  const base = rule?.base;
  const changed = base && JSON.stringify([r.name, r.enabled, r.triggers, r.sounds, r.led]) !== JSON.stringify([base.name, true, base.triggers, base.sounds, base.led]);
  const selected = r.triggers[Math.min(chip, r.triggers.length - 1)];
  const preset = r.led && presetOf(d, r.led.preset);
  const off = [!d.settings.sounds && r.sounds.length ? 'Sounds' : null, !d.settings.leds && r.led ? 'LEDs' : null].filter(Boolean);
  const canTest = r.triggers.length > 0 && (r.sounds.length > 0 || !!r.led);

  return (
    <div className={`fx-editor ${wide ? 'wide' : ''}`}>
      <header className="fx-editor-head">
        <button className="btn ghost" onClick={() => go(list)}>Cancel</button>
        <b>{rule ? (rule.base ? 'Built-in rule' : 'Edit rule') : 'New rule'}</b>
        <button className="btn primary" onClick={save} disabled={!isDirty && !!rule}>Save</button>
      </header>
      <div className="fx-name">
        <input className="field" aria-label="Rule name" placeholder="Name (optional), e.g. Big Fish" value={r.name} maxLength={40} onChange={e => set({ name: e.target.value })} />
        <Switch on={r.enabled} label="Rule on" onChange={enabled => set({ enabled })} />
      </div>

      <section className="fx-card">
        <div className="fx-card-head"><span className="fx-tag">WHEN</span><span className="muted">any of these happens</span></div>
        <div className="chip-row">
          {r.triggers.map((t, i) => (
            <span key={i} className={`fx-chip ${t === selected ? 'on' : ''}`}>
              <button onClick={() => setChip(i)}>{triggerLabel(t)}</button>
              <button aria-label={`Remove ${triggerLabel(t)}`} onClick={() => { set({ triggers: r.triggers.filter((_, j) => j !== i) }); setChip(0); }}>{Icon.close(14)}</button>
            </span>
          ))}
          <button className="fx-chip add" onClick={() => setSheet('trigger')}>+ Add trigger</button>
        </div>
        {selected && (selected.kind === 'dart' || selected.kind === 'total' || selected.kind === 'range' || selected.kind === 'combo' || selected.kind === 'left' || (selected.kind === 'game' && selected.event === 'marks')) && (
          <div className="fx-params">
            <TriggerParams key={r.triggers.indexOf(selected)} t={selected} onChange={t => set({ triggers: r.triggers.map(x => (x === selected ? t : x)) })} />
          </div>
        )}
      </section>

      <div className="fx-arrow" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M6 13l6 6 6-6" /></svg></div>

      <section className="fx-card">
        <div className="fx-card-head"><span className="fx-tag accent">THEN</span><span className="muted">play this</span></div>
        <div className="section">
          <div className="option-row"><b>Sound</b><span className="muted" style={{ fontSize: 13 }}>one at random</span></div>
          {r.sounds.map(id => {
            const s = d.sounds.find(x => x.id === id);
            if (!s) return null;
            return (
              <div key={id} className="fx-variant">
                <button className="icon-btn" aria-label={`Play ${s.name}`} onClick={() => playSound(s.id, (d.settings.volume / 100) * (s.volume / 100))}>{Icon.play(16)}</button>
                <span className="grow">{s.name}</span>
                <span className="muted">{(s.durationMs / 1000).toFixed(1)} s</span>
                <button className="icon-btn" aria-label={`Remove ${s.name}`} onClick={() => set({ sounds: r.sounds.filter(x => x !== id) })}>{Icon.close(16)}</button>
              </div>
            );
          })}
          <button className="fx-add" onClick={() => setSheet('sound')}>+ Add a variant from the library</button>
        </div>
        <div className="section">
          <b>LEDs</b>
          {r.led ? (
            <>
              <div className="fx-led">
                <button className="fx-led-preset" onClick={() => setSheet('preset')}><Dot color={preset?.color} size={14} /><span className="grow">{presetName(d, r.led.preset)}</span><Chevron /></button>
                <button className="btn" onClick={() => tryLed(r.led!.preset, r.led!.seconds, presetName(d, r.led!.preset))}>Try</button>
                <button className="icon-btn" aria-label="No LEDs" onClick={() => set({ led: null })}>{Icon.close(16)}</button>
              </div>
              <div className="option-row">
                <span>For</span>
                <Stepper label="seconds" unit=" s" value={r.led.seconds} min={0.1} max={60} step={0.1} onChange={seconds => set({ led: { ...r.led!, seconds } })} />
              </div>
            </>
          ) : <button className="fx-add" onClick={() => setSheet('preset')}>+ Light the LEDs</button>}
        </div>
      </section>

      <div className="fx-actions">
        {rule && !base && <button className="btn danger" onClick={() => setAskDelete(true)}>Delete</button>}
        {changed && <button className="btn" onClick={() => { set({ name: base.name, enabled: true, triggers: base.triggers, sounds: base.sounds, led: base.led }); setChip(0); }}>Reset to default</button>}
        <span className="spacer" />
        <button className="btn" disabled={!canTest} onClick={() => testRule(r)}>{Icon.play(16)}Test whole rule</button>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>Test plays the sound on this device and the LEDs on the controller{off.length > 0 ? `, although ${off.join(' and ')} ${off.length > 1 ? 'are' : 'is'} off on the pilot` : ''}.</p>

      {sheet === 'trigger' && <TriggerPicker wide={wide} onClose={() => setSheet(null)} onPick={t => { set({ triggers: [...r.triggers, t] }); setChip(r.triggers.length); }} />}
      {sheet === 'sound' && <SoundPicker d={d} wide={wide} taken={r.sounds} onClose={() => setSheet(null)} onPick={id => set({ sounds: [...r.sounds, id] })} />}
      {sheet === 'preset' && (
        <PresetPicker d={d} wide={wide} value={r.led?.preset ?? null} none={r.led ? 'No LEDs' : null} onClose={() => setSheet(null)}
          onPick={id => set({ led: id === null ? null : { preset: id, seconds: r.led?.seconds ?? 1 } })} />
      )}
      {askDelete && (
        <Dialog title="Delete this rule?" onClose={() => setAskDelete(false)} actions={<>
          <button className="btn" onClick={() => setAskDelete(false)}>Keep</button>
          <button className="btn danger" onClick={remove}>Delete</button>
        </>}>
          <p>{r.name || whenText(r) || 'This rule'} stops playing. Its sounds stay in the library.</p>
        </Dialog>
      )}
    </div>
  );
}

/** The editor over the whole screen. Escape closes it, unless a picker or dialog is open on top. */
export function RuleModal({ d, rule, wide }: { d: EffectsData; rule: Rule | null; wide: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.scrim') && go('/effects/rules');
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);
  return (
    <div className="fx-modal" role="dialog" aria-modal="true" aria-label={rule ? rule.name || whenText(rule) : 'New rule'}>
      <div className="fx-modal-body"><RuleEditor d={d} rule={rule} wide={wide} /></div>
    </div>
  );
}
