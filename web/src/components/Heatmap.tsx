import type { PointerEvent } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { BOARD_ORDER } from '../../../games/darts.ts';
import type { PlayerHeat } from '../../../games/report.ts';

// Board like Autodarts (docs/UI.md, Heatmapa). Board units: 1 = 170 mm, the outer edge of the double.
const R = { bull: 6.35 / 170, obull: 15.9 / 170, tIn: 99 / 170, tOut: 107 / 170, dIn: 162 / 170, dOut: 1, nums: 1.19, face: 1.32, rim: 1.36 };
const W = 600, C = W / 2, S = C / (R.rim + 0.02);
const COL = { black: '#03050b', cream: '#ead5c6', red: '#e3284f', green: '#00915a', wire: '#8e9ab0', face: '#0c0e13', num: '#7f8590' };

// Heat: a lone dart peaks green with a blue fringe; overlapping darts go yellow, then red.
const SPOT = 0.042;
const PEAK = 0.62;
const STOPS: [number, string][] = [[0, '#5a20ff'], [0.2, '#2050ff'], [0.3, '#00c8ff'], [0.4, '#40ff80'], [0.48, '#c8ff60'], [0.62, '#ffff00'], [0.78, '#ff9000'], [1, '#ff0000']];

let ramp: Uint8ClampedArray | null = null;
function colours(): Uint8ClampedArray {
  if (ramp) return ramp;
  const x = document.createElement('canvas').getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 256, 0);
  for (const [o, c] of STOPS) g.addColorStop(o, c);
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 1);
  return (ramp = x.getImageData(0, 0, 256, 1).data);
}

function paint(canvas: HTMLCanvasElement, darts: [number, number][]) {
  const x = canvas.getContext('2d')!, r = SPOT * S, v = new Float32Array(W * W);
  for (const [dx, dy] of darts) {
    const px = C + dx * S, py = C - dy * S;
    for (let yy = Math.max(0, Math.floor(py - r)); yy <= Math.min(W - 1, py + r + 1); yy++)
      for (let xx = Math.max(0, Math.floor(px - r)); xx <= Math.min(W - 1, px + r + 1); xx++) {
        const d2 = ((xx - px) ** 2 + (yy - py) ** 2) / (r * r);
        if (d2 < 1) v[yy * W + xx] += PEAK * Math.exp(-3.2 * d2);
      }
  }
  const ramp = colours(), img = x.createImageData(W, W), d = img.data;
  for (let i = 0; i < v.length; i++) {
    // Squashed so a crowded treble still shows its shape instead of one red blob.
    const h = 1 - Math.exp(-1.3 * v[i]);
    if (h < 0.02) continue;
    const k = (Math.min(255, h * 255) | 0) * 4;
    d[i * 4] = ramp[k];
    d[i * 4 + 1] = ramp[k + 1];
    d[i * 4 + 2] = ramp[k + 2];
    d[i * 4 + 3] = 255 * Math.min(1, h / 0.4) ** 0.9;
  }
  x.putImageData(img, 0, 0);
}

const P = (r: number, a: number) => [C + r * S * Math.cos(a), C - r * S * Math.sin(a)] as const;
function wedge(r1: number, r2: number, i: number) {
  const a1 = Math.PI / 2 - ((i * 18 - 9) * Math.PI) / 180, a2 = Math.PI / 2 - ((i * 18 + 9) * Math.PI) / 180;
  const [x1, y1] = P(r2, a1), [x2, y2] = P(r2, a2), [x3, y3] = P(r1, a2), [x4, y4] = P(r1, a1);
  return `M${x1} ${y1}A${r2 * S} ${r2 * S} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${r1 * S} ${r1 * S} 0 0 0 ${x4} ${y4}Z`;
}

function Board() {
  const wire = { stroke: COL.wire, strokeWidth: 0.7 };
  return (
    <>
      <circle cx={C} cy={C} r={R.face * S} fill={COL.face} />
      {BOARD_ORDER.map((n, i) => {
        const dark = i % 2 === 0, single = dark ? COL.black : COL.cream, ring = dark ? COL.red : COL.green;
        const a = Math.PI / 2 - (i * Math.PI) / 10, [lx, ly] = P(R.nums, a);
        let rot = 90 - (a * 180) / Math.PI;
        if (rot > 90 && rot < 270) rot -= 180;
        return (
          <g key={n}>
            {([[R.obull, R.tIn, single], [R.tIn, R.tOut, ring], [R.tOut, R.dIn, single], [R.dIn, R.dOut, ring]] as const).map(([r1, r2, f], j) => (
              <path key={j} d={wedge(r1, r2, i)} fill={f} {...wire} />
            ))}
            <text x={lx} y={ly} fill={COL.num} fontFamily="Barlow Condensed, Inter, sans-serif" fontWeight={600} fontSize={0.2 * S}
              textAnchor="middle" dominantBaseline="central" transform={`rotate(${rot} ${lx} ${ly})`}>{n}</text>
          </g>
        );
      })}
      <circle cx={C} cy={C} r={R.obull * S} fill={COL.green} {...wire} />
      <circle cx={C} cy={C} r={R.bull * S} fill={COL.red} {...wire} />
    </>
  );
}

function Layer({ darts, clip }: { darts: [number, number][]; clip: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    c.getContext('2d')!.clearRect(0, 0, W, W);
    paint(c, darts);
  }, [darts]);
  return <canvas ref={ref} width={W} height={W} style={{ clipPath: clip }} />;
}

export interface HeatPlayer {
  name: string;
  color: string;
  heat: PlayerHeat;
}

/**
 * One board; with two or more players a line splits it: the left player's darts left of the line, the right one's to the right.
 * With more than two, pickers choose the pair.
 */
export function Heatmap({ players }: { players: HeatPlayer[] }) {
  const [pair, setPair] = useState<[number, number]>([0, 1]);
  const [pos, setPos] = useState(0.5);
  const id = 'h' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const split = players.length > 1;
  const a = players[Math.min(pair[0], players.length - 1)], b = split ? players[Math.min(pair[1], players.length - 1)] : null;
  const shown = b ? [a, b] : [a];
  const missing = shown.filter(p => p.heat.noPos > 0);

  const drag = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setPos(Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)));
  };
  const x = pos * W;
  const pct = `${pos * 100}%`;
  const picker = (side: 0 | 1) => {
    const p = side ? b! : a;
    return (
      <label className="heat-pick">
        <i style={{ background: p.color }} />
        {players.length > 2 ? (
          <select value={pair[side]} onChange={e => setPair(side ? [pair[0], Number(e.target.value)] : [Number(e.target.value), pair[1]])}>
            {players.map((q, i) => <option key={i} value={i}>{q.name}</option>)}
          </select>
        ) : <span>{p.name}</span>}
      </label>
    );
  };

  if (shown.every(p => p.heat.darts.length === 0)) return <p className="muted heat-empty">No positions recorded</p>;
  return (
    <div className="heatmap">
      <div className="heat-board" onPointerDown={split ? e => { e.currentTarget.setPointerCapture(e.pointerId); drag(e); } : undefined}
        onPointerMove={split ? e => e.buttons && drag(e) : undefined}>
        <svg viewBox={`0 0 ${W} ${W}`}>
          <defs>
            <clipPath id={`${id}l`}><rect x={0} y={0} width={split ? x : W} height={W} /></clipPath>
            <clipPath id={`${id}r`}><rect x={x} y={0} width={W - x} height={W} /></clipPath>
          </defs>
          <circle cx={C} cy={C} r={R.rim * S} fill="none" stroke={a.color} strokeWidth={0.035 * S} clipPath={`url(#${id}l)`} />
          {b && <circle cx={C} cy={C} r={R.rim * S} fill="none" stroke={b.color} strokeWidth={0.035 * S} clipPath={`url(#${id}r)`} />}
          <Board />
        </svg>
        <Layer darts={a.heat.darts} clip={b ? `inset(0 calc(100% - ${pct}) 0 0)` : 'none'} />
        {b && <Layer darts={b.heat.darts} clip={`inset(0 0 0 ${pct})`} />}
        {b && <div className="heat-line" style={{ left: pct }}><span>↔</span></div>}
      </div>
      {b && <div className="heat-picks">{picker(0)}<span className="vs">VS</span>{picker(1)}</div>}
      {missing.length > 0 && (
        <p className="muted heat-note">{missing.map(p => `${shown.length > 1 ? `${p.name}: ` : ''}${p.heat.noPos} ${p.heat.noPos === 1 ? 'dart' : 'darts'} without position`).join(' · ')}</p>
      )}
    </div>
  );
}
