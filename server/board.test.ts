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

  afterEach(() => vi.unstubAllGlobals());

  it('starts stopped detection before a match, then clears the board', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${new URL(url).pathname}`);
      return new Response('');
    });
    const board = new Board('localhost:1');
    board.status.detecting = false;
    await board.prepare();
    expect(calls).toEqual(['PUT /api/start', 'POST /api/reset']);
    expect(board.status.detecting).toBe(true);

    calls.length = 0;
    await board.prepare();
    expect(calls).toEqual(['POST /api/reset']);
  });
});
