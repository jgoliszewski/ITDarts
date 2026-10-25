// Websocket link to the server. The server owns all state; this only mirrors it.
import { useSyncExternalStore } from 'react';
import type { ClientState, Command, ServerMessage } from '../../server/protocol.ts';
import { deviceName } from './util.ts';

export interface Snapshot {
  state: ClientState | null;
  connected: boolean;
}

export interface Result {
  ok: boolean;
  error?: string;
  playerId?: number;
}

let snapshot: Snapshot = { state: null, connected: false };
const listeners = new Set<() => void>();
const pending = new Map<number, (r: Result) => void>();
let ws: WebSocket | null = null;
let nextId = 1;

function set(s: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...s };
  listeners.forEach(l => l());
}

function clientId(): string {
  const key = 'itdarts.clientId';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return (window as unknown as { __cid?: string }).__cid ??= Math.random().toString(36).slice(2);
  }
}

function connect() {
  const sock = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws = sock;
  sock.onopen = () => {
    sock.send(JSON.stringify({ type: 'hello', clientId: clientId(), deviceName: deviceName() }));
    set({ connected: true });
  };
  sock.onmessage = e => {
    const m = JSON.parse(e.data) as ServerMessage;
    if (m.type === 'state') set({ state: m.state });
    else {
      pending.get(m.id)?.(m);
      pending.delete(m.id);
    }
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    set({ connected: false });
    for (const r of pending.values()) r({ ok: false, error: 'Connection lost' });
    pending.clear();
    setTimeout(connect, 1500);
  };
}

connect();

export function useSnapshot(): Snapshot {
  return useSyncExternalStore(
    l => (listeners.add(l), () => listeners.delete(l)),
    () => snapshot,
  );
}

export function send(cmd: Command): Promise<Result> {
  return new Promise(resolve => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return resolve({ ok: false, error: 'Not connected to ITDarts' });
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ type: 'cmd', id, cmd }));
  });
}
