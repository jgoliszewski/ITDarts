import type { Dart } from '../darts.ts';
import { label, value } from '../darts.ts';
import type { CheckOut } from './rules.ts';
import { finishesLeg } from './rules.ts';

// Finishing darts in the order players usually aim for them.
const FINISH_PREFERENCE: Dart[] = [
  ...[20, 16, 18, 12, 10, 8, 19, 17, 14, 15, 13, 11, 9, 6, 4, 7, 5, 3, 2, 1].map(n => ({ n, m: 2 as const })),
  { n: 25, m: 2 },
  ...Array.from({ length: 20 }, (_, i) => ({ n: 20 - i, m: 3 as const })),
  ...Array.from({ length: 20 }, (_, i) => ({ n: 20 - i, m: 1 as const })),
  { n: 25, m: 1 },
];

// Setup darts: singles first (safer), then the big trebles, then bulls.
const SETUP_PREFERENCE: Dart[] = [
  ...Array.from({ length: 20 }, (_, i) => ({ n: 20 - i, m: 1 as const })),
  ...Array.from({ length: 20 }, (_, i) => ({ n: 20 - i, m: 3 as const })),
  { n: 25, m: 1 },
  { n: 25, m: 2 },
  ...Array.from({ length: 20 }, (_, i) => ({ n: 20 - i, m: 2 as const })),
];

// The first of three darts goes for the biggest score.
const OPENING_PREFERENCE: Dart[] = [
  ...Array.from({ length: 20 }, (_, i) => ({ n: 20 - i, m: 3 as const })),
  { n: 25, m: 2 },
  { n: 25, m: 1 },
  ...Array.from({ length: 20 }, (_, i) => ({ n: 20 - i, m: 1 as const })),
];

function finishWith(remaining: number, rule: CheckOut): Dart | null {
  return FINISH_PREFERENCE.find(d => value(d) === remaining && finishesLeg(d, rule)) ?? null;
}

function twoDarts(remaining: number, rule: CheckOut): Dart[] | null {
  for (const fin of FINISH_PREFERENCE) {
    if (!finishesLeg(fin, rule)) continue;
    const setup = remaining - value(fin);
    if (setup <= 0) continue;
    const first = SETUP_PREFERENCE.find(d => value(d) === setup);
    if (first) return [first, fin];
  }
  return null;
}

function threeDarts(remaining: number, rule: CheckOut): Dart[] | null {
  for (const first of OPENING_PREFERENCE) {
    const rest = remaining - value(first);
    if (rest <= 1) continue;
    const two = twoDarts(rest, rule);
    if (two) return [first, ...two];
  }
  return null;
}

/** Suggested finish for `remaining` with at most `dartsLeft` darts, or null when there is none. */
export function checkoutRoute(remaining: number, dartsLeft: number, rule: CheckOut): Dart[] | null {
  if (remaining > 170 || remaining < 1 || dartsLeft < 1) return null;
  const one = finishWith(remaining, rule);
  if (one) return [one];
  if (dartsLeft >= 2) {
    const two = twoDarts(remaining, rule);
    if (two) return two;
  }
  if (dartsLeft >= 3) return threeDarts(remaining, rule);
  return null;
}

export const formatRoute = (route: Dart[]) => route.map(label).join(' · ');
