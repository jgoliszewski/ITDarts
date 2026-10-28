// The controller for the LED lab scripts: --wled <host>, or the address set on /effects.
import { DatabaseSync } from 'node:sqlite';

function savedAddress(): string {
  const db = new DatabaseSync('data/itdarts.db', { readOnly: true });
  const row = db.prepare("SELECT value FROM settings WHERE key = 'effects'").get() as { value: string } | undefined;
  db.close();
  return row ? (JSON.parse(row.value).address ?? '') : '';
}

const arg = process.argv.indexOf('--wled');
export const wled = arg > 0 ? process.argv[arg + 1] : savedAddress();
if (!wled) throw new Error('No WLED address: pass --wled <host> or set it on /effects');

/** GET without a body, POST JSON with one; FormData goes as is (file upload). WLED answers /upload with plain text. */
export async function call(path: string, body?: unknown): Promise<unknown> {
  const form = body instanceof FormData;
  const r = await fetch(`http://${wled}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined || form ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(form ? 10000 : 3000),
  });
  if (!r.ok) throw new Error(`WLED answered ${r.status}`);
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
