// Effects storage (docs/EFEKTY.md, Konfiguracja w repo). Rules, the Biblioteka dźwięków and the shared settings live in
// effects/effects.json and effects/sounds/ in the repo, so a setup made at home works at the office too. The WLED
// address and the pilot switches belong to one laptop and stay in SQLite.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, watch, writeFileSync } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import { join } from 'node:path';
import type { Trigger } from '../../games/effects.ts';
import { isValidTrigger, normalizeTrigger } from '../../games/effects.ts';
import type { Db } from '../db.ts';
import { UserError } from '../db.ts';
import { slug } from './slug.ts';
import type { BaseRule } from './builtin.ts';
import { BASE_RULES, BUILTIN_SOUNDS, builtinId, builtinKey, isBuiltinSound } from './builtin.ts';
import { ledDefault } from './leds.ts';

export type BaseState = 'lobby' | 'match' | 'takeout' | 'offline';
export const BASE_STATES: BaseState[] = ['lobby', 'match', 'takeout', 'offline'];

export interface EffectsSettings {
  /** Pilot switches (this laptop). */
  sounds: boolean;
  caller: boolean;
  leds: boolean;
  /** Effects volume in %, on top of each sound's own volume (repo). */
  volume: number;
  /** Caller volume in % (repo). */
  callerVolume: number;
  /** The caller's voice: a folder in assets/caller/ (repo). */
  callerVoice: string;
  /** Volume of a built-in sound in %, by key, only where it is not 100 (repo). */
  builtinVolume: Record<string, number>;
  wled: {
    /** host or host:port; empty when there is no controller (this laptop). */
    address: string;
    /** Preset per Stan bazowy, or null to leave the lights alone (repo). */
    base: Record<BaseState, number | null>;
  };
}

export interface Sound {
  /** The file name in effects/sounds/, served at /sounds/<file>, or `builtin:<key>` for a sound the kiosk synthesizes; rules point at it. */
  id: string;
  name: string;
  /** Empty for a built-in sound. */
  file: string;
  /**
   * What to play: `/sounds/<file>?v=<mtime>`, or the id of a built-in sound. The version changes when another file
   * takes the same name (deleted and uploaded again, or changed by git), so the kiosk does not play the old one.
   */
  url: string;
  /** The key of a built-in sound, with what it was made for; its volume is the only thing to change. */
  builtin: { key: string; info: string } | null;
  /** 0–200 %: files from different sources differ in loudness. */
  volume: number;
  durationMs: number;
  /** Rules that use it; such a sound cannot be deleted. */
  usedBy: number;
}

export interface Rule {
  /** Short and random, so rules added at home and at work never clash. */
  id: string;
  name: string;
  enabled: boolean;
  triggers: Trigger[];
  /** Variants from the library (file names), one picked at random each time. */
  sounds: string[];
  /** WLED preset and how long it plays. */
  led: { preset: number; seconds: number } | null;
  /** What “Reset to default” brings back; only on a base rule (builtin.ts). */
  base?: { name: string; triggers: Trigger[]; sounds: string[]; led: Rule['led'] };
}

export type RuleInput = Omit<Rule, 'id' | 'base'>;

/** What effects/effects.json holds. Keys are written in this order. */
interface EffectsFile {
  version: 1;
  settings: { volume: number; callerVolume: number; callerVoice: string; builtinVolume: Record<string, number>; base: Record<BaseState, number | null> };
  sounds: { file: string; name: string; volume: number; durationMs: number }[];
  rules: Rule[];
}

interface LocalSettings {
  sounds: boolean;
  caller: boolean;
  leds: boolean;
  address: string;
}

/** Every file stays in git history, so the limit is lower than a browser would need. */
export const MAX_SOUND_BYTES = 2 * 1024 * 1024;
export const MAX_SOUND_MS = 10_000;
export const SOUND_FILE = /^[a-z0-9][a-z0-9-]*\.(mp3|wav|ogg)$/;
const RULE_ID = /^[a-z0-9][a-z0-9-]{0,23}$/;
export const CALLER_VOICE = /^[a-z0-9-]{1,32}$/;

const EMPTY: EffectsFile = {
  version: 1,
  settings: { volume: 80, callerVolume: 80, callerVoice: 'brian', builtinVolume: {}, base: { lobby: null, match: null, takeout: null, offline: null } },
  sounds: [],
  rules: [],
};

/** Recognizes mp3, wav and ogg by their first bytes. */
export function soundType(buf: Buffer): 'mp3' | 'wav' | 'ogg' | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 4).toString('latin1') === 'OggS') return 'ogg';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WAVE') return 'wav';
  if (buf.subarray(0, 3).toString('latin1') === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return 'mp3';
  return null;
}

/** A built-in sound's volume until it is changed on the page. */
const defaultVolume = (key: string) => BUILTIN_SOUNDS.find(s => s.key === key)?.volume ?? 100;

/** What a base rule holds by default, LEDs included; “Reset to default” brings it back. */
const baseDefaults = (b: BaseRule) => ({ name: b.name, triggers: b.triggers.map(normalizeTrigger), sounds: b.sound ? [b.sound] : [], led: b.led ? ledDefault(b.led) : null });

const int = (v: unknown, lo: number, hi: number): number | null => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : null);

function fail(message: string): never {
  throw new UserError(message);
}

function cleanSoundName(name: unknown): string {
  const n = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';
  if (!n) throw new UserError('Name is empty');
  if (n.length > 40) throw new UserError('Name is too long (max 40)');
  return n;
}

function checkPreset(v: unknown): number | null {
  return v === null || v === undefined ? null : int(v, 1, 250) ?? fail('Preset is 1–250');
}

/** A rule's body, checked; `sounds` must name files in the library or built-in sounds. */
function checkRuleBody(input: unknown, files: Set<string>): RuleInput {
  const r = (input ?? {}) as Record<string, unknown>;
  const name = typeof r.name === 'string' ? r.name.trim().slice(0, 40) : '';
  if (!Array.isArray(r.triggers) || r.triggers.length === 0) fail('Pick at least one trigger');
  if (!r.triggers.every(isValidTrigger)) fail('Invalid trigger');
  const sounds = Array.isArray(r.sounds) ? [...new Set(r.sounds)] : [];
  if (!sounds.every(f => typeof f === 'string' && (files.has(f) || isBuiltinSound(f)))) fail('Unknown sound');
  let led: Rule['led'] = null;
  if (r.led && typeof r.led === 'object') {
    const l = r.led as Record<string, unknown>;
    const preset = int(l.preset, 1, 250) ?? fail('Preset is 1–250');
    const seconds = typeof l.seconds === 'number' && l.seconds >= 0.1 && l.seconds <= 60 ? Math.round(l.seconds * 10) / 10 : fail('Duration is 0.1–60 s');
    led = { preset, seconds };
  }
  // A rule with neither a sound nor LEDs is allowed: it waits for one (e.g. the starter set) and plays nothing.
  return { name, enabled: r.enabled !== false, triggers: r.triggers.map(normalizeTrigger), sounds: sounds as string[], led };
}

/** Reads effects.json; throws with a message that says what is wrong and where. */
export function parseEffectsFile(text: string): EffectsFile {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`Not valid JSON${/^[<=>]{7}/m.test(text) ? ' (git conflict markers?)' : ''}: ${e instanceof Error ? e.message : e}`);
  }
  if (!raw || typeof raw !== 'object' || raw.version !== 1) throw new Error('Unknown version; expected "version": 1');
  const where = (what: string, f: () => void) => {
    try {
      f();
    } catch (e) {
      throw new Error(`${what}: ${e instanceof Error ? e.message : e}`);
    }
  };
  const s = (raw.settings ?? {}) as Record<string, unknown>;
  const settings = structuredClone(EMPTY.settings);
  where('settings', () => {
    if ('volume' in s) settings.volume = int(s.volume, 0, 100) ?? fail('volume is 0–100');
    if ('callerVolume' in s) settings.callerVolume = int(s.callerVolume, 0, 100) ?? fail('callerVolume is 0–100');
    if ('callerVoice' in s) settings.callerVoice = typeof s.callerVoice === 'string' && CALLER_VOICE.test(s.callerVoice) ? s.callerVoice : fail('callerVoice is a folder name in assets/caller, like brian');
    // `swoosh` switched the hard-coded Next player sound; it is the rule b-next-player now, and the key is ignored.
    for (const [k, v] of Object.entries((s.builtinVolume ?? {}) as Record<string, unknown>)) {
      if (!isBuiltinSound(builtinId(k))) fail(`builtinVolume: no built-in sound "${k}"`);
      settings.builtinVolume[k] = int(v, 0, 200) ?? fail(`builtinVolume.${k} is 0–200`);
    }
    const base = (s.base ?? {}) as Record<string, unknown>;
    for (const b of BASE_STATES) settings.base[b] = checkPreset(base[b]);
  });
  const sounds: EffectsFile['sounds'] = [];
  for (const x of (raw.sounds ?? []) as Record<string, unknown>[]) {
    where(`sound ${JSON.stringify(x?.file)}`, () => {
      const file = typeof x.file === 'string' && SOUND_FILE.test(x.file) ? x.file : fail('file must be like crowd-roar.mp3');
      if (sounds.some(o => o.file === file)) fail('listed twice');
      sounds.push({ file, name: cleanSoundName(x.name), volume: int(x.volume, 0, 200) ?? fail('volume is 0–200'), durationMs: int(x.durationMs, 1, MAX_SOUND_MS) ?? fail('durationMs is 1–10000') });
    });
  }
  const files = new Set(sounds.map(x => x.file));
  const rules: Rule[] = [];
  for (const x of (raw.rules ?? []) as Record<string, unknown>[]) {
    where(`rule ${JSON.stringify(x?.id)}`, () => {
      const id = typeof x.id === 'string' && RULE_ID.test(x.id) ? x.id : fail('id must be short letters and digits');
      if (rules.some(o => o.id === id)) fail('id used twice');
      rules.push({ id, ...checkRuleBody(x, files) });
    });
  }
  return { version: 1, settings, sounds, rules };
}

/** Same object, same text: fixed key order and a final newline. */
export function formatEffectsFile(f: EffectsFile): string {
  const out: EffectsFile = {
    version: 1,
    settings: { volume: f.settings.volume, callerVolume: f.settings.callerVolume, callerVoice: f.settings.callerVoice, builtinVolume: Object.fromEntries(Object.entries(f.settings.builtinVolume).filter(([k, v]) => v !== defaultVolume(k)).sort()), base: { lobby: f.settings.base.lobby, match: f.settings.base.match, takeout: f.settings.base.takeout, offline: f.settings.base.offline } },
    sounds: f.sounds.map(s => ({ file: s.file, name: s.name, volume: s.volume, durationMs: s.durationMs })),
    rules: f.rules.map(r => ({ id: r.id, name: r.name, enabled: r.enabled, triggers: r.triggers.map(normalizeTrigger), sounds: r.sounds, led: r.led && { preset: r.led.preset, seconds: r.led.seconds } })),
  };
  return `${JSON.stringify(out, null, 2)}\n`;
}

export class EffectsStore {
  readonly file: string;
  readonly soundsDir: string;
  /** Why effects.json on disk was not taken; the last good version stays in use. */
  error: string | null = null;
  /** Goes up with every change, from the page or from the file, so open pages fetch again. */
  rev = 0;
  /** Runs after the file was reloaded from disk (or failed to). */
  onChange: () => void = () => undefined;
  private data: EffectsFile = structuredClone(EMPTY);
  private written = '';
  private watcher: FSWatcher | null = null;
  private timer: NodeJS.Timeout | null = null;

  /** `baseRules` is a parameter for the tests; the app always has BASE_RULES. */
  constructor(private db: Db, readonly dir: string, dataDir: string, private baseRules: BaseRule[] = BASE_RULES) {
    this.file = join(dir, 'effects.json');
    this.soundsDir = join(dir, 'sounds');
    mkdirSync(this.soundsDir, { recursive: true });
    const moved = !existsSync(this.file);
    if (moved) {
      this.data = this.fromDb(dataDir);
      this.ensureBase();
      this.save();
    } else this.load();
    this.dropOldTables(moved);
  }

  /**
   * Every base rule is in the file (docs/EFEKTY.md, Reguły bazowe). A missing one is added with its default sound; an
   * older starter rule with the same name (or an alias) becomes it and keeps what it has, apart from an empty sound list,
   * which gets the default. Saves when anything changed.
   */
  private ensureBase() {
    let changed = false;
    for (const b of this.baseRules) {
      if (this.data.rules.some(r => r.id === b.id)) continue;
      const names = [b.name, ...(b.aliases ?? [])].map(n => n.toLowerCase());
      const old = this.data.rules.find(r => !this.baseRules.some(x => x.id === r.id) && names.includes(r.name.trim().toLowerCase()));
      if (old) {
        old.id = b.id;
        if (old.sounds.length === 0 && b.sound) old.sounds = [b.sound];
      } else this.data.rules.push({ id: b.id, ...baseDefaults(b), enabled: true });
      changed = true;
    }
    if (changed) this.save();
  }

  // ---------- the file ----------

  /** Takes effects.json from disk unless it is the text this server wrote itself. */
  load(): boolean {
    let text: string;
    try {
      text = readFileSync(this.file, 'utf8');
    } catch (e) {
      this.error = `Cannot read ${this.file}: ${e instanceof Error ? e.message : e}`;
      return false;
    }
    if (text === this.written && !this.error) return false;
    try {
      this.data = parseEffectsFile(text);
      this.written = text;
      this.error = null;
      this.ensureBase();
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
    this.rev++;
    return true;
  }

  private save() {
    const text = formatEffectsFile(this.data);
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, text);
    renameSync(tmp, this.file);
    this.written = text;
    this.error = null;
    this.rev++;
  }

  /** Reloads when the file changes on disk, e.g. after git pull. Watches the folder, since git replaces the file. */
  watch() {
    this.watcher = watch(this.dir, (_e, name) => {
      if (name !== 'effects.json') return;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.load() && this.onChange(), 150);
    });
  }

  close() {
    this.watcher?.close();
    if (this.timer) clearTimeout(this.timer);
  }

  // ---------- settings ----------

  private local(): LocalSettings {
    const row = this.db.sql.prepare("SELECT value FROM settings WHERE key = 'effects'").get() as { value: string } | undefined;
    // Older rows held every setting; only the local ones are read now.
    const s = row ? (JSON.parse(row.value) as Partial<LocalSettings> & { wled?: { address?: string } }) : {};
    return { sounds: s.sounds ?? true, caller: s.caller ?? true, leds: s.leds ?? true, address: s.address ?? s.wled?.address ?? '' };
  }

  private saveLocal(l: LocalSettings) {
    this.db.sql.prepare("INSERT INTO settings (key, value) VALUES ('effects', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(l));
  }

  settings(): EffectsSettings {
    const l = this.local();
    const s = this.data.settings;
    return {
      sounds: l.sounds, caller: l.caller, leds: l.leds, volume: s.volume, callerVolume: s.callerVolume, callerVoice: s.callerVoice,
      builtinVolume: { ...s.builtinVolume },
      wled: { address: l.address, base: { ...s.base } },
    };
  }

  /** Takes any part of the settings; anything malformed is an error. Local ones go to SQLite, the rest to the file. */
  updateSettings(patch: unknown): EffectsSettings {
    const p = (patch ?? {}) as Record<string, unknown>;
    const l = this.local();
    const s = structuredClone(this.data.settings);
    if ('sounds' in p) l.sounds = !!p.sounds;
    if ('caller' in p) l.caller = !!p.caller;
    if ('leds' in p) l.leds = !!p.leds;
    if ('volume' in p) s.volume = int(p.volume, 0, 100) ?? fail('Volume is 0–100');
    if ('callerVolume' in p) s.callerVolume = int(p.callerVolume, 0, 100) ?? fail('Caller volume is 0–100');
    if ('callerVoice' in p) s.callerVoice = typeof p.callerVoice === 'string' && CALLER_VOICE.test(p.callerVoice) ? p.callerVoice : fail('Pick a caller voice from the list');
    if (p.wled && typeof p.wled === 'object') {
      const w = p.wled as Record<string, unknown>;
      if ('address' in w) {
        const a = typeof w.address === 'string' ? w.address.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') : '';
        if (a && !/^[\w.-]+(:\d{1,5})?$/.test(a)) fail('Address is host or host:port, e.g. 192.168.1.50');
        l.address = a;
      }
      if (w.base && typeof w.base === 'object') {
        for (const [k, v] of Object.entries(w.base as Record<string, unknown>)) {
          if (BASE_STATES.includes(k as BaseState)) s.base[k as BaseState] = checkPreset(v);
        }
      }
    }
    this.saveLocal(l);
    if (JSON.stringify(s) !== JSON.stringify(this.data.settings)) {
      this.data.settings = s;
      this.save();
    }
    return this.settings();
  }

  // ---------- rules ----------

  rules(): Rule[] {
    return this.data.rules.map(r => {
      const b = this.baseRules.find(x => x.id === r.id);
      return structuredClone(b ? { ...r, base: baseDefaults(b) } : r);
    });
  }

  /** Checks a rule from the page; also used by “Test whole rule”, which plays a rule that is not saved. */
  checkRule(input: unknown): RuleInput {
    return checkRuleBody(input, new Set(this.data.sounds.map(s => s.file)));
  }

  private newId(rules = this.data.rules): string {
    for (;;) {
      const id = `r${Math.random().toString(36).slice(2, 6)}`;
      if (id.length === 5 && !rules.some(r => r.id === id)) return id;
    }
  }

  createRule(input: unknown): string {
    const r = { id: this.newId(), ...this.checkRule(input) };
    this.data.rules.push(r);
    this.save();
    return r.id;
  }

  updateRule(id: string, input: unknown) {
    const i = this.data.rules.findIndex(r => r.id === id);
    if (i < 0) fail('No such rule');
    this.data.rules[i] = { id, ...this.checkRule(input) };
    this.save();
  }

  deleteRule(id: string) {
    if (this.baseRules.some(b => b.id === id)) fail('A built-in rule cannot be deleted. Switch it off instead');
    const before = this.data.rules.length;
    this.data.rules = this.data.rules.filter(r => r.id !== id);
    if (this.data.rules.length !== before) this.save();
  }

  // ---------- sound library ----------

  /** Built-in sounds first, in their own order, then the files by name. */
  sounds(): Sound[] {
    const used = (id: string) => this.data.rules.filter(r => r.sounds.includes(id)).length;
    const builtin: Sound[] = BUILTIN_SOUNDS.map(b => ({
      id: builtinId(b.key), name: b.name, file: '', url: builtinId(b.key), builtin: { key: b.key, info: b.info }, volume: this.data.settings.builtinVolume[b.key] ?? defaultVolume(b.key), durationMs: b.durationMs, usedBy: used(builtinId(b.key)),
    }));
    const files: Sound[] = this.data.sounds
      .map(s => ({ id: s.file, name: s.name, file: s.file, url: this.fileUrl(s.file), builtin: null, volume: s.volume, durationMs: s.durationMs, usedBy: used(s.file) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) || a.file.localeCompare(b.file));
    return [...builtin, ...files];
  }

  private fileUrl(file: string): string {
    let v = 0;
    try {
      v = Math.round(statSync(join(this.soundsDir, file)).mtimeMs);
    } catch {
      // a missing file answers 404 either way
    }
    return `/sounds/${file}?v=${v}`;
  }

  sound(id: string): Sound | null {
    return this.sounds().find(s => s.id === id) ?? null;
  }

  private freeName(name: string, ext: string): string {
    const base = slug(name);
    for (let n = 1; ; n++) {
      const file = `${base}${n === 1 ? '' : `-${n}`}.${ext}`;
      if (!this.data.sounds.some(s => s.file === file) && !existsSync(join(this.soundsDir, file))) return file;
    }
  }

  /** The browser measures the length before uploading; the server checks size and format. Returns the file name. */
  addSound(buf: Buffer, name: unknown, durationMs: unknown): string {
    if (buf.length > MAX_SOUND_BYTES) fail('File is larger than 2 MB');
    const type = soundType(buf);
    if (!type) fail('Use an mp3, wav or ogg file');
    const ms = int(durationMs, 1, MAX_SOUND_MS) ?? fail('Sound is longer than 10 s');
    const clean = cleanSoundName(name);
    const file = this.freeName(clean, type);
    writeFileSync(join(this.soundsDir, file), buf);
    this.data.sounds.push({ file, name: clean, volume: 100, durationMs: ms });
    this.save();
    return file;
  }

  updateSound(id: string, patch: unknown) {
    const p = (patch ?? {}) as Record<string, unknown>;
    const key = builtinKey(id);
    if (key !== null) {
      if (!isBuiltinSound(id)) fail('No such sound');
      if ('name' in p) fail('A built-in sound keeps its name');
      if ('volume' in p) this.data.settings.builtinVolume[key] = int(p.volume, 0, 200) ?? fail('Volume is 0–200 %');
      this.save();
      return;
    }
    const s = this.data.sounds.find(x => x.file === id) ?? fail('No such sound');
    if ('name' in p) s.name = cleanSoundName(p.name);
    if ('volume' in p) s.volume = int(p.volume, 0, 200) ?? fail('Volume is 0–200 %');
    this.save();
  }

  deleteSound(id: string) {
    if (builtinKey(id) !== null) fail('A built-in sound cannot be deleted');
    const s = this.sound(id);
    if (!s) return;
    if (s.usedBy > 0) fail(`Used by ${s.usedBy === 1 ? 'a rule' : `${s.usedBy} rules`}`);
    this.data.sounds = this.data.sounds.filter(x => x.file !== id);
    this.save();
    rmSync(join(this.soundsDir, id), { force: true });
  }

  // ---------- moving from SQLite (migration 3) to the repo ----------

  private oldTables(): boolean {
    return !!this.db.sql.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'effect_rules'").get();
  }

  /** The first start without effects.json takes what SQLite held: rules, sounds and their files, shared settings. */
  private fromDb(dataDir: string): EffectsFile {
    const f = structuredClone(EMPTY);
    const old = this.db.sql.prepare("SELECT value FROM settings WHERE key = 'effects'").get() as { value: string } | undefined;
    if (old) {
      const s = JSON.parse(old.value) as { volume?: number; wled?: { base?: Record<string, number | null> } };
      if (int(s.volume, 0, 100) !== null) f.settings.volume = s.volume!;
      for (const b of BASE_STATES) f.settings.base[b] = int(s.wled?.base?.[b], 1, 250);
    }
    if (!this.oldTables()) return f;
    const files = new Map<number, string>();
    const rows = this.db.sql.prepare('SELECT id, name, file, volume, duration_ms FROM sounds ORDER BY id').all() as
      { id: number; name: string; file: string; volume: number; duration_ms: number }[];
    for (const s of rows) {
      const from = join(dataDir, 'sounds', s.file);
      if (!existsSync(from)) continue;
      const file = this.freeName(s.name, s.file.split('.').pop()!);
      copyFileSync(from, join(this.soundsDir, file));
      files.set(s.id, file);
      f.sounds.push({ file, name: s.name, volume: s.volume, durationMs: s.duration_ms });
    }
    const rules = this.db.sql.prepare('SELECT * FROM effect_rules ORDER BY id').all() as
      { name: string; enabled: number; triggers: string; sounds: string; led_preset: number | null; led_seconds: number }[];
    for (const r of rules) {
      const sounds = (JSON.parse(r.sounds) as number[]).flatMap(id => files.get(id) ?? []);
      const led = r.led_preset === null ? null : { preset: r.led_preset, seconds: r.led_seconds };
      if (sounds.length === 0 && !led) continue;
      f.rules.push({ id: this.newId(f.rules), name: r.name, enabled: !!r.enabled, triggers: (JSON.parse(r.triggers) as Trigger[]).map(normalizeTrigger), sounds, led });
    }
    return f;
  }

  /**
   * The old tables go once the file holds their effects. When the file came from git instead (e.g. made at home) and
   * this database has effects of its own, they stay, so nothing is lost without a word.
   */
  private dropOldTables(moved: boolean) {
    if (!this.oldTables()) return;
    const n = (this.db.sql.prepare('SELECT COUNT(*) AS n FROM effect_rules').get() as { n: number }).n
      + (this.db.sql.prepare('SELECT COUNT(*) AS n FROM sounds').get() as { n: number }).n;
    if (!moved && n > 0) {
      console.warn(`Effects: ${this.file} came from the repo, but this database has its own effects. They stay in SQLite and are not used.`);
      return;
    }
    this.db.sql.exec('DROP TABLE effect_rules; DROP TABLE sounds;');
  }
}
