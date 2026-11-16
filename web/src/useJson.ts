import { useEffect, useState } from 'react';

export interface Fetched<T> {
  data: T | null;
  error: boolean;
}

interface Held<T> extends Fetched<T> {
  key: string | null;
}

/**
 * What a screen may show for `key`: the data fetched for exactly that key, else nothing. Data kept from another key
 * (another game, window or player) must never be rendered under the new one: the screen would read fields the old
 * response does not have (docs/STATYSTYKI.md, Prezentacja).
 */
export function pick<T>(held: Held<T>, key: string | null): Fetched<T> {
  return held.key === key ? { data: held.data, error: held.error } : { data: null, error: false };
}

/** Loads `load()` whenever `key` changes; until it answers, `data` is null. `key` names everything the loader depends on. */
export function useAsync<T>(key: string | null, load: () => Promise<T>): Fetched<T> {
  const [held, setHeld] = useState<Held<T>>({ key: null, data: null, error: false });
  useEffect(() => {
    if (key === null) return;
    let alive = true;
    load()
      .then(data => alive && setHeld({ key, data, error: false }))
      .catch(() => alive && setHeld({ key, data: null, error: true }));
    return () => { alive = false; };
    // The loader is a closure over what `key` names.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return pick(held, key);
}

export const getJson = <T,>(url: string): Promise<T> => fetch(url).then(r => (r.ok ? r.json() : Promise.reject(r.status)));

export const useJson = <T,>(url: string | null): Fetched<T> => useAsync<T>(url, () => getJson<T>(url!));
