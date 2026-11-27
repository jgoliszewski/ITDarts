// The hub's remove command (docs/UI.md#wycofanie-gracza): who may send it, when the server refuses it, and that it stays silent.
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDart } from '../games/darts.ts';
import { GAMES } from '../games/index.ts';
import { atc } from '../games/race.ts';
import { hint } from '../games/x01/checkout.ts';
import type { Board } from './board.ts';
import type { Config } from './config.ts';
import { Db } from './db.ts';
import type { Effects } from './effects/index.ts';
import { EffectsStore } from './effects/store.ts';
import { Hub } from './hub.ts';
import type { Command, LiveMatch, RecordInfo, RosterEntry, ServerMessage } from './protocol.ts';

let dir: string;
let db: Db;
let hub: Hub;
let fire: ReturnType<typeof vi.fn>;
let board: EventEmitter;

/** A browser on the socket: sends commands and waits for their results. */
function client(isLocal: boolean) {
  const ws = Object.assign(new EventEmitter(), { OPEN: 1, readyState: 1, send: (s: string) => ws.emit('out', JSON.parse(s)) });
  hub.connect(ws as never, isLocal);
  let id = 0;
  ws.emit('message', JSON.stringify({ type: 'hello', clientId: isLocal ? 'laptop' : 'phone', deviceName: 'test' }));
  return (cmd: Command) => new Promise<Extract<ServerMessage, { type: 'result' }>>(resolve => {
    const mine = ++id;
    const on = (m: ServerMessage) => {
      if (m.type === 'result' && m.id === mine) {
        ws.off('out', on);
        resolve(m);
      }
    };
    ws.on('out', on);
    ws.emit('message', JSON.stringify({ type: 'cmd', id: mine, cmd }));
  });
}

const roster = (n: number) => ['Ann', 'Bob', 'Cy', 'Dee'].slice(0, n).map(name => ({ playerId: null, name }));
const dart = (s: string): Command => ({ type: 'dart', dart: parseDart(s)! });
const remove = (player: number): Command => ({ type: 'remove', player, scope: 'match' });

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'itdarts-hub-'));
  db = new Db(dir);
  board = Object.assign(new EventEmitter(), {
    status: { connected: true, takeout: { active: false, since: null } },
    prepare: async () => undefined, action: async () => undefined, takeoutDone: async () => undefined,
  });
  fire = vi.fn();
  const effects = { fire, setBase: () => undefined, applyBase: () => undefined, store: { settings: () => ({}), rev: 0 } };
  hub = new Hub(db, board as unknown as Board, { dataDir: dir, extraBackupDir: null, ocheMeters: 2.37, port: 0 } as Config, effects as unknown as Effects, () => undefined, () => undefined);
});

afterEach(() => {
  hub.close();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('closing the hub', () => {
  it('stops the record intro timer, so it does not broadcast after the database closes', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const pilot = client(true);
      await pilot({ type: 'startMatch', game: 'atc', options: { bullOff: 'off' }, roster: roster(2) });
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      hub.close();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the throwing order with a bull-off (docs/UI.md#bull-off-z-tarczy)', () => {
  const order = () => db.loadLive()!.roster.map(r => r.name);
  afterEach(() => vi.restoreAllMocks());

  it('is drawn when a bull-off is on', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // the draw turns Ann, Bob, Cy into Bob, Cy, Ann
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'atc', options: { bullOff: 'closest' }, roster: roster(3) });
    expect(order()).toEqual(['Bob', 'Cy', 'Ann']);
  });

  it('is drawn for the PDC bull-off too', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await client(true)({ type: 'startMatch', game: 'atc', options: { bullOff: 'pdc' }, roster: roster(3) });
    expect(order()).toEqual(['Bob', 'Cy', 'Ann']);
  });

  it('stays as in the lobby without a bull-off', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await client(true)({ type: 'startMatch', game: 'atc', options: { bullOff: 'off' }, roster: roster(3) });
    expect(order()).toEqual(['Ann', 'Bob', 'Cy']);
  });

  it('is a plain permutation of the lobby players', async () => {
    await client(true)({ type: 'startMatch', game: 'atc', options: { bullOff: 'closest' }, roster: roster(4) });
    expect(order().sort()).toEqual(['Ann', 'Bob', 'Cy', 'Dee']);
  });

  it('is drawn again for a rematch', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'atc', options: { bullOff: 'closest' }, roster: roster(3) });
    expect(order()).toEqual(['Bob', 'Cy', 'Ann']);
    random.mockReturnValue(0.99); // the next draw leaves the order as it is
    await pilot({ type: 'closeMatch', then: 'rematch' });
    expect(order()).toEqual(['Bob', 'Cy', 'Ann']);
    random.mockReturnValue(0);
    await pilot({ type: 'closeMatch', then: 'rematch' });
    expect(order()).toEqual(['Cy', 'Ann', 'Bob']);
  });
});

describe('the remove command', () => {
  it('is refused from a device that is not the Pilot', async () => {
    const pilot = client(true), phone = client(false);
    await pilot({ type: 'startMatch', game: 'atc', options: { bullOff: 'off' }, roster: roster(3) });
    const r = await phone(remove(1));
    expect(r).toMatchObject({ ok: false, error: 'Take control first' });
  });

  it('is refused during the bull-off', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'atc', options: { bullOff: 'closest' }, roster: roster(3) });
    expect(await pilot(remove(1))).toMatchObject({ ok: false, error: 'Not during the bull-off' });
  });

  it('is refused when fewer than two would be left, and goes through otherwise', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'atc', options: { bullOff: 'off' }, roster: roster(3) });
    expect(await pilot(remove(1))).toMatchObject({ ok: true });
    expect(await pilot(remove(2))).toMatchObject({ ok: false, error: 'Fewer than two players would be left: use End match' });
  });

  it('fires no effect, even when it ends the game', async () => {
    // Higher or Lower: Ann goes above the range, Bob below, Cy fails; Ann leaves and Bob wins.
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'hol', options: { bullOff: 'off', firstTo: 1 }, roster: roster(3) });
    const next: Command = { type: 'next' };
    for (const c of [dart('T20'), dart('S1'), dart('S1'), next, dart('S1'), dart('S1'), dart('S1'), next, next]) await pilot(c);
    fire.mockClear();
    expect(await pilot(remove(0))).toMatchObject({ ok: true });
    expect(fire).toHaveBeenCalled();
    expect(fire.mock.calls.flatMap(c => c[0])).toEqual([]);
  });
});

describe('a dart from the board', () => {
  it('cannot take the server down when the match view fails to compute; the error is logged', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'atc', options: { bullOff: 'off' }, roster: roster(2) });
    const failing = vi.spyOn(GAMES.atc, 'view').mockImplementationOnce(() => {
      throw new Error('view failed');
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => board.emit('throw', parseDart('S1'), undefined)).not.toThrow();
    expect(logged).toHaveBeenCalled();
    failing.mockRestore();
    logged.mockRestore();
    // The dart that failed is not in the log; the next one goes in.
    expect(db.loadLive()!.events.filter(e => e.t === 'dart')).toHaveLength(0);
    board.emit('throw', parseDart('S2'), undefined);
    expect(db.loadLive()!.events.filter(e => e.t === 'dart')).toHaveLength(1);
  });

  it('keeps the dart out of the log, the view and the effects when its effects fail to compute', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'atc', options: { bullOff: 'off' }, roster: roster(2) });
    const failing = vi.spyOn(GAMES.atc, 'happenings').mockImplementationOnce(() => {
      throw new Error('happenings failed');
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fire.mockClear();
    board.emit('throw', parseDart('S1'), undefined);
    failing.mockRestore();
    logged.mockRestore();
    expect(db.loadLive()!.events.filter(e => e.t === 'dart')).toHaveLength(0);
    expect(fire).not.toHaveBeenCalled();
    // The next dart goes in as usual.
    board.emit('throw', parseDart('S2'), undefined);
    expect(db.loadLive()!.events.filter(e => e.t === 'dart')).toHaveLength(1);
  });
});

describe('the boardRotated command', () => {
  /** The latest state a device got. */
  function stateOf(isLocal: boolean) {
    const ws = Object.assign(new EventEmitter(), { OPEN: 1, readyState: 1, send: (s: string) => ws.emit('out', JSON.parse(s)) });
    let last: Extract<ServerMessage, { type: 'state' }>['state'] | undefined;
    ws.on('out', (m: ServerMessage) => m.type === 'state' && (last = m.state));
    hub.connect(ws as never, isLocal);
    ws.emit('message', JSON.stringify({ type: 'hello', clientId: isLocal ? 'laptop' : 'phone', deviceName: 'test' }));
    return () => last!;
  }

  it('stores the date and clears the flag', async () => {
    const pilot = client(true);
    const state = stateOf(true);
    expect(state().rotateBoardDue).toBe(true);
    expect(await pilot({ type: 'boardRotated' })).toMatchObject({ ok: true });
    expect(Date.now() - Date.parse(db.boardRotatedAt()!)).toBeLessThan(5000);
    await new Promise(r => setImmediate(r)); // the state goes out right after the result
    expect(state().rotateBoardDue).toBe(false);
  });

  it('is refused from a device that is not the Pilot', async () => {
    client(true);
    const phone = client(false);
    expect(await phone({ type: 'boardRotated' })).toMatchObject({ ok: false, error: 'Take control first' });
    expect(db.boardRotatedAt()).toBeNull();
  });
});

describe('a live match from before an update', () => {
  it('loads Higher or Lower options saved without lives with 3 lives, and a failed visit costs one', () => {
    const at = 1;
    db.startLive({ key: 'k', game: 'hol', options: { firstTo: 1, bullOff: 'off' } as never, roster: roster(2), startedAt: at });
    for (const s of ['S10', 'S10', 'S10']) db.appendLive({ t: 'dart', dart: parseDart(s)!, at });
    db.appendLive({ t: 'next', at });
    expect(db.loadLive()!.options).toEqual({ firstTo: 1, lives: 3, bullOff: 'off' });
    const resumed = new Hub(db, board as unknown as Board, { dataDir: dir, extraBackupDir: null, ocheMeters: 2.37, port: 0 } as Config,
      { fire, setBase: () => undefined, applyBase: () => undefined, store: { settings: () => ({}), rev: 0 } } as unknown as Effects, () => undefined, () => undefined);
    const view = (resumed as unknown as { live: { view: { lives: number[]; phase: string } } }).live.view;
    expect(view.lives).toEqual([2, 3]);
    expect(view.phase).toBe('throwing');
  });
});

describe('saving a Bullseye match', () => {
  it('ends the game as won on End match with Save, with the win screen first', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'bullseye', options: { firstTo: 5, bullOff: 'off' }, roster: roster(2) });
    await pilot(dart('Bull'));
    await pilot({ type: 'endMatch', save: true });
    const live = (hub as unknown as { live: { view: { phase: string; winners: number[] } } | null }).live;
    expect(live?.view.phase).toBe('matchWon');
    expect(live?.view.winners).toEqual([0]);
  });
});

describe('Free throw', () => {
  it('refuses a start with 2 players', async () => {
    const pilot = client(true);
    const r = await pilot({ type: 'startMatch', game: 'freethrow', options: { visits: 0 }, roster: roster(2) });
    expect(r).toMatchObject({ ok: false, error: 'Free throw is for 1 player' });
    expect((hub as unknown as { live: unknown }).live).toBeNull();
  });

  it('ends on End match with Save with the end screen and no winner', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'freethrow', options: { visits: 0 }, roster: roster(1) });
    await pilot(dart('T20'));
    await pilot({ type: 'endMatch', save: true });
    const live = (hub as unknown as { live: { view: { phase: string; winners: number[] } } | null }).live;
    expect(live?.view.phase).toBe('matchWon');
    expect(live?.view.winners).toEqual([]);
    // Closing the end screen saves a finished match nobody won.
    await pilot({ type: 'closeMatch', then: 'summary' });
    expect(db.sql.prepare('SELECT game, status FROM matches').all()).toEqual([{ game: 'freethrow', status: 'finished' }]);
    expect(db.sql.prepare('SELECT won FROM match_players').all()).toEqual([{ won: 0 }]);
    expect(db.lastMatch()).toMatchObject({ status: 'finished', players: [{ winner: false }] });
  });
});

describe('Hare and Hounds', () => {
  type L = { rec: { roster: RosterEntry[]; options: { bullOff: string } }; view: { phase: string; winners: number[]; hare: number; result: string } } | null;
  const live = () => (hub as unknown as { live: L }).live;
  const names = () => live()!.rec.roster.map(r => r.name);
  const start = (n: number, bullOff = 'off') => client(true)({ type: 'startMatch', game: 'hare', options: { bullOff }, roster: roster(n) });
  afterEach(() => vi.restoreAllMocks());

  it('is for exactly 2 players', async () => {
    expect(await start(1)).toMatchObject({ ok: false, error: 'Hare and Hounds is for 2 players' });
    expect(await start(3)).toMatchObject({ ok: false, error: 'Hare and Hounds is for 2 players' });
    expect(live()).toBeNull();
    expect(await start(2)).toMatchObject({ ok: true });
  });

  it('ends on End match with Save with the end screen and no winner', async () => {
    const pilot = client(true);
    await start(2);
    await pilot(dart('S1'));
    await pilot({ type: 'endMatch', save: true });
    expect(live()?.view).toMatchObject({ phase: 'matchWon', winners: [], result: 'No winner' });
    await pilot({ type: 'closeMatch', then: 'summary' });
    expect(db.sql.prepare('SELECT game, status FROM matches').all()).toEqual([{ game: 'hare', status: 'finished' }]);
    expect(db.sql.prepare('SELECT won FROM match_players').all()).toEqual([{ won: 0 }, { won: 0 }]);
  });

  it('keeps the caller silent', async () => {
    const pilot = client(true);
    await start(2);
    for (const x of ['S1', 'S18', 'S4']) await pilot(dart(x));
    await pilot({ type: 'next' });
    expect(fire.mock.calls.flatMap(c => c[1] ?? [])).toEqual([]);
  });

  it('swaps the roles in a rematch: the hound throws first as the hare', async () => {
    const pilot = client(true);
    await start(2);
    expect([names(), live()!.view.hare]).toEqual([['Ann', 'Bob'], 0]);
    await pilot({ type: 'endMatch', save: true });
    await pilot({ type: 'closeMatch', then: 'rematch' });
    expect([names(), live()!.view.hare]).toEqual([['Bob', 'Ann'], 0]);
    await pilot({ type: 'endMatch', save: true });
    await pilot({ type: 'closeMatch', then: 'rematch' });
    expect(names()).toEqual(['Ann', 'Bob']);
  });

  it('swaps the roles won in the bull-off, and plays the rematch without one', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // the draw turns Ann, Bob into Bob, Ann
    const pilot = client(true);
    await start(2, 'closest');
    expect(names()).toEqual(['Bob', 'Ann']);
    // Bob throws first in the bull-off and misses it; Ann is closest, so she is the hare.
    await pilot({ type: 'dart', dart: parseDart('S20')!, coords: { x: 0, y: 0.6 } });
    await pilot({ type: 'dart', dart: parseDart('Bull')!, coords: { x: 0, y: 0.01 } });
    await pilot({ type: 'bullOff', starter: 1 });
    expect(live()!.view).toMatchObject({ phase: 'throwing', hare: 1 });
    await pilot({ type: 'endMatch', save: true });
    await pilot({ type: 'closeMatch', then: 'rematch' });
    expect([names(), live()!.view.hare, live()!.rec.options.bullOff]).toEqual([['Bob', 'Ann'], 0, 'off']);
  });

  it('swaps the roles in the lobby Rematch, from the stored match', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'hare', options: { bullOff: 'off' }, roster: [roster(2)[1], roster(2)[0]] });
    await pilot(dart('S1'));
    await pilot({ type: 'endMatch', save: true });
    await pilot({ type: 'closeMatch', then: 'summary' });
    await pilot({ type: 'closeSummary' });
    expect(db.lastMatchSetup()).toMatchObject({ starter: 0 });
    await pilot({ type: 'rematch' });
    expect([names(), live()!.view.hare]).toEqual([['Ann', 'Bob'], 0]);
  });
});

describe('Catch 40', () => {
  type L = { view: { phase: string; winners: number[]; points: number[] } } | null;
  const live = () => (hub as unknown as { live: L }).live;
  const next: Command = { type: 'next' };

  it('has the caller of 121: game on, you require, the visit total', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'catch40', options: {}, roster: roster(1) });
    for (const x of ['S20', 'S5', 'S1']) await pilot(dart(x));
    await pilot(next);
    expect(fire.mock.calls.flatMap(c => c[1] ?? [])).toEqual(['gameon', 'require_61', '26', 'require_35']);
  });

  it('ends on End match with Save: the most points win', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'catch40', options: {}, roster: roster(2) });
    for (const x of ['T11', 'D14']) await pilot(dart(x));
    await pilot(next);
    await pilot(dart('S1'));
    await pilot({ type: 'endMatch', save: true });
    expect(live()?.view).toMatchObject({ phase: 'matchWon', winners: [0], points: [3, 0] });
  });

  it('keeps a record only from a game played through all 40 targets', async () => {
    const ann = { playerId: db.createPlayer('Ann'), name: 'Ann' };
    const score = () => db.sql.prepare('SELECT mp.score, m.variant FROM match_players mp JOIN matches m ON m.id = mp.match_id ORDER BY m.id DESC LIMIT 1').get();
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'catch40', options: {}, roster: [ann] });
    for (const x of ['T11', 'D14']) await pilot(dart(x));
    await pilot({ type: 'endMatch', save: true });
    await pilot({ type: 'closeMatch', then: 'lobby' });
    expect(score()).toMatchObject({ score: null });
    expect(db.records('catch40', 'higher')).toEqual([]);
    // The full game: every target from 61 to 100 checked out in one visit.
    await pilot({ type: 'startMatch', game: 'catch40', options: {}, roster: [ann] });
    await pilot({ type: 'skipIntro' });
    for (let n = 61; n <= 100; n++) {
      for (const x of hint(n, 3, 'double')!.darts) await pilot({ type: 'dart', dart: x });
      if (n < 100) await pilot(next);
    }
    const points = live()!.view.points[0];
    expect(live()?.view.phase).toBe('matchWon');
    expect(points).toBeGreaterThanOrEqual(80);
    await pilot({ type: 'closeMatch', then: 'lobby' });
    expect(score()).toMatchObject({ score: points, variant: 'catch40' });
    expect(db.records('catch40', 'higher').map(r => r.value)).toEqual([points]);
  });
});

describe("Bob's 27", () => {
  type L = { view: { phase: string; winners: number[]; points: number[]; scores: (number | null)[] } } | null;
  const live = () => (hub as unknown as { live: L }).live;
  const next: Command = { type: 'next' };
  const facts = () => fire.mock.calls.flatMap(c => c[0] as { fact: { kind: string; event?: string } }[]).map(c => c.fact);

  it('fires Hit and Miss for every dart, Player eliminated at the end of a missed visit and the caller stays silent', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'bobs27', options: {}, roster: roster(1) });
    await pilot(dart('D1'));
    await pilot(dart('S1'));
    expect(facts().map(f => f.kind)).toContain('hit');
    expect(facts().map(f => f.kind)).toContain('miss');
    await pilot(next);
    // D1 hit (+2), then D2 to D4 missed: 27 + 2 - 4 - 6 - 8 = 11. D5 costs 10 and leaves 1, D6 costs 12 and puts Ann out.
    for (let i = 0; i < 4; i++) {
      for (const x of ['M', 'M', 'M']) await pilot(dart(x));
      await pilot(next);
    }
    expect(facts().some(f => f.kind === 'game' && f.event === 'eliminated')).toBe(false);
    for (const x of ['M', 'M', 'M']) await pilot(dart(x));
    expect(facts().some(f => f.kind === 'game' && f.event === 'eliminated')).toBe(true);
    expect(live()?.view).toMatchObject({ phase: 'matchWon', winners: [] });
    expect(fire.mock.calls.flatMap(c => c[1] ?? [])).toEqual([]);
  });

  it('ends on End match with Save: the best score of those still in wins', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'bobs27', options: {}, roster: roster(2) });
    await pilot(dart('D1'));
    await pilot(next);
    await pilot(dart('S1'));
    await pilot({ type: 'endMatch', save: true });
    expect(live()?.view).toMatchObject({ phase: 'matchWon', winners: [0], points: [29, 27] });
  });

  it('keeps a record only from a game played through the bull round', async () => {
    const ann = { playerId: db.createPlayer('Ann'), name: 'Ann' };
    const score = () => db.sql.prepare('SELECT mp.score, m.variant FROM match_players mp JOIN matches m ON m.id = mp.match_id ORDER BY m.id DESC LIMIT 1').get();
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'bobs27', options: {}, roster: [ann] });
    await pilot(dart('D1'));
    await pilot({ type: 'endMatch', save: true });
    await pilot({ type: 'closeMatch', then: 'lobby' });
    expect(score()).toMatchObject({ score: null });
    expect(db.records('bobs27', 'higher')).toEqual([]);
    // The full game, one hit in every round: 27 + 2 * (1 + ... + 20) + 50.
    await pilot({ type: 'startMatch', game: 'bobs27', options: {}, roster: [ann] });
    await pilot({ type: 'skipIntro' });
    for (let r = 1; r <= 21; r++) {
      await pilot(dart(r === 21 ? 'Bull' : `D${r}`));
      await pilot(next);
    }
    expect(live()?.view).toMatchObject({ phase: 'matchWon', winners: [0], points: [497] });
    await pilot({ type: 'closeMatch', then: 'lobby' });
    expect(score()).toMatchObject({ score: 497, variant: 'bobs27' });
    expect(db.records('bobs27', 'higher').map(r => r.value)).toEqual([497]);
  });

  it('keeps no record from a solo game that went out', async () => {
    const ann = { playerId: db.createPlayer('Ann'), name: 'Ann' };
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'bobs27', options: {}, roster: [ann] });
    await pilot({ type: 'skipIntro' });
    for (let i = 0; i < 5; i++) {
      for (const x of ['M', 'M', 'M']) await pilot(dart(x));
      if (i < 4) await pilot(next);
    }
    expect(live()?.view).toMatchObject({ phase: 'matchWon', winners: [], scores: [null] });
    await pilot({ type: 'closeMatch', then: 'lobby' });
    expect(db.records('bobs27', 'higher')).toEqual([]);
  });

  it('does not let a player who went out count towards the two that must remain', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'bobs27', options: {}, roster: roster(3) });
    // Ann misses every round until she is out; Bob and Cy hit D1 to D5.
    for (let r = 1; r <= 5; r++) {
      for (const x of ['M', 'M', 'M']) await pilot(dart(x));
      await pilot(next);
      for (let who = 1; who <= 2; who++) {
        await pilot(dart(`D${r}`));
        await pilot(next);
      }
    }
    expect((await pilot(remove(1))).ok).toBe(false);
  });
});

describe('saving a Gotcha match', () => {
  // Bull + T17 = 101: the starter wins the game; the starter of the next game is the other player.
  const win = [dart('Bull'), dart('T17')];
  const next: Command = { type: 'next' };
  const legsWon = () => (db.sql.prepare('SELECT legs_won FROM match_players ORDER BY position').all() as { legs_won: number }[]).map(r => r.legs_won);

  it('stores the games won as legs_won and shows them as the score when First to is above 1', async () => {
    const pilot = client(true);
    const players = [db.createPlayer('Ann'), db.createPlayer('Bob')];
    await pilot({ type: 'startMatch', game: 'gotcha', options: { target: 101, firstTo: 3, bullOff: 'off' }, roster: players.map((playerId, i) => ({ playerId, name: ['Ann', 'Bob'][i] })) });
    // The starter wins every game and the starter alternates: Ann, Bob, Ann, Bob, Ann = 3-2.
    for (let i = 0; i < 5; i++) {
      for (const x of win) await pilot(x);
      if (i < 4) await pilot(next);
    }
    await pilot({ type: 'endMatch', save: true });
    expect(legsWon()).toEqual([3, 2]);
    expect(db.lastMatch()!.players.map(p => p.value)).toEqual(['3', '2']);
  });

  it('keeps Won for First to 1', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'gotcha', options: { target: 101, firstTo: 1, bullOff: 'off' }, roster: roster(2) });
    for (const x of win) await pilot(x);
    await pilot({ type: 'endMatch', save: true });
    expect(legsWon()).toEqual([1, 0]);
    expect(db.lastMatch()!.players.map(p => p.value)).toEqual(['Won', '']);
  });
});

describe('Cricket Random', () => {
  const events = () => db.loadLive()!.events;
  const o = { mode: 'standard', bullOff: 'off' };

  it('logs a seed at the start with Random sectors, and not with classic', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'cricket', options: { ...o, sectors: 'random' }, roster: roster(2) });
    expect(events().filter(e => e.t === 'seed')).toHaveLength(1);
    await pilot({ type: 'endMatch', save: false });
    await pilot({ type: 'closeMatch', then: 'lobby' });
    await pilot({ type: 'startMatch', game: 'cricket', options: { ...o, sectors: 'classic' }, roster: roster(2) });
    expect(events().filter(e => e.t === 'seed')).toHaveLength(0);
  });
});

describe('Football', () => {
  const events = () => db.loadLive()!.events;
  const o = { kickOff: 'any', goals: 5, bullOff: 'off' };

  it('logs a seed at the start with Goals on Big singles, and not with Doubles', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'football', options: { ...o, goalsOn: 'singles' }, roster: roster(2) });
    expect(events().filter(e => e.t === 'seed')).toHaveLength(1);
    await pilot({ type: 'endMatch', save: false });
    await pilot({ type: 'closeMatch', then: 'lobby' });
    await pilot({ type: 'startMatch', game: 'football', options: { ...o, goalsOn: 'doubles' }, roster: roster(2) });
    expect(events().filter(e => e.t === 'seed')).toHaveLength(0);
  });

  it('starts an old setup without Goals on as Doubles, with no seed', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'football', options: o, roster: roster(2) });
    expect(db.loadLive()!.options).toMatchObject({ goalsOn: 'doubles' });
    expect(events().filter(e => e.t === 'seed')).toHaveLength(0);
  });

  it('draws a new seed for a rematch in Big singles', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'football', options: { ...o, goalsOn: 'singles' }, roster: roster(2) });
    const first = events().find(e => e.t === 'seed') as { seed: number };
    await pilot({ type: 'endMatch', save: true });
    await pilot({ type: 'closeMatch', then: 'rematch' });
    const live = db.loadLive()!;
    expect(live.options).toMatchObject({ goalsOn: 'singles' });
    const seeds = live.events.filter(e => e.t === 'seed') as { seed: number }[];
    expect(seeds).toHaveLength(1);
    expect(seeds[0].seed).not.toBe(first.seed);
  });

  it('takes a fix with the place that was tapped, and refuses coords that are not numbers', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'football', options: { ...o, goalsOn: 'singles' }, roster: roster(2) });
    await pilot(dart('S20'));
    expect(await pilot({ type: 'fix', index: 0, dart: parseDart('S20')!, coords: { x: 0, y: 0.8 } })).toMatchObject({ ok: true });
    expect(events().at(-1)).toMatchObject({ t: 'fix', index: 0, coords: { x: 0, y: 0.8 } });
    const bad = await pilot({ type: 'fix', index: 0, dart: parseDart('S20')!, coords: { x: 'a', y: 1 } } as never);
    expect(bad).toMatchObject({ ok: false, error: 'Invalid input' });
    expect(events().filter(e => e.t === 'fix')).toHaveLength(1);
    // Without coords the fix is as before.
    expect(await pilot({ type: 'fix', index: 0, dart: parseDart('S20')! })).toMatchObject({ ok: true });
    expect(events().at(-1)).not.toHaveProperty('coords');
  });
});

describe('coords from the Pilot', () => {
  const events = () => db.loadLive()!.events;
  const bad = [{ x: 'a', y: 1 }, { x: Infinity, y: 0 }, { x: 1e999, y: 0 }, 'x', { x: 1 }];

  it('keeps coords that are not finite numbers out of the X01 log, for a fix and for a dart', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'x01', options: {}, roster: roster(2) });
    await pilot(dart('S20'));
    for (const coords of bad) {
      expect(await pilot({ type: 'fix', index: 0, dart: parseDart('S5')!, coords } as never)).toMatchObject({ ok: false });
      expect(await pilot({ type: 'dart', dart: parseDart('S5')!, coords } as never)).toMatchObject({ ok: false });
    }
    expect(events().filter(e => e.t === 'fix')).toHaveLength(0);
    expect(events().filter(e => e.t === 'dart')).toHaveLength(1);
  });

  it('logs the coords of an added dart, and the dart is as Board Manager gave it without them', async () => {
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'bullseye', options: { firstTo: 5, bullOff: 'off' }, roster: roster(2) });
    expect(await pilot({ type: 'dart', dart: parseDart('S20')!, coords: { x: 0, y: 0.8 } })).toMatchObject({ ok: true });
    expect(events().at(-1)).toMatchObject({ t: 'dart', coords: { x: 0, y: 0.8 } });
    expect((hub as unknown as { live: { view: { points: number[] } } }).live.view.points).toEqual([-1, 0]);
    await pilot(dart('S20'));
    expect(events().at(-1)).not.toHaveProperty('coords');
  });
});

// Master volume and Mute (ui-overhaul DECISIONS.md): a Pilot setting of this laptop, kept in SQLite like Sounds.
describe('master volume and mute', () => {
  function withStore() {
    const store = new EffectsStore(db, join(dir, 'effects'), dir, []);
    const effects = { fire, setBase: () => undefined, applyBase: () => undefined, store };
    hub = new Hub(db, board as unknown as Board, { dataDir: dir, extraBackupDir: null, ocheMeters: 2.37, port: 0 } as Config, effects as unknown as Effects, () => undefined, () => undefined);
    const ws = Object.assign(new EventEmitter(), { OPEN: 1, readyState: 1, send: (s: string) => ws.emit('out', JSON.parse(s)) });
    let last: Extract<ServerMessage, { type: 'state' }>['state'] | undefined;
    const out: ServerMessage[] = [];
    ws.on('out', (m: ServerMessage) => (out.push(m), m.type === 'state' && (last = m.state)));
    hub.connect(ws as never, true);
    ws.emit('message', JSON.stringify({ type: 'hello', clientId: 'kiosk', deviceName: 'test' }));
    return { store, out, state: () => last! };
  }

  it('starts at 100 % and not muted', () => {
    const { state } = withStore();
    expect(state().effects).toMatchObject({ master: 100, muted: false });
  });

  it('saves the level and Mute from the Pilot without touching Sounds and Caller, and keeps them after a restart', async () => {
    const { state } = withStore();
    const pilot = client(true);
    expect(await pilot({ type: 'effects', master: 35 })).toMatchObject({ ok: true });
    expect(await pilot({ type: 'effects', muted: true })).toMatchObject({ ok: true });
    await new Promise(r => setImmediate(r));
    expect(state().effects).toMatchObject({ master: 35, muted: true, sounds: true, caller: true });
    // Unmute brings the level back.
    await pilot({ type: 'effects', muted: false });
    await new Promise(r => setImmediate(r));
    expect(state().effects).toMatchObject({ master: 35, muted: false });
    await pilot({ type: 'effects', muted: true });
    const again = new EffectsStore(db, join(dir, 'effects'), dir, []);
    expect(again.settings()).toMatchObject({ master: 35, muted: true });
  });

  it('plays a Next player preview on the kiosk at the new level, after the state that carries it (CARRY 04b)', async () => {
    const { out, store } = withStore();
    store.updateSettings({ volume: 80 });
    const pilot = client(false);
    await pilot({ type: 'takeControl' });
    out.length = 0;
    expect(await pilot({ type: 'effects', master: 40 })).toMatchObject({ ok: true });
    await new Promise(r => setImmediate(r));
    const fx = out.findIndex(m => m.type === 'fx');
    const level = out.findIndex(m => m.type === 'state' && m.state.effects.master === 40);
    expect(fx).toBeGreaterThan(level);
    expect(level).toBeGreaterThanOrEqual(0);
    // The real Next player sound: the effects volume times its own (75 %).
    expect(out[fx]).toEqual({ type: 'fx', fx: { sound: { url: 'builtin:turn', gain: 0.8 * 0.75 }, anim: null, caller: null } });
  });

  it('plays no preview while muted or with Sounds off, nor for Mute or the switches', async () => {
    const { out } = withStore();
    const pilot = client(true);
    for (const cmd of [{ muted: true }, { master: 30 }, { muted: false }, { sounds: false }, { master: 40 }] as const) await pilot({ type: 'effects', ...cmd });
    await new Promise(r => setImmediate(r));
    expect(out.filter(m => m.type === 'fx')).toEqual([]);
  });

  it('refuses a level out of 0–100 and a device that is not the Pilot', async () => {
    const { store } = withStore();
    const pilot = client(true), phone = client(false);
    expect(await pilot({ type: 'effects', master: 140 })).toMatchObject({ ok: false });
    expect(await phone({ type: 'effects', master: 10 })).toMatchObject({ ok: false, error: 'Take control first' });
    expect(store.settings().master).toBe(100);
  });
});

describe('records during the game (docs/GRY.md#rekordy-i-ekran-rekordu)', () => {
  type L = { record: RecordInfo | null; newRecord: LiveMatch['newRecord'] };
  const live = () => (hub as unknown as { live: L }).live;
  const next: Command = { type: 'next' };
  const ATC = atc.normalizeOptions({});
  /** A saved ATC match (Any, Skips) with these scores; `coop` saves it as a co-op lineup. */
  const saved = (roster: RosterEntry[], scores: (number | null)[], coop = false, endedAt = 2) => db.saveMatch({
    game: 'atc', options: ATC, roster, startedAt: 1, endedAt, status: 'finished', winners: [], sets: [], legs: [],
    variant: coop ? 'atc:any:skips:coop' : 'atc:any:skips', scores,
  });
  const players = (...names: string[]) => names.map(name => ({ playerId: db.createPlayer(name), name }));
  // 1 → 4 → … → 19 → bull with trebles and skips: 8 darts.
  const fast = ['T1', 'T4', 'T7', 'T10', 'T13', 'T16', 'T19', 'Bull'];

  it('gives the office record, every player’s PB with its place, and none for a guest', async () => {
    const [ann, bob, cy] = players('Ann', 'Bob', 'Cy');
    saved([ann], [8]);
    saved([bob], [9]);
    saved([ann], [12]);
    await client(true)({ type: 'startMatch', game: 'atc', options: ATC, roster: [ann, bob, cy, { playerId: null, name: 'Guest' }] });
    const r = live().record!;
    expect(r).toMatchObject({ value: '8 darts', raw: 8, by: 'Ann', better: 'lower', coop: false, team: null });
    expect(r.personal.map(p => p && [p.raw, p.place])).toEqual([[8, 1], [9, 2], null, null]);
    // One result per player: Ann's 12 is not in the top.
    expect(r.top.map(t => [t.place, t.by, t.raw])).toEqual([[1, 'Ann', 8], [2, 'Bob', 9]]);
  });

  it('keeps the top at 5 and gives the place of a player below it', async () => {
    const ps = players('A', 'B', 'C', 'D', 'E', 'F', 'G');
    ps.forEach((p, i) => saved([p], [10 + i]));
    await client(true)({ type: 'startMatch', game: 'atc', options: ATC, roster: [ps[6]] });
    const r = live().record!;
    expect(r.top.map(t => t.by)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(r.personal[0]).toMatchObject({ raw: 16, place: 7, by: 'G' });
  });

  it('gives the Team best of exactly this lineup in co-op, and no PB', async () => {
    const [ann, bob, cy] = players('Ann', 'Bob', 'Cy');
    saved([ann, bob], [20, 20], true);
    saved([bob, ann], [18, 18], true);
    saved([ann, bob, cy], [12, 12, 12], true);
    await client(true)({ type: 'startMatch', game: 'atc', options: { ...ATC, coop: true }, roster: [ann, bob] });
    const r = live().record!;
    expect(r).toMatchObject({ raw: 12, coop: true, personal: [null, null] });
    expect(r.team).toMatchObject({ raw: 18, place: 2, by: 'Bob & Ann' });
    expect(r.top.map(t => t.raw)).toEqual([12, 18]);
  });

  it('gives no Team best to a lineup with a guest, and follows the lineup when a player leaves', async () => {
    const [ann, bob, cy] = players('Ann', 'Bob', 'Cy');
    saved([ann, cy], [15, 15], true);
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'atc', options: { ...ATC, coop: true }, roster: [ann, { playerId: null, name: 'Guest' }] });
    expect(live().record!.team).toBeNull();
    await pilot({ type: 'endMatch', save: false });
    expect(await pilot({ type: 'startMatch', game: 'atc', options: { ...ATC, coop: true }, roster: [ann, bob, cy] })).toMatchObject({ ok: true });
    expect(live().record!.team).toBeNull();
    await pilot({ type: 'skipIntro' });
    expect(await pilot(remove(1))).toMatchObject({ ok: true });
    expect(live().record!.team).toMatchObject({ raw: 15 });
    await pilot({ type: 'undo' });
    expect(live().record!.team).toBeNull();
  });

  it('marks a new Team best at the end of a co-op game, without the New record Wyzwalacz', async () => {
    const [ann, bob] = players('Ann', 'Bob');
    const [cy, dee] = players('Cy', 'Dee');
    saved([cy, dee], [5, 5], true);
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'atc', options: { ...ATC, coop: true }, roster: [ann, bob] });
    fire.mockClear();
    for (const [i, x] of fast.entries()) {
      await pilot(dart(x));
      if (i % 3 === 2) await pilot(next);
    }
    expect(live().newRecord).toEqual({ office: false, personal: [], team: true });
    expect(fire.mock.calls.flatMap(c => c[0]).map((c: { fact: { event?: string } }) => c.fact.event)).not.toContain('newRecord');
  });

  it('marks no Team best when the lineup did better before, in any order', async () => {
    const [ann, bob] = players('Ann', 'Bob');
    saved([bob, ann], [8, 8], true);
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'atc', options: { ...ATC, coop: true }, roster: [ann, bob] });
    for (const [i, x] of fast.entries()) {
      await pilot(dart(x));
      if (i % 3 === 2) await pilot(next);
    }
    // 8 ties the lineup's 8: a tie beats nothing.
    expect(live().newRecord).toBeNull();
  });

  it('marks a new personal best as before, with the Wyzwalacz', async () => {
    const [ann] = players('Ann');
    const [bob] = players('Bob');
    saved([bob], [5]);
    saved([ann], [9]);
    const pilot = client(true);
    await pilot({ type: 'startMatch', game: 'atc', options: ATC, roster: [ann] });
    fire.mockClear();
    for (const [i, x] of fast.entries()) {
      await pilot(dart(x));
      if (i % 3 === 2) await pilot(next);
    }
    expect(live().newRecord).toEqual({ office: false, personal: ['Ann'], team: false });
    expect(fire.mock.calls.flatMap(c => c[0]).map((c: { fact: { event?: string } }) => c.fact.event)).toContain('newRecord');
  });
});

describe('quick games (GLOSSARY: Szybka gra)', () => {
  /** The latest state a device got. */
  function stateOf() {
    const ws = Object.assign(new EventEmitter(), { OPEN: 1, readyState: 1, send: (s: string) => ws.emit('out', JSON.parse(s)) });
    let last: Extract<ServerMessage, { type: 'state' }>['state'] | undefined;
    ws.on('out', (m: ServerMessage) => m.type === 'state' && (last = m.state));
    hub.connect(ws as never, false);
    ws.emit('message', JSON.stringify({ type: 'hello', clientId: 'watcher', deviceName: 'test' }));
    return () => last!;
  }
  const settled = () => new Promise(r => setImmediate(r)); // the state goes out right after the result

  it('start with X01 for 2+ and 121 for solo, two empty slots each', () => {
    client(true);
    const q = stateOf()().quickGames;
    expect(q.multi).toEqual([{ game: 'x01', options: { startScore: 501, checkIn: 'straight', checkOut: 'double', matchMode: { kind: 'off' } } }, null, null]);
    expect(q.solo).toEqual([{ game: '121', options: { visits: 4, refill: false } }, null, null]);
    expect(db.quickGames()).toBeNull();
  });

  it('saves a slot for every device and keeps the other slots', async () => {
    const pilot = client(true);
    const state = stateOf();
    expect(await pilot({ type: 'setQuickGame', set: 'multi', index: 2, slot: { game: 'killer', options: { lives: 5 } } })).toMatchObject({ ok: true });
    await settled();
    expect(state().quickGames.multi).toEqual([
      { game: 'x01', options: { startScore: 501, checkIn: 'straight', checkOut: 'double', matchMode: { kind: 'off' } } }, null, { game: 'killer', options: { lives: 5 } }]);
    expect(state().quickGames.solo[0]).toMatchObject({ game: '121' });
    expect(db.quickGames()).toEqual(state().quickGames);
  });

  it('empties a slot with null', async () => {
    const pilot = client(true);
    const state = stateOf();
    expect(await pilot({ type: 'setQuickGame', set: 'solo', index: 0, slot: null })).toMatchObject({ ok: true });
    await settled();
    expect(state().quickGames.solo).toEqual([null, null, null]);
    expect(state().quickGames.multi[0]).toMatchObject({ game: 'x01' });
  });

  it('refuses Killer in solo and Free throw for 2+, and leaves the slots as they were', async () => {
    const pilot = client(true);
    expect(await pilot({ type: 'setQuickGame', set: 'solo', index: 1, slot: { game: 'killer', options: {} } })).toMatchObject({ ok: false, error: 'Killer needs 2 or more players' });
    expect(await pilot({ type: 'setQuickGame', set: 'multi', index: 1, slot: { game: 'freethrow', options: {} } })).toMatchObject({ ok: false, error: 'Free throw is for 1 player' });
    expect(db.quickGames()).toBeNull();
  });

  it('refuses an unknown game, a slot out of range and a device that is not the Pilot', async () => {
    const pilot = client(true);
    expect(await pilot({ type: 'setQuickGame', set: 'multi', index: 0, slot: { game: 'darts' as never, options: {} } })).toMatchObject({ ok: false, error: 'Unknown game' });
    expect(await pilot({ type: 'setQuickGame', set: 'multi', index: 3, slot: null })).toMatchObject({ ok: false, error: 'Invalid input' });
    expect(await pilot({ type: 'setQuickGame', set: 'team' as never, index: 0, slot: null })).toMatchObject({ ok: false, error: 'Invalid input' });
    const phone = client(false);
    expect(await phone({ type: 'setQuickGame', set: 'multi', index: 0, slot: null })).toMatchObject({ ok: false, error: 'Take control first' });
    expect(db.quickGames()).toBeNull();
  });

  it('cleans bad options through the game and keeps the bull-off out', async () => {
    const pilot = client(true);
    await pilot({ type: 'setQuickGame', set: 'multi', index: 1, slot: { game: 'x01', options: { startScore: 999, checkOut: 'master', matchMode: { kind: 'legs', firstTo: 99 }, bullOff: 'pdc' } } });
    expect((db.quickGames() as { multi: unknown[] }).multi[1]).toEqual(
      { game: 'x01', options: { startScore: 501, checkIn: 'straight', checkOut: 'master', matchMode: { kind: 'legs', firstTo: 3 } } });
  });
});
