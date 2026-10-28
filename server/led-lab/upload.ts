// Puts the LED lab choices into play (npm run led-lab:upload [-- --wled <host>]): saves every candidate that ASSIGN or
// ASSIGN_BASE uses as a preset on the controller, then points the base rules and base states at them through the running
// app. A candidate keeps its preset number between runs (data/led-lab-presets.json), so tuning it and uploading again
// overwrites the same preset. Nothing is deleted. The whole presets.json is backed up to data/backups first.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadConfig } from '../config.ts';
import { ASSIGN, ASSIGN_BASE, BASICS_AND_TRIGGERS, build } from './candidates.ts';
import { call } from './wled.ts';

const MAP = 'data/led-lab-presets.json';
const UNTRIGGERED = ['Base states', 'Minigame events without a sound'];
const APP = `http://localhost:${loadConfig([]).port}`;
const decisions = JSON.parse(readFileSync('data/led-lab.json', 'utf8')) as Record<string, { tweak?: object } | undefined>;
const numbers: Record<string, number> = existsSync(MAP) ? JSON.parse(readFileSync(MAP, 'utf8')) : {};

const used = new Set([...Object.values(ASSIGN).map(([id]) => id), ...Object.values(ASSIGN_BASE)].filter(v => typeof v === 'string'));
const candidates = BASICS_AND_TRIGGERS.filter(c => used.has(c.id));
const missing = [...used].filter(id => !candidates.some(c => c.id === id));
if (missing.length) throw new Error(`Unknown candidates: ${missing.join(', ')}`);

const presets = (await call('/presets.json')) as Record<string, unknown>;
mkdirSync('data/backups', { recursive: true });
const backup = `data/backups/wled-presets-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
writeFileSync(backup, JSON.stringify(presets));

const taken = new Set(Object.keys(presets).map(Number));
const free = () => {
  let n = 1;
  while (taken.has(n)) n++;
  taken.add(n);
  return n;
};

for (const c of candidates) {
  const n = numbers[c.id] ?? free();
  numbers[c.id] = n;
  // The trigger or behaviour goes in front so the app's preset list reads well; WLED caps names at 32 characters.
  const prefix = UNTRIGGERED.includes(c.group) ? '' : `${c.group} · `;
  presets[n] = { ...build(c, decisions[c.id]?.tweak), n: `${prefix}${c.name}`.slice(0, 32) };
  console.log(`preset ${String(n).padStart(3)}  ${c.id}`);
}

const body = new FormData();
body.append('data', new Blob([JSON.stringify(presets)], { type: 'application/json' }), '/presets.json');
await call('/upload', body);
writeFileSync(MAP, JSON.stringify(numbers, null, 2));
console.log(`Presets uploaded. Backup: ${backup}`);

async function app(path: string, method = 'GET', payload?: unknown) {
  const r = await fetch(APP + path, { method, headers: payload ? { 'content-type': 'application/json' } : {}, body: payload === undefined ? undefined : JSON.stringify(payload) });
  if (!r.ok) throw new Error(`${method} ${path}: ${await r.text()}`);
  return r.json();
}

const { rules } = (await app('/api/effects')) as { rules: { id: string; led: unknown }[] };
for (const { id, ...rule } of rules) {
  if (!ASSIGN[id]) continue;
  const [candidate, seconds] = ASSIGN[id];
  const preset = typeof candidate === 'number' ? candidate : numbers[candidate];
  await app(`/api/effects/rules/${id}`, 'PUT', { ...rule, led: { preset, seconds } });
  console.log(`rule ${id.padEnd(22)} → ${preset} for ${seconds} s`);
}
const base = Object.fromEntries(Object.entries(ASSIGN_BASE).map(([k, v]) => [k, typeof v === 'string' ? numbers[v] : v]));
await app('/api/effects/settings', 'PUT', { wled: { base } });
console.log(`base states ${JSON.stringify(base)}`);
