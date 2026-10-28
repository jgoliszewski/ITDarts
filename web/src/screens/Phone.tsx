import { label } from '../../../games/darts.ts';
import type { ClientState, LiveMatch } from '../../../server/protocol.ts';
import type { Dart } from '../../../games/darts.ts';
import { LIVES } from '../../../games/121.ts';
import { BullRows, BullZoom, bullStatus } from '../components/BullOff.tsx';
import { Keypad } from '../components/FixSheet.tsx';
import { Icon, act } from '../components/ui.tsx';
import { controls, dartValue, isX01, shortDescription, winnersOf } from '../match.ts';
import { fmtAvg, shortDate } from '../util.ts';
import { NewRecord } from './MiniBoard.tsx';
import { boardPill } from './Scoreboard.tsx';

function PhoneHeader({ s, title, onMenu, onBoard }: { s: ClientState; title: string; onMenu: () => void; onBoard?: () => void }) {
  const pill = boardPill(s);
  return (
    <header className="phone-header">
      <div className="title">{title}</div>
      <button className="pill" aria-label={`Board: ${pill.text}`} onClick={onBoard} disabled={!onBoard} style={{ opacity: 1 }}>
        <span className={`dot ${pill.dot}`} />{pill.text.replace(' · throw', '')}
      </button>
      <button className="icon-btn" aria-label="Menu" onClick={onMenu}>{Icon.menu()}</button>
    </header>
  );
}

function Players({ m }: { m: LiveMatch }) {
  const v = m.view;
  const legsWord = (n: number) => `${n} ${n === 1 ? 'leg' : 'legs'}`;
  return (
    <div className="p-players">
      {m.roster.map((r, i) => {
        const active = i === v.current && v.phase !== 'bulloff';
        let meta: string, big: string, out = false;
        if (isX01(m)) {
          const sets = m.options.matchMode.kind === 'sets' ? `${m.view.sets[i]} sets · ` : '';
          meta = `${sets}${legsWord(m.view.legs[i])} · avg ${fmtAvg(m.view.stats[i].matchAvg)}`;
          big = String(m.view.scores[i]);
        } else {
          ({ meta, value: big, out } = m.view.rows[i]);
          // The active player's line shows what the hero shows on the big screen.
          if (active) meta = [m.view.hero.caption, m.view.hero.note].filter(Boolean).join(' · ');
          if (active && m.game === '121') meta += ` · ${m.view.attemptLeft} darts left in attempt · ${'♥'.repeat(m.view.lives)}${'♡'.repeat(LIVES - m.view.lives)}`;
        }
        return (
          <div key={i} className={`p-player ${active ? 'active' : ''} ${out ? 'out' : ''}`}>
            <div className="who"><b>{r.name}</b><span>{meta}</span></div>
            <div className="num">{big}</div>
          </div>
        );
      })}
    </div>
  );
}

function checkoutHint(m: LiveMatch): string | null {
  if (m.view.phase !== 'throwing') return null;
  if (!isX01(m) && m.game !== '121') return null;
  const { checkout, setup } = m.view;
  return checkout ? `Checkout ${checkout}` : setup ? `Setup ${setup}` : null;
}

function Darts({ m, editable, onDart }: { m: LiveMatch; editable: boolean; onDart: (i: number) => void }) {
  const v = m.view;
  const flash = m.lastFix && Date.now() - m.lastFix.at < 3000 ? m.lastFix.index : null;
  return (
    <div className="p-darts">
      {[0, 1, 2].map(i => {
        const d = v.visit.darts[i];
        if (!d) {
          const addable = editable && i === v.visit.darts.length && v.visit.dartsLeft > 0 && v.phase === 'throwing';
          return addable
            ? <button key={i} className="p-dart empty" onClick={() => onDart(i)}><span className="lbl">+ Add dart</span></button>
            : <div key={i} className="p-dart empty" />;
        }
        const inner = <><span className="num">{dartValue(m, d.dart)}</span><span className="lbl">{label(d.dart)}</span></>;
        // In minigames a dart that did nothing is dimmed.
        const dead = !isX01(m) && !m.view.visit.good[i] ? 'dead' : '';
        return editable
          ? <button key={`${i}-${flash}`} className={`p-dart ${dead} ${flash === i ? 'flash' : ''}`} onClick={() => onDart(i)}>{inner}</button>
          : <div key={i} className={`p-dart ${dead}`}>{inner}</div>;
      })}
    </div>
  );
}

function PhaseCard({ s, m }: { s: ClientState; m: LiveMatch }) {
  const v = m.view;
  if (m.intro && m.record) {
    const r = m.record;
    return (
      <div className="box">
        <div className="caps" style={{ color: 'var(--accent)', fontSize: 13 }}>Office record · {r.label}</div>
        <b style={{ fontSize: 22 }}>{r.value ? `${r.value} · ${r.by}${r.at ? ` · ${shortDate(r.at)}` : ''}` : 'No record yet'}</b>
        <button className="btn block" onClick={() => act({ type: 'skipIntro' })}>Skip</button>
      </div>
    );
  }
  const b = v.bullOff;
  if (b && (v.phase === 'bulloff' || m.bullTakeout)) {
    return (
      <div className="box p-bull">
        <div className="caps" style={{ color: 'var(--accent)', fontSize: 13 }}>Bull-off</div>
        <b style={{ fontSize: 20 }}>{bullStatus(m, b)}</b>
        <BullZoom m={m} b={b} size={320} />
        <BullRows m={m} b={b} />
        {b.winner === null && <span className="muted" style={{ fontSize: 14 }}>Detection wrong? Pick who starts:</span>}
        {b.winner === null && m.roster.map((r, i) => <button key={i} className="btn block" onClick={() => act({ type: 'bullOff', starter: i })}>{r.name} starts</button>)}
      </div>
    );
  }
  const leg = isX01(m) && m.view.phase === 'legWon' ? m.view.lastLeg : null;
  if (isX01(m) && leg) {
    return (
      <div className="box">
        <div className="caps" style={{ color: 'var(--green)', fontSize: 13 }}>Leg {m.view.legNo} won</div>
        <b style={{ fontSize: 22 }}>{m.roster[leg.winner].name}</b>
        <span className="muted" style={{ fontSize: 14 }}>{label(leg.checkout)} · {leg.darts} darts · avg {fmtAvg(leg.avg)}</span>
      </div>
    );
  }
  if (v.phase === 'matchWon') {
    return (
      <div className="box">
        <div className="caps" style={{ color: 'var(--green)', fontSize: 13 }}>{isX01(m) ? 'Match won' : 'Game over'}</div>
        <b style={{ fontSize: 24 }}>{isX01(m) ? m.roster[m.view.matchWinner!].name : winnersOf(m)}</b>
        {!isX01(m) && <span className="muted" style={{ fontSize: 14 }}>{m.view.result}</span>}
        {!isX01(m) && <NewRecord m={m} />}
        <button className="btn primary block" onClick={() => act({ type: 'closeMatch', then: 'summary' })}>Summary</button>
      </div>
    );
  }
  if (s.board.takeout.active) {
    return <div className="banner info" style={{ borderRadius: 16 }}>Removing darts… don't throw yet</div>;
  }
  if (m.game === 'killer' && m.view.canReroll) {
    return (
      <div className="box">
        <span className="muted" style={{ fontSize: 14 }}>Numbers: {m.roster.map((r, i) => `${r.name} ${m.view.numbers[i]}`).join(' · ')}</span>
        <button className="btn block" onClick={() => act({ type: 'reroll' })}>Reroll numbers</button>
      </div>
    );
  }
  return null;
}

export function PhonePilot({ s, onMenu, onBoard, onFix, onEnd }: {
  s: ClientState; onMenu: () => void; onBoard: () => void; onFix: (i: number) => void; onEnd: () => void;
}) {
  const m = s.match!;
  const v = m.view;
  const c = controls(s);
  const offline = !s.board.connected;
  const addDart = (d: Dart) => act({ type: 'dart', dart: d });
  const inBull = v.phase === 'bulloff' || m.bullTakeout;
  return (
    <div className="phone">
      <PhoneHeader s={s} title={shortDescription(m)} onMenu={onMenu} onBoard={onBoard} />
      {offline && <div className="banner">Board offline · enter darts by hand</div>}
      <div className="phone-body">
        <Players m={m} />
        <PhaseCard s={s} m={m} />
        {!inBull && (
          <div className="section">
            <div className="p-turn-head">
              <span className="caps">{m.roster[v.current].name} · this turn</span>
              {isX01(m)
                ? <span className="num" style={{ color: m.view.visit.bust ? 'var(--red)' : undefined }}>{m.view.visit.bust ? 'BUST' : m.view.visit.total}</span>
                : <span className="num">{m.game === 'hol' ? m.view.sum ?? 0 : m.view.hero.big}</span>}
            </div>
            <Darts m={m} editable onDart={onFix} />
            <div className="p-hint">{checkoutHint(m) ?? c.hint}</div>
          </div>
        )}
        {offline && !inBull && v.phase === 'throwing' && v.visit.dartsLeft > 0 && (
          <div className="section">
            <span className="caps">Enter dart {v.visit.darts.length + 1}</span>
            <Keypad cur={null} onPick={addDart} />
          </div>
        )}
      </div>
      {(!inBull || c.canUndo) && (
        <div className={`p-actions ${c.endInstead ? 'three' : ''}`}>
          <button className="btn" onClick={() => act({ type: 'undo' })}>Undo</button>
          {c.endInstead && <button className="btn" onClick={onEnd}>End match</button>}
          {c.primary ? <button className="btn primary" onClick={() => act(c.primary!.cmd)}>{c.primary.label}</button> : <span />}
        </div>
      )}
    </div>
  );
}

/** Phone that is not the pilot: a small read-only scoreboard. */
export function PhoneWatch({ s, onMenu }: { s: ClientState; onMenu: () => void }) {
  const m = s.match;
  return (
    <div className="phone">
      <PhoneHeader s={s} title={m ? shortDescription(m) : 'ITDarts'} onMenu={onMenu} />
      <div className="phone-body">
        {m ? (
          <>
            <Players m={m} />
            {m.view.phase !== 'bulloff' && <Darts m={m} editable={false} onDart={() => undefined} />}
          </>
        ) : (
          <div className="center-msg">
            <h2>No match right now</h2>
            <p>Take control to start one, or look at the stats.</p>
          </div>
        )}
      </div>
      <div className="p-actions">
        <a className="btn" href="/stats" style={{ textDecoration: 'none' }}>Stats</a>
        <button className="btn primary" onClick={() => act({ type: 'takeControl' })}>Take control</button>
      </div>
      <div className="p-hint" style={{ paddingBottom: 12 }}>{s.pilot ? `Pilot: ${s.pilot.deviceName}` : 'Nobody is the pilot yet'}</div>
    </div>
  );
}

/** Pilot phone with no match running. */
export function PhoneHome({ s, onMenu, onBoard, onNew, onPlayers }: { s: ClientState; onMenu: () => void; onBoard: () => void; onNew: () => void; onPlayers: () => void }) {
  const last = s.lastMatch;
  return (
    <div className="phone">
      <PhoneHeader s={s} title="ITDarts" onMenu={onMenu} onBoard={onBoard} />
      <div className="phone-body">
        <nav className="phone-nav">
          <button className="btn" onClick={onPlayers}>Players</button>
          <a className="btn" href="/stats">Stats</a>
          <a className="btn" href="/effects">Effects</a>
        </nav>
        {last && (
          <div className="box">
            <span className="caps" style={{ fontSize: 13 }}>Last match · {last.description.replace(/^X01 · /, '')}</span>
            {last.players.map((p, i) => (
              <div key={i} className="option-row">
                <span style={{ fontWeight: p.winner ? 800 : 500, color: p.winner ? 'var(--text)' : 'var(--muted)' }}>{p.name}</span>
                <span className="num" style={{ fontSize: 32, color: p.winner ? 'var(--accent)' : 'var(--muted)' }}>{p.value}</span>
              </div>
            ))}
          </div>
        )}
        <div className="center-msg">
          <h2>Ready for a match</h2>
          <p>Pick a game and players. The big screen follows.</p>
        </div>
      </div>
      <div className="p-actions" style={{ gridTemplateColumns: '1fr' }}>
        <button className="btn primary" onClick={onNew}>New match</button>
        {last && <button className="btn" onClick={() => act({ type: 'rematch' })}>Rematch {last.players.map(p => p.name).join(' vs ')}</button>}
      </div>
    </div>
  );
}
