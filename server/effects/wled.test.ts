import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Wled } from './wled.ts';

describe('Wled', () => {
  const srv = createServer((_req, res) => res.writeHead(200, { 'content-type': 'text/html' }).end('<html><head></head></html>'));
  let addr = '';
  beforeAll(() => new Promise<void>(ok => srv.listen(0, '127.0.0.1', () => {
    addr = `127.0.0.1:${(srv.address() as AddressInfo).port}`;
    ok();
  })));
  afterAll(() => new Promise<void>(ok => srv.close(() => ok())));

  it('says plainly when a web page answers instead of WLED', async () => {
    const w = new Wled(() => addr);
    await expect(w.info()).rejects.toThrow(`${addr} answers with a web page, not WLED: check the address`);
    expect(w.error?.text).toMatch(/web page, not WLED/);
  });
});
