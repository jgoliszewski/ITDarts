// npm run dev:shot: a throwaway ITDarts for screenshots and live tests, apart from the real one (README.md). Fake board
// on 3380, fake WLED on 3390, the server on 3300, with its own data and a copy of effects/ in a temporary folder and
// the web app built there too. Ctrl+C (or creating <temp folder>/stop, for a script: Windows cannot send a signal that
// a process may answer) stops the three processes it started and deletes the folder. It never touches a
// port or process it did not start: a taken port is an error.
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { networkInterfaces, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SERVER = 3300;
const BOARD = 3380;
const WLED = 3390;
const root = resolve('.');
// An absolute loader, so a child can run from the temporary folder.
const tsx = pathToFileURL(createRequire(import.meta.url).resolve('tsx')).href;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Taken ports are checked on all addresses, as the servers listen there. */
const free = (port: number) => new Promise<boolean>(done => {
  const s = createServer();
  s.once('error', () => done(false));
  s.listen(port, '0.0.0.0', () => s.close(() => done(true)));
});

for (const [port, what] of [[SERVER, 'server'], [BOARD, 'fake board'], [WLED, 'fake WLED']] as const) {
  if (!(await free(port))) {
    console.error(`dev:shot: port ${port} (${what}) is taken, so another dev:shot may be running. Nothing was started or stopped.`);
    process.exit(1);
  }
}

const tmp = mkdtempSync(join(tmpdir(), 'itdarts-shot-'));
const children: ChildProcess[] = [];
let closing = false;

async function cleanup(code: number) {
  if (closing) return;
  closing = true;
  console.log('\ndev:shot: stopping');
  const exits = children.filter(c => c.exitCode === null).map(c => new Promise<void>(r => { c.once('exit', () => r()); c.kill(); }));
  await Promise.race([Promise.all(exits), sleep(5000)]);
  // The server may still be letting go of its database for a moment.
  rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  console.log(`dev:shot: removed ${tmp}`);
  process.exit(code);
}
process.on('SIGINT', () => void cleanup(0));
process.on('SIGTERM', () => void cleanup(0));
const stopFile = setInterval(() => existsSync(join(tmp, 'stop')) && void cleanup(0), 500);
stopFile.unref();

/** A child of ours, run from the repo; one that dies on its own ends the whole thing. */
function start(name: string, script: string, args: string[]) {
  const c = spawn(process.execPath, ['--import', tsx, script, ...args], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] });
  c.on('exit', code => { if (!closing) { console.error(`dev:shot: ${name} stopped (${code})`); void cleanup(1); } });
  children.push(c);
}

async function waitFor(url: string) {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(1000) });
      return;
    } catch {
      await sleep(300);
    }
  }
  throw new Error(`${url} did not answer`);
}

try {
  console.log(`dev:shot: building the web app in ${join(tmp, 'web')}`);
  const build = spawnSync(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', join(tmp, 'web'), '--emptyOutDir', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
  if (build.status !== 0) throw new Error('web build failed');
  cpSync(join(root, 'effects'), join(tmp, 'effects'), { recursive: true });
  mkdirSync(join(tmp, 'data'));

  start('fake board', 'server/fake-board.ts', [String(BOARD)]);
  start('fake WLED', 'server/fake-wled.ts', [String(WLED)]);
  start('server', 'server/index.ts', ['--port', String(SERVER), '--board', `localhost:${BOARD}`, '--data', join(tmp, 'data'), '--effects', join(tmp, 'effects'), '--web', join(tmp, 'web')]);
  await Promise.all([waitFor(`http://localhost:${BOARD}/`), waitFor(`http://localhost:${WLED}/json/info`), waitFor(`http://localhost:${SERVER}/api/effects`)]);

  const r = await fetch(`http://localhost:${SERVER}/api/effects/settings`, {
    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ wled: { address: `localhost:${WLED}` } }),
  });
  if (!r.ok) throw new Error(`setting the WLED address: ${r.status}`);
  // From the temporary folder: the upload writes its backup to ./data/backups.
  const up = spawnSync(process.execPath, ['--import', tsx, join(root, 'server/effects/leds-upload.ts'), '--wled', `localhost:${WLED}`], { cwd: tmp, stdio: ['ignore', 'ignore', 'inherit'] });
  if (up.status !== 0) throw new Error('uploading the presets failed');

  const lan = Object.values(networkInterfaces()).flat().find(i => i && i.family === 'IPv4' && !i.internal)?.address ?? 'localhost';
  console.log(`
dev:shot is up. Ctrl+C stops it and deletes the temporary folder (a script creates the file stop there instead).
  Kiosk        http://localhost:${SERVER}/
  Phone        http://${lan}:${SERVER}/
  Fake board   http://localhost:${BOARD}/   (script: /fake/throw?d=T20, /fake/takeout)
  Fake WLED    http://localhost:${WLED}/    (presets loaded, address set on /effects)
  Temp folder  ${tmp}`);
} catch (e) {
  console.error(`dev:shot: ${e instanceof Error ? e.message : e}`);
  await cleanup(1);
}
