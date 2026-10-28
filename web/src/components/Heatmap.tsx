import type { PointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { PlayerHeat } from '../../../games/report.ts';
import { SHOWN, TargetBoard, coordsSpot } from './Dartboard.tsx';
import { Dropdown } from './ui.tsx';

// The same board as everywhere else (TargetBoard); heat is painted on a canvas laid over it.
const W = 600, C = W / 2, K = W / 760; // canvas pixels per unit of the board drawing (viewBox -380..380)

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
  const x = canvas.getContext('2d')!, r = SPOT * SHOWN[5] * K, v = new Float32Array(W * W);
  for (const [dx, dy] of darts) {
    const [sx, sy] = coordsSpot(dx, dy), px = C + sx * K, py = C + sy * K;
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
  const split = players.length > 1;
  const a = players[Math.min(pair[0], players.length - 1)], b = split ? players[Math.min(pair[1], players.length - 1)] : null;
  const shown = b ? [a, b] : [a];

  const drag = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    setPos(Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)));
  };
  const pct = `${pos * 100}%`;
  const picker = (side: 0 | 1) => (
    <Dropdown value={pair[side]} color={side ? b!.color : a.color} onChange={i => setPair(side ? [pair[0], i] : [i, pair[1]])}
      options={players.map((q, i) => ({ value: i, label: q.name }))} />
  );

  if (shown.every(p => p.heat.darts.length === 0)) return <p className="muted heat-empty">No positions recorded</p>;
  return (
    <div className="heatmap">
      {/* Names sit on the line; pickers only when there are more players than halves. */}
      {players.length > 2 && <div className="heat-picks">{picker(0)}<span className="vs">VS</span>{picker(1)}</div>}
      <div className="heat-board" onPointerDown={split ? e => { e.currentTarget.setPointerCapture(e.pointerId); drag(e); } : undefined}
        onPointerMove={split ? e => e.buttons && drag(e) : undefined}>
        <TargetBoard cleared={[]} target={null} ring={null} darts={[]} label="Heatmap" />
        <Layer darts={a.heat.darts} clip={b ? `inset(0 calc(100% - ${pct}) 0 0)` : 'none'} />
        {b && <Layer darts={b.heat.darts} clip={`inset(0 0 0 ${pct})`} />}
        {b && (
          <div className="heat-line" style={{ left: pct }}>
            {/* Whose half is whose: a name tag on each side of the line. */}
            <b className="l" style={{ background: a.color }}>{a.name}</b>
            <b className="r" style={{ background: b.color }}>{b.name}</b>
            <span>↔</span>
          </div>
        )}
      </div>
    </div>
  );
}
