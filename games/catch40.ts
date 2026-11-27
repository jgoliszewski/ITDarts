// Catch 40: check out 61 to 100 in two visits each, the faster the more points (docs/GRY.md). 1-8 players on their own targets. Pure, no I/O.
import { attemptVisit } from './attempt.ts';
import type { Happening } from './effects.ts';
import { hintLines } from './x01/checkout.ts';
import type { BullOff } from './x01/rules.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent } from './turns.ts';
import type { Turns } from './turns.ts';
import { BULL_OFF, compactTurns, cutShort, frame, isGone, isValidTurnEvent, nextUp, normalizeByDefs, plural, replayTurns, turnHappenings } from './turns.ts';

export interface Catch40Options {
  bullOff: BullOff;
}

export const FIRST_TARGET = 61;
export const TARGETS = 40;
/** Visits per target. */
const VISITS = 2;
const MAX_POINTS = 3;

/** 3 points for a checkout in 2 darts, 2 for 3 darts, 1 for 4 to 6. */
export const checkoutPoints = (darts: number) => (darts <= 2 ? 3 : darts === 3 ? 2 : 1);

interface State extends Turn {
  /** Targets played per player (TARGETS when done). */
  progress: number[];
  remaining: number[];
  points: number[];
  darts: number[];
  attempts: number[];
  checkouts: number[];
  checkoutDarts: number[];
  /** Darts left in the current attempt, per player. */
  attemptLeft: number[];
  winners: number[];
  ended: boolean;
  /** Points scored so far in the open visit. */
  scored: number;
  /** Points the last visit's checkout gave, 0 without one. */
  gain: number;
  /** The visit of the attempt each player is on, 1 or 2. */
  visitNo: number[];
  /** The visit just completed, still open until the takeout: what the screen keeps until then. */
  held: { player: number; progress: number; remaining: number; attemptLeft: number; visitNo: number } | null;
}

function play(t: Turns, players: number): State {
  const zero = () => Array<number>(players).fill(0);
  const progress = zero(), points = zero(), darts = zero(), attempts = zero(), checkouts = zero(), checkoutDarts = zero();
  const visitsDone = zero(), attemptDarts = zero();
  const remaining = Array<number>(players).fill(FIRST_TARGET);
  const goods: boolean[][] = [];
  const fx: Happening[] = [];
  let left = 3, visitFrom = FIRST_TARGET, gain = 0;
  let held: State['held'] = null;
  for (const [vi, v] of t.visits.entries()) {
    const p = v.player;
    if (progress[p] >= TARGETS) {
      goods.push([]);
      continue;
    }
    visitFrom = remaining[p];
    gain = 0;
    const lastVisit = visitsDone[p] + 1 >= VISITS;
    const { w, bust, out, remaining: after } = attemptVisit(v, remaining[p], lastVisit);
    remaining[p] = after;
    goods.push(w.good);
    left = w.dartsLeft;
    darts[p] += w.used;
    if (!w.complete || cutShort(t, vi)) continue;
    // A visit that busts counts as 3 darts of the attempt, like one closed by the takeout, so busting never pays (docs/GRY.md#catch-40).
    attemptDarts[p] += bust ? 3 : w.used;
    const V = `V${vi + 1}`;
    if (bust) fx.push({ slot: `${V}:bust`, fact: { kind: 'bust' } });
    else fx.push({ slot: `${V}:total`, fact: { kind: 'calledTotal', total: visitFrom - after } });
    if (out) fx.push({ slot: `${V}:checkout`, fact: { kind: 'checkout' } });
    else if (lastVisit) fx.push({ slot: `${V}:failed`, fact: { kind: 'game', event: 'attemptFailed' } });
    held = v.closed ? null : { player: p, progress: progress[p], remaining: after, attemptLeft: out ? 0 : (VISITS - visitsDone[p] - 1) * 3, visitNo: visitsDone[p] + 1 };
    visitsDone[p]++;
    if (!out && !lastVisit) continue;
    attempts[p]++;
    if (out) {
      checkouts[p]++;
      checkoutDarts[p] += attemptDarts[p];
      gain = checkoutPoints(attemptDarts[p]);
      points[p] += gain;
    }
    progress[p]++;
    remaining[p] = FIRST_TARGET + progress[p];
    visitsDone[p] = attemptDarts[p] = 0;
  }
  const everyone = Array.from({ length: players }, (_, p) => p);
  const ranked = everyone.filter(p => !isGone(t, p));
  const over = t.ended || ranked.every(p => progress[p] >= TARGETS);
  let winners: number[] = [];
  if (over) {
    const best = Math.max(...ranked.map(p => points[p]));
    // Most points, then fewer darts; still level: all share the win. No points at all, no winner.
    const tied = best > 0 ? ranked.filter(p => points[p] === best) : [];
    const fewest = Math.min(...tied.map(p => darts[p]));
    winners = tied.filter(p => darts[p] === fewest);
    if (winners.length > 0) fx.push({ slot: 'match:won', fact: { kind: 'matchWon' } });
  }
  const last = t.visits.at(-1);
  const open = last && !last.closed ? last : null;
  const current = open ? open.player : nextUp(t, q => progress[q] >= TARGETS);
  const usedNow = open && left > 0 ? open.darts.length : 0;
  const attemptLeft = visitsDone.map((n, p) => (VISITS - n) * 3 - (open?.player === p ? usedNow : 0));
  return {
    over, current, dartsLeft: over ? 0 : open ? left : 3, goods, fx,
    progress, remaining, points, darts, attempts, checkouts, checkoutDarts, attemptLeft, winners, ended: t.ended,
    scored: open && left > 0 ? visitFrom - remaining[open.player] : 0,
    gain, visitNo: visitsDone.map(n => n + 1),
    held: held && !over ? held : null,
  };
}

export interface Catch40View extends MiniView {
  target: number;
  remaining: number;
  /** Darts left in the current attempt. */
  attemptLeft: number;
  /** Darts in a whole attempt. */
  attemptDarts: number;
  points: number[];
  /** Targets played per player, of TARGETS. */
  progress: number[];
  checkout: string | null;
  setup: string | null;
}

function view(events: TurnEvent[], players: number, o: Catch40Options): Catch40View {
  const t = replayTurns(events, players, o.bullOff, x => play(x, players));
  const s = play(t, players);
  const f = frame(t, s);
  // The verdict of a failed attempt says so, not "Life lost"; a checkout shows the points it gave.
  if (f.visit.verdict?.text === 'Life lost') f.visit.verdict = { text: 'Attempt failed', tone: 'bad' };
  if (f.visit.verdict?.text === 'Checkout') f.visit.verdict = { text: `+${s.gain}`, tone: 'good' };
  const c = f.current;
  const shown = s.held ?? { player: c, progress: s.progress[c], remaining: s.remaining[c], attemptLeft: s.attemptLeft[c], visitNo: s.visitNo[c] };
  const done = shown.progress >= TARGETS;
  const hints = done || f.visit.dartsLeft === 0
    ? { checkout: null, setup: null }
    : hintLines(shown.remaining, f.visit.dartsLeft, 'double', s.scored, f.visit.darts.map(d => d.dart));
  // A setup on the attempt's last visit leads nowhere: the next target starts over.
  if (shown.attemptLeft <= f.visit.dartsLeft) hints.setup = null;
  return {
    ...f,
    winners: s.winners,
    hero: {
      big: done ? '-' : String(shown.remaining),
      caption: done ? 'Finished' : `Target ${FIRST_TARGET + shown.progress}`,
      note: done ? `All ${TARGETS} targets done` : `Visit ${shown.visitNo} of ${VISITS}`,
    },
    rows: s.points.map((pts, i) => {
      // The player whose finished visit is still on screen keeps the target he just played.
      const at = s.held?.player === i ? s.held.progress : s.progress[i];
      return { value: String(pts), meta: at >= TARGETS ? 'Finished' : `Target ${FIRST_TARGET + at}`, out: false };
    }),
    result: !s.over ? '' : s.winners.length === 0 ? 'No points scored' : s.winners.length > 1 ? `Shared win · ${plural(s.points[s.winners[0]], 'point')}` : plural(s.points[s.winners[0]], 'point'),
    // Only a game played through all the targets counts for the record.
    scores: s.points.map(pts => (s.over && !s.ended ? pts : null)),
    stats: s.points.map((pts, i) => ({ points: pts, attempts: s.attempts[i], checkouts: s.checkouts[i], checkoutDarts: s.checkoutDarts[i] })),
    target: FIRST_TARGET + shown.progress,
    remaining: shown.remaining,
    attemptLeft: shown.attemptLeft,
    attemptDarts: VISITS * 3,
    points: s.points,
    progress: s.progress,
    ...hints,
  };
}

const OPTIONS: OptionDef<Catch40Options>[] = [BULL_OFF as OptionDef<Catch40Options>];
const DEFAULTS: Catch40Options = { bullOff: 'off' };

export const catch40: GameModule<Catch40Options, Catch40View> = {
  id: 'catch40',
  name: 'Catch 40',
  blurb: 'Check out 61 to 100, fast. Points for speed.',
  group: 'practice',
  minPlayers: 1,
  defaults: DEFAULTS,
  options: OPTIONS,
  howTo: {
    goal: 'Check out every target from 61 to 100, 40 in all, with as few darts as you can.',
    turn: 'Each target gets 2 visits. Win or lose, you then move on to the next target. With more players you take turns, each on your own target.',
    counts: 'Like X01 with double out. A bust puts the score back to where the visit started. Checkout in 2 darts is 3 points, in 3 darts 2 points, in 4 to 6 darts 1 point, no checkout 0.',
    win: 'The game ends when everyone has played all 40 targets. Most points wins, then fewer darts; still level, you share the win.',
  },
  record: {
    variant: () => ({ key: 'catch40', label: 'Catch 40' }),
    better: 'higher',
    format: v => plural(v, 'point'),
    // Every target left can still give the maximum.
    bound: (v, p) => v.points[p] + MAX_POINTS * (TARGETS - v.progress[p]),
  },
  normalizeOptions: input => normalizeByDefs(OPTIONS, DEFAULTS, input),
  describe: () => 'Catch 40',
  view,
  compact: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => play(x, players));
    const s = play(t, players);
    return compactTurns(t, s, players, s.winners.length === 1 ? s.winners[0] : null);
  },
  happenings: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => play(x, players));
    return turnHappenings(t, play(t, players));
  },
  isValidEvent: isValidTurnEvent,
};
