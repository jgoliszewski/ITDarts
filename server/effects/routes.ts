// REST for the “Effects” page: open to everyone in the LAN, no pilot needed (docs/EFEKTY.md).
import { createReadStream, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { UserError } from '../db.ts';
import { CALLER_DIR, type Effects } from './index.ts';
import { MAX_SOUND_BYTES, SOUND_FILE } from './store.ts';

export interface EffectsResponse {
  settings: ReturnType<Effects['store']['settings']>;
  rules: ReturnType<Effects['store']['rules']>;
  sounds: ReturnType<Effects['store']['sounds']>;
  wledError: { text: string; at: number } | null;
  /** The effects file in the repo, and why it was not taken when it is broken (the last good version is in use). */
  file: { path: string; error: string | null };
  /** Folders in assets/caller/, the choices for the caller's voice. */
  callerVoices: string[];
}

/** The voices on disk, so a folder added in git shows up without a restart. */
export function callerVoices(): string[] {
  return readdirSync(CALLER_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name).sort();
}

const MIME: Record<string, string> = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg' };

/** `changed` runs after every edit, so the hub can broadcast the pilot switches and relight the base. */
export function effectsRoutes(app: FastifyInstance, fx: Effects, changed: () => void) {
  const store = fx.store;

  // Runs a store call and turns a UserError into a 400 with its message.
  const guard = async <T>(reply: FastifyReply, run: () => T | Promise<T>) => {
    try {
      const r = await run();
      changed();
      return r ?? { ok: true };
    } catch (e) {
      if (e instanceof UserError) return reply.code(400).send({ error: e.message });
      throw e;
    }
  };

  app.addContentTypeParser(/^(audio\/|application\/octet-stream)/, { parseAs: 'buffer', bodyLimit: MAX_SOUND_BYTES + 1024 }, (_req, body, done) => done(null, body));

  app.get('/api/effects', async (): Promise<EffectsResponse> => ({
    settings: store.settings(), rules: store.rules(), sounds: store.sounds(), wledError: fx.wled.error,
    file: { path: relative(process.cwd(), store.file) || store.file, error: store.error },
    callerVoices: callerVoices(),
  }));

  app.put('/api/effects/settings', async (req, reply) => guard(reply, () => {
    store.updateSettings(req.body);
    fx.applyBase();
  }));

  app.post('/api/effects/rules', async (req, reply) => guard(reply, () => ({ id: store.createRule(req.body) })));
  app.put<{ Params: { id: string } }>('/api/effects/rules/:id', async (req, reply) => guard(reply, () => store.updateRule(req.params.id, req.body)));
  app.delete<{ Params: { id: string } }>('/api/effects/rules/:id', async (req, reply) => guard(reply, () => store.deleteRule(req.params.id)));
  // Not a change, so no broadcast: the LEDs play here, the sound goes back to the page.
  app.post('/api/effects/test', async (req, reply) => {
    try {
      return { sound: fx.test(store.checkRule(req.body)) };
    } catch (e) {
      if (e instanceof UserError) return reply.code(400).send({ error: e.message });
      throw e;
    }
  });

  app.post<{ Querystring: { name?: string; duration?: string } }>('/api/sounds', async (req, reply) => {
    if (!Buffer.isBuffer(req.body)) return reply.code(400).send({ error: 'Send the file as the request body' });
    const body = req.body;
    return guard(reply, () => ({ id: store.addSound(body, req.query.name, Number(req.query.duration)) }));
  });
  app.put<{ Params: { id: string } }>('/api/sounds/:id', async (req, reply) => guard(reply, () => store.updateSound(req.params.id, req.body)));
  app.delete<{ Params: { id: string } }>('/api/sounds/:id', async (req, reply) => guard(reply, () => store.deleteSound(req.params.id)));

  app.get<{ Params: { file: string } }>('/sounds/:file', async (req, reply) => {
    const m = req.params.file.match(SOUND_FILE);
    const path = m && join(store.soundsDir, req.params.file);
    if (!m || !path || !existsSync(path)) return reply.code(404).send({ error: 'Not found' });
    // Readable names can come back with other content (deleted, uploaded again, or changed by git), so always revalidate.
    return reply.type(MIME[m[1]]).header('cache-control', 'no-cache').send(createReadStream(path));
  });

  app.get('/api/wled/info', async (_req, reply) => {
    try {
      return await fx.wled.info();
    } catch (e) {
      return reply.code(502).send({ error: e instanceof Error ? e.message : 'WLED did not answer' });
    }
  });
  app.post<{ Body: { preset?: unknown; seconds?: unknown } }>('/api/wled/preview', async (req, reply) => {
    const { preset, seconds = 3 } = req.body ?? {};
    if (!Number.isInteger(preset) || (preset as number) < 1 || (preset as number) > 250) return reply.code(400).send({ error: 'Preset is 1–250' });
    if (typeof seconds !== 'number' || seconds < 0.1 || seconds > 60) return reply.code(400).send({ error: 'Duration is 0.1–60 s' });
    if (!fx.wled.configured) return reply.code(400).send({ error: 'Set the WLED address first' });
    fx.previewLed(preset as number, seconds);
    return { ok: true };
  });
  app.get('/api/wled/presets', async (_req, reply) => {
    try {
      return await fx.wled.presets();
    } catch (e) {
      return reply.code(502).send({ error: e instanceof Error ? e.message : 'WLED did not answer' });
    }
  });
}
