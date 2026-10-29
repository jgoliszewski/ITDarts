// Fake Board Manager for development without the real board.
// Run: npm run fake-board, then open http://localhost:3180 and click the board to throw darts.
import fastifyWebsocket from '@fastify/websocket';
import Fastify from 'fastify';
import type { WebSocket } from 'ws';
import { BOARD_ORDER, parseDart } from '../games/darts.ts';

const PORT = Number(process.argv[2] ?? 3180);
const app = Fastify();
await app.register(fastifyWebsocket);

// Board Manager 2.1.0 format: flat throw, camelCase events, `event` stays until the next one.
interface Throw {
  bed: string; bouncer: boolean; coordsX: number; coordsY: number; failed: boolean; method: string;
  multiplier: number; segmentName: string; segmentNumber: number;
}
type Seg = Pick<Throw, 'segmentName' | 'segmentNumber' | 'multiplier' | 'bed'>;

const mkThrow = (seg: Seg, c: { x: number; y: number }): Throw =>
  ({ ...seg, bouncer: false, coordsX: c.x, coordsY: c.y, failed: false, method: 'UnanimousCam' });

const sockets = new Set<WebSocket>();
let throws: Throw[] = [];
let running = true;
let offline = false;

function coordsFor(n: number, m: number) {
  if (n === 0) return { x: 1.2, y: 1.2 };
  // Random spot inside the bull or the 25 ring, so bull-offs have a winner.
  if (n === 25) {
    const r = m === 2 ? Math.random() * 0.035 : 0.04 + Math.random() * 0.05, a = Math.random() * 2 * Math.PI;
    return { x: +(r * Math.sin(a)).toFixed(4), y: +(r * Math.cos(a)).toFixed(4) };
  }
  const angle = (BOARD_ORDER.indexOf(n) * 18 * Math.PI) / 180;
  const r = m === 3 ? 0.6 : m === 2 ? 0.97 : 0.4;
  return { x: +(r * Math.sin(angle)).toFixed(3), y: +(r * Math.cos(angle)).toFixed(3) };
}

/** What Board Manager reports for a hit at normalized coords (1 = outer edge of the double ring, y up). */
function segmentAt(x: number, y: number): Seg {
  const mm = Math.hypot(x, y) * 170;
  const deg = ((Math.atan2(x, y) * 180) / Math.PI + 369) % 360;
  const n = BOARD_ORDER[Math.floor(deg / 18)];
  if (mm <= 6.35) return { segmentName: 'Bull', segmentNumber: 25, multiplier: 2, bed: 'Bull' };
  if (mm <= 15.9) return { segmentName: '25', segmentNumber: 25, multiplier: 1, bed: 'Single' };
  if (mm > 170) return { segmentName: `M${n}`, segmentNumber: n, multiplier: 0, bed: 'Outside' };
  if (mm >= 162) return { segmentName: `D${n}`, segmentNumber: n, multiplier: 2, bed: 'Double' };
  if (mm >= 99 && mm <= 107) return { segmentName: `T${n}`, segmentNumber: n, multiplier: 3, bed: 'Triple' };
  return { segmentName: `S${n}`, segmentNumber: n, multiplier: 1, bed: mm < 99 ? 'SingleInner' : 'SingleOuter' };
}

let event = 'started';
let takeoutBusy = false;

function send(e?: string) {
  if (e) event = e; // sticky, like the real one
  const status = !running ? 'stopped' : takeoutBusy ? 'takeoutInProgress' : throws.length >= 3 ? 'takeout' : 'throw';
  const msg = JSON.stringify({ type: 'state', data: { connected: true, running, status, event, throws } });
  for (const ws of sockets) ws.send(msg);
}

/** Like the real board: the first dart after a takeout comes in a frame that still says takeoutFinished, then in throwDetected. */
function addThrow(t: Throw) {
  throws.push(t);
  if (event === 'takeoutFinished') send();
  send('throwDetected');
}

let takeoutTimer: NodeJS.Timeout | undefined;

app.get('/api/events', { websocket: true }, socket => {
  if (offline) return socket.close();
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
  send();
});

app.get('/api/version', async () => '2.1.0-fake');
app.post('/api/reset', async () => { throws = []; takeoutBusy = false; clearTimeout(takeoutTimer); send('manualReset'); return { ok: true }; });
app.put('/api/start', async () => { running = true; send('started'); return { ok: true }; });
app.put('/api/stop', async () => { running = false; send('stopped'); return { ok: true }; });
app.post('/api/config/calibration/auto', async () => { await new Promise(r => setTimeout(r, 3000)); return { ok: true }; });
app.post('/api/restart', async () => {
  offline = true;
  setTimeout(() => {
    for (const ws of sockets) ws.close();
    setTimeout(() => (offline = false), 4000);
  }, 200);
  return { ok: true };
});

app.post<{ Querystring: { d?: string; x?: string; y?: string } }>('/fake/throw', async (req, reply) => {
  const x = Number(req.query.x), y = Number(req.query.y);
  if (req.query.x !== undefined && Number.isFinite(x) && Number.isFinite(y)) {
    addThrow(mkThrow(segmentAt(x, y), { x, y }));
    return { ok: true, throws: throws.length, segment: throws.at(-1)!.segmentName };
  }
  const d = parseDart(req.query.d ?? '');
  if (!d) return reply.code(400).send({ error: 'Use e.g. ?d=T20' });
  const name = d.n === 0 ? 'Miss' : d.n === 25 ? (d.m === 2 ? 'Bull' : '25') : `${'SDT'[d.m - 1]}${d.n}`;
  addThrow(mkThrow({ segmentName: name, segmentNumber: d.n, multiplier: d.m, bed: name }, coordsFor(d.n, d.m)));
  return { ok: true, throws: throws.length };
});
const takeoutStart = () => { takeoutBusy = true; send('takeoutStarted'); };
const takeoutFinish = () => { takeoutBusy = false; throws = []; send('takeoutFinished'); };
app.post('/fake/takeout-start', async () => { takeoutStart(); return { ok: true }; });
app.post('/fake/takeout-finish', async () => { takeoutFinish(); return { ok: true }; });
app.post('/fake/takeout', async () => {
  takeoutStart();
  takeoutTimer = setTimeout(takeoutFinish, 1500);
  return { ok: true };
});

app.get('/', async (_req, reply) => reply.type('text/html').send(`<!doctype html><meta name=viewport content="width=device-width">
<title>Fake board</title>
<style>
.actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
.actions button { font: 600 15px system-ui; height: 44px; padding: 0 22px; border-radius: 9999px; border: 1px solid #2E2E33; background: #1F1F23; color: #F5F5F5; cursor: pointer; }
.actions button:hover { background: #2A2A2F; }
.actions button.primary { background: #F58224; border-color: #F58224; color: #111; font-weight: 800; }
.actions button.primary:hover { background: #FF9440; }
</style>
<body style="font:16px system-ui;background:#111;color:#eee;padding:16px;margin:0">
<h2 style="margin:0 0 8px">Fake Board Manager :${PORT}</h2>
<p style="margin:0 0 8px;color:#aaa">Click the board to throw. Outside the double ring is a miss. <span id=last></span></p>
<svg id=board viewBox="-380 -380 760 760" style="width:min(96vw,82vh);height:auto;cursor:crosshair;display:block"></svg>
<div class=actions><button class=primary onclick="takeout('/fake/takeout')">Takeout (1.5 s)</button>
<button onclick="f('/fake/takeout-start')">Takeout start</button><button onclick="takeout('/fake/takeout-finish')">Takeout finish</button></div>
<script>
// Rings drawn fatter than real ones (as on the app's Dartboard) so they are easy to hit. A click maps back
// to real mm piecewise between ring edges, so the coords sent (mm / 170, y up) are realistic.
const DRAWN = [0, 20, 46, 168, 220, 290, 340, 380], REAL = [0, 6.35, 15.9, 99, 107, 162, 170, 200];
const toMm = r => { const i = Math.min(DRAWN.length - 2, DRAWN.findIndex((d, k) => r <= DRAWN[k + 1]) < 0 ? DRAWN.length - 2 : DRAWN.findIndex((d, k) => r <= DRAWN[k + 1]));
  return REAL[i] + (r - DRAWN[i]) * (REAL[i + 1] - REAL[i]) / (DRAWN[i + 1] - DRAWN[i]); };
const ORDER = ${JSON.stringify(BOARD_ORDER)};
const svg = document.getElementById('board'), NS = 'http://www.w3.org/2000/svg';
const f = p => fetch(p, { method: 'POST' }).then(r => r.json());
const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); svg.append(e); return e; };
const pt = (r, deg) => [r * Math.sin(deg * Math.PI / 180), -r * Math.cos(deg * Math.PI / 180)];
const arc = (r1, r2, a1, a2) => { const [x1, y1] = pt(r2, a1), [x2, y2] = pt(r2, a2), [x3, y3] = pt(r1, a2), [x4, y4] = pt(r1, a1);
  return 'M' + x1 + ' ' + y1 + 'A' + r2 + ' ' + r2 + ' 0 0 1 ' + x2 + ' ' + y2 + 'L' + x3 + ' ' + y3 + 'A' + r1 + ' ' + r1 + ' 0 0 0 ' + x4 + ' ' + y4 + 'Z'; };
el('circle', { r: 380, fill: '#141416' });
ORDER.forEach((n, k) => {
  const dark = k % 2 === 0;
  for (const [r1, r2, ring] of [[46, 168, 0], [168, 220, 1], [220, 290, 0], [290, 340, 1]])
    el('path', { d: arc(r1, r2, k * 18 - 9, k * 18 + 9), fill: ring ? (dark ? '#B8322F' : '#1F8A52') : (dark ? '#232327' : '#4A4A50'), stroke: '#0A0A0B', 'stroke-width': 2 });
  const [x, y] = pt(360, k * 18);
  el('text', { x, y, fill: '#A1A1A6', 'font-size': 24, 'font-weight': 700, 'text-anchor': 'middle', 'dominant-baseline': 'central' }).textContent = n;
});
el('circle', { r: 46, fill: '#1F8A52', stroke: '#0A0A0B', 'stroke-width': 2 });
el('circle', { r: 20, fill: '#B8322F', stroke: '#0A0A0B', 'stroke-width': 2 });
let dots = [];
svg.onclick = async e => {
  const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  const { x, y } = p.matrixTransform(svg.getScreenCTM().inverse());
  dots.push(el('circle', { cx: x, cy: y, r: 6, fill: '#F58224', stroke: '#0A0A0B', 'stroke-width': 2 }));
  const drawn = Math.hypot(x, y), k = drawn ? toMm(drawn) / drawn / 170 : 0;
  const r = await f('/fake/throw?x=' + (x * k).toFixed(5) + '&y=' + (-y * k).toFixed(5));
  document.getElementById('last').textContent = 'Last: ' + r.segment + ' · ' + toMm(drawn).toFixed(1) + ' mm from centre';
};
const takeout = p => { dots.forEach(d => d.remove()); dots = []; return f(p); };
</script>`));

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`Fake Board Manager on http://localhost:${PORT}/`);
