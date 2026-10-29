import { describe, expect, it } from 'vitest';
import { cricket } from './cricket.ts';
import { parseDart } from './darts.ts';
import type { Change, Fact, Trigger } from './effects.ts';
import { changes, isValidTrigger, matches, pickRule, triggerLabel } from './effects.ts';
import type { GameModule } from './index.ts';
import { killer } from './killer.ts';
import { atc } from './race.ts';
import { shanghai } from './shanghai.ts';
import type { X01Options } from './x01/index.ts';
import { x01 } from './x01/index.ts';

const X01: X01Options = { startScore: 501, checkIn: 'straight', checkOut: 'double', matchMode: { kind: 'legs', firstTo: 1 }, bullOff: 'off' };

let clock = 0;
const d = (s: string) => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const fix = (index: number, s: string) => ({ t: 'fix', index, dart: parseDart(s)! });
const next = { t: 'next', at: 0 };

/** Changes fired by the last event of the log. */
function fired(game: GameModule, log: object[], o: unknown, players = 1): Change[] {
  const last = log.at(-1) as { t: string };
  const cause = last.t === 'fix' ? 'fix' : last.t === 'undo' ? 'undo' : 'other';
  return changes(game.happenings(log.slice(0, -1), players, o), game.happenings(log, players, o), cause);
}

const kinds = (cs: Change[]) => cs.map(c => (c.fact.kind === 'game' ? c.fact.event : c.fact.kind));
const rule = (id: number, ...triggers: Trigger[]) => ({ id, enabled: true, triggers });
const any = (n: number | null, m: 1 | 2 | 3 | null) => ({ n, m });

describe('X01 occurrences', () => {
  it('fires each fresh dart and the visit once it is complete', () => {
    expect(kinds(fired(x01, [d('T20')], X01))).toEqual(['dart', 'left']);
    const third = fired(x01, [d('T20'), d('T20'), d('T20')], X01);
    expect(kinds(third)).toEqual(['dart', 'left', 'visit']);
    expect(third[2].fact).toMatchObject({ kind: 'visit', total: 180, checkout: false });
    // Next player after a full visit adds nothing new.
    expect(fired(x01, [d('T20'), d('T20'), d('T20'), next], X01)).toEqual([]);
  });

  it('closes a short visit on Next player without firing the filled misses', () => {
    const cs = fired(x01, [d('T20'), next], X01);
    expect(kinds(cs)).toEqual(['visit']);
    expect(cs[0].fact).toMatchObject({ total: 60, darts: [{ n: 20, m: 3 }, { n: 0, m: 1 }, { n: 0, m: 1 }] });
  });

  it('fires only what a fix created, never the dart itself', () => {
    const log = [d('S20'), d('T20'), d('T20'), fix(0, 'T20')];
    const cs = fired(x01, log, X01);
    // The fix moves the score each dart left, so those change too.
    expect(kinds(cs)).toEqual(['left', 'left', 'left', 'visit']);
    expect(cs[3].before).toMatchObject({ total: 140 });
    expect(pickRule([rule(1, { kind: 'range', min: 100, max: 180, checkout: 'any' })], cs)).toBeNull();
    expect(pickRule([rule(1, { kind: 'range', min: 100, max: 180, checkout: 'any' }), rule(2, { kind: 'total', total: 180, checkout: 'any' })], cs)?.id).toBe(2);
  });

  it('fires Left on after the dart that leaves the score, also through a fix', () => {
    const o = { ...X01, startScore: 101 };
    const leftOn2 = [rule(1, { kind: 'left', score: 2 })];
    // 101 − 42 = 59, then T19 leaves D1.
    expect(pickRule(leftOn2, fired(x01, [d('T14'), d('T19')], o))?.id).toBe(1);
    // A miss on 2 changes nothing, so it does not fire again.
    expect(fired(x01, [d('T14'), d('T19'), d('S0')], o).filter(c => c.fact.kind === 'left')).toEqual([]);
    expect(pickRule(leftOn2, fired(x01, [d('T14'), d('S19'), fix(1, 'T19')], o))?.id).toBe(1);
    // A checkout or a bust leaves nothing.
    expect(kinds(fired(x01, [d('T14'), d('T19'), d('D1')], o))).not.toContain('left');
    expect(kinds(fired(x01, [d('T14'), d('T19'), d('S2')], o))).not.toContain('left');
  });

  it('fires nothing on undo', () => {
    expect(fired(x01, [d('T20'), d('T20'), d('T20'), { t: 'undo' }], X01)).toEqual([]);
  });

  it('reports bust, checkout and match won', () => {
    const o = { ...X01, startScore: 120 };
    expect(kinds(fired(x01, [d('T20'), d('T20')], o)).at(-1)).toBe('bust');
    const out = fired(x01, [d('T20'), d('S10'), d('Bull')], o);
    expect(kinds(out)).toEqual(['dart', 'visit', 'checkout', 'matchWon']);
    expect(out[1].fact).toMatchObject({ checkout: true });
  });

  it('starts every leg but the first with a legStart', () => {
    const o = { ...X01, startScore: 120, matchMode: { kind: 'legs' as const, firstTo: 2 } };
    const log = [d('T20'), d('S10'), d('Bull'), { t: 'nextLeg' }];
    expect(kinds(fired(x01, log, o, 2))).toEqual(['legStart']);
  });
});

describe('rule matching', () => {
  const dart = (s: string) => parseDart(s)!;
  const visit180: Fact = { kind: 'visit', total: 180, darts: [dart('T20'), dart('T20'), dart('T20')], checkout: false };
  const bigFish: Fact = { kind: 'visit', total: 170, darts: [dart('T20'), dart('T20'), dart('Bull')], checkout: true };

  it('matches darts, totals, ranges and the checkout condition', () => {
    expect(matches({ kind: 'dart', dart: any(null, 2) }, { kind: 'dart', dart: { n: 16, m: 2 } })).toBe(true);
    expect(matches({ kind: 'dart', dart: any(null, 2) }, { kind: 'dart', dart: { n: 25, m: 2 } })).toBe(false);
    expect(matches({ kind: 'dart', dart: any(0, 1) }, { kind: 'dart', dart: { n: 0, m: 1 } })).toBe(true);
    expect(matches({ kind: 'total', total: 170, checkout: 'only' }, bigFish)).toBe(true);
    expect(matches({ kind: 'range', min: 100, max: 170, checkout: 'only' }, visit180)).toBe(false);
    expect(matches({ kind: 'range', min: 100, max: 180, checkout: 'no' }, visit180)).toBe(true);
  });

  it('matches combos in any order unless order matters', () => {
    const f: Fact = { kind: 'visit', total: 26, darts: [dart('S5'), dart('S20'), dart('S1')], checkout: false };
    const combo = (ordered: boolean): Trigger => ({ kind: 'combo', darts: [any(1, null), any(5, null), any(20, null)], ordered, checkout: 'any' });
    expect(matches(combo(false), f)).toBe(true);
    expect(matches(combo(true), f)).toBe(false);
  });

  it('plays the highest priority rule, and the older one on a tie', () => {
    const cs: Change[] = [{ fact: { kind: 'dart', dart: { n: 20, m: 3 } }, before: null }, { fact: visit180, before: null }];
    const rules = [
      rule(1, { kind: 'dart', dart: any(20, 3) }),
      rule(2, { kind: 'range', min: 100, max: 180, checkout: 'any' }),
      rule(3, { kind: 'total', total: 180, checkout: 'any' }),
      rule(4, { kind: 'total', total: 180, checkout: 'any' }),
    ];
    expect(pickRule(rules, cs)?.id).toBe(3);
    expect(pickRule([{ ...rules[2], enabled: false }, ...rules.slice(0, 2)], cs)?.id).toBe(2);
    // “Only checkout” outranks a plain checkout rule.
    const out: Change[] = [{ fact: bigFish, before: null }, { fact: { kind: 'checkout' }, before: null }];
    expect(pickRule([rule(1, { kind: 'checkout' }), rule(2, { kind: 'total', total: 170, checkout: 'only' })], out)?.id).toBe(2);
  });

  it('checks stored triggers and words them', () => {
    expect(isValidTrigger({ kind: 'range', min: 140, max: 180, checkout: 'any' })).toBe(true);
    expect(isValidTrigger({ kind: 'left', score: 2 })).toBe(true);
    expect(isValidTrigger({ kind: 'left', score: 0 })).toBe(false);
    expect(isValidTrigger({ kind: 'range', min: 140, max: 100, checkout: 'any' })).toBe(false);
    expect(isValidTrigger({ kind: 'dart', dart: { n: 25, m: 3 } })).toBe(false);
    expect(isValidTrigger({ kind: 'game', event: 'marks', marks: 4 })).toBe(false);
    expect(isValidTrigger({ kind: 'nope' })).toBe(false);
    expect(triggerLabel({ kind: 'range', min: 100, max: 170, checkout: 'only' })).toBe('100–170 · checkout');
    expect(triggerLabel({ kind: 'combo', darts: [any(1, 1), any(5, 1), any(20, null)], ordered: false, checkout: 'any' })).toBe('S1 · S5 · Any 20');
  });
});

describe('minigame occurrences', () => {
  it('fires Target hit in ATC', () => {
    expect(kinds(fired(atc, [d('S1')], atc.defaults))).toEqual(['dart', 'targetHit']);
    expect(kinds(fired(atc, [d('S5')], atc.defaults))).toEqual(['dart']);
  });

  it('fires closed sectors and White Horse in Cricket', () => {
    const cs = fired(cricket, [d('T20'), d('T19'), d('T18')], cricket.defaults);
    expect(kinds(cs)).toEqual(['dart', 'sectorClosed', 'marks']);
    expect(cs[2].fact).toMatchObject({ marks: 9, whiteHorse: true });
    expect(matches({ kind: 'game', event: 'whiteHorse' }, cs[2].fact)).toBe(true);
  });

  it('fires the Shanghai Moment, visit-level, so a fix can make one', () => {
    const cs = fired(shanghai, [d('S1'), d('D1'), d('T1')], shanghai.defaults, 2);
    expect(kinds(cs)).toEqual(['dart', 'shanghai', 'matchWon']);
    expect(matches({ kind: 'game', event: 'shanghai' }, cs[1].fact)).toBe(true);
    expect(matches({ kind: 'game', event: 'whiteHorse' }, cs[1].fact)).toBe(false);
    expect(isValidTrigger({ kind: 'game', event: 'shanghai' })).toBe(true);
    expect(triggerLabel({ kind: 'game', event: 'shanghai' })).toBe('Shanghai');
    // With rivals the win comes with the same dart: the Shanghai rule must beat Match won.
    const rules = [rule(1, { kind: 'matchWon' }), rule(2, { kind: 'game', event: 'shanghai' })];
    expect(pickRule(rules, cs)?.id).toBe(2);
    // S1 D1 S1 fixed to T1 on the third dart.
    const made = fired(shanghai, [d('S1'), d('D1'), d('S1'), fix(2, 'T1')], shanghai.defaults, 2);
    expect(kinds(made)).toContain('shanghai');
  });

  it('fires killer, lives and elimination in Killer', () => {
    const log: object[] = [{ t: 'numbers', numbers: [1, 2] }, d('D1'), d('D2')];
    expect(kinds(fired(killer, log.slice(0, 2), { lives: 1, bullOff: 'off' }, 2))).toEqual(['dart', 'becameKiller']);
    expect(kinds(fired(killer, log, { lives: 1, bullOff: 'off' }, 2))).toEqual(['dart', 'lifeLost', 'eliminated', 'matchWon']);
  });
});
