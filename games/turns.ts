// Turn log shared by the minigames: replays darts, fixes, undo and Next player into visits. Pure, no I/O.
// Each game only says, for the visits so far, who throws next and how many darts the visit still takes.
import type { BullDart, BullEvent, BullOffView } from './bulloff.ts';
import { beforeStart, bullView, fromStarter, undoStart } from './bulloff.ts';
import type { Coords, Dart } from './darts.ts';
import { MISS, isValidDart } from './darts.ts';
import type { GameEvent, Happening } from './effects.ts';
import type { DartRec, LegRecord } from './x01/engine.ts';
import type { BullOff } from './x01/rules.ts';

export type TurnEvent =
  | { t: 'start'; starter: number }
  | { t: 'dart'; dart: Dart; coords?: Coords; at: number }
  | { t: 'fix'; index: number; dart: Dart }
  | { t: 'undo' }
  | { t: 'next'; at?: number }
  /** Killer numbers, drawn by the server before the first dart. */
  | { t: 'numbers'; numbers: number[] }
  /** Seed for the game's random draws (ATC Order: Random, Random Checkouts), logged by the server at the start. */
  | { t: 'seed'; seed: number }
  /** End match with Save in a game with no natural end (Random Checkouts): the game ends as won. */
  | { t: 'end' }
  /** Wycofanie gracza (docs/UI.md#wycofanie-gracza): out of the match, or in X01 out of this leg only. */
  | RemoveEvent
  | BullEvent;

export type RemoveEvent = { t: 'remove'; player: number; scope: 'match' | 'leg' };

/** How a player is out of play by a removal: for the rest of the match, for this leg (X01), or not at all. */
export type Removed = 'match' | 'leg' | null;

/** A removal in the replayed log. */
export interface Removal {
  player: number;
  scope: 'match' | 'leg';
  /** Index of the first visit (X01: leg) it applies to. */
  at: number;
  /** It ended the player's open visit, so its undo reopens it. */
  closed: boolean;
  /** That visit still took darts: it was cut short, with only the darts thrown. */
  cut: boolean;
  /** State right after it; an undo while the state is still this takes the removal back. */
  mark: string;
}

export interface Visit {
  player: number;
  darts: DartRec[];
  /** Misses added when the visit was closed with fewer than three darts. */
  filled: number;
  closed: boolean;
}

export interface Turns {
  /** Playing order from the bull-off or the pilot's pick; null until it is known. */
  order: number[] | null;
  visits: Visit[];
  numbers: number[];
  seed: number;
  /** Ended by End match with Save; an undo right after takes it back. */
  ended: boolean;
  bull: BullDart[];
  bullOff: BullOffView | null;
  players: number;
  removed: Removal[];
}

/** What a game says about the log so far. */
export interface Turn {
  over: boolean;
  /** Who throws the open visit, or the next one. */
  current: number;
  /** Darts the open (or next) visit still takes. */
  dartsLeft: number;
  /** Per visit, per dart: did it count? */
  goods: boolean[][];
  /** The game's own Wyzwalacz occurrences; darts and the start come from turnHappenings. */
  fx: Happening[];
}

/** Headline of a finished visit on the turn card (docs/UI.md, Tura i takeout). */
export interface Verdict {
  text: string;
  tone: 'good' | 'bad';
}

export interface MiniView {
  phase: 'bulloff' | 'throwing' | 'matchWon';
  current: number;
  /** Per player: removed from the match (docs/UI.md#wycofanie-gracza). */
  removed: Removed[];
  bullOff: BullOffView | null;
  /** Playing order, null during the bull-off. */
  order: number[] | null;
  /** `verdict` headlines the turn card once the visit is complete. */
  visit: { player: number; darts: DartRec[]; dartsLeft: number; good: boolean[]; verdict: Verdict | null };
  winners: number[];
  /** Hero on the scoreboard: a big value, a caption above it and a note under the player's name. */
  hero: { big: string; caption: string; note: string };
  /** One line per player for the player list. */
  rows: { value: string; meta: string; out: boolean }[];
  /** End screen line, e.g. “Completed in 74 darts”. */
  result: string;
  /** Record value per player (co-op: the same for everyone), null when there is none. */
  scores: (number | null)[];
  /** Per-player totals kept in history, e.g. { darts, hits }. */
  stats: Record<string, number>[];
}

export const isValidTurnEvent = (e: TurnEvent): boolean => {
  switch (e.t) {
    case 'dart':
    case 'bull': return isValidDart(e.dart);
    case 'fix': return Number.isInteger(e.index) && isValidDart(e.dart);
    case 'start': return Number.isInteger(e.starter);
    case 'numbers': return Array.isArray(e.numbers) && e.numbers.every(n => Number.isInteger(n) && n >= 1 && n <= 20);
    case 'seed': return Number.isInteger(e.seed);
    case 'remove': return Number.isInteger(e.player) && e.scope === 'match';
    default: return e.t === 'undo' || e.t === 'next' || e.t === 'end';
  }
};

function reopenLast(t: Turns) {
  const last = t.visits.at(-1)!;
  last.closed = false;
  last.darts.splice(last.darts.length - last.filled);
  last.filled = 0;
  if (last.darts.length === 0) t.visits.pop();
}

/** Closes a visit; one that already ended (bust, checkout, elimination) gets no extra misses. */
function closeVisit(v: Visit, s: Turn, at: number | undefined) {
  if (s.dartsLeft > 0) {
    while (v.darts.length < 3) {
      v.darts.push({ dart: MISS, at: at ?? v.darts.at(-1)?.at ?? 0 });
      v.filled++;
    }
  }
  v.closed = true;
}

const mark = (t: Turns) => {
  const last = t.visits.at(-1);
  return `${t.visits.length}:${last?.darts.length ?? 0}:${last?.closed ?? true}`;
};

/** Removed from the match before visit `vi` (by now when it is left out). */
export const isGone = (t: Turns, p: number, vi = Infinity) => t.removed.some(r => r.player === p && r.at <= vi);

/** Visit `vi` was cut short by its thrower's removal: games with rounds leave it out of the round. */
export const cutShort = (t: Turns, vi: number) => t.removed.some(r => r.cut && r.at === vi + 1);

/** Players whose removal comes right before visit `vi`, for games that keep rounds. */
export const goneAt = (t: Turns, vi: number) => t.removed.filter(r => r.at === vi).map(r => r.player);

/** Who throws when no visit is open: next in the playing order after the last visit, skipping `out` and removed players. */
export function nextUp(t: Turns, out: (q: number) => boolean = () => false): number {
  const order = t.order ?? [0];
  const skip = (q: number) => out(q) || isGone(t, q);
  const last = t.visits.at(-1);
  if (last) return nextIn(last.player, order, skip);
  return skip(order[0]) ? nextIn(order[0], order, skip) : order[0];
}

export function replayTurns(events: TurnEvent[], players: number, bullOff: BullOff, play: (t: Turns) => Turn): Turns {
  const t: Turns = { order: bullOff === 'off' ? fromStarter(0, players) : null, visits: [], numbers: [], seed: 0, ended: false, bull: [], bullOff: null, players, removed: [] };
  for (const e of events) {
    if (e.t === 'numbers') {
      if (t.visits.length === 0) t.numbers = e.numbers;
      continue;
    }
    if (e.t === 'seed') {
      if (t.visits.length === 0) t.seed = e.seed;
      continue;
    }
    if (t.ended) {
      if (e.t === 'undo') t.ended = false;
      continue;
    }
    if (e.t === 'end') {
      t.ended = t.order !== null;
      continue;
    }
    if (t.order === null) {
      t.order = beforeStart(t.bull, e, players, bullOff);
      continue;
    }
    const last = t.visits.at(-1);
    const open = last && !last.closed ? last : null;
    const removal = t.removed.at(-1);
    if (e.t === 'undo' && removal?.mark === mark(t)) {
      t.removed.pop();
      if (removal.closed) reopenLast(t);
      continue;
    }
    switch (e.t) {
      case 'remove': {
        if (e.player < 0 || e.player >= players || isGone(t, e.player) || play(t).over) break;
        // Removed during their own visit: it ends with the darts thrown, no misses filled in.
        const closed = !!open && open.player === e.player;
        const cut = closed && play(t).dartsLeft > 0;
        if (closed) open.closed = true;
        t.removed.push({ player: e.player, scope: 'match', at: t.visits.length, closed, cut, mark: mark(t) });
        break;
      }
      case 'dart': {
        const s = play(t);
        if (s.over || s.dartsLeft === 0) break;
        const v = open ?? { player: s.current, darts: [], filled: 0, closed: false };
        if (!open) t.visits.push(v);
        v.darts.push({ dart: e.dart, coords: e.coords, at: e.at });
        break;
      }
      case 'fix':
        if (open && e.index >= 0 && e.index < open.darts.length) open.darts[e.index] = { dart: e.dart, at: open.darts[e.index].at };
        break;
      case 'undo':
        if (open) {
          open.darts.pop();
          if (open.darts.length === 0) t.visits.pop();
        } else if (last) reopenLast(t);
        else if (bullOff !== 'off') {
          undoStart(t.bull, players, bullOff);
          t.order = null;
        }
        break;
      case 'next': {
        const s = play(t);
        if (s.over) break;
        const v = open ?? { player: s.current, darts: [], filled: 0, closed: false };
        if (!open) t.visits.push(v);
        closeVisit(v, s, e.at);
        break;
      }
    }
  }
  t.bullOff = bullView(t.bull, players, bullOff);
  return t;
}

export interface Walked {
  good: boolean[];
  /** Darts that took effect: all of them, or up to the one that ended the visit. */
  used: number;
  /** No more darts go into this visit. */
  complete: boolean;
  dartsLeft: number;
}

/** Applies a visit's darts in order until one ends the visit; later darts (left over after a fix) do nothing. */
export function walk(v: Visit, apply: (d: Dart, i: number) => { good: boolean; end?: boolean }): Walked {
  const good: boolean[] = [];
  let used = -1;
  for (const rec of v.darts) {
    if (used >= 0) {
      good.push(false);
      continue;
    }
    const r = apply(rec.dart, good.length);
    good.push(r.good);
    if (r.end) used = good.length;
  }
  const ended = used >= 0;
  const complete = v.closed || ended || v.darts.length >= 3;
  return { good, used: ended ? used : v.darts.length, complete, dartsLeft: complete ? 0 : 3 - v.darts.length };
}

/**
 * Headline of visit vi from its visit-level Wyzwalacze, or null for a plain visit. Dart-level ones
 * (a life taken in Killer) are about other players, so they stay off the card.
 */
export function verdictOf(fx: Happening[], vi: number): Verdict | null {
  const mine = fx.filter(h => h.slot.startsWith(`V${vi + 1}:`)).map(h => h.fact);
  const game = (e: GameEvent) => mine.find(f => f.kind === 'game' && f.event === e);
  if (mine.some(f => f.kind === 'checkout')) return { text: 'Checkout', tone: 'good' };
  if (game('attemptFailed')) return { text: 'Life lost', tone: 'bad' };
  if (mine.some(f => f.kind === 'bust')) return { text: 'Bust', tone: 'bad' };
  if (game('eliminated')) return { text: 'Out', tone: 'bad' };
  if (game('shanghai')) return { text: 'Shanghai', tone: 'good' };
  const marks = game('marks');
  if (marks?.kind === 'game') return { text: marks.whiteHorse ? 'White Horse' : `${marks.marks} marks`, tone: 'good' };
  return null;
}

/** Builds the common part of a view: phase and the visit on screen. */
export function frame(t: Turns, s: Turn): Pick<MiniView, 'phase' | 'current' | 'visit' | 'bullOff' | 'order' | 'removed'> {
  const removed = Array.from({ length: t.players }, (_, p): Removed => (isGone(t, p) ? 'match' : null));
  if (t.order === null) return { phase: 'bulloff', current: 0, visit: { player: 0, darts: [], dartsLeft: 3, good: [], verdict: null }, bullOff: t.bullOff, order: null, removed };
  const last = t.visits.at(-1);
  const shown = last && (!last.closed || s.over) ? last : null;
  const verdict = shown && s.dartsLeft === 0 ? verdictOf(s.fx, t.visits.length - 1) : null;
  return {
    removed,
    bullOff: t.bullOff,
    order: t.order,
    phase: s.over ? 'matchWon' : 'throwing',
    current: s.current,
    visit: { player: s.current, darts: shown?.darts ?? [], dartsLeft: s.over ? 0 : s.dartsLeft, good: shown ? s.goods.at(-1) ?? [] : [], verdict },
  };
}

/** Every Wyzwalacz occurrence so far: the start and the thrown darts from the log, the rest from the game. */
export function turnHappenings(t: Turns, s: Turn): Happening[] {
  if (t.order === null) return [];
  const darts = t.visits.flatMap((v, vi) => v.darts.slice(0, v.darts.length - v.filled)
    .map((d, di): Happening => ({ slot: `V${vi + 1}D${di + 1}`, fact: { kind: 'dart', dart: d.dart } })));
  return [{ slot: 'L1:start', fact: { kind: 'legStart' } }, ...darts, ...s.fx];
}

/** Slot of a game event on a dart: visit and dart numbers from 1. */
export const dartSlot = (vi: number, di: number, what: string) => `V${vi + 1}D${di + 1}:${what}`;

/** Compacts the log to one stored leg; `scored` holds the darts that counted. */
export function compactTurns(t: Turns, s: Turn, players: number, winner: number | null): LegRecord[] {
  if (t.order === null) return [];
  const counter = Array(players).fill(0);
  const visits = t.visits
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v.darts.length > 0)
    .map(({ v, i }) => ({
      player: v.player,
      visitNo: ++counter[v.player],
      start: 0,
      scored: (s.goods[i] ?? []).filter(Boolean).length,
      bust: false,
      checkout: false,
      dartsCount: v.darts.length,
      darts: v.darts,
    }));
  return visits.length ? [{ set: 1, legNo: 1, starter: t.order[0], winner, visits }] : [];
}

/** Next player in the playing order after `p`, skipping those for whom `out` is true. */
export function nextIn(p: number, order: number[], out: (q: number) => boolean = () => false): number {
  const i = order.indexOf(p);
  for (let k = 1; k <= order.length; k++) {
    const q = order[(i + k) % order.length];
    if (!out(q)) return q;
  }
  return p;
}

/** The playing order starting `k` places further on: a round that starts one player later each time. */
export const rotate = (order: number[], k: number) => order.map((_, i) => order[(i + k) % order.length]);

// ---------- game modules ----------

export type GameId = 'x01' | 'atc' | 'fullboard' | '121' | 'cricket' | 'killer' | 'hol' | 'randomco' | 'shanghai' | 'gotcha' | 'knockout' | 'football' | 'bullseye';

/** The setup and /stats tiles come in these groups, in this order (docs/GRY.md, Setup na Pilocie). */
export type GameGroup = 'classic' | 'practice' | 'versus';

/** One setup option. The same text feeds the “i” hint and the Options part of “How to play”. */
export interface OptionDef<O> {
  key?: keyof O & string;
  label: string;
  info: string;
  choices: [unknown, string][];
  /** Shown in setup only when this holds. */
  when?: (o: O, players: number) => boolean;
}

export interface HowTo {
  goal: string;
  turn: string;
  counts: string;
  win: string;
}

export interface RecordDef<O> {
  /** The variant a match counts for, or null when it keeps no record. */
  variant: (o: O, players: number) => { key: string; label: string } | null;
  better: 'lower' | 'higher';
  format: (v: number) => string;
}

export interface GameModule<O = any, V = any> {
  id: GameId;
  name: string;
  blurb: string;
  group: GameGroup;
  minPlayers: number;
  defaults: O;
  options: OptionDef<O>[];
  howTo: HowTo;
  record?: RecordDef<O>;
  /** Games won per player, saved as legs_won; `show` says whether lists display it as the score. */
  points?: { of: (view: V) => number[]; show: (o: O) => boolean };
  normalizeOptions: (input: unknown) => O;
  describe: (o: O, players: number) => string;
  view: (events: any[], players: number, o: O) => V;
  compact: (events: any[], players: number, o: O) => LegRecord[];
  happenings: (events: any[], players: number, o: O) => Happening[];
  isValidEvent: (e: any) => boolean;
}

export const BULL_OFF: OptionDef<{ bullOff: BullOff }> = {
  key: 'bullOff',
  label: 'Bull-off',
  info: 'Who throws first: one dart each at the bull, closest starts. Off means the order above.',
  choices: [['off', 'Off'], ['closest', 'Closest'], ['pdc', 'PDC rules']],
  when: (_o, players) => players >= 2,
};

/** Keeps every keyed option that is one of its choices; anything else falls back to the default. */
export function normalizeByDefs<O>(defs: OptionDef<O>[], defaults: O, input: unknown): O {
  const raw = (input ?? {}) as Record<string, unknown>;
  const o = { ...defaults } as Record<string, unknown>;
  for (const d of defs) if (d.key && d.choices.some(([v]) => v === raw[d.key!])) o[d.key] = raw[d.key];
  return o as O;
}

export const choiceLabel = <O>(defs: OptionDef<O>[], o: O, key: keyof O & string) =>
  defs.find(d => d.key === key)?.choices.find(([v]) => v === o[key])?.[1] ?? '';

export const ON_OFF: [unknown, string][] = [[true, 'On'], [false, 'Off']];
export const OFF_ON: [unknown, string][] = [[false, 'Off'], [true, 'On']];

/** Deterministic random numbers in [0, 1) from a logged seed (mulberry32), so every replay draws the same. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh seed for the log. */
export const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export const livesLabel = (n: number) => `${n} ${n === 1 ? 'life' : 'lives'}`;

/**
 * Hit or Miss for a new dart (docs/EFEKTY.md, Wbudowane dźwięki), fired by the hub as the Next player, Hit and Miss
 * rules. `before` is how many darts the visit had. ATC, Full Board and Cricket judge every dart; Higher or Lower judges
 * the visit once it is decided. Other games have neither.
 */
export function dartCue(game: GameId, view: { phase: string; visit?: MiniView['visit'] }, before: number): 'hit' | 'miss' | null {
  const v = view.visit;
  if (game === 'x01' || view.phase === 'bulloff' || !v || v.darts.length !== before + 1) return null;
  if (game === 'atc' || game === 'fullboard' || game === 'cricket' || game === 'shanghai') return v.good.at(-1) ? 'hit' : 'miss';
  if (game === 'hol' && v.dartsLeft === 0) return v.verdict?.tone === 'bad' ? 'miss' : 'hit';
  return null;
}

/**
 * Why the Pilot cannot remove player `p` now, or null when he can (docs/UI.md#wycofanie-gracza): not in the bull-off,
 * not once the game is over, and not when fewer than two would be left in the match or the leg. Players out of lives
 * in Killer and Knockout are no longer in it either.
 */
export function removeBlock(
  game: GameId,
  v: { phase: string; removed: Removed[]; rows?: { out: boolean }[] },
  p: number,
  scope: 'match' | 'leg',
): string | null {
  if (scope === 'leg' && game !== 'x01') return 'Only X01 has legs';
  if (v.phase === 'bulloff') return 'Not during the bull-off';
  if (v.phase === 'matchWon' || (v.phase !== 'throwing' && scope === 'leg')) return 'This game is over';
  if (v.removed[p] === undefined) return 'Unknown player';
  if (v.removed[p] === 'match' || (v.removed[p] === 'leg' && scope === 'leg')) return 'This player is already out';
  const after = v.removed.map((r, i) => (i === p ? scope : r));
  const lost = (i: number) => (game === 'killer' || game === 'knockout') && !!v.rows?.[i].out;
  const inMatch = after.filter((r, i) => r !== 'match' && !lost(i)).length;
  const inLeg = after.filter((r, i) => r === null && !lost(i)).length;
  return Math.min(inMatch, inLeg) < 2 ? 'Fewer than two players would be left: use End match' : null;
}
