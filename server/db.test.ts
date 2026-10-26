import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseDart } from '../games/darts.ts';
import type { X01Event, X01Options } from '../games/x01/index.ts';
import { atc } from '../games/race.ts';
import { x01 } from '../games/x01/index.ts';
import { Db } from './db.ts';
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
    winner: v.matchWinner, sets: v.sets, legs: x01.compact(events, roster.length, OPTS),
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

describe('minigames', () => {
  // A Next player after every third dart.
  const atcEvents = (...darts: string[]) => darts.flatMap((s, i) => [{ t: 'dart', dart: parseDart(s)!, at: Date.now() }, ...(i % 3 === 2 ? [{ t: 'next' }] : [])]);
  const saveAtc = (roster: RosterEntry[], events: unknown[]) => {
    const o = atc.normalizeOptions({});
    const v = atc.view(events as never, roster.length, o);
    return db.saveMatch({
      game: 'atc', options: o, roster, startedAt: Date.now() - 1000, endedAt: Date.now(), status: 'finished',
      winner: v.winners.length === 1 ? v.winners[0] : null, sets: [], legs: atc.compact(events as never, roster.length, o),
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

  it('does not count minigames in the X01 stats', () => {
    const a = db.createPlayer('Anna');
    saveAtc([{ playerId: a, name: 'Anna' }], atcEvents(...fast));
    expect(new Stats(db).player(a, 'all')!.x01.darts).toBe(0);
    expect(new Stats(db).list()[0].avg).toBeNull();
  });
});
