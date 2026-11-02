import { useId } from 'react';
import type { BullOffView, BullThrow } from '../../../games/bulloff.ts';
import { standings } from '../../../games/bulloff.ts';
import { BOARD_ORDER, label } from '../../../games/darts.ts';
import type { LiveMatch } from '../../../server/protocol.ts';
import { act } from './ui.tsx';
import { arc } from './Dartboard.tsx';

// Real board sizes in mm, colours as on the Dartboard keypad.
const BULL_MM = 6.35, OUTER_MM = 15.9;
const BANDS: [number, number, boolean][] = [[OUTER_MM, 99, false], [99, 107, true], [107, 162, false], [162, 170, true]];
const LEAD = '#F58224', TIE = '#F5B83D', OTHER = '#F5F5F5';

const mmText = (mm: number | null) => (mm === null ? '–' : `${mm.toFixed(1)} mm`);
const byMm = (a: BullThrow, z: BullThrow) => (a.mm ?? Infinity) - (z.mm ?? Infinity);
const names = (m: LiveMatch, ps: number[]) => {
  const n = ps.map(p => m.roster[p].name);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} and ${n.at(-1)}` : n[0];
};

/**
 * What the bull-off screen shows (docs/UI.md, Bull-off z tarczy). Right after a tie the darts of that round
 * stay on the board until the takeout, so the screen keeps showing that round.
 */
function scene(m: LiveMatch, b: BullOffView) {
  const tie = b.winner === null && b.round > 0 && m.bullTakeout && !b.throws.some(t => t.round === b.round);
  const round = tie ? b.round - 1 : b.round;
  const shown = b.throws.filter(t => t.round === round).sort(byMm);
  const tied = tie ? b.contenders : [];
  return { tie, round, shown, tied, lead: tie ? null : shown[0]?.player ?? null };
}

/** How the tied leaders of the round before this one were apart: “3.8 mm”, or the bed they shared under PDC. */
function tieText(b: BullOffView, round: number, ties: number[]) {
  const ts = b.throws.filter(t => t.round === round && ties.includes(t.player));
  const mm = ts.map(t => t.mm).filter((x): x is number => x !== null);
  const gap = mm.length === ts.length ? Math.max(...mm) - Math.min(...mm) : null;
  const best = [...ts].sort(byMm)[0];
  const bed = b.rule === 'pdc' && best?.dart.n === 25 && ts.every(t => t.dart.n === 25 && t.dart.m === best.dart.m) ? label(best.dart) : null;
  return { gap, bed };
}

/** Headline and the line under it. */
export function bullStatus(m: LiveMatch, b: BullOffView): { tone: '' | 'tie' | 'done'; main: string; sub: string } {
  const name = (p: number) => m.roster[p].name;
  const s = scene(m, b);
  if (b.winner !== null) return { tone: 'done', main: `${name(b.winner)} starts`, sub: m.bullTakeout ? 'Take out the dart' : '' };
  if (s.tie) {
    const { gap, bed } = tieText(b, s.round, s.tied);
    return { tone: 'tie', main: bed ? `Tie in the ${bed}` : gap !== null && gap > 0 ? `Too close: ${gap.toFixed(1)} mm` : 'Tie', sub: `${names(m, s.tied)} throw again · take out the dart` };
  }
  if (m.bullTakeout) return { tone: '', main: 'Take out the dart', sub: `${name(b.next!)} next` };
  let sub = '';
  if (b.round > 0) {
    const { gap, bed } = tieText(b, b.round - 1, b.contenders);
    const vs = b.contenders.map(name).join(' vs ');
    sub = bed ? `Rethrow: ${vs} were both in the ${bed}` : gap !== null ? `Rethrow: ${vs} were ${gap.toFixed(1)} mm apart` : `Rethrow: ${vs}`;
  }
  return { tone: '', main: `${name(b.next!)}, throw at the bull`, sub };
}

interface Box { x0: number; y0: number; x1: number; y1: number }
const hits = (a: Box, z: Box) => a.x0 < z.x1 && z.x0 < a.x1 && a.y0 < z.y1 && z.y0 < a.y1;

/** Puts each name next to its dart where it overlaps no other name or dart: above, below, right, left, then further up. */
function placeLabels(darts: { x: number; y: number; name: string }[], R: number, fs: number, dot: number) {
  const dots = darts.map(d => ({ x0: d.x - dot, y0: d.y - dot, x1: d.x + dot, y1: d.y + dot }));
  const placed: Box[] = [];
  return darts.map(d => {
    const w = d.name.length * fs * 0.6, gap = dot + fs * 0.25;
    const tries: { x: number; y: number; anchor: 'middle' | 'start' | 'end'; box: Box }[] = [];
    const add = (cx: number, top: number, anchor: 'middle' | 'start' | 'end') => {
      const x0 = anchor === 'middle' ? cx - w / 2 : anchor === 'start' ? cx : cx - w;
      tries.push({ x: cx, y: top + fs * 0.8, anchor, box: { x0, y0: top, x1: x0 + w, y1: top + fs } });
    };
    add(d.x, d.y - gap - fs, 'middle');
    add(d.x, d.y + gap, 'middle');
    add(d.x + gap, d.y - fs / 2, 'start');
    add(d.x - gap, d.y - fs / 2, 'end');
    for (let k = 1; k <= 6; k++) add(d.x, d.y - gap - fs * (1 + k * 1.05), 'middle');
    const inside = (b: Box) => [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]].every(([x, y]) => Math.hypot(x, y) < R * 0.97);
    const free = (b: Box) => !placed.some(p => hits(p, b)) && !dots.some(p => hits(p, b));
    const pick = tries.find(t => free(t.box) && inside(t.box)) ?? tries.find(t => free(t.box)) ?? tries[0];
    placed.push(pick.box);
    return pick;
  });
}

/** The bull close up, cut to a circle: the treble ring just fits, a wild dart zooms out up to the whole board. */
export function BullZoom({ m, b }: { m: LiveMatch; b: BullOffView }) {
  const clip = useId();
  const { shown, tied, lead } = scene(m, b);
  const far = Math.max(0, ...shown.map(t => t.mm ?? 0));
  const R = Math.min(185, Math.max(112, far * 1.1));
  const color = (p: number) => (tied.includes(p) ? TIE : p === lead ? LEAD : OTHER);
  const strong = (p: number) => tied.includes(p) || p === lead;
  const fs = R * 0.09, dot = R * 0.03;
  const darts = shown.filter(t => t.coords).map(t => ({ t, x: t.coords!.x * 170, y: -t.coords!.y * 170, name: m.roster[t.player].name }));
  const labels = placeLabels(darts, R, fs, dot);
  return (
    <svg className="bull-zoom" viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} role="img" aria-label="Bull-off darts around the bull">
      <clipPath id={clip}><circle r={R} /></clipPath>
      <g clipPath={`url(#${clip})`}>
        <circle r={R} fill="#141416" />
        {BOARD_ORDER.map((n, k) => BANDS.map(([r1, r2, ring]) => (
          <path key={`${n}-${r1}`} d={arc(r1, r2, k * 18 - 9, k * 18 + 9)} stroke="#0A0A0B" strokeWidth={R / 300}
            fill={ring ? (k % 2 === 0 ? '#B8322F' : '#1F8A52') : k % 2 === 0 ? '#232327' : '#4A4A50'} />
        )))}
        <circle r={OUTER_MM} fill="#1F8A52" stroke="#0A0A0B" strokeWidth={R / 300} />
        <circle r={BULL_MM} fill="#B8322F" stroke="#0A0A0B" strokeWidth={R / 300} />
        {/* Each dart's distance as a ring: the next dart has to land inside the leader's ring to win. */}
        {shown.filter(t => t.mm !== null).map(t => (
          <circle key={`ring${t.player}`} r={t.mm!} fill="none" stroke={color(t.player)} strokeOpacity={strong(t.player) ? 1 : 0.5}
            strokeWidth={R / 200} strokeDasharray={`${R / 50} ${R / 70}`} />
        ))}
        {darts.map(({ t, x, y }) => (
          <circle key={`dot${t.player}`} cx={x} cy={y} r={dot} fill={color(t.player)} stroke="#0A0A0B" strokeWidth={R / 150} />
        ))}
        {darts.map(({ t, name }, i) => (
          <text key={`name${t.player}`} x={labels[i].x} y={labels[i].y} fill={color(t.player)} fontSize={fs} fontWeight="700" textAnchor={labels[i].anchor}
            fontFamily="Inter, sans-serif" stroke="#0A0A0B" strokeWidth={R / 110} paintOrder="stroke">{name}</text>
        ))}
      </g>
    </svg>
  );
}

/** This round by distance, then who has yet to throw, then those out from earlier rounds; once decided, the playing order. */
function BullRows({ m, b }: { m: LiveMatch; b: BullOffView }) {
  const name = (p: number) => m.roster[p].name;
  if (b.order) {
    return (
      <div className="bull-rows">
        {b.order.map((p, i) => (
          <div key={p} className={`bull-row ${i === 0 ? 'lead' : ''}`}>
            <span className="pl num">{i + 1}.</span><span className="who">{name(p)}</span><span className="fd">{i === 0 ? 'starts' : ''}</span><span className="mm num">&nbsp;</span>
          </div>
        ))}
      </div>
    );
  }
  const s = scene(m, b);
  const inRound = new Set(s.shown.map(t => t.player));
  const waiting = s.tie ? [] : b.contenders.filter(p => !inRound.has(p));
  const earlier = s.round > 0 ? standings(b.throws.filter(t => t.round < s.round), m.roster.length).filter(p => !inRound.has(p) && !b.contenders.includes(p)) : [];
  const last = (p: number) => b.throws.filter(t => t.player === p).at(-1)!;
  return (
    <div className="bull-rows">
      {s.shown.map((t, i) => (
        <div key={t.player} className={`bull-row ${s.tied.includes(t.player) ? 'tie' : t.player === s.lead ? 'lead' : ''}`}>
          <span className="pl num">{i + 1}.</span><span className="who">{name(t.player)}</span><span className="fd">{label(t.dart)}</span><span className="mm num">{mmText(t.mm)}</span>
        </div>
      ))}
      {waiting.map(p => (
        <div key={p} className={`bull-row wait ${p === b.next && !m.bullTakeout ? 'now' : ''}`}>
          <span className="pl">{p === b.next ? '▶' : ''}</span><span className="who">{name(p)}</span><span className="fd" /><span className="mm num">–</span>
        </div>
      ))}
      {earlier.map(p => (
        <div key={p} className="bull-row out">
          <span className="pl" /><span className="who">{name(p)}</span><span className="fd">round {last(p).round + 1}</span><span className="mm num">{mmText(last(p).mm)}</span>
        </div>
      ))}
    </div>
  );
}

/** The whole bull-off: kicker, status, board, list and the pilot's “X starts” picks. Laid out by CSS for the kiosk and the phone. */
export function BullOffPanel({ m, b, picks }: { m: LiveMatch; b: BullOffView; picks: boolean }) {
  const st = bullStatus(m, b);
  const { round } = scene(m, b);
  return (
    <div className="bulloff">
      <div className="bo-kicker">BULL-OFF{round > 0 ? ` · ROUND ${round + 1}` : ''}</div>
      <div className={`bo-status ${st.tone}`}>
        <div className={`main ${st.main.length > 24 ? 'long' : ''}`}>{st.main}</div>
        <div className={`sub ${st.sub.length > 48 ? 'long' : ''}`}>{st.sub}</div>
      </div>
      <div className="bo-board"><BullZoom m={m} b={b} /></div>
      <div className="bo-list">
        <div className="bo-caption">{b.order ? 'PLAYING ORDER' : ''}</div>
        <BullRows m={m} b={b} />
      </div>
      {picks && b.winner === null && (
        <div className="bo-picks">
          <span className="hint">Detection wrong? Pick who starts:</span>
          {m.roster.map((r, i) => <button key={i} className="btn" onClick={() => act({ type: 'bullOff', starter: i })}>{r.name} starts</button>)}
        </div>
      )}
    </div>
  );
}
