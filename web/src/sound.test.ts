import { describe, expect, it } from 'vitest';
import { masterGain } from './sound.ts';

// Master volume and Mute (ui-overhaul DECISIONS.md): one gain over every sound of the kiosk.
describe('master gain', () => {
  it('is the level in % as a fraction, 0 when muted', () => {
    expect(masterGain(100, false)).toBe(1);
    expect(masterGain(35, false)).toBe(0.35);
    expect(masterGain(0, false)).toBe(0);
    expect(masterGain(80, true)).toBe(0);
  });

  it('stays within 0–1 for a level out of range', () => {
    expect(masterGain(150, false)).toBe(1);
    expect(masterGain(-5, false)).toBe(0);
  });
});
