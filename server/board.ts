// Board Manager adapter: the only client of its websocket and REST API (ADR 0001).
import { EventEmitter } from 'node:events';
import type { Coords, Dart } from '../games/darts.ts';
import type { BoardAction, BoardStatus } from './protocol.ts';

export interface BoardEvents {
  throw: [dart: Dart, coords: Coords | undefined];
  takeoutStarted: [];
  takeoutFinished: [];
  status: [];
}

interface BmThrow {
  segment?: { number?: number; multiplier?: number; name?: string };
  coords?: { x: number; y: number };
}

interface BmState {
  throws?: BmThrow[];
  event?: string;
  status?: string;
  running?: boolean;
}

const RECONNECT_MS = 2000;
const LOG_SIZE = 30;

export function toDart(t: BmThrow): Dart {
  const n = t.segment?.number ?? 0;
  const m = t.segment?.multiplier ?? 1;
  if (n === 0 || m === 0) return { n: 0, m: 1 };
  if (n === 25) return { n: 25, m: m >= 2 ? 2 : 1 };
  return { n, m: (m >= 1 && m <= 3 ? m : 1) as 1 | 2 | 3 };
}

export class Board extends EventEmitter<BoardEvents> {
  readonly status: BoardStatus;
  private ws: WebSocket | null = null;
  private processed = 0;
  /** After (re)connecting, the first state only sets the baseline: darts already counted are not replayed. */
  private synced = false;
  /** `processed` is still right after a reconnect; only the first connection to a board has to ask the hub. */
  private known = false;
  /** How many of the darts sitting in the board ITDarts already has (set by the hub). */
  countedOnBoard: () => number = () => Infinity;
  private stopped = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(public address: string) {
    super();
    this.status = {
      address, fake: false, connected: false, version: null, detecting: true, lastEvent: null, log: [], frameAt: null, raw: null,
      takeout: { active: false, since: null }, busy: null,
    };
  }

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
  }

  /** Drops the current connection and connects to another Board Manager. */
  setAddress(address: string) {
    const ws = this.ws;
    this.ws = null; // its onclose is then ignored
    ws?.close();
    this.address = address;
    this.known = false;
    Object.assign(this.status, { address, connected: false, version: null, takeout: { active: false, since: null }, busy: null });
    this.event(`Switched to ${address}`);
    this.start();
  }

  private connect() {
    if (this.stopped) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(`ws://${this.address}/api/events`);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.status.connected = true;
      this.synced = false;
      this.event('Connected');
      void this.fetchVersion();
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      const was = this.status.connected;
      this.status.connected = false;
      this.status.takeout = { active: false, since: null };
      if (was) this.event('Disconnected');
      this.scheduleReconnect();
    };
    ws.onerror = () => ws.close();
    ws.onmessage = msg => {
      try {
        const raw = String(msg.data);
        this.status.frameAt = Date.now();
        // Same frame again only moves frameAt: no broadcast for it.
        if (raw.slice(0, 2000) !== this.status.raw) {
          this.status.raw = raw.slice(0, 2000);
          this.emit('status');
        }
        const m = JSON.parse(raw) as { type?: string; data?: BmState };
        if (m.type === 'state' && m.data) this.onState(m.data);
      } catch {
        // ignore malformed frames
      }
    };
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.connect(), RECONNECT_MS);
  }

  private event(text: string, coords?: Coords) {
    const at = Date.now();
    this.status.lastEvent = { text, at };
    this.status.log = [{ text, at, ...(coords && { coords }) }, ...this.status.log].slice(0, LOG_SIZE);
    this.emit('status');
  }

  private onState(s: BmState) {
    const throws = s.throws ?? [];
    const detecting = this.status.detecting;
    if (typeof s.running === 'boolean') this.status.detecting = s.running;
    else if (typeof s.status === 'string' && /stop/i.test(s.status)) this.status.detecting = false;
    if (this.status.detecting !== detecting) this.event(this.status.detecting ? 'Detection started' : 'Detection stopped');

    const ev = s.event ?? '';
    if (/takeout started/i.test(ev) && !this.status.takeout.active) {
      this.status.takeout = { active: true, since: Date.now() };
      this.event('Takeout started');
      this.emit('takeoutStarted');
    }
    if (/takeout finished/i.test(ev)) {
      this.processed = 0;
      this.status.takeout = { active: false, since: null };
      this.event('Takeout finished');
      this.emit('takeoutFinished');
      return;
    }
    if (!this.synced) {
      this.synced = true;
      // The hub only knows the current visit, so darts left in the board after "Next player" would come back.
      // ponytail: a takeout during the disconnect is invisible here; new darts up to the old count are then skipped.
      this.processed = Math.min(throws.length, this.known ? this.processed : this.countedOnBoard());
      this.known = true;
    }
    if (throws.length < this.processed) this.processed = throws.length; // board was reset
    for (; this.processed < throws.length; this.processed++) {
      const t = throws[this.processed];
      const dart = toDart(t);
      const coords = t.coords && Number.isFinite(t.coords.x) && Number.isFinite(t.coords.y) ? { x: t.coords.x, y: t.coords.y } : undefined;
      this.event(`Throw detected · ${t.segment?.name ?? ''}`.trim(), coords);
      this.emit('throw', dart, coords);
    }
    // Reset clears the board, also from Board Manager's own page, so a takeout it never finished ends here.
    if (/manual reset/i.test(ev)) {
      this.status.takeout = { active: false, since: null };
      this.event('Manual reset');
    }
  }

  /** Ends a stuck takeout by hand: resets Board Manager without firing takeoutFinished. */
  async takeoutDone() {
    this.status.takeout = { active: false, since: null };
    this.processed = 0;
    this.event('Takeout done by hand');
    await this.action('reset').catch(() => undefined);
  }

  private async fetchVersion() {
    try {
      const r = await fetch(`http://${this.address}/api/version`, { signal: AbortSignal.timeout(3000) });
      if (!r.ok) return;
      const text = (await r.text()).trim();
      let v = text;
      try {
        const j = JSON.parse(text);
        v = typeof j === 'string' ? j : j.version ?? text;
      } catch {
        // plain text version
      }
      this.status.version = v.replace(/^v/i, '');
      this.emit('status');
    } catch {
      // version is optional
    }
  }

  async action(a: BoardAction): Promise<void> {
    const req: Record<BoardAction, [string, string]> = {
      reset: ['POST', '/api/reset'],
      start: ['PUT', '/api/start'],
      stop: ['PUT', '/api/stop'],
      calibrate: ['POST', '/api/config/calibration/auto'],
      restart: ['POST', '/api/restart'],
    };
    const [method, path] = req[a];
    const slow = a === 'calibrate' || a === 'restart';
    if (slow) {
      this.status.busy = { action: a, since: Date.now() };
      this.emit('status');
    }
    try {
      // Board Manager answers "Auto-calibration failed" (400) while detection is stopped, so start it first.
      if (a === 'calibrate' && !this.status.detecting) await this.action('start');
      const r = await fetch(`http://${this.address}${path}`, { method, signal: AbortSignal.timeout(slow ? 120_000 : 5000) });
      if (!r.ok) {
        const text = (await r.text().catch(() => '')).trim().slice(0, 120);
        throw new Error(text ? `Board Manager: ${text}` : `Board Manager answered ${r.status}`);
      }
      if (a === 'start') this.status.detecting = true;
      if (a === 'stop') this.status.detecting = false;
      if (a === 'reset') this.processed = 0;
      this.event({ reset: 'Reset', start: 'Detection started', stop: 'Detection stopped', calibrate: 'Calibrated', restart: 'Restarting' }[a]);
    } catch (e) {
      this.event(`${a[0].toUpperCase()}${a.slice(1)} failed: ${e instanceof Error ? e.message : e}`);
      throw e;
    } finally {
      if (slow) {
        this.status.busy = null;
        this.emit('status');
      }
    }
  }
}
