// Data and navigation of the Effects page (docs/EFEKTY.md, Układ strony).
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { EffectsResponse } from '../../../../server/effects/routes.ts';
import type { WledPreset } from '../../../../server/effects/wled.ts';
import { toast } from '../../components/ui.tsx';

/** JSON call with the server's error as a toast; null on failure. */
export async function call<T = unknown>(method: string, url: string, body?: unknown): Promise<T | null> {
  try {
    const r = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      toast({ text: (data as { error?: string }).error ?? 'Something went wrong', kind: 'error' });
      return null;
    }
    return data as T;
  } catch {
    toast({ text: 'ITDarts did not answer', kind: 'error' });
    return null;
  }
}

/** Plays a preset on the LEDs for a while, then WLED goes back to the base state. */
export async function tryLed(preset: number, seconds = 3, name?: string) {
  if (await call('POST', '/api/wled/preview', { preset, seconds })) toast({ text: `LEDs: ${name ?? `preset ${preset}`} for ${seconds} s` });
}

export interface Presets {
  list: WledPreset[] | null;
  error: string | null;
}

export interface EffectsData extends EffectsResponse {
  presets: Presets;
  /** Fetches rules, sounds and settings again after a change. */
  reload: () => void;
}

export function useEffectsData(): EffectsData | null {
  const [data, setData] = useState<EffectsResponse | null>(null);
  const [presets, setPresets] = useState<Presets>({ list: null, error: null });
  const reload = useCallback(() => {
    void call<EffectsResponse>('GET', '/api/effects').then(d => d && setData(d));
  }, []);
  useEffect(reload, [reload]);

  // Presets come from the controller each time the address changes.
  const address = data?.settings.wled.address ?? '';
  useEffect(() => {
    setPresets({ list: null, error: null });
    if (!address) return;
    let alive = true;
    fetch('/api/wled/presets')
      .then(async r => {
        const body = await r.json();
        if (alive) setPresets(r.ok ? { list: body, error: null } : { list: null, error: (body as { error: string }).error });
      })
      .catch(() => alive && setPresets({ list: null, error: 'ITDarts did not answer' }));
    return () => { alive = false; };
  }, [address]);

  return data && { ...data, presets, reload };
}

export const presetOf = (d: EffectsData, id: number | null) => (id === null ? null : d.presets.list?.find(p => p.id === id) ?? null);
export const presetName = (d: EffectsData, id: number) => presetOf(d, id)?.name ?? `Preset ${id}`;

// ---------- navigation with a guard for unsaved changes ----------

export type Tab = 'rules' | 'sounds' | 'leds' | 'playback';
export const TABS: [Tab, string][] = [['rules', 'Rules'], ['sounds', 'Sounds'], ['leds', 'LEDs'], ['playback', 'Playback']];

export interface Route {
  tab: Tab;
  /** In Rules: a rule id, 'new', or null for the list. */
  rule: number | 'new' | null;
}

export function parseRoute(path: string): Route {
  const [, , tab, sub] = path.split('/');
  const t = (TABS.some(([k]) => k === tab) ? tab : 'rules') as Tab;
  const rule = t !== 'rules' || !sub ? null : sub === 'new' ? 'new' : Number(sub) || null;
  return { tab: t, rule };
}

/** The editor registers this while it holds unsaved changes. */
let dirty: (() => boolean) | null = null;
let pending: (() => void) | null = null;
let path = location.pathname;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function setDirtyCheck(check: (() => boolean) | null) {
  dirty = check;
}

/** Runs `then` now, or after “Discard changes?” when the editor has unsaved changes. */
function guarded(then: () => void) {
  if (dirty?.()) {
    pending = then;
    emit();
  } else then();
}

export function go(to: string, replace = false) {
  guarded(() => {
    dirty = null;
    if (replace) history.replaceState(null, '', to);
    else history.pushState(null, '', to);
    path = to;
    // The app's router listens for popstate too, e.g. for the way back to the lobby.
    dispatchEvent(new PopStateEvent('popstate'));
  });
}

// The browser's back button: with unsaved changes, stay on the editor and ask first.
addEventListener('popstate', () => {
  const to = location.pathname;
  if (!path.startsWith('/effects') || !dirty?.()) {
    path = to;
    emit();
    return;
  }
  history.pushState(null, '', path);
  pending = () => {
    dirty = null;
    history.back();
  };
  emit();
});

export function discardAnswer(discard: boolean) {
  const run = pending;
  pending = null;
  emit();
  if (discard) run?.();
}

export function useNav(): { path: string; asking: boolean } {
  const p = useSyncExternalStore(l => (listeners.add(l), () => listeners.delete(l)), () => path);
  const asking = useSyncExternalStore(l => (listeners.add(l), () => listeners.delete(l)), () => pending !== null);
  return { path: p, asking };
}
