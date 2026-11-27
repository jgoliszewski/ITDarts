// Quick games (GLOSSARY: Szybka gra): which set shows, which games fit it, how a slot reads, and how stored slots are cleaned.
import { describe, expect, it } from 'vitest';
import { QUICK_START, fitsSet, normalizeQuickGames, normalizeSlot, quickSet, slotLabel, withBullOff } from './quick.ts';

describe('quickSet', () => {
  it('is solo for one player and 2+ otherwise, also with nobody picked yet', () => {
    expect(quickSet(1)).toBe('solo');
    expect(quickSet(2)).toBe('multi');
    expect(quickSet(8)).toBe('multi');
    expect(quickSet(0)).toBe('multi');
  });
});

describe('fitsSet', () => {
  it('takes games for one player in solo and refuses those that need 2+', () => {
    expect(fitsSet('x01', 'solo')).toBe(true);
    expect(fitsSet('freethrow', 'solo')).toBe(true);
    expect(fitsSet('killer', 'solo')).toBe(false);
  });

  it('takes games for 2+ in multi and refuses solo-only ones', () => {
    expect(fitsSet('killer', 'multi')).toBe(true);
    expect(fitsSet('cricket', 'multi')).toBe(true);
    expect(fitsSet('freethrow', 'multi')).toBe(false);
  });
});

describe('slotLabel', () => {
  it('reads X01 like the mockup', () => {
    expect(slotLabel('x01', QUICK_START.multi[0]!.options, 2)).toBe('501 · Double out · No match mode');
    expect(slotLabel('x01', { startScore: 301, checkIn: 'double', checkOut: 'master', matchMode: { kind: 'legs', firstTo: 1 } }, 2))
      .toBe('301 · Double in · Master out · First to 1 leg');
    expect(slotLabel('x01', { matchMode: { kind: 'sets', firstTo: 3, legsPerSet: 3 } }, 2)).toBe('501 · Double out · First to 3 sets');
  });

  it('drops On/Off options that are off and names those that are on', () => {
    expect(slotLabel('121', { visits: 4, refill: false }, 1)).toBe('Visits per target 4');
    expect(slotLabel('121', { visits: 3, refill: true }, 1)).toBe('Visits per target 3 · Refill lives on checkout');
  });

  it('shows Mode as its value, and only with 2+ players', () => {
    expect(slotLabel('cricket', { mode: 'standard', sectors: 'classic' }, 2)).toBe('Standard · Sectors 15–20');
    expect(slotLabel('cricket', { mode: 'cutthroat', sectors: 'classic' }, 1)).toBe('Sectors 15–20');
  });

  it('never mentions the bull-off', () => {
    expect(slotLabel('killer', { lives: 3, bullOff: 'pdc' }, 2)).toBe('Lives 3');
  });

  it('gives the Random Checkouts range as numbers', () => {
    expect(slotLabel('randomco', { min: 41, max: 80, checkOut: 'double', hints: true }, 1)).toBe('Range 41–80 · Check-out Double · Hints');
  });
});

describe('normalizeSlot', () => {
  it('cleans bad options and leaves the bull-off out', () => {
    expect(normalizeSlot({ game: 'killer', options: { lives: 99, bullOff: 'pdc', junk: 1 } }, 'multi')).toEqual({ game: 'killer', options: { lives: 3 } });
  });

  it('refuses a game that does not fit the set, or is not a game', () => {
    expect(normalizeSlot({ game: 'killer', options: {} }, 'solo')).toBeNull();
    expect(normalizeSlot({ game: 'freethrow', options: {} }, 'multi')).toBeNull();
    expect(normalizeSlot({ game: 'darts', options: {} }, 'multi')).toBeNull();
    expect(normalizeSlot(null, 'multi')).toBeNull();
  });
});

describe('normalizeQuickGames', () => {
  it('gives the starting set when nothing is stored', () => {
    expect(normalizeQuickGames(null)).toEqual(QUICK_START);
    expect(normalizeQuickGames(undefined)).toEqual(QUICK_START);
  });

  it('gives a copy of the starting set, so a change to it never reaches the next one', () => {
    const q = normalizeQuickGames(null);
    expect(q).not.toBe(QUICK_START);
    q.multi[0]!.options.startScore = 301;
    expect(normalizeQuickGames(null).multi[0]!.options.startScore).toBe(501);
  });

  it('starts with X01 501 for 2+ and 121 for solo, two empty slots each', () => {
    expect(QUICK_START.multi).toEqual([
      { game: 'x01', options: { startScore: 501, checkIn: 'straight', checkOut: 'double', matchMode: { kind: 'off' } } }, null, null]);
    expect(QUICK_START.solo).toEqual([{ game: '121', options: { visits: 4, refill: false } }, null, null]);
  });

  it('keeps three slots per set and empties those that no longer fit', () => {
    const q = normalizeQuickGames({ solo: [{ game: 'killer', options: {} }], multi: [null, { game: 'gotcha', options: { target: 101 } }, null, { game: 'x01', options: {} }] });
    expect(q.solo).toEqual([null, null, null]);
    expect(q.multi).toEqual([null, { game: 'gotcha', options: { target: 101, firstTo: 1 } }, null]);
  });
});

describe('withBullOff', () => {
  it('adds the bull-off to games that have one, and leaves it out of the rest', () => {
    expect(withBullOff('killer', { lives: 3 }, 'pdc')).toEqual({ lives: 3, bullOff: 'pdc' });
    expect(withBullOff('freethrow', { visits: 10 }, 'pdc')).toEqual({ visits: 10 });
  });

  it('replaces a bull-off left in old options, and drops it from games without one', () => {
    expect(withBullOff('x01', { bullOff: 'pdc' }, 'off')).toEqual({ bullOff: 'off' });
    expect(withBullOff('freethrow', { bullOff: 'pdc' }, 'pdc')).toEqual({});
  });
});
