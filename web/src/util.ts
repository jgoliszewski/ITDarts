import { useEffect, useState, useSyncExternalStore } from 'react';

export function deviceName(): string {
  const ua = navigator.userAgent;
  if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return 'Laptop';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Macintosh/.test(ua)) return 'Mac';
  return 'Browser';
}

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    l => {
      const m = matchMedia(query);
      m.addEventListener('change', l);
      return () => m.removeEventListener('change', l);
    },
    () => matchMedia(query).matches,
  );
}

/** Wide screens get the scoreboard; narrow ones the phone pilot. */
export const useWide = () => useMedia('(min-width: 900px) and (min-height: 500px)');

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export const fmtAvg = (v: number | null | undefined) => (v === null || v === undefined ? '–' : v.toFixed(1));
export const fmtNum = (v: number | null | undefined) => (v === null || v === undefined ? '–' : String(v));

export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function shortDate(at: number): string {
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // storage is a convenience only
    }
  },
};
