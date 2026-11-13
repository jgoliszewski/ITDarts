import { useRef, useState } from 'react';
import type { GameId } from '../../../games/index.ts';
import { GAMES, GAME_GROUPS, MAX_PLAYERS } from '../../../games/index.ts';
import type { RcOptions } from '../../../games/randomco.ts';
import { RANGE_PRESETS, highestNumber, lowestNumber } from '../../../games/randomco.ts';
import type { OptionDef } from '../../../games/turns.ts';
import { X01_OPTIONS } from '../../../games/x01/index.ts';
import type { X01Options } from '../../../games/x01/rules.ts';
import type { ClientState, RosterEntry } from '../../../server/protocol.ts';
import { GameIcon } from '../components/GameIcon.tsx';
import { HowToButton, HowToScreen, Info } from '../components/HowTo.tsx';
import { Icon, act, toast } from '../components/ui.tsx';
import { store } from '../util.ts';

const GAP = 8; // between roster rows
const LAST_GAME_KEY = 'itdarts.lastGame';
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

  const order = roster.map((_, i) => i);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
      {order.map(i => {
        const r = roster[i];
        let shift = 0;
        if (drag) {
          if (i === drag.from) shift = drag.dy;
          else if (drag.from < i && i <= target) shift = -ROW;
          else if (target <= i && i < drag.from) shift = ROW;
        }
        return (
          <div key={`${r.playerId ?? 'g'}-${r.name}`} className="list-row"
            style={{ transform: `translateY(${shift}px)`, transition: drag && i === drag.from ? 'none' : 'transform 0.15s', zIndex: drag?.from === i ? 2 : 1, position: 'relative' }}>
            <span className="num" style={{ fontSize: 24, color: 'var(--accent)', width: 18 }}>{i + 1}</span>
            <span className="grow">{r.name}{r.playerId === null && <span className="muted" style={{ fontWeight: 500, fontSize: 13 }}> · guest</span>}</span>
            <button className="icon-btn" style={{ background: 'transparent', color: 'var(--muted2)' }} aria-label={`Remove ${r.name}`}
              onClick={() => setRoster(roster.filter((_, j) => j !== i))}>{Icon.close(18)}</button>
            <span aria-label="Drag to reorder" role="button" style={{ color: '#5A5A60', display: 'flex', padding: '12px 8px', touchAction: 'none', cursor: 'grab' }}
              onPointerDown={e => {
                (e.target as Element).setPointerCapture(e.pointerId);
                start.current = e.clientY;
                row.current = (e.currentTarget.closest('.list-row') as HTMLElement).offsetHeight + GAP;
                setDrag({ from: i, dy: 0 });
              }}
              onPointerMove={e => drag && drag.from === i && setDrag({ from: i, dy: e.clientY - start.current })}
              onPointerUp={() => {
                if (!drag) return;
                const next = [...roster];
                const [moved] = next.splice(drag.from, 1);
                next.splice(target, 0, moved);
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

const x01Def = (key: string) => X01_OPTIONS.find(d => d.key === key || d.label === key);

function X01Section({ options, setOptions }: { options: X01Options; setOptions: (o: X01Options) => void }) {
  const mm = options.matchMode;
  return (
    <>
      <div className="section"><Label def={x01Def('startScore')} text="Start score" />
        <Seg value={options.startScore} options={[[201, '201'], [301, '301'], [501, '501']]} onChange={v => setOptions({ ...options, startScore: v })} />
      </div>
      <div className="section"><Label def={x01Def('checkIn')} text="Check-in" />
        <Seg value={options.checkIn} options={[['straight', 'Straight'], ['double', 'Double']]} onChange={v => setOptions({ ...options, checkIn: v })} />
      </div>
      <div className="section"><Label def={x01Def('checkOut')} text="Check-out" />
        <Seg value={options.checkOut} options={[['single', 'Single'], ['double', 'Double'], ['master', 'Master']]} onChange={v => setOptions({ ...options, checkOut: v })} />
      </div>
      <div className="section"><Label def={x01Def('Match mode')} text="Match mode" />
        <Seg value={mm.kind} options={[['off', 'Off'], ['legs', 'Legs'], ['sets', 'Sets']]}
          onChange={k => setOptions({ ...options, matchMode: k === 'off' ? { kind: 'off' } : k === 'legs' ? { kind: 'legs', firstTo: 3 } : { kind: 'sets', firstTo: 2, legsPerSet: 3 } })} />
      </div>
      {/* With sets the two steppers sit side by side on the laptop, so the options fit without scrolling. */}
      {mm.kind !== 'off' && (
        <div className={`steppers ${mm.kind === 'sets' ? 'two' : ''}`}>
          <div className="option-row">
            <div><b style={{ fontSize: 15 }}>First to</b><div className="muted" style={{ fontSize: 13 }}>{mm.kind === 'legs' ? 'legs to win the match' : 'sets to win the match'}</div></div>
            <Stepper label={mm.kind} value={mm.firstTo} min={1} max={mm.kind === 'legs' ? 21 : 11} onChange={v => setOptions({ ...options, matchMode: { ...mm, firstTo: v } })} />
          </div>
          {mm.kind === 'sets' && (
            <div className="option-row">
              <div><b style={{ fontSize: 15 }}>Legs per set</b><div className="muted" style={{ fontSize: 13 }}>first to this many legs wins a set</div></div>
              <Stepper label="legs per set" value={mm.legsPerSet} min={1} max={7} onChange={v => setOptions({ ...options, matchMode: { ...mm, legsPerSet: v } })} />
            </div>
          )}
        </div>
      )}
      {mm.kind === 'off' && <div className="muted" style={{ fontSize: 13 }}>After each leg you choose: next leg or end the match.</div>}
      <div className="section"><Label def={x01Def('bullOff')} text="Bull-off" />
        <Seg value={options.bullOff} options={[['off', 'Off'], ['closest', 'Closest'], ['pdc', 'PDC rules']]} onChange={v => setOptions({ ...options, bullOff: v })} />
      </div>
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
    <div className="section">
      <Label def={GAMES.randomco.options.find(d => d.label === 'Range')} text="Range" />
      <Seg value={on} options={presets.map(([l]) => [l, l])} onChange={l => {
        const [, min, max] = presets.find(p => p[0] === l)!;
        setOptions({ ...options, min, max });
      }} />
      <div className="range-row">{field('min', 'Min')}{field('max', 'Max')}</div>
    </div>
  );
}

/** Minigame options straight from the module's definitions. */
function MiniSection({ game, options, players, setOptions: save }: { game: GameId; options: Record<string, unknown>; players: number; setOptions: (o: Record<string, unknown>) => void }) {
  // Options meant for 2+ players (Mode, Co-op, Bull-off) show before anyone is added, so the screen doesn't jump.
  const defs = GAMES[game].options.filter(d => d.key && (!d.when || d.when(options, Math.max(players, 2))));
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
      {game === '121' && players > 1 && <div className="muted" style={{ fontSize: 13 }}>With 2 or more players 121 is played in Co-op: one shared target.</div>}
      {game === 'killer' && <div className="muted" style={{ fontSize: 13 }}>Numbers are drawn at the start. Reroll them on the pilot before the first dart.</div>}
    </>
  );
}

export function Setup({ s, onClose }: { s: ClientState; onClose: () => void }) {
  // The last game played is preselected; the tiles keep their fixed groups.
  const [game, setGame] = useState<GameId>(lastGame);
  const [allOptions, setAllOptions] = useState<Partial<Record<GameId, Record<string, unknown>>>>({});
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [howTo, setHowTo] = useState(false);

  const g = GAMES[game];
  const options = allOptions[game] ?? loadOptions(game);
  const setOptions = (o: Record<string, unknown>) => {
    setAllOptions({ ...allOptions, [game]: o });
    store.set(optionsKey(game), JSON.stringify(o));
  };
  const inRoster = new Set(roster.map(r => r.playerId));
  const active = s.players.filter(p => !p.archived && !inRoster.has(p.id));
  const recent = s.recentPlayerIds.map(id => active.find(p => p.id === id)).filter(p => !!p);
  const others = active.filter(p => !s.recentPlayerIds.includes(p.id));

  const add = (r: RosterEntry) => {
    if (roster.length >= MAX_PLAYERS) return toast({ text: `At most ${MAX_PLAYERS} players`, kind: 'error' });
    setRoster([...roster, r]);
  };

  const submitGuest = () => {
    const n = name.trim();
    if (!n) return;
    if (roster.some(r => r.name.toLowerCase() === n.toLowerCase())) return toast({ text: `${n} is already in`, kind: 'error' });
    add({ playerId: null, name: n });
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

  const startMatch = async () => {
    setBusy(true);
    const r = await act({ type: 'startMatch', game, options, roster });
    setBusy(false);
    if (r.ok) {
      store.set(LAST_GAME_KEY, game);
      onClose();
    }
  };

  if (howTo) return <HowToScreen game={game} options={options} onClose={() => setHowTo(false)} />;

  const blocked = s.match ? 'A match is in progress'
    : roster.length === 0 ? 'Add players to start'
    : roster.length < g.minPlayers ? `${g.name} needs at least ${g.minPlayers} players`
    : g.maxPlayers !== undefined && roster.length > g.maxPlayers ? `${g.name} is for 1 player`
    : null;

  return (
    <div className="phone match-setup">
      <header className="phone-header">
        <button className="icon-btn" style={{ background: 'transparent' }} aria-label="Back" onClick={onClose}>{Icon.back(22)}</button>
        <h1>New match</h1>
      </header>
      <div className="phone-body" style={{ gap: 24 }}>
        <section className="section setup-games">
          <div className="caps">Game</div>
          {GAME_GROUPS.map(({ group, title, ids }) => (
            <div key={group} className="game-group">
              <h3 className="caps game-group-title">{title}</h3>
              <div className="game-grid">
                {ids.map(id => {
                  const t = GAMES[id];
                  return (
                    <button key={id} className={`game-tile ${id === game ? 'on' : ''}`} aria-pressed={id === game} onClick={() => setGame(id)}>
                      <GameIcon game={id} className="tile-icon" stroke={1.25} />
                      <b>{t.name}</b>
                      <span>{t.blurb}</span>
                      <small>{t.maxPlayers === 1 ? '1 player' : `${t.minPlayers}–${t.maxPlayers ?? MAX_PLAYERS} players`}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <section className="section setup-options">
          <div className="option-row">
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{g.name}</h2>
            <HowToButton onClick={() => setHowTo(true)} />
          </div>
          {game === 'x01'
            ? <X01Section options={options as unknown as X01Options} setOptions={o => setOptions(o as unknown as Record<string, unknown>)} />
            : <MiniSection game={game} options={options} players={roster.length} setOptions={setOptions} />}
        </section>

        <section className="section setup-players">
          <div className="option-row">
            <div className="caps" style={{ fontSize: 13 }}>Players · throwing order</div>
            <button className="chip" onClick={shuffle} disabled={roster.length < 2}>Shuffle</button>
          </div>
          {recent.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {recent.map(p => <button key={p.id} className="btn ghost" onClick={() => add({ playerId: p.id, name: p.name })}>{Icon.plus(18)}{p.name}</button>)}
            </div>
          )}
          {adding ? (
            <form className="option-row" onSubmit={e => { e.preventDefault(); submitGuest(); }}>
              <input className="field" autoFocus value={name} maxLength={24} onChange={e => setName(e.target.value)} placeholder="Guest name" aria-label="Guest name" />
              <button className="btn primary" type="submit">Add</button>
              <button className="btn" type="button" onClick={() => setAdding(false)}>Cancel</button>
            </form>
          ) : (
            <div className="chip-row">
              {others.length > 0 && <span className="muted" style={{ fontSize: 13 }}>{recent.length ? 'Others' : 'Players'}</span>}
              {others.map(p => <button key={p.id} className="chip" onClick={() => add({ playerId: p.id, name: p.name })}>+ {p.name}</button>)}
              <button className="chip" onClick={startGuest}>+ Guest</button>
            </div>
          )}
          {adding && <div className="muted" style={{ fontSize: 13 }}>Guests play this match only. No stats or records are kept for them.</div>}
          <RosterList roster={roster} setRoster={setRoster} />
        </section>
      </div>
      <div className="p-actions" style={{ gridTemplateColumns: '1fr' }}>
        <button className="btn primary" disabled={!!blocked || busy} onClick={startMatch}>{blocked ?? 'Start match'}</button>
      </div>
    </div>
  );
}
