import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Config {
  port: number;
  /** Board Manager address, host:port. */
  board: string;
  dataDir: string;
  /** Effects setup kept in the repo (docs/EFEKTY.md, Konfiguracja w repo). */
  effectsDir: string;
  /** The built web app the server hands out (npm run build puts it in dist/web). */
  webDir: string;
  /** Second backup folder, e.g. a synced OneDrive folder. */
  extraBackupDir: string | null;
  /** Browser opened in kiosk mode with --kiosk. Edge by default. */
  browser: string | null;
  kiosk: boolean;
  /** Oche to board in metres; a visit walks there and back (Distance walked, docs/STATYSTYKI.md). */
  ocheMeters: number;
}

const DEFAULTS: Config = {
  port: 3000,
  board: '192.168.1.183:3180',
  dataDir: 'data',
  effectsDir: 'effects',
  webDir: 'dist/web',
  extraBackupDir: null,
  browser: null,
  kiosk: false,
  ocheMeters: 2.37,
};

/** config.json in the repo root, then command line flags: --board host:port, --port N, --kiosk, --data, --effects, --web (folders). */
export function loadConfig(argv = process.argv.slice(2)): Config {
  const file = resolve('config.json');
  const fromFile = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Partial<Config>) : {};
  const cfg: Config = { ...DEFAULTS, ...fromFile };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--board') cfg.board = argv[++i];
    else if (argv[i] === '--port') cfg.port = Number(argv[++i]);
    else if (argv[i] === '--kiosk') cfg.kiosk = true;
    else if (argv[i] === '--data') cfg.dataDir = argv[++i];
    else if (argv[i] === '--effects') cfg.effectsDir = argv[++i];
    else if (argv[i] === '--web') cfg.webDir = argv[++i];
  }
  cfg.dataDir = resolve(cfg.dataDir);
  cfg.effectsDir = resolve(cfg.effectsDir);
  cfg.webDir = resolve(cfg.webDir);
  return cfg;
}

/**
 * Port of the simulator the “fake board” switch starts: that of a local board address (a side instance such as
 * npm run dev:shot keeps its own), else 3180.
 */
export function fakeBoardPort(board: string): string {
  const m = board.match(/^(?:localhost|127\.0\.0\.1):(\d+)$/);
  return m ? m[1] : '3180';
}
