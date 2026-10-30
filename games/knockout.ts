// Knockout: one visit each per round; the lowest visit of the round loses a life (docs/GRY.md). Pure, no I/O.
import type { Happening } from './effects.ts';
import { value } from './darts.ts';
import type { BullOff } from './x01/rules.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns } from './turns.ts';
import { BULL_OFF, compactTurns, frame, isValidTurnEvent, livesLabel, normalizeByDefs, replayTurns, turnHappenings, walk } from './turns.ts';

export interface KnockoutOptions {
  bullOff: BullOff;
}

export const KNOCKOUT_LIVES = 3;

/** How the last finished round ended: who lost a life, who went out, or nobody because everyone would have. */
export interface RoundEnd {
  losers: number[];
  out: number[];
  replayed: boolean;
}

interface State extends Turn {
  lives: number[];
  out: boolean[];
  /** Visit totals of the round on screen, null for who has not thrown in it. */
  roundTotals: (number | null)[];
  /** Lowest complete visit of that round so far. */
  lowest: number | null;
  /** The last finished round, kept until the next visit's first dart. */
  roundEnd: RoundEnd | null;
  /** Points of the visit on screen. */
  visitScore: number;
  points: number[];
  visits: number[];
  winners: number[];
}

function play(t: Turns, players: number): State {
  const lives = Array(players).fill(KNOCKOUT_LIVES), points = Array(players).fill(0), visits = Array(players).fill(0);
  const goods: boolean[][] = [];
  const fx: Happening[] = [];
  let round = 0, queue: number[] = [], pos = 0, totals: (number | null)[] = [];
  let over = false, left = 3, visitScore = 0, roundEnd: RoundEnd | null = null;
  /** The finished round the screen keeps until the takeout, while its last visit is still open. */
  let held: Pick<State, 'roundTotals' | 'lowest'> | null = null;

  // A round: everyone still in throws once, starting one place further on each round.
  const newRound = () => {
    const from = (t.starter! + round) % players;
    queue = [...Array(players).keys()].map(k => (from + k) % players).filter(q => lives[q] > 0);
    pos = 0;
    totals = Array(players).fill(null);
  };
  const lowestOf = (xs: (number | null)[]) => {
    const done = xs.filter(x => x !== null);
    return done.length ? Math.min(...done) : null;
  };
  newRound();

  for (const [vi, v] of t.visits.entries()) {
    let total = 0;
    const w = walk(v, d => {
      if (over) return { good: false, end: true };
      total += value(d);
      return { good: value(d) > 0 };
    });
    goods.push(w.good);
    left = w.dartsLeft;
    visitScore = total;
    if (v.darts.length) roundEnd = null;
    if (!w.complete || over) continue;

    const p = v.player;
    // Lowest so far in the round, ties included, is bad news at once; the first visit of a round has nothing to be below.
    const before = lowestOf(totals);
    if (before !== null && total <= before) fx.push({ slot: `V${vi + 1}:lowest`, fact: { kind: 'game', event: 'lowest' } });
    totals[p] = total;
    points[p] += total;
    visits[p]++;
    fx.push({ slot: `V${vi + 1}:total`, fact: { kind: 'calledTotal', total } });
    if (++pos < queue.length) continue;

    // End of the round: the lowest total loses a life, ties included, unless that would put everyone out.
    // Only the player who just threw hears about it; the others heard it when their visit was the lowest.
    const lowest = lowestOf(totals)!;
    const losers = queue.filter(q => totals[q] === lowest);
    const replayed = losers.length === queue.length && losers.every(q => lives[q] === 1);
    if (!v.closed) held = { roundTotals: totals, lowest };
    roundEnd = { losers: replayed ? [] : losers, out: [], replayed };
    if (!replayed) {
      for (const q of losers) {
        lives[q]--;
        if (q === p) fx.push({ slot: `V${vi + 1}:life`, fact: { kind: 'game', event: 'lifeLost' } });
        if (lives[q] === 0) {
          roundEnd.out.push(q);
          if (q === p) fx.push({ slot: `V${vi + 1}:out`, fact: { kind: 'game', event: 'eliminated' } });
        }
      }
    }
    if (lives.filter(l => l > 0).length <= 1) {
      over = true;
      fx.push({ slot: 'match:won', fact: { kind: 'matchWon' } });
      continue;
    }
    round++;
    newRound();
  }

  const last = t.visits.at(-1);
  const open = last && !last.closed ? last : null;
  const shown = held && open ? held : { roundTotals: totals, lowest: lowestOf(totals) };
  return {
    over,
    current: open ? open.player : over ? last!.player : queue[pos],
    dartsLeft: over ? 0 : open ? left : 3,
    goods, fx, lives, out: lives.map(l => l === 0), ...shown, roundEnd,
    visitScore: open || over ? visitScore : 0,
    points, visits,
    winners: over ? lives.flatMap((l, i) => (l > 0 ? [i] : [])) : [],
  };
}

export interface KnockoutView extends MiniView {
  lives: number[];
  roundTotals: (number | null)[];
  lowest: number | null;
  roundEnd: RoundEnd | null;
  visitScore: number;
}

/** What the last round did, in words, for the turn card and the hero (docs/GRY.md). */
export function roundEndText(e: RoundEnd, names: string[]): string {
  if (e.replayed) return 'Round replayed: everyone would be out';
  const list = (xs: number[]) => xs.map(i => names[i]).join(', ');
  const kept = e.losers.filter(q => !e.out.includes(q));
  const parts = [];
  if (kept.length) parts.push(`${list(kept)} ${kept.length === 1 ? 'loses' : 'lose'} a life`);
  if (e.out.length) parts.push(`${list(e.out)} ${e.out.length === 1 ? 'is' : 'are'} out`);
  return parts.join(' · ');
}

const hearts = (n: number) => '♡'.repeat(Math.max(0, n));

function view(events: TurnEvent[], players: number, o: KnockoutOptions): KnockoutView {
  const t = replayTurns(events, players, o.bullOff, x => play(x, players));
  const s = play(t, players);
  const f = frame(t, s);
  return {
    ...f,
    winners: s.winners,
    // The score to beat is a tile next to the visit (web/src/screens/MiniBoard.tsx), so the note stays free for the round's end.
    hero: { big: String(s.visitScore), caption: 'Visit', note: '' },
    rows: s.lives.map((l, i) => ({
      value: s.roundTotals[i] === null ? '–' : String(s.roundTotals[i]),
      meta: s.out[i] ? 'Out' : hearts(l),
      out: s.out[i],
    })),
    result: s.winners.length ? `${livesLabel(s.lives[s.winners[0]])} left` : '',
    scores: s.lives.map(() => null),
    stats: s.points.map((p, i) => ({ points: p, visits: s.visits[i] })),
    lives: s.lives,
    roundTotals: s.roundTotals,
    lowest: s.lowest,
    roundEnd: s.roundEnd,
    visitScore: s.visitScore,
  };
}

const OPTIONS: OptionDef<KnockoutOptions>[] = [BULL_OFF as OptionDef<KnockoutOptions>];

const DEFAULTS: KnockoutOptions = { bullOff: 'off' };

export const knockout: GameModule<KnockoutOptions, KnockoutView> = {
  id: 'knockout',
  name: 'Knockout',
  blurb: 'Lowest visit each round loses a life. Last one standing wins.',
  group: 'versus',
  minPlayers: 2,
  defaults: DEFAULTS,
  options: OPTIONS,
  howTo: {
    goal: 'Don’t throw the lowest visit. Last one standing wins.',
    turn: 'Everyone throws one visit per round. The starter moves on by one each round.',
    counts: 'The total of your three darts, as in X01. A miss scores 0.',
    win: 'The lowest visit of the round loses a life, ties included. Three lives each; lose the last and you’re out. If everyone left would go out together, the round doesn’t count.',
  },
  normalizeOptions: input => normalizeByDefs(OPTIONS, DEFAULTS, input),
  describe: () => `Knockout · ${livesLabel(KNOCKOUT_LIVES)}`,
  view,
  compact: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => play(x, players));
    const s = play(t, players);
    return compactTurns(t, s, players, s.winners[0] ?? null);
  },
  happenings: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => play(x, players));
    return turnHappenings(t, play(t, players));
  },
  isValidEvent: isValidTurnEvent,
};
