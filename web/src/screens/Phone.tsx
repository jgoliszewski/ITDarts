import { label } from '../../../games/darts.ts';
import { plural } from '../../../games/turns.ts';
import type { ClientState, LiveMatch } from '../../../server/protocol.ts';
import type { ReactNode } from 'react';
import type { Dart } from '../../../games/darts.ts';
import { BullOffPanel } from '../components/BullOff.tsx';
import { Keypad } from '../components/FixSheet.tsx';
import { AvatarChip, RematchLabel } from '../components/Avatar.tsx';
import { playerColor } from '../components/Compare.tsx';
import { Icon, act } from '../components/ui.tsx';
import type { LobbyRecord } from '../../../server/protocol.ts';
import { aimHint, controls, dartTone, dartValue, initialsOf, isX01, legTarget, pickProps, playOrder, removedNote, shortDescription, turnHead, winnersOf, x01Dead } from '../match.ts';
import { fmtAvg, shortDate } from '../util.ts';
import { Records } from './Lobby.tsx';
import { NewRecord } from './MiniBoard.tsx';
import { Pips, boardPill } from './Scoreboard.tsx';

function PhoneHeader({ s, title, onMenu, onBoard }: { s: ClientState; title: string; onMenu: () => void; onBoard?: () => void }) {
  const pill = boardPill(s);
  const inner = <><span className={`dot ${pill.dot}`} />{pill.text}</>;
  // Only the pilot opens the board panel; for anyone else the status is plain text, not a button (B#17).
  return (
    <header className="phone-header">
      <div className="title">{title}</div>
      {onBoard
        ? <button className="pill" aria-label={`Board: ${pill.text}`} onClick={onBoard}>{inner}</button>
        : <div className="pill">{inner}</div>}
      <button className="icon-btn" aria-label="Menu" onClick={onMenu}>{Icon.menu()}</button>
    </header>
  );
}

function Players({ m, onPick }: { m: LiveMatch; onPick?: (i: number) => void }) {
  const v = m.view;
  const legsWord = (n: number) => `${n} ${n === 1 ? 'leg' : 'legs'}`;
  return (
    <div className="p-players">
      {playOrder(m).map(i => {
        const r = m.roster[i];
        const active = i === v.current && v.phase !== 'bulloff';
        let meta: ReactNode, big: string, out = false;
        if (isX01(m)) {
          // Legs as dots toward the target, like the rows on the scoreboard.
          const target = legTarget(m);
          const sets = m.options.matchMode.kind === 'sets' ? `${m.view.sets[i]} sets · ` : '';
          const avg = `avg ${fmtAvg(m.view.stats[i].matchAvg)}`;
          meta = target ? <>{sets}<Pips won={m.view.legs[i]} of={target} />{avg}</> : `${sets}${legsWord(m.view.legs[i])} · ${avg}`;
          big = String(m.view.scores[i]);
        } else {
          ({ meta, value: big, out } = m.view.rows[i]);
          // The active player's line shows what the hero shows on the big screen.
          // Free throw: the number on the line is the average, the hero's caption names the visit total.
          if (active) meta = [m.game === 'freethrow' ? 'Average' : m.view.hero.caption, m.view.hero.note].filter(Boolean).join(' · ');
          if (active && m.game === '121') meta += ` · ${m.view.attemptLeft} darts left in attempt · ${'♡'.repeat(m.view.lives)}`;
          if (active && m.game === 'catch40' && m.view.phase === 'throwing') meta = `Target ${m.view.target} · ${m.view.remaining} left · ${plural(m.view.attemptLeft, 'dart')} left`;
        }
        const note = removedNote(m, i);
        if (note) meta = note;
        // Hare and Hounds: the count big, its total small.
        const [count, total] = m.game === 'hare' ? big.split(' / ') : [big];
        return (
          <div key={i} className={`p-player ${active ? 'active' : ''} ${out || note ? 'out' : ''} ${onPick ? 'pickable' : ''}`} {...pickProps(onPick, i, r.name)}>
            <div className="who"><b>{r.name}</b><span>{meta}</span></div>
            <div className="num">{count}{total && <span className="of"> / {total}</span>}</div>
          </div>
        );
      })}
    </div>
  );
}

function checkoutHint(m: LiveMatch): string | null {
  if (m.view.phase !== 'throwing') return null;
  if (!isX01(m) && m.game !== '121' && m.game !== 'randomco' && m.game !== 'catch40') return null;
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
        const inner = <><span className="num">{dartValue(m, d)}</span><span className="lbl">{label(d.dart)}</span></>;
        // As on the scoreboard (D1): neutral in scoring games, a dart that did nothing dimmed, green and red in games counted in hits.
        const tone = isX01(m) ? (x01Dead(m)[i] ? 'dead' : '') : dartTone(m, m.view.visit.good[i], d);
        return editable
          ? <button key={`${i}-${flash}`} className={`p-dart ${tone} ${flash === i ? 'flash' : ''}`} onClick={() => onDart(i)}>{inner}</button>
          : <div key={i} className={`p-dart ${tone}`}>{inner}</div>;
      })}
    </div>
  );
}

/** This turn: whose, what it made so far, and the darts; just above the action bar, in reach of the thumb (B#10). */
function Turn({ m, editable, onDart, hint }: { m: LiveMatch; editable: boolean; onDart: (i: number) => void; hint?: string }) {
  const head = turnHead(m);
  return (
    <div className="section p-turn">
      <div className="p-turn-head">
        <span className="caps">{m.roster[m.view.current].name} · this turn</span>
        <span className={`num ${head.tone}`}>{head.text}</span>
      </div>
      <Darts m={m} editable={editable} onDart={onDart} />
      {hint !== undefined && <div className="p-hint">{hint}</div>}
    </div>
  );
}

function PhaseCard({ s, m }: { s: ClientState; m: LiveMatch }) {
  const v = m.view;
  if (m.intro && m.record) {
    const r = m.record;
    return (
      <div className="box">
        <div className="caps" style={{ color: 'var(--accent)', fontSize: 'var(--fs-ui-sm)' }}>Office record · {r.label}</div>
        <b style={{ fontSize: 'var(--fs-ui-xl)' }}>{r.value ? `${r.value} · ${r.by}${r.at ? ` · ${shortDate(r.at)}` : ''}` : 'No record yet'}</b>
        <button className="btn block" onClick={() => act({ type: 'skipIntro' })}>Skip</button>
      </div>
    );
  }
  const b = v.bullOff;
  if (b && (v.phase === 'bulloff' || m.bullTakeout)) {
    return <div className="box p-bull"><BullOffPanel m={m} b={b} picks /></div>;
  }
  const leg = isX01(m) && m.view.phase === 'legWon' ? m.view.lastLeg : null;
  if (isX01(m) && leg) {
    return (
      <div className="box">
        <div className="caps" style={{ color: 'var(--green)', fontSize: 'var(--fs-ui-sm)' }}>Leg {m.view.legNo} won</div>
        <b style={{ fontSize: 'var(--fs-ui-xl)' }}>{m.roster[leg.winner].name}</b>
        <span className="muted" style={{ fontSize: 'var(--fs-ui-sm)' }}>{label(leg.checkout)} · {leg.darts} darts · avg {fmtAvg(leg.avg)}</span>
      </div>
    );
  }
  if (v.phase === 'matchWon') {
    return (
      <div className="box">
        <div className="caps" style={{ color: 'var(--green)', fontSize: 'var(--fs-ui-sm)' }}>Game over</div>
        <b style={{ fontSize: 'var(--fs-ui-xl)' }}>{isX01(m) ? m.roster[m.view.matchWinner!].name : winnersOf(m)}</b>
        {!isX01(m) && <span className="muted" style={{ fontSize: 'var(--fs-ui-sm)' }}>{m.view.result}</span>}
        {!isX01(m) && <NewRecord m={m} />}
        <button className="btn primary block" onClick={() => act({ type: 'closeMatch', then: 'summary' })}>Summary</button>
      </div>
    );
  }
  if (s.board.takeout.active) {
    return <div className="banner info" style={{ borderRadius: 16 }}>Removing darts… don't throw yet</div>;
  }
  if (m.game === 'killer' && m.view.canReroll) {
    const ini = initialsOf(m.roster.map(r => r.name));
    return (
      <div className="box">
        <div className="av-chips"><span className="muted" style={{ fontSize: 'var(--fs-ui-sm)' }}>Numbers:</span>{m.roster.map((r, i) => <AvatarChip key={i} text={ini[i]} tone={playerColor(i)} name={r.name} value={m.view.numbers[i]} left={!!removedNote(m, i)} />)}</div>
        <button className="btn block" onClick={() => act({ type: 'reroll' })}>Reroll numbers</button>
      </div>
    );
  }
  return null;
}

export function PhonePilot({ s, onMenu, onBoard, onFix, onEnd, onPlayer }: {
  s: ClientState; onMenu: () => void; onBoard: () => void; onFix: (i: number) => void; onEnd: () => void; onPlayer: (i: number) => void;
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
        <Players m={m} onPick={onPlayer} />
        <PhaseCard s={s} m={m} />
        {!inBull && <Turn m={m} editable onDart={onFix} hint={checkoutHint(m) ?? aimHint(m) ?? c.hint} />}
        {offline && !inBull && v.phase === 'throwing' && v.visit.dartsLeft > 0 && (
          <div className="section">
            <span className="caps">Enter dart {v.visit.darts.length + 1}</span>
            <Keypad cur={null} onPick={addDart} />
          </div>
        )}
      </div>
      {(!inBull || c.canUndo) && (
        <div className={`p-actions ${c.endInstead || c.finish ? 'three' : 'lead'}`}>
          <button className="btn" onClick={() => act({ type: 'undo' })}>Undo</button>
          {c.endInstead && <button className="btn" onClick={onEnd}>End match</button>}
          {c.finish && <button className="btn" onClick={() => act({ type: 'endMatch', save: true })}>Finish</button>}
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
            {m.view.phase !== 'bulloff' && <Turn m={m} editable={false} onDart={() => undefined} />}
          </>
        ) : (
          <div className="center-msg">
            <h2>No match right now</h2>
            <p>Take control to start one, or look at the stats.</p>
          </div>
        )}
        <div className="p-hint">{s.pilot ? `Pilot: ${s.pilot.deviceName}` : 'Nobody is the pilot yet'}</div>
      </div>
      <div className="p-actions lead">
        <a className="btn" href="/stats" style={{ textDecoration: 'none' }}>Stats</a>
        <button className="btn primary" onClick={() => act({ type: 'takeControl' })}>Take control</button>
      </div>
    </div>
  );
}

/** Pilot phone with no match running. */
export function PhoneHome({ s, onMenu, onBoard, onNew, onRecord, onPlayers }: {
  s: ClientState; onMenu: () => void; onBoard: () => void; onNew: () => void; onRecord: (r: LobbyRecord) => void; onPlayers: () => void;
}) {
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
            <span className="caps" style={{ fontSize: 'var(--fs-ui-sm)' }}>Last match · {last.description.replace(/^X01 · /, '')}</span>
            {last.players.map((p, i) => (
              // As in the lobby: the winner in plain white, a removed player in --off (not faded).
              <div key={i} className="option-row">
                <span style={{ fontWeight: p.winner || last.players.length === 1 ? 800 : 500, color: p.left ? 'var(--off)' : p.winner || last.players.length === 1 ? 'var(--text)' : 'var(--muted)' }}>{p.name}{p.left && ' · Left'}</span>
                <span className="num" style={{ fontSize: 'var(--fs-ui-2xl)', color: p.left ? 'var(--off)' : p.winner || last.players.length === 1 ? 'var(--text)' : 'var(--muted)' }}>{p.value}</span>
              </div>
            ))}
          </div>
        )}
        {/* The office records from the lobby: the phone does everything the kiosk does (docs/UI.md, Ekrany i tryby). */}
        <Records lastId={last?.id} onPick={onRecord} />
        <div className="phone-start">
          <div className="caps">{last ? 'Ready for the next one' : 'No match yet'}</div>
          <h2>Game on?</h2>
        </div>
      </div>
      <div className="p-actions" style={{ gridTemplateColumns: '1fr' }}>
        <button className="btn primary" onClick={onNew}>New match</button>
        {last && <button className="btn" onClick={() => act({ type: 'rematch' })}><RematchLabel players={last.players} /></button>}
      </div>
    </div>
  );
}
