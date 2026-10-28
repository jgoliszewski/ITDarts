import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Config {
  port: number;
  /** Board Manager address, host:port. */
  board: string;
  dataDir: string;
  /** Effects setup kept in the repo (docs/EFEKTY.md, Konfiguracja w repo). */
  effectsDir: string;
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
  extraBackupDir: null,
  browser: null,
  kiosk: false,
  ocheMeters: 2.37,
};

/** config.json in the repo root, then command line flags: --board host:port, --port N, --kiosk. */
export function loadConfig(argv = process.argv.slice(2)): Config {
  const file = resolve('config.json');
  const fromFile = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Partial<Config>) : {};
  const cfg: Config = { ...DEFAULTS, ...fromFile };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--board') cfg.board = argv[++i];
    else if (argv[i] === '--port') cfg.port = Number(argv[++i]);
    else if (argv[i] === '--kiosk') cfg.kiosk = true;
    else if (argv[i] === '--data') cfg.dataDir = argv[++i];
  }
  cfg.dataDir = resolve(cfg.dataDir);
  cfg.effectsDir = resolve(cfg.effectsDir);
  return cfg;
}
