// Scoreboard parts for the minigames: hero, player list, game widgets, record screen and end screen.
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { LIVES } from '../../../games/121.ts';
import { GAMES } from '../../../games/index.ts';
import { label } from '../../../games/darts.ts';
import { KNOCKOUT_LIVES, roundEndText } from '../../../games/knockout.ts';
import { SECTORS } from '../../../games/race.ts';
import { gameStats } from '../components/Compare.tsx';
import { DartFace } from '../components/DartFace.tsx';
import { Icon, act } from '../components/ui.tsx';
import { TargetBoard } from '../components/Dartboard.tsx';
import { Ladder, Odometer } from '../components/Ladder.tsx';
import type { MiniMatch } from '../match.ts';
import { dartTone, initials, pickProps, playOrder, removedNote, turnPanel, visitScored, winnersOf } from '../match.ts';
import type { IntroPill } from '../records.ts';
import { introPills, ladderMarks, modalRows, ownRecord, recordPills, splitValue } from '../records.ts';
import { shortDate } from '../util.ts';

const TICKS = [0, 30, 60, 90, 120, 150, 180];

/**
 * Higher or Lower hero (docs/GRY.md#higher-or-lower): the visit sum stands like a pin over its spot on a 0–180 bar, red when the visit
 * fails. The bar is green outside the forbidden range and red inside it, with the range's edges big under the bar.
 */
function HolScale({ lo, hi, sum, failed }: { lo: number; hi: number; sum: number | null; failed: boolean }) {
  const pct = (n: number) => (Math.min(180, Math.max(0, n)) / 180) * 100;
  // Centred on its spot, but within the last 20% of the bar it slides to sit flush with the end, so nothing leaves the hero.
  const shift = (p: number) => (p < 50 ? -50 * Math.min(1, p / 20) : -50 - 50 * Math.max(0, (p - 80) / 20));
  const at = (n: number) => ({ left: `${pct(n)}%`, transform: `translateX(${shift(pct(n))}%)` });
  // The range always holds 26–45, so only small edges can crowd: push them apart around their middle.
  const mid = (lo + hi) / 2, gap = 12;
  const loAt = Math.min(lo, mid - gap), hiAt = Math.max(hi, mid + gap);
  const n = sum ?? 0;
  return (
    <div className={`hol-scale ${failed ? 'failed' : ''}`} aria-label={`Sum ${n}, forbidden range ${lo} to ${hi}`}>
      <div className="num pin-num" style={at(n)}>{n}</div>
      <div className="stem" style={at(n)} />
      <div className="bar">
        <div className="range" style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }} />
      </div>
      {TICKS.filter(t => Math.abs(t - loAt) > 18 && Math.abs(t - hiAt) > 18).map(t => <span key={t} className="tick num" style={at(t)}>{t}</span>)}
      <span className="edge num" style={at(loAt)}>{lo}</span>
      <span className="edge num" style={at(hiAt)}>{hi}</span>
      <span className="legend">Lose a life inside {lo}–{hi}</span>
    </div>
  );
}

/**
 * 121, Knockout and Higher or Lower lives (3 unless `max` says otherwise): outline hearts, red while left and dim once lost. `losing`
 * shakes the heart a failed attempt is about to take while the visit is still held on screen; hearts a refill gives back pop in (docs/GRY.md#121).
 */
export function Hearts({ lives, max = LIVES, losing = false }: { lives: number; max?: number; losing?: boolean }) {
  const prev = useRef(lives);
  const gained = lives > prev.current ? prev.current : lives;
  prev.current = lives;
  return (
    <div className="hearts" aria-label={`${lives} of ${max} lives`}>
      {Array.from({ length: max }, (_, i) => {
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

/**
 * Knockout: the round's lowest visit so far is the hero's big number, green once this visit is past it (bug report
 * 2026-10-30); the visit itself is This turn in the panel, like in every game. Before anyone has thrown: only "First to throw", no number.
 */
function ToBeat({ lowest, visit }: { lowest: number | null; visit: number }) {
  const safe = lowest !== null && visit > lowest;
  return (
    <div className={`mini-big ${safe ? 'safe' : ''}`}>
      <div className="caps">{lowest === null ? 'First to throw' : safe ? 'Beaten' : 'To beat'}</div>
      {lowest !== null && <div className="num">{lowest}</div>}
    </div>
  );
}

/** Checkout route, or setup darts for the next visit when no checkout is on. */
export function RouteHint({ checkout, setup }: { checkout: string | null; setup: string | null }) {
  if (!checkout && !setup) return null;
  const route = checkout ?? setup!;
  return <div className={`hero-checkout ${checkout ? '' : 'setup'} ${route.split('·').length > 2 ? 'long' : ''}`}><div className="caps">{checkout ? 'Checkout' : 'Setup'}</div><div className="num">{route}</div></div>;
}

/**
 * The hero's right half (variant D, DECISIONS.md), apart from the score by a line: This turn with the visit total big, grey
 * while it is 0, and under it the route, BUST or the score to beat. Without `total` only the lower part shows.
 */
export function TurnPanel({ total, children }: { total?: number; children?: ReactNode }) {
  return (
    <div className="panel">
      {total !== undefined && <div className="turn"><div className="caps">This turn</div><div className={`num ${total ? '' : 'zero'}`}>{total}</div></div>}
      {children}
    </div>
  );
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

type BoardGame = 'atc' | 'fullboard' | 'shanghai' | 'football' | 'bullseye' | 'freethrow' | 'cricket';

/** ATC and Full Board put the board next to the hero (bug report 2026-10-27); Cricket only with random sectors, to show which are in play. */
export const hasBoard = (m: MiniMatch): m is Extract<MiniMatch, { game: BoardGame }> =>
  m.game === 'atc' || m.game === 'fullboard' || m.game === 'shanghai' || m.game === 'football' || m.game === 'bullseye' || m.game === 'freethrow'
  || (m.game === 'cricket' && m.options.sectors === 'random');

function RaceBoard({ m }: { m: Extract<MiniMatch, { game: BoardGame }> }) {
  const v = m.view;
  const darts = v.visit.darts.map((d, i) => ({ dart: d.dart, good: v.visit.good[i], coords: d.coords }));
  // Cricket Random: the whole board in its colours; the sectors still in play (and the bull) are outlined, closed ones lose it.
  if (m.game === 'cricket') {
    const live = m.view.sectors.filter((_, k) => !m.view.dead[k]);
    return <TargetBoard cleared={[]} target={live} ring={null} still darts={darts} label={`Sectors in play: ${live.map(s => s === 25 ? 'Bull' : s).join(' · ')}`} />;
  }
  // Shanghai lights the round's sector; nothing is crossed off.
  if (m.game === 'shanghai') return <TargetBoard cleared={[]} target={m.view.sector} ring={null} darts={darts} label={`Round sector ${m.view.sector}`} />;
  // Free throw has no target: the board only shows where the darts stuck.
  if (m.game === 'freethrow') return <TargetBoard cleared={[]} target={null} ring={null} darts={darts} label="No target" />;
  if (m.game === 'bullseye') return <TargetBoard cleared={[]} target={25} ring={null} darts={darts} label="Aim for the bull" />;
  // Football: the bull wins the ball (only the bullseye with Bull only); with the ball, the doubles or the big singles of four sectors score.
  if (m.game === 'football') {
    if (m.view.ball === v.current && m.view.sectors) {
      return <TargetBoard cleared={[]} target={m.view.sectors} ring={1} darts={darts} label={`Big singles ${m.view.sectors.join(' · ')} score`} />;
    }
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
  if (m.game === 'killer') return m.view.killer[m.view.current] ? 'Hit a rival double' : 'Hit your double to become a killer';
  if (m.game === 'knockout' && m.view.visit.darts.length === 0) return knockoutNote(m) ?? m.view.hero.note;
  if (m.game === 'football' && m.view.ball !== null && m.view.ball !== m.view.current) {
    return `${m.roster[m.view.ball].name} has the ball · hit ${m.options.kickOff === 'any' ? 'the bull' : 'the bullseye'}`;
  }
  return gotchaNote(m) ?? m.view.hero.note;
}

/** The best result the player throwing can still reach, when the game tells (docs/GRY.md#rekordy-i-ekran-rekordu). */
const recordBound = (m: MiniMatch): number | null => GAMES[m.game].record?.bound?.(m.view, m.view.current, m.options) ?? null;

/**
 * Top right of the hero: the office record over the player's PB (co-op: Team best), or one merged pill, greyed and struck
 * through once out of reach. One button for the records modal. 121 shows them as ladder flags instead.
 */
function RecordPills({ m, onOpen }: { m: MiniMatch; onOpen?: () => void }) {
  const pills = recordPills(m.record!, m.roster, m.view.current, recordBound(m));
  const text = pills.map(p => `${p.label} ${p.value ?? 'none'}${p.out ? ' out of reach' : ''}`).join(', ');
  return (
    <button className="rpills" aria-label={`Records: ${text}`} onClick={onOpen}>
      {pills.map(p => <span key={p.kind} className={`rp ${p.kind} ${p.out ? 'out' : ''}`}>{p.label} <b className="num">{p.value ?? '–'}</b></span>)}
    </button>
  );
}

export function MiniHero({ m, flash, onDart, canEdit, onRecords }: { m: MiniMatch; flash: number | null; onDart: (i: number) => void; canEdit: boolean; onRecords?: () => void }) {
  const v = m.view;
  const visit = v.visit;
  const board = hasBoard(m);
  const split = turnPanel(m) && !board;
  // Cricket from 5 players: the columns show a place number, the names stand here (A#3).
  const legend = m.game === 'cricket' && m.roster.length > 4;
  return (
    <section className={`hero ${board ? 'with-board' : ''} ${m.game === '121' ? 'with-ladder' : ''} ${split ? 'split' : ''} ${legend ? 'with-legend' : ''}`}>
      <div className="hero-top">
        {Icon.play()}
        <div className="hero-name">{m.roster[v.current].name}</div>
        <div className="spacer" />
        {m.game === '121' && <Hearts lives={m.view.lives} losing={attemptEnd(m) === 'failed'} />}
        {m.game === 'knockout' && <Hearts lives={m.view.lives[v.current]} />}
        {m.game === 'hol' && <Hearts lives={m.view.lives[v.current]} max={m.view.maxLives} losing={m.view.losing} />}
        {m.game === 'killer' && <Hearts lives={m.view.lives[v.current]} max={m.options.lives} />}
      </div>
      {m.record && m.game !== '121' && <RecordPills m={m} onOpen={onRecords} />}
      {m.game === 'hol' ? <HolScale lo={m.view.lo} hi={m.view.hi} sum={m.view.sum} failed={m.view.failed} /> : <div className="hero-score-row">
        {m.game === 'knockout' ? <ToBeat lowest={m.view.lowest} visit={m.view.visitScore} /> : <div className="mini-big">
          <div className={`caps ${m.game === 'killer' && m.view.killer[v.current] ? 'killer' : ''}`}>{m.game === '121' ? <>Target <Odometer value={m.view.target} /></> : v.hero.caption}</div>
          {m.game === 'fullboard'
            ? <div className="num">{m.view.cleared[v.current].length}<span className="of"> / {SECTORS.length}</span></div>
            : <div className={`num ${v.hero.big.length > 4 ? 'long' : ''}`}>{v.hero.big}</div>}
        </div>}
      </div>}
      {split && (
        <TurnPanel total={visitScored(m) ?? 0}>
          {(m.game === '121' || m.game === 'randomco') && <RouteHint checkout={m.view.checkout} setup={m.view.setup} />}
        </TurnPanel>
      )}
      {legend && (
        <div className="legend">
          {playOrder(m).map((i, k) => (
            <div key={i} className={i === v.current ? 'on' : ''}><span className="n num">{k + 1}</span><span className="who">{m.roster[i].name}</span></div>
          ))}
        </div>
      )}
      {board && <RaceBoard m={m} />}
      {m.game === '121' && <Ladder target={m.view.target} marks={ladderMarks(m.record, m.roster)} onOpen={onRecords} />}
      {m.game !== 'hol' && heroNote(m) && <div className="hero-note">{heroNote(m)}</div>}
      <div className="hero-darts">
        {[0, 1, 2].map(i => {
          const d = visit.darts[i];
          if (!d) {
            const addable = canEdit && i === visit.darts.length && visit.dartsLeft > 0 && v.phase === 'throwing';
            return addable
              ? <button key={i} className="dart-tile empty" onClick={() => onDart(i)}><span className="lbl">+ Add</span></button>
              : <div key={i} className="dart-tile empty" />;
          }
          const tile = <DartFace m={m} rec={d} />;
          const cls = `dart-tile ${dartTone(m, visit.good[i], d)} ${flash === i ? 'flash' : ''}`;
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
      {/* More than three numbers (Free throw) take the 3×2 grid of X01 instead of one narrow row. */}
      <div className={n > 3 ? 'mstats' : `mstats few ${n > 2 ? 'three' : ''}`} style={n > 3 ? undefined : { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: 'minmax(0, 1fr)' }}>
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
  // Small hearts under the name in the games with lives per player.
  const hearts = m.game === 'knockout' ? { lives: m.view.lives, max: KNOCKOUT_LIVES } : m.game === 'hol' ? { lives: m.view.lives, max: m.view.maxLives }
    : m.game === 'killer' ? { lives: m.view.lives, max: m.options.lives } : null;
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
                : hearts && !row.out
                ? <div className="meta list-hearts" aria-label={row.meta}>{Array.from({ length: hearts.max }, (_, k) => <span key={k} className={k < hearts.lives[i] ? 'on' : ''}>{Icon.heart()}</span>)}{m.game === 'killer' && m.view.killer[i] && <b className="tag">Killer</b>}</div>
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
  const many = m.roster.length > 4;
  return (
    <div className={`cricket ${many ? 'many' : ''}`} style={{ gridTemplateColumns: `calc(110 * var(--u)) repeat(${m.roster.length}, minmax(0, 1fr))` }}>
      <span />
      {playOrder(m).map((i, k) => (
        <div key={i} className={`ch ${i === v.current ? 'active' : ''} ${v.removed[i] ? 'out' : ''}`} {...pickProps(onPick, i, m.roster[i].name)}>
          {many ? <><span className="no num">{k + 1}</span><span className="ini">{initials(m.roster[i].name)}</span></> : <span className="n">{m.roster[i].name}</span>}
          {!v.solo && <span className="num">{v.points[i]}</span>}
          {v.removed[i] && <span className="left">Left</span>}
        </div>
      ))}
      {v.sectors.map((s, k) => (
        <div key={s} className={`crow ${v.dead[k] ? 'dead' : ''}`} style={{ display: 'contents' }}>
          <span className="sector num">{s === 25 ? 'Bull' : s}</span>
          {playOrder(m).map(i => <span key={i} className={`mk num ${i === v.current ? 'active' : ''} ${v.removed[i] ? 'out' : ''}`}>{MARK[v.marks[i][k]]}</span>)}
        </div>
      ))}
    </div>
  );
}

/** The record screen's pill: PB or Team, the number, who and when. */
function BigPill({ p }: { p: IntroPill }) {
  return (
    <div className={`rp ${p.kind}`}>
      {p.label}{p.value !== null || p.kind !== 'both' ? <b className="num">{p.value ?? '–'}</b> : null}
      <span className="nm">{p.who}</span>
      {p.when !== null && <i>{p.when === 'first' ? 'First game' : shortDate(p.when)}</i>}
    </div>
  );
}

export function RecordIntro({ m, isPilot }: { m: MiniMatch; isPilot: boolean }) {
  const r = m.record!;
  const own = introPills(r, m.roster);
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
        {own.pills.length > 0 && <div className={`big-pills ${own.two ? 'two' : ''}`}>{own.pills.map(p => <BigPill key={p.who} p={p} />)}</div>}
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
      {n.office ? 'NEW OFFICE RECORD' : n.team ? 'NEW TEAM BEST' : 'NEW PERSONAL BEST'}
      {n.personal.length > 0 && <span>{n.office ? 'Personal best: ' : ''}{n.personal.join(', ')}</span>}
    </div>
  );
}

/** A row of the records modal: what it is, who, the number with its unit, and when. */
function ModalRow({ cls = '', label, who, value, when, now = false }: { cls?: string; label: string; who: string; value: string | null; when: string; now?: boolean }) {
  const [n, unit] = value ? splitValue(value) : ['–', ''];
  return (
    <div className={`mrow ${cls}`}>
      <div className="lab"><div className="caps">{label}</div><div className="who">{who}{now && <span className="tagnow">Throwing</span>}</div></div>
      <div className="v"><span className="num">{n}</span>{unit && <span className="u">{unit}</span>}</div>
      <div className="when">{when}</div>
    </div>
  );
}

/**
 * The records of the variant on demand, from the record pills or a 121 ladder flag (docs/UI.md#rekordy-w-trakcie-gry): the office
 * record, the PB of the player (of every player, the one throwing marked) or the co-op Team best, and the office top 5 with
 * the player's or lineup's row marked, its place under a gap when it is lower. X or a tap outside the card closes it.
 */
export function RecordModal({ m, onClose }: { m: MiniMatch; onClose: () => void }) {
  const r = m.record!;
  const p = m.view.current;
  const own = ownRecord(r, m.roster, p);
  const merged = own?.res?.place === 1;
  const date = (at: number | null | undefined) => (at ? shortDate(at) : 'First game');
  const many = !r.coop && m.roster.length > 1;
  const rows = modalRows(r, m.roster, p);
  return (
    <div className="overlay records" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={`Records · ${r.label}`}>
        <button className="x" aria-label="Close" onClick={onClose}>{Icon.close()}</button>
        <div><div className="caps kick">Records</div><h2>{r.label}</h2></div>
        <div className="cols">
          <div className="col">
            <ModalRow cls={`best ${merged ? 'me' : ''}`} label={merged ? `Office best · ${own!.label}` : 'Office best'} who={r.by ?? 'No record yet'} value={r.value} when={r.at ? shortDate(r.at) : ''} />
            {!many && own && !merged && (
              <ModalRow label={own.label === 'Team' ? 'Team best' : 'PB'} who={own.res?.by ?? (r.coop ? m.roster.map(x => x.name).join(' & ') : m.roster[p].name)} value={own.res?.value ?? null} when={date(own.res?.at)} />
            )}
            {!own && <div className="foot left">{r.coop ? 'Co-op with a guest keeps no Team best.' : 'Guests have no PB.'}</div>}
            {many && (
              <>
                <div className="caps sec">PB · this match</div>
                {playOrder(m).map(i => {
                  const guest = m.roster[i].playerId === null, res = r.personal[i];
                  return <ModalRow key={i} cls={`small ${i === p ? 'me' : ''}`} label="PB" who={m.roster[i].name} value={res?.value ?? null} when={guest ? 'Guest' : date(res?.at)} now={i === p} />;
                })}
              </>
            )}
          </div>
          <div className="col">
            <div className="caps sec">{r.coop ? 'Office top 5 · teams' : 'Office top 5'}</div>
            <div className="top5">
              {rows.length === 0 && <div className="trow gap">No results yet</div>}
              {rows.map(t => (t === 'gap' ? <div key="gap" className="trow gap">⋯</div> : (
                <div key={t.place} className={`trow ${t.me ? 'me' : ''} ${t.place === 1 ? 'first' : ''}`}>
                  <span className="rk">{t.place}</span><span className="nm">{t.by}</span><span className="num">{splitValue(t.value)[0]}</span><span className="when">{shortDate(t.at)}</span>
                </div>
              )))}
            </div>
          </div>
        </div>
        <div className="foot">Tap outside to close</div>
      </div>
    </div>
  );
}

/** Like X01's match end: kicker, winner, the game's result and the winner's numbers in big tiles (docs/UI.md, Start i koniec meczu). */
export function MiniEnd({ m, isPilot }: { m: MiniMatch; isPilot: boolean }) {
  const v = m.view;
  // Free throw has no winner, but its one player's numbers are the result.
  const who = v.winners.length === 1 ? v.winners[0] : m.game === 'freethrow' ? 0 : null;
  const tiles = who === null ? [] : gameStats(m.game, v.stats[who] ?? {});
  return (
    <div className="overlay">
      <div className="result-card">
        <div className="kicker">{v.winners.length > 1 ? 'SHARED WIN' : v.winners.length === 1 ? 'WINNER' : 'GAME OVER'}</div>
        <div className="winner">{winnersOf(m)}</div>
        <div className="so-far">{v.result}</div>
        {tiles.length > 0 && (
          <div className="result-grid" style={{ gridTemplateColumns: `repeat(${Math.min(3, tiles.length)}, minmax(0, 1fr))` }}>
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
