// Stats v2 (docs/STATYSTYKI.md): progress against the previous Okno, trend, minigame winrate, X01 office records, player list.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseDart } from '../games/darts.ts';
import type { X01Event, X01Options } from '../games/x01/index.ts';
import { x01 } from '../games/x01/index.ts';
import { Db } from './db.ts';
import type { RosterEntry } from './protocol.ts';
import type { SaveMatch } from './db.ts';
import { Stats } from './stats.ts';
import { GAMES } from '../games/index.ts';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY;
const OPTS: X01Options = { startScore: 101, checkIn: 'straight', checkOut: 'double', matchMode: { kind: 'legs', firstTo: 1 }, bullOff: 'off' };

let dir: string;
let db: Db;
let stats: Stats;
let anna: number, bob: number, cy: number;
const A = () => ({ playerId: anna, name: 'Anna' });
const B = () => ({ playerId: bob, name: 'Bob' });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'itdarts-stats-'));
  db = new Db(dir);
  stats = new Stats(db, () => NOW);
  anna = db.createPlayer('Anna');
  bob = db.createPlayer('Bob');
  cy = db.createPlayer('Cy');
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

/** Darts all thrown at `at`, with a Next after every three but the last. */
const throws = (at: number, ...darts: string[]): X01Event[] =>
  darts.flatMap((s, i) => [{ t: 'dart', dart: parseDart(s)!, at } as X01Event, ...(i % 3 === 2 && i < darts.length - 1 ? [{ t: 'next', at } as X01Event] : [])]);

/** Saves an X01 match ended `daysAgo` days before NOW; the events are the game as thrown by the roster in turn. */
function saveX01(roster: RosterEntry[], events: X01Event[], daysAgo: number, o: X01Options = OPTS, status: 'finished' | 'ended' = 'finished') {
  const v = x01.view(events, roster.length, o);
  return db.saveMatch({
    game: 'x01', options: o, roster, startedAt: NOW - daysAgo * DAY - 1000, endedAt: NOW - daysAgo * DAY, status,
    winners: v.matchWinner === null ? [] : [v.matchWinner], sets: v.sets, legs: x01.compact(events, roster.length, o),
  });
}

/** Anna checks 101 out in one visit (T20 S1 D20), Bob is not given a turn: average 101. */
const quickLeg = (daysAgo: number) => throws(NOW - daysAgo * DAY, 'T20', 'S1', 'D20');
/** Anna throws one visit of 60 and the match is saved unfinished: average 60. */
const sixty = (daysAgo: number, dart = 'S20') => throws(NOW - daysAgo * DAY, dart, dart, dart);

describe('previous Okno of X01', () => {
  const week = (daysAgo: number[]) => daysAgo.forEach(d => saveX01([A(), B()], d < 7 ? sixty(d) : quickLeg(d), d, OPTS, d < 7 ? 'ended' : 'finished'));

  it('takes the period of the same length right before a time Okno', () => {
    week([1, 9, 10, 12]); // one leg now, three in [now - 14d, now - 7d)
    const p = stats.player(anna, '7d')!;
    expect(p.x01.avg).toBe(60);
    expect(p.previous).toEqual({ avg: 101, first9: 101, checkoutPct: null }); // too few checkout attempts to compare
    // The same legs, seen from 30d: now holds everything from the last 30 days, the previous Okno is empty.
    expect(stats.player(anna, '30d')!.previous).toBeNull();
  });

  it('does not reach back past the end of the previous period', () => {
    week([1, 9, 10, 15, 16]); // 15 and 16 days ago are before [now - 14d, now - 7d)
    expect(stats.player(anna, '7d')!.previous).toBeNull();
  });

  it('needs 3 legs in the previous Okno', () => {
    week([1, 9, 10]);
    expect(stats.player(anna, '7d')!.previous).toBeNull();
    week([11]);
    expect(stats.player(anna, '7d')!.previous).not.toBeNull();
  });

  it('is null when the current Okno has no leg at all', () => {
    week([9, 10, 11, 12]);
    expect(stats.player(anna, '7d')!.x01.legs).toBe(0);
    expect(stats.player(anna, '7d')!.previous).toBeNull();
  });

  it('is null for All time', () => {
    week([1, 9, 10, 11, 12]);
    expect(stats.player(anna, 'all')!.previous).toBeNull();
  });

  it('takes the 10 legs before the last 10 in a leg Okno', () => {
    // 14 legs, oldest first: the 4 oldest are 101-average legs, the 10 newest 60-average ones.
    for (let i = 14; i >= 1; i--) saveX01([A(), B()], i > 10 ? quickLeg(i) : sixty(i), i, OPTS, i > 10 ? 'finished' : 'ended');
    const p = stats.player(anna, 'l10')!;
    expect(p.x01.legs).toBe(10);
    expect(p.x01.avg).toBe(60);
    expect(p.previous).toEqual({ avg: 101, first9: 101, checkoutPct: null });
    expect(new Stats(db, () => NOW).player(anna, 'l100')!.previous).toBeNull(); // no legs before the last 100
  });

  it('compares Checkout % only with 10 checkout attempts in both Okna', () => {
    // A quick leg is one checkout attempt (D20 on 40), hit. Adds `now` legs to the last 7 days and `before` to the 7 days before.
    const legs = (now: number, before: number) => {
      for (let i = 0; i < now; i++) saveX01([A(), B()], quickLeg(1 + i * 0.5), 1 + i * 0.5);
      for (let i = 0; i < before; i++) saveX01([A(), B()], quickLeg(8 + i * 0.5), 8 + i * 0.5);
      return stats.player(anna, '7d')!;
    };
    const p = legs(9, 9);
    expect(p.x01.checkoutAttempts).toBe(9);
    expect(p.previous).toEqual({ avg: 101, first9: 101, checkoutPct: null });
    expect(legs(1, 0).previous!.checkoutPct).toBeNull(); // 10 now, 9 before
    expect(legs(0, 1).previous!.checkoutPct).toBe(100); // 10 and 10
  });

  it('needs 10 attempts in the current Okno too', () => {
    for (let i = 0; i < 9; i++) saveX01([A(), B()], quickLeg(1 + i * 0.5), 1 + i * 0.5);
    for (let i = 0; i < 10; i++) saveX01([A(), B()], quickLeg(8 + i * 0.5), 8 + i * 0.5);
    expect(stats.player(anna, '7d')!.previous).toEqual({ avg: 101, first9: 101, checkoutPct: null });
  });

  it('needs 3 legs before the last 10 as well', () => {
    for (let i = 12; i >= 1; i--) saveX01([A(), B()], i > 10 ? quickLeg(i) : sixty(i), i, OPTS, i > 10 ? 'finished' : 'ended');
    expect(stats.player(anna, 'l10')!.previous).toBeNull(); // 2 legs before
  });
});

describe('Average trend', () => {
  it('gives the Average of each X01 match of the Okno, oldest first', () => {
    // Saved newest first on purpose.
    saveX01([A(), B()], sixty(1, 'S10'), 1, OPTS, 'ended');
    saveX01([A(), B()], throws(NOW - 2 * DAY, 'T20', 'S20', 'S1'), 2, OPTS, 'ended'); // 81
    saveX01([A(), B()], sixty(3), 3, OPTS, 'ended');
    saveX01([A(), B()], sixty(40), 40, OPTS, 'ended'); // outside 30d
    const t = stats.player(anna, '30d')!.trend;
    expect(t.map(x => x.avg)).toEqual([60, 81, 30]);
    expect(t.map(x => x.endedAt)).toEqual([NOW - 3 * DAY, NOW - 2 * DAY, NOW - DAY]);
    expect(stats.player(anna, 'all')!.trend).toHaveLength(4);
    expect(stats.player(anna, 'l10')!.trend).toHaveLength(4);
  });

  it('averages a match cut by the edge of the Okno from the visits inside it', () => {
    // One match: a visit of 60 thirty-one days ago, then a visit of 30 twenty-nine days ago.
    const old = throws(NOW - 31 * DAY, 'S20', 'S20', 'S20'), recent = throws(NOW - 29 * DAY, 'S10', 'S10', 'S10');
    saveX01([A()], [...old, { t: 'next' } as X01Event, ...recent], 29, OPTS, 'ended');
    expect(stats.player(anna, '30d')!.trend.map(x => x.avg)).toEqual([30]);
    expect(stats.player(anna, '90d')!.trend.map(x => x.avg)).toEqual([45]);
  });

  it('is empty without matches and skips matches where the player threw nothing', () => {
    expect(stats.player(anna, 'all')!.trend).toEqual([]);
    saveX01([A(), B()], [...throws(NOW, 'S1', 'S1', 'S1')], 1, OPTS, 'ended'); // only Anna threw
    expect(stats.player(bob, 'all')!.trend).toEqual([]);
    expect(stats.player(anna, 'all')!.trend).toHaveLength(1);
  });
});

describe('recent matches', () => {
  it('shows the score from the player\'s side, own legs first', () => {
    saveX01([A(), B()], quickLeg(1), 1, OPTS, 'finished'); // Anna 1-0, Bob 0-1
    db.saveMatch({ game: 'x01', options: OPTS, roster: [A(), B()], startedAt: NOW - DAY - 1000, endedAt: NOW - DAY, status: 'finished',
      winners: [1], sets: [], legs: [], legsWon: [1, 2] }); // Bob 2-1
    const recent = (id: number) => stats.player(id, 'all')!.recent.map(r => r.score).sort();
    expect(recent(bob)).toEqual(['0–1', '2–1']);
    expect(recent(anna)).toEqual(['1–0', '1–2']);
    const results = (id: number) => stats.player(id, 'all')!.recent.map(r => `${r.result} ${r.score}`).sort();
    expect(results(anna)).toEqual(['lost 1–2', 'won 1–0']);
    expect(results(bob)).toEqual(['lost 0–1', 'won 2–1']);
  });

  it('lists only X01 matches of the Okno', () => {
    saveX01([A(), B()], sixty(1), 1, OPTS, 'ended');
    saveX01([A(), B()], sixty(30), 30, OPTS, 'ended');
    db.saveMatch({ game: 'atc', options: {}, roster: [A()], startedAt: NOW - DAY - 1000, endedAt: NOW - DAY, status: 'finished', winners: [], sets: [], legs: [], stats: [{ darts: 9 }] });
    expect(stats.player(anna, '7d')!.recent).toHaveLength(1);
    expect(stats.player(anna, '90d')!.recent).toHaveLength(2); // the minigame never shows
  });

  it('respects a leg Okno', () => {
    for (let i = 12; i >= 2; i--) saveX01([A(), B()], sixty(i), i, OPTS, 'ended');
    saveX01([B(), A()], sixty(1), 1, OPTS, 'ended'); // Bob throws, Anna sits: no leg of hers
    expect(stats.player(anna, 'all')!.recent).toHaveLength(10); // capped at 10
    expect(stats.player(anna, 'all')!.recent.map(r => r.endedAt)).toContain(NOW - DAY);
    const l10 = stats.player(anna, 'l10')!.recent.map(r => r.endedAt);
    expect(l10).toHaveLength(10);
    expect(l10).not.toContain(NOW - DAY); // outside the 10 legs
    expect(l10).toContain(NOW - 11 * DAY);
  });
});

describe('minigame stats', () => {
  const o = {};
  const mini = (roster: RosterEntry[], daysAgo: number, extra: Partial<SaveMatch> & { stats: Record<string, number>[] }) =>
    db.saveMatch({
      game: 'atc', options: o, roster, startedAt: NOW - daysAgo * DAY - 1000, endedAt: NOW - daysAgo * DAY, status: 'finished',
      winners: [0], sets: [], legs: [], ...extra,
    });
  const solo = (daysAgo: number, st: Record<string, number> = { darts: 9, hits: 3 }) => mini([A()], daysAgo, { winners: [], stats: [st] });

  it('says how many matches the totals come from', () => {
    solo(1);
    solo(2, { darts: 6, hits: 6 });
    mini([A(), B()], 3, { stats: [{ darts: 3, hits: 1 }, { darts: 3, hits: 0 }], removed: [true, false] }); // Anna left: darts count, match not
    const g = stats.game(anna, 'atc', 'all')!;
    expect(g.matches).toBe(3);
    expect(g.played).toBe(2);
    expect(g.totals).toEqual({ darts: 18, hits: 10 });
  });

  it('compares with the previous Okno, with its own totals and matches', () => {
    solo(1);
    for (const d of [9, 10, 11]) solo(d, { darts: 3, hits: 3 });
    const g = stats.game(anna, 'atc', '7d')!;
    expect(g).toMatchObject({ matches: 1, totals: { darts: 9, hits: 3 }, previous: { matches: 3, totals: { darts: 9, hits: 9 } } });
  });

  it('has no previous Okno when the current one has no match', () => {
    for (const d of [9, 10, 11]) solo(d);
    expect(stats.game(anna, 'atc', '7d')).toMatchObject({ matches: 0, previous: null });
  });

  it('needs 3 matches in the previous Okno, and has none for All time', () => {
    solo(1);
    solo(9);
    solo(10);
    expect(stats.game(anna, 'atc', '7d')!.previous).toBeNull();
    solo(11);
    expect(stats.game(anna, 'atc', '7d')!.previous).not.toBeNull();
    expect(stats.game(anna, 'atc', 'all')!.previous).toBeNull();
  });

  it('takes the 10 matches before the last 10 in a leg Okno', () => {
    for (let i = 13; i >= 1; i--) solo(i, i > 10 ? { darts: 1, hits: 1 } : { darts: 2, hits: 0 });
    const g = stats.game(anna, 'atc', 'l10')!;
    expect([g.matches, g.totals]).toEqual([10, { darts: 20, hits: 0 }]);
    expect(g.previous).toEqual({ matches: 3, totals: { darts: 3, hits: 3 } });
  });

  it('keeps `best` a maximum in the previous Okno too', () => {
    solo(1, { best: 90, darts: 3 });
    for (const [d, best] of [[9, 100], [10, 140], [11, 120]]) solo(d, { best, darts: 3 });
    const g = stats.game(anna, 'atc', '7d')!;
    expect(g.totals).toEqual({ best: 90, darts: 3 });
    expect(g.previous!.totals).toEqual({ best: 140, darts: 9 });
  });

  it('has no visits and survived for a Higher or Lower match saved before they existed', () => {
    mini([A(), B()], 1, { game: 'hol', stats: [{}, {}] });
    expect(stats.game(anna, 'hol', 'all')!.totals).toEqual({});
    mini([A(), B()], 1, { game: 'hol', stats: [{ visits: 4, survived: 3 }, { visits: 4, survived: 1 }] });
    expect(stats.game(anna, 'hol', 'all')!.totals).toEqual({ visits: 4, survived: 3 });
  });

  describe('winrate as in X01', () => {
    it('counts only versus matches in it, and solo matches only as played', () => {
      solo(1);
      solo(2);
      mini([A(), B()], 3, { stats: [{}, {}] }); // Anna wins
      mini([A(), B()], 4, { winners: [1], stats: [{}, {}] }); // Anna loses
      const g = stats.game(anna, 'atc', 'all')!;
      expect([g.played, g.versus.won]).toEqual([4, 1]);
      expect(g.versus).toEqual({ played: 2, won: 1, winrate: 50 });
    });

    it('is zero for a game that has only solo matches', () => {
      solo(1);
      expect(stats.game(anna, 'atc', 'all')!.versus).toEqual({ played: 0, won: 0, winrate: null });
    });

    it('leaves out a match with a guest', () => {
      mini([A(), { playerId: null, name: 'Guest 1' }], 1, { stats: [{}, {}] });
      const g = stats.game(anna, 'atc', 'all')!;
      expect([g.played, g.versus.played]).toEqual([1, 0]);
    });

    it('leaves out a match the player was removed from, for him only', () => {
      mini([A(), B()], 1, { stats: [{}, {}], removed: [false, true] });
      expect(stats.game(bob, 'atc', 'all')!.versus.played).toBe(0);
      expect(stats.game(anna, 'atc', 'all')!.versus).toEqual({ played: 1, won: 1, winrate: 100 });
    });

    it('leaves out a match saved with "Save" instead of played to the end, and a tie', () => {
      mini([A(), B()], 1, { status: 'ended', winners: [], stats: [{}, {}] });
      mini([A(), B()], 2, { winners: [0, 1], stats: [{}, {}] });
      const g = stats.game(anna, 'atc', 'all')!;
      expect(g.versus.played).toBe(0);
      expect(g.played).toBe(2);
    });
  });
});

describe('X01 office records', () => {
  const quick = (at: number) => throws(at, 'T20', 'S1', 'D20');

  it('is empty without matches', () => {
    expect(stats.records('x01')).toEqual([]);
  });

  it('lists highest visit, highest checkout and best leg per start score, best first, earlier first on a tie', () => {
    saveX01([A()], throws(NOW - 5 * DAY, 'T20', 'S1', 'D20'), 5); // 101 in 3 darts, visit 101, checkout 101
    saveX01([B()], throws(NOW - 4 * DAY, 'T20', 'S1', 'D20'), 4); // the same, later: Anna stays first
    saveX01([A()], throws(NOW - 3 * DAY, 'S20', 'S20', 'S1', 'S20', 'D20'), 3); // visits of 41 and 60, checkout from 60 in 5 darts
    const [visit, checkout, leg] = stats.records('x01');
    expect(visit).toMatchObject({ key: 'visit', label: 'Highest visit' });
    const want = [['101', 'Anna'], ['101', 'Bob'], ['60', 'Anna']];
    expect(visit.rows.map(r => [r.value, r.who])).toEqual(want);
    expect(checkout).toMatchObject({ key: 'checkout', label: 'Highest checkout' });
    expect(checkout.rows.map(r => [r.value, r.who])).toEqual(want);
    expect(leg).toMatchObject({ key: 'leg:101', label: 'Best leg · 101' });
    expect(leg.rows.map(r => [r.value, r.who, r.at])).toEqual([['3 darts', 'Anna', NOW - 5 * DAY], ['3 darts', 'Bob', NOW - 4 * DAY], ['5 darts', 'Anna', NOW - 3 * DAY]]);
  });

  it('gives one row per player and match', () => {
    // Two legs in one match, Anna wins both: only her better visit and her better leg are listed.
    const o: X01Options = { ...OPTS, matchMode: { kind: 'legs', firstTo: 2 } };
    const events: X01Event[] = [...throws(NOW, 'T20', 'S1', 'D20'), { t: 'nextLeg' }, ...throws(NOW, 'S20', 'S20', 'S1', 'S20', 'D20')];
    saveX01([A()], events, 0, o);
    const [visit, , leg] = stats.records('x01');
    expect(visit.rows).toHaveLength(1);
    expect(leg.rows.map(r => r.value)).toEqual(['3 darts']);
  });

  it('keeps guests out, since they leave no visits', () => {
    saveX01([{ playerId: null, name: 'Guest 1' }, A()], [...throws(NOW, 'S1', 'S1', 'S1'), ...throws(NOW, 'T20', 'S1', 'D20')], 1);
    for (const t of stats.records('x01')) expect(t.rows.every(r => r.who === 'Anna')).toBe(true);
  });

  it('leaves out legs that were not finished', () => {
    saveX01([A(), B()], throws(NOW, 'T20', 'S20', 'S1'), 1, OPTS, 'ended');
    const t = stats.records('x01');
    expect(t.map(x => x.key)).toEqual(['visit']); // the 81 counts as a visit, but there is no checkout and no leg
    expect(t[0].rows[0].value).toBe('81');
  });

  it('has a table for every start score played', () => {
    saveX01([A()], quick(NOW - DAY), 1);
    saveX01([A()], throws(NOW, 'T20', 'T20', 'T20', 'T20', 'S11', 'Bull'), 0, { ...OPTS, startScore: 301 }); // 180, then 121 out on the bull
    expect(stats.records('x01').map(t => t.key)).toEqual(['visit', 'checkout', 'leg:101', 'leg:301']);
  });

  it('does not give X01 a record to play against: no Ekran rekordu', async () => {
    const { GAMES } = await import('../games/index.ts');
    expect(GAMES.x01.record).toBeUndefined();
  });
});

describe('player list', () => {
  const row = (id: number) => stats.list().find(p => p.id === id)!;

  it('gives the Average of the last 30 days and of the 30 days before', () => {
    saveX01([A(), B()], sixty(5), 5, OPTS, 'ended');
    for (const d of [35, 40, 45]) saveX01([A(), B()], quickLeg(d), d);
    expect(row(anna)).toMatchObject({ avg: 60, avgPrev: 101 });
  });

  it('needs 3 legs in the previous 30 days', () => {
    saveX01([A(), B()], sixty(5), 5, OPTS, 'ended');
    for (const d of [35, 40]) saveX01([A(), B()], quickLeg(d), d);
    expect(row(anna).avgPrev).toBeNull();
    expect(row(anna).avg).toBe(60);
  });

  it('does not reach past 60 days', () => {
    for (const d of [35, 40, 61, 62]) saveX01([A(), B()], quickLeg(d), d);
    expect(row(anna)).toMatchObject({ avg: null, avgPrev: null });
  });

  it('counts the matches of the last 30 days in every game, without those the player left', () => {
    saveX01([A(), B()], sixty(5), 5, OPTS, 'ended');
    saveX01([A(), B()], quickLeg(40), 40); // too old
    db.saveMatch({ game: 'atc', options: {}, roster: [A()], startedAt: 1, endedAt: NOW - DAY, status: 'finished', winners: [], sets: [], legs: [], stats: [{}] });
    db.saveMatch({
      game: 'atc', options: {}, roster: [A(), { playerId: cy, name: 'Cy' }], startedAt: 1, endedAt: NOW - DAY, status: 'finished', winners: [0], sets: [], legs: [],
      stats: [{}, {}], removed: [false, true],
    });
    expect(row(anna).matches).toBe(3);
    expect(row(bob).matches).toBe(1);
    expect(row(cy).matches).toBe(0);
  });
});

// D6 (ui-overhaul DECISIONS.md): the lobby shows the office record of every minigame variant played, with the options
// of the record's match, so a tap opens New match with that game set up the same way.
describe('lobby records', () => {
  const save = (game: string, options: object, variant: string, roster: RosterEntry[], scores: (number | null)[], daysAgo: number) =>
    db.saveMatch({
      game: game as SaveMatch['game'], options, roster, startedAt: NOW - daysAgo * DAY - 1000, endedAt: NOW - daysAgo * DAY, status: 'finished',
      winners: [], sets: [], legs: [], variant, scores, stats: roster.map(() => ({})),
    } as SaveMatch);

  it('is empty without minigame records', () => {
    expect(stats.lobbyRecords()).toEqual([]);
  });

  it('gives the best result of each variant with the options of its match, in the order of the game groups', () => {
    save('shanghai', { rounds: 7 }, 'shanghai:solo:7', [B()], [90], 3);
    save('atc', { target: 'any', order: 'random', skips: true }, 'atc:any:skips', [A()], [30], 5);
    save('atc', { target: 'any', order: 'clockwise', skips: true }, 'atc:any:skips', [B()], [24], 4);
    save('121', { visits: 3, refill: true }, '121:v3:refill:coop', [A(), B()], [140, 140], 2);
    const r = stats.lobbyRecords();
    expect(r.map(x => x.key)).toEqual(['atc:any:skips', '121:v3:refill:coop', 'shanghai:solo:7']);
    // ATC: fewer darts is better, so Bob's 24 with the clockwise order; the order is not in the key, the match keeps it.
    expect(r[0]).toMatchObject({ game: 'atc', value: '24 darts', who: 'Bob', at: NOW - 4 * DAY });
    expect(r[0].options).toMatchObject({ target: 'any', order: 'clockwise', skips: true });
    // The tile names the record match's order, which the variant leaves out (DECISIONS, after the branch review).
    expect(r[0].label).toBe('ATC · Any · Skips · Clockwise');
    expect(r[1]).toMatchObject({ game: '121', value: 'Target 140', who: 'Anna & Bob' });
    expect(r[2]).toMatchObject({ game: 'shanghai', label: 'Shanghai · Solo · 7 rounds', value: '90 points', who: 'Bob' });
    expect(r[2].options).toMatchObject({ rounds: 7 });
  });

  it('orders the variants of a game by number, not by text: 5 before 10, 7 before 20', () => {
    save('catch40', { targets: 40 }, 'catch40', [A()], [90], 1);
    for (const n of [20, 10, 5]) save('catch40', { targets: n }, `catch40:${n}`, [A()], [n], 1);
    save('shanghai', { rounds: 20 }, 'shanghai:solo:20', [A()], [90], 1);
    save('shanghai', { rounds: 7 }, 'shanghai:solo:7', [A()], [80], 1);
    expect(stats.lobbyRecords().map(x => x.key)).toEqual(['catch40:5', 'catch40:10', 'catch40:20', 'catch40', 'shanghai:solo:7', 'shanghai:solo:20']);
    expect(stats.records('catch40').map(t => t.label)).toEqual(['Catch 40 · 5 targets', 'Catch 40 · 10 targets', 'Catch 40 · 20 targets', 'Catch 40 · 40 targets']);
    expect(stats.game(anna, 'catch40', 'all')!.bests.map(b => b.label)).toEqual(['Catch 40 · 5 targets', 'Catch 40 · 10 targets', 'Catch 40 · 20 targets', 'Catch 40 · 40 targets']);
  });

  it('fills the options the record match did not save with the game defaults', () => {
    save('atc', {}, 'atc:any:skips', [A()], [20], 1);
    expect(stats.lobbyRecords()[0].options).toEqual(GAMES.atc.normalizeOptions({}));
  });
});

// Lobby records (docs/UI.md, Lobby i QR): every variant with a record, games and variants by matches of the last 30 days, then of all time.
describe('lobby records: order, chase, players', () => {
  const save = (game: string, options: object, variant: string, roster: RosterEntry[], scores: (number | null)[], daysAgo: number) =>
    db.saveMatch({
      game: game as SaveMatch['game'], options, roster, startedAt: NOW - daysAgo * DAY - 1000, endedAt: NOW - daysAgo * DAY, status: 'finished',
      winners: [], sets: [], legs: [], variant, scores, stats: roster.map(() => ({})),
    } as SaveMatch);
  const C = () => ({ playerId: cy, name: 'Cy' });
  /** Ten ATC and Shanghai variants: the shanghai ones differ by rounds (3..10), so each gets its own key. */
  const shanghai = (rounds: number, times: number, daysAgo: number) => {
    for (let i = 0; i < times; i++) save('shanghai', { rounds }, `shanghai:solo:${rounds}`, [A()], [50 + i], daysAgo);
  };

  it('sorts by matches in the last 30 days, most first', () => {
    shanghai(3, 1, 2); shanghai(4, 3, 10); shanghai(5, 2, 29);
    expect(stats.lobbyTop().map(r => r.key)).toEqual(['shanghai:solo:4', 'shanghai:solo:5', 'shanghai:solo:3']);
  });

  it('fills up with the most played of all time when fewer than 8 were played lately', () => {
    shanghai(3, 1, 5); shanghai(4, 4, 90); shanghai(5, 2, 40); shanghai(6, 2, 200);
    // Recent first (3), then by all-time count (4: 4, then 5 and 6: 2 each, by label).
    expect(stats.lobbyTop().map(r => r.key)).toEqual(['shanghai:solo:3', 'shanghai:solo:4', 'shanghai:solo:5', 'shanghai:solo:6']);
  });

  it('puts the busier of two variants without recent matches first, whatever their labels', () => {
    shanghai(4, 2, 90); shanghai(6, 3, 100);
    expect(stats.lobbyTop().map(r => r.key)).toEqual(['shanghai:solo:6', 'shanghai:solo:4']);
  });

  it('ranks a recent variant above a busier old one, and breaks ties by label', () => {
    shanghai(7, 1, 1); shanghai(8, 1, 1); shanghai(9, 5, 100);
    expect(stats.lobbyTop().map(r => r.key)).toEqual(['shanghai:solo:7', 'shanghai:solo:8', 'shanghai:solo:9']);
  });

  it('keeps every variant with a record, none is cut', () => {
    for (let r = 3; r <= 12; r++) shanghai(r, 1, 3);
    expect(stats.lobbyTop()).toHaveLength(10);
    expect(stats.lobbyRecords()).toHaveLength(10);
  });

  it('groups the variants by game and orders the games by their matches in the last 30 days', () => {
    // ATC: 3 recent matches over two variants; Shanghai: 4 recent in one; Full Board: only old ones, but many.
    save('atc', { target: 'any', skips: true }, 'atc:any:skips', [A()], [30], 2);
    save('atc', { target: 'any', skips: false }, 'atc:any:noskips', [A()], [30], 3);
    save('atc', { target: 'any', skips: false }, 'atc:any:noskips', [B()], [31], 4);
    shanghai(4, 4, 5);
    for (let i = 0; i < 6; i++) save('fullboard', { target: 'any' }, 'fullboard:any', [A()], [40 + i], 100);
    // Shanghai (4 recent) before ATC (3), the old Full Board last; within ATC the busier variant first.
    expect(stats.lobbyTop().map(r => r.key)).toEqual(['shanghai:solo:4', 'atc:any:noskips', 'atc:any:skips', 'fullboard:any']);
  });

  it('keeps a game together although another game has a variant in between by popularity', () => {
    // ATC's busiest variant (3) beats Shanghai's (2), but Shanghai has more matches in all; the game total decides.
    save('atc', { target: 'any', skips: true }, 'atc:any:skips', [A()], [30], 2);
    save('atc', { target: 'any', skips: true }, 'atc:any:skips', [B()], [31], 2);
    save('atc', { target: 'any', skips: true }, 'atc:any:skips', [B()], [32], 2);
    shanghai(4, 2, 3); shanghai(5, 2, 3);
    expect(stats.lobbyTop().map(r => r.game)).toEqual(['shanghai', 'shanghai', 'atc']);
  });

  it('breaks a tie between games by matches of all time, then by name', () => {
    save('atc', { target: 'any', skips: true }, 'atc:any:skips', [A()], [30], 100);
    shanghai(4, 2, 100);
    for (let i = 0; i < 2; i++) save('fullboard', { target: 'any' }, 'fullboard:any', [A()], [40 + i], 100);
    // None recent; Shanghai and Full Board have 2 each, ATC 1. Around the Clock < Full Board < Shanghai only by name, so Full Board first.
    expect(stats.lobbyTop().map(r => r.game)).toEqual(['fullboard', 'shanghai', 'atc']);
  });

  it('names the game and gives the options without it', () => {
    save('atc', { target: 'any', order: 'clockwise', skips: true }, 'atc:any:skips', [A()], [24], 1);
    save('121', { visits: 3, refill: true }, '121:v3:refill:coop', [A(), B()], [140, 140], 1);
    save('cricket', {}, 'cricket:solo', [A()], [50], 1);
    const by = Object.fromEntries(stats.lobbyTop().map(r => [r.game, r]));
    expect(by.atc).toMatchObject({ title: 'ATC', sub: 'Any · Skips · Clockwise', label: 'ATC · Any · Skips · Clockwise' });
    expect(by['121']).toMatchObject({ title: '121', sub: '3 visits · Refill lives · Co-op' });
    expect(by.cricket).toMatchObject({ title: 'Cricket', sub: 'Solo' });
  });

  it('counts only the last 30 days as recent, the 30th day included', () => {
    shanghai(3, 3, 31); shanghai(4, 1, 30); shanghai(5, 1, 29);
    // 4 and 5 are recent (one match each, label breaks the tie); 3 has more matches overall but none lately.
    expect(stats.lobbyTop().map(r => r.key)).toEqual(['shanghai:solo:4', 'shanghai:solo:5', 'shanghai:solo:3']);
  });

  it('chases with the 2nd and 3rd place, fewer when there are fewer results', () => {
    save('shanghai', { rounds: 7 }, 'shanghai:solo:7', [A()], [90], 5);
    expect(stats.lobbyRecords()[0].chase).toEqual([]);
    save('shanghai', { rounds: 7 }, 'shanghai:solo:7', [B()], [80], 4);
    expect(stats.lobbyRecords()[0].chase).toEqual([{ who: 'Bob', value: '80 points' }]);
    save('shanghai', { rounds: 7 }, 'shanghai:solo:7', [C()], [70], 3);
    save('shanghai', { rounds: 7 }, 'shanghai:solo:7', [A()], [60], 2);
    expect(stats.lobbyRecords()[0]).toMatchObject({ who: 'Anna', value: '90 points' });
    expect(stats.lobbyRecords()[0].chase).toEqual([{ who: 'Bob', value: '80 points' }, { who: 'Cy', value: '70 points' }]);
  });

  it('chases people, not results: a player with the 1st, 2nd and 3rd result is one place', () => {
    save('shanghai', { rounds: 7 }, 'shanghai:solo:7', [A()], [90], 5);
    save('shanghai', { rounds: 7 }, 'shanghai:solo:7', [A()], [85], 4);
    save('shanghai', { rounds: 7 }, 'shanghai:solo:7', [A()], [80], 3);
    expect(stats.lobbyRecords()[0].chase).toEqual([]);
    save('shanghai', { rounds: 7 }, 'shanghai:solo:7', [B()], [70], 2);
    save('shanghai', { rounds: 7 }, 'shanghai:solo:7', [B()], [60], 1);
    expect(stats.lobbyRecords()[0]).toMatchObject({ who: 'Anna', value: '90 points' });
    expect(stats.lobbyRecords()[0].chase).toEqual([{ who: 'Bob', value: '70 points' }]);
    save('shanghai', { rounds: 7 }, 'shanghai:solo:7', [C()], [65], 1);
    expect(stats.lobbyTop()[0].chase).toEqual([{ who: 'Bob', value: '70 points' }, { who: 'Cy', value: '65 points' }]);
  });

  it('chases lineups in co-op: the same lineup twice is one place', () => {
    save('121', { visits: 3, refill: true }, '121:v3:refill:coop', [A(), B()], [140, 140], 4);
    save('121', { visits: 3, refill: true }, '121:v3:refill:coop', [B(), A()], [135, 135], 3);
    save('121', { visits: 3, refill: true }, '121:v3:refill:coop', [A(), C()], [130, 130], 2);
    expect(stats.lobbyRecords()[0].chase).toEqual([{ who: 'Anna & Cy', value: 'Target 130' }]);
  });

  it('chases a co-op record with the lineups', () => {
    save('121', { visits: 3, refill: true }, '121:v3:refill:coop', [A(), B()], [140, 140], 4);
    save('121', { visits: 3, refill: true }, '121:v3:refill:coop', [A(), C()], [130, 130], 3);
    expect(stats.lobbyRecords()[0].chase).toEqual([{ who: 'Anna & Cy', value: 'Target 130' }]);
  });

  it('says how many players a record takes: one for solo, two to the game limit for co-op', () => {
    save('shanghai', { rounds: 7 }, 'shanghai:solo:7', [A()], [90], 3);
    save('121', { visits: 3, refill: true }, '121:v3:refill:coop', [A(), B()], [140, 140], 2);
    const [coop, solo] = [stats.lobbyRecords().find(r => r.key.endsWith(':coop'))!, stats.lobbyRecords().find(r => r.key.startsWith('shanghai'))!];
    expect(solo).toMatchObject({ coop: false, minPlayers: 1, maxPlayers: 1 });
    expect(coop).toMatchObject({ coop: true, minPlayers: 2, maxPlayers: 8 });
  });
});

// C#19 (stats audit): minigame profiles list their own recent matches, per Okno, with the result as the lobby shows it.
describe('recent minigame matches', () => {
  const atc = (roster: RosterEntry[], daysAgo: number, scores: (number | null)[], winners: number[] = []) =>
    db.saveMatch({ game: 'atc', options: {}, roster, startedAt: NOW - daysAgo * DAY - 1000, endedAt: NOW - daysAgo * DAY, status: 'finished',
      winners, sets: [], legs: [], variant: 'atc:any:skips', scores, stats: roster.map(() => ({ darts: 30 })) } as SaveMatch);

  it('lists only that game in the Okno, newest first, with the record result and no opponents when solo', () => {
    atc([A()], 3, [26]);
    atc([A(), B()], 10, [31, 40], [0]);
    atc([A()], 45, [28]);
    saveX01([A(), B()], quickLeg(2), 2, OPTS, 'finished');
    const r = stats.game(anna, 'atc', '30d')!.recent;
    expect(r.map(x => x.endedAt)).toEqual([NOW - 3 * DAY, NOW - 10 * DAY]);
    expect(r[0]).toMatchObject({ opponents: null, score: '26 darts', result: 'played' });
    expect(r[1]).toMatchObject({ opponents: 'Bob', score: '31 darts', result: 'won' });
    expect(stats.game(anna, 'atc', 'all')!.recent).toHaveLength(3);
  });

  it('takes the last matches in a Last 10 Okno and keeps 10 at most', () => {
    for (let i = 12; i >= 1; i--) atc([A()], i, [20 + i]);
    const r = stats.game(anna, 'atc', 'l10')!.recent;
    expect(r).toHaveLength(10);
    expect(r[0].endedAt).toBe(NOW - DAY);
  });

  it('lists opponents in the order they played and marks a solo X01 match with no opponents', () => {
    saveX01([A()], quickLeg(1), 1, OPTS, 'finished');
    db.saveMatch({ game: 'x01', options: OPTS, roster: [B(), A(), { playerId: cy, name: 'Cy' }], startedAt: NOW - 2 * DAY - 1000, endedAt: NOW - 2 * DAY, status: 'ended',
      winners: [], sets: [], legs: [], legsWon: [2, 1, 0] });
    const r = stats.player(anna, 'all')!.recent;
    expect(r[0].opponents).toBeNull();
    expect(r[1].opponents).toBe('Bob, Cy');
    expect(r[1].score).toBe('1–2–0'); // own legs first, then the others in their playing order
  });

  it('marks a match the player left, a match ended without a result and a loss, with guests among the opponents', () => {
    const G = { playerId: null, name: 'Guest 1' };
    const save = (roster: RosterEntry[], daysAgo: number, extra: Partial<SaveMatch>) =>
      db.saveMatch({ game: 'atc', options: {}, roster, startedAt: NOW - daysAgo * DAY - 1000, endedAt: NOW - daysAgo * DAY, status: 'finished',
        winners: [], sets: [], legs: [], variant: 'atc:any:skips', scores: roster.map(() => null), stats: roster.map(() => ({ darts: 30 })), ...extra } as SaveMatch);
    save([A(), G, B()], 1, { winners: [2], removed: [true, false, false] });
    save([A(), B()], 2, { status: 'ended' });
    save([G, A()], 3, { winners: [0] });
    // Left a match that was then ended without a result: leaving is what happened to the player.
    save([B(), A()], 4, { status: 'ended', removed: [false, true] });
    const r = stats.game(anna, 'atc', '30d')!.recent;
    expect(r.map(x => [x.result, x.opponents])).toEqual([['left', 'Guest 1, Bob'], ['saved', 'Bob'], ['lost', 'Guest 1'], ['left', 'Bob']]);
  });
});
