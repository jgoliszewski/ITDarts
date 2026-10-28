// LED simulator page (web/led-sim.html, docs/MAPA.md): the ring around a lit board, every moment with its sound and
// its LEDs from server/effects/leds.ts (and the LED lab looks from before, to compare), sequences of a real visit, and
// picks saved in the browser to copy out.
import { builtinSound } from '../sound.ts';
import { rings, type Effect } from '../../../server/effects/leds.ts';
import { MOMENTS, SETS, WARM, type Moment } from './actions.ts';
import { render, type Look, type Rgb, type Seg } from './looks.ts';

const N = 100;
const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;

// ---------- settings, kept in the browser ----------

interface Prefs {
  set: string;
  fade: number;
  sound: boolean;
  volume: number;
  start: number;
  dir: 1 | -1;
  /** The controller drives two rings, one per segment: one lights the board, the other the wall behind it. */
  split: 48 | 50;
  boardRing: 'first' | 'second';
  rev2: boolean;
  base: 'warm' | 'white';
  picks: Record<string, string>;
  notes: Record<string, string>;
}
const DEFAULTS: Prefs = { set: 'now', fade: 1, sound: true, volume: 0.8, start: 180, dir: 1, split: 48, boardRing: 'first', rev2: false, base: 'warm', picks: {}, notes: {} };
const KEY = 'itdarts-led-sim';
function loadPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}
const prefs = loadPrefs();
// A set from an older version of the page is gone.
if (!SETS.some(s => s.id === prefs.set)) prefs.set = DEFAULTS.set;
function savePrefs() {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Private window: the page works, it just forgets.
  }
}

const baseColour = (): Rgb => (prefs.base === 'warm' ? WARM : [255, 255, 255]);
/** Both rings play the same effect, each from its own LED 0 (the controller's segments 0–48 and 48–100). */
const segments = (): Seg[] => [{ start: 0, stop: prefs.split }, { start: prefs.split, stop: N, rev: prefs.rev2 }];

// ---------- what plays ----------

/** What plays: one look per segment, in segment order, and when the longest one ends. */
let current: { looks: (Look | null)[]; dur: number; start: number; seed: number; label: string } | null = null;
const lookOf = (setId: string, id: string) => SETS.find(s => s.id === setId)?.looks[id];

/** The look with the page's fade factor applied (0 = hard switches like today). */
function faded(look: Look): Look {
  return { ...look, fadeIn: (look.fadeIn ?? 0) * prefs.fade, fadeOut: (look.fadeOut ?? 0) * prefs.fade };
}

/** The effect per segment: the board ring is the first or the second segment. */
function perSegment(e: Effect): (Look | null)[] {
  const { board, wall } = rings(e);
  return prefs.boardRing === 'first' ? [board, wall] : [wall, board];
}

function play(m: Moment, setId = prefs.set, withSound = true) {
  const look = lookOf(setId, m.id);
  const looks = look ? perSegment(look).map(l => (l && setId !== 'before' ? faded(l) : l)) : [];
  current = look
    ? { looks, dur: Math.max(...looks.map(l => l?.dur ?? 0)), start: clock, seed: Math.floor(Math.random() * 1e6), label: `${m.name} · ${SETS.find(s => s.id === setId)!.name}` }
    : null;
  if (withSound && prefs.sound && m.sound) builtinSound(m.sound, prefs.volume);
  $('#now').textContent = look ? `${current!.label} — ${describe(look)}` : `${m.name}: no LEDs in this set`;
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

/** LED j's ring and place on it: each ring's first LED at `start` degrees (0 = top), counted clockwise or not. */
function ledPlace(j: number): { onBoard: boolean; angle: number } {
  const second = j >= prefs.split;
  const [from, len] = second ? [prefs.split, N - prefs.split] : [0, prefs.split];
  const angle = ((prefs.start + (prefs.dir * ((j - from) * 360)) / len) * Math.PI) / 180 - Math.PI / 2;
  return { onBoard: second === (prefs.boardRing === 'second'), angle };
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
  render(current?.looks ?? [], t, baseColour(), segments(), current?.seed ?? 0, leds);
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
  for (const j of [0, prefs.split]) {
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

const MOOD: Record<Moment['mood'], string> = { neutral: 'neutral', good: 'good', bad: 'bad', fun: 'fun' };
const swatch = (e: Effect | undefined) => {
  const l = e && (rings(e).board ?? rings(e).wall);
  return !l ? 'transparent' : l.color === 'rainbow' ? 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' : `rgb(${l.color.join(',')})`;
};

function renderList() {
  const root = $('#list');
  root.innerHTML = '';
  for (const group of new Set(MOMENTS.map(m => m.group))) {
    const list = MOMENTS.filter(m => m.group === group);
    root.append(el('h3', { textContent: group }));
    for (const m of list) {
      const pick = prefs.picks[m.id];
      const row = el('div', { className: 'moment' + (pick ? ' picked' : '') });
      const head = el('button', { className: 'name', title: 'Play in the selected set' },
        el('b', { textContent: m.name }),
        el('span', { className: `chip s-${m.strength}`, textContent: m.strength }),
        el('span', { className: `chip m-${m.mood}`, textContent: MOOD[m.mood] }));
      head.onclick = () => play(m);
      const meta = el('div', { className: 'meta', textContent: `${m.when} · ${m.often} · sound: ${m.sound ?? '—'}${m.note ? ` · ${m.note}` : ''}` });
      const variants = el('div', { className: 'variants' });
      for (const s of SETS) {
        const l = s.looks[m.id];
        const dot = el('i');
        dot.style.background = swatch(l);
        const b = el('button', { className: 'variant' + (s.id === prefs.set ? ' current' : '') + (pick === s.id ? ' chosen' : ''), title: l ? describe(l) : 'No LEDs' },
          dot, s.name.split(' · ')[0]);
        if (!l) b.classList.add('none');
        b.onclick = () => play(m, s.id);
        variants.append(b);
      }
      const choose = el('select', { title: 'Your pick for this moment' });
      choose.append(el('option', { value: '', textContent: 'Pick…' }), ...SETS.map(s => el('option', { value: s.id, textContent: s.name })), el('option', { value: 'none', textContent: 'No LEDs' }));
      choose.value = pick ?? '';
      choose.onchange = () => {
        if (choose.value) prefs.picks[m.id] = choose.value;
        else delete prefs.picks[m.id];
        savePrefs();
        renderList();
      };
      const note = el('input', { type: 'text', placeholder: 'Note', value: prefs.notes[m.id] ?? '' });
      note.oninput = () => {
        prefs.notes[m.id] = note.value;
        savePrefs();
      };
      variants.append(choose, note);
      row.append(head, meta, variants);
      root.append(row);
    }
  }
  $('#idea').textContent = SETS.find(s => s.id === prefs.set)!.idea;
  renderPicked();
}

function renderPicked() {
  $('#picked').textContent = `${Object.keys(prefs.picks).length} of ${MOMENTS.length} moments picked`;
}


function renderControls() {
  const tabs = $('#sets');
  tabs.innerHTML = '';
  for (const s of SETS) {
    const b = el('button', { textContent: s.name, className: s.id === prefs.set ? 'on' : '' });
    b.onclick = () => {
      prefs.set = s.id;
      savePrefs();
      renderControls();
      renderList();
    };
    tabs.append(b);
  }
  const seqs = $('#sequences');
  seqs.innerHTML = '';
  for (const s of SEQUENCES) {
    const b = el('button', { textContent: '▶ ' + s.name });
    b.onclick = () => runSequence(s.steps);
    seqs.append(b);
  }
}

function bind<T extends HTMLInputElement | HTMLSelectElement>(id: string, get: () => string, set: (v: string) => void) {
  const e = $<T>(id);
  if (e instanceof HTMLInputElement && e.type === 'checkbox') {
    e.checked = get() === 'true';
    e.onchange = () => { set(String(e.checked)); savePrefs(); };
  } else {
    e.value = get();
    e.oninput = () => { set(e.value); savePrefs(); };
  }
}

function copyPicks() {
  const lines = ['| Moment | Pick | Note |', '|---|---|---|', ...MOMENTS.map(m => {
    const p = prefs.picks[m.id];
    return `| ${m.name} | ${p ? (SETS.find(s => s.id === p)?.name ?? 'No LEDs') : ''} | ${prefs.notes[m.id] ?? ''} |`;
  })];
  const text = lines.join('\n') + `\n\nFade ×${prefs.fade}, LED 0 at ${prefs.start}°, ${prefs.dir === 1 ? 'clockwise' : 'anticlockwise'}, rings split at ${prefs.split}, board ring: ${prefs.boardRing}, second ring ${prefs.rev2 ? 'reversed' : 'same way'}\n`;
  void navigator.clipboard.writeText(text).then(() => ($('#copy').textContent = 'Copied'), () => ($('#copy').textContent = 'Copy failed'));
  setTimeout(() => ($('#copy').textContent = 'Copy picks'), 1500);
}

bind('#fade', () => String(prefs.fade), v => { prefs.fade = Number(v); $('#fadeOut').textContent = `×${prefs.fade}`; });
$('#fadeOut').textContent = `×${prefs.fade}`;
bind('#sound', () => String(prefs.sound), v => (prefs.sound = v === 'true'));
bind('#volume', () => String(prefs.volume), v => (prefs.volume = Number(v)));
bind('#start', () => String(prefs.start), v => (prefs.start = Number(v)));
bind('#dir', () => String(prefs.dir), v => (prefs.dir = Number(v) as 1 | -1));
bind('#split', () => String(prefs.split), v => (prefs.split = Number(v) as Prefs['split']));
bind('#boardRing', () => prefs.boardRing, v => (prefs.boardRing = v as Prefs['boardRing']));
bind('#rev2', () => String(prefs.rev2), v => (prefs.rev2 = v === 'true'));
bind('#base', () => prefs.base, v => (prefs.base = v as Prefs['base']));
$('#copy').onclick = copyPicks;
$('#stop').onclick = () => {
  timers.forEach(clearTimeout);
  current = null;
  $('#now').textContent = 'Base';
};
window.addEventListener('resize', resize);
renderControls();
renderList();
resize();
requestAnimationFrame(frame);
$('#pause').onclick = () => {
  paused = !paused;
  $('#pause').textContent = paused ? 'Resume' : 'Pause';
};
$<HTMLSelectElement>('#speed').onchange = e => (speed = Number((e.target as HTMLSelectElement).value));

/** For scripts and screenshots: show `moment` in `set` frozen `seconds` after its start. */
Object.assign(window, {
  ledSim: {
    at(moment: string, set: string, seconds: number) {
      const m = MOMENTS.find(x => x.id === moment);
      if (!m) return;
      play(m, set, false);
      if (current) current.start = clock - seconds * 1000;
      paused = true;
      draw();
    },
  },
});
