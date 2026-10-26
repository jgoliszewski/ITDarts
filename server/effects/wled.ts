// WLED client: the server is its only user (docs/EFEKTY.md), over the JSON API.
// An effect is a one-item playlist with "end", so WLED goes back to the base preset by itself.

export interface WledPreset {
  id: number;
  name: string;
  /** First colour of the first segment, `#rrggbb`; null for presets without one (playlists, some effects). */
  color: string | null;
}

interface PresetJson {
  n?: string;
  seg?: { col?: unknown[] }[] | { col?: unknown[] };
}

/** `col[0]` is [r, g, b] or [r, g, b, w], sometimes a hex string. All black counts as none. */
export function presetColor(p: PresetJson): string | null {
  const seg = Array.isArray(p.seg) ? p.seg[0] : p.seg;
  const c = seg?.col?.[0];
  if (typeof c === 'string' && /^#?[0-9a-f]{6}/i.test(c)) return `#${c.replace('#', '').slice(0, 6).toLowerCase()}`;
  if (!Array.isArray(c) || c.length < 3 || !c.slice(0, 3).every(v => Number.isInteger(v) && v >= 0 && v <= 255)) return null;
  const [r, g, b, w = 0] = c as number[];
  // An RGBW strip with only the white channel lit looks white.
  const rgb = r + g + b === 0 && w > 0 ? [w, w, w] : [r, g, b];
  if (rgb.every(v => v === 0)) return null;
  return `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

const TIMEOUT_MS = 2000;

export class Wled {
  /** Last failure, for the effects page; cleared by the next success. */
  error: { text: string; at: number } | null = null;

  constructor(private address: () => string) {}

  get configured() {
    return this.address() !== '';
  }

  private async call(path: string, body?: unknown): Promise<unknown> {
    const addr = this.address();
    if (!addr) throw new Error('No WLED address set');
    try {
      const r = await fetch(`http://${addr}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!r.ok) throw new Error(`WLED answered ${r.status}`);
      this.error = null;
      return await r.json();
    } catch (e) {
      const text = e instanceof Error && e.name === 'TimeoutError' ? `WLED at ${addr} did not answer` : e instanceof Error ? e.message : String(e);
      this.error = { text, at: Date.now() };
      throw new Error(text);
    }
  }

  /** Fire and forget: a missing controller never slows the game down. */
  send(state: Record<string, unknown>) {
    if (this.configured) void this.call('/json/state', state).catch(() => undefined);
  }

  preset(id: number) {
    this.send({ on: true, ps: id });
  }

  /** Plays `id` for `seconds`, then applies `end` (255 lets WLED restore what was on before). */
  effect(id: number, seconds: number, end: number | null) {
    this.send({ on: true, playlist: { ps: [id], dur: [Math.max(1, Math.round(seconds * 10))], transition: [0], repeat: 1, end: end ?? 255 } });
  }

  off() {
    this.send({ on: false });
  }

  async info(): Promise<{ name: string; version: string }> {
    const i = (await this.call('/json/info')) as { name?: string; ver?: string };
    return { name: i.name ?? 'WLED', version: i.ver ?? '?' };
  }

  async presets(): Promise<WledPreset[]> {
    const p = (await this.call('/presets.json')) as Record<string, PresetJson | undefined>;
    return Object.entries(p)
      .map(([id, v]) => ({ id: Number(id), name: v?.n || `Preset ${id}`, color: v ? presetColor(v) : null }))
      .filter(x => Number.isInteger(x.id) && x.id >= 1 && x.id <= 250)
      .sort((a, b) => a.id - b.id);
  }
}
