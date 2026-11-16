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
    expect(p.previous).toEqual({ avg: 101, first9: 101, checkoutPct: 100 });
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
    expect(p.previous).toEqual({ avg: 101, first9: 101, checkoutPct: 100 });
    expect(new Stats(db, () => NOW).player(anna, 'l100')!.previous).toBeNull(); // no legs before the last 100
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

  it('is empty without matches and skips matches where the player threw nothing', () => {
    expect(stats.player(anna, 'all')!.trend).toEqual([]);
    saveX01([A(), B()], [...throws(NOW, 'S1', 'S1', 'S1')], 1, OPTS, 'ended'); // only Anna threw
    expect(stats.player(bob, 'all')!.trend).toEqual([]);
    expect(stats.player(anna, 'all')!.trend).toHaveLength(1);
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
      expect([g.played, g.won]).toEqual([4, 1]);
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
