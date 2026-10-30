import type { ReactNode } from 'react';
import { label, value } from '../../../games/darts.ts';
import type { GameId } from '../../../games/index.ts';
import type { Verdict } from '../../../games/turns.ts';
import type { ClientState, LiveMatch } from '../../../server/protocol.ts';
import { GameIcon } from '../components/GameIcon.tsx';
import { HowToOverlay } from '../components/HowTo.tsx';
import { BullRows, BullZoom, bullStatus } from '../components/BullOff.tsx';
import { Icon, Logo, Qr, act, pilotUrl } from '../components/ui.tsx';
import type { X01Match } from '../match.ts';
import { controls, dartTone, dartValue, isX01, legTarget } from '../match.ts';
import { FxLayer, useAnim } from '../components/FxLayer.tsx';
import { fmtAvg, useNow } from '../util.ts';
import { CricketGrid, MiniEnd, MiniHero, MiniList, RecordIntro, RouteHint, ballWonNote, hasBoard, knockoutNote } from './MiniBoard.tsx';

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

export function BigHeader({ s, sub, game, onQr, onBoard, onMenu }: { s: ClientState; sub?: string; game?: GameId; onQr: () => void; onBoard?: () => void; onMenu: () => void }) {
  const pill = boardPill(s);
  return (
    <header className="big-header">
      <Logo />
      {sub && <><span className="sep" />{game && <GameIcon game={game} className="sub-icon" />}<div className="sub">{sub}</div></>}
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
  // Only states worth words; the dart tiles show how many darts are left.
  const left = visit.bust ? 'Bust' : visit.checkout ? 'Checked out' : !v.checkedIn[p] ? 'Needs a double to start' : null;
  return (
    <section className="hero">
      <div className="hero-top">
        {Icon.play()}
        <div className="hero-name">{m.roster[p].name}</div>
        {target ? <Pips won={v.legs[p]} of={target} /> : null}
        <div className="spacer" />
        {left && <div className="hero-left">{left}</div>}
      </div>
      <div className="hero-score-row">
        <div className="hero-score num">{v.scores[p]}</div>
        {visit.bust ? <div className="hero-bust num">BUST</div>
          : <RouteHint checkout={v.checkout} setup={v.setup} />}
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
  // Up to 4 players the rows stay full size; the stats cards make room for them.
  const compact = m.roster.length > 4;
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
    ['60+', String(st.c60)], ['80+', String(st.c80)], ['100+', String(st.c100)],
  ];
  return (
    <>
      {m.roster.length <= 2 && <div className="card">
        <div className="caps">{name} · Last visits</div>
        <div className="visits">
          {visits.map((x, i) => x === undefined ? <div key={i} className="none" /> : x === null ? <div key={i} className="bust num">BUST</div> : <div key={i} className="num">{x}</div>)}
        </div>
      </div>}
      <div className="card" style={{ flex: 1, minHeight: 0 }}>
        <div className="caps">{name} · This match</div>
        <div className="mstats">
          {tiles.map(([l, val]) => <div key={l}><span className="l">{l}</span><span className="num">{val}</span></div>)}
        </div>
      </div>
    </>
  );
}

/** The finished visit, from its last dart until the takeout ends (docs/UI.md, Tura i takeout). */
function TurnCard({ s, m, onDart, canEdit }: { s: ClientState; m: LiveMatch; onDart: (i: number) => void; canEdit: boolean }) {
  const now = useNow(1000);
  const v = m.view;
  const takeout = s.board.takeout.active;
  const since = s.board.takeout.since ?? now;
  const stuck = takeout && now - since > STUCK_AFTER_MS;
  const darts = v.visit.darts;
  const good = isX01(m) ? null : m.view.visit.good;
  const verdict: Verdict | null = isX01(m) ? (m.view.visit.bust ? { text: 'Bust', tone: 'bad' } : null) : m.view.visit.verdict;
  const hits = good?.filter(Boolean).length ?? 0;
  const scored = isX01(m) ? m.view.visit.total
    : m.game === 'hol' ? m.view.sum ?? 0
    : m.game === 'shanghai' ? m.view.visitPoints
    : m.game === 'knockout' ? m.view.visitScore
    : m.game === '121' || m.game === 'randomco' || m.game === 'gotcha' ? darts.reduce((a, d, i) => a + (good![i] ? value(d.dart) : 0), 0) : null;
  // Cricket counts marks, so a fixed S17 to T17 shows; hits would not change.
  const [n, unit] = m.game === 'cricket' ? [m.view.visitMarks, 'mark'] : [hits, 'hit'];
  const big = verdict ? verdict.text : scored !== null ? String(scored) : `${n} ${unit}${n === 1 ? '' : 's'}`;
  const stats: [string, string][] = isX01(m) ? [['Left', String(m.view.scores[v.current])]]
    : m.game === '121' ? [['Target', String(m.view.target)], ['Left', String(m.view.remaining)], ['Darts in attempt', String(m.view.attemptLeft)]]
    : m.game === 'randomco' ? [['Number', String(m.view.number)], ['Left', String(m.view.remaining)]]
    : m.game === 'hol' ? [['Range', `${m.view.lo}–${m.view.hi}`]]
    : m.game === 'gotcha' ? [['Score', m.view.hero.big], ['Left', String(m.view.target - m.view.totals[v.current])]]
    : m.game === 'shanghai' ? [['Round', m.view.tiebreak ? 'Tiebreak' : `${m.view.round} / ${m.view.rounds}`], ['Total', String(m.view.points[v.current])]]
    : m.game === 'knockout' ? [['Lowest so far', m.view.lowest === null ? '–' : String(m.view.lowest)], ['Lives', String(m.view.lives[v.current])]]
    : m.game === 'football' ? [['Goals', String(m.view.goals[v.current])]]
    : [[m.view.hero.caption, m.view.hero.big]];
  const gotchaNote = m.game === 'gotcha' && m.view.zeroed.length ? `Gotcha! ${m.view.zeroed.map(i => m.roster[i].name).join(', ')} → 0` : null;
  const note = m.game === 'gotcha' ? gotchaNote : m.game === 'knockout' ? knockoutNote(m) : m.game === 'football' ? ballWonNote(m)
    : isX01(m) || m.game === '121' || m.game === 'randomco' || m.game === 'hol' || m.game === 'shanghai' ? null : m.view.hero.note;
  return (
    <div className="overlay">
      <div className="overlay-card">
        {darts.length > 0 && (
          <div className="body">
            <div className="who">{m.roster[v.current].name}{scored !== null && !verdict ? ' scored' : ''}</div>
            <div className={`bigscore num ${verdict ? `verdict ${verdict.tone}` : scored === null ? 'verdict' : ''}`}>{big}</div>
            <div className="card-darts">
              {[0, 1, 2].map(i => {
                const d = darts[i];
                if (!d) return <div key={i} className="dart-tile empty" />;
                // Minigames lead with the field hit, as on their screen; X01 with the points.
                const [top, sub] = good ? [label(d.dart), dartValue(m, d.dart)] : [value(d.dart), label(d.dart)];
                const tile = <><span className="num">{top}</span><span className="lbl">{sub}</span></>;
                const cls = `dart-tile ${good && !isX01(m) ? dartTone(m, good[i]) : ''}`;
                return canEdit
                  ? <button key={i} className={cls} onClick={() => onDart(i)} aria-label={`Fix dart ${i + 1}: ${label(d.dart)}`}>{tile}</button>
                  : <div key={i} className={cls}>{tile}</div>;
              })}
            </div>
            <div className="card-stats">
              {stats.map(([k, val]) => <div key={k}><div className="caps">{k}</div><div className="num">{val}</div></div>)}
            </div>
            {note && <div className="card-note">{note}</div>}
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

function MatchEnd({ m, isPilot }: { m: X01Match; isPilot: boolean }) {
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
            <button className="btn primary" onClick={() => act({ type: 'closeMatch', then: 'summary' })}>Summary</button>
          </div>
        ) : <div className="note">The summary opens from the pilot.</div>}
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

export function Scoreboard({ s, onMenu, onQr, onBoard, onFix, onEnd, overlay }: {
  s: ClientState;
  onMenu: () => void;
  onQr: () => void;
  onBoard?: () => void;
  onFix: (index: number) => void;
  onEnd: () => void;
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

  return (
    <div className="big">
      <BigHeader s={s} sub={m.description} game={m.game} onQr={onQr} onBoard={onBoard} onMenu={onMenu} />
      {!s.board.connected && <div className="banner">Board offline · enter darts by hand on the pilot</div>}
      <main className={`board-main ${!isX01(m) && hasBoard(m) ? 'with-board' : ''} ${isX01(m) && m.roster.length > 2 && m.roster.length <= 4 ? 'wide-side' : ''}`}>
        {isX01(m) ? (
          <>
            <Hero m={m} flash={flash} onDart={onFix} canEdit={isPilot} />
            <aside className="side">
              <PlayerList m={m} />
              {m.roster.length <= 4 && <StatsCards m={m} />}
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
      {v.phase === 'matchWon' && (isX01(m) ? <MatchEnd m={m} isPilot={isPilot} /> : <MiniEnd m={m} isPilot={isPilot} />)}
      <HowToOverlay s={s} />
      <FxLayer total={isX01(m) ? m.view.visit.total : null} />
      {overlay}
    </div>
  );
}
