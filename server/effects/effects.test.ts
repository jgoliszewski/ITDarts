import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Change } from '../../games/effects.ts';
import { Db } from '../db.ts';
import type { Fx } from './index.ts';
import { Effects } from './index.ts';
import { slug } from './slug.ts';
import { EffectsStore, formatEffectsFile, parseEffectsFile, soundType } from './store.ts';
import { presetColor } from './wled.ts';

// Smallest buffers the format check accepts.
const WAV = Buffer.concat([Buffer.from('RIFF\0\0\0\0WAVE', 'latin1'), Buffer.alloc(32)]);
const MP3 = Buffer.concat([Buffer.from('ID3', 'latin1'), Buffer.alloc(32)]);

let dir: string;
let fxDir: string;
let db: Db;
let store: EffectsStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'itdarts-fx-'));
  fxDir = join(dir, 'effects');
  db = new Db(dir);
  store = new EffectsStore(db, fxDir, dir);
});
afterEach(() => {
  store.close();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const t180 = { kind: 'total', total: 180, checkout: 'any' } as const;
const fileText = () => readFileSync(store.file, 'utf8');

describe('effects store', () => {
  it('recognizes mp3, wav and ogg', () => {
    expect(soundType(WAV)).toBe('wav');
    expect(soundType(MP3)).toBe('mp3');
    expect(soundType(Buffer.from('OggS0000000000000', 'latin1'))).toBe('ogg');
    expect(soundType(Buffer.from('<html>hello world</html>', 'latin1'))).toBeNull();
  });

  it('names sound files after the sound, and keeps the file when renamed', () => {
    expect(slug('Crowd roar!')).toBe('crowd-roar');
    expect(slug('Łódź – żółw')).toBe('lodz-zolw');
    expect(slug('!!!')).toBe('sound');
    const a = store.addSound(WAV, 'Crowd roar', 1000);
    const b = store.addSound(MP3, 'Crowd roar', 1000);
    expect([a, b]).toEqual(['crowd-roar.wav', 'crowd-roar.mp3']);
    expect(store.addSound(WAV, 'Crowd   roar', 1000)).toBe('crowd-roar-2.wav');
    store.updateSound(a, { name: 'Stadium' });
    expect(store.sound(a)).toMatchObject({ id: 'crowd-roar.wav', name: 'Stadium' });
  });

  it('keeps sounds and refuses to delete one a rule uses', () => {
    const id = store.addSound(WAV, ' Big   fish ', 1200);
    const s = store.sound(id)!;
    expect(s).toMatchObject({ name: 'Big fish', volume: 100, durationMs: 1200, usedBy: 0 });
    expect(existsSync(join(store.soundsDir, s.file))).toBe(true);
    expect(() => store.addSound(WAV, 'Long', 12_000)).toThrow('longer than 10 s');
    expect(() => store.addSound(Buffer.alloc(3 * 1024 * 1024, 0xff), 'Big', 100)).toThrow('2 MB');
    expect(() => store.addSound(Buffer.from('not a sound at all'), 'x', 100)).toThrow('mp3, wav or ogg');

    const rule = store.createRule({ triggers: [t180], sounds: [id] });
    expect(store.sound(id)!.usedBy).toBe(1);
    expect(() => store.deleteSound(id)).toThrow('Used by a rule');
    store.deleteRule(rule);
    store.deleteSound(id);
    expect(existsSync(join(store.soundsDir, s.file))).toBe(false);
  });

  it('checks rules and gives them short random ids', () => {
    expect(() => store.createRule({ triggers: [], sounds: [] })).toThrow('at least one trigger');
    expect(() => store.createRule({ triggers: [{ kind: 'nope' }], led: { preset: 1, seconds: 1 } })).toThrow('Invalid trigger');
    // No sound and no LEDs yet: kept, plays nothing.
    expect(store.rules().length).toBe(0);
    store.deleteRule(store.createRule({ triggers: [t180] }));
    expect(() => store.createRule({ triggers: [t180], sounds: ['nope.mp3'] })).toThrow('Unknown sound');
    const id = store.createRule({ name: 'Ton 80', triggers: [t180], led: { preset: 10, seconds: 2.04 } });
    expect(id).toMatch(/^r[a-z0-9]{4}$/);
    expect(store.rules()).toEqual([{ id, name: 'Ton 80', enabled: true, triggers: [t180], sounds: [], led: { preset: 10, seconds: 2 } }]);
    store.updateRule(id, { triggers: [t180], led: { preset: 10, seconds: 1 }, enabled: false });
    expect(store.rules()[0].enabled).toBe(false);
  });

  it('writes the same file for the same setup, with keys in a fixed order', () => {
    const s = store.addSound(WAV, 'Ding', 400);
    // Keys in odd order from the page still land in the file in one order.
    store.createRule({ led: { seconds: 1, preset: 3 }, sounds: [s], triggers: [{ checkout: 'only', total: 170, kind: 'total' }], name: 'Big Fish' });
    const text = fileText();
    expect(text.endsWith('}\n')).toBe(true);
    expect(text).toContain('"kind": "total",\n          "total": 170,\n          "checkout": "only"');
    expect(formatEffectsFile(parseEffectsFile(text))).toBe(text);
  });

  it('keeps the WLED address and pilot switches out of the repo file', () => {
    store.updateSettings({ volume: 40, sounds: false, swoosh: false, wled: { address: '192.168.1.50', base: { lobby: 1 } } });
    const file = JSON.parse(fileText());
    expect(file.settings).toEqual({ volume: 40, swoosh: false, base: { lobby: 1, match: null, takeout: null, offline: null } });
    expect(fileText()).not.toContain('192.168.1.50');
    expect(store.settings()).toMatchObject({ sounds: false, leds: true, wled: { address: '192.168.1.50' } });
  });

  it('reloads the file after a pull, and keeps the last good version when it is broken', () => {
    store.createRule({ name: 'Mine', triggers: [t180], led: { preset: 1, seconds: 1 } });
    const pulled = JSON.parse(fileText());
    pulled.rules.push({ id: 'rhome', name: 'From home', enabled: true, triggers: [{ kind: 'bust' }], sounds: [], led: { preset: 2, seconds: 1 } });
    writeFileSync(store.file, JSON.stringify(pulled, null, 2));
    expect(store.load()).toBe(true);
    expect(store.rules().map(r => r.name)).toEqual(['Mine', 'From home']);
    expect(store.error).toBeNull();

    writeFileSync(store.file, `<<<<<<< HEAD\n${fileText()}=======\n{}\n>>>>>>> home\n`);
    store.load();
    expect(store.error).toContain('git conflict markers');
    expect(store.rules().map(r => r.name)).toEqual(['Mine', 'From home']);

    pulled.rules[1].sounds = ['missing.mp3'];
    writeFileSync(store.file, JSON.stringify(pulled));
    store.load();
    expect(store.error).toContain('rule "rhome": Unknown sound');
  });

  it('moves effects from SQLite into the repo on the first start', () => {
    store.close();
    rmSync(fxDir, { recursive: true });
    // What migration 3 left behind: a sound file in data/sounds/, its row, a rule and the old settings row.
    mkdirSync(join(dir, 'sounds'), { recursive: true });
    writeFileSync(join(dir, 'sounds', 'f00d.wav'), WAV);
    db.sql.exec(`
      CREATE TABLE sounds (id INTEGER PRIMARY KEY, name TEXT, file TEXT, volume INTEGER, duration_ms INTEGER, created_at INTEGER);
      CREATE TABLE effect_rules (id INTEGER PRIMARY KEY, name TEXT, enabled INTEGER, triggers TEXT, sounds TEXT, led_preset INTEGER, led_seconds REAL, created_at INTEGER);
      INSERT INTO sounds VALUES (7, 'PH Intro', 'f00d.wav', 120, 1500, 0);
      INSERT INTO effect_rules VALUES (1, 'Ton 80', 1, '[{"kind":"total","total":180,"checkout":"any"}]', '[7]', 10, 2, 0);
      INSERT OR REPLACE INTO settings (key, value) VALUES ('effects', '{"sounds":false,"leds":true,"volume":55,"swoosh":true,"wled":{"address":"10.0.0.9","base":{"lobby":1}}}');
    `);
    store = new EffectsStore(db, fxDir, dir);
    expect(store.sounds()).toMatchObject([{ id: 'ph-intro.wav', name: 'PH Intro', volume: 120, usedBy: 1 }]);
    expect(store.rules()).toMatchObject([{ name: 'Ton 80', sounds: ['ph-intro.wav'], led: { preset: 10, seconds: 2 } }]);
    expect(existsSync(join(fxDir, 'sounds', 'ph-intro.wav'))).toBe(true);
    expect(store.settings()).toMatchObject({ sounds: false, volume: 55, wled: { address: '10.0.0.9', base: { lobby: 1 } } });
    expect(db.sql.prepare("SELECT name FROM sqlite_master WHERE name IN ('sounds', 'effect_rules')").all()).toEqual([]);
  });

  it('reads a preset colour from its first segment', () => {
    expect(presetColor({ seg: [{ col: [[245, 130, 36], [0, 0, 0]] }] })).toBe('#f58224');
    expect(presetColor({ seg: { col: [[0, 0, 0, 255]] } })).toBe('#ffffff');
    expect(presetColor({ seg: [{ col: ['FF0000'] }] })).toBe('#ff0000');
    expect(presetColor({ seg: [{ col: [[0, 0, 0]] }] })).toBeNull();
    expect(presetColor({ n: 'Playlist' })).toBeNull();
  });

  it('patches settings and checks them', () => {
    store.updateSettings({ volume: 40, wled: { address: 'http://192.168.1.50/', base: { lobby: 1 } } });
    expect(store.settings()).toMatchObject({ volume: 40, sounds: true, wled: { address: '192.168.1.50', base: { lobby: 1, match: null } } });
    expect(() => store.updateSettings({ wled: { address: 'not an address!' } })).toThrow('host or host:port');
    expect(() => store.updateSettings({ volume: 300 })).toThrow('0–100');
  });
});

describe('effects service', () => {
  const sent: Fx[] = [];
  let fx: Effects;
  beforeEach(() => {
    sent.length = 0;
    fx = new Effects(store, m => sent.push(m));
  });
  const visit180: Change[] = [
    { fact: { kind: 'dart', dart: { n: 20, m: 3 } }, before: null },
    { fact: { kind: 'visit', total: 180, darts: [{ n: 20, m: 3 }, { n: 20, m: 3 }, { n: 20, m: 3 }], checkout: false }, before: null },
  ];

  it('plays the rule’s sound with both volumes and the built-in animation', () => {
    const s = store.addSound(WAV, 'One hundred and eighty', 1000);
    store.updateSound(s, { volume: 150 });
    store.updateSettings({ volume: 50 });
    store.createRule({ triggers: [t180], sounds: [s] });
    fx.fire(visit180);
    expect(sent).toEqual([{ sound: { url: `/sounds/${store.sound(s)!.file}`, gain: 0.75 }, anim: '180' }]);
  });

  it('keeps quiet with Sounds off but still animates, and Test ignores the switch', () => {
    const s = store.addSound(MP3, 'x', 500);
    store.createRule({ triggers: [t180], sounds: [s] });
    store.updateSettings({ sounds: false });
    fx.fire(visit180);
    expect(sent).toEqual([{ sound: null, anim: '180' }]);
    // Test plays an unsaved rule too.
    fx.test(store.checkRule({ triggers: [{ kind: 'bust' }], sounds: [s] }));
    expect(sent[1].sound).not.toBeNull();
  });

  it('sends the LED effect with the base preset to go back to', () => {
    const effect = vi.spyOn(fx.wled, 'effect').mockImplementation(() => undefined);
    const preset = vi.spyOn(fx.wled, 'preset').mockImplementation(() => undefined);
    store.updateSettings({ wled: { address: 'wled.local', base: { match: 2 } } });
    store.createRule({ triggers: [t180], led: { preset: 10, seconds: 2 } });
    fx.setBase('match');
    expect(preset).toHaveBeenCalledWith(2);
    fx.fire(visit180);
    expect(effect).toHaveBeenCalledWith(10, 2, 2);
  });

  it('previews a preset and goes back to the base, or dark with the LEDs switched off', () => {
    vi.useFakeTimers();
    const effect = vi.spyOn(fx.wled, 'effect').mockImplementation(() => undefined);
    const off = vi.spyOn(fx.wled, 'off').mockImplementation(() => undefined);
    vi.spyOn(fx.wled, 'preset').mockImplementation(() => undefined);
    store.updateSettings({ wled: { address: 'wled.local', base: { lobby: 1 } } });
    fx.setBase('lobby');
    fx.previewLed(11, 3);
    expect(effect).toHaveBeenLastCalledWith(11, 3, 1);
    vi.advanceTimersByTime(3000);
    expect(off).not.toHaveBeenCalled();

    store.updateSettings({ leds: false });
    fx.previewLed(11, 3);
    vi.advanceTimersByTime(2900);
    expect(off).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(off).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('lets a running LED effect finish before a new base', () => {
    vi.useFakeTimers();
    const preset = vi.spyOn(fx.wled, 'preset').mockImplementation(() => undefined);
    vi.spyOn(fx.wled, 'effect').mockImplementation(() => undefined);
    store.updateSettings({ wled: { address: 'wled.local', base: { match: 2, takeout: 3 } } });
    store.createRule({ triggers: [t180], led: { preset: 10, seconds: 2 } });
    fx.setBase('match');
    fx.fire(visit180);
    fx.setBase('takeout');
    expect(preset).toHaveBeenLastCalledWith(2);
    vi.advanceTimersByTime(2000);
    expect(preset).toHaveBeenLastCalledWith(3);
    vi.useRealTimers();
  });
});
