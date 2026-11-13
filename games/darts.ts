// Shared dart vocabulary for all game modules. Pure, no I/O.

/** One dart: n is 0 (miss), 1–20 or 25; m is the multiplier. Bull is { n: 25, m: 2 }. */
export interface Dart {
  n: number;
  m: 1 | 2 | 3;
}

/** Board coordinates as sent by Board Manager. Kept only for unedited board darts. */
export interface Coords {
  x: number;
  y: number;
}

/** Board Manager coords are normalized: 1 is the outer edge of the double ring, 170 mm from the centre. */
export const BOARD_RADIUS_MM = 170;

/** Outer edge of the treble ring, 107 mm from the centre: a single beyond it is a big (outer) single. */
export const TREBLE_OUTER_MM = 107;

/** Big single: the field between the treble and the double. Without coords a single counts as big. */
export const isBigSingle = (rec: { dart: Dart; coords?: Coords }): boolean =>
  rec.dart.m === 1 && (!rec.coords || Math.hypot(rec.coords.x, rec.coords.y) >= TREBLE_OUTER_MM / BOARD_RADIUS_MM);

export const MISS: Dart = { n: 0, m: 1 };

/** Clockwise from the top. */
export const BOARD_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export const value = (d: Dart) => d.n * d.m;

export function label(d: Dart): string {
  if (d.n === 0) return 'Miss';
  if (d.n === 25) return d.m === 2 ? 'Bull' : '25';
  return (d.m === 3 ? 'T' : d.m === 2 ? 'D' : 'S') + d.n;
}

export function isValidDart(d: unknown): d is Dart {
  if (!d || typeof d !== 'object') return false;
  const { n, m } = d as Dart;
  if (!Number.isInteger(n) || !(m === 1 || m === 2 || m === 3)) return false;
  if (n === 0) return m === 1;
  if (n === 25) return m !== 3;
  return n >= 1 && n <= 20;
}

/** Parses Board Manager / keypad notation: T20, D16, S5, 5, 25, Bull, Miss. */
export function parseDart(text: string): Dart | null {
  const t = text.trim().toUpperCase();
  if (t === 'BULL' || t === 'DB' || t === 'D25' || t === '50') return { n: 25, m: 2 };
  if (t === '25' || t === 'SB' || t === 'S25') return { n: 25, m: 1 };
  if (t === 'MISS' || t === 'M' || t === '0' || /^[SDT]?0$/.test(t)) return MISS;
  const match = t.match(/^([SDT]?)(\d{1,2})$/);
  if (!match) return null;
  const n = +match[2];
  if (n < 1 || n > 20) return null;
  const m = ({ '': 1, S: 1, D: 2, T: 3 } as const)[match[1] as '' | 'S' | 'D' | 'T'];
  return { n, m };
}
