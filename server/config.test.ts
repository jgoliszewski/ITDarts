import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fakeBoardPort, loadConfig } from './config.ts';

describe('config flags', () => {
  it('keeps the defaults without flags', () => {
    const c = loadConfig([]);
    expect(c.effectsDir).toBe(resolve('effects'));
    expect(c.webDir).toBe(resolve('dist/web'));
    expect(c.port).toBe(3000);
  });

  it('takes --effects and --web as resolved paths, next to the other flags', () => {
    const c = loadConfig(['--port', '3300', '--board', 'localhost:3380', '--data', 'tmp/data', '--effects', 'tmp/effects', '--web', 'tmp/web']);
    expect(c).toMatchObject({ port: 3300, board: 'localhost:3380', dataDir: resolve('tmp/data'), effectsDir: resolve('tmp/effects'), webDir: resolve('tmp/web') });
  });
});

describe('fakeBoardPort', () => {
  it('is 3180 for a real board and for the stock simulator', () => {
    expect(fakeBoardPort('192.168.1.183:3180')).toBe('3180');
    expect(fakeBoardPort('localhost:3180')).toBe('3180');
  });
  it('follows a local simulator on another port, so a side instance never starts one on 3180', () => {
    expect(fakeBoardPort('localhost:3380')).toBe('3380');
    expect(fakeBoardPort('127.0.0.1:3380')).toBe('3380');
  });
});
