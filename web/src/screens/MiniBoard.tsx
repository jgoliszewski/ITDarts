// Scoreboard parts for the minigames: hero, player list, game widgets, record screen and end screen.
import { useRef } from 'react';
import { LIVES } from '../../../games/121.ts';
import { CRICKET_SECTORS } from '../../../games/cricket.ts';
import { label } from '../../../games/darts.ts';
import { roundEndText } from '../../../games/knockout.ts';
import { SECTORS } from '../../../games/race.ts';
import { Icon, act } from '../components/ui.tsx';
import { TargetBoard } from '../components/Dartboard.tsx';
import { Ladder, Odometer } from '../components/Ladder.tsx';
import type { MiniMatch } from '../match.ts';
import { dartTone, dartValue, winnersOf } from '../match.ts';
import { shortDate } from '../util.ts';

/** Range bar for Higher or Lower: 0–180 with the forbidden range in red and the visit sum. */
function Scale({ lo, hi, sum }: { lo: number; hi: number; sum: number | null }) {
  const pct = (n: number) => `${(Math.min(180, Math.max(0, n)) / 180) * 100}%`;
  return (
    <div className="hol-scale" aria-label={`Forbidden range ${lo} to ${hi}`}>
      <div className="track" />
      <div className="range" style={{ left: pct(lo), width: `calc(${pct(hi)} - ${pct(lo)})` }} />
      <span className="edge num" style={{ left: pct(lo) }}>{lo}</span>
      <span className="edge num" style={{ left: pct(hi) }}>{hi}</span>
      {sum !== null && <div className={`mark ${sum >= lo && sum <= hi ? 'in' : ''}`} style={{ left: pct(sum) }} />}
    </div>
  );
}

/**
 * 121 and Knockout lives (3 in both): full hearts left, empty ones lost. `losing` shakes the heart a failed attempt is
 * about to take while the visit is still held on screen; hearts a refill gives back pop in (docs/GRY.md#121).
 */
export function Hearts({ lives, losing = false }: { lives: number; losing?: boolean }) {
  const prev = useRef(lives);
  const gained = lives > prev.current ? prev.current : lives;
  prev.current = lives;
  return (
    <div className="hearts" aria-label={`${lives} of ${LIVES} lives`}>
      {Array.from({ length: LIVES }, (_, i) => {
        const gain = i >= gained && i < lives;
        return (
          <span key={gain ? `${i}-${lives}` : i} className={`${i < lives ? 'on' : ''} ${losing && i === lives - 1 ? 'losing' : ''} ${gain ? 'gain' : ''}`}>
            {i < lives ? '♥' : '♡'}
          </span>
        );
      })}
    </div>
  );
}

/** Knockout: the round's lowest visit so far, big next to the visit, green once the visit is past it (bug report 2026-10-30). */
function ToBeat({ lowest, visit }: { lowest: number | null; visit: number }) {
  if (lowest === null) return <div className="hero-checkout ko-beat"><div className="caps">First to throw</div></div>;
  return (
    <div className={`hero-checkout ko-beat ${visit > lowest ? 'safe' : ''}`}>
      <div className="caps">{visit > lowest ? 'Beaten' : 'To beat'}</div>
      <div className="num">{lowest}</div>
    </div>
  );
}

/** Checkout route, or setup darts for the next visit when no checkout is on. */
export function RouteHint({ checkout, setup }: { checkout: string | null; setup: string | null }) {
  if (!checkout && !setup) return null;
  return <div className={`hero-checkout ${checkout ? '' : 'setup'}`}><div className="caps">{checkout ? 'Checkout' : 'Setup'}</div><div className="num">{checkout ?? setup}</div></div>;
}

/**
 * 121: darts left in the attempt, as a number and one pip per dart, grouped by visit. The pips go green on a checkout
 * and flash red on a failed attempt, while the finished visit is held on screen; a new attempt's pips fade in.
 */
function AttemptTile({ left, of, end, attempt }: { left: number; of: number; end: 'out' | 'failed' | null; attempt: string }) {
  return (
    <div className="attempt-tile">
      <div className="caps">Darts left in attempt</div>
      <div className="row">
        <div className="num">{left}</div>
        <div key={attempt} className={`attempt-pips ${end ?? ''}`}>
          {Array.from({ length: of / 3 }, (_, v) => (
            <div key={v}>{[0, 1, 2].map(i => <span key={i} className={v * 3 + i < of - left ? 'used' : ''} />)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

type BoardGame = 'atc' | 'fullboard' | 'shanghai' | 'football';

/** ATC and Full Board put the board next to the hero (bug report 2026-10-27). */
export const hasBoard = (m: MiniMatch): m is Extract<MiniMatch, { game: BoardGame }> =>
  m.game === 'atc' || m.game === 'fullboard' || m.game === 'shanghai' || m.game === 'football';

function RaceBoard({ m }: { m: Extract<MiniMatch, { game: BoardGame }> }) {
  const v = m.view;
  const darts = v.visit.darts.map((d, i) => ({ dart: d.dart, good: v.visit.good[i] }));
  // Shanghai lights the round's sector; nothing is crossed off.
  if (m.game === 'shanghai') return <TargetBoard cleared={[]} target={m.view.sector} ring={null} darts={darts} label={`Round sector ${m.view.sector}`} />;
  // Football: the bull wins the ball (only the bullseye with Bull only); with the ball, the doubles score.
  if (m.game === 'football') {
    return m.view.ball === v.current
      ? <TargetBoard cleared={[]} target="ring" ring={2} darts={darts} label="Doubles score" />
      : <TargetBoard cleared={[]} target={25} ring={m.options.kickOff === 'bullseye' ? 2 : null} darts={darts} label="The bull wins the ball" />;
  }
  const ring = m.options.target === 'doubles' ? 2 : m.options.target === 'trebles' ? 3 : null;
  if (m.game === 'fullboard') {
    const cleared = m.view.cleared[v.current];
    return <TargetBoard cleared={cleared} target={null} ring={ring} darts={darts} label={`${cleared.length} of ${SECTORS.length} sectors cleared`} />;
  }
  const { targets, progress } = m.view;
  const i = progress[v.current];
  const target = i < targets.length ? targets[i] : null;
  return <TargetBoard cleared={targets.slice(0, i)} target={target} ring={ring} darts={darts} label={target === null ? 'All targets cleared' : `Target ${v.hero.big}`} />;
}

/** Gotcha: who the last visit sent to zero, on the hero once that visit's card is gone (docs/GRY.md). */
export const gotchaNote = (m: MiniMatch): string | null =>
  m.game === 'gotcha' && m.view.zeroed.length && m.view.visit.darts.length === 0 ? `Gotcha! ${m.view.zeroed.map(i => m.roster[i].name).join(', ')} → 0` : null;

/** Knockout: how the last round ended, in words, or null when no round has ended since the last dart. */
export const knockoutNote = (m: MiniMatch): string | null =>
  m.game === 'knockout' && m.view.roundEnd ? roundEndText(m.view.roundEnd, m.roster.map(r => r.name)) : null;

/** Football: whom the visit on screen won the ball from, for the turn card. */
export const ballWonNote = (m: MiniMatch): string | null =>
  m.game === 'football' && typeof m.view.wonFrom === 'number' ? `Ball won from ${m.roster[m.view.wonFrom].name}` : null;

/** The hero's line under the score: the game's own, with names where the game module has none. */
function heroNote(m: MiniMatch): string {
  if (m.game === 'knockout' && m.view.visit.darts.length === 0) return knockoutNote(m) ?? m.view.hero.note;
  if (m.game === 'football' && m.view.ball !== null && m.view.ball !== m.view.current) {
    return `${m.roster[m.view.ball].name} has the ball · hit ${m.options.kickOff === 'any' ? 'the bull' : 'the bullseye'}`;
  }
  return gotchaNote(m) ?? m.view.hero.note;
}

export function MiniHero({ m, flash, onDart, canEdit }: { m: MiniMatch; flash: number | null; onDart: (i: number) => void; canEdit: boolean }) {
  const v = m.view;
  const visit = v.visit;
  const left = visit.dartsLeft === 0 && visit.darts.length ? 'Pull the darts' : `${visit.dartsLeft} ${visit.dartsLeft === 1 ? 'dart' : 'darts'} left`;
  const board = hasBoard(m);
  // 121 holds the finished visit until the takeout: no darts left in the attempt means it just ended, by a checkout or not.
  const attemptEnd = m.game === '121' && m.view.attemptLeft === 0 && v.phase !== 'matchWon' ? (m.view.remaining === 0 ? 'out' : 'failed') : null;
  return (
    <section className={`hero ${board ? 'with-board' : ''} ${m.game === '121' ? 'with-ladder' : ''}`}>
      <div className="hero-top">
        {Icon.play()}
        <div className="hero-name">{m.roster[v.current].name}</div>
        <div className="spacer" />
        {m.game === '121' && <Hearts lives={m.view.lives} losing={attemptEnd === 'failed'} />}
        {m.game === 'knockout' && <Hearts lives={m.view.lives[v.current]} />}
        <div className="hero-left">{left}</div>
      </div>
      <div className="hero-score-row">
        <div className="mini-big">
          <div className="caps">{m.game === '121' ? <>Target <Odometer value={m.view.target} /></> : v.hero.caption}</div>
          {m.game === 'fullboard'
            ? <div className="num">{m.view.cleared[v.current].length}<span className="of"> / {SECTORS.length}</span></div>
            : <div className={`num ${v.hero.big.length > 4 ? 'long' : ''}`}>{v.hero.big}</div>}
        </div>
        {(m.game === '121' || m.game === 'randomco') && <RouteHint checkout={m.view.checkout} setup={m.view.setup} />}
        {m.game === 'knockout' && <ToBeat lowest={m.view.lowest} visit={m.view.visitScore} />}
      </div>
      {board && <RaceBoard m={m} />}
      {m.game === 'hol' && <Scale lo={m.view.lo} hi={m.view.hi} sum={m.view.sum} />}
      {m.game === '121' && <Ladder target={m.view.target} record={m.record?.raw ?? null} />}
      {heroNote(m) && <div className="hero-note">{heroNote(m)}</div>}
      <div className="hero-darts">
        {[0, 1, 2].map(i => {
          const d = visit.darts[i];
          if (!d) {
            const addable = canEdit && i === visit.darts.length && visit.dartsLeft > 0 && v.phase === 'throwing';
            return addable
              ? <button key={i} className="dart-tile empty" onClick={() => onDart(i)}><span className="lbl">+ Add</span></button>
              : <div key={i} className="dart-tile empty" />;
          }
          const tile = <><span className="num">{label(d.dart)}</span><span className="lbl">{dartValue(m, d.dart)}</span></>;
          const cls = `dart-tile ${dartTone(m, visit.good[i])} ${flash === i ? 'flash' : ''}`;
          return canEdit
            ? <button key={`${i}-${flash}`} className={cls} onClick={() => onDart(i)} aria-label={`Fix dart ${i + 1}: ${label(d.dart)}`}>{tile}</button>
            : <div key={`${i}-${flash}`} className={cls}>{tile}</div>;
        })}
        {m.game === '121' && <AttemptTile left={m.view.attemptLeft} of={m.view.attemptDarts} end={attemptEnd} attempt={`${m.view.target}:${m.view.lives}`} />}
      </div>
    </section>
  );
}

export function MiniList({ m }: { m: MiniMatch }) {
  const v = m.view;
  const compact = m.roster.length > 2;
  return (
    <div className="plist">
      {m.roster.map((r, i) => {
        const row = v.rows[i];
        const active = i === v.current && v.phase !== 'bulloff';
        return (
          <div key={i} className={`prow ${compact ? 'compact' : ''} ${active ? 'active' : ''} ${row.out ? 'out' : ''}`}>
            <div className="info">
              <div className="name">{r.name}</div>
              {m.game === 'knockout' && !row.out
                ? <div className="meta list-hearts" aria-label={row.meta}>{[0, 1, 2].map(k => <span key={k} className={k < m.view.lives[i] ? 'on' : ''}>{k < m.view.lives[i] ? '♥' : '♡'}</span>)}</div>
                : <div className="meta"><span>{row.meta}</span></div>}
            </div>
            <div className="score num">{row.value}</div>
          </div>
        );
      })}
    </div>
  );
}

// Drawn, not typed: in the condensed font an X's strokes don't cross at a right angle.
const MARK = [null, 1, 2, 3].map(n => n && (
  <svg width="0.8em" height="0.8em" viewBox="-12 -12 24 24" fill="none" stroke="currentColor" strokeWidth={n === 3 ? 2.6 : 3} strokeLinecap="round" aria-label={`${n} of 3`}>
    {n === 3 && <circle r="10.5" />}
    <path d={n === 3 ? 'M-5 5L5-5' : 'M-8 8L8-8'} />
    {n > 1 && <path d={n === 3 ? 'M-5-5L5 5' : 'M-8-8L8 8'} />}
  </svg>
));

export function CricketGrid({ m }: { m: Extract<MiniMatch, { game: 'cricket' }> }) {
  const v = m.view;
  return (
    <div className="cricket" style={{ gridTemplateColumns: `calc(110 * var(--u)) repeat(${m.roster.length}, minmax(0, 1fr))` }}>
      <span />
      {m.roster.map((r, i) => (
        <div key={i} className={`ch ${i === v.current ? 'active' : ''}`}>
          <span className="n">{r.name}</span>
          {!v.solo && <span className="num">{v.points[i]}</span>}
        </div>
      ))}
      {CRICKET_SECTORS.map((s, k) => (
        <div key={s} className={`crow ${v.dead[k] ? 'dead' : ''}`} style={{ display: 'contents' }}>
          <span className="sector num">{s === 25 ? 'Bull' : s}</span>
          {m.roster.map((_, i) => <span key={i} className={`mk num ${i === v.current ? 'active' : ''}`}>{MARK[v.marks[i][k]]}</span>)}
        </div>
      ))}
    </div>
  );
}

export function RecordIntro({ m, isPilot }: { m: MiniMatch; isPilot: boolean }) {
  const r = m.record!;
  return (
    <div className="overlay">
      <div className="result-card">
        <div className="kicker" style={{ color: 'var(--accent)' }}>OFFICE RECORD · {r.label.toUpperCase()}</div>
        {r.value ? (
          <>
            <div className="winner num" style={{ fontSize: 'calc(160 * var(--u))' }}>{r.value}</div>
            <div className="so-far">{r.by}{r.at ? ` · ${shortDate(r.at)}` : ''}</div>
          </>
        ) : <div className="winner">No record yet</div>}
        {isPilot
          ? <div className="actions"><button className="btn" onClick={() => act({ type: 'skipIntro' })}>Skip</button></div>
          : <div className="note">Game on in a moment.</div>}
      </div>
    </div>
  );
}

export function NewRecord({ m }: { m: MiniMatch }) {
  const n = m.newRecord;
  if (!n) return null;
  return (
    <div className="new-record">
      {n.office ? 'NEW OFFICE RECORD' : 'NEW PERSONAL BEST'}
      {n.personal.length > 0 && <span>{n.office ? 'Personal best: ' : ''}{n.personal.join(', ')}</span>}
    </div>
  );
}

export function MiniEnd({ m, isPilot }: { m: MiniMatch; isPilot: boolean }) {
  const v = m.view;
  const shared = v.winners.length !== 1;
  return (
    <div className="overlay">
      <div className="result-card">
        <div className="kicker">{v.winners.length > 1 ? 'SHARED WIN' : v.winners.length === 1 ? 'WINNER' : 'GAME OVER'}</div>
        <div className="winner">{winnersOf(m)}</div>
        <div className="so-far">{v.result}</div>
        <NewRecord m={m} />
        {isPilot ? (
          <div className="actions">
            <button className="btn primary" onClick={() => act({ type: 'closeMatch', then: 'summary' })}>Summary</button>
          </div>
        ) : <div className="note">{shared ? 'Well played. ' : ''}The summary opens from the pilot.</div>}
      </div>
    </div>
  );
}
