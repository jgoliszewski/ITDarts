import { afterEach, describe, expect, it, vi } from 'vitest';
import { Board } from './board.ts';

const t = (number: number) => ({ segment: { number, multiplier: 1, name: `S${number}` } });

describe('Board', () => {
  it('does not replay darts of an earlier visit after a reconnect', () => {
    const board = new Board('localhost:1');
    const thrown: number[] = [];
    board.on('throw', d => thrown.push(d.n));
    const state = (throws: object[]) => (board as any).onState({ throws });
    board.countedOnBoard = () => 0;
    state([t(20), t(5)]);
    expect(thrown).toEqual([20, 5]);
    // "Next player" before the takeout: the hub's visit is empty again, the darts stay in the board.
    (board as any).synced = false; // reconnect
    state([t(20), t(5)]);
    state([t(20), t(5), t(1)]);
    expect(thrown).toEqual([20, 5, 1]);
  });

  it('plays back a Board Manager 2.1.0 capture: every dart once, one takeout per takeout', () => {
    const board = new Board('localhost:1');
    const log: string[] = [];
    const coords: Array<{ x: number; y: number } | undefined> = [];
    board.on('throw', (d, c) => { log.push(`${d.n}x${d.m}`); coords.push(c); });
    board.on('takeoutStarted', () => log.push('started'));
    board.on('takeoutFinished', () => log.push('finished'));
    board.countedOnBoard = () => 0;
    const flat = (n: number, m: number, x: number, y: number) =>
      ({ bed: 'x', bouncer: false, coordsX: x, coordsY: y, failed: false, method: 'UnanimousCam', multiplier: m, segmentName: `S${n}`, segmentNumber: n });
    const a = flat(2, 1, 0.24, -0.27), b = flat(14, 1, -0.19, 0.05), c = flat(13, 1, 0.16, 0.07);
    const d = flat(7, 1, -0.37, -0.63), e = flat(19, 3, -0.22, -0.56);
    const frames: Array<[string, object[]]> = [
      ['throwDetected', [a]], ['throwDetected', [a, b]], ['throwDetected', [a, b, c]],
      ['takeoutStarted', [a, b, c]], ['takeoutFinished', []],
      ['takeoutFinished', [d]], ['throwDetected', [d]], ['throwDetected', [d, e]],
    ];
    for (const [event, throws] of frames) (board as any).onState({ event, throws });
    expect(log).toEqual(['2x1', '14x1', '13x1', 'started', 'finished', '7x1', '19x3']);
    expect(coords[0]).toEqual({ x: 0.24, y: -0.27 });
    expect(coords[4]).toEqual({ x: -0.22, y: -0.56 });
    expect(board.status.log.map(l => l.text)).toContain('Throw detected · S7');
  });

  it('still reads the 2.0.2 format and event names', () => {
    const board = new Board('localhost:1');
    const log: string[] = [];
    board.on('throw', d => log.push(`${d.n}x${d.m}`));
    board.on('takeoutStarted', () => log.push('started'));
    board.on('takeoutFinished', () => log.push('finished'));
    board.countedOnBoard = () => 0;
    const old = { segment: { number: 20, multiplier: 3, name: 'T20' }, coords: { x: 0.1, y: 0.6 } };
    (board as any).onState({ event: 'Throw detected', throws: [old] });
    (board as any).onState({ event: 'Takeout started', throws: [old] });
    (board as any).onState({ event: 'Takeout finished', throws: [] });
    expect(log).toEqual(['20x3', 'started', 'finished']);
  });

  it('treats a sticky takeoutFinished after a reconnect as new and counts its dart once', () => {
    let ws: any;
    vi.stubGlobal('WebSocket', class { constructor() { ws = this; } close() {} });
    vi.stubGlobal('fetch', async () => new Response(''));
    const board = new Board('localhost:1');
    const log: string[] = [];
    board.on('throw', d => log.push(`${d.n}x${d.m}`));
    board.on('takeoutFinished', () => log.push('finished'));
    board.countedOnBoard = () => 0;
    board.start();
    ws.onopen();
    const d = { segmentNumber: 7, multiplier: 1, segmentName: 'S7', coordsX: 0.1, coordsY: 0.2 };
    const state = (event: string, throws: object[]) => (board as any).onState({ event, throws });
    state('takeoutFinished', []);
    ws.onopen(); // reconnect: the previous event is forgotten
    state('takeoutFinished', [d]);
    state('throwDetected', [d]);
    expect(log).toEqual(['finished', 'finished', '7x1']);
    board.stop();
  });

  it('ends a takeout on manualReset', () => {
    const board = new Board('localhost:1');
    const state = (event: string) => (board as any).onState({ event, throws: [] });
    state('takeoutStarted');
    expect(board.status.takeout.active).toBe(true);
    state('manualReset');
    expect(board.status.takeout.active).toBe(false);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('starts detection before a match, even when it looks on, then clears the board', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${new URL(url).pathname}`);
      return new Response('');
    });
    const board = new Board('localhost:1');
    board.status.detecting = true;
    await board.prepare();
    expect(calls).toEqual(['PUT /api/start', 'POST /api/reset']);
  });
});
