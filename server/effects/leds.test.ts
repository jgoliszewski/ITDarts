import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groupOfTrigger, isFxGroup } from '../../games/effects.ts';
import { BASE_RULES, BUILTIN_SOUNDS, builtinId } from './builtin.ts';
import { BOARD_SEGMENT, effectSeconds, ledDefault, LED_COUNT, LEDS, PRESET_RANGE, rings, SPLIT_AT, wledPreset, type LedKey } from './leds.ts';

const keys = Object.keys(LEDS) as LedKey[];

describe('LEDs of the Momenty', () => {
  it('gives every look its own preset in the range the upload owns', () => {
    const numbers = keys.map(k => LEDS[k].preset);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.every(n => n >= PRESET_RANGE[0] && n <= PRESET_RANGE[1])).toBe(true);
  });

  it('puts every LED look and built-in sound in a group of the map', () => {
    for (const k of keys) expect(isFxGroup(LEDS[k].group), k).toBe(true);
    for (const s of BUILTIN_SOUNDS) expect(isFxGroup(s.group), s.key).toBe(true);
  });

  it('files a base rule sound and LEDs under the group of its trigger', () => {
    for (const b of BASE_RULES) {
      const g = groupOfTrigger(b.triggers[0]);
      const sound = BUILTIN_SOUNDS.find(s => b.sound === builtinId(s.key));
      // Gotcha, Goal and Shanghai borrow another Moment's sound; the rest match their own.
      if (['b-shanghai', 'b-gotcha', 'b-goal', 'b-life-lost', 'b-lowest', 'b-attempt-failed', 'b-sector-closed'].includes(b.id)) continue;
      if (sound) expect(sound.group, b.id).toBe(g);
      if (b.led && !['b-shanghai', 'b-gotcha', 'b-goal', 'b-lowest'].includes(b.id)) expect(LEDS[b.led].group, b.id).toBe(g);
    }
  });

  it('points every base rule at a look that exists', () => {
    for (const b of BASE_RULES) if (b.led) expect(LEDS[b.led], b.id).toBeDefined();
  });

  it('keeps colour on the board at most 2 s, both rings the same, except at the end of a game', () => {
    for (const k of keys) {
      const { board, wall } = rings(LEDS[k].effect);
      if (board && wall) expect(board.dur, k).toBe(wall.dur);
      if (k !== 'match-won' && k !== 'new-record') expect(effectSeconds(LEDS[k].effect), k).toBeLessThanOrEqual(2);
    }
  });

  it('keeps Sector closed still on both rings and short, as it falls mid-visit and moving light reads as a takeout', () => {
    const { board, wall } = rings(LEDS['sector-closed'].effect);
    expect([board?.kind, wall?.kind]).toEqual(['solid', 'solid']);
    expect(effectSeconds(LEDS['sector-closed'].effect)).toBeLessThanOrEqual(0.8);
    expect(ledDefault('sector-closed').seconds).toBeLessThanOrEqual(0.8);
    const rule = JSON.parse(readFileSync('effects/effects.json', 'utf8')).rules.find((r: { id: string }) => r.id === 'b-sector-closed');
    expect(rule.led.seconds).toBeLessThanOrEqual(0.8);
  });

  it('builds a preset with the two rings as segments and fades in, while the base fades back', () => {
    const p = wledPreset('180');
    expect(p.seg.slice(0, 2).map(s => 'start' in s && [s.start, s.stop])).toEqual([[0, SPLIT_AT], [SPLIT_AT, LED_COUNT]]);
    expect(p.seg.slice(0, 2).map(s => 'fx' in s && s.fx)).toEqual([0, 89]);
    expect(p.transition).toBe(2);
    expect(wledPreset('base').transition).toBe(7);
  });

  it('paints every rainbow with the rainbow palette and never uses Dissolve', () => {
    for (const k of keys) {
      const segs = wledPreset(k).seg.slice(0, 2) as unknown as { fx: number; pal: number }[];
      const { board, wall } = rings(LEDS[k].effect);
      const bySegment = BOARD_SEGMENT === 0 ? [board, wall] : [wall, board];
      bySegment.forEach((l, i) => {
        if (l?.color === 'rainbow') expect(segs[i].pal, k).toBe(11);
        expect(segs[i].fx, k).not.toBe(18);
      });
    }
  });
});
