import type { ReactNode } from 'react';
import { useState } from 'react';
import { label } from '../../../games/darts.ts';
import type { GameId } from '../../../games/index.ts';
import type { Verdict } from '../../../games/turns.ts';
import { signed } from '../../../games/turns.ts';
import type { ClientState, LiveMatch } from '../../../server/protocol.ts';
import { DartFace } from '../components/DartFace.tsx';
import { GameIcon } from '../components/GameIcon.tsx';
import { HowToOverlay } from '../components/HowTo.tsx';
import { BullOffPanel } from '../components/BullOff.tsx';
import { Icon, Logo, Qr, act, pilotUrl } from '../components/ui.tsx';
import type { X01Match } from '../match.ts';
import { controls, dartTone, heroCorner, isX01, legTarget, pickProps, playOrder, removedNote, visitScored, x01Dead } from '../match.ts';
import { FxLayer, useAnim } from '../components/FxLayer.tsx';
import { fmtAvg, useNow } from '../util.ts';
import { CricketGrid, MiniEnd, MiniHero, MiniList, MiniSide, RecordIntro, RecordModal, RouteHint, TurnPanel, hasBoard } from './MiniBoard.tsx';

const STUCK_AFTER_MS = 15_000;

export function boardPill(s: ClientState): { dot: string; text: string } {
  const b = s.board;
  if (!b.connected) return { dot: 'red', text: 'Board offline' };
  if (b.busy) return { dot: 'amber', text: b.busy.action === 'calibrate' ? 'Calibrating…' : 'Restarting…' };
  if (b.takeout.active) return { dot: 'amber', text: 'Removing darts' };
  if (!b.detecting) return { dot: 'amber', text: 'Detection off' };
  const phase = s.match?.view.phase;
  if (phase === 'legWon') return { dot: 'green', text: 'Leg won' };
  if (phase === 'matchWon') return { dot: 'green', text: 'Game over' };
  return { dot: 'green', text: s.match ? 'Ready' : 'Board ready' };
}

export function BigHeader({ s, sub, game, onBoard, onMenu }: { s: ClientState; sub?: string; game?: GameId; onBoard?: () => void; onMenu: () => void }) {
  const pill = boardPill(s);
  return (
    <header className="big-header">
      <Logo />
      {sub && <><span className="sep" />{game && <GameIcon game={game} className="sub-icon" />}<div className="sub">{sub}</div></>}
      <div className="spacer" />
      <div className="pill"><span className={`dot ${pill.dot}`} />{pill.text}</div>
      {onBoard && <button className="icon-btn" aria-label="Board panel" onClick={onBoard}>{Icon.board()}</button>}
      <button className="icon-btn" aria-label="Menu" onClick={onMenu}>{Icon.menu()}</button>
    </header>
  );
}

export function Pips({ won, of }: { won: number; of: number }) {
  return <div className="pips">{Array.from({ length: of }, (_, i) => <span key={i} className={`pip ${i < won ? 'on' : ''}`} />)}</div>;
}

/**
 * X01 hero, variant D (DECISIONS.md): name and legs on top, the score big on the left, and on the right half This turn
 * with the visit total and under it the checkout route or BUST. The corner pill only says "Checked out" or that a double
 * is needed to start.
 */
function Hero({ m, flash, onDart, canEdit }: { m: X01Match; flash: number | null; onDart: (i: number) => void; canEdit: boolean }) {
  const v = m.view;
  const p = v.current;
  const target = legTarget(m);
  const visit = v.visit;
  const corner = heroCorner(m);
  const dead = x01Dead(m);
  return (
    <section className="hero split">
      <div className="hero-top">
        {Icon.play()}
        <div className="hero-name">{m.roster[p].name}</div>
        {target ? <Pips won={v.legs[p]} of={target} /> : null}
        <div className="spacer" />
        {corner && <div className={`status ${corner.tone}`}>{corner.text}</div>}
      </div>
      <div className="hero-score-row">
        <div className="hero-score num">{v.scores[p]}</div>
      </div>
      <TurnPanel total={visitScored(m) ?? 0}>
        {visit.bust ? <div className="hero-bust num">BUST</div> : <RouteHint checkout={v.checkout} setup={v.setup} />}
      </TurnPanel>
      <div className="hero-darts">
        {[0, 1, 2].map(i => {
          const d = visit.darts[i];
          if (!d) {
            const addable = canEdit && i === visit.darts.length && visit.dartsLeft > 0 && v.phase === 'throwing' && !visit.bust;
            return addable
              ? <button key={i} className="dart-tile empty" onClick={() => onDart(i)}><span className="lbl">+ Add</span></button>
              : <div key={i} className="dart-tile empty" />;
          }
          const tile = <DartFace m={m} rec={d} />;
          const cls = `dart-tile ${dead[i] ? 'dead' : ''} ${flash === i ? 'flash' : ''}`;
          return canEdit
            ? <button key={`${i}-${flash}`} className={cls} onClick={() => onDart(i)} aria-label={`Fix dart ${i + 1}: ${label(d.dart)}`}>{tile}</button>
            : <div key={`${i}-${flash}`} className={cls}>{tile}</div>;
        })}
      </div>
    </section>
  );
}

function PlayerList({ m, onPick }: { m: X01Match; onPick?: (i: number) => void }) {
  const v = m.view;
  // Up to 4 players the rows stay full size; the stats cards make room for them.
  const compact = m.roster.length > 4;
  const target = legTarget(m);
  const sets = m.options.matchMode.kind === 'sets';
  return (
    <div className="plist">
      {playOrder(m).map(i => {
        const r = m.roster[i];
        const active = i === v.current && v.phase !== 'bulloff';
        const note = removedNote(m, i);
        return (
          <div key={i} className={`prow ${compact ? 'compact' : ''} ${active ? 'active' : ''} ${note ? 'out' : ''}`} {...pickProps(onPick, i, r.name)}>
            <div className="info">
              <div className="name">{r.name}</div>
              <div className="meta">
                {note && <span>{note} ·</span>}
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
      <div className="card stats-card">
        <div className="caps">{name} · This match</div>
        <div className={`mstats ${m.roster.length >= 4 ? 'tight' : ''}`}>
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
  const scored = visitScored(m);
  // Cricket counts marks, so a fixed S17 to T17 shows; hits would not change.
  const [n, unit] = m.game === 'cricket' ? [m.view.visitMarks, 'mark'] : [hits, 'hit'];
  // Bullseye: the visit's points with a sign, +3 or −2.
  // Bob's 27 names who went out.
  const big = verdict ? (m.game === 'bobs27' && verdict.text === 'Out' ? `${m.roster[v.current].name} is out` : verdict.text) : m.game === 'bullseye' ? signed(m.view.visitPoints, true) : scored !== null ? String(scored) : `${n} ${unit}${n === 1 ? '' : 's'}`;
  // Only the name, the headline and the darts; what the visit left shows on the hero once the card is gone.
  return (
    <div className="overlay">
      <div className="overlay-card">
        {darts.length > 0 && (
          <div className="body">
            <div className="who">{m.roster[v.current].name}</div>
            <div className={`bigscore num ${verdict ? `verdict ${verdict.tone}` : scored === null ? 'verdict' : ''}`}>{big}</div>
            <div className="card-darts">
              {[0, 1, 2].map(i => {
                const d = darts[i];
                if (!d) {
                  // A dart the board missed can be added until the takeout ends (docs/UI.md, Tura i takeout).
                  const addable = canEdit && i === darts.length && v.visit.dartsLeft > 0;
                  return addable
                    ? <button key={i} className="dart-tile empty" onClick={() => onDart(i)}><span className="lbl">+ Add</span></button>
                    : <div key={i} className="dart-tile empty" />;
                }
                const tile = <DartFace m={m} rec={d} />;
                const cls = `dart-tile ${isX01(m) ? (x01Dead(m)[i] ? 'dead' : '') : dartTone(m, good![i], d)}`;
                return canEdit
                  ? <button key={i} className={cls} onClick={() => onDart(i)} aria-label={`Fix dart ${i + 1}: ${label(d.dart)}`}>{tile}</button>
                  : <div key={i} className={cls}>{tile}</div>;
              })}
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
        {stuck && <div className="stuck">Board stuck? Tap Takeout done.</div>}
      </div>
    </div>
  );
}

// Leg and match end look the same in every game: kicker, winner and big tiles, with no lines under them;
// the action row under the side column says what comes next (docs/UI.md, Start i koniec meczu).
function LegEnd({ m }: { m: X01Match }) {
  const v = m.view;
  const leg = v.lastLeg!;
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
        <div className="kicker">WINNER</div>
        <div className="winner">{m.roster[w].name}</div>
        <div className="result-grid">
          <div><div className="l">{m.options.matchMode.kind === 'sets' ? 'Sets' : 'Legs'}</div><div className="num">{[...(m.options.matchMode.kind === 'sets' ? v.sets : v.legs)].sort((a, b) => b - a).join('–')}</div></div>
          <div><div className="l">Match avg</div><div className="num">{fmtAvg(v.stats[w].matchAvg)}</div></div>
          <div><div className="l">Checkout</div><div className="num">{v.lastLeg ? label(v.lastLeg.checkout) : '–'}</div></div>
        </div>
        {isPilot && (
          <div className="actions">
            <button className="btn primary" onClick={() => act({ type: 'closeMatch', then: 'summary' })}>Summary</button>
          </div>
        )}
      </div>
    </div>
  );
}

function BullOff({ m, isPilot }: { m: LiveMatch; isPilot: boolean }) {
  const b = m.view.bullOff;
  if (!b) return null;
  return (
    <div className="overlay">
      <div className="bulloff-card"><BullOffPanel m={m} b={b} picks={isPilot} /></div>
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

export function Scoreboard({ s, onMenu, onBoard, onFix, onEnd, onPlayer, overlay }: {
  s: ClientState;
  /** Opens the removal dialog for a player; the pilot only. */
  onPlayer?: (i: number) => void;
  onMenu: () => void;
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
  // The records modal, open for the match whose key it holds, so a new match starts without it.
  const [records, setRecords] = useState<string | null>(null);
  // A fixed dart flashes; so does a fresh T20 or bull (docs/EFEKTY.md).
  const flash = m.lastFix && Date.now() - m.lastFix.at < 3000 ? m.lastFix.index : anim?.anim === 'tile' ? v.visit.darts.length - 1 : null;
  const takeout = s.board.takeout.active;
  const reroll = m.game === 'killer' && m.view.canReroll && !m.intro;
  const finished = v.visit.darts.length > 0 && v.visit.dartsLeft === 0;

  // The last row of the right column; the third button (Reroll or End match) gets a row above Undo and the main action.
  const third = reroll ? <button className="btn" onClick={() => act({ type: 'reroll' })}>Reroll numbers</button>
    : c.endInstead ? <button className="btn" onClick={onEnd}>End match</button>
    : c.finish ? <button className="btn" onClick={() => act({ type: 'endMatch', save: true })}>Finish</button> : null;
  const actions = isPilot && (third || c.canUndo || c.primary) && (
    <div className="side-actions">
      {third && <div className="third">{third}</div>}
      {c.canUndo && <button className="btn" onClick={() => act({ type: 'undo' })}>{Icon.undo()}Undo</button>}
      {c.primary && <button className="btn primary" onClick={() => act(c.primary!.cmd)}>{c.primary.label}</button>}
    </div>
  );

  return (
    <div className="big">
      <BigHeader s={s} sub={m.description} game={m.game} onBoard={onBoard} onMenu={onMenu} />
      {!s.board.connected && <div className="banner">Board offline · tap a dart to enter it by hand</div>}
      <main className={`board-main ${!isX01(m) && hasBoard(m) ? 'with-board' : ''}`}>
        {isX01(m) ? (
          <>
            <Hero m={m} flash={flash} onDart={onFix} canEdit={isPilot} />
            <aside className="side">
              <PlayerList m={m} onPick={onPlayer} />
              {m.roster.length <= 4 && <StatsCards m={m} />}
              {actions}
            </aside>
          </>
        ) : (
          <>
            <MiniHero m={m} flash={flash} onDart={onFix} canEdit={isPilot} onRecords={() => setRecords(m.key)} />
            <aside className="side">{m.game === 'cricket' ? <CricketGrid m={m} onPick={onPlayer} /> : <><MiniList m={m} onPick={onPlayer} /><MiniSide m={m} /></>}{actions}</aside>
          </>
        )}
      </main>
      {m.intro && !isX01(m) ? <RecordIntro m={m} isPilot={isPilot} />
        : (v.phase === 'bulloff' || m.bullTakeout) && <BullOff m={m} isPilot={isPilot} />}
      {v.phase === 'throwing' && (takeout || finished) && !m.bullTakeout && <TurnCard s={s} m={m} onDart={onFix} canEdit={isPilot} />}
      {isX01(m) && m.view.phase === 'legWon' && <LegEnd m={m} />}
      {v.phase === 'matchWon' && (isX01(m) ? <MatchEnd m={m} isPilot={isPilot} /> : <MiniEnd m={m} isPilot={isPilot} />)}
      {records === m.key && !isX01(m) && m.record && <RecordModal m={m} onClose={() => setRecords(null)} />}
      <HowToOverlay s={s} />
      {/* The 140+ badge shows the visit total in X01, Free throw and Gotcha (docs/EFEKTY.md). */}
      <FxLayer total={isX01(m) ? m.view.visit.total : m.game === 'freethrow' ? m.view.visitTotal : m.game === 'gotcha' ? m.view.visitScore : null} />
      {overlay}
    </div>
  );
}
