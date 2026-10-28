// LED lab: try candidate WLED presets on the real ring and decide which to keep (server/led-lab/candidates.ts).
// Nothing is saved on the controller; decisions go to data/led-lab.json and the kept presets are uploaded later.
// Run: npm run led-lab [-- --wled 192.168.1.182], then open http://localhost:3195. Without --wled it uses the address from /effects.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import Fastify from 'fastify';
import { build, CANDIDATES, SAVED_IN, type Tweak } from './candidates.ts';
import { call, wled } from './wled.ts';

const PORT = 3195;
const DECISIONS = 'data/led-lab.json';

interface Decision { verdict: 'keep' | 'drop' | 'maybe' | null; note: string; tweak: Tweak }
const decisions: Record<string, Decision> = existsSync(DECISIONS) ? JSON.parse(readFileSync(DECISIONS, 'utf8')) : {};

// A timed candidate goes back to the base preset by itself, like the real effects do.
let back: NodeJS.Timeout | undefined;

const app = Fastify();

app.get('/', async (_req, reply) => reply.type('text/html').send(readFileSync(new URL('page.html', import.meta.url))));

app.get('/api/lab', async () => {
  const raw = (await call('/presets.json').catch(() => ({}))) as Record<string, { n?: string; playlist?: unknown } | undefined>;
  const presets = Object.entries(raw)
    .filter(([id, p]) => Number(id) > 0 && p && !p.playlist)
    .map(([id, p]) => ({ id: Number(id), name: p!.n || `Preset ${id}` }));
  const effects = (await call('/json/eff').catch(() => [])) as string[];
  return { wled, candidates: CANDIDATES, saved: SAVED_IN, presets, effects, decisions };
});

app.post<{ Body: { id?: string; preset?: number; tweak?: Tweak; hold?: boolean; base: number } }>('/api/play', async req => {
  const { id, preset, tweak = {}, hold, base } = req.body;
  clearTimeout(back);
  if (preset !== undefined) {
    // A saved preset plays exactly like a rule would: a one-item playlist ending on the base.
    const dur = tweak.dur ?? 2;
    await call('/json/state', hold ? { on: true, ps: preset } : { on: true, playlist: { ps: [preset], dur: [Math.round(dur * 10)], transition: [0], repeat: 1, end: base } });
    return { ok: true };
  }
  const c = CANDIDATES.find(x => x.id === id);
  if (!c) throw new Error(`No candidate ${id}`);
  await call('/json/state', build(c, tweak));
  const dur = tweak.dur ?? c.dur;
  if (!hold && dur !== null) back = setTimeout(() => void call('/json/state', { on: true, ps: base }).catch(() => undefined), dur * 1000);
  return { ok: true };
});

app.post<{ Body: { base: number } }>('/api/base', async req => {
  clearTimeout(back);
  await call('/json/state', { on: true, ps: req.body.base });
  return { ok: true };
});

app.put<{ Params: { id: string }; Body: Decision }>('/api/decisions/:id', async req => {
  decisions[req.params.id] = req.body;
  writeFileSync(DECISIONS, JSON.stringify(decisions, null, 2));
  return { ok: true };
});

await app.listen({ port: PORT, host: '0.0.0.0' });
console.log(`LED lab on http://localhost:${PORT}/ → WLED ${wled}`);
