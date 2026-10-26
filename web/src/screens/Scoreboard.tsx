import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { label, value } from '../../../games/darts.ts';
import type { Verdict } from '../../../games/turns.ts';
import type { ClientState, LiveMatch } from '../../../server/protocol.ts';
import { HowToOverlay } from '../components/HowTo.tsx';
import { BullRows, BullZoom, bullStatus } from '../components/BullOff.tsx';
import { Icon, Logo, Qr, act, pilotUrl } from '../components/ui.tsx';
import type { X01Match } from '../match.ts';
import { controls, isX01, legTarget } from '../match.ts';
import { FxLayer, useAnim } from '../components/FxLayer.tsx';
import { turnSound } from '../sound.ts';
import { fmtAvg, useNow } from '../util.ts';
import { CricketGrid, MiniEnd, MiniHero, MiniList, RecordIntro } from './MiniBoard.tsx';

const STUCK_AFTER_MS = 15_000;

export function boardPill(s: ClientState): { dot: string; text: string } {
  const b = s.board;
  if (!b.connected) return { dot: 'red', text: 'Board offline' };
  if (b.busy) return { dot: 'amber', text: b.busy.action === 'calibrate' ? 'Calibrating…' : 'Restarting…' };
  if (b.takeout.active) return { dot: 'amber', text: 'Removing darts' };
  if (!b.detecting) return { dot: 'amber', text: 'Detection off' };
  const phase = s.match?.view.phase;
  if (phase === 'legWon') return { dot: 'green', text: 'Leg won' };
  if (phase === 'matchWon') return { dot: 'green', text: s.match?.game === 'x01' ? 'Match won' : 'Game over' };
  return { dot: 'green', text: s.match ? 'Ready · throw' : 'Board ready' };
}

export function BigHeader({ s, sub, onQr, onBoard, onMenu }: { s: ClientState; sub?: string; onQr: () => void; onBoard?: () => void; onMenu: () => void }) {
  const pill = boardPill(s);
  return (
    <header className="big-header">
      <Logo />
      {sub && <><span className="sep" /><div className="sub">{sub}</div></>}
      <div className="spacer" />
      <div className="pill"><span className={`dot ${pill.dot}`} />{pill.text}</div>
      {onBoard && <button className="icon-btn" aria-label="Board panel" onClick={onBoard}>{Icon.board()}</button>}
      <button className="icon-btn" aria-label="Show QR code" onClick={onQr}>{Icon.qr()}</button>
      <button className="icon-btn" aria-label="Menu" onClick={onMenu}>{Icon.menu()}</button>
    </header>
  );
}

function Pips({ won, of }: { won: number; of: number }) {
  return <div className="pips">{Array.from({ length: of }, (_, i) => <span key={i} className={`pip ${i < won ? 'on' : ''}`} />)}</div>;
}

function Hero({ m, flash, onDart, canEdit }: { m: X01Match; flash: number | null; onDart: (i: number) => void; canEdit: boolean }) {
  const v = m.view;
  const p = v.current;
  const target = legTarget(m);
  const visit = v.visit;
  const left = visit.bust ? 'Bust' : visit.checkout ? 'Checked out' : !v.checkedIn[p] ? 'Needs a double to start'
    : visit.dartsLeft === 0 ? 'Pull the darts' : `${visit.dartsLeft} ${visit.dartsLeft === 1 ? 'dart' : 'darts'} left`;
  return (
    <section className="hero">
      <div className="hero-top">
        {Icon.play()}
        <div className="hero-name">{m.roster[p].name}</div>
        {target ? <Pips won={v.legs[p]} of={target} /> : null}
        <div className="spacer" />
        <div className="hero-left">{left}</div>
      </div>
      <div className="hero-score-row">
        <div className="hero-score num">{v.scores[p]}</div>
        {visit.bust ? <div className="hero-bust num">BUST</div>
          : v.checkout ? <div className="hero-checkout"><div className="caps">Checkout</div><div className="num">{v.checkout}</div></div> : null}
      </div>
      <div className="hero-darts">
        {[0, 1, 2].map(i => {
          const d = visit.darts[i];
          if (!d) {
            const addable = canEdit && i === visit.darts.length && visit.dartsLeft > 0 && v.phase === 'throwing';
            return addable
              ? <button key={i} className="dart-tile empty" onClick={() => onDart(i)}><span className="lbl">+ Add</span></button>
              : <div key={i} className="dart-tile empty" />;
          }
          const tile = <><span className="num">{value(d.dart)}</span><span className="lbl">{label(d.dart)}</span></>;
          const cls = `dart-tile ${flash === i ? 'flash' : ''}`;
          return canEdit
            ? <button key={`${i}-${flash}`} className={cls} onClick={() => onDart(i)} aria-label={`Fix dart ${i + 1}: ${label(d.dart)}`}>{tile}</button>
            : <div key={`${i}-${flash}`} className={cls}>{tile}</div>;
        })}
        <div className="this-turn">
          <div className="caps">This turn</div>
          <div className="num">{visit.bust ? 0 : visit.total}</div>
        </div>
      </div>
    </section>
  );
}

function PlayerList({ m }: { m: X01Match }) {
  const v = m.view;
  const compact = m.roster.length > 2;
  const target = legTarget(m);
  const sets = m.options.matchMode.kind === 'sets';
  return (
    <div className="plist">
      {m.roster.map((r, i) => {
        const active = i === v.current && v.phase !== 'bulloff';
        return (
          <div key={i} className={`prow ${compact ? 'compact' : ''} ${active ? 'active' : ''}`}>
            <div className="info">
              <div className="name">{r.name}</div>
              <div className="meta">
                {sets && <span>Sets {v.sets[i]} ·</span>}
                {target ? <Pips won={v.legs[i]} of={target} /> : <span>{v.legs[i]} {v.legs[i] === 1 ? 'leg' : 'legs'}</span>}
                <span style={{ marginLeft: 8 }}>avg {fmtAvg(v.stats[i].matchAvg)}</span>
              </div>
            </div>
            <div className="score num">{v.scores[i]}</div>
          </div>
        );
      })}
    </div>
  );
}

function StatsCards({ m }: { m: X01Match }) {
  const p = m.view.current;
  const st = m.view.stats[p];
  const name = m.roster[p].name.toUpperCase();
  const visits = [...st.lastVisits];
  while (visits.length < 6) visits.push(undefined as unknown as number);
  const tiles: [string, string][] = [
    ['Leg avg', fmtAvg(st.legAvg)], ['Match avg', fmtAvg(st.matchAvg)], ['Best visit', st.bestVisit ? String(st.bestVisit) : '–'],
    ['100+', String(st.c100)], ['140+', String(st.c140)], ['180', String(st.c180)],
  ];
  return (
    <>
      <div className="card">
        <div className="caps">{name} · Last visits</div>
        <div className="visits">
          {visits.map((x, i) => x === undefined ? <div key={i} className="none" /> : x === null ? <div key={i} className="bust num">BUST</div> : <div key={i} className="num">{x}</div>)}
        </div>
      </div>
      <div className="card" style={{ flex: 1, minHeight: 0 }}>
        <div className="caps">{name} · This match</div>
        <div className="mstats">
          {tiles.map(([l, val]) => <div key={l}><span className="l">{l}</span><span className="num">{val}</span></div>)}
        </div>
      </div>
    </>
  );
}

/** Plays the turn sound on the kiosk when a visit goes to the next player; phones stay silent. `volume` is the effects volume, 0–100. */
function useTurnSound(m: LiveMatch, on: boolean, volume: number) {
  const seen = useRef<{ key: string; n: number } | null>(null);
  useEffect(() => {
    const prev = seen.current;
    seen.current = { key: m.key, n: m.turnPass };
    if (on && prev?.key === m.key && m.turnPass > prev.n) turnSound(0.75 * (volume / 100));
  }, [m.key, m.turnPass, on, volume]);
}

/** The finished visit, from its last dart until the takeout ends (docs/UI.md, Tura i takeout). */
function TurnCard({ s, m, onDart, canEdit }: { s: ClientState; m: LiveMatch; onDart: (i: number) => void; canEdit: boolean }) {
  const now = useNow(1000);
  const v = m.view;
  const takeout = s.board.takeout.active;
  const since = s.board.takeout.since ?? now;
  const stuck = takeout && now - since > STUCK_AFTER_MS;
  const darts = v.visit.darts;
  const verdict: Verdict | null = isX01(m) ? (m.view.visit.bust ? { text: 'Bust', tone: 'bad' } : null) : m.view.visit.verdict;
  const big = verdict ? verdict.text : isX01(m) ? String(m.view.visit.total) : m.game === 'hol' ? String(m.view.sum ?? 0) : null;
  const rest = isX01(m) ? `${m.view.scores[v.current]} left` : verdict ? m.view.hero.caption : `${m.view.hero.caption} ${m.view.hero.big}`;
  return (
    <div className="overlay">
      <div className="overlay-card">
        {darts.length > 0 && (
          <div className="body">
            <div className="who">{m.roster[v.current].name}{big !== null && !verdict ? ' scored' : ''}</div>
            {big !== null && <div className={`bigscore num ${verdict ? `verdict ${verdict.tone}` : ''}`}>{big}</div>}
            <div className="chips">
              {darts.map((d, i) => canEdit
                ? <button key={i} onClick={() => onDart(i)} aria-label={`Fix dart ${i + 1}: ${label(d.dart)}`}>{label(d.dart)}</button>
                : <span key={i}>{label(d.dart)}</span>)}
              {[0, 1, 2].slice(darts.length).map(i => <span key={`m${i}`} className="plain">Miss</span>)}
              <span className="plain">{rest}</span>
            </div>
            {!takeout && <div className="pull">Pull the darts</div>}
          </div>
        )}
        {takeout && (
          <div className="takeout-band">
            {Icon.spinner()}
            <div>
              <div className="t1">Removing darts</div>
              <div className="t2">Don't throw yet. Darts thrown before Ready won't count.</div>
            </div>
          </div>
        )}
        {stuck && <div className="stuck">Board stuck? Use Takeout done on the pilot.</div>}
      </div>
    </div>
  );
}

function legsSoFar(m: X01Match): string {
  const v = m.view;
  const key = m.options.matchMode.kind === 'sets' ? v.sets : v.legs;
  return m.roster.length === 2 ? `${m.roster[0].name} ${key[0]} – ${key[1]} ${m.roster[1].name}` : m.roster.map((r, i) => `${r.name} ${key[i]}`).join(' · ');
}

function LegEnd({ m, takeout }: { m: X01Match; takeout: boolean }) {
  const v = m.view;
  const leg = v.lastLeg!;
  const off = m.options.matchMode.kind === 'off';
  const sets = m.options.matchMode.kind === 'sets';
  return (
    <div className="overlay">
      <div className="result-card enter">
        <div className="kicker">{sets ? `SET ${v.set} · ` : ''}LEG {v.legNo} WON</div>
        <div className="winner">{m.roster[leg.winner].name}</div>
        <div className="result-grid">
          <div><div className="l">Checkout</div><div className="num">{label(leg.checkout)}</div></div>
          <div><div className="l">Darts</div><div className="num">{leg.darts}</div></div>
          <div><div className="l">Leg avg</div><div className="num">{fmtAvg(leg.avg)}</div></div>
        </div>
        <div className="so-far">{sets ? 'Sets' : 'Legs'} so far: <b style={{ color: 'var(--text)' }}>{legsSoFar(m)}</b></div>
        <div className="note">{off ? 'Play another leg or end the match on the pilot.' : takeout ? 'Removing darts… the next leg starts when the board is clear.' : 'Next leg starts after the takeout.'}</div>
      </div>
    </div>
  );
}

function MatchEnd({ m, isPilot, onNew }: { m: X01Match; isPilot: boolean; onNew: () => void }) {
  const v = m.view;
  const w = v.matchWinner!;
  return (
    <div className="overlay">
      <div className="result-card">
        <div className="kicker">MATCH WON</div>
        <div className="winner">{m.roster[w].name}</div>
        <div className="result-grid">
          <div><div className="l">{m.options.matchMode.kind === 'sets' ? 'Sets' : 'Legs'}</div><div className="num">{[...(m.options.matchMode.kind === 'sets' ? v.sets : v.legs)].sort((a, b) => b - a).join('–')}</div></div>
          <div><div className="l">Match avg</div><div className="num">{fmtAvg(v.stats[w].matchAvg)}</div></div>
          <div><div className="l">Checkout</div><div className="num">{v.lastLeg ? label(v.lastLeg.checkout) : '–'}</div></div>
        </div>
        {isPilot ? (
          <div className="actions">
            <button className="btn primary" onClick={() => act({ type: 'closeMatch', then: 'rematch' })}>Rematch</button>
            <button className="btn" onClick={onNew}>New match</button>
            <button className="btn" onClick={() => act({ type: 'closeMatch', then: 'lobby' })}>Back to lobby</button>
          </div>
        ) : <div className="note">Rematch, new match or lobby: choose on the pilot.</div>}
      </div>
    </div>
  );
}

function BullOff({ m, isPilot }: { m: LiveMatch; isPilot: boolean }) {
  const b = m.view.bullOff;
  const pdc = m.options.bullOff === 'pdc';
  return (
    <div className="overlay">
      <div className="result-card bulloff-card">
        <div className="kicker" style={{ color: 'var(--accent)' }}>BULL-OFF</div>
        {b && (
          <div className="bulloff-main">
            <BullZoom m={m} b={b} size={520} />
            <div className="bulloff-side">
              <div className="winner">{bullStatus(m, b)}</div>
              <BullRows m={m} b={b} />
              <div className="note">
                {pdc ? 'One dart each at the bull, closest starts. The same bull or 25 as the leader means throwing again in reverse order.'
                  : 'One dart each at the bull, closest to the centre starts. Take the dart out before the next throw.'}
              </div>
            </div>
          </div>
        )}
        {isPilot && b?.winner == null && (
          <div className="bulloff-players">
            {m.roster.map((r, i) => <button key={i} className="btn" onClick={() => act({ type: 'bullOff', starter: i })}>{r.name} starts</button>)}
          </div>
        )}
      </div>
    </div>
  );
}

export function QrOverlay({ s, onClose }: { s: ClientState; onClose: () => void }) {
  const url = pilotUrl(s);
  return (
    <div className="qr-overlay" onClick={onClose} role="dialog" aria-label="Scan to take control">
      <Qr text={url} />
      <div className="lobby-text">
        <div className="kicker">PILOT</div>
        <h1>Scan to take<br />control</h1>
        <p>Your phone becomes the pilot.</p>
        <div className="url">or open <b>{url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</b></div>
        <p style={{ fontSize: 'calc(20 * var(--u))' }}>Tap anywhere to close</p>
      </div>
    </div>
  );
}

export function Scoreboard({ s, onMenu, onQr, onBoard, onFix, onEnd, onNew, overlay }: {
  s: ClientState;
  onMenu: () => void;
  onQr: () => void;
  onBoard?: () => void;
  onFix: (index: number) => void;
  onEnd: () => void;
  onNew: () => void;
  overlay?: ReactNode;
}) {
  const m = s.match!;
  const v = m.view;
  const isPilot = s.you.isPilot;
  const c = controls(s);
  const anim = useAnim();
  // A fixed dart flashes; so does a fresh T20 or bull (docs/EFEKTY.md).
  const flash = m.lastFix && Date.now() - m.lastFix.at < 3000 ? m.lastFix.index : anim?.anim === 'tile' ? v.visit.darts.length - 1 : null;
  const takeout = s.board.takeout.active;
  const reroll = m.game === 'killer' && m.view.canReroll && !m.intro;
  const finished = v.visit.darts.length > 0 && v.visit.dartsLeft === 0;
  useTurnSound(m, s.you.isLocal && s.effects.sounds && s.effects.swoosh, s.effects.volume);

  return (
    <div className="big">
      <BigHeader s={s} sub={m.description} onQr={onQr} onBoard={onBoard} onMenu={onMenu} />
      {!s.board.connected && <div className="banner">Board offline · enter darts by hand on the pilot</div>}
      <main className="board-main">
        {isX01(m) ? (
          <>
            <Hero m={m} flash={flash} onDart={onFix} canEdit={isPilot} />
            <aside className="side">
              <PlayerList m={m} />
              {m.roster.length === 2 && <StatsCards m={m} />}
            </aside>
          </>
        ) : (
          <>
            <MiniHero m={m} flash={flash} onDart={onFix} canEdit={isPilot} />
            <aside className="side">{m.game === 'cricket' ? <CricketGrid m={m} /> : <MiniList m={m} />}</aside>
          </>
        )}
      </main>
      {isPilot ? (
        <footer className="pilot-bar">
          <span className="hint">{c.hint}</span>
          {reroll && <button className="btn" onClick={() => act({ type: 'reroll' })}>Reroll numbers</button>}
          {c.canUndo && <button className="btn" onClick={() => act({ type: 'undo' })}>{Icon.undo()}Undo</button>}
          {c.endInstead && <button className="btn" onClick={onEnd}>End match</button>}
          {c.primary && <button className="btn primary" onClick={() => act(c.primary!.cmd)}>{c.primary.label}</button>}
        </footer>
      ) : (
        <footer className="view-bar">
          <span>{s.pilot ? `Controlled from ${s.pilot.deviceName}` : 'No pilot'}</span>
          <button className="btn" onClick={() => act({ type: 'takeControl' })}>Take control</button>
        </footer>
      )}
      {m.intro && !isX01(m) ? <RecordIntro m={m} isPilot={isPilot} />
        : (v.phase === 'bulloff' || m.bullTakeout) && <BullOff m={m} isPilot={isPilot} />}
      {v.phase === 'throwing' && (takeout || finished) && !m.bullTakeout && <TurnCard s={s} m={m} onDart={onFix} canEdit={isPilot} />}
      {isX01(m) && m.view.phase === 'legWon' && <LegEnd m={m} takeout={takeout} />}
      {v.phase === 'matchWon' && (isX01(m) ? <MatchEnd m={m} isPilot={isPilot} onNew={onNew} /> : <MiniEnd m={m} isPilot={isPilot} onNew={onNew} />)}
      <HowToOverlay s={s} />
      <FxLayer total={isX01(m) ? m.view.visit.total : null} />
      {overlay}
    </div>
  );
}
