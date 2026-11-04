// Scoreboard parts for the minigames: hero, player list, game widgets, record screen and end screen.
import { useRef } from 'react';
import { LIVES } from '../../../games/121.ts';
import { CRICKET_SECTORS } from '../../../games/cricket.ts';
import { label } from '../../../games/darts.ts';
import { roundEndText } from '../../../games/knockout.ts';
import { SECTORS } from '../../../games/race.ts';
import { gameStats } from '../components/Compare.tsx';
import { DartFace } from '../components/DartFace.tsx';
import { Icon, act } from '../components/ui.tsx';
import { TargetBoard } from '../components/Dartboard.tsx';
import { Ladder, Odometer } from '../components/Ladder.tsx';
import type { MiniMatch } from '../match.ts';
import { dartTone, pickProps, playOrder, removedNote, winnersOf } from '../match.ts';
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
 * 121 and Knockout lives (3 in both): outline hearts, red while left and dim once lost. `losing` shakes the heart a failed attempt is
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
            {Icon.heart()}
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
 * 121: darts left in the attempt, as a number and one pip per dart, grouped by visit, in a card under the player list. The pips go green on a checkout
 * and flash red on a failed attempt, while the finished visit is held on screen; a new attempt's pips fade in.
 */
function AttemptTile({ left, of, end, attempt }: { left: number; of: number; end: 'out' | 'failed' | null; attempt: string }) {
  return (
    <div className="attempt-tile">
      <div className="row" aria-label="Darts left in attempt">
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
  const board = hasBoard(m);
  return (
    <section className={`hero ${board ? 'with-board' : ''} ${m.game === '121' ? 'with-ladder' : ''}`}>
      <div className="hero-top">
        {Icon.play()}
        <div className="hero-name">{m.roster[v.current].name}</div>
        <div className="spacer" />
        {m.game === '121' && <Hearts lives={m.view.lives} losing={attemptEnd(m) === 'failed'} />}
        {m.game === 'knockout' && <Hearts lives={m.view.lives[v.current]} />}
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
          const tile = <DartFace m={m} dart={d.dart} />;
          const cls = `dart-tile ${dartTone(m, visit.good[i])} ${flash === i ? 'flash' : ''}`;
          return canEdit
            ? <button key={`${i}-${flash}`} className={cls} onClick={() => onDart(i)} aria-label={`Fix dart ${i + 1}: ${label(d.dart)}`}>{tile}</button>
            : <div key={`${i}-${flash}`} className={cls}>{tile}</div>;
        })}
      </div>
    </section>
  );
}

/** 121 holds the finished visit until the takeout: no darts left in the attempt means it just ended, by a checkout or not. */
const attemptEnd = (m: Extract<MiniMatch, { game: '121' }>): 'out' | 'failed' | null =>
  m.view.attemptLeft === 0 && m.view.phase !== 'matchWon' ? (m.view.remaining === 0 ? 'out' : 'failed') : null;

/**
 * Under the player list, like X01's stats card: the current player's numbers for this match, the same ones as the summary,
 * and in 121 the darts left in the attempt first (docs/UI.md, Ekran wyników).
 */
export function MiniSide({ m }: { m: MiniMatch }) {
  const p = m.view.current;
  const stats = m.roster.length <= 4 ? gameStats(m.game, m.view.stats[p] ?? {}) : [];
  const n = stats.length + (m.game === '121' ? 1 : 0);
  if (n === 0) return null;
  return (
    <div className="card" style={{ flex: 1, minHeight: 0 }}>
      <div className="caps">{m.roster[p].name.toUpperCase()} · This match</div>
      <div className={`mstats few ${n > 2 ? 'three' : ''}`} style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: 'minmax(0, 1fr)' }}>
        {m.game === '121' && (
          <div>
            <span className="l">Darts left</span>
            <AttemptTile left={m.view.attemptLeft} of={m.view.attemptDarts} end={attemptEnd(m)} attempt={`${m.view.target}:${m.view.lives}`} />
          </div>
        )}
        {/* Three tiles leave no room for the small line under the number. */}
        {stats.map(([l, val, sub]) => <div key={l}><span className="l">{l}</span><span className="num">{val}</span>{sub && n < 3 && <span className="l">{sub}</span>}</div>)}
      </div>
    </div>
  );
}

export function MiniList({ m, onPick }: { m: MiniMatch; onPick?: (i: number) => void }) {
  const v = m.view;
  // Same as X01: full-size rows up to 4 players.
  const compact = m.roster.length > 4;
  return (
    <div className="plist">
      {playOrder(m).map(i => {
        const r = m.roster[i];
        const row = v.rows[i];
        const active = i === v.current && v.phase !== 'bulloff';
        const note = removedNote(m, i);
        return (
          <div key={i} className={`prow ${compact ? 'compact' : ''} ${active ? 'active' : ''} ${row.out || note ? 'out' : ''}`} {...pickProps(onPick, i, r.name)}>
            <div className="info">
              <div className="name">{r.name}</div>
              {note ? <div className="meta"><span>{note}</span></div>
                : m.game === 'knockout' && !row.out
                ? <div className="meta list-hearts" aria-label={row.meta}>{[0, 1, 2].map(k => <span key={k} className={k < m.view.lives[i] ? 'on' : ''}>{Icon.heart()}</span>)}</div>
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

export function CricketGrid({ m, onPick }: { m: Extract<MiniMatch, { game: 'cricket' }>; onPick?: (i: number) => void }) {
  const v = m.view;
  return (
    <div className="cricket" style={{ gridTemplateColumns: `calc(110 * var(--u)) repeat(${m.roster.length}, minmax(0, 1fr))` }}>
      <span />
      {playOrder(m).map(i => (
        <div key={i} className={`ch ${i === v.current ? 'active' : ''} ${v.removed[i] ? 'out' : ''}`} {...pickProps(onPick, i, m.roster[i].name)}>
          <span className="n">{m.roster[i].name}</span>
          {!v.solo && <span className="num">{v.points[i]}</span>}
          {v.removed[i] && <span className="left">Left</span>}
        </div>
      ))}
      {CRICKET_SECTORS.map((s, k) => (
        <div key={s} className={`crow ${v.dead[k] ? 'dead' : ''}`} style={{ display: 'contents' }}>
          <span className="sector num">{s === 25 ? 'Bull' : s}</span>
          {playOrder(m).map(i => <span key={i} className={`mk num ${i === v.current ? 'active' : ''} ${v.removed[i] ? 'out' : ''}`}>{MARK[v.marks[i][k]]}</span>)}
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
        {isPilot && <div className="actions"><button className="btn" onClick={() => act({ type: 'skipIntro' })}>Skip</button></div>}
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

/** Like X01's match end: kicker, winner, the game's result and the winner's numbers in big tiles (docs/UI.md, Start i koniec meczu). */
export function MiniEnd({ m, isPilot }: { m: MiniMatch; isPilot: boolean }) {
  const v = m.view;
  const tiles = v.winners.length === 1 ? gameStats(m.game, v.stats[v.winners[0]] ?? {}) : [];
  return (
    <div className="overlay">
      <div className="result-card">
        <div className="kicker">{v.winners.length > 1 ? 'SHARED WIN' : v.winners.length === 1 ? 'WINNER' : 'GAME OVER'}</div>
        <div className="winner">{winnersOf(m)}</div>
        <div className="so-far">{v.result}</div>
        {tiles.length > 0 && (
          <div className="result-grid" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
            {tiles.map(([l, val]) => <div key={l}><div className="l">{l}</div><div className="num">{val}</div></div>)}
          </div>
        )}
        <NewRecord m={m} />
        {isPilot && (
          <div className="actions">
            <button className="btn primary" onClick={() => act({ type: 'closeMatch', then: 'summary' })}>Summary</button>
          </div>
        )}
      </div>
    </div>
  );
}
