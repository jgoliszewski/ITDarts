// Killer: hit your own double to become a killer, then take rivals' lives on their doubles (docs/GRY.md). Pure, no I/O.
import type { BullOff } from './x01/rules.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns } from './turns.ts';
import { BULL_OFF, compactTurns, frame, isValidTurnEvent, livesLabel, nextIn, normalizeByDefs, replayTurns, walk } from './turns.ts';

export interface KillerOptions {
  lives: number;
  bullOff: BullOff;
}

/** Unique random numbers 1–20, one per player. */
export function drawNumbers(players: number, random = Math.random): number[] {
  const pool = Array.from({ length: 20 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, players);
}

const numbersOf = (t: Turns, players: number) =>
  t.numbers.length === players && new Set(t.numbers).size === players ? t.numbers : Array.from({ length: players }, (_, i) => i + 1);

interface State extends Turn {
  numbers: number[];
  lives: number[];
  killer: boolean[];
  out: boolean[];
  taken: number[];
  winners: number[];
}

function play(t: Turns, players: number, o: KillerOptions): State {
  const numbers = numbersOf(t, players);
  const lives = Array(players).fill(o.lives), taken = Array(players).fill(0);
  const killer = Array(players).fill(false), out = Array(players).fill(false);
  const goods: boolean[][] = [];
  let over = false, left = 3;
  for (const v of t.visits) {
    const p = v.player;
    const w = walk(v, d => {
      if (over || out[p]) return { good: false, end: true };
      const q = d.m === 2 ? numbers.indexOf(d.n) : -1;
      if (q < 0 || out[q]) return { good: false };
      if (q === p && !killer[p]) {
        killer[p] = true;
        return { good: true };
      }
      if (q !== p && !killer[p]) return { good: false };
      lives[q]--;
      if (q !== p) taken[p]++;
      if (lives[q] === 0) out[q] = true;
      over = out.filter(x => !x).length <= 1;
      return { good: true, end: over || out[p] };
    });
    goods.push(w.good);
    left = w.dartsLeft;
  }
  const last = t.visits.at(-1);
  const current = !last ? t.starter! : !last.closed ? last.player : nextIn(last.player, players, q => out[q]);
  return {
    over, current, dartsLeft: over ? 0 : last && !last.closed ? left : 3, goods,
    numbers, lives, killer, out, taken, winners: over ? out.flatMap((x, i) => (x ? [] : [i])) : [],
  };
}

export interface KillerView extends MiniView {
  numbers: number[];
  lives: number[];
  killer: boolean[];
  /** Numbers can still be drawn again: nobody has thrown. */
  canReroll: boolean;
}

const hearts = (n: number) => '♥'.repeat(Math.max(0, n));

function view(events: TurnEvent[], players: number, o: KillerOptions): KillerView {
  const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
  const s = play(t, players, o);
  const f = frame(t, s);
  const p = f.current;
  return {
    ...f,
    winners: s.winners,
    hero: {
      big: String(s.numbers[p]),
      caption: s.killer[p] ? 'Killer' : 'Your double',
      note: `${hearts(s.lives[p])} ${s.killer[p] ? '· hit a rival double' : '· hit your double to become a killer'}`,
    },
    rows: s.numbers.map((n, i) => ({
      value: String(n),
      meta: s.out[i] ? 'Out' : `${hearts(s.lives[i])}${s.killer[i] ? ' · KILLER' : ''}`,
      out: s.out[i],
    })),
    result: s.winners.length ? `${livesLabel(s.lives[s.winners[0]])} left` : '',
    scores: s.numbers.map(() => null),
    stats: s.taken.map(x => ({ taken: x })),
    numbers: s.numbers,
    lives: s.lives,
    killer: s.killer,
    canReroll: t.visits.length === 0,
  };
}

const OPTIONS: OptionDef<KillerOptions>[] = [
  {
    key: 'lives',
    label: 'Lives',
    info: 'Lives each player starts with.',
    choices: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']],
  },
  BULL_OFF as OptionDef<KillerOptions>,
];

const DEFAULTS: KillerOptions = { lives: 3, bullOff: 'off' };

export const killer: GameModule<KillerOptions, KillerView> = {
  id: 'killer',
  name: 'Killer',
  blurb: 'Become a killer on your double, then take lives.',
  minPlayers: 2,
  defaults: DEFAULTS,
  options: OPTIONS,
  howTo: {
    goal: 'Be the last player with lives left.',
    turn: 'Everyone gets a random number from 1 to 20. Three darts per visit.',
    counts: 'Only doubles count. Hit your own double to become a killer for the rest of the game. As a killer, each hit on a rival’s double takes one of their lives, and a hit on your own double costs you one.',
    win: 'A player with no lives is out at once, even mid-visit. The last one standing wins.',
  },
  normalizeOptions: input => normalizeByDefs(OPTIONS, DEFAULTS, input),
  describe: o => `Killer · ${livesLabel(o.lives)}`,
  view,
  compact: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
    const s = play(t, players, o);
    return compactTurns(t, s, players, s.winners[0] ?? null);
  },
  isValidEvent: isValidTurnEvent,
};
