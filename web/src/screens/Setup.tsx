import { Fragment, useEffect, useRef, useState } from 'react';
import type { GameId, GameModule } from '../../../games/index.ts';
import { GAMES, GAME_GROUPS, MAX_PLAYERS } from '../../../games/index.ts';
import type { QuickSet, QuickSlot } from '../../../games/quick.ts';
import { fitsSet, quickSet, setPlayers, slotLabel, withBullOff } from '../../../games/quick.ts';
import type { RcOptions } from '../../../games/randomco.ts';
import { RANGE_PRESETS, highestNumber, lowestNumber } from '../../../games/randomco.ts';
import type { OptionDef } from '../../../games/turns.ts';
import { BULL_OFF, plural } from '../../../games/turns.ts';
import { X01_OPTIONS } from '../../../games/x01/index.ts';
import type { BullOff, X01Options } from '../../../games/x01/rules.ts';
import type { ClientState, PlayerInfo, RosterEntry } from '../../../server/protocol.ts';
import { GameIcon } from '../components/GameIcon.tsx';
import { HowToButton, HowToScreen, Info } from '../components/HowTo.tsx';
import { startLabel } from '../match.ts';
import { Dialog, Icon, Presence, act, toast } from '../components/ui.tsx';
import { store } from '../util.ts';

const GAP = 8; // between roster rows
const LAST_GAME_KEY = 'itdarts.lastGame';
// One bull-off for every game, picked on the Players step (docs/UI.md, Start i koniec meczu).
const BULL_OFF_KEY = 'itdarts.bullOff';
// X01 keeps its original key so saved options survive.
const optionsKey = (g: GameId) => (g === 'x01' ? 'itdarts.x01Options' : `itdarts.options.${g}`);

function loadOptions(g: GameId): Record<string, unknown> {
  try {
    return { ...GAMES[g].defaults, ...JSON.parse(store.get(optionsKey(g)) ?? '{}') };
  } catch {
    return { ...GAMES[g].defaults };
  }
}

function lastGame(): GameId {
  const g = store.get(LAST_GAME_KEY);
  return g && g in GAMES ? (g as GameId) : 'x01';
}

/** Until the first pick on the Players step, the bull-off last used with X01, where it used to be an option. */
function loadBullOff(): BullOff {
  const b = store.get(BULL_OFF_KEY) ?? loadOptions('x01').bullOff;
  return b === 'closest' || b === 'pdc' ? b : 'off';
}

const fits = (g: GameModule, n: number) => n >= g.minPlayers && n <= (g.maxPlayers ?? MAX_PLAYERS);
/** On a greyed-out tile: why the game is not for this lineup. */
const whyNot = (g: GameModule) => (g.maxPlayers === 1 ? 'Solo only' : `${g.minPlayers}+ players`);
const blockText = (g: GameModule) => (g.maxPlayers === 1 ? `${g.name} is for 1 player` : `${g.name} needs ${g.minPlayers} or more players`);
const namesShort = (r: RosterEntry[]) => (r.length <= 3 ? r.map(p => p.name).join(', ') : `${r[0].name}, ${r[1].name} +${r.length - 2}`);
const andList = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}` : l[0]);

const pencil = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>;
const play = <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4l14 8-14 8z" /></svg>;

function Seg<T extends string | number | boolean>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map(([v, l]) => <button key={String(v)} aria-pressed={v === value} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="stepper">
      <button aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(min, value - 1))}>−</button>
      <span className="num">{value}</span>
      <button aria-label={`More ${label}`} onClick={() => onChange(Math.min(max, value + 1))}>+</button>
    </div>
  );
}

function RosterList({ roster, setRoster }: { roster: RosterEntry[]; setRoster: (r: RosterEntry[]) => void }) {
  const [drag, setDrag] = useState<{ from: number; dy: number } | null>(null);
  const start = useRef(0);
  // Row height + gap, measured on grab: rows are lower on the laptop.
  const row = useRef(64);
  const ROW = row.current;
  const target = drag ? Math.max(0, Math.min(roster.length - 1, drag.from + Math.round(drag.dy / ROW))) : -1;

  // The drop re-orders the rows and puts every shift back to 0 in one render: without transitions in that render the
  // rows don't animate from their old slot (T5 in the motion audit); they come back two frames later.
  const [dropped, setDropped] = useState(false);
  useEffect(() => {
    if (!dropped) return;
    let id = requestAnimationFrame(() => (id = requestAnimationFrame(() => setDropped(false))));
    return () => cancelAnimationFrame(id);
  }, [dropped]);

  if (roster.length === 0) return null;
  return (
    <div className={`roster-list ${dropped ? 'dropped' : ''}`}>
      {roster.map((r, i) => {
        let shift = 0;
        if (drag) {
          if (i === drag.from) shift = drag.dy;
          else if (drag.from < i && i <= target) shift = -ROW;
          else if (target <= i && i < drag.from) shift = ROW;
        }
        return (
          <div key={`${r.playerId ?? 'g'}-${r.name}`} className={`list-row roster-row ${drag?.from === i ? 'held' : ''}`}
            style={{ transform: `translateY(${shift}px)` }}>
            <span className="num roster-no">{i + 1}</span>
            <span className="grow">{r.name}{r.playerId === null && <span className="muted guest-tag"> · guest</span>}</span>
            <button className="icon-btn" style={{ background: 'transparent', color: 'var(--muted2)' }} aria-label={`Remove ${r.name}`}
              onClick={() => setRoster(roster.filter((_, j) => j !== i))}>{Icon.close(18)}</button>
            <span aria-label={`Move ${r.name}: drag, or press up or down`} role="button" tabIndex={0} className="grip"
              onKeyDown={e => {
                const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : -1;
                if (to < 0 || to >= roster.length) return;
                e.preventDefault();
                const next = [...roster];
                [next[i], next[to]] = [next[to], next[i]];
                setRoster(next);
              }}
              onPointerDown={e => {
                (e.target as Element).setPointerCapture(e.pointerId);
                start.current = e.clientY;
                row.current = (e.currentTarget.closest('.list-row') as HTMLElement).offsetHeight + parseFloat(getComputedStyle(e.currentTarget.closest('.roster-list')!).rowGap || `${GAP}`);
                setDrag({ from: i, dy: 0 });
              }}
              onPointerMove={e => drag && drag.from === i && setDrag({ from: i, dy: e.clientY - start.current })}
              onPointerUp={() => {
                if (!drag) return;
                const next = [...roster];
                const [moved] = next.splice(drag.from, 1);
                next.splice(target, 0, moved);
                setDropped(true);
                setDrag(null);
                setRoster(next);
              }}
              onPointerCancel={() => setDrag(null)}>
              {Icon.grip()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Label({ def, text }: { def?: OptionDef<any>; text: string }) {
  return <div className="opt-label"><b>{text}</b>{def && <Info text={def.info} />}</div>;
}

/** A stepper with its name, level with the switches beside it in the options grid. */
function StepperRow({ title, sub, ...stepper }: { title: string; sub: string; value: number; min: number; max: number; label: string; onChange: (v: number) => void }) {
  return (
    <div className="option-row stepper-row">
      <div><b>{title}</b><div className="muted">{sub}</div></div>
      <Stepper {...stepper} />
    </div>
  );
}

const x01Def = (key: string) => X01_OPTIONS.find(d => d.key === key || d.label === key);

/** In the two-column grid: Start score | Match mode, Check-out | First to, Check-in | Legs per set. The bull-off is on the Players step. */
function X01Section({ options, setOptions }: { options: X01Options; setOptions: (o: X01Options) => void }) {
  const mm = options.matchMode;
  return (
    <>
      <div className="section"><Label def={x01Def('startScore')} text="Start score" />
        <Seg value={options.startScore} options={[[201, '201'], [301, '301'], [501, '501']]} onChange={v => setOptions({ ...options, startScore: v })} />
      </div>
      <div className="section"><Label def={x01Def('Match mode')} text="Match mode" />
        <Seg value={mm.kind} options={[['off', 'Off'], ['legs', 'Legs'], ['sets', 'Sets']]}
          onChange={k => setOptions({ ...options, matchMode: k === 'off' ? { kind: 'off' } : k === 'legs' ? { kind: 'legs', firstTo: 3 } : { kind: 'sets', firstTo: 2, legsPerSet: 3 } })} />
      </div>
      <div className="section"><Label def={x01Def('checkOut')} text="Check-out" />
        <Seg value={options.checkOut} options={[['single', 'Single'], ['double', 'Double'], ['master', 'Master']]} onChange={v => setOptions({ ...options, checkOut: v })} />
      </div>
      {mm.kind === 'off'
        ? <div className="muted opt-note">After each leg you choose: next leg or end the match.</div>
        : <StepperRow title="First to" sub={mm.kind === 'legs' ? 'legs to win the match' : 'sets to win the match'} label={mm.kind} value={mm.firstTo} min={1}
          max={mm.kind === 'legs' ? 21 : 11} onChange={v => setOptions({ ...options, matchMode: { ...mm, firstTo: v } })} />}
      <div className="section"><Label def={x01Def('checkIn')} text="Check-in" />
        <Seg value={options.checkIn} options={[['straight', 'Straight'], ['double', 'Double']]} onChange={v => setOptions({ ...options, checkIn: v })} />
      </div>
      {mm.kind === 'sets' && (
        <StepperRow title="Legs per set" sub="legs to win a set" label="legs per set" value={mm.legsPerSet} min={1} max={7}
          onChange={v => setOptions({ ...options, matchMode: { ...mm, legsPerSet: v } })} />
      )}
    </>
  );
}

/**
 * Min or Max: the typed text stays while the field has focus, but every keystroke already saves the normalized value,
 * so Start sends it even if the field never blurs (iOS). Leaving the field shows the normalized value.
 */
function RangeField({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <label>{label}
      <input className="field num" type="number" inputMode="numeric" value={text ?? value} aria-label={`${label} number`}
        onFocus={() => setText(String(value))}
        onChange={e => {
          setText(e.target.value);
          const n = parseInt(e.target.value, 10);
          if (Number.isInteger(n)) onChange(n);
        }}
        onBlur={() => setText(null)} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} />
    </label>
  );
}

/** Random Checkouts: Min and Max with presets; the game keeps them within the check-out rule. */
function RangeSection({ options, setOptions }: { options: RcOptions; setOptions: (o: RcOptions) => void }) {
  const presets = RANGE_PRESETS.map(([l, min, max]) => [l, Math.max(min, lowestNumber(options.checkOut)), Math.min(max, highestNumber(options.checkOut))] as const);
  const on = presets.find(([, min, max]) => min === options.min && max === options.max)?.[0] ?? '';
  const field = (k: 'min' | 'max', label: string) => <RangeField label={label} value={options[k]} onChange={n => setOptions({ ...options, [k]: n })} />;
  return (
    <div className="section opt-full">
      <Label def={GAMES.randomco.options.find(d => d.label === 'Range')} text="Range" />
      <Seg value={on} options={presets.map(([l]) => [l, l])} onChange={l => {
        const [, min, max] = presets.find(p => p[0] === l)!;
        setOptions({ ...options, min, max });
      }} />
      <div className="range-row">{field('min', 'Min')}{field('max', 'Max')}</div>
    </div>
  );
}

/** Minigame options straight from the module's definitions, without the bull-off; options for 2+ only with 2+ players. */
function MiniSection({ game, options, players, setOptions: save }: { game: GameId; options: Record<string, unknown>; players: number; setOptions: (o: Record<string, unknown>) => void }) {
  const keyed = GAMES[game].options.filter(d => d.key && d.key !== 'bullOff');
  const defs = keyed.filter(d => !d.when || d.when(options, players));
  const later = players === 1 ? keyed.filter(d => d.when && !d.when(options, 1) && d.when(options, 2)).map(d => d.label) : [];
  // The module keeps related options in step, e.g. the Random Checkouts range when the check-out changes.
  const setOptions = (o: Record<string, unknown>) => save(GAMES[game].normalizeOptions(o));
  return (
    <>
      {game === 'randomco' && <RangeSection options={options as unknown as RcOptions} setOptions={o => setOptions(o as unknown as Record<string, unknown>)} />}
      {defs.map(d => (
        <div key={d.key} className="section">
          <Label def={d} text={d.label} />
          <Seg value={options[d.key!] as string} options={d.choices as [string, string][]} onChange={v => setOptions({ ...options, [d.key!]: v })} />
        </div>
      ))}
      {later.length > 0 && <div className="opt-note opt-full"><b>Solo:</b> {andList(later)} {later.length > 1 ? 'appear' : 'appears'} with 2 or more players.</div>}
      {game === '121' && players > 1 && <div className="opt-note opt-full">With 2 or more players 121 is played in Co-op: one shared target.</div>}
      {game === 'killer' && <div className="opt-note opt-full">Numbers are drawn at the start. Reroll them before the first dart.</div>}
    </>
  );
}

function Steps({ steps, at, onGo }: { steps: { label: string; value?: string }[]; at: number; onGo: (i: number) => void }) {
  return (
    <nav className="steps" aria-label="Steps">
      {steps.map((s, i) => {
        const inner = <><span className="n">{i < at ? '✓' : i + 1}</span><span className="label">{s.label}</span>{i < at && s.value && <span className="val">· {s.value}</span>}</>;
        return (
          <Fragment key={s.label}>
            {i > 0 && <span className="step-sep" />}
            {/* Steps go back only (Q10): the done ones are buttons. */}
            {i < at
              ? <button className="step done" onClick={() => onGo(i)}>{inner}</button>
              : <span className={`step ${i === at ? 'cur' : ''}`} aria-current={i === at ? 'step' : undefined}>{inner}</span>}
          </Fragment>
        );
      })}
    </nav>
  );
}

type Step = 'players' | 'game' | 'options';
/** A quick game being edited: its own game and its own copy of the options, apart from the last used ones (Q14). */
interface Edit { index: number; set: QuickSet; game: GameId; options: Record<string, unknown> }

/**
 * New match as three steps, Players → Game → Options (docs/UI.md, Start i koniec meczu). Quick start on the Players step
 * starts a saved quick game at once; its pencil edits the slot through Game → Options.
 */
export function Setup({ s, preset, onClose }: { s: ClientState; preset?: { game: GameId; options: unknown } | null; onClose: () => void }) {
  // The last game played is preselected, or the game of a lobby record with its options.
  const [game, setGame] = useState<GameId>(() => preset?.game ?? lastGame());
  const [allOptions, setAllOptions] = useState<Partial<Record<GameId, Record<string, unknown>>>>(
    () => (preset ? { [preset.game]: GAMES[preset.game].normalizeOptions(preset.options) as Record<string, unknown> } : {}));
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [bullOff, setBullOffState] = useState<BullOff>(loadBullOff);
  const [step, setStep] = useState<Step>('players');
  const [edit, setEdit] = useState<Edit | null>(null);
  const [askRemove, setAskRemove] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [howTo, setHowTo] = useState(false);

  // The chosen game is in sight when the Game step opens, also deep in the list on the phone.
  useEffect(() => { if (step === 'game') document.querySelector('.game-tile.on')?.scrollIntoView({ block: 'nearest' }); }, [step]);

  const n = roster.length;
  const cur = edit?.game ?? game;
  const g = GAMES[cur];
  /** Players the options are for: the lineup, or the quick game's set while editing. */
  const forPlayers = edit ? setPlayers(edit.set) : n;
  const options = edit ? edit.options : (allOptions[game] ?? loadOptions(game));
  const setOptions = (o: Record<string, unknown>) => {
    if (edit) return setEdit({ ...edit, options: o });
    setAllOptions({ ...allOptions, [game]: o });
    store.set(optionsKey(game), JSON.stringify(o));
  };
  const setBullOff = (b: BullOff) => {
    setBullOffState(b);
    store.set(BULL_OFF_KEY, b);
  };
  const editSlot = edit && s.quickGames[edit.set][edit.index];

  const add = (r: RosterEntry) => {
    if (n >= MAX_PLAYERS) return toast({ text: `At most ${MAX_PLAYERS} players`, kind: 'error' });
    setRoster([...roster, r]);
  };
  // Player tiles and chips switch: a second tap takes the player out (Q6).
  const toggle = (p: PlayerInfo) => {
    const i = roster.findIndex(r => r.playerId === p.id);
    if (i >= 0) setRoster(roster.filter((_, j) => j !== i));
    else add({ playerId: p.id, name: p.name });
  };

  const submitGuest = () => {
    const nm = name.trim();
    if (!nm) return;
    if (roster.some(r => r.name.toLowerCase() === nm.toLowerCase())) return toast({ text: `${nm} is already in`, kind: 'error' });
    add({ playerId: null, name: nm });
    setName('');
    setAdding(false);
  };

  const startGuest = () => {
    setAdding(true);
    setName(`Guest ${roster.filter(r => r.playerId === null).length + 1}`);
  };

  const shuffle = () => {
    const next = [...roster];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setRoster(next);
  };

  /** Starts a match with the lineup and the bull-off from the Players step, for a game from the steps or a quick game. */
  const startMatch = async (id: GameId, o: Record<string, unknown>) => {
    setBusy(true);
    const r = await act({ type: 'startMatch', game: id, options: withBullOff(id, o, bullOff), roster });
    setBusy(false);
    if (r.ok) {
      store.set(LAST_GAME_KEY, id);
      onClose();
    }
  };

  const openEdit = (index: number) => {
    const set = quickSet(n);
    const slot = s.quickGames[set][index];
    const id = slot?.game ?? (fitsSet(game, set) ? game : set === 'solo' ? '121' : 'x01');
    setEdit({ index, set, game: id, options: slot ? GAMES[id].normalizeOptions(slot.options) as Record<string, unknown> : loadOptions(id) });
    setStep('game');
  };
  const closeEdit = () => {
    setEdit(null);
    setAskRemove(false);
    setStep('players');
  };
  const saveSlot = async (slot: QuickSlot | null) => {
    if (!edit) return;
    setBusy(true);
    const r = await act({ type: 'setQuickGame', set: edit.set, index: edit.index, slot });
    setBusy(false);
    if (r.ok) closeEdit();
  };

  const pickGame = (id: GameId) => {
    if (edit) setEdit({ ...edit, game: id, options: id === edit.game ? edit.options : loadOptions(id) });
    else setGame(id);
    setStep('options');
  };

  const back = () => {
    if (step === 'options') setStep('game');
    else if (step === 'game') edit ? closeEdit() : setStep('players');
    else onClose();
  };

  if (howTo) return <HowToScreen game={cur} options={options} onClose={() => setHowTo(false)} />;

  const order: Step[] = edit ? ['game', 'options'] : ['players', 'game', 'options'];
  const steps = order.map(st => ({ label: st[0].toUpperCase() + st.slice(1), value: st === 'players' ? namesShort(roster) : st === 'game' ? g.name : undefined }));
  const title = edit && `Quick game ${edit.index + 1} · ${edit.set === 'solo' ? 'solo' : '2+ players'}`;

  const header = (
    <header className="phone-header setup-head">
      <button className="icon-btn" style={{ background: 'transparent' }} aria-label="Back" onClick={back}>{Icon.back(22)}</button>
      <h1>{title || 'New match'}</h1>
      <Steps steps={steps} at={order.indexOf(step)} onGo={i => setStep(order[i])} />
    </header>
  );

  // ---------- Players ----------
  if (step === 'players') {
    const active = s.players.filter(p => !p.archived);
    const recent = s.recentPlayerIds.map(id => active.find(p => p.id === id)).filter(p => !!p).slice(0, 3);
    const others = active.filter(p => !recent.includes(p));
    const seat = (p: PlayerInfo) => roster.findIndex(r => r.playerId === p.id);
    const set = quickSet(n);
    const next = preset ? 'options' : 'game';
    return (
      <div className="phone match-setup step-players">
        {header}
        <div className="setup-main">
          <div className="setup-pick">
            <h2 className="setup-title">Who's playing?</h2>
            {recent.length > 0 && <>
              <div className="caps">Recent</div>
              <div className="ptiles">
                {recent.map(p => {
                  const i = seat(p);
                  return (
                    <button key={p.id} className={`ptile ${i >= 0 ? 'on' : ''}`} aria-pressed={i >= 0} onClick={() => toggle(p)}>
                      {i < 0 && <span className="plus">{Icon.plus(18)}</span>}<span className="nm">{p.name}</span>{i >= 0 && <span className="badge num">{i + 1}</span>}
                    </button>
                  );
                })}
              </div>
            </>}
            <div className="caps">{recent.length ? 'Everyone else' : 'Players'}</div>
            <div className="setup-chips">
              <div className="chip-row">
                {others.map(p => {
                  const i = seat(p);
                  return (
                    <button key={p.id} className={`chip pchip ${i >= 0 ? 'on' : ''}`} aria-pressed={i >= 0} onClick={() => toggle(p)}>
                      {i >= 0 ? <span className="badge num">{i + 1}</span> : '+ '}<span className="nm">{p.name}</span>
                    </button>
                  );
                })}
                {!adding && <button className="chip pchip dash" onClick={startGuest}>+ Guest</button>}
              </div>
              {adding && <>
                <form className="option-row guest-form" onSubmit={e => { e.preventDefault(); submitGuest(); }}>
                  <input className="field" autoFocus value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="Guest name" aria-label="Guest name" />
                  <button className="btn primary" type="submit">Add</button>
                  <button className="btn" type="button" onClick={() => setAdding(false)}>Cancel</button>
                </form>
                <div className="muted guest-note">Guests play this match only. No stats or records are kept for them.</div>
              </>}
            </div>
            <section className="quick">
              <div className="caps">Quick start · {set === 'solo' ? 'solo' : '2+ players'}</div>
              <div className="qgrid">
                {s.quickGames[set].map((slot, i) => {
                  if (!slot) return <button key={i} className="qempty" onClick={() => openEdit(i)}>+ Add quick game</button>;
                  const sg = GAMES[slot.game];
                  const why = s.match ? 'A match is in progress' : n === 0 ? 'Add players' : !fits(sg, n) ? whyNot(sg) : null;
                  return (
                    <div key={i} className="qslot">
                      {/* While a start is on its way the tiles keep their look; a second tap does nothing. */}
                      <button className="qmain" disabled={!!why} onClick={() => !busy && void startMatch(slot.game, slot.options)}>
                        <GameIcon game={slot.game} size={28} stroke={1.75} className="qic" />
                        <b>{sg.name}</b>
                        <span className="qd">{slotLabel(slot.game, slot.options, setPlayers(set))}</span>
                        <span className="qa">{why ?? <>{play}Start · {plural(n, 'player')}</>}</span>
                      </button>
                      <button className="icon-btn qedit" aria-label={`Edit quick game ${i + 1}`} onClick={() => openEdit(i)}>{pencil}</button>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
          <div className="setup-side">
            <div className={`order-card ${n >= 6 ? 'many' : ''}`}>
              <div className="option-row">
                <span className="caps">Throwing order</span>
                <button className="chip" onClick={shuffle} disabled={n < 2}>Shuffle</button>
              </div>
              <RosterList roster={roster} setRoster={setRoster} />
              {n === 0 && <div className="order-hint">Tap players to add them. The order here is the throwing order.</div>}
              {n === 1 && <div className="order-hint"><b>Solo.</b> Add a second player for versus games, bull-off and co-op.</div>}
              {n >= 2 && (
                <div className="bull-pick">
                  <div className="opt-label"><b>Bull-off</b><Info text={BULL_OFF.info} /><span className="bull-tag">{bullOff === 'off' ? `${roster[0].name} throws first` : 'decides who throws first'}</span></div>
                  <Seg value={bullOff} options={BULL_OFF.choices as [BullOff, string][]} onChange={setBullOff} />
                </div>
              )}
            </div>
            <div className="setup-foot">
              <button className="btn primary" disabled={n === 0} onClick={() => setStep(next)}>{n ? `Next · ${next === 'game' ? 'Game' : 'Options'}` : 'Add players to continue'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Game ----------
  if (step === 'game') {
    const ok = (id: GameId) => (edit ? fitsSet(id, edit.set) : fits(GAMES[id], n));
    const group = (i: number) => {
      const { group: grp, title, ids } = GAME_GROUPS[i];
      return (
        <section key={grp} className={`game-group g-${grp}`}>
          <h3 className="caps game-group-title">{title}</h3>
          <div className="game-grid">
            {ids.map(id => {
              const t = GAMES[id];
              return (
                <button key={id} className={`game-tile ${id === cur && ok(id) ? 'on' : ''}`} aria-pressed={id === cur && ok(id)} disabled={!ok(id)} onClick={() => pickGame(id)}>
                  <GameIcon game={id} className="tile-icon" stroke={1.25} />
                  <b>{t.name}</b>
                  <span>{t.blurb}</span>
                  {!ok(id) && <small>{whyNot(t)}</small>}
                </button>
              );
            })}
          </div>
        </section>
      );
    };
    return (
      <div className="phone match-setup step-game">
        {header}
        <div className="setup-main setup-games">
          <div className="games-col">{group(0)}{group(1)}</div>
          <div className="games-col">{group(2)}</div>
        </div>
        <div className="setup-foot">
          <button className="btn ghost" onClick={back}>Back</button>
          <span className="sum">Tap a game</span>
        </div>
      </div>
    );
  }

  // ---------- Options ----------
  const fitsNow = edit ? fitsSet(cur, edit.set) : fits(g, n);
  const blocked = edit ? null : s.match ? 'A match is in progress' : !fitsNow ? blockText(g) : null;
  return (
    <div className="phone match-setup step-options">
      {header}
      <div className="setup-main">
        <aside className="gameinfo">
          <GameIcon game={cur} size={72} stroke={1.5} className="gameinfo-icon" />
          <h2 className="setup-game-name">{g.name}</h2>
          <p className="setup-blurb">{g.blurb}</p>
          <HowToButton onClick={() => setHowTo(true)} />
          <div className="who">
            {edit ? <>
              <div className="caps">Quick game {edit.index + 1}</div>
              <div className="names">Shown for {edit.set === 'solo' ? 'solo' : '2 or more players'}</div>
            </> : <>
              <div className="caps">{plural(n, 'player')}</div>
              <div className="names">{roster.map(r => r.name).join(', ')}</div>
            </>}
          </div>
        </aside>
        <div className="setup-opts">
          {!fitsNow ? (
            <div className="opt-block opt-full">
              <span>{g.maxPlayers === 1 ? `${g.name} is played solo. You have ${plural(n, 'player')}.` : `${g.name} needs ${g.minPlayers} or more players. You have ${n}.`}</span>
              <button className="btn" onClick={() => setStep('players')}>Change players</button>
            </div>
          ) : cur === 'x01'
            ? <X01Section options={options as unknown as X01Options} setOptions={o => setOptions(o as unknown as Record<string, unknown>)} />
            : <MiniSection game={cur} options={options} players={forPlayers} setOptions={setOptions} />}
        </div>
      </div>
      <div className="setup-foot">
        <button className="btn ghost" onClick={back}>Back</button>
        <span className="sum">
          {!edit && <><b>{namesShort(roster)}</b> · </>}<b>{g.name}</b>{fitsNow && <> · {slotLabel(cur, options, forPlayers)}</>}
        </span>
        {edit && editSlot && <button className="btn ghost" disabled={busy} onClick={() => setAskRemove(true)}>Remove</button>}
        {edit
          ? <button className="btn primary" disabled={busy} onClick={() => void saveSlot({ game: cur, options })}>Save quick game {edit.index + 1}</button>
          : <button className="btn primary" disabled={!!blocked || busy} onClick={() => void startMatch(cur, options)}>{blocked ?? startLabel(g.name, n)}</button>}
      </div>
      <Presence>{askRemove && edit && editSlot && (
        <Dialog title={`Remove quick game ${edit.index + 1}?`} onClose={() => setAskRemove(false)} actions={<>
          <button className="btn" onClick={() => setAskRemove(false)}>Cancel</button>
          <button className="btn danger" disabled={busy} onClick={() => void saveSlot(null)}>Remove</button>
        </>}>
          <p>{GAMES[editSlot.game].name} leaves Quick start for {edit.set === 'solo' ? 'solo' : '2+ players'} on every device.</p>
        </Dialog>
      )}</Presence>
    </div>
  );
}
