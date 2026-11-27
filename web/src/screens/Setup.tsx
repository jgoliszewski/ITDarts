import type { CSSProperties, ReactNode } from 'react';
import { Fragment, useEffect, useState } from 'react';
import type { GameId, GameModule } from '../../../games/index.ts';
import { GAMES, GAME_GROUPS, MAX_PLAYERS } from '../../../games/index.ts';
import { hasBullOff, slotLabel, withBullOff } from '../../../games/quick.ts';
import type { RcOptions } from '../../../games/randomco.ts';
import { RANGE_PRESETS, highestNumber, lowestNumber } from '../../../games/randomco.ts';
import type { OptionDef } from '../../../games/turns.ts';
import { plural } from '../../../games/turns.ts';
import { X01_OPTIONS } from '../../../games/x01/index.ts';
import type { BullOff, X01Options } from '../../../games/x01/rules.ts';
import type { ClientState, RosterEntry } from '../../../server/protocol.ts';
import { Avatar } from '../components/Avatar.tsx';
import { GameIcon } from '../components/GameIcon.tsx';
import { HowToButton, HowToScreen } from '../components/HowTo.tsx';
import { fits, initialsOf, lineupBlock, startLabel, throwOrder } from '../match.ts';
import { Icon, act, toast } from '../components/ui.tsx';
import { store } from '../util.ts';

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

const blockText = (g: GameModule) => (g.maxPlayers === 1 ? `${g.name} is for 1 player` : g.maxPlayers === g.minPlayers ? `${g.name} is for ${g.minPlayers} players` : `${g.name} needs ${g.minPlayers} or more players`);
const namesShort = (r: RosterEntry[]) => (r.length <= 3 ? r.map(p => p.name).join(', ') : `${r[0].name}, ${r[1].name} +${r.length - 2}`);
const andList = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}` : l[0]);

const ico = (c: ReactNode) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{c}</svg>;
/** Who throws first: the BullOff value ('off' is Random), its name, one sentence and an icon. */
const THROW_FIRST: [BullOff, string, string, ReactNode][] = [
  ['off', 'Random', 'Order drawn when the match starts.', ico(<><rect x="4" y="4" width="16" height="16" rx="3" /><circle cx="9" cy="9" r="1" fill="currentColor" /><circle cx="15" cy="15" r="1" fill="currentColor" /><circle cx="15" cy="9" r="1" fill="currentColor" /><circle cx="9" cy="15" r="1" fill="currentColor" /></>)],
  ['closest', 'Closest', 'Bull-off: closest to the bull throws first.', ico(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></>)],
  ['pdc', 'PDC', 'Bull-off by PDC rules, a bull re-throws.', ico(<><circle cx="12" cy="12" r="8" /><path d="M12 7v10M7 12h10" /></>)],
];

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

function Label({ def, text }: { def?: OptionDef<any>; text: string }) {
  return <div className="opt-label"><b>{text}</b>{def && <div className="opt-desc">{def.info}</div>}</div>;
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

type Step = 'game' | 'players' | 'options';
const ORDER: Step[] = ['game', 'players', 'options'];

/**
 * New match as three steps, Game → Players → Options (docs/UI.md, Start i koniec meczu). A game picked on the phone's
 * record tile opens straight on Players.
 */
export function Setup({ s, preset, onClose }: { s: ClientState; preset?: { game: GameId; options: unknown } | null; onClose: () => void }) {
  // The last game played is preselected, or the game of a lobby record with its options.
  const [game, setGame] = useState<GameId>(() => preset?.game ?? lastGame());
  const [allOptions, setAllOptions] = useState<Partial<Record<GameId, Record<string, unknown>>>>(
    () => (preset ? { [preset.game]: GAMES[preset.game].normalizeOptions(preset.options) as Record<string, unknown> } : {}));
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [bullOff, setBullOffState] = useState<BullOff>(loadBullOff);
  const [step, setStep] = useState<Step>(preset ? 'players' : 'game');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [howTo, setHowTo] = useState(false);

  // The chosen game is in sight when the Game step opens, also deep in the list on the phone.
  useEffect(() => { if (step === 'game') document.querySelector('.game-tile.on')?.scrollIntoView({ block: 'nearest' }); }, [step]);

  const n = roster.length;
  const g = GAMES[game];
  const options = allOptions[game] ?? loadOptions(game);
  const setOptions = (o: Record<string, unknown>) => {
    setAllOptions({ ...allOptions, [game]: o });
    store.set(optionsKey(game), JSON.stringify(o));
  };
  const setBullOff = (b: BullOff) => {
    setBullOffState(b);
    store.set(BULL_OFF_KEY, b);
  };

  const add = (r: RosterEntry) => {
    if (n >= MAX_PLAYERS) return toast({ text: `At most ${MAX_PLAYERS} players`, kind: 'error' });
    setRoster([...roster, r]);
  };
  // A registered player is told apart by id (a rename elsewhere keeps the tile), a guest by name.
  const same = (a: RosterEntry, b: RosterEntry) => (a.playerId === null || b.playerId === null ? a.playerId === b.playerId && a.name === b.name : a.playerId === b.playerId);
  // Player tiles switch: a second tap takes the player out (Q6).
  const toggle = (r: RosterEntry) => {
    if (roster.some(x => same(x, r))) setRoster(roster.filter(x => !same(x, r)));
    else add(r);
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

  /** Starts the match with the lineup and the bull-off from the Players step; Random shuffles the throwing order here. */
  const startMatch = async () => {
    setBusy(true);
    const r = await act({ type: 'startMatch', game, options: withBullOff(game, options, bullOff), roster: throwOrder(roster, bullOff) });
    setBusy(false);
    if (r.ok) {
      store.set(LAST_GAME_KEY, game);
      onClose();
    }
  };

  const pickGame = (id: GameId) => {
    setGame(id);
    setStep('players');
  };

  const back = () => {
    if (step === 'options') setStep('players');
    else if (step === 'players') setStep('game');
    else onClose();
  };

  if (howTo) return <HowToScreen game={game} options={options} onClose={() => setHowTo(false)} />;

  const steps = ORDER.map(st => ({ label: st[0].toUpperCase() + st.slice(1), value: st === 'players' ? namesShort(roster) : st === 'game' ? g.name : undefined }));

  const header = (
    <header className="phone-header setup-head">
      <button className="icon-btn" style={{ background: 'transparent' }} aria-label="Back" onClick={back}>{Icon.back(22)}</button>
      <h1>New match</h1>
      <Steps steps={steps} at={ORDER.indexOf(step)} onGo={i => setStep(ORDER[i])} />
    </header>
  );

  // ---------- Game ----------
  if (step === 'game') {
    const group = (i: number) => {
      const { group: grp, title, ids } = GAME_GROUPS[i];
      return (
        <section key={grp} className={`game-group g-${grp}`}>
          <h3 className="caps game-group-title">{title}</h3>
          <div className="game-grid">
            {ids.map(id => {
              const t = GAMES[id];
              return (
                <button key={id} className={`game-tile ${id === game ? 'on' : ''}`} aria-pressed={id === game} onClick={() => pickGame(id)}>
                  <GameIcon game={id} className="tile-icon" stroke={1.25} />
                  <b>{t.name}</b>
                  <span>{t.blurb}</span>
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
          <button className="btn ghost" onClick={back}>Close</button>
          <span className="sum">Tap a game</span>
        </div>
      </div>
    );
  }

  // ---------- Players ----------
  if (step === 'players') {
    const active = s.players.filter(p => !p.archived);
    // Recent players first, then everyone else in the list's order.
    const recent = s.recentPlayerIds.map(id => active.find(p => p.id === id)).filter(p => !!p).slice(0, 3);
    const tiles: RosterEntry[] = [...recent, ...active.filter(p => !recent.includes(p))].map(p => ({ playerId: p.id, name: p.name }));
    // A selected player who lost the tile (archived on another device) keeps one, so they can be taken out.
    const all = [...tiles, ...roster.filter(r => !tiles.some(t => same(t, r)))];
    const block = lineupBlock(g, n);
    const tileInitials = initialsOf(all.map(r => r.name));
    return (
      <div className="phone match-setup step-players">
        {header}
        <div className="setup-main">
          <div className="setup-pick">
            <h2 className="setup-title">Who's playing?</h2>
            <div className="ptiles" style={{ '--rows': Math.ceil((all.length + (adding ? 0 : 1)) / 3) } as CSSProperties}>
              {all.map((r, k) => {
                const on = roster.some(x => same(x, r));
                return (
                  <button key={`${r.playerId ?? 'g'}-${r.name}`} className={`ptile ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(r)}>
                    <Avatar text={tileInitials[k]} tone={null} name={r.name} decorative /><span className="nm">{r.name}</span>{r.playerId === null && <span className="muted">guest</span>}<span className="mark">{on && '✓'}</span>
                  </button>
                );
              })}
              {!adding && <button className="ptile dash" onClick={startGuest}>+ Guest</button>}
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
          <div className="throw-col">
            {hasBullOff(game) && <>
              <div className="caps" id="tf-label">Who throws first</div>
              <div className="tf" role="radiogroup" aria-labelledby="tf-label" onKeyDown={e => {
                const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
                if (!d || n < 2) return;
                e.preventDefault();
                const next = THROW_FIRST[(THROW_FIRST.findIndex(t => t[0] === bullOff) + d + THROW_FIRST.length) % THROW_FIRST.length][0];
                setBullOff(next);
                (e.currentTarget.querySelector(`[data-v="${next}"]`) as HTMLElement | null)?.focus();
              }}>
                {THROW_FIRST.map(([v, label, desc, icon]) => (
                  <button key={v} data-v={v} className="tfc" role="radio" aria-checked={n >= 2 && bullOff === v} tabIndex={bullOff === v ? 0 : -1} disabled={n < 2} onClick={() => setBullOff(v)}>
                    <span className="ic">{icon}</span><span className="tx"><b>{label}</b><span>{n < 2 ? '2+ players' : desc}</span></span>
                  </button>
                ))}
              </div>
            </>}
            <div className="tf-sum muted">{n ? <><b>{plural(n, 'player')}:</b> {roster.map(r => r.name).join(', ')}</> : 'Tap players to add them.'}</div>
            <div className="setup-foot">
              <button className="btn primary" disabled={!!block} onClick={() => setStep('options')}>{block ?? 'Next · Options'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Options ----------
  const chipInitials = initialsOf(roster.map(r => r.name));
  const blocked = s.match ? 'A match is in progress' : !fits(g, n) ? blockText(g) : null;
  return (
    <div className="phone match-setup step-options">
      {header}
      <div className="setup-main">
        <aside className="gameinfo">
          <div className="gamecard">
            <GameIcon game={game} className="tile-icon" stroke={1.25} />
            <h2 className="setup-game-name">{g.name}</h2>
            <p className="setup-blurb">{g.blurb}</p>
            <HowToButton onClick={() => setHowTo(true)} />
          </div>
          <div className="who-card">
            <div className="caps">{plural(n, 'player')}</div>
            <div className="pchips">{roster.map((r, k) => <span key={`${r.playerId ?? 'g'}-${r.name}`} className="pchip"><Avatar text={chipInitials[k]} tone={null} name={r.name} decorative />{r.name}</span>)}</div>
            {n >= 2 && hasBullOff(game) && <div className="muted">Throws first: <b>{THROW_FIRST.find(t => t[0] === bullOff)![1]}</b></div>}
          </div>
        </aside>
        <div className="setup-opts">
          {game === 'x01'
            ? <X01Section options={options as unknown as X01Options} setOptions={o => setOptions(o as unknown as Record<string, unknown>)} />
            : <MiniSection game={game} options={options} players={n} setOptions={setOptions} />}
        </div>
      </div>
      <div className="setup-foot">
        <button className="btn ghost" onClick={back}>Back</button>
        <span className="sum"><b>{namesShort(roster)}</b> · <b>{g.name}</b> · {slotLabel(game, options, n)}</span>
        <button className="btn primary" disabled={!!blocked || busy} onClick={() => void startMatch()}>{blocked ?? startLabel(g.name, n)}</button>
      </div>
    </div>
  );
}
