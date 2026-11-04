// 121: check out a target within a few visits, then the next one up (docs/GRY.md). Solo or co-op. Pure, no I/O.
import { hint, hintLines } from './x01/checkout.ts';
import type { Change, Happening } from './effects.ts';
import type { BullOff } from './x01/rules.ts';
import { scoreDart } from './x01/rules.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns } from './turns.ts';
import { BULL_OFF, ON_OFF, compactTurns, frame, isValidTurnEvent, nextUp, normalizeByDefs, plural, replayTurns, turnHappenings, walk } from './turns.ts';

export interface O121 {
  visits: 3 | 4;
  refill: boolean;
  bullOff: BullOff;
}

export const START_TARGET = 121;
export const LIVES = 3;

interface State extends Turn {
  target: number;
  remaining: number;
  lives: number;
  /** Darts left in the current attempt. */
  attemptLeft: number;
  best: number | null;
  attempts: number[];
  checkouts: number[];
  /** Points scored so far in the open visit. */
  scored: number;
}

const RULE = { checkIn: 'straight', checkOut: 'double' } as const;

function play(t: Turns, players: number, o: O121): State {
  let target = START_TARGET, remaining = target, lives = LIVES, used = 0, best: number | null = null;
  let over = false, left = 3, visitStart = remaining;
  const attempts = Array(players).fill(0), checkouts = Array(players).fill(0);
  /** In Co-op an attempt and its checkout count for everyone who threw in it. */
  const inAttempt = new Set<number>();
  const endAttempt = (out: boolean) => {
    for (const p of inAttempt) {
      attempts[p]++;
      if (out) checkouts[p]++;
    }
    inAttempt.clear();
  };
  const goods: boolean[][] = [];
  const fx: Happening[] = [];
  /** What the screen keeps until the takeout, while the finished visit is still open. */
  let held: Pick<State, 'target' | 'remaining' | 'lives' | 'attemptLeft'> | null = null;
  for (const [vi, v] of t.visits.entries()) {
    const start = (visitStart = remaining);
    let bust = false, out = false;
    const lastVisit = used + 1 >= o.visits;
    const w = walk(v, (d, i) => {
      if (over) return { good: false, end: true };
      const r = scoreDart(remaining, true, d, RULE);
      if (r.bust) {
        bust = true;
        return { good: false, end: true };
      }
      remaining -= r.scored;
      if (r.checkout) out = true;
      // On the attempt's last visit, stop once the darts left can't check out (e.g. one dart on an odd score).
      const hopeless = lastVisit && !r.checkout && i < 2 && !hint(remaining, 2 - i, 'double')?.finish;
      return { good: r.scored > 0, end: r.checkout || hopeless };
    });
    if (bust) remaining = start;
    goods.push(w.good);
    left = w.dartsLeft;
    if (!w.complete || over) continue;
    inAttempt.add(v.player);
    const V = `V${vi + 1}`;
    if (bust) fx.push({ slot: `${V}:bust`, fact: { kind: 'bust' } });
    else fx.push({ slot: `${V}:total`, fact: { kind: 'calledTotal', total: start - remaining } });
    if (out) fx.push({ slot: `${V}:checkout`, fact: { kind: 'checkout' } });
    else if (lastVisit) fx.push({ slot: `${V}:failed`, fact: { kind: 'game', event: 'attemptFailed' } });
    if (!v.closed) held = { target, remaining, lives, attemptLeft: out ? 0 : (o.visits - used - 1) * 3 };
    if (out) {
      endAttempt(true);
      // The rest of the attempt's darts are gone; the next target starts with a fresh attempt.
      best = target;
      target++;
      if (o.refill) lives = LIVES;
      remaining = target;
      used = 0;
    } else if (++used >= o.visits) {
      endAttempt(false);
      lives--;
      remaining = target;
      used = 0;
      if (lives === 0) over = true;
    }
  }
  const last = t.visits.at(-1);
  const open = last && !last.closed ? last : null;
  const current = open ? open.player : nextUp(t);
  const dartsLeft = over ? 0 : open ? left : 3;
  const usedNow = open && left > 0 ? open.darts.length : 0;
  const shown = held && !over ? held : { target, remaining, lives, attemptLeft: (o.visits - used) * 3 - usedNow };
  return { over, current, dartsLeft, goods, fx, ...shown, best, attempts, checkouts, scored: open && left > 0 ? visitStart - remaining : 0 };
}

export interface View121 extends MiniView {
  target: number;
  remaining: number;
  lives: number;
  attemptLeft: number;
  /** Darts in a whole attempt. */
  attemptDarts: number;
  checkout: string | null;
  setup: string | null;
  coop: boolean;
}

function view(events: TurnEvent[], players: number, o: O121): View121 {
  const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
  const s = play(t, players, o);
  const f = frame(t, s);
  const hints = f.visit.dartsLeft === 0 ? { checkout: null, setup: null } : hintLines(s.remaining, f.visit.dartsLeft, 'double', s.scored, f.visit.darts.map(d => d.dart));
  // A setup on the attempt's last visit leads nowhere: the target starts over.
  if (s.attemptLeft <= f.visit.dartsLeft) hints.setup = null;
  return {
    ...f,
    winners: [],
    hero: { big: String(s.remaining), caption: `Target ${s.target}`, note: '' },
    rows: s.checkouts.map((c, i) => ({ value: String(c), meta: `${plural(c, 'checkout')} · ${plural(s.attempts[i], 'attempt')}`, out: false })),
    result: s.best === null ? 'No target checked out' : `Highest target ${s.best}`,
    scores: s.checkouts.map(() => s.best),
    stats: s.checkouts.map((c, i) => ({ attempts: s.attempts[i], checkouts: c })),
    target: s.target,
    remaining: s.remaining,
    lives: s.lives,
    attemptLeft: s.attemptLeft,
    attemptDarts: o.visits * 3,
    ...hints,
    coop: players > 1,
  };
}

/**
 * The caller in 121 and Random Checkouts (docs/EFEKTY.md#caller): like X01, but a checkout is called as its score, with no
 * game shot. `reach`: a checkout is on, so a visit starts with “you require”.
 */
export function callerLines121(cs: Change[], view: Pick<View121, 'phase' | 'visit' | 'remaining' | 'checkout'>, turnStart: boolean, reach = view.checkout !== null): string[] {
  const out: string[] = [];
  if (cs.some(c => c.fact.kind === 'legStart' && !c.before)) out.push('gameon');
  for (const { fact } of cs) {
    if (fact.kind === 'calledTotal') out.push(fact.total > 0 ? String(fact.total) : 'busted');
    if (fact.kind === 'bust') out.push('busted');
  }
  if (turnStart && view.phase === 'throwing' && view.visit.darts.length === 0 && reach) {
    out.push(`require_${view.remaining}`);
  }
  return out;
}

const OPTIONS: OptionDef<O121>[] = [
  {
    key: 'visits',
    label: 'Visits per target',
    info: 'Visits you get to check out each target: 3 visits is 9 darts, 4 is 12.',
    choices: [[3, '3'], [4, '4']],
  },
  {
    key: 'refill',
    label: 'Refill lives on checkout',
    info: 'A checkout gives back all 3 lives. Off: 3 lives for the whole game.',
    choices: ON_OFF,
  },
  BULL_OFF as OptionDef<O121>,
];

const DEFAULTS: O121 = { visits: 3, refill: true, bullOff: 'off' };

export const oneTwentyOne: GameModule<O121, View121> = {
  id: '121',
  name: '121',
  blurb: 'Check out 121, then 122, and on. Solo or together.',
  group: 'practice',
  minPlayers: 1,
  defaults: DEFAULTS,
  options: OPTIONS,
  howTo: {
    goal: 'Check out 121 with a double, then 122, 123 and up. How high can you go?',
    turn: 'Each target gets 3 or 4 visits. With more players you play together: everyone throws a visit in turn at the same target.',
    counts: 'Like X01 with double out. A bust puts the score back to where the visit started, and the attempt goes on while darts are left.',
    win: 'Check out and the target goes up by one. Run out of darts and you lose a life on the same target. The game ends with the last life; your result is the highest target checked out.',
  },
  record: {
    variant: (o, players) => ({
      key: ['121', `v${o.visits}`, o.refill ? 'refill' : 'norefill', players > 1 ? 'coop' : 'solo'].join(':'),
      label: ['121', `${o.visits} visits`, o.refill ? 'Refill lives' : 'No refill', ...(players > 1 ? ['Co-op'] : [])].join(' · '),
    }),
    better: 'higher',
    format: v => `Target ${v}`,
  },
  normalizeOptions: input => normalizeByDefs(OPTIONS, DEFAULTS, input),
  describe: (o, players) => ['121', `${o.visits} visits`, o.refill ? 'Refill lives' : 'No refill', ...(players > 1 ? ['Co-op'] : [])].join(' · '),
  view,
  compact: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
    return compactTurns(t, play(t, players, o), players, null);
  },
  happenings: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
    return turnHappenings(t, play(t, players, o));
  },
  isValidEvent: isValidTurnEvent,
};
