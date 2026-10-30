// Wyzwalacze (docs/EFEKTY.md): what a game reports to the effects system, and how a Reguła matches it. Pure, no I/O.
// A game lists every occurrence in the match so far. The hub compares the list before and after each log event,
// so a fix or an undo needs no logic of its own.
import type { Dart } from './darts.ts';
import { label } from './darts.ts';

export type GameEvent =
  | 'newRecord' | 'eliminated' | 'lifeLost' | 'becameKiller' | 'attemptFailed'
  | 'whiteHorse' | 'shanghai' | 'gotcha' | 'goal' | 'marks' | 'sectorClosed' | 'sectorCleared' | 'targetHit';

export type Fact =
  | { kind: 'dart'; dart: Dart }
  /** A complete X01 visit without a bust. `darts` are the ones that took effect. */
  | { kind: 'visit'; total: number; darts: Dart[]; checkout: boolean }
  /** A complete 121 visit without a bust, for the caller only: visit totals trigger rules in X01 alone. */
  | { kind: 'calledTotal'; total: number }
  /** X01: the score a dart left the player on. Only darts that changed the score. */
  | { kind: 'left'; score: number }
  | { kind: 'bust' }
  /** Checkout or a won leg (a won game in Higher or Lower). */
  | { kind: 'checkout' }
  | { kind: 'setWon' }
  | { kind: 'matchWon' }
  | { kind: 'legStart' }
  | { kind: 'game'; event: GameEvent; marks?: number; whiteHorse?: boolean }
  // Reported by the hub, not by the game log.
  | { kind: 'matchStart' }
  | { kind: 'takeoutStart' }
  | { kind: 'takeoutEnd' }
  | { kind: 'boardOffline' }
  | { kind: 'boardOnline' }
  /** The visit went to the next player, or the next leg started. */
  | { kind: 'nextPlayer' }
  /** Minigames: a new dart that counts or does not (dartCue in games/turns.ts). */
  | { kind: 'hit' }
  | { kind: 'miss' };

/** One occurrence. The same slot before and after a log event is the same occurrence, maybe with other facts. */
export interface Happening {
  slot: string;
  fact: Fact;
}

/** Game events tied to a single dart: like the dart itself, a fix does not fire them. */
const DART_LEVEL = new Set<GameEvent>(['targetHit', 'sectorCleared', 'sectorClosed', 'becameKiller', 'lifeLost']);

export interface Change {
  fact: Fact;
  /** What the same slot held before the event, or null for a new occurrence. */
  before: Fact | null;
}

/** Occurrences that are new or changed. A fix fires only visit and match results; an undo fires nothing. */
export function changes(before: Happening[], after: Happening[], cause: 'fix' | 'undo' | 'other'): Change[] {
  if (cause === 'undo') return [];
  const old = new Map(before.map(h => [h.slot, h.fact]));
  return after
    .filter(h => cause !== 'fix' || !(h.fact.kind === 'dart' || (h.fact.kind === 'game' && DART_LEVEL.has(h.fact.event))))
    .map(h => ({ fact: h.fact, before: old.get(h.slot) ?? null }))
    .filter(c => !c.before || JSON.stringify(c.before) !== JSON.stringify(c.fact));
}

// ---------- triggers ----------

/** A dart in a trigger: null means any. A null number is any of 1–20, so it never covers the bull or a miss. */
export interface DartPattern {
  n: number | null;
  m: 1 | 2 | 3 | null;
}

export type CheckoutCond = 'any' | 'only' | 'no';

export type Trigger =
  | { kind: 'dart'; dart: DartPattern }
  | { kind: 'total'; total: number; checkout: CheckoutCond }
  /** Visit total from min to max, both included. */
  | { kind: 'range'; min: number; max: number; checkout: CheckoutCond }
  | { kind: 'combo'; darts: DartPattern[]; ordered: boolean; checkout: CheckoutCond }
  | { kind: 'left'; score: number }
  | { kind: 'game'; event: GameEvent; marks?: number }
  | { kind: Exclude<Fact['kind'], 'dart' | 'visit' | 'calledTotal' | 'left' | 'game'> };

export type TriggerKind = Trigger['kind'];

export const dartMatches = (p: DartPattern, d: Dart) =>
  (p.n === null ? d.n >= 1 && d.n <= 20 : d.n === p.n) && (p.m === null || d.m === p.m);

function comboMatches(t: Extract<Trigger, { kind: 'combo' }>, darts: Dart[]): boolean {
  if (darts.length !== t.darts.length) return false;
  if (t.ordered) return t.darts.every((p, i) => dartMatches(p, darts[i]));
  // Any order: try every assignment of darts to patterns.
  const fit = (k: number, used: boolean[]): boolean =>
    k === t.darts.length || darts.some((d, i) => !used[i] && dartMatches(t.darts[k], d) && fit(k + 1, used.map((u, j) => u || j === i)));
  return fit(0, darts.map(() => false));
}

const checkoutOk = (c: CheckoutCond, checkout: boolean) => c === 'any' || (c === 'only') === checkout;

export function matches(t: Trigger, f: Fact): boolean {
  switch (t.kind) {
    case 'dart': return f.kind === 'dart' && dartMatches(t.dart, f.dart);
    case 'total': return f.kind === 'visit' && f.total === t.total && checkoutOk(t.checkout, f.checkout);
    case 'range': return f.kind === 'visit' && f.total >= t.min && f.total <= t.max && checkoutOk(t.checkout, f.checkout);
    case 'combo': return f.kind === 'visit' && checkoutOk(t.checkout, f.checkout) && comboMatches(t, f.darts);
    case 'left': return f.kind === 'left' && f.score === t.score;
    case 'game':
      if (f.kind !== 'game') return false;
      if (t.event === 'whiteHorse') return f.event === 'marks' && !!f.whiteHorse;
      return f.event === t.event && (t.event !== 'marks' || f.marks === t.marks);
    default: return f.kind === t.kind;
  }
}

/** Most important first. Game events and the hub's own triggers are not in the list from the grilling, so they sit around it. */
const ORDER = [
  'newRecord', 'shanghai', 'goal', 'matchWon', 'setWon', 'onlyCheckout', 'checkout', 'bust',
  'eliminated', 'lifeLost', 'becameKiller', 'attemptFailed', 'whiteHorse', 'gotcha', 'marks', 'sectorClosed', 'sectorCleared', 'targetHit',
  'combo', 'total', 'range', 'left', 'dart', 'hit', 'miss', 'matchStart', 'legStart', 'nextPlayer', 'takeoutStart', 'takeoutEnd', 'boardOffline', 'boardOnline',
] as const;

/** Lower is more important. */
export function priority(t: Trigger): number {
  if ((t.kind === 'total' || t.kind === 'range' || t.kind === 'combo') && t.checkout === 'only') return ORDER.indexOf('onlyCheckout');
  return ORDER.indexOf(t.kind === 'game' ? t.event : t.kind);
}

export interface RuleLike {
  enabled: boolean;
  triggers: Trigger[];
}

/**
 * The one Reguła to play for these changes: the highest priority among triggers that match now and did not match
 * the same slot before. Ties go to the rule that comes first, which is the older one.
 */
export function pickRule<R extends RuleLike>(rules: R[], cs: Change[]): R | null {
  let best: { rule: R; p: number } | null = null;
  for (const rule of rules) {
    if (!rule.enabled) continue;
    for (const t of rule.triggers) {
      if (!cs.some(c => matches(t, c.fact) && !(c.before && matches(t, c.before)))) continue;
      const p = priority(t);
      if (!best || p < best.p) best = { rule, p };
    }
  }
  return best?.rule ?? null;
}

// ---------- validation and wording ----------

const GAME_EVENTS: GameEvent[] = ['newRecord', 'eliminated', 'lifeLost', 'becameKiller', 'attemptFailed', 'whiteHorse', 'shanghai', 'gotcha', 'goal', 'marks', 'sectorClosed', 'sectorCleared', 'targetHit'];

const isPattern = (p: unknown): p is DartPattern => {
  if (!p || typeof p !== 'object') return false;
  const { n, m } = p as DartPattern;
  const nOk = n === null || n === 0 || n === 25 || (Number.isInteger(n) && n >= 1 && n <= 20);
  const mOk = m === null || m === 1 || m === 2 || m === 3;
  return nOk && mOk && !(n === 0 && m !== 1 && m !== null) && !(n === 25 && m === 3);
};

const isCond = (c: unknown): c is CheckoutCond => c === 'any' || c === 'only' || c === 'no';
/** The highest X01 start score. */
export const MAX_LEFT = 901;

const isScore = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 180;

export function isValidTrigger(t: unknown): t is Trigger {
  if (!t || typeof t !== 'object') return false;
  const x = t as Record<string, unknown>;
  switch (x.kind) {
    case 'dart': return isPattern(x.dart);
    case 'total': return isScore(x.total) && isCond(x.checkout);
    case 'range': return isScore(x.min) && isScore(x.max) && (x.min as number) <= (x.max as number) && isCond(x.checkout);
    case 'combo': return Array.isArray(x.darts) && x.darts.length === 3 && x.darts.every(isPattern) && typeof x.ordered === 'boolean' && isCond(x.checkout);
    case 'left': return Number.isInteger(x.score) && (x.score as number) >= 1 && (x.score as number) <= MAX_LEFT;
    case 'game':
      return GAME_EVENTS.includes(x.event as GameEvent) && (x.event !== 'marks' || (Number.isInteger(x.marks) && (x.marks as number) >= 5 && (x.marks as number) <= 9));
    default: return ['bust', 'checkout', 'setWon', 'matchWon', 'matchStart', 'legStart', 'nextPlayer', 'hit', 'miss', 'takeoutStart', 'takeoutEnd', 'boardOffline', 'boardOnline'].includes(x.kind as string);
  }
}

/** The same trigger with its keys in one fixed order, so the effects file in the repo diffs cleanly. Takes a valid trigger. */
export function normalizeTrigger(t: Trigger): Trigger {
  const p = (d: DartPattern): DartPattern => ({ n: d.n, m: d.m });
  switch (t.kind) {
    case 'dart': return { kind: 'dart', dart: p(t.dart) };
    case 'total': return { kind: 'total', total: t.total, checkout: t.checkout };
    case 'range': return { kind: 'range', min: t.min, max: t.max, checkout: t.checkout };
    case 'combo': return { kind: 'combo', darts: t.darts.map(p), ordered: t.ordered, checkout: t.checkout };
    case 'left': return { kind: 'left', score: t.score };
    case 'game': return t.event === 'marks' ? { kind: 'game', event: 'marks', marks: t.marks } : { kind: 'game', event: t.event };
    default: return { kind: t.kind };
  }
}

export function patternLabel(p: DartPattern): string {
  if (p.n === null) return p.m === null ? 'Any dart' : `Any ${['single', 'double', 'treble'][p.m - 1]}`;
  if (p.m === null) return p.n === 25 ? 'Any bull' : p.n === 0 ? 'Miss' : `Any ${p.n}`;
  return label({ n: p.n, m: p.m });
}

export const GAME_EVENT_LABELS: Record<GameEvent, string> = {
  newRecord: 'New record',
  eliminated: 'Player eliminated',
  lifeLost: 'Life lost',
  becameKiller: 'Became killer',
  attemptFailed: 'Attempt failed',
  whiteHorse: 'White Horse',
  shanghai: 'Shanghai',
  gotcha: 'Gotcha',
  goal: 'Goal',
  marks: 'Marks in visit',
  sectorClosed: 'Sector closed',
  sectorCleared: 'Sector cleared',
  targetHit: 'Target hit',
};

export const SIMPLE_LABELS: Record<Exclude<TriggerKind, 'dart' | 'total' | 'range' | 'combo' | 'left' | 'game'>, string> = {
  bust: 'Bust',
  checkout: 'Checkout / leg won',
  setWon: 'Set won',
  matchWon: 'Match won',
  matchStart: 'Match start',
  legStart: 'Leg start',
  nextPlayer: 'Next player',
  hit: 'Hit',
  miss: 'Miss',
  takeoutStart: 'Takeout start',
  takeoutEnd: 'Takeout end',
  boardOffline: 'Board offline',
  boardOnline: 'Board online',
};

const condLabel = (c: CheckoutCond) => (c === 'only' ? ' · checkout' : c === 'no' ? ' · no checkout' : '');

export function triggerLabel(t: Trigger): string {
  switch (t.kind) {
    case 'dart': return patternLabel(t.dart);
    case 'total': return `${t.total === 0 ? '0 (no score)' : t.total}${condLabel(t.checkout)}`;
    case 'range': return `${t.max >= 180 ? `${t.min}+` : `${t.min}–${t.max}`}${condLabel(t.checkout)}`;
    case 'combo': return `${t.darts.map(patternLabel).join(' · ')}${t.ordered ? ' (in order)' : ''}${condLabel(t.checkout)}`;
    case 'left': return `Left on ${t.score}`;
    case 'game': return t.event === 'marks' ? `${t.marks} marks in visit` : GAME_EVENT_LABELS[t.event];
    default: return SIMPLE_LABELS[t.kind];
  }
}
