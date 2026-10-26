// Effects storage (docs/EFEKTY.md): settings, the Biblioteka dźwięków and the Reguły. Files live in data/sounds/, the rest in SQLite.
import { randomUUID } from 'node:crypto';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Trigger } from '../../games/effects.ts';
import { isValidTrigger } from '../../games/effects.ts';
import type { Db } from '../db.ts';
import { UserError } from '../db.ts';

export type BaseState = 'lobby' | 'match' | 'takeout' | 'offline';
export const BASE_STATES: BaseState[] = ['lobby', 'match', 'takeout', 'offline'];

export interface EffectsSettings {
  /** Pilot switches. */
  sounds: boolean;
  leds: boolean;
  /** Effects volume in %, on top of each sound's own volume. */
  volume: number;
  /** The built-in swoosh on the next player; off for those who put their own sound on “Takeout end”. */
  swoosh: boolean;
  wled: {
    /** host or host:port; empty when there is no controller. */
    address: string;
    /** Preset per Stan bazowy, or null to leave the lights alone. */
    base: Record<BaseState, number | null>;
  };
}

export const DEFAULT_SETTINGS: EffectsSettings = {
  sounds: true,
  leds: true,
  volume: 80,
  swoosh: true,
  wled: { address: '', base: { lobby: null, match: null, takeout: null, offline: null } },
};

export interface Sound {
  id: number;
  name: string;
  /** File name in data/sounds/, served at /sounds/<file>. */
  file: string;
  /** 0–200 %: files from different sources differ in loudness. */
  volume: number;
  durationMs: number;
  /** Rules that use it; such a sound cannot be deleted. */
  usedBy: number;
}

export interface Rule {
  id: number;
  name: string;
  enabled: boolean;
  triggers: Trigger[];
  /** Variants from the library, one picked at random each time. */
  sounds: number[];
  /** WLED preset and how long it plays. */
  led: { preset: number; seconds: number } | null;
}

export type RuleInput = Omit<Rule, 'id'>;

export const MAX_SOUND_BYTES = 5 * 1024 * 1024;
export const MAX_SOUND_MS = 10_000;

/** Recognizes mp3, wav and ogg by their first bytes. */
export function soundType(buf: Buffer): 'mp3' | 'wav' | 'ogg' | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 4).toString('latin1') === 'OggS') return 'ogg';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WAVE') return 'wav';
  if (buf.subarray(0, 3).toString('latin1') === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'mp3';
  return null;
}

const int = (v: unknown, lo: number, hi: number): number | null => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : null);

function cleanSoundName(name: unknown): string {
  const n = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (!n) throw new UserError('Name is empty');
  if (n.length > 40) throw new UserError('Name is too long (max 40)');
  return n;
}

export class EffectsStore {
  readonly soundsDir: string;

  constructor(private db: Db, dataDir: string) {
    this.soundsDir = join(dataDir, 'sounds');
    mkdirSync(this.soundsDir, { recursive: true });
  }

  // ---------- settings ----------

  settings(): EffectsSettings {
    const row = this.db.sql.prepare("SELECT value FROM settings WHERE key = 'effects'").get() as { value: string } | undefined;
    const s = row ? (JSON.parse(row.value) as Partial<EffectsSettings>) : {};
    return { ...DEFAULT_SETTINGS, ...s, wled: { ...DEFAULT_SETTINGS.wled, ...s.wled, base: { ...DEFAULT_SETTINGS.wled.base, ...s.wled?.base } } };
  }

  /** Takes any part of the settings; anything malformed is an error. */
  updateSettings(patch: unknown): EffectsSettings {
    const p = (patch ?? {}) as Record<string, unknown>;
    const s = this.settings();
    if ('sounds' in p) s.sounds = !!p.sounds;
    if ('leds' in p) s.leds = !!p.leds;
    if ('swoosh' in p) s.swoosh = !!p.swoosh;
    if ('volume' in p) s.volume = int(p.volume, 0, 100) ?? fail('Volume is 0–100');
    if (p.wled && typeof p.wled === 'object') {
      const w = p.wled as Record<string, unknown>;
      if ('address' in w) {
        const a = typeof w.address === 'string' ? w.address.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') : '';
        if (a && !/^[\w.-]+(:\d{1,5})?$/.test(a)) throw new UserError('Address is host or host:port, e.g. 192.168.1.50');
        s.wled.address = a;
      }
      if (w.base && typeof w.base === 'object') {
        for (const [k, v] of Object.entries(w.base as Record<string, unknown>)) {
          if (!BASE_STATES.includes(k as BaseState)) continue;
          s.wled.base[k as BaseState] = v === null ? null : int(v, 1, 250) ?? fail('Preset is 1–250');
        }
      }
    }
    this.db.sql.prepare("INSERT INTO settings (key, value) VALUES ('effects', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(s));
    return s;
  }

  // ---------- rules ----------

  rules(): Rule[] {
    const rows = this.db.sql.prepare('SELECT * FROM effect_rules ORDER BY id').all() as
      { id: number; name: string; enabled: number; triggers: string; sounds: string; led_preset: number | null; led_seconds: number }[];
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      enabled: !!r.enabled,
      triggers: JSON.parse(r.triggers),
      sounds: JSON.parse(r.sounds),
      led: r.led_preset === null ? null : { preset: r.led_preset, seconds: r.led_seconds },
    }));
  }

  private checkRule(input: unknown): RuleInput {
    const r = (input ?? {}) as Record<string, unknown>;
    const name = typeof r.name === 'string' ? r.name.trim().slice(0, 40) : '';
    if (!Array.isArray(r.triggers) || r.triggers.length === 0) throw new UserError('Pick at least one trigger');
    if (!r.triggers.every(isValidTrigger)) throw new UserError('Invalid trigger');
    const known = new Set(this.sounds().map(s => s.id));
    const sounds = Array.isArray(r.sounds) ? [...new Set(r.sounds)] : [];
    if (!sounds.every(id => known.has(id as number))) throw new UserError('Unknown sound');
    let led: Rule['led'] = null;
    if (r.led && typeof r.led === 'object') {
      const l = r.led as Record<string, unknown>;
      const preset = int(l.preset, 1, 250) ?? fail('Preset is 1–250');
      const seconds = typeof l.seconds === 'number' && l.seconds >= 0.1 && l.seconds <= 60 ? Math.round(l.seconds * 10) / 10 : fail('Duration is 0.1–60 s');
      led = { preset, seconds };
    }
    if (sounds.length === 0 && !led) throw new UserError('Add a sound or an LED preset');
    return { name, enabled: r.enabled !== false, triggers: r.triggers, sounds: sounds as number[], led };
  }

  createRule(input: unknown): number {
    const r = this.checkRule(input);
    return Number(this.db.sql.prepare(
      'INSERT INTO effect_rules (name, enabled, triggers, sounds, led_preset, led_seconds, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(r.name, r.enabled ? 1 : 0, JSON.stringify(r.triggers), JSON.stringify(r.sounds), r.led?.preset ?? null, r.led?.seconds ?? 1, Date.now()).lastInsertRowid);
  }

  updateRule(id: number, input: unknown) {
    const r = this.checkRule(input);
    const res = this.db.sql.prepare('UPDATE effect_rules SET name = ?, enabled = ?, triggers = ?, sounds = ?, led_preset = ?, led_seconds = ? WHERE id = ?')
      .run(r.name, r.enabled ? 1 : 0, JSON.stringify(r.triggers), JSON.stringify(r.sounds), r.led?.preset ?? null, r.led?.seconds ?? 1, id);
    if (!res.changes) throw new UserError('No such rule');
  }

  deleteRule(id: number) {
    this.db.sql.prepare('DELETE FROM effect_rules WHERE id = ?').run(id);
  }

  // ---------- sound library ----------

  sounds(): Sound[] {
    const used = new Map<number, number>();
    for (const r of this.rules()) for (const s of r.sounds) used.set(s, (used.get(s) ?? 0) + 1);
    return (this.db.sql.prepare('SELECT id, name, file, volume, duration_ms FROM sounds ORDER BY name COLLATE NOCASE, id').all() as
      { id: number; name: string; file: string; volume: number; duration_ms: number }[])
      .map(s => ({ id: s.id, name: s.name, file: s.file, volume: s.volume, durationMs: s.duration_ms, usedBy: used.get(s.id) ?? 0 }));
  }

  sound(id: number): Sound | null {
    return this.sounds().find(s => s.id === id) ?? null;
  }

  /** The browser measures the length before uploading; the server checks size and format. */
  addSound(buf: Buffer, name: unknown, durationMs: unknown): number {
    if (buf.length > MAX_SOUND_BYTES) throw new UserError('File is larger than 5 MB');
    const type = soundType(buf);
    if (!type) throw new UserError('Use an mp3, wav or ogg file');
    const ms = int(durationMs, 1, MAX_SOUND_MS) ?? fail('Sound is longer than 10 s');
    const clean = cleanSoundName(name);
    const file = `${randomUUID()}.${type}`;
    writeFileSync(join(this.soundsDir, file), buf);
    return Number(this.db.sql.prepare('INSERT INTO sounds (name, file, volume, duration_ms, created_at) VALUES (?, ?, 100, ?, ?)')
      .run(clean, file, ms, Date.now()).lastInsertRowid);
  }

  updateSound(id: number, patch: unknown) {
    const p = (patch ?? {}) as Record<string, unknown>;
    const s = this.sound(id);
    if (!s) throw new UserError('No such sound');
    const name = 'name' in p ? cleanSoundName(p.name) : s.name;
    const volume = 'volume' in p ? int(p.volume, 0, 200) ?? fail('Volume is 0–200 %') : s.volume;
    this.db.sql.prepare('UPDATE sounds SET name = ?, volume = ? WHERE id = ?').run(name, volume, id);
  }

  /** Copies sound files missing from each backup folder's sounds/; files never change once uploaded. */
  backupSounds(dirs: string[]) {
    for (const dir of dirs) cpSync(this.soundsDir, join(dir, 'sounds'), { recursive: true, force: false });
  }

  deleteSound(id: number) {
    const s = this.sound(id);
    if (!s) return;
    if (s.usedBy > 0) throw new UserError(`Used by ${s.usedBy === 1 ? 'a rule' : `${s.usedBy} rules`}`);
    this.db.sql.prepare('DELETE FROM sounds WHERE id = ?').run(id);
    rmSync(join(this.soundsDir, s.file), { force: true });
  }
}

function fail(message: string): never {
  throw new UserError(message);
}
