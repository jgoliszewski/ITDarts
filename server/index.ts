import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import Fastify from 'fastify';
import { Board } from './board.ts';
import { loadConfig } from './config.ts';
import { Db } from './db.ts';
import { Hub } from './hub.ts';
import { Stats, parseWindow } from './stats.ts';

const cfg = loadConfig();
const db = new Db(cfg.dataDir);
const board = new Board(cfg.board);
const stats = new Stats(db);
let browser: ChildProcess | null = null;

const app = Fastify({ logger: { level: 'warn' } });

async function shutdown() {
  browser?.kill();
  board.stop();
  await app.close().catch(() => undefined);
  db.close();
  process.exit(0);
}

const hub = new Hub(db, board, cfg, () => void shutdown());

await app.register(fastifyWebsocket);

app.get('/ws', { websocket: true }, (socket, req) => {
  const ip = req.socket.remoteAddress ?? '';
  hub.connect(socket, ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1');
});

app.get('/api/stats/players', async () => stats.list());

app.get<{ Params: { id: string }; Querystring: { window?: string } }>('/api/stats/players/:id', async (req, reply) => {
  const r = stats.player(Number(req.params.id), parseWindow(req.query.window));
  return r ?? reply.code(404).send({ error: 'No such player' });
});

app.get<{ Querystring: { a?: string; b?: string; window?: string } }>('/api/stats/h2h', async (req, reply) => {
  const r = stats.h2h(Number(req.query.a), Number(req.query.b), parseWindow(req.query.window));
  return r ?? reply.code(404).send({ error: 'Pick two players' });
});

const webRoot = resolve('dist/web');
if (existsSync(join(webRoot, 'index.html'))) {
  await app.register(fastifyStatic, { root: webRoot });
  // Client-side routes (/stats) fall back to the SPA.
  app.setNotFoundHandler((req, reply) => (req.url.startsWith('/api') ? reply.code(404).send({ error: 'Not found' }) : reply.sendFile('index.html')));
} else {
  app.get('/', async (_req, reply) => reply.type('text/plain').send('Web build missing. Run "npm run build", or use "npm run dev" and open http://localhost:5173'));
}

function openKiosk(url: string) {
  const candidates = [
    cfg.browser,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ].filter((p): p is string => !!p && existsSync(p));
  if (!candidates.length) {
    console.warn('No browser found for kiosk mode; open', url, 'by hand.');
    return;
  }
  // A separate profile keeps the kiosk window apart from the user's own browser, so closing it is safe.
  browser = spawn(candidates[0], [
    `--kiosk`, url, '--edge-kiosk-type=fullscreen', '--no-first-run', '--disable-pinch', '--overscroll-history-navigation=0',
    `--user-data-dir=${join(cfg.dataDir, 'kiosk-profile')}`,
  ], { stdio: 'ignore' });
  browser.on('exit', () => (browser = null));
}

hub.backup();
board.start();
await app.listen({ port: cfg.port, host: '0.0.0.0' });
console.log(`ITDarts on http://localhost:${cfg.port}/ · board ${cfg.board} · data ${cfg.dataDir}`);
if (cfg.kiosk) openKiosk(`http://localhost:${cfg.port}/`);

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
