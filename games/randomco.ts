// Random Checkouts: check out numbers drawn from a range, one after another, until the match is ended (docs/GRY.md). Pure, no I/O.
import { callerLines121 } from './121.ts';
import type { Dart } from './darts.ts';
import { value } from './darts.ts';
import type { Change, Happening } from './effects.ts';
import type { BullOff, CheckOut } from './x01/rules.ts';
import { finishesLeg, scoreDart } from './x01/rules.ts';
import { hint, hintLines } from './x01/checkout.ts';
import { X01_OPTIONS } from './x01/index.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns } from './turns.ts';
import {
  BULL_OFF, OFF_ON, ON_OFF, choiceLabel, compactTurns, frame, isGone, isValidTurnEvent, nextUp, normalizeByDefs, plural, replayTurns, seeded, turnHappenings, walk,
} from './turns.ts';

export interface RcOptions {
  min: number;
  max: number;
  checkOut: CheckOut;
  hints: boolean;
  coop: boolean;
  bullOff: BullOff;
}

export const lowestNumber = (rule: CheckOut) => (rule === 'double' ? 2 : 1);
export const highestNumber = (rule: CheckOut) => (rule === 'double' ? 170 : 180);

const DARTS: Dart[] = [
  { n: 0, m: 1 },
  ...Array.from({ length: 20 }, (_, i) => [1, 2, 3].map(m => ({ n: i + 1, m }) as Dart)).flat(),
  { n: 25, m: 1 }, { n: 25, m: 2 },
];
const finishable = new Map<CheckOut, Set<number>>();

/** Can three darts check out n under the rule? Never true for e.g. 169, 168, 166 at double out. */
export function canCheckOut(n: number, rule: CheckOut): boolean {
  let set = finishable.get(rule);
  if (!set) {
    set = new Set();
    for (const last of DARTS) {
      if (!finishesLeg(last, rule)) continue;
      for (const a of DARTS) for (const b of DARTS) set.add(value(last) + value(a) + value(b));
    }
    finishable.set(rule, set);
  }
  return set.has(n);
}

/** The numbers a match can draw: the range without those nobody can check out. */
export const numbersIn = (o: Pick<RcOptions, 'min' | 'max' | 'checkOut'>) =>
  Array.from({ length: o.max - o.min + 1 }, (_, i) => o.min + i).filter(n => canCheckOut(n, o.checkOut));

/** Range presets in setup; Any is the whole range for the check-out rule. */
export const RANGE_PRESETS: [string, number, number][] = [['2–40', 2, 40], ['41–80', 41, 80], ['81–120', 81, 120], ['121–170', 121, 170], ['Any', 0, Infinity]];

export const rangeLabel = (o: Pick<RcOptions, 'min' | 'max' | 'checkOut'>) =>
  o.min === lowestNumber(o.checkOut) && o.max === highestNumber(o.checkOut) ? 'Any' : `${o.min}–${o.max}`;

interface Shown {
  number: number;
  left: number[];
}

interface State extends Turn, Shown {
  points: number[];
  /** Per player: darts thrown at the numbers they checked out, and checkouts in their first visit at the number. */
  checkoutDarts: number[];
  firstVisit: number[];
  winners: number[];
  /** Points scored so far in the open visit. */
  scored: number;
}

function play(t: Turns, players: number, o: RcOptions): State {
  const coop = o.coop && players > 1;
  const rule = { checkIn: 'straight', checkOut: o.checkOut } as const;
  const pool = numbersIn(o);
  const random = seeded(t.seed);
  const draw = () => pool[Math.floor(random() * pool.length)];
  // In co-op everyone plays the one shared remaining score at index 0.
  const side = (p: number) => (coop ? 0 : p);
  let number = draw(), left = 3, visitStart = number;
  const rest: number[] = Array(players).fill(number);
  const zero = () => Array(players).fill(0);
  const points = zero(), checkoutDarts = zero(), firstVisit = zero();
  let dartsAt = zero(), visitsAt = zero();
  const goods: boolean[][] = [];
  const fx: Happening[] = [];
  /** What the screen keeps until the takeout, while the finished visit is still open. */
  let held: Shown | null = null;
  /** Who checked out in the last visit: in a rivalry they throw first at the new number. */
  let closer: number | null = null;
  for (const [vi, v] of t.visits.entries()) {
    const p = v.player, k = side(p);
    const start = (visitStart = rest[k]);
    let bust = false, out = false;
    const w = walk(v, d => {
      const r = scoreDart(rest[k], true, d, rule);
      if (r.bust) {
        bust = true;
        return { good: false, end: true };
      }
      rest[k] -= r.scored;
      out = r.checkout;
      return { good: r.scored > 0, end: r.checkout };
    });
    if (bust) rest[k] = start;
    goods.push(w.good);
    left = w.dartsLeft;
    dartsAt[p] += w.used;
    if (!w.complete) continue;
    const V = `V${vi + 1}`;
    if (bust) fx.push({ slot: `${V}:bust`, fact: { kind: 'bust' } });
    else fx.push({ slot: `${V}:total`, fact: { kind: 'calledTotal', total: start - rest[k] } });
    if (out) fx.push({ slot: `${V}:checkout`, fact: { kind: 'checkout' } });
    if (!v.closed) held = { number, left: [...rest] };
    // Visits at the number count per side: in co-op the team's first visit is the first visit.
    visitsAt[k]++;
    closer = out && !coop ? p : null;
    if (out) {
      points[p]++;
      checkoutDarts[p] += dartsAt[p];
      if (visitsAt[k] === 1) firstVisit[p]++;
      // A new number for everyone; the closer throws first (co-op: the next player).
      number = draw();
      rest.fill(number);
      dartsAt = zero();
      visitsAt = zero();
    }
  }
  const over = t.ended;
  let winners: number[] = [];
  if (over) {
    const best = Math.max(...points.filter((_, i) => !isGone(t, i)));
    // No fanfare for a game ended without a single checkout.
    if (best > 0) fx.push({ slot: 'match:won', fact: { kind: 'matchWon' } });
    if (!coop && best > 0) winners = points.flatMap((x, i) => (x === best && !isGone(t, i) ? [i] : []));
  }
  const last = t.visits.at(-1);
  const open = last && !last.closed ? last : null;
  const current = open ? open.player : closer !== null && !isGone(t, closer) ? closer : nextUp(t);
  const shown = held ?? { number, left: [...rest] };
  return {
    over, current, dartsLeft: over ? 0 : open ? left : 3, goods, fx,
    ...shown,
    left: coop ? shown.left.map(() => shown.left[0]) : shown.left,
    points, checkoutDarts, firstVisit, winners,
    scored: open && left > 0 ? visitStart - rest[side(open.player)] : 0,
  };
}

export interface RcView extends MiniView {
  number: number;
  /** What the player on turn still needs. */
  remaining: number;
  /** Remaining score per player; in co-op the shared one, repeated. */
  left: number[];
  points: number[];
  checkout: string | null;
  setup: string | null;
  /** A checkout is on with the darts left in the visit, hints or not (for “you require”). */
  reach: boolean;
  coop: boolean;
}

function view(events: TurnEvent[], players: number, o: RcOptions): RcView {
  const coop = o.coop && players > 1;
  const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
  const s = play(t, players, o);
  const f = frame(t, s);
  const remaining = s.left[f.current];
  const thrown = f.visit.darts.map(d => d.dart);
  const hints = o.hints && f.visit.dartsLeft > 0 ? hintLines(remaining, f.visit.dartsLeft, o.checkOut, s.scored, thrown) : { checkout: null, setup: null };
  const total = s.points.reduce((a, b) => a + b, 0);
  const best = Math.max(...s.points);
  const result = coop ? `${plural(total, 'checkout')} together`
    : s.winners.length > 1 ? `Shared win · ${plural(best, 'checkout')}`
    : s.winners.length === 1 ? `Won with ${plural(best, 'checkout')}` : 'No checkouts';
  return {
    ...f,
    winners: s.winners,
    hero: { big: String(remaining), caption: `Number ${s.number}`, note: '' },
    rows: s.points.map((x, i) => ({ value: String(x), meta: coop ? plural(x, 'checkout') : `${s.left[i]} left`, out: false })),
    result,
    scores: s.points.map(() => null),
    stats: s.points.map((x, i) => ({ checkouts: x, checkoutDarts: s.checkoutDarts[i], firstVisit: s.firstVisit[i] })),
    number: s.number,
    remaining,
    left: s.left,
    points: s.points,
    ...hints,
    reach: f.visit.dartsLeft > 0 && !!hint(remaining, f.visit.dartsLeft, o.checkOut, s.scored, thrown)?.finish,
    coop,
  };
}

/** The caller as in 121, with “you require” whenever a checkout is on, hints or not. */
export const callerLinesRc = (cs: Change[], v: RcView, turnStart: boolean) => callerLines121(cs, v, turnStart, v.reach);

const OPTIONS: OptionDef<RcOptions>[] = [
  {
    label: 'Range',
    info: 'Numbers are drawn between Min and Max. Numbers no three darts can check out are never drawn.',
    choices: RANGE_PRESETS.map(([l]) => [l, l]),
  },
  X01_OPTIONS.find(d => d.key === 'checkOut') as unknown as OptionDef<RcOptions>,
  {
    key: 'hints',
    label: 'Hints',
    info: 'Shows the checkout route from X01 on the screen.',
    choices: ON_OFF,
  },
  {
    key: 'coop',
    label: 'Co-op',
    info: 'Everyone throws in turn at one shared score. A checkout counts for whoever hits it and for the team.',
    choices: OFF_ON,
    when: (_o, players) => players >= 2,
  },
  BULL_OFF as OptionDef<RcOptions>,
];

const DEFAULTS: RcOptions = { min: 41, max: 80, checkOut: 'double', hints: true, coop: false, bullOff: 'off' };

export function normalizeOptions(input: unknown): RcOptions {
  const o = normalizeByDefs(OPTIONS, DEFAULTS, input);
  const raw = (input ?? {}) as Record<string, unknown>;
  const lo = lowestNumber(o.checkOut), hi = highestNumber(o.checkOut);
  const fit = (v: unknown, d: number) => Math.min(hi, Math.max(lo, Number.isInteger(v) ? (v as number) : d));
  o.min = fit(raw.min, DEFAULTS.min);
  o.max = Math.max(o.min, fit(raw.max, DEFAULTS.max));
  // A range nobody can check out (169 at double out) reaches down to the nearest number that works, or up when
  // nothing below does (1 at master out). The top of every rule can be checked out, so this ends.
  while (numbersIn(o).length === 0) {
    if (o.min > lo) o.min--;
    else o.max++;
  }
  return o;
}

export const describeRc = (o: RcOptions, players: number) =>
  ['Random Checkouts', rangeLabel(o), `${choiceLabel(OPTIONS, o, 'checkOut')} out`, ...(o.coop && players > 1 ? ['Co-op'] : [])].join(' · ');

export const randomCheckouts: GameModule<RcOptions, RcView> = {
  id: 'randomco',
  name: 'Random Checkouts',
  blurb: 'Check out random numbers. Most checkouts wins.',
  group: 'practice',
  minPlayers: 1,
  defaults: DEFAULTS,
  options: OPTIONS,
  howTo: {
    goal: 'Check out numbers drawn at random from the range. Each checkout is a point.',
    turn: 'Everyone gets the same number and plays it down from their own score, one visit each in turn. In Co-op you share one score and take turns.',
    counts: 'Like X01 with the chosen check-out. A bust puts your score back to where the visit started. There is no limit on darts.',
    win: 'The first to check out gets the point at once, then everyone gets a new number and the closer throws first. The game has no end: End match and Save, and the most points wins. Equal points share the win.',
  },
  normalizeOptions,
  describe: describeRc,
  view,
  compact: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
    const s = play(t, players, o);
    return compactTurns(t, s, players, s.winners.length === 1 ? s.winners[0] : null);
  },
  happenings: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
    return turnHappenings(t, play(t, players, o));
  },
  isValidEvent: isValidTurnEvent,
};
