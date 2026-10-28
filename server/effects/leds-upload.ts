// Saves the LED looks of the Momenty on the controller (docs/EFEKTY.md, Ledy): npm run leds:upload [-- --wled <host>]
// [-- --dry-run]. Without --wled it takes the address set on /effects. Every look in server/effects/leds.ts becomes the
// preset with its fixed number. Presets outside that range are removed, apart from 1 (Gameon) and 3 (the old Bust),
// which were made by hand in the WLED app. The whole presets.json is backed up to data/backups first.
import { mkdirSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { LEDS, PRESET_RANGE, wledPreset, type LedKey } from './leds.ts';

const KEEP = new Set([0, 1, 3]);
const dry = process.argv.includes('--dry-run');

function savedAddress(): string {
  const db = new DatabaseSync('data/itdarts.db', { readOnly: true });
  const row = db.prepare("SELECT value FROM settings WHERE key = 'effects'").get() as { value: string } | undefined;
  db.close();
  return row ? (JSON.parse(row.value).address ?? '') : '';
}

const arg = process.argv.indexOf('--wled');
const wled = arg > 0 ? process.argv[arg + 1] : savedAddress();
if (!wled) throw new Error('No WLED address: pass --wled <host> or set it on /effects');

const r = await fetch(`http://${wled}/presets.json`, { signal: AbortSignal.timeout(5000) });
if (!r.ok) throw new Error(`WLED answered ${r.status}`);
const old = (await r.json()) as Record<string, { n?: string } | undefined>;

const presets: Record<string, unknown> = {};
for (const [id, p] of Object.entries(old)) {
  const n = Number(id);
  const ours = n >= PRESET_RANGE[0] && n <= PRESET_RANGE[1];
  if (KEEP.has(n)) presets[id] = p;
  else console.log(`remove ${String(n).padStart(3)}  ${p?.n ?? ''}${ours ? ' (replaced or no longer used)' : ''}`);
}
for (const key of Object.keys(LEDS) as LedKey[]) {
  presets[LEDS[key].preset] = wledPreset(key);
  console.log(`write  ${String(LEDS[key].preset).padStart(3)}  ${LEDS[key].name}`);
}

if (dry) {
  console.log('Dry run: nothing changed on the controller.');
} else {
  mkdirSync('data/backups', { recursive: true });
  const backup = `data/backups/wled-presets-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  writeFileSync(backup, JSON.stringify(old));
  const body = new FormData();
  body.append('data', new Blob([JSON.stringify(presets)], { type: 'application/json' }), '/presets.json');
  const up = await fetch(`http://${wled}/upload`, { method: 'POST', body, signal: AbortSignal.timeout(10000) });
  if (!up.ok) throw new Error(`Upload failed: WLED answered ${up.status}`);
  console.log(`Presets uploaded to ${wled}. Backup: ${backup}`);
}
