// Scoreboard parts for the minigames: hero, player list, game widgets, record screen and end screen.
import { LIVES } from '../../../games/121.ts';
import { CRICKET_SECTORS } from '../../../games/cricket.ts';
import { label, value } from '../../../games/darts.ts';
import { SECTORS } from '../../../games/race.ts';
import { Icon, act } from '../components/ui.tsx';
import { TargetBoard } from '../components/Dartboard.tsx';
import type { MiniMatch } from '../match.ts';
import { winnersOf } from '../match.ts';
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

/** 121 lives: full hearts left, empty ones lost. */
export function Hearts({ lives }: { lives: number }) {
  return (
    <div className="hearts" aria-label={`${lives} of ${LIVES} lives`}>
      {Array.from({ length: LIVES }, (_, i) => <span key={i} className={i < lives ? 'on' : ''}>{i < lives ? '♥' : '♡'}</span>)}
    </div>
  );
}

/** Checkout route, or setup darts for the next visit when no checkout is on. */
export function RouteHint({ checkout, setup }: { checkout: string | null; setup: string | null }) {
  if (!checkout && !setup) return null;
  return <div className={`hero-checkout ${checkout ? '' : 'setup'}`}><div className="caps">{checkout ? 'Checkout' : 'Setup'}</div><div className="num">{checkout ?? setup}</div></div>;
}

/** 121: darts left in the attempt, as a number and one pip per dart, grouped by visit. */
function AttemptTile({ left, of }: { left: number; of: number }) {
  return (
    <div className="attempt-tile">
      <div className="caps">Darts left in attempt</div>
      <div className="row">
        <div className="num">{left}</div>
        <div className="attempt-pips">
          {Array.from({ length: of / 3 }, (_, v) => (
            <div key={v}>{[0, 1, 2].map(i => <span key={i} className={v * 3 + i < of - left ? 'used' : ''} />)}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** ATC and Full Board put the board next to the hero (bug report 2026-10-27). */
export const hasBoard = (m: MiniMatch): m is Extract<MiniMatch, { game: 'atc' | 'fullboard' }> => m.game === 'atc' || m.game === 'fullboard';

function RaceBoard({ m }: { m: Extract<MiniMatch, { game: 'atc' | 'fullboard' }> }) {
  const v = m.view;
  const darts = v.visit.darts.map((d, i) => ({ dart: d.dart, good: v.visit.good[i] }));
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

export function MiniHero({ m, flash, onDart, canEdit }: { m: MiniMatch; flash: number | null; onDart: (i: number) => void; canEdit: boolean }) {
  const v = m.view;
  const visit = v.visit;
  const left = visit.dartsLeft === 0 && visit.darts.length ? 'Pull the darts' : `${visit.dartsLeft} ${visit.dartsLeft === 1 ? 'dart' : 'darts'} left`;
  const board = hasBoard(m);
  return (
    <section className={`hero ${board ? 'with-board' : ''}`}>
      <div className="hero-top">
        {Icon.play()}
        <div className="hero-name">{m.roster[v.current].name}</div>
        <div className="spacer" />
        {m.game === '121' && <Hearts lives={m.view.lives} />}
        <div className="hero-left">{left}</div>
      </div>
      <div className="hero-score-row">
        <div className="mini-big">
          <div className="caps">{v.hero.caption}</div>
          {m.game === 'fullboard'
            ? <div className="num">{m.view.cleared[v.current].length}<span className="of"> / {SECTORS.length}</span></div>
            : <div className={`num ${v.hero.big.length > 4 ? 'long' : ''}`}>{v.hero.big}</div>}
        </div>
        {m.game === '121' && <RouteHint checkout={m.view.checkout} setup={m.view.setup} />}
      </div>
      {board && <RaceBoard m={m} />}
      {m.game === 'hol' && <Scale lo={m.view.lo} hi={m.view.hi} sum={m.view.sum} />}
      {v.hero.note && <div className="hero-note">{v.hero.note}</div>}
      <div className="hero-darts">
        {[0, 1, 2].map(i => {
          const d = visit.darts[i];
          if (!d) {
            const addable = canEdit && i === visit.darts.length && visit.dartsLeft > 0 && v.phase === 'throwing';
            return addable
              ? <button key={i} className="dart-tile empty" onClick={() => onDart(i)}><span className="lbl">+ Add</span></button>
              : <div key={i} className="dart-tile empty" />;
          }
          const tile = <><span className="num">{label(d.dart)}</span><span className="lbl">{value(d.dart)}</span></>;
          const cls = `dart-tile ${visit.good[i] ? '' : 'dead'} ${flash === i ? 'flash' : ''}`;
          return canEdit
            ? <button key={`${i}-${flash}`} className={cls} onClick={() => onDart(i)} aria-label={`Fix dart ${i + 1}: ${label(d.dart)}`}>{tile}</button>
            : <div key={`${i}-${flash}`} className={cls}>{tile}</div>;
        })}
        {m.game === '121' && <AttemptTile left={m.view.attemptLeft} of={m.view.attemptDarts} />}
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
              <div className="meta"><span>{row.meta}</span></div>
            </div>
            <div className="score num">{row.value}</div>
          </div>
        );
      })}
    </div>
  );
}

const MARK = ['', '/', 'X', 'Ⓧ'];

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

export function MiniEnd({ m, isPilot, onNew }: { m: MiniMatch; isPilot: boolean; onNew: () => void }) {
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
            <button className="btn primary" onClick={() => act({ type: 'closeMatch', then: 'rematch' })}>Rematch</button>
            <button className="btn" onClick={onNew}>New match</button>
            <button className="btn" onClick={() => act({ type: 'closeMatch', then: 'lobby' })}>Back to lobby</button>
          </div>
        ) : <div className="note">{shared ? 'Well played.' : ''} Rematch, new match or lobby: choose on the pilot.</div>}
      </div>
    </div>
  );
}
