import { describe, expect, it } from 'vitest';
import { BASE_RULES } from './builtin.ts';
import { BOARD_SEGMENT, effectSeconds, LED_COUNT, LEDS, PRESET_RANGE, rings, SPLIT_AT, wledPreset, type LedKey } from './leds.ts';

const keys = Object.keys(LEDS) as LedKey[];

describe('LEDs of the Momenty', () => {
  it('gives every look its own preset in the range the upload owns', () => {
    const numbers = keys.map(k => LEDS[k].preset);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers.every(n => n >= PRESET_RANGE[0] && n <= PRESET_RANGE[1])).toBe(true);
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
