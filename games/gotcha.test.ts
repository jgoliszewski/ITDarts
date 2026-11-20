import { describe, expect, it } from 'vitest';
import type { Change, Trigger } from './effects.ts';
import { changes, pickRule } from './effects.ts';
import { parseDart } from './darts.ts';
import { callerLinesGotcha, gotcha } from './gotcha.ts';
import type { TurnEvent } from './turns.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];

const o101 = { ...gotcha.defaults, target: 101 as const };
const o201 = { ...gotcha.defaults };
const totals = (log: TurnEvent[], players: number, o = o201) => gotcha.view(log, players, o).totals;

describe('gotcha scoring', () => {
  it('counts up from zero, doubles and trebles at face value, no double needed', () => {
    const v = gotcha.view([d('T20'), d('D10'), d('S5')], 2, o201);
    expect(v.totals).toEqual([85, 0]);
    expect(v.hero.big).toBe('85');
    expect(v.hero.note).toBe('Left 116');
    expect(v.visit.good).toEqual([true, true, true]);
    expect(v.visitScore).toBe(85);
  });

  it('defaults to 201, plays from 2 players, and sits in the Versus group', () => {
    expect(gotcha.defaults.target).toBe(201);
    expect(gotcha.minPlayers).toBe(2);
    expect(gotcha.group).toBe('versus');
    expect(gotcha.describe(o101, 2)).toBe('Gotcha · 101');
    expect(gotcha.normalizeOptions({ target: 301 }).target).toBe(301);
    expect(gotcha.normalizeOptions({ target: 500 }).target).toBe(201);
    expect(gotcha.record).toBeUndefined();
  });

  it('passes the visit to the next player', () => {
    expect(gotcha.view(visit('S1'), 2, o201).current).toBe(1);
  });
});

describe('gotcha bust', () => {
  // Player 0 sits on 180; player 1 misses.
  const on180 = [...visit('T20', 'T20', 'T20'), ...visit('Miss')];

  it('puts the score back to the start of the visit and ends the visit', () => {
    const v = gotcha.view([...on180, d('S5'), d('T20')], 2, o201); // 185, then 245: bust
    expect(v.totals[0]).toBe(180);
    expect(v.visit.good).toEqual([true, false]);
    expect(v.visit.dartsLeft).toBe(0);
    expect(v.visit.verdict).toEqual({ text: 'Bust', tone: 'bad' });
    expect(v.phase).toBe('throwing');
    // The rest of the visit does nothing.
    expect(gotcha.view([...on180, d('S5'), d('T20'), d('S1')], 2, o201).totals[0]).toBe(180);
  });

  it('does not bring a zeroed rival back: the thrower returns, the rival stays on 0', () => {
    // Player 1 is on 60. Player 0 throws T20 (60, the same: gotcha) and T20 again: 120 is over 101, bust.
    const log = [...visit('Miss'), ...visit('T20'), d('T20'), d('T20')];
    const v = gotcha.view(log, 2, o101);
    expect(v.totals).toEqual([0, 0]);
    expect(v.stats).toEqual([{ gotchas: 1 }, { gotchas: 0 }]);
    expect(v.zeroed).toEqual([1]);
    expect(v.visit.verdict).toEqual({ text: 'Bust', tone: 'bad' });
  });

  it('a bust that zeroes nobody leaves rivals alone', () => {
    const v = gotcha.view([...visit('S20'), d('T20'), d('T20'), d('T20')], 2, o101);
    expect(v.totals).toEqual([20, 0]);
    expect(v.zeroed).toEqual([]);
  });

  it('fires Bust, and an undo takes the bust back', () => {
    const log = [...on180, d('T20')]; // 240: bust with the first dart
    const bust = (l: TurnEvent[]) => gotcha.happenings(l, 2, o201).some(h => h.fact.kind === 'bust');
    expect(bust(log)).toBe(true);
    expect(bust(on180)).toBe(false);
    expect(bust([...log, { t: 'undo' }])).toBe(false);
    expect(totals([...log, { t: 'undo' }], 2)[0]).toBe(180);
  });
});

describe('gotcha win', () => {
  it('wins on the exact target at once, in the middle of a visit', () => {
    // Bull (50) + T17 (51) = 101 with the second dart: the third is never thrown.
    const v = gotcha.view([d('Bull'), d('T17'), d('S1')], 2, o101);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
    expect(v.totals[0]).toBe(101);
    expect(v.visit.darts).toHaveLength(2);
    expect(v.result).toBe('Hit 101 exactly');
  });

  it('wins with the last dart too, and for any player', () => {
    const v = gotcha.view([...visit('Miss'), d('T20'), d('D20'), d('S1')], 2, o101);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([1]);
  });

  it('does not win below or above the target', () => {
    expect(gotcha.view([d('T20'), d('D20'), d('S5')], 2, o101).phase).toBe('throwing'); // 105 is a bust
    expect(gotcha.view([d('T20'), d('D20'), d('Miss')], 2, o101).totals[0]).toBe(100);
  });

  it('an undo takes the win back', () => {
    const win = [d('Bull'), d('T17')];
    expect(gotcha.view([...win, { t: 'undo' }], 2, o101).phase).toBe('throwing');
  });
});

describe('gotcha reset', () => {
  // Player 0 on 60; player 1 lands on 60 with the second dart of a visit.
  const landing = [...visit('T20'), d('D20'), d('S20'), d('Miss')];

  it('sends a rival on the same score back to zero with the dart that lands on it, before the visit ends', () => {
    // After the first dart of 60 already.
    const one = gotcha.view([...visit('T20'), d('T20')], 2, o201);
    expect(one.totals).toEqual([0, 60]);
    expect(one.visit.dartsLeft).toBe(2);
    expect(one.zeroed).toEqual([0]);
  });

  it('sends a rival on the same score back to zero when the visit is complete', () => {
    const v = gotcha.view(landing, 2, o201);
    expect(v.totals).toEqual([0, 60]);
    expect(v.zeroed).toEqual([0]);
    expect(v.stats).toEqual([{ gotchas: 0 }, { gotchas: 1 }]);
  });

  it('zeroes on the way: passing a rival and moving on still sends them back', () => {
    const v = gotcha.view([...visit('T20'), d('D20'), d('S20'), d('S1')], 2, o201);
    expect(v.totals).toEqual([0, 61]);
    expect(v.zeroed).toEqual([0]);
    expect(v.stats[1]).toEqual({ gotchas: 1 });
  });

  it('zeroes two rivals in one visit with consecutive darts', () => {
    // p0 20, p1 60, p2 on 0: p2 throws S20 (hits p0), then S20 S20 (40, 60 hits p1).
    const log = [...visit('S20'), ...visit('T20'), d('S20'), d('S20'), d('S20')];
    const v = gotcha.view(log, 3, o201);
    expect(v.totals).toEqual([0, 0, 60]);
    expect(v.zeroed).toEqual([0, 1]);
    expect(v.stats[2]).toEqual({ gotchas: 2 });
  });

  it('a dart that scores nothing zeroes nobody', () => {
    expect(totals([...visit('S20'), d('Miss')], 2)).toEqual([20, 0]);
    expect(totals([...visit('Miss'), d('Miss')], 2)).toEqual([0, 0]);
  });

  it('does not zero a removed player', () => {
    const log: TurnEvent[] = [...visit('S20'), { t: 'remove', player: 0, scope: 'match' } as unknown as TurnEvent, d('S20')];
    expect(totals(log, 3)).toEqual([20, 20, 0]);
  });

  it('keeps showing who was zeroed until the next visit starts', () => {
    expect(gotcha.view(landing, 2, o201).zeroed).toEqual([0]);
    expect(gotcha.view([...landing, next], 2, o201).zeroed).toEqual([0]);
    expect(gotcha.view([...landing, next, d('S1')], 2, o201).zeroed).toEqual([]);
  });

  it('also reports it when Next player ends the visit before the third dart', () => {
    const short = [...visit('T20'), d('D20'), d('S20'), next];
    const v = gotcha.view(short, 2, o201);
    expect(v.totals).toEqual([0, 60]);
    expect(v.zeroed).toEqual([0]);
  });

  it('zeroes only a rival with exactly the same score', () => {
    expect(totals([...visit('T20'), ...visit('T19')], 2)).toEqual([60, 57]);
  });

  it('does not zero on 0 → 0, nor a player who threw nothing', () => {
    const v = gotcha.view([...visit('Miss'), ...visit('Miss'), ...visit('Miss')], 3, o201);
    expect(v.totals).toEqual([0, 0, 0]);
    expect(v.zeroed).toEqual([]);
    expect(v.stats.every(s => s.gotchas === 0)).toBe(true);
    // Player 0 was zeroed, then misses: still at 0 and player 1's 60 stays.
    expect(totals([...landing, next, ...visit('Miss')], 2)).toEqual([0, 60]);
  });

  it('fires the Gotcha Moment with the dart that zeroes, once per dart, and not on a fix', () => {
    const gotchas = (l: TurnEvent[]) => gotcha.happenings(l, 2, o201).filter(h => h.fact.kind === 'game' && h.fact.event === 'gotcha');
    expect(gotchas([...visit('T20'), d('D20')])).toHaveLength(0);
    expect(gotchas([...visit('T20'), d('T20')]).map(h => h.slot)).toEqual(['V2D1:gotcha']);
    expect(gotchas(landing).map(h => h.slot)).toEqual(['V2D2:gotcha']);
    // Fresh when the dart is thrown ...
    const thrown = changes(gotcha.happenings([...visit('T20')], 2, o201), gotcha.happenings([...visit('T20'), d('T20')], 2, o201), 'other');
    expect(thrown.some(c => c.fact.kind === 'game')).toBe(true);
    // ... but a fix that makes the dart land on a rival does not fire it.
    const base = [...visit('T20'), d('S5')];
    const fixed = changes(gotcha.happenings(base, 2, o201), gotcha.happenings([...base, { t: 'fix', index: 0, dart: parseDart('T20')! } as TurnEvent], 2, o201), 'fix');
    expect(fixed.some(c => c.fact.kind === 'game')).toBe(false);
  });
});

describe('gotcha undo and fix', () => {
  const landing = [...visit('T20'), d('D20'), d('S20'), d('Miss')];

  it('a fix recomputes: a dart that no longer matches takes the Gotcha away', () => {
    expect(totals(landing, 2)).toEqual([0, 60]);
    const fixed = gotcha.view([...landing, { t: 'fix', index: 1, dart: parseDart('S5')! }], 2, o201);
    expect(fixed.totals).toEqual([60, 45]);
    expect(fixed.stats[1].gotchas).toBe(0);
    // ... and a fix can make one.
    const near = [...visit('T20'), d('D20'), d('S1'), d('Miss')];
    expect(totals(near, 2)).toEqual([60, 41]);
    expect(totals([...near, { t: 'fix', index: 1, dart: parseDart('S20')! }], 2)).toEqual([0, 60]);
  });

  it('an undo gives the rival their score back', () => {
    // Undo takes the landing dart back, and with it the zeroing; an undo of a later dart keeps it.
    expect(totals([...visit('T20'), d('D20'), d('S20'), { t: 'undo' }], 2)).toEqual([60, 40]);
    expect(totals([...landing, { t: 'undo' }], 2)).toEqual([0, 60]);
  });
});

describe('gotcha view and caller', () => {
  it('lists scores and what is left', () => {
    const v = gotcha.view([...visit('T20'), d('D20'), d('S20'), d('Miss')], 2, o201);
    expect(v.rows.map(r => r.value)).toEqual(['0', '60']);
    expect(v.rows[0].meta).toBe('Left 201');
    expect(v.rows[1].meta).toBe('Left 141');
    expect(v.visit.verdict).toBeNull();
  });

  it('calls the visit score and busted, never “you require” or a game shot', () => {
    const before = gotcha.happenings([d('T20'), d('T20')], 2, o201);
    const after = gotcha.happenings([d('T20'), d('T20'), d('T20')], 2, o201);
    expect(callerLinesGotcha(changes(before, after, 'other'))).toEqual(['180']);
    // The start of the next visit: no “require”.
    expect(callerLinesGotcha([])).toEqual([]);
    // A bust is called as busted.
    const busted = [...visit('T20', 'T20', 'T20'), ...visit('Miss')];
    const b0 = gotcha.happenings(busted, 2, o201), b1 = gotcha.happenings([...busted, d('T20')], 2, o201);
    expect(callerLinesGotcha(changes(b0, b1, 'other'))).toContain('busted');
    // A win is called as its score only.
    const w0 = gotcha.happenings([d('Bull')], 2, o101), w1 = gotcha.happenings([d('Bull'), d('T17')], 2, o101);
    expect(callerLinesGotcha(changes(w0, w1, 'other'))).toEqual(['101']);
  });

  it('compacts the log with the winner', () => {
    const legs = gotcha.compact([d('Bull'), d('T17')], 2, o101);
    expect(legs).toHaveLength(1);
    expect(legs[0].winner).toBe(0);
  });
});

describe('gotcha first to', () => {
  const o2 = { ...o101, firstTo: 2 };
  // Bull + T17 = 101: player 0 wins game 1 with the second dart.
  const p0wins = [d('Bull'), d('T17')];
  const game1 = [...p0wins, next]; // closed winning visit
  const win1 = (log: TurnEvent[], o = o2) => gotcha.view(log, 2, o);

  it('defaults to 1 and keeps today\'s behaviour: match won at once, no game fx', () => {
    expect(gotcha.defaults.firstTo).toBe(1);
    const v = gotcha.view(p0wins, 2, o101);
    expect(v.phase).toBe('matchWon');
    expect(v.rows[0].meta).toBe('Left 0');
    expect(gotcha.happenings(p0wins, 2, o101).map(h => h.slot).filter(s => s.endsWith(':start'))).toEqual(['L1:start']);
    expect(gotcha.describe(o101, 2)).toBe('Gotcha · 101');
    expect(gotcha.describe(o2, 2)).toBe('Gotcha · 101 · First to 2');
  });

  it('loads old options without firstTo and rejects out-of-range values', () => {
    expect(gotcha.normalizeOptions({ target: 301, bullOff: 'off' }).firstTo).toBe(1);
    expect(gotcha.normalizeOptions({ firstTo: 3 }).firstTo).toBe(3);
    expect(gotcha.normalizeOptions({ firstTo: 9 }).firstTo).toBe(1);
  });

  it('a game win gives a point, holds the scores until the takeout, then resets', () => {
    const held = win1(p0wins);
    expect(held.phase).toBe('throwing');
    expect(held.totals).toEqual([101, 0]);
    expect(held.points).toEqual([1, 0]);
    expect(held.visit.verdict).toEqual({ text: 'Game won', tone: 'good' });
    expect(held.rows[0].meta).toBe('Left 0 · 1 point');
    const after = win1(game1);
    expect(after.totals).toEqual([0, 0]);
    expect(after.game).toBe(2);
    expect(after.visit.verdict).toBeNull();
    expect(after.rows[1].meta).toBe('Left 101 · 0 points');
    expect(after.winners).toEqual([]);
  });

  it('the next game starts with the next player in order, then rotates back', () => {
    expect(win1(game1).current).toBe(1);
    // Game 2 (starter 1): player 1 wins it; points 1-1; game 3 starts with player 0 again.
    const game2 = [d('Bull'), d('T17'), next];
    const v = gotcha.view([...game1, ...game2], 2, { ...o2, firstTo: 3 });
    expect(v.points).toEqual([1, 1]);
    expect(v.current).toBe(0);
  });

  it('the second win takes the match, with Game won then Match won in order', () => {
    // Game 2 starts with player 1.
    const g2 = [...game1, d('S1'), next, d('Bull'), d('T17')]; // p1 scores 1, p0 hits 101 again
    const v = gotcha.view(g2, 2, o2);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
    expect(v.result).toBe('Points 2–0');
    const slots = gotcha.happenings(g2, 2, o2).map(h => h.slot);
    expect(slots.indexOf('G1:won')).toBeLessThan(slots.indexOf('G2:start'));
    expect(slots.indexOf('G2:start')).toBeLessThan(slots.indexOf('match:won'));
    // As in X01, the game that ends the match also reports its checkout, before the match.
    expect(slots.indexOf('G2:won')).toBeLessThan(slots.indexOf('match:won'));
  });

  it('gotcha and bust still work in game 2, and an undo takes the game win back', () => {
    // Game 2 starts with player 1: p1 60, p0 lands on 60 -> p1 zeroed; then p1 busts.
    const g2 = [...game1, ...visit('T20'), d('T20'), d('Miss'), d('Miss')];
    expect(gotcha.view(g2, 2, o2).totals).toEqual([60, 0]);
    expect(gotcha.view(g2, 2, o2).stats[0]).toEqual({ gotchas: 1 });
    const bust = gotcha.view([...g2, next, d('T19'), d('T19')], 2, o2); // p1 on 0: 114 > 101
    expect(bust.totals).toEqual([60, 0]);
    expect(bust.visit.verdict).toEqual({ text: 'Bust', tone: 'bad' });
    expect(win1([...game1, { t: 'undo' }]).totals).toEqual([101, 0]);
    expect(win1([...p0wins, { t: 'undo' }]).points).toEqual([0, 0]);
  });
});

/** Same Wyzwalacze as X01: visit totals, checkout-only, left, never the old calledTotal. */
describe('gotcha effects', () => {
  const rule = (id: number, ...triggers: Trigger[]) => ({ id, enabled: true, triggers });
  const fired = (log: TurnEvent[], o = o201, players = 2): Change[] =>
    changes(gotcha.happenings(log.slice(0, -1), players, o), gotcha.happenings(log, players, o), 'other');
  const pick = (cs: Change[], ...rules: ReturnType<typeof rule>[]) => pickRule(rules, cs)?.id ?? null;
  const t180 = rule(1, { kind: 'total', total: 180, checkout: 'any' });

  it('reports the visit as a visit fact with the darts that went in', () => {
    const cs = fired([d('T20'), d('T20'), d('T20')]);
    expect(cs.map(c => c.fact.kind)).toEqual(['dart', 'left', 'visit']);
    expect(cs[2].fact).toMatchObject({ kind: 'visit', total: 180, checkout: false });
    expect(pick(cs, t180)).toBe(1);
    expect(gotcha.happenings([d('T20'), d('T20'), d('T20')], 2, o201).some(h => h.fact.kind === 'calledTotal')).toBe(false);
    // Next player: the misses filled in are not darts of the visit.
    const short = fired([d('T20'), next]);
    expect(short.map(c => c.fact.kind)).toEqual(['visit']);
    expect(short[0].fact).toMatchObject({ total: 60, darts: [{ n: 20, m: 3 }] });
  });

  it('fires a combination and a plain zero visit as No score', () => {
    const t20x3 = rule(2, { kind: 'combo', darts: [{ n: 20, m: 3 }, { n: 20, m: 3 }, { n: 20, m: 3 }], ordered: false, checkout: 'any' });
    expect(pick(fired([d('T20'), d('T20'), d('T20')]), t20x3)).toBe(2);
    const noScore = rule(3, { kind: 'total', total: 0, checkout: 'any' });
    const cs = fired([d('Miss'), d('Miss'), d('Miss')]);
    expect(cs.at(-1)!.fact).toMatchObject({ kind: 'visit', total: 0 });
    expect(pick(cs, noScore)).toBe(3);
  });

  it('a bust is a bust fact, with no visit', () => {
    const log = [...visit('T20', 'T20', 'T20'), ...visit('Miss'), d('T20')];
    const facts = fired(log).map(c => c.fact.kind);
    expect(facts).toContain('bust');
    expect(facts).not.toContain('visit');
    expect(pick(fired(log), t180, rule(4, { kind: 'bust' } as Trigger))).toBe(4);
  });

  it('a visit that hits the target is a checkout: Big Fish at 170, and no plain 170', () => {
    const log = [...visit('S1', 'S10', 'S20'), ...visit('S1'), d('T20'), d('T20'), d('Bull')];
    const cs = fired(log);
    expect(cs.find(c => c.fact.kind === 'visit')!.fact).toMatchObject({ total: 170, checkout: true });
    expect(pick(cs, rule(5, { kind: 'total', total: 170, checkout: 'only' }))).toBe(5);
    expect(pick(cs, rule(6, { kind: 'total', total: 170, checkout: 'no' }))).toBeNull();
  });

  it('the visit and the checkout also fire for the game that ends the match', () => {
    const kinds = fired([d('Bull'), d('T17')], o101).map(c => c.fact.kind);
    expect(kinds).toEqual(expect.arrayContaining(['visit', 'checkout', 'matchWon']));
    // One rule plays: Match won before Checkout, as in X01.
    const cs = fired([d('Bull'), d('T17')], o101);
    expect(pick(cs, rule(20, { kind: 'checkout' } as Trigger), rule(21, { kind: 'matchWon' } as Trigger))).toBe(21);
  });

  it('reports the score left after a dart that scored, not for a miss or the winning dart', () => {
    expect(fired([d('T20')]).map(c => c.fact)).toContainEqual({ kind: 'left', score: 141 });
    expect(pick(fired([d('T20')]), rule(7, { kind: 'left', score: 141 }))).toBe(7);
    expect(fired([d('Miss')]).some(c => c.fact.kind === 'left')).toBe(false);
    expect(fired([d('Bull'), d('T17')], o101).some(c => c.fact.kind === 'left' && c.fact.score === 0)).toBe(false);
    // The bust dart leaves nothing.
    const busted = [...visit('T20', 'T20', 'T20'), ...visit('Miss'), d('T20')];
    expect(fired(busted).some(c => c.fact.kind === 'left')).toBe(false);
  });

  it('Gotcha beats the visit total when a 180 sends a rival to zero', () => {
    const cs = fired([...visit('T20', 'T20', 'T20'), d('T20'), d('T20'), d('T20')]);
    expect(cs.map(c => c.fact.kind)).toContain('game');
    expect(pick(cs, t180, rule(8, { kind: 'game', event: 'gotcha' }))).toBe(8);
  });

  it('a 180 whose first dart zeroes plays Gotcha then, and the 180 alone with the third dart', () => {
    // p0 on 60, p1 throws T20 (zeroes p0), T20, T20 (180).
    const base = [...visit('T20'), d('T20')];
    const first = fired(base);
    expect(pick(first, t180, rule(8, { kind: 'game', event: 'gotcha' }))).toBe(8);
    const third = fired([...base, d('T20'), d('T20')]);
    expect(third.some(c => c.fact.kind === 'game')).toBe(false);
    expect(third.some(c => c.fact.kind === 'visit' && c.fact.total === 180)).toBe(true);
    expect(pick(third, t180, rule(8, { kind: 'game', event: 'gotcha' }))).toBe(1);
  });

  it('Undo and a fix do not fire again', () => {
    const log = [d('T20'), d('T20'), d('T20')];
    expect(changes(gotcha.happenings(log, 2, o201), gotcha.happenings([...log, { t: 'undo' } as TurnEvent], 2, o201), 'undo')).toEqual([]);
    // A fix that keeps the total the same fires nothing new; one that changes it fires the new total.
    const before = gotcha.happenings([d('S20'), d('T20'), d('T20')], 2, o201);
    const after = gotcha.happenings([d('S20'), d('T20'), d('T20'), { t: 'fix', index: 0, dart: parseDart('T20')! } as TurnEvent], 2, o201);
    const cs = changes(before, after, 'fix');
    expect(cs.map(c => c.fact.kind)).not.toContain('dart');
    expect(pick(cs, t180)).toBe(1);
  });
});
