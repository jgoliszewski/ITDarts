// Rules tab: the list grouped by trigger, and the When → Then editor (docs/EFEKTY.md, Układ strony).
import { useEffect, useState } from 'react';
import type { GameEvent, Trigger, TriggerKind } from '../../../../games/effects.ts';
import { GAME_EVENT_LABELS, SIMPLE_LABELS, priority, triggerLabel } from '../../../../games/effects.ts';
import type { Rule, RuleInput } from '../../../../server/effects/store.ts';
import { Dialog, Icon } from '../../components/ui.tsx';
import { playFile } from '../../sound.ts';
import type { EffectsData } from './api.ts';
import { call, go, presetName, presetOf, setDirtyCheck, tryLed } from './api.ts';
import { Chevron, CondPicker, Dot, PatternPicker, PresetPicker, SearchField, Seg, Sheet, Stepper, Switch, matchesQuery } from './parts.tsx';

// ---------- groups ----------

type Group = 'play' | 'games' | 'match';
const GROUP_TITLES: [Group, string][] = [['play', 'Darts, visits and results'], ['games', 'Minigames'], ['match', 'Match and board']];

const groupOf = (t: Trigger): Group =>
  t.kind === 'game' ? 'games' : ['matchStart', 'legStart', 'takeoutStart', 'takeoutEnd', 'boardOffline', 'boardOnline'].includes(t.kind) ? 'match' : 'play';

/** A rule's most important trigger decides its group and its place in it. */
const best = (r: Rule) => r.triggers.reduce((a, b) => (priority(b) < priority(a) ? b : a));

function groupRules(rules: Rule[]): { group: Group; title: string; rules: Rule[] }[] {
  // A stable sort: equal priorities keep the file's order, oldest first.
  const sorted = [...rules].sort((a, b) => priority(best(a)) - priority(best(b)));
  return GROUP_TITLES
    .map(([group, title]) => ({ group, title, rules: sorted.filter(r => groupOf(best(r)) === group) }))
    .filter(g => g.rules.length > 0);
}

/** The rule at the top of the list, as the list orders them. */
export const firstRule = (rules: Rule[]): Rule | null => groupRules(rules)[0]?.rules[0] ?? null;

const whenText = (r: { triggers: Trigger[] }) => r.triggers.map(triggerLabel).join(' · ');

function soundsText(d: EffectsData, ids: string[]) {
  const names = ids.map(id => d.sounds.find(s => s.id === id)?.name).filter(Boolean);
  return names.length === 0 ? null : names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`;
}

/** The rule as the server takes it, with the switch flipped. */
const toggled = (r: Rule): RuleInput => ({ name: r.name, enabled: !r.enabled, triggers: r.triggers, sounds: r.sounds, led: r.led });

// ---------- list ----------

export function RuleList({ d, selected, wide }: { d: EffectsData; selected: string | null; wide: boolean }) {
  const groups = groupRules(d.rules);
  return (
    <div className="fx-rules">
      {wide && (
        <div className="option-row">
          <h2 className="fx-h">Rules</h2>
          <button className="btn primary" onClick={() => go('/effects/rules/new')}>{Icon.plus()}New rule</button>
        </div>
      )}
      {groups.length === 0 && (
        <div className="fx-empty">
          <b>No rules yet</b>
          <span>Scoreboard animations work without them. Add a rule to play a sound or light the LEDs on 180, bust, checkout and more.</span>
        </div>
      )}
      {groups.map(g => (
        <section key={g.group} className="section">
          <div className="option-row"><span className="caps">{g.title}</span><span className="muted">{g.rules.length} {g.rules.length === 1 ? 'rule' : 'rules'}</span></div>
          {g.rules.map(r => {
            const sound = soundsText(d, r.sounds);
            const preset = r.led && presetOf(d, r.led.preset);
            return (
              <div key={r.id} className={`fx-row ${r.enabled ? '' : 'off'} ${selected === r.id ? 'on' : ''}`}>
                <button className="fx-row-main" onClick={() => go(`/effects/rules/${r.id}`)}>
                  <b>{r.name || whenText(r)}</b>
                  {r.name && <span className="muted">{whenText(r)}</span>}
                  <span className="fx-what">
                    {sound && <span>♪ {sound}</span>}
                    {r.led && <span><Dot color={preset?.color} size={10} />{presetName(d, r.led.preset)} · {r.led.seconds} s</span>}
                    {!sound && !r.led && <span className="fx-todo">No sound yet · tap to pick one</span>}
                  </span>
                </button>
                <Switch on={r.enabled} label={`${r.name || whenText(r)} on`} onChange={() => call('PUT', `/api/effects/rules/${r.id}`, toggled(r)).then(d.reload)} />
              </div>
            );
          })}
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
    ['bust', 'Bust', 'The visit goes bust (X01, 121)'],
    ['checkout', SIMPLE_LABELS.checkout, 'Checkout or a won leg; a won game in Higher or Lower'],
    ['setWon', 'Set won', 'X01 with sets'],
    ['matchWon', 'Match won', 'The end of every game'],
  ]],
  ['Minigames', [
    ['game:targetHit', 'Target hit', 'Around the Clock'],
    ['game:sectorCleared', 'Sector cleared', 'Full Board'],
    ['game:attemptFailed', 'Attempt failed', '121: out of darts on a target'],
    ['game:marks', 'Marks in visit', 'Cricket: 5 to 9 marks in one visit'],
    ['game:whiteHorse', 'White Horse', 'Cricket: three fresh trebles'],
    ['game:sectorClosed', 'Sector closed', 'Cricket'],
    ['game:becameKiller', 'Became killer', 'Killer'],
    ['game:lifeLost', 'Life lost', 'Killer'],
    ['game:eliminated', 'Player eliminated', 'Killer, Higher or Lower'],
    ['game:newRecord', GAME_EVENT_LABELS.newRecord, 'An office or personal record at the end'],
  ]],
  ['Match and board', [
    ['matchStart', 'Match start', 'Right after Start'],
    ['legStart', 'Leg start', 'Every leg, the first one too'],
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
            <button className="icon-btn" aria-label={`Play ${s.name}`} onClick={() => playFile(`/sounds/${s.file}`, (d.settings.volume / 100) * (s.volume / 100))}>{Icon.play(16)}</button>
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
    // The phone goes back to the list; the laptop stays on the rule.
    if (!wide) go(list);
    else if (!rule) go(`/effects/rules/${(res as { id: string }).id}`, true);
  };
  const remove = async () => {
    setAskDelete(false);
    if (rule && (await call('DELETE', `/api/effects/rules/${rule.id}`))) {
      setDirtyCheck(null);
      d.reload();
      go(list, wide);
    }
  };

  const selected = r.triggers[Math.min(chip, r.triggers.length - 1)];
  const preset = r.led && presetOf(d, r.led.preset);
  const off = [!d.settings.sounds && r.sounds.length ? 'Sounds' : null, !d.settings.leds && r.led ? 'LEDs' : null].filter(Boolean);
  const canTest = r.triggers.length > 0 && (r.sounds.length > 0 || !!r.led);

  return (
    <div className="fx-editor">
      {!wide && (
        <header className="fx-editor-head">
          <button className="btn ghost" onClick={() => go(list)}>Cancel</button>
          <b>{rule ? 'Edit rule' : 'New rule'}</b>
          <button className="btn primary" style={{ height: 40 }} onClick={save} disabled={!isDirty && !!rule}>Save</button>
        </header>
      )}
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
        {selected && (selected.kind === 'dart' || selected.kind === 'total' || selected.kind === 'range' || selected.kind === 'combo' || (selected.kind === 'game' && selected.event === 'marks')) && (
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
                <button className="icon-btn" aria-label={`Play ${s.name}`} onClick={() => playFile(`/sounds/${s.file}`, (d.settings.volume / 100) * (s.volume / 100))}>{Icon.play(16)}</button>
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
                <Stepper label="seconds" unit=" s" value={r.led.seconds} min={0.5} max={60} step={0.5} onChange={seconds => set({ led: { ...r.led!, seconds } })} />
              </div>
            </>
          ) : <button className="fx-add" onClick={() => setSheet('preset')}>+ Light the LEDs</button>}
        </div>
      </section>

      <div className="fx-actions">
        {rule && <button className="btn danger" onClick={() => setAskDelete(true)}>Delete</button>}
        <span className="spacer" />
        <button className="btn" disabled={!canTest} onClick={() => call('POST', '/api/effects/test', r)}>{Icon.play(16)}Test whole rule</button>
        {wide && <button className="btn primary" onClick={save} disabled={!isDirty && !!rule}>Save</button>}
      </div>
      {off.length > 0 && <p className="muted" style={{ margin: 0, fontSize: 13 }}>{off.join(' and ')} {off.length > 1 ? 'are' : 'is'} off on the pilot; Test plays anyway.</p>}

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
