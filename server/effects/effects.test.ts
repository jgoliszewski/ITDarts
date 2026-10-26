import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Change } from '../../games/effects.ts';
import { Db } from '../db.ts';
import type { Fx } from './index.ts';
import { Effects } from './index.ts';
import { EffectsStore, soundType } from './store.ts';

// Smallest buffers the format check accepts.
const WAV = Buffer.concat([Buffer.from('RIFF\0\0\0\0WAVE', 'latin1'), Buffer.alloc(32)]);
const MP3 = Buffer.concat([Buffer.from('ID3', 'latin1'), Buffer.alloc(32)]);

let dir: string;
let db: Db;
let store: EffectsStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'itdarts-fx-'));
  db = new Db(dir);
  store = new EffectsStore(db, dir);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const t180 = { kind: 'total', total: 180, checkout: 'any' } as const;

describe('effects store', () => {
  it('recognizes mp3, wav and ogg', () => {
    expect(soundType(WAV)).toBe('wav');
    expect(soundType(MP3)).toBe('mp3');
    expect(soundType(Buffer.from('OggS0000000000000', 'latin1'))).toBe('ogg');
    expect(soundType(Buffer.from('<html>hello world</html>', 'latin1'))).toBeNull();
  });

  it('keeps sounds and refuses to delete one a rule uses', () => {
    const id = store.addSound(WAV, ' Big   fish ', 1200);
    const s = store.sound(id)!;
    expect(s).toMatchObject({ name: 'Big fish', volume: 100, durationMs: 1200, usedBy: 0 });
    expect(existsSync(join(store.soundsDir, s.file))).toBe(true);
    expect(() => store.addSound(WAV, 'Long', 12_000)).toThrow('longer than 10 s');
    expect(() => store.addSound(Buffer.from('not a sound at all'), 'x', 100)).toThrow('mp3, wav or ogg');

    const rule = store.createRule({ triggers: [t180], sounds: [id] });
    expect(store.sound(id)!.usedBy).toBe(1);
    expect(() => store.deleteSound(id)).toThrow('Used by a rule');
    store.deleteRule(rule);
    store.deleteSound(id);
    expect(existsSync(join(store.soundsDir, s.file))).toBe(false);
  });

  it('checks rules', () => {
    expect(() => store.createRule({ triggers: [], sounds: [] })).toThrow('at least one trigger');
    expect(() => store.createRule({ triggers: [{ kind: 'nope' }], led: { preset: 1, seconds: 1 } })).toThrow('Invalid trigger');
    expect(() => store.createRule({ triggers: [t180] })).toThrow('sound or an LED preset');
    expect(() => store.createRule({ triggers: [t180], sounds: [99] })).toThrow('Unknown sound');
    const id = store.createRule({ name: 'Ton 80', triggers: [t180], led: { preset: 10, seconds: 2.04 } });
    expect(store.rules()).toEqual([{ id, name: 'Ton 80', enabled: true, triggers: [t180], sounds: [], led: { preset: 10, seconds: 2 } }]);
    store.updateRule(id, { triggers: [t180], led: { preset: 10, seconds: 1 }, enabled: false });
    expect(store.rules()[0].enabled).toBe(false);
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
    const rule = store.createRule({ triggers: [t180], sounds: [s] });
    store.updateSettings({ sounds: false });
    fx.fire(visit180);
    expect(sent).toEqual([{ sound: null, anim: '180' }]);
    fx.test(rule);
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
