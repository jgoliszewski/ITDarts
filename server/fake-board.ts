// Fake Board Manager for development without the real board.
// Run: npm run fake-board, then open http://localhost:3180 to throw darts by hand.
import fastifyWebsocket from '@fastify/websocket';
import Fastify from 'fastify';
import type { WebSocket } from 'ws';
import { BOARD_ORDER, parseDart } from '../games/darts.ts';

const PORT = Number(process.argv[2] ?? 3180);
const app = Fastify();
await app.register(fastifyWebsocket);

interface Throw {
  segment: { name: string; number: number; multiplier: number; bed: string };
  coords: { x: number; y: number };
}

const sockets = new Set<WebSocket>();
let throws: Throw[] = [];
let running = true;
let offline = false;

function coordsFor(n: number, m: number) {
  if (n === 0) return { x: 1.2, y: 1.2 };
  if (n === 25) return m === 2 ? { x: 0.01, y: 0.01 } : { x: 0.05, y: 0 };
  const angle = (BOARD_ORDER.indexOf(n) * 18 * Math.PI) / 180;
  const r = m === 3 ? 0.6 : m === 2 ? 0.97 : 0.4;
  return { x: +(r * Math.sin(angle)).toFixed(3), y: +(r * Math.cos(angle)).toFixed(3) };
}

function send(event: string) {
  const msg = JSON.stringify({ type: 'state', data: { connected: true, running, status: running ? 'Throw' : 'Stopped', event, numThrows: throws.length, throws } });
  for (const ws of sockets) ws.send(msg);
}

app.get('/api/events', { websocket: true }, socket => {
  if (offline) return socket.close();
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
  send('Connected');
});

app.get('/api/version', async () => '2.0.2-fake');
app.post('/api/reset', async () => { throws = []; send('Manual reset'); return { ok: true }; });
app.put('/api/start', async () => { running = true; send('Started'); return { ok: true }; });
app.put('/api/stop', async () => { running = false; send('Stopped'); return { ok: true }; });
app.post('/api/config/calibration/auto', async () => { await new Promise(r => setTimeout(r, 3000)); return { ok: true }; });
app.post('/api/restart', async () => {
  offline = true;
  setTimeout(() => {
    for (const ws of sockets) ws.close();
    setTimeout(() => (offline = false), 4000);
  }, 200);
  return { ok: true };
});

app.post<{ Querystring: { d?: string } }>('/fake/throw', async (req, reply) => {
  const d = parseDart(req.query.d ?? '');
  if (!d) return reply.code(400).send({ error: 'Use e.g. ?d=T20' });
  const name = d.n === 0 ? 'Miss' : d.n === 25 ? (d.m === 2 ? 'Bull' : '25') : `${'SDT'[d.m - 1]}${d.n}`;
  throws.push({ segment: { name, number: d.n, multiplier: d.m, bed: name }, coords: coordsFor(d.n, d.m) });
  send('Throw detected');
  return { ok: true, throws: throws.length };
});
app.post('/fake/takeout-start', async () => { send('Takeout started'); return { ok: true }; });
app.post('/fake/takeout-finish', async () => { throws = []; send('Takeout finished'); return { ok: true }; });
app.post('/fake/takeout', async () => {
  send('Takeout started');
  setTimeout(() => { throws = []; send('Takeout finished'); }, 1500);
  return { ok: true };
});

app.get('/', async (_req, reply) => reply.type('text/html').send(`<!doctype html><meta name=viewport content="width=device-width">
<title>Fake board</title><body style="font:16px system-ui;background:#111;color:#eee;padding:16px">
<h2>Fake Board Manager :${PORT}</h2>
<div id=b style="display:flex;flex-wrap:wrap;gap:6px;max-width:640px"></div>
<p><button onclick="f('/fake/takeout')">Takeout (1.5 s)</button> <button onclick="f('/fake/takeout-start')">Takeout start</button>
<button onclick="f('/fake/takeout-finish')">Takeout finish</button></p>
<script>
const f = p => fetch(p, { method: 'POST' });
const b = document.getElementById('b');
for (const d of ['T20','T19','T18','S20','S19','S5','S1','D20','D16','D12','D10','D8','D4','D2','D1','25','Bull','Miss']) {
  const x = document.createElement('button'); x.textContent = d; x.style.cssText = 'padding:10px 14px;font:inherit';
  x.onclick = () => f('/fake/throw?d=' + d); b.append(x);
}
</script>`));

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`Fake Board Manager on http://localhost:${PORT}/`);
