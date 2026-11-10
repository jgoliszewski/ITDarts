import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Change } from '../../games/effects.ts';
import { Db } from '../db.ts';
import type { Fx } from './index.ts';
import { Effects } from './index.ts';
import { slug } from './slug.ts';
import { BASE_RULES, builtinId } from './builtin.ts';
import { WARM, ledDefault } from './leds.ts';
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
  // Without the base rules, so the tests start from an empty list; they get their own test below.
  store = new EffectsStore(db, fxDir, dir, []);
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

  it('keeps the group of a file: set at upload, changed, cleared with empty text, and in effects.json', () => {
    const a = store.addSound(WAV, 'Crowd roar', 1000, ' Crowd  noises ');
    const b = store.addSound(WAV, 'Plain', 1000);
    expect(store.sound(a)!.group).toBe('Crowd noises');
    expect(store.sound(b)!.group).toBe('');
    expect(fileText()).toContain('"group": "Crowd noises"');
    expect(fileText().match(/"group"/g)).toHaveLength(1);
    store.updateSound(b, { group: 'Jokes' });
    expect(store.sound(b)!.group).toBe('Jokes');
    store.updateSound(b, { volume: 80 });
    expect(store.sound(b)!.group).toBe('Jokes');
    store.updateSound(a, { group: '   ' });
    expect(store.sound(a)!.group).toBe('');
    expect(fileText().match(/"group"/g)).toHaveLength(1);
    expect(parseEffectsFile(fileText()).sounds.map(x => x.group)).toEqual([undefined, 'Jokes']);
    expect(() => store.updateSound(a, { group: 'x'.repeat(31) })).toThrow('too long');
    expect(() => store.addSound(WAV, 'Other', 1000, 'x'.repeat(31))).toThrow('too long');
  });

  it('gives a built-in sound the group from code and does not let it change', () => {
    expect(store.sound(builtinId('treble-20'))!.group).toBe('darts');
    expect(() => store.updateSound(builtinId('bull'), { group: 'Jokes' })).toThrow('keeps its group');
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

  it('gives a sound uploaded again under the same name a new url, so the kiosk does not play the old one', async () => {
    const id = store.addSound(WAV, 'Horn', 1000);
    const before = store.sound(id)!.url;
    store.deleteSound(id);
    await new Promise(r => setTimeout(r, 20));
    expect(store.addSound(WAV, 'Horn', 1000)).toBe(id);
    expect(store.sound(id)!.url).not.toBe(before);
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
    store.updateSettings({ volume: 40, callerVolume: 60, callerVoice: 'arthur', sounds: false, caller: false, wled: { address: '192.168.1.50', base: { lobby: 1 } } });
    expect(() => store.updateSettings({ callerVoice: '../x' })).toThrow('caller voice');
    const file = JSON.parse(fileText());
    expect(file.settings).toEqual({ volume: 40, callerVolume: 60, callerVoice: 'arthur', builtinVolume: {}, base: { lobby: 1, match: null, takeout: null, offline: null } });
    expect(fileText()).not.toContain('192.168.1.50');
    expect(store.settings()).toMatchObject({ sounds: false, caller: false, leds: true, wled: { address: '192.168.1.50' } });
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
    store = new EffectsStore(db, fxDir, dir, []);
    expect(store.sounds().filter(s => !s.builtin)).toMatchObject([{ id: 'ph-intro.wav', name: 'PH Intro', volume: 120, usedBy: 1 }]);
    expect(store.rules()).toMatchObject([{ name: 'Ton 80', sounds: ['ph-intro.wav'], led: { preset: 10, seconds: 2 } }]);
    expect(existsSync(join(fxDir, 'sounds', 'ph-intro.wav'))).toBe(true);
    expect(store.settings()).toMatchObject({ sounds: false, volume: 55, wled: { address: '10.0.0.9', base: { lobby: 1 } } });
    expect(db.sql.prepare("SELECT name FROM sqlite_master WHERE name IN ('sounds', 'effect_rules')").all()).toEqual([]);
  });

  it('keeps every base rule in the file, takes over older starter rules, and refuses to delete them', () => {
    // An older starter set: one rule by an alias without a sound, one by name with a file of its own.
    const file = store.addSound(WAV, 'Piękny jesteś', 900);
    store.createRule({ name: 'Ton+ finish', triggers: [{ kind: 'range', min: 100, max: 167, checkout: 'only' }] });
    store.createRule({ name: 'bullseye', triggers: [{ kind: 'dart', dart: { n: 25, m: 2 } }], sounds: [file] });
    store.createRule({ name: 'Mine', triggers: [t180] });
    store.close();
    store = new EffectsStore(db, fxDir, dir);
    expect(store.rules()).toHaveLength(BASE_RULES.length + 1);
    expect(store.rules().find(r => r.id === 'b-high-finish')).toMatchObject({ name: 'Ton+ finish', triggers: [{ kind: 'range', min: 100, max: 167, checkout: 'only' }], sounds: [builtinId('high-finish')], base: { name: 'High finish', sounds: [builtinId('high-finish')] } });
    expect(store.rules().find(r => r.id === 'b-bullseye')).toMatchObject({ name: 'bullseye', sounds: [file] });
    expect(store.rules().find(r => r.id === 'b-180')).toMatchObject({ name: '180', enabled: true, sounds: [builtinId('180')], led: ledDefault('180') });
    expect(store.rules().find(r => r.name === 'Mine')!.base).toBeUndefined();
    expect(() => store.deleteRule('b-180')).toThrow('cannot be deleted');
    store.updateRule('b-180', { name: 'Mine', enabled: false, triggers: [t180], sounds: [] });
    expect(store.rules().find(r => r.id === 'b-180')).toMatchObject({ name: 'Mine', enabled: false, sounds: [] });

    // A pulled file without a base rule gets it back.
    const pulled = JSON.parse(fileText());
    pulled.rules = pulled.rules.filter((r: { id: string }) => r.id !== 'b-bust');
    writeFileSync(store.file, JSON.stringify(pulled));
    store.load();
    expect(store.rules().find(r => r.id === 'b-bust')).toMatchObject({ sounds: [builtinId('bust')] });
    expect(JSON.parse(fileText()).rules.some((r: { id: string }) => r.id === 'b-bust')).toBe(true);
  });

  it('lists the built-in sounds, keeps their volumes in the file and lets rules use them', () => {
    const sounds = store.sounds();
    expect(sounds[0]).toMatchObject({ id: builtinId('treble-15'), file: '', builtin: { key: 'treble-15' }, volume: 100, usedBy: 0 });
    expect(() => store.createRule({ triggers: [t180], sounds: ['builtin:nope'] })).toThrow('Unknown sound');
    store.createRule({ triggers: [t180], sounds: [builtinId('180')] });
    expect(store.sound(builtinId('180'))!.usedBy).toBe(1);
    store.updateSound(builtinId('180'), { volume: 50 });
    expect(store.sound(builtinId('180'))!.volume).toBe(50);
    expect(JSON.parse(fileText()).settings.builtinVolume).toEqual({ '180': 50 });
    store.updateSound(builtinId('180'), { volume: 100 });
    expect(JSON.parse(fileText()).settings.builtinVolume).toEqual({});
    expect(() => store.updateSound(builtinId('180'), { name: 'x' })).toThrow('keeps its name');
    expect(() => store.deleteSound(builtinId('180'))).toThrow('cannot be deleted');
    expect(() => parseEffectsFile(JSON.stringify({ version: 1, settings: { builtinVolume: { nope: 50 } } }))).toThrow('no built-in sound');
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
    expect(sent).toEqual([{ sound: { url: store.sound(s)!.url, gain: 0.75 }, anim: '180', caller: null }]);
    expect(store.sound(s)!.url).toMatch(/^\/sounds\/one-hundred-and-eighty\.wav\?v=\d+$/);
  });

  it('sends a built-in sound as its id, with both volumes', () => {
    store.updateSound(builtinId('180'), { volume: 50 });
    store.createRule({ triggers: [t180], sounds: [builtinId('180')] });
    fx.fire(visit180);
    expect(sent[0].sound).toEqual({ url: 'builtin:180', gain: 0.4 });
  });

  it('keeps quiet with Sounds off but still animates, and Test ignores the switch', () => {
    const s = store.addSound(MP3, 'x', 500);
    store.createRule({ triggers: [t180], sounds: [s] });
    store.updateSettings({ sounds: false });
    fx.fire(visit180);
    expect(sent).toEqual([{ sound: null, anim: '180', caller: null }]);
    // Test hands the sound of an unsaved rule back to the page instead of the kiosk.
    expect(fx.test(store.checkRule({ triggers: [{ kind: 'bust' }], sounds: [s] }))).toMatchObject({ url: store.sound(s)!.url });
    expect(sent).toHaveLength(1);
  });

  it('sends the caller’s lines with the caller volume, apart from the Sounds switch', () => {
    store.updateSettings({ sounds: false, callerVolume: 50 });
    fx.fire(visit180, ['180']);
    expect(sent).toEqual([{ sound: null, anim: '180', caller: { urls: ['/caller/brian/180.mp3'], gain: 0.5 } }]);
    // Lines alone, without changes, still go out (e.g. “you require” after Next player).
    fx.fire([], ['require_40']);
    expect(sent[1].caller!.urls).toEqual(['/caller/brian/require_40.mp3']);
    store.updateSettings({ caller: false });
    fx.fire([], ['require_40']);
    expect(sent).toHaveLength(2);
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

  it('LEDs to white: solid warm white on both rings, and the pending return to the base is dropped', () => {
    vi.useFakeTimers();
    const send = vi.spyOn(fx.wled, 'send').mockImplementation(() => undefined);
    const preset = vi.spyOn(fx.wled, 'preset').mockImplementation(() => undefined);
    vi.spyOn(fx.wled, 'effect').mockImplementation(() => undefined);
    store.updateSettings({ wled: { address: 'wled.local', base: { match: 2, takeout: 3 } } });
    store.createRule({ triggers: [t180], led: { preset: 10, seconds: 2 } });
    fx.setBase('match');
    fx.fire(visit180);
    fx.setBase('takeout'); // waits for the effect
    fx.ledsWhite();
    const sent = send.mock.calls[0][0] as { on: boolean; seg: { id: number; start: number; stop: number; col: number[][]; fx: number }[] };
    expect(sent.on).toBe(true);
    expect(sent.seg.map(s => [s.id, s.start, s.stop, s.fx, s.col])).toEqual([[0, 0, 48, 0, [WARM]], [1, 48, 100, 0, [WARM]]]);
    preset.mockClear();
    vi.advanceTimersByTime(5000);
    expect(preset).not.toHaveBeenCalled();
    fx.setBase('match'); // the next base change works as usual
    expect(preset).toHaveBeenCalledWith(2);
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
