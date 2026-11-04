// The hub's remove command (docs/UI.md#wycofanie-gracza): who may send it, when the server refuses it, and that it stays silent.
import { EventEmitter } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseDart } from '../games/darts.ts';
import { GAMES } from '../games/index.ts';
import type { Board } from './board.ts';
import type { Config } from './config.ts';
import { Db } from './db.ts';
import type { Effects } from './effects/index.ts';
import { Hub } from './hub.ts';
import type { Command, ServerMessage } from './protocol.ts';

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
  db.close();
  rmSync(dir, { recursive: true, force: true });
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
});
