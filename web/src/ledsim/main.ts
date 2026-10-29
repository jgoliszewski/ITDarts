// LED simulator page (web/led-sim.html, docs/MAPA.md): a preview of the ring around a lit board. Every Moment plays
// its sound and its LEDs from server/effects/leds.ts, alone or in sequences of a real visit, and, with “Play on the
// ring”, on the real controller too.
import { builtinSound } from '../sound.ts';
import { BOARD_SEGMENT, LEDS, SPLIT_AT, effectSeconds, rings, type Effect, type LedKey } from '../../../server/effects/leds.ts';
import { MOMENTS, WARM, lookOf, type Moment } from './actions.ts';
import { render, type Look, type Rgb, type Seg } from './looks.ts';

const N = 100;
const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;

// ---------- settings, kept in the browser ----------

const prefs = { sound: true, volume: 0.8, live: false };
const KEY = 'itdarts-led-sim';
try {
  const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}');
  for (const k of Object.keys(prefs) as (keyof typeof prefs)[]) if (typeof saved[k] === typeof prefs[k]) Object.assign(prefs, { [k]: saved[k] });
} catch {
  // A broken entry: the defaults do.
}
function savePrefs() {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private window: the page works, it just forgets.
  }
}

/** The controller's segments: LEDs 0–47 and 48–99. */
const SEGMENTS: Seg[] = [{ start: 0, stop: SPLIT_AT }, { start: SPLIT_AT, stop: N }];

// ---------- what plays ----------

/** What plays: one look per segment, in segment order, and when the longest one ends. */
let current: { looks: (Look | null)[]; dur: number; start: number; seed: number } | null = null;

function play(m: Moment, withSound = true) {
  const look = lookOf(m.led ?? m.id);
  if (look) {
    const { board, wall } = rings(look);
    const looks = BOARD_SEGMENT === 0 ? [board, wall] : [wall, board];
    current = { looks, dur: Math.max(...looks.map(l => l?.dur ?? 0)), start: clock, seed: Math.floor(Math.random() * 1e6) };
  } else current = null;
  if (withSound && prefs.sound && m.sound) builtinSound(m.sound, prefs.volume);
  $('#now').textContent = look ? `${m.name} — ${describe(look)}` : `${m.name}: no LEDs`;
  const led = LEDS[(m.led ?? m.id) as LedKey];
  if (prefs.live && led) toRing(led.preset, effectSeconds(led.effect) || 4);
}

/** Plays a preset on the controller for a while, then the app puts its base back (POST /api/wled/preview, “Try”). */
function toRing(preset: number, seconds: number) {
  fetch('/api/wled/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ preset, seconds }) })
    .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `HTTP ${r.status}`); })
    .catch((e: Error) => ($('#now').textContent += ` · ring: ${e.message}`));
}

const MOVING = new Set<Look['kind']>(['fill', 'run', 'ripple', 'burst', 'rainbow', 'dissolve', 'blink']);
function describe(e: Effect): string {
  const { board, wall } = rings(e);
  if (board === wall) return board ? describeLook(board) : 'no LEDs';
  return `board ring: ${board ? describeLook(board) : 'stays'} | wall ring: ${wall ? describeLook(wall) : 'stays'}`;
}

function describeLook(l: Look): string {
  const colour = l.color === 'rainbow' ? 'rainbow' : `rgb(${l.color.join(',')})`;
  const fades = l.fadeIn || l.fadeOut ? `, fade ${l.fadeIn ?? 0}/${l.fadeOut ?? 0} s` : ', hard switch';
  return `${l.kind} · ${colour}${l.bg ? ` over rgb(${l.bg.join(',')})` : ''} · ${l.dur} s${fades}${MOVING.has(l.kind) ? ' · moves' : ''}`;
}

// ---------- drawing ----------

const canvas = $<HTMLCanvasElement>('#ring');
const ctx = canvas.getContext('2d')!;
const light = document.createElement('canvas');
const lctx = light.getContext('2d')!;
const board = document.createElement('canvas');
/** The board times its light, cut to the board's shape. */
const lit = document.createElement('canvas');
let size = 0;

const ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

function drawBoard(r: number) {
  board.width = board.height = size;
  const b = board.getContext('2d')!, c = size / 2, d = r * 0.8;
  b.fillStyle = '#141414';
  b.beginPath();
  b.arc(c, c, r, 0, Math.PI * 2);
  b.fill();
  const ring = (r0: number, r1: number, colours: [string, string]) => ORDER.forEach((_, k) => {
    const a0 = -Math.PI / 2 + (k - 0.5) * (Math.PI / 10), a1 = a0 + Math.PI / 10;
    b.fillStyle = colours[k % 2];
    b.beginPath();
    b.arc(c, c, r1 * d, a0, a1);
    b.arc(c, c, r0 * d, a1, a0, true);
    b.fill();
  });
  ring(0.953, 1, ['#c8372d', '#2f8a47']);
  ring(0.629, 0.953, ['#1d1d1d', '#e9dcbf']);
  ring(0.582, 0.629, ['#c8372d', '#2f8a47']);
  ring(0.094, 0.582, ['#1d1d1d', '#e9dcbf']);
  b.fillStyle = '#2f8a47';
  b.beginPath();
  b.arc(c, c, 0.094 * d, 0, Math.PI * 2);
  b.fill();
  b.fillStyle = '#c8372d';
  b.beginPath();
  b.arc(c, c, 0.037 * d, 0, Math.PI * 2);
  b.fill();
  b.fillStyle = '#ddd';
  b.font = `600 ${Math.round(r * 0.09)}px system-ui`;
  b.textAlign = 'center';
  b.textBaseline = 'middle';
  ORDER.forEach((n, k) => {
    const a = -Math.PI / 2 + k * (Math.PI / 10);
    b.fillText(String(n), c + Math.cos(a) * r * 0.9, c + Math.sin(a) * r * 0.9);
  });
}

function resize() {
  const css = Math.min(canvas.parentElement!.clientWidth, 620);
  const dpr = window.devicePixelRatio || 1;
  size = Math.round(css * dpr);
  canvas.width = canvas.height = light.width = light.height = lit.width = lit.height = size;
  canvas.style.width = canvas.style.height = `${css}px`;
  drawBoard(size * 0.4);
}

/** LED j's ring and place on it: both rings start at 1 o'clock and run clockwise (checked at the board, issue #10). */
const START_DEG = 30;
function ledPlace(j: number): { onBoard: boolean; angle: number } {
  const second = j >= SPLIT_AT;
  const [from, len] = second ? [SPLIT_AT, N - SPLIT_AT] : [0, SPLIT_AT];
  const angle = ((START_DEG + ((j - from) * 360) / len) * Math.PI) / 180 - Math.PI / 2;
  return { onBoard: second === (BOARD_SEGMENT === 1), angle };
}

const leds: Rgb[] = Array.from({ length: N }, () => WARM);

/** Simulation time in ms; it stands still while paused, so a frame can be looked at. */
let clock = 0, last = performance.now(), paused = false, speed = 1;

function frame(now: number) {
  if (!paused) clock += (now - last) * speed;
  last = now;
  draw();
  requestAnimationFrame(frame);
}

function draw() {
  const t = current ? (clock - current.start) / 1000 : 0;
  if (current && t >= current.dur) current = null;
  render(current?.looks ?? [], t, WARM, SEGMENTS, current?.seed ?? 0, leds);
  // Seen from the oche the wall ring is the inner one, right round the board, and lights a halo on the wall; the board
  // ring is the outer one, nearer the player, and faces the board.
  const c = size / 2, R = size * 0.47, RW = size * 0.415;
  const spot = (g: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, stops: [number, number][]) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    for (const [at, alpha] of stops) grad.addColorStop(at, `rgba(${rgb},${alpha})`);
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const placed = leds.map((col, j) => {
    const { onBoard, angle } = ledPlace(j), r = onBoard ? R : RW;
    return { onBoard, x: c + Math.cos(angle) * r, y: c + Math.sin(angle) * r, rgb: col.map(v => Math.round(v)).join(',') };
  });

  // The wall: dark, lit only by the wall ring.
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#0c0c0e';
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  for (const p of placed) if (!p.onBoard) spot(ctx, p.x, p.y, size * 0.2, p.rgb, [[0, 0.16], [0.4, 0.06], [1, 0]]);

  // The board, lit by the board ring: each LED a soft spot reaching past the middle.
  lctx.globalCompositeOperation = 'source-over';
  lctx.fillStyle = 'rgb(10,10,12)';
  lctx.fillRect(0, 0, size, size);
  lctx.globalCompositeOperation = 'lighter';
  for (const p of placed) if (p.onBoard) spot(lctx, p.x, p.y, R * 1.6, p.rgb, [[0, 0.21], [0.45, 0.075], [1, 0]]);
  const bctx = lit.getContext('2d')!;
  bctx.globalCompositeOperation = 'source-over';
  bctx.clearRect(0, 0, size, size);
  bctx.drawImage(board, 0, 0);
  bctx.globalCompositeOperation = 'multiply';
  bctx.drawImage(light, 0, 0);
  bctx.globalCompositeOperation = 'destination-in';
  bctx.drawImage(board, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(lit, 0, 0);

  // The LEDs: the board ring as hot dots, the wall ring dimmer, since it faces away.
  ctx.globalCompositeOperation = 'lighter';
  for (const p of placed) {
    spot(ctx, p.x, p.y, size * (p.onBoard ? 0.03 : 0.022), p.rgb, [[0, p.onBoard ? 0.55 : 0.35], [1, 0]]);
    ctx.fillStyle = `rgba(${p.rgb},${p.onBoard ? 1 : 0.6})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size * (p.onBoard ? 0.007 : 0.005), 0, Math.PI * 2);
    ctx.fill();
  }
  // Where each ring starts.
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#9a9a9a';
  ctx.font = `${Math.round(size * 0.022)}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const j of [0, SPLIT_AT]) {
    const { onBoard, angle } = ledPlace(j), r = onBoard ? R + size * 0.018 : RW - size * 0.022;
    ctx.fillText(String(j), c + Math.cos(angle) * r, c + Math.sin(angle) * r);
  }
}

// ---------- sequences: what a real visit sounds and looks like ----------

type Step = [at: number, moment: string];
const SEQUENCES: { name: string; steps: Step[] }[] = [
  { name: 'Visit T20 · 20 · T20 → Ton 40', steps: [[0, 'treble-20'], [1.6, ''], [3.2, 'ton-40'], [7, 'next-player']] },
  { name: 'Visit → 180', steps: [[0, 'treble-20'], [1.5, 'treble-20'], [3, '180'], [8, 'next-player']] },
  { name: 'Visit 1 · 5 · 20, then a Ton', steps: [[1.8, ''], [3, 'bnb'], [6, 'next-player'], [7.2, 'treble'], [9, 'ton']] },
  { name: 'Bust, then No score', steps: [[0, 'treble'], [1.5, 'bust'], [5, 'next-player'], [8, 'no-score'], [11, 'next-player']] },
  { name: 'High finish, Set won, Match won', steps: [[0, 'treble-20'], [1.5, 'high-finish'], [5, 'game-on'], [7.5, 'set-won'], [12, 'match-won']] },
  { name: 'Cricket visit: hit, miss, sector closed', steps: [[0, 'hit'], [1.4, 'miss'], [2.8, 'sector-closed'], [6, 'next-player']] },
  { name: 'Killer: life lost, player out', steps: [[0, 'killer'], [3, 'life-lost'], [6, 'player-out']] },
];
let timers: number[] = [];
function runSequence(steps: Step[]) {
  timers.forEach(clearTimeout);
  timers = steps.map(([at, id]) => window.setTimeout(() => {
    const m = MOMENTS.find(x => x.id === id);
    if (m) play(m);
    else $('#now').textContent = 'A dart with no effect';
  }, at * 1000));
}

// ---------- the page ----------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, string> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

function swatch(m: Moment) {
  const e = lookOf(m.led ?? m.id), l = e && (rings(e).board ?? rings(e).wall);
  return !l ? 'transparent' : l.color === 'rainbow' ? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' : `rgb(${l.color.join(',')})`;
}

const list = $('#list');
for (const group of new Set(MOMENTS.map(m => m.group))) {
  list.append(el('h3', { textContent: group }));
  for (const m of MOMENTS.filter(x => x.group === group)) {
    const dot = el('i');
    dot.style.background = swatch(m);
    const b = el('button', { className: 'moment', title: m.note ?? '' },
      dot, el('b', { textContent: m.name }), el('span', { className: 'meta', textContent: m.when }));
    b.onclick = () => play(m);
    list.append(b);
  }
}
const seqs = $('#sequences');
for (const s of SEQUENCES) {
  const b = el('button', { textContent: '▶ ' + s.name });
  b.onclick = () => runSequence(s.steps);
  seqs.append(b);
}

function bind(id: keyof typeof prefs) {
  const e = $<HTMLInputElement>('#' + id);
  if (e.type === 'checkbox') e.checked = prefs[id] as boolean;
  else e.value = String(prefs[id]);
  e.oninput = () => {
    Object.assign(prefs, { [id]: e.type === 'checkbox' ? e.checked : Number(e.value) });
    savePrefs();
  };
}
bind('sound');
bind('volume');
bind('live');
$('#stop').onclick = () => {
  timers.forEach(clearTimeout);
  current = null;
  $('#now').textContent = 'Base';
  if (prefs.live) toRing(LEDS.base.preset, 0.1);
};
$('#pause').onclick = () => {
  paused = !paused;
  $('#pause').textContent = paused ? 'Resume' : 'Pause';
};
$<HTMLSelectElement>('#speed').onchange = e => (speed = Number((e.target as HTMLSelectElement).value));
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);

/** For scripts and screenshots: show `moment` frozen `seconds` after its start. */
Object.assign(window, {
  ledSim: {
    at(moment: string, seconds: number) {
      const m = MOMENTS.find(x => x.id === moment);
      if (!m) return;
      play(m, false);
      if (current) current.start = clock - seconds * 1000;
      paused = true;
      draw();
    },
  },
});
