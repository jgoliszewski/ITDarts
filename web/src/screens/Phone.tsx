import { label, value } from '../../../games/darts.ts';
import type { ClientState, LiveMatch } from '../../../server/protocol.ts';
import type { Dart } from '../../../games/darts.ts';
import { Keypad } from '../components/FixSheet.tsx';
import { Icon, act } from '../components/ui.tsx';
import { controls, shortDescription } from '../match.ts';
import { fmtAvg } from '../util.ts';
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
        const sets = m.options.matchMode.kind === 'sets' ? `${v.sets[i]} sets · ` : '';
        return (
          <div key={i} className={`p-player ${active ? 'active' : ''}`}>
            <div className="who"><b>{r.name}</b><span>{sets}{legsWord(v.legs[i])} · avg {fmtAvg(v.stats[i].matchAvg)}</span></div>
            <div className="num">{v.scores[i]}</div>
          </div>
        );
      })}
    </div>
  );
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
        const inner = <><span className="num">{value(d.dart)}</span><span className="lbl">{label(d.dart)}</span></>;
        return editable
          ? <button key={`${i}-${flash}`} className={`p-dart ${flash === i ? 'flash' : ''}`} onClick={() => onDart(i)}>{inner}</button>
          : <div key={i} className="p-dart">{inner}</div>;
      })}
    </div>
  );
}

function PhaseCard({ s, m, onNew }: { s: ClientState; m: LiveMatch; onNew: () => void }) {
  const v = m.view;
  if (v.phase === 'bulloff') {
    return (
      <div className="box">
        <div className="caps" style={{ color: 'var(--accent)', fontSize: 13 }}>Bull-off</div>
        <b style={{ fontSize: 20 }}>Who throws first?</b>
        <span className="muted" style={{ fontSize: 14 }}>One dart each at the bull{m.options.bullOff === 'pdc' ? '; same bull means throw again' : ''}. Closest starts.</span>
        {m.roster.map((r, i) => <button key={i} className="btn block" onClick={() => act({ type: 'bullOff', starter: i })}>{r.name} starts</button>)}
      </div>
    );
  }
  if (v.phase === 'legWon' && v.lastLeg) {
    return (
      <div className="box">
        <div className="caps" style={{ color: 'var(--green)', fontSize: 13 }}>Leg {v.legNo} won</div>
        <b style={{ fontSize: 22 }}>{m.roster[v.lastLeg.winner].name}</b>
        <span className="muted" style={{ fontSize: 14 }}>{label(v.lastLeg.checkout)} · {v.lastLeg.darts} darts · avg {fmtAvg(v.lastLeg.avg)}</span>
      </div>
    );
  }
  if (v.phase === 'matchWon' && v.matchWinner !== null) {
    return (
      <div className="box">
        <div className="caps" style={{ color: 'var(--green)', fontSize: 13 }}>Match won</div>
        <b style={{ fontSize: 24 }}>{m.roster[v.matchWinner].name}</b>
        <button className="btn primary block" onClick={() => act({ type: 'closeMatch', then: 'rematch' })}>Rematch</button>
        <button className="btn block" onClick={onNew}>New match</button>
        <button className="btn block" onClick={() => act({ type: 'closeMatch', then: 'lobby' })}>Back to lobby</button>
      </div>
    );
  }
  if (s.board.takeout.active) {
    return <div className="banner info" style={{ borderRadius: 16 }}>Removing darts… don't throw yet</div>;
  }
  return null;
}

export function PhonePilot({ s, onMenu, onBoard, onFix, onEnd, onNew }: {
  s: ClientState; onMenu: () => void; onBoard: () => void; onFix: (i: number) => void; onEnd: () => void; onNew: () => void;
}) {
  const m = s.match!;
  const v = m.view;
  const c = controls(s);
  const offline = !s.board.connected;
  const addDart = (d: Dart) => act({ type: 'dart', dart: d });
  return (
    <div className="phone">
      <PhoneHeader s={s} title={shortDescription(m)} onMenu={onMenu} onBoard={onBoard} />
      {offline && <div className="banner">Board offline · enter darts by hand</div>}
      <div className="phone-body">
        <Players m={m} />
        <PhaseCard s={s} m={m} onNew={onNew} />
        {v.phase !== 'bulloff' && (
          <div className="section">
            <div className="p-turn-head">
              <span className="caps">{m.roster[v.current].name} · this turn</span>
              <span className="num" style={{ color: v.visit.bust ? 'var(--red)' : undefined }}>{v.visit.bust ? 'BUST' : v.visit.total}</span>
            </div>
            <Darts m={m} editable onDart={onFix} />
            <div className="p-hint">{v.checkout && v.phase === 'throwing' ? `Checkout ${v.checkout}` : c.hint}</div>
          </div>
        )}
        {offline && v.phase === 'throwing' && v.visit.dartsLeft > 0 && (
          <div className="section">
            <span className="caps">Enter dart {v.visit.darts.length + 1}</span>
            <Keypad cur={null} onPick={addDart} />
          </div>
        )}
      </div>
      {v.phase !== 'bulloff' && (
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
        {last && (
          <div className="box">
            <span className="caps" style={{ fontSize: 13 }}>Last match · {last.description.replace(/^X01 · /, '')}</span>
            {last.players.map((p, i) => (
              <div key={i} className="option-row">
                <span style={{ fontWeight: p.winner ? 800 : 500, color: p.winner ? 'var(--text)' : 'var(--muted)' }}>{p.name}</span>
                <span className="num" style={{ fontSize: 32, color: p.winner ? 'var(--accent)' : 'var(--muted)' }}>{last.players.some(x => x.sets) ? p.sets : p.legs}</span>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className="btn" onClick={onPlayers}>Players</button>
          <a className="btn" href="/stats" style={{ textDecoration: 'none' }}>Stats</a>
        </div>
      </div>
    </div>
  );
}
