// Higher or Lower: throw a visit outside the forbidden range, which grows with every success (docs/GRY.md). Pure, no I/O.
import type { Dart } from './darts.ts';
import { value } from './darts.ts';
import type { Happening } from './effects.ts';
import type { BullOff } from './x01/rules.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns } from './turns.ts';
import { BULL_OFF, compactTurns, cutShort, frame, goneAt, isValidTurnEvent, livesLabel, normalizeByDefs, plural, replayTurns, rotate, turnHappenings, walk } from './turns.ts';

export interface HolOptions {
  firstTo: number;
  lives: number;
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
  /** The visit on screen fails: its sum is inside the range, or it has a miss. */
  failed: boolean;
  /** The finished visit on screen takes a life at the takeout. */
  losing: boolean;
  points: number[];
  lives: number[];
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
  const gone = Array(players).fill(false);
  let alive = Array(players).fill(true), lives: number[] = Array(players).fill(o.lives);
  let queue: number[] = [], pos = 0;
  let over = false, left = 3, sum: number | null = null, failed = false, lastGame: State['lastGame'] = null, winner: number | null = null;
  /** The range and lives the screen keeps until the takeout, while the finished visit is still open. */
  let held: { lo: number; hi: number; lives: number[] } | null = null;

  // A round: everyone still in throws once, in the playing order from this game's starter.
  const newRound = () => {
    queue = rotate(t.order ?? [], game).filter(q => alive[q]);
    pos = 0;
  };
  newRound();

  // `w` wins the game; the next one starts with everyone still in the match and full lives, unless the match is won.
  const winGame = (w: number) => {
    points[w]++;
    lastGame = { no: game + 1, winner: w };
    fx.push({ slot: `G${game + 1}:won`, fact: { kind: 'checkout' } });
    if (points[w] >= o.firstTo) {
      over = true;
      winner = w;
      fx.push({ slot: 'match:won', fact: { kind: 'matchWon' } });
      return;
    }
    game++;
    fx.push({ slot: `G${game + 1}:start`, fact: { kind: 'legStart' } });
    [lo, hi] = START_RANGE;
    alive = gone.map(g => !g);
    lives = Array(players).fill(o.lives);
    newRound();
  };
  // The last one left in the game wins it at once, even before his visit this round.
  const lastOneWins = () => {
    const still = alive.flatMap((a, q) => (a ? [q] : []));
    if (!over && still.length === 1) winGame(still[0]);
  };
  // A removed player leaves the game in progress for good (docs/UI.md#wycofanie-gracza).
  const leave = (vi: number) => {
    for (const q of goneAt(t, vi)) {
      gone[q] = true;
      alive[q] = false;
      const i = queue.indexOf(q);
      if (i < 0 || over) continue;
      queue.splice(i, 1);
      if (i < pos) pos--;
      if (pos > 0 && pos >= queue.length) newRound();
      lastOneWins();
    }
  };

  for (const [vi, v] of t.visits.entries()) {
    leave(vi);
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
    failed = miss || (sum !== null && total >= lo && total <= hi);
    // A visit cut short by its thrower's removal is not judged: the removal takes him out.
    if (!w.complete || over || cutShort(t, vi)) continue;
    held = v.closed ? null : { lo, hi, lives: [...lives] };

    if (failed) {
      fx.push({ slot: `V${vi + 1}:life`, fact: { kind: 'game', event: 'lifeLost' } });
      if (--lives[v.player] === 0) {
        alive[v.player] = false;
        fx.push({ slot: `V${vi + 1}:out`, fact: { kind: 'game', event: 'eliminated' } });
      }
    } else if (total > hi) hi = total;
    else lo = total;
    if (++pos >= queue.length) newRound();
    lastOneWins();
  }
  leave(t.visits.length);

  const last = t.visits.at(-1);
  const open = last && !last.closed ? last : null;
  const hold = open && held && !over ? held : null;
  const out = alive.map((a, q) => !a || gone[q]);
  return {
    over,
    current: open ? open.player : over ? last!.player : queue[pos],
    dartsLeft: over ? 0 : open ? left : 3,
    goods, fx,
    lo: hold ? hold.lo : lo,
    hi: hold ? hold.hi : hi,
    sum: open || over ? sum : null,
    failed: (open || over) && sum !== null ? failed : false,
    losing: !!hold && failed,
    points, lives: hold ? hold.lives : lives, out, game, lastGame, winners: winner === null ? [] : [winner],
  };
}

export interface HolView extends MiniView {
  lo: number;
  hi: number;
  sum: number | null;
  /** The visit on screen fails: red sum and pin. */
  failed: boolean;
  /** The finished visit on screen takes the current player's life at the takeout. */
  losing: boolean;
  lives: number[];
  maxLives: number;
  points: number[];
  game: number;
  lastGame: { no: number; winner: number } | null;
}

function view(events: TurnEvent[], players: number, o: HolOptions): HolView {
  const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
  const s = play(t, players, o);
  const f = frame(t, s);
  // A failed visit that keeps the player in says so on the turn card; the last life gives "Out".
  const lost = f.visit.dartsLeft === 0 && f.visit.darts.length > 0 && s.failed;
  return {
    ...f,
    visit: { ...f.visit, verdict: f.visit.verdict ?? (lost ? { text: 'Life lost', tone: 'bad' } : null) },
    winners: s.winners,
    hero: { big: String(s.sum ?? 0), caption: `Range ${s.lo}–${s.hi}`, note: `Above ${s.hi} or below ${s.lo}` },
    rows: s.points.map((p, i) => ({ value: String(p), meta: s.out[i] ? 'Out' : `${livesLabel(s.lives[i])} · ${plural(p, 'point')}`, out: s.out[i] })),
    result: s.winners.length ? `Points ${[...s.points].sort((a, b) => b - a).join('–')}` : '',
    scores: s.points.map(() => null),
    stats: s.points.map(() => ({})),
    lo: s.lo,
    hi: s.hi,
    sum: s.sum,
    failed: s.failed,
    losing: s.losing,
    lives: s.lives,
    maxLives: o.lives,
    points: s.points,
    game: s.game + 1,
    lastGame: s.lastGame,
  };
}

const OPTIONS: OptionDef<HolOptions>[] = [
  {
    key: 'firstTo',
    label: 'First to',
    info: 'Games to win the match. Each game starts again from 26–45 with everyone in and full lives.',
    choices: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']],
  },
  {
    key: 'lives',
    label: 'Lives',
    info: 'Lives each player starts every game with. A failed visit costs one.',
    choices: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']],
  },
  BULL_OFF as OptionDef<HolOptions>,
];

const DEFAULTS: HolOptions = { firstTo: 1, lives: 3, bullOff: 'off' };

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
    win: 'A failed visit costs a life and leaves the range as it is; with no lives left you are out. The last player in wins the game at once; first to the set number of games wins the match.',
  },
  normalizeOptions: input => normalizeByDefs(OPTIONS, DEFAULTS, input),
  describe: o => `Higher or Lower · First to ${o.firstTo} · ${livesLabel(o.lives)}`,
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
