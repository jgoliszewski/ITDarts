import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseDart } from '../games/darts.ts';
import type { X01Event, X01Options } from '../games/x01/index.ts';
import { freethrow } from '../games/freethrow.ts';
import { atc } from '../games/race.ts';
import { x01 } from '../games/x01/index.ts';
import { Db } from './db.ts';
import { rematchSetup } from './hub.ts';
import type { RosterEntry } from './protocol.ts';
import { Stats } from './stats.ts';

const OPTS: X01Options = { startScore: 101, checkIn: 'straight', checkOut: 'double', matchMode: { kind: 'legs', firstTo: 1 }, bullOff: 'off' };
const d = (s: string): X01Event => ({ t: 'dart', dart: parseDart(s)!, at: Date.now() });
const next: X01Event = { t: 'next', at: Date.now() };

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'itdarts-'));
  db = new Db(dir);
});
afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

function save(roster: RosterEntry[], events: X01Event[], status: 'finished' | 'ended' = 'finished') {
  const v = x01.view(events, roster.length, OPTS);
  return db.saveMatch({
    game: 'x01', options: OPTS, roster, startedAt: Date.now() - 1000, endedAt: Date.now(), status,
    winners: v.matchWinner === null ? [] : [v.matchWinner], sets: v.sets, legs: x01.compact(events, roster.length, OPTS),
  });
}

describe('players', () => {
  it('keeps names unique regardless of case', () => {
    db.createPlayer('Anna');
    expect(() => db.createPlayer(' anna ')).toThrow(/already exists/);
  });

  it('merges history into another player', () => {
    const a = db.createPlayer('Anna'), typo = db.createPlayer('Ana'), b = db.createPlayer('Bartek');
    save([{ playerId: typo, name: 'Ana' }, { playerId: b, name: 'Bartek' }], [d('T20'), d('S1'), d('D20')]);
    db.mergePlayers(typo, a);
    expect(db.player(typo)).toBeNull();
    expect(new Stats(db).player(a, 'all')!.results).toMatchObject({ played: 1, won: 1 });
  });

  it('anonymizes without dropping matches', () => {
    const a = db.createPlayer('Anna'), b = db.createPlayer('Bartek');
    save([{ playerId: a, name: 'Anna' }, { playerId: b, name: 'Bartek' }], [d('T20'), d('S1'), d('D20')]);
    db.anonymizePlayer(a);
    expect(db.player(a)!.name).toBe('Deleted player');
    expect(new Stats(db).player(b, 'all')!.results.played).toBe(1);
  });
});

describe('history and stats', () => {
  it('stores no darts for guests and keeps their matches out of winrate', () => {
    const a = db.createPlayer('Anna');
    save([{ playerId: a, name: 'Anna' }, { playerId: null, name: 'Guest 1' }], [d('S1'), next, d('T20'), next, d('T20'), d('D20')]);
    const visits = db.sql.prepare('SELECT COUNT(*) AS n FROM visits').get() as { n: number };
    expect(visits.n).toBe(2);
    const s = new Stats(db).player(a, 'all')!;
    expect(s.x01.darts).toBe(5); // S1 plus two filled misses, then T20 D20
    expect(s.results.played).toBe(0);
  });

  it('counts saved unfinished matches for averages, not for results', () => {
    const a = db.createPlayer('Anna'), b = db.createPlayer('Bartek');
    save([{ playerId: a, name: 'Anna' }, { playerId: b, name: 'Bartek' }], [d('T20'), d('S1')], 'ended');
    const s = new Stats(db).player(a, 'all')!;
    expect(s.x01.avg).toBe(91.5);
    expect(s.x01.checkoutAttempts).toBe(0);
    expect(s.results.played).toBe(0);
    expect(s.recent[0].result).toBe('saved');
  });

  it('limits to the last N legs', () => {
    const a = db.createPlayer('Anna'), b = db.createPlayer('Bartek');
    for (let i = 0; i < 12; i++) save([{ playerId: a, name: 'Anna' }, { playerId: b, name: 'Bartek' }], [d('T20'), d('S1'), d('D20')]);
    const stats = new Stats(db);
    expect(stats.player(a, 'l10')!.x01.legs).toBe(10);
    expect(stats.player(a, 'all')!.x01.legs).toBe(12);
    expect(stats.h2h(a, b, 'all')).toMatchObject({ played: 12, wins: [12, 0] });
  });

  it('keeps the live match until it is saved', () => {
    const a = db.createPlayer('Anna');
    db.startLive({ key: 'k', game: 'x01', options: OPTS, roster: [{ playerId: a, name: 'Anna' }], startedAt: 1 });
    db.appendLive(d('T20'));
    db.appendLive({ t: 'undo' });
    expect(db.loadLive()!.events.map(e => e.t)).toEqual(['dart', 'undo']);
    db.clearLive();
    expect(db.loadLive()).toBeNull();
  });

  it('backs up and keeps the newest copies', () => {
    const out = join(dir, 'b');
    db.backup([out], 2);
    expect(readdirSync(out)).toHaveLength(1);
  });
});

describe('a player removed from the match', () => {
  // Anna, Bartek and Cezary; Cezary throws a 60 and leaves, Anna wins the leg.
  const three = () => [db.createPlayer('Anna'), db.createPlayer('Bartek'), db.createPlayer('Cezary')]
    .map((id, i) => ({ playerId: id, name: ['Anna', 'Bartek', 'Cezary'][i] }));
  const events: X01Event[] = [d('S1'), next, d('S1'), next, d('T20'), { t: 'remove', player: 2, scope: 'match' }, d('T20'), d('D20')];
  const saveRemoved = (roster: RosterEntry[]) => {
    const v = x01.view(events, 3, OPTS);
    return db.saveMatch({
      game: 'x01', options: OPTS, roster, startedAt: Date.now() - 1000, endedAt: Date.now(), status: 'finished',
      winners: [v.matchWinner!], sets: v.sets, legs: x01.compact(events, 3, OPTS), removed: v.removed.map(r => r === 'match'),
    });
  };

  it('keeps his darts in the averages but does not count the match as played, won or lost for him', () => {
    const roster = three();
    saveRemoved(roster);
    const stats = new Stats(db);
    const c = stats.player(roster[2].playerId, 'all')!;
    expect(c.x01.darts).toBe(1);
    expect(c.x01.avg).toBe(180);
    expect(c.results.played).toBe(0);
    expect(c.recent[0].result).toBe('left');
    expect(stats.list().map(p => [p.name, p.matches])).toEqual([['Anna', 1], ['Bartek', 1], ['Cezary', 0]]);
    expect(stats.h2h(roster[0].playerId, roster[2].playerId, 'all')!.played).toBe(0);
    expect(stats.h2h(roster[2].playerId, roster[0].playerId, 'all')!.played).toBe(0);
    const a = stats.player(roster[0].playerId, 'all')!;
    expect(a.results).toMatchObject({ played: 1, won: 1 });
    expect(a.opponents.map(o => o.name)).toEqual(['Bartek']);
  });

  it('leaves him out of the rematch', () => {
    saveRemoved(three());
    const last = db.lastMatchSetup()!;
    expect(rematchSetup(last.options as X01Options, last.roster, last.removed)[1].map(r => r.name)).toEqual(['Bartek', 'Anna']);
  });

  it('gives the rematch from the lobby the order the summary gives, also when the starter left', () => {
    const roster = three();
    db.saveMatch({
      game: 'x01', options: OPTS, roster, startedAt: Date.now() - 1000, endedAt: Date.now(), status: 'finished',
      winners: [1], sets: [0, 0, 0], legs: x01.compact(events, 3, OPTS), removed: [true, false, false],
    });
    const last = db.lastMatchSetup()!;
    const lobby = rematchSetup(last.options as X01Options, last.roster, last.removed)[1].map(r => r.name);
    const summary = rematchSetup(OPTS, roster, ['match', null, null])[1].map(r => r.name);
    expect(lobby).toEqual(summary);
    expect(lobby).toEqual(['Bartek', 'Cezary']);
  });
});

describe('Free throw stats', () => {
  const save = (roster: RosterEntry[], events: unknown[]) => {
    const o = freethrow.defaults;
    return db.saveMatch({
      game: 'freethrow', options: o, roster, startedAt: Date.now() - 1000, endedAt: Date.now(), status: 'finished',
      winners: [], sets: [], legs: freethrow.compact(events as never, 1, o), stats: freethrow.view(events as never, 1, o).stats,
    });
  };
  const dartsAt = (...s: string[]) => s.map(x => ({ t: 'dart', dart: parseDart(x)!, coords: { x: 0.1, y: 0.2 }, at: Date.now() }));

  it('adds up darts and points over matches but keeps the highest visit as a maximum', () => {
    const a = db.createPlayer('Anna');
    const r = [{ playerId: a, name: 'Anna' }];
    save(r, [...dartsAt('T20', 'T20', 'T20'), { t: 'next' }, ...dartsAt('S1', 'S1', 'S1')]);
    save(r, dartsAt('T20', 'S20', 'S20'));
    expect(new Stats(db).game(a, 'freethrow', 'all')).toMatchObject({ played: 2, won: 0, totals: { darts: 9, points: 283, visits: 3, best: 180, v100: 2 } });
  });

  it('shows the average of 3 darts as the player\'s value in the last match', () => {
    const a = db.createPlayer('Anna');
    save([{ playerId: a, name: 'Anna' }], [...dartsAt('T20', 'S5', 'S1'), { t: 'next' }]);
    expect(db.lastMatch()).toMatchObject({ game: 'freethrow', players: [{ name: 'Anna', value: '66.0', winner: false }] });
    save([{ playerId: null, name: 'Guest' }], [...dartsAt('T20', 'T20', 'T20'), { t: 'next' }, ...dartsAt('S1', 'S1')]);
    expect(db.lastMatch()!.players[0].value).toBe('109.2');
  });

  it('puts the darts into the heatmap of the game', () => {
    const a = db.createPlayer('Anna');
    save([{ playerId: a, name: 'Anna' }], dartsAt('T20', 'T20', 'T20'));
    const [h] = new Stats(db).heat([a], 'freethrow', 'all');
    expect(h.heat.darts).toHaveLength(3);
    expect(h.heat.visits).toBe(1);
  });
});

describe('minigames', () => {
  // A Next player after every third dart.
  const atcEvents = (...darts: string[]) => darts.flatMap((s, i) => [{ t: 'dart', dart: parseDart(s)!, at: Date.now() }, ...(i % 3 === 2 ? [{ t: 'next' }] : [])]);
  const saveAtc = (roster: RosterEntry[], events: unknown[]) => {
    const o = atc.normalizeOptions({});
    const v = atc.view(events as never, roster.length, o);
    return db.saveMatch({
      game: 'atc', options: o, roster, startedAt: Date.now() - 1000, endedAt: Date.now(), status: 'finished',
      winners: v.winners, sets: [], legs: atc.compact(events as never, roster.length, o),
      variant: atc.record!.variant(o, roster.length)!.key, scores: v.scores, stats: v.stats,
    });
  };
  // 1 → 4 → 7 → 10 → 13 → 16 → 19 → bull with trebles and skips: 8 darts.
  const fast = ['T1', 'T4', 'T7', 'T10', 'T13', 'T16', 'T19', 'Bull'];

  it('keeps records per variant, best first, and shows the result in the last match', () => {
    const a = db.createPlayer('Anna');
    saveAtc([{ playerId: a, name: 'Anna' }], atcEvents(...fast));
    saveAtc([{ playerId: a, name: 'Anna' }], atcEvents('Miss', ...fast));
    const rows = db.records('atc:any:skips', 'lower');
    expect(rows.map(r => r.value)).toEqual([8, 9]);
    expect(rows[0].who).toBe('Anna');
    expect(db.lastMatch()).toMatchObject({ game: 'atc', players: [{ name: 'Anna', value: '9 darts' }] });
    expect(new Stats(db).game(a, 'atc', 'all')).toMatchObject({ played: 2, totals: { darts: 17, hits: 16 } });
    expect(new Stats(db).records('atc')[0]).toMatchObject({ label: 'ATC · Any · Skips' });
  });

  it('counts a tie as a win for everyone tied', () => {
    const a = db.createPlayer('Anna'), b = db.createPlayer('Bob');
    // Both finish in 8 darts: Anna's three Turns, then Bob's.
    const turns = (p: string[]) => [p.slice(0, 3), p.slice(3, 6), p.slice(6)];
    const [a1, a2, a3] = turns(fast), [b1, b2, b3] = turns(fast);
    saveAtc([{ playerId: a, name: 'Anna' }, { playerId: b, name: 'Bob' }], atcEvents(...a1, ...b1, ...a2, ...b2, ...a3, 'Miss', ...b3));
    expect(db.lastMatch()!.players.map(p => p.winner)).toEqual([true, true]);
    expect(new Stats(db).game(b, 'atc', 'all')).toMatchObject({ played: 1, won: 1 });
    expect(new Stats(db).player(a, 'all')!.recent[0].result).toBe('won');
  });

  it('leaves a removed player out of the co-op record lineup and marks him in the last match', () => {
    const a = db.createPlayer('Anna'), b = db.createPlayer('Bob'), c = db.createPlayer('Cy');
    const roster = [{ playerId: a, name: 'Anna' }, { playerId: b, name: 'Bob' }, { playerId: c, name: 'Cy' }];
    db.saveMatch({
      game: '121', options: {}, roster, startedAt: 1, endedAt: 2, status: 'finished', winners: [0, 2], sets: [], legs: [],
      variant: '121:v3:refill:coop', scores: [140, null, 140], removed: [false, true, false],
    });
    expect(db.records('121:v3:refill:coop', 'higher')[0].who).toBe('Anna & Cy');
    expect(db.lastMatch()!.players.map(p => [p.name, p.left])).toEqual([['Anna', false], ['Bob', true], ['Cy', false]]);
  });

  it('does not count a minigame as played for a removed player, but keeps his totals', () => {
    const a = db.createPlayer('Anna'), b = db.createPlayer('Bob');
    const o = atc.normalizeOptions({});
    db.saveMatch({
      game: 'atc', options: o, roster: [{ playerId: a, name: 'Anna' }, { playerId: b, name: 'Bob' }], startedAt: 1, endedAt: 2, status: 'finished',
      winners: [0], sets: [], legs: [], stats: [{ darts: 9, hits: 3 }, { darts: 6, hits: 2 }], removed: [false, true],
    });
    expect(new Stats(db).game(b, 'atc', 'all')).toMatchObject({ played: 0, won: 0, totals: { darts: 6, hits: 2 } });
    expect(new Stats(db).game(a, 'atc', 'all')).toMatchObject({ played: 1, won: 1 });
  });

  it('does not count minigames in the X01 stats', () => {
    const a = db.createPlayer('Anna');
    saveAtc([{ playerId: a, name: 'Anna' }], atcEvents(...fast));
    expect(new Stats(db).player(a, 'all')!.x01.darts).toBe(0);
    expect(new Stats(db).list()[0].avg).toBeNull();
  });
});

describe('heat', () => {
  it('returns dart positions per player in a game, darts without one, and the distance walked', () => {
    const a = db.createPlayer('Anna'), b = db.createPlayer('Bartek');
    const at: X01Event = { t: 'dart', dart: parseDart('T20')!, coords: { x: 0, y: 0.6 }, at: Date.now() };
    save([{ playerId: a, name: 'Anna' }, { playerId: b, name: 'Bartek' }], [at, d('S1'), d('S20'), next, d('S5'), d('S5'), d('S5'), next, d('D10')]);
    const [ha, hb] = new Stats(db, undefined, 2.5).heat([a, b], 'x01', 'all');
    expect(ha.heat).toEqual({ darts: [[0, 0.6]], noPos: 3, visits: 2 });
    expect(ha.distance).toBe(10);
    expect(hb.heat.visits).toBe(1);
    expect(new Stats(db).heat([a], 'atc', 'all')[0].heat.visits).toBe(0);
  });
});
