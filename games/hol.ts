// Higher or Lower: throw a visit outside the forbidden range, which grows with every success (docs/GRY.md). Pure, no I/O.
import type { Dart } from './darts.ts';
import { value } from './darts.ts';
import type { Happening } from './effects.ts';
import type { BullOff } from './x01/rules.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns } from './turns.ts';
import { BULL_OFF, compactTurns, frame, isValidTurnEvent, normalizeByDefs, plural, replayTurns, rotate, turnHappenings, walk } from './turns.ts';

export interface HolOptions {
  firstTo: number;
  bullOff: BullOff;
}

export const START_RANGE = [26, 45] as const;

/** A dart's points here: T1 always counts as zero, so a visit can drop below the range's bottom (docs/GRY.md). */
export const holValue = (d: Dart) => (d.n === 1 && d.m === 3 ? 0 : value(d));

interface State extends Turn {
  lo: number;
  hi: number;
  /** Sum of the visit on screen, null before its first dart. */
  sum: number | null;
  points: number[];
  out: boolean[];
  game: number;
  lastGame: { no: number; winner: number } | null;
  winners: number[];
}

function play(t: Turns, players: number, o: HolOptions): State {
  const points = Array(players).fill(0);
  const goods: boolean[][] = [];
  const fx: Happening[] = [];
  let game = 0, lo: number = START_RANGE[0], hi: number = START_RANGE[1];
  let alive = Array(players).fill(true);
  let queue: number[] = [], pos = 0, failed = new Set<number>(), roundRange = [lo, hi];
  let over = false, left = 3, sum: number | null = null, lastGame: State['lastGame'] = null, winner: number | null = null;
  /** The range the screen keeps until the takeout, while the finished visit is still open. */
  let held: [number, number] | null = null;

  // A round: everyone still in throws once, in the playing order from this game's starter.
  const newRound = () => {
    queue = rotate(t.order!, game).filter(q => alive[q]);
    pos = 0;
    failed = new Set();
    roundRange = [lo, hi];
  };
  newRound();

  for (const [vi, v] of t.visits.entries()) {
    let miss = false, total = 0;
    const w = walk(v, d => {
      if (over) return { good: false, end: true };
      if (d.n === 0) {
        miss = true;
        return { good: false, end: true };
      }
      total += holValue(d);
      return { good: true };
    });
    goods.push(w.good);
    left = w.dartsLeft;
    sum = v.darts.length ? total : null;
    if (!w.complete || over) continue;
    if (!v.closed) held = [lo, hi];

    if (miss || (total >= lo && total <= hi)) {
      failed.add(v.player);
      fx.push({ slot: `V${vi + 1}:out`, fact: { kind: 'game', event: 'eliminated' } });
    } else if (total > hi) hi = total;
    else lo = total;
    if (++pos < queue.length) continue;

    // End of the round. If everyone left failed, the round does not count.
    const survivors = queue.filter(q => !failed.has(q));
    if (survivors.length === 0) [lo, hi] = roundRange;
    else alive = alive.map((_, q) => survivors.includes(q));
    if (survivors.length === 1) {
      const w = survivors[0];
      points[w]++;
      lastGame = { no: game + 1, winner: w };
      fx.push({ slot: `G${game + 1}:won`, fact: { kind: 'checkout' } });
      if (points[w] >= o.firstTo) {
        over = true;
        winner = w;
        fx.push({ slot: 'match:won', fact: { kind: 'matchWon' } });
        continue;
      }
      game++;
      fx.push({ slot: `G${game + 1}:start`, fact: { kind: 'legStart' } });
      [lo, hi] = START_RANGE;
      alive = Array(players).fill(true);
    }
    newRound();
  }

  const last = t.visits.at(-1);
  const open = last && !last.closed ? last : null;
  const out = alive.map((a, q) => !a || failed.has(q));
  return {
    over,
    current: open ? open.player : over ? last!.player : queue[pos],
    dartsLeft: over ? 0 : open ? left : 3,
    goods, fx, lo: held && !over ? held[0] : lo, hi: held && !over ? held[1] : hi, sum: open || over ? sum : null, points, out, game, lastGame, winners: winner === null ? [] : [winner],
  };
}

export interface HolView extends MiniView {
  lo: number;
  hi: number;
  sum: number | null;
  points: number[];
  game: number;
  lastGame: { no: number; winner: number } | null;
}

function view(events: TurnEvent[], players: number, o: HolOptions): HolView {
  const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
  const s = play(t, players, o);
  return {
    ...frame(t, s),
    winners: s.winners,
    hero: { big: String(s.sum ?? 0), caption: `Range ${s.lo}–${s.hi}`, note: `Above ${s.hi} or below ${s.lo}` },
    rows: s.points.map((p, i) => ({ value: String(p), meta: s.out[i] ? 'Out' : plural(p, 'point'), out: s.out[i] })),
    result: s.winners.length ? `Points ${[...s.points].sort((a, b) => b - a).join('–')}` : '',
    scores: s.points.map(() => null),
    stats: s.points.map(() => ({})),
    lo: s.lo,
    hi: s.hi,
    sum: s.sum,
    points: s.points,
    game: s.game + 1,
    lastGame: s.lastGame,
  };
}

const OPTIONS: OptionDef<HolOptions>[] = [
  {
    key: 'firstTo',
    label: 'First to',
    info: 'Games to win the match. Each game starts again from 26–45 with everyone in.',
    choices: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']],
  },
  BULL_OFF as OptionDef<HolOptions>,
];

const DEFAULTS: HolOptions = { firstTo: 1, bullOff: 'off' };

export const hol: GameModule<HolOptions, HolView> = {
  id: 'hol',
  name: 'Higher or Lower',
  blurb: 'Throw above or below the red range. It only grows.',
  group: 'versus',
  minPlayers: 2,
  defaults: DEFAULTS,
  options: OPTIONS,
  howTo: {
    goal: 'Stay in the game longest: every visit must land outside the forbidden range.',
    turn: 'Three darts per visit; what counts is their sum. The range starts at 26–45.',
    counts: 'Above the range moves its top up to your sum; below moves its bottom down. A sum equal to an edge is inside. T1 always counts as zero. Any dart outside the scoring area fails the visit.',
    win: 'A failed visit puts you out at once. If everyone still in fails in the same round, that round does not count. The last player in wins the game; first to the set number of games wins the match.',
  },
  normalizeOptions: input => normalizeByDefs(OPTIONS, DEFAULTS, input),
  describe: o => `Higher or Lower · First to ${o.firstTo}`,
  view,
  compact: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
    const s = play(t, players, o);
    return compactTurns(t, s, players, s.winners[0] ?? null);
  },
  happenings: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
    return turnHappenings(t, play(t, players, o));
  },
  isValidEvent: isValidTurnEvent,
};
