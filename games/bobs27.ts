// Bob's 27: doubles practice. 21 rounds, D1 to D20 and then the bull, 27 points to start (docs/GRY.md#bobs-27). 1-8 players on their own. Pure, no I/O.
import type { Happening } from './effects.ts';
import type { BullOff } from './x01/rules.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns } from './turns.ts';
import { BULL_OFF, compactTurns, cutShort, frame, isGone, isValidTurnEvent, nextUp, normalizeByDefs, plural, replayTurns, signed, turnHappenings, walk } from './turns.ts';

export interface Bobs27Options {
  bullOff: BullOff;
}

export const START = 27;
/** D1 to D20, then the bull. */
export const ROUNDS = 21;

/** The sector of a round's target: its number, 25 in the bull round (only the bullseye counts). */
export const sectorOf = (round: number) => (round <= 20 ? round : 25);
/** What a hit on the round's double is worth, and what a visit with none costs. */
export const doubleValue = (round: number) => (round <= 20 ? 2 * round : 50);
export const roundName = (round: number) => (round <= 20 ? `D${round}` : 'Bull');
/** The most a round can still give: three darts on the double. */
const roundMax = (round: number) => 3 * doubleValue(round);

interface State extends Turn {
  points: number[];
  darts: number[];
  hits: number[];
  /** Rounds played to the end of the visit. */
  done: number[];
  /** Round the player went out in, 0 while in. */
  outAt: number[];
  /** Round on screen: the one of the visit still open, else the next one of the player up. */
  round: number;
  /** What the visit on screen changed: the hits' value, or the penalty. */
  delta: number;
  /** The visit on screen is complete and had no hit. */
  missed: boolean;
  winners: number[];
  ended: boolean;
}

function play(t: Turns, players: number): State {
  const zero = () => Array<number>(players).fill(0);
  const points = Array<number>(players).fill(START);
  const darts = zero(), hits = zero(), done = zero(), outAt = zero();
  const goods: boolean[][] = [];
  const fx: Happening[] = [];
  let left = 3, lastRound = 1, delta = 0, missed = false;

  for (const [vi, v] of t.visits.entries()) {
    const p = v.player, round = done[p] + 1;
    if (outAt[p] > 0 || round > ROUNDS) {
      goods.push([]);
      continue;
    }
    const sector = sectorOf(round), value = doubleValue(round);
    const w = walk(v, d => ({ good: d.n === sector && d.m === 2 }));
    const hit = w.good.filter(Boolean).length;
    goods.push(w.good);
    hits[p] += hit;
    darts[p] += w.used;
    points[p] += hit * value;
    left = w.dartsLeft;
    lastRound = round;
    delta = hit * value;
    missed = false;
    if (!w.complete || cutShort(t, vi)) continue;
    if (hit === 0) {
      points[p] -= value;
      delta = -value;
      missed = true;
    }
    done[p]++;
    if (points[p] <= 0) {
      outAt[p] = round;
      fx.push({ slot: `V${vi + 1}:out`, fact: { kind: 'game', event: 'eliminated' } });
    }
  }

  const everyone = Array.from({ length: players }, (_, p) => p);
  const ranked = everyone.filter(p => !isGone(t, p));
  const settled = (p: number) => outAt[p] > 0 || done[p] >= ROUNDS;
  const over = t.ended || ranked.every(settled);
  let winners: number[] = [];
  if (over) {
    // Those still in come first, the best score on top; with rivals and nobody in, the one who went out last.
    const alive = ranked.filter(p => outAt[p] === 0);
    if (alive.length > 0) {
      const best = Math.max(...alive.map(p => points[p]));
      winners = alive.filter(p => points[p] === best);
    } else if (players > 1) {
      const latest = Math.max(...ranked.map(p => outAt[p]));
      winners = ranked.filter(p => outAt[p] === latest);
    }
    if (winners.length > 0) fx.push({ slot: 'match:won', fact: { kind: 'matchWon' } });
  }

  const last = t.visits.at(-1);
  const open = last && !last.closed ? last : null;
  const current = open ? open.player : over && last ? last.player : nextUp(t, settled);
  const shown = !!last && (!!open || over);
  return {
    over, current, dartsLeft: over ? 0 : open ? left : 3, goods, fx,
    points, darts, hits, done, outAt,
    round: shown ? lastRound : Math.min(ROUNDS, done[current] + 1),
    delta: shown ? delta : 0,
    missed: shown && missed,
    winners,
    ended: t.ended,
  };
}

export interface Bobs27View extends MiniView {
  /** Round on screen and its target sector (25 in the bull round). */
  round: number;
  sector: number;
  points: number[];
  /** Rounds played per player. */
  done: number[];
  eliminated: boolean[];
  /** The round each player went out in, 0 while in. */
  outAt: number[];
  delta: number;
}

function view(events: TurnEvent[], players: number, o: Bobs27Options): Bobs27View {
  const t = replayTurns(events, players, o.bullOff, x => play(x, players));
  const s = play(t, players);
  const f = frame(t, s);
  const c = f.current;
  // A visit's headline: what it gave or cost; going out says so (the card adds the name).
  if (!f.visit.verdict && f.visit.darts.length > 0 && f.visit.dartsLeft === 0) f.visit.verdict = { text: signed(s.delta, true), tone: s.delta > 0 ? 'good' : 'bad' };
  const w = s.winners[0] ?? 0;
  const finished = (p: number) => s.outAt[p] === 0 && s.done[p] >= ROUNDS;
  return {
    ...f,
    winners: s.winners,
    hero: {
      big: signed(s.points[c]),
      caption: `Round ${s.round} / ${ROUNDS} · ${roundName(s.round)}`,
      note: s.missed ? `${signed(s.delta)} · missed visit` : s.delta > 0 ? `+${s.delta} this visit` : '',
    },
    rows: s.points.map((pts, i) => ({
      value: signed(pts),
      // The player up keeps the round of the visit on screen, like the hero.
      meta: s.outAt[i] ? `Out at ${roundName(s.outAt[i])}` : finished(i) ? 'Finished' : `Round ${i === c ? s.round : s.done[i] + 1} · ${roundName(i === c ? s.round : s.done[i] + 1)}`,
      out: s.outAt[i] > 0,
    })),
    result: !s.over ? '' : s.outAt[w] ? `Out at ${roundName(s.outAt[w])}` : plural(s.points[w], 'point'),
    // Only a game the player played through the bull round counts for the record.
    scores: s.points.map((pts, i) => (s.over && !s.ended && finished(i) ? pts : null)),
    stats: s.points.map((pts, i) => ({ darts: s.darts[i], hits: s.hits[i], score: s.outAt[i] ? 0 : pts, completed: finished(i) ? 1 : 0 })),
    round: s.round,
    sector: sectorOf(s.round),
    points: s.points,
    done: s.done,
    eliminated: s.outAt.map(r => r > 0),
    outAt: s.outAt,
    delta: s.delta,
  };
}

const OPTIONS: OptionDef<Bobs27Options>[] = [BULL_OFF as OptionDef<Bobs27Options>];
const DEFAULTS: Bobs27Options = { bullOff: 'off' };

export const bobs27: GameModule<Bobs27Options, Bobs27View> = {
  id: 'bobs27',
  name: "Bob's 27",
  blurb: 'Hit the double of the round. Miss the visit and lose it.',
  group: 'practice',
  minPlayers: 1,
  defaults: DEFAULTS,
  options: OPTIONS,
  howTo: {
    goal: 'Start on 27 points and play 21 rounds: D1 to D20, then the bull. Finish with as many points as you can.',
    turn: 'One visit of three darts per round, at the double of the round. With more players you take turns, each on your own round.',
    counts: 'Every dart in the double of the round adds its value (D5 adds 10, the bull round 50). A visit with no hit takes that value away once. In the bull round only the bullseye counts, not the outer bull.',
    win: 'A score of 0 or less after a visit puts you out. The game ends when everyone has played the bull round or is out. Those who finished rank by points, then those who went out, the later the better; ties share the win. Alone, finishing wins and going out ends the game.',
  },
  record: {
    variant: () => ({ key: 'bobs27', label: "Bob's 27" }),
    better: 'higher',
    format: v => plural(v, 'point'),
    // Three doubles in every round left, the darts of this one included; nothing once out.
    bound: (v, p) => {
      if (v.phase === 'matchWon') return v.scores[p] ?? 0;
      if (v.eliminated[p]) return 0;
      const mine = p === v.current && v.visit.dartsLeft > 0;
      // The visit of the player throwing is still open: only its darts left count, then the rounds after it.
      let max = v.points[p] + (mine ? v.visit.dartsLeft * doubleValue(v.done[p] + 1) : 0);
      for (let r = v.done[p] + (mine ? 2 : 1); r <= ROUNDS; r++) max += roundMax(r);
      return max;
    },
  },
  normalizeOptions: input => normalizeByDefs(OPTIONS, DEFAULTS, input),
  describe: () => "Bob's 27",
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
