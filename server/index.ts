import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import Fastify from 'fastify';
import { isGameId } from '../games/index.ts';
import { Board } from './board.ts';
import { fakeBoardPort, loadConfig } from './config.ts';
import { Db } from './db.ts';
import { CALLER_DIR, Effects } from './effects/index.ts';
import { effectsRoutes } from './effects/routes.ts';
import { EffectsStore } from './effects/store.ts';
import { Hub } from './hub.ts';
import { Stats, parseWindow } from './stats.ts';

const cfg = loadConfig();
const db = new Db(cfg.dataDir);
const board = new Board(cfg.board);
const stats = new Stats(db, undefined, cfg.ocheMeters);
let browser: ChildProcess | null = null;
let fakeBoard: ChildProcess | null = null;
const FAKE_BOARD_PORT = fakeBoardPort(cfg.board);

/** The switch in Panel tarczy: runs the fake Board Manager next to the server and points the adapter at it. */
function useFakeBoard(on: boolean) {
  if (on === board.status.fake) return;
  fakeBoard?.kill();
  fakeBoard = null;
  // If the port is taken (e.g. by npm run dev:fake), that simulator serves instead and this child just exits.
  if (on) fakeBoard = spawn(process.execPath, ['--import', 'tsx', 'server/fake-board.ts', FAKE_BOARD_PORT], { stdio: 'ignore' });
  board.status.fake = on;
  board.setAddress(on ? `localhost:${FAKE_BOARD_PORT}` : cfg.board);
}

const app = Fastify({ logger: { level: 'warn' } });

async function shutdown() {
  browser?.kill();
  fakeBoard?.kill();
  board.stop();
  effectsStore.close();
  await app.close().catch(() => undefined);
  db.close();
  process.exit(0);
}

const effectsStore = new EffectsStore(db, cfg.effectsDir, cfg.dataDir);
const effects = new Effects(effectsStore, fx => hub.sendFx(fx));
const hub = new Hub(db, board, cfg, effects, () => void shutdown(), useFakeBoard);
// After git pull the file changes under a running server: take it, relight the base, refresh open pages.
effectsStore.onChange = () => {
  if (effectsStore.error) console.warn(`Effects file not taken: ${effectsStore.error}`);
  effects.applyBase();
  hub.broadcast();
};
effectsStore.watch();

await app.register(fastifyWebsocket);
effectsRoutes(app, effects, () => hub.broadcast());

const isLoopback = (ip: string) => ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

app.get('/ws', { websocket: true }, (socket, req) => {
  const ip = req.socket.remoteAddress ?? '';
  // In npm run dev every browser comes through the Vite proxy on this machine, which passes the browser's address on.
  const forwarded = isLoopback(ip) ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '';
  hub.connect(socket, isLoopback(forwarded || ip));
});

app.get('/api/stats/players', async () => stats.list());

app.get<{ Params: { id: string }; Querystring: { window?: string; game?: string } }>('/api/stats/players/:id', async (req, reply) => {
  const { game } = req.query;
  const r = isGameId(game) && game !== 'x01'
    ? stats.game(Number(req.params.id), game, parseWindow(req.query.window))
    : stats.player(Number(req.params.id), parseWindow(req.query.window));
  return r ?? reply.code(404).send({ error: 'No such player' });
});

app.get<{ Querystring: { game?: string } }>('/api/stats/records', async req => (isGameId(req.query.game) ? stats.records(req.query.game) : []));

app.get<{ Querystring: { ids?: string; game?: string; window?: string } }>('/api/stats/heat', async req => {
  const ids = String(req.query.ids ?? '').split(',').map(Number).filter(Number.isInteger).slice(0, 4);
  return stats.heat(ids, isGameId(req.query.game) ? req.query.game : 'x01', parseWindow(req.query.window));
});

app.get<{ Querystring: { a?: string; b?: string; window?: string } }>('/api/stats/h2h', async (req, reply) => {
  const r = stats.h2h(Number(req.query.a), Number(req.query.b), parseWindow(req.query.window));
  return r ?? reply.code(404).send({ error: 'Pick two players' });
});

// The caller's recordings are part of the app, not of the effects setup (docs/EFEKTY.md#caller).
await app.register(fastifyStatic, { root: resolve(CALLER_DIR), prefix: '/caller/', decorateReply: false });

const webRoot = cfg.webDir;
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
    // Sound plays without a click (docs/EFEKTY.md).
    '--autoplay-policy=no-user-gesture-required',
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
