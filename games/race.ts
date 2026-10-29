// Around the Clock and Full Board: race through the targets, fewest darts wins (docs/GRY.md). Pure, no I/O.
import type { Dart } from './darts.ts';
import { BOARD_ORDER } from './darts.ts';
import { drawNumbers } from './killer.ts';
import type { GameEvent, Happening } from './effects.ts';
import type { BullOff } from './x01/rules.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns } from './turns.ts';
import {
  BULL_OFF, OFF_ON, ON_OFF, choiceLabel, compactTurns, dartSlot, frame, isValidTurnEvent, normalizeByDefs, plural, replayTurns, seeded, turnHappenings, walk,
} from './turns.ts';

export type TargetMode = 'any' | 'doubles' | 'trebles';

export interface AtcOptions {
  order: 'numeric' | 'clockwise' | 'random';
  target: TargetMode;
  skips: boolean;
  coop: boolean;
  bullOff: BullOff;
}

export interface FullBoardOptions {
  target: TargetMode;
  coop: boolean;
  bullOff: BullOff;
}

/** Does the dart hit sector n? In Any every segment counts and the bull is 25 or 50; otherwise only the ring, and only 50 for the bull. */
export function hits(d: Dart, n: number, mode: TargetMode): boolean {
  if (n === 0 || d.n !== n) return false;
  if (n === 25) return mode === 'any' || d.m === 2;
  return mode === 'any' || d.m === (mode === 'doubles' ? 2 : 3);
}

export const targetLabel = (n: number, mode: TargetMode) => (n === 25 ? 'Bull' : mode === 'any' ? String(n) : `${mode === 'doubles' ? 'D' : 'T'}${n}`);

interface Rules<P> {
  /** The Wyzwalacz a counted dart fires. */
  event: GameEvent;
  init: () => P;
  /** Applies a dart, returns whether it counted. */
  hit: (p: P, d: Dart) => boolean;
  done: (p: P) => boolean;
}

interface RaceState<P> extends Turn {
  /** Progress per player; in co-op every entry is the one shared progress. */
  sides: P[];
  darts: number[];
  hits: number[];
  winners: number[];
}

function playRace<P>(t: Turns, players: number, coop: boolean, r: Rules<P>): RaceState<P> {
  const team = r.init();
  const own = Array.from({ length: players }, r.init);
  const sides = coop ? own.map(() => team) : own;
  const darts = Array(players).fill(0), hit = Array(players).fill(0);
  const goods: boolean[][] = [];
  const fx: Happening[] = [];
  let complete = 0, left = 3;
  for (const [vi, v] of t.visits.entries()) {
    const side = sides[v.player];
    const w = walk(v, (d, di) => {
      const good = !r.done(side) && r.hit(side, d);
      if (good) fx.push({ slot: dartSlot(vi, di, 'hit'), fact: { kind: 'game', event: r.event } });
      return { good, end: r.done(side) };
    });
    goods.push(w.good);
    darts[v.player] += w.used;
    hit[v.player] += w.good.filter(Boolean).length;
    if (w.complete) complete++;
    left = w.dartsLeft;
  }
  // Someone finished: the round is played out so everyone has the same number of visits.
  const over = coop ? r.done(team) : own.some(r.done) && complete % players === 0;
  const last = t.visits.at(-1);
  const current = !last ? t.starter! : last.closed ? (last.player + 1) % players : last.player;
  let winners: number[] = [];
  if (over && !coop) {
    const best = Math.min(...own.map((p, i) => (r.done(p) ? darts[i] : Infinity)));
    winners = own.map((_, i) => i).filter(i => r.done(own[i]) && darts[i] === best);
  }
  if (over) fx.push({ slot: 'match:won', fact: { kind: 'matchWon' } });
  return { over, current, dartsLeft: over ? 0 : last && !last.closed ? left : 3, goods, fx, sides, darts, hits: hit, winners };
}

const total = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function raceView<P>(t: Turns, s: RaceState<P>, coop: boolean, progress: (p: P) => number, of: number) {
  const done = (i: number) => progress(s.sides[i]) >= of;
  const teamDarts = total(s.darts);
  const scores = s.sides.map((_, i) =>
    coop ? (done(0) ? teamDarts : null) : done(i) ? s.darts[i] : null);
  const result = !s.over ? '' : coop ? `Completed in ${teamDarts} darts`
    : s.winners.length > 1 ? `Shared win · ${plural(s.darts[s.winners[0]], 'dart')}` : `Won in ${plural(s.darts[s.winners[0]], 'dart')}`;
  return {
    ...frame(t, s),
    winners: s.winners,
    result,
    scores,
    stats: s.darts.map((d, i) => ({ darts: d, hits: s.hits[i] })),
    teamDarts: coop ? teamDarts : null,
  };
}

const TARGET: OptionDef<{ target: TargetMode }> = {
  key: 'target',
  label: 'Target',
  info: 'Which ring counts. In Doubles and Trebles only the bullseye (50) counts for the bull.',
  choices: [['any', 'Any'], ['doubles', 'Doubles'], ['trebles', 'Trebles']],
};

const COOP: OptionDef<{ coop: boolean }> = {
  key: 'coop',
  label: 'Co-op',
  info: 'Everyone throws in turn for one shared progress. No winner, one team result.',
  choices: OFF_ON,
  when: (_o, players) => players >= 2,
};

// ---------- Around the Clock ----------

export interface AtcView extends MiniView {
  targets: number[];
  /** Index of the next target per player (targets.length when done). */
  progress: number[];
  teamDarts: number | null;
}

/** The targets in order; Random shuffles 1–20 from the match's logged seed, the bull stays last. */
export const atcTargets = (o: AtcOptions, seed = 0) => [
  ...(o.order === 'clockwise' ? BOARD_ORDER : o.order === 'random' ? drawNumbers(20, seeded(seed)) : BOARD_ORDER.map((_, i) => i + 1)), 25];

function atcRules(o: AtcOptions, seed: number): Rules<{ i: number }> {
  const targets = atcTargets(o, seed);
  return {
    event: 'targetHit',
    init: () => ({ i: 0 }),
    hit: (p, d) => {
      const target = targets[p.i];
      if (!hits(d, target, o.target)) return false;
      // Skips never jump over the bull: it is always the last target.
      const step = o.target === 'any' && o.skips && target !== 25 ? d.m : 1;
      p.i = target === 25 ? targets.length : Math.min(p.i + step, targets.length - 1);
      return true;
    },
    done: p => p.i >= targets.length,
  };
}

const atcPlay = (t: Turns, players: number, o: AtcOptions) => playRace(t, players, o.coop && players > 1, atcRules(o, t.seed));

function atcView(events: TurnEvent[], players: number, o: AtcOptions): AtcView {
  const coop = o.coop && players > 1;
  const t = replayTurns(events, players, o.bullOff, x => atcPlay(x, players, o));
  const s = atcPlay(t, players, o);
  const targets = atcTargets(o, t.seed);
  const progress = s.sides.map(p => p.i);
  const of = targets.length;
  const tl = (i: number) => (i >= of ? 'Done' : targetLabel(targets[i], o.target));
  const base = raceView(t, s, coop, p => p.i, of);
  const cur = progress[base.current];
  return {
    ...base,
    hero: {
      big: tl(cur),
      caption: cur >= of ? 'Finished' : 'Target',
      note: coop ? `Team ${cur} / ${of} · ${plural(base.teamDarts!, 'dart')}` : `${cur} / ${of} · ${plural(s.darts[base.current], 'dart')}`,
    },
    rows: progress.map((p, i) => coop
      ? { value: String(s.hits[i]), meta: `${plural(s.hits[i], 'target')} cleared`, out: false }
      : { value: tl(p), meta: `${p} / ${of} · ${plural(s.darts[i], 'dart')}`, out: false }),
    targets,
    progress,
  };
}

const ATC_OPTIONS: OptionDef<AtcOptions>[] = [
  {
    key: 'order',
    label: 'Order',
    info: '1–20 goes up the numbers. Clockwise follows the board from the top: 20, 1, 18, 4… Random draws a new order of 1–20 each game.',
    choices: [['numeric', '1–20'], ['clockwise', 'Clockwise'], ['random', 'Random']],
  },
  TARGET as OptionDef<AtcOptions>,
  {
    key: 'skips',
    label: 'Multiplier skips',
    info: 'A double moves you 2 targets on and a treble 3. Never past the bull.',
    choices: ON_OFF,
    when: o => o.target === 'any',
  },
  COOP as OptionDef<AtcOptions>,
  BULL_OFF as OptionDef<AtcOptions>,
];

const ATC_DEFAULTS: AtcOptions = { order: 'numeric', target: 'any', skips: true, coop: false, bullOff: 'off' };

export const atc: GameModule<AtcOptions, AtcView> = {
  id: 'atc',
  name: 'Around the Clock',
  blurb: 'Hit 1 to 20 in order, then the bull.',
  group: 'practice',
  minPlayers: 1,
  defaults: ATC_DEFAULTS,
  options: ATC_OPTIONS,
  howTo: {
    goal: 'Hit every number from 1 to 20 in order (clockwise round the board, or in a random order drawn at the start), then the bull.',
    turn: 'Three darts per visit. After a hit your next dart already goes at the next target.',
    counts: 'Any segment of the target counts, and the bull is 25 or 50. With Doubles or Trebles only that ring counts, and only the bullseye (50) for the bull.',
    win: 'When someone hits the bull the round is played out, so everyone has the same number of visits. Fewest darts wins; equal darts share the win. In Co-op the team clears one board together.',
  },
  record: {
    variant: (o, players) => ({
      key: ['atc', o.target, o.target === 'any' ? (o.skips ? 'skips' : 'noskips') : '', o.coop && players > 1 ? 'coop' : ''].filter(Boolean).join(':'),
      label: ['ATC', choiceLabel(ATC_OPTIONS, o, 'target'), o.target === 'any' ? (o.skips ? 'Skips' : 'No skips') : '', o.coop && players > 1 ? 'Co-op' : ''].filter(Boolean).join(' · '),
    }),
    better: 'lower',
    format: v => plural(v, 'dart'),
  },
  normalizeOptions: input => normalizeByDefs(ATC_OPTIONS, ATC_DEFAULTS, input),
  describe: (o, players) => ['ATC', choiceLabel(ATC_OPTIONS, o, 'target'), choiceLabel(ATC_OPTIONS, o, 'order'),
    ...(o.target === 'any' && o.skips ? ['Skips'] : []), ...(o.coop && players > 1 ? ['Co-op'] : [])].join(' · '),
  view: atcView,
  compact: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => atcPlay(x, players, o));
    const s = atcPlay(t, players, o);
    return compactTurns(t, s, players, s.winners.length === 1 ? s.winners[0] : null);
  },
  happenings: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => atcPlay(x, players, o));
    return turnHappenings(t, atcPlay(t, players, o));
  },
  isValidEvent: isValidTurnEvent,
};

// ---------- Full Board ----------

export const SECTORS = [...BOARD_ORDER.map((_, i) => i + 1), 25];

export interface FullBoardView extends MiniView {
  /** Cleared sectors per player; in co-op the team's, repeated. */
  cleared: number[][];
  teamDarts: number | null;
}

function boardRules(o: FullBoardOptions): Rules<Set<number>> {
  return {
    event: 'sectorCleared',
    init: () => new Set<number>(),
    hit: (p, d) => {
      if (p.has(d.n) || !hits(d, d.n, o.target)) return false;
      p.add(d.n);
      return true;
    },
    done: p => p.size >= SECTORS.length,
  };
}

const boardPlay = (t: Turns, players: number, o: FullBoardOptions) => playRace(t, players, o.coop && players > 1, boardRules(o));

function boardView(events: TurnEvent[], players: number, o: FullBoardOptions): FullBoardView {
  const coop = o.coop && players > 1;
  const t = replayTurns(events, players, o.bullOff, x => boardPlay(x, players, o));
  const s = boardPlay(t, players, o);
  const of = SECTORS.length;
  const base = raceView(t, s, coop, p => p.size, of);
  const cleared = s.sides.map(p => [...p]);
  const cur = cleared[base.current].length;
  return {
    ...base,
    hero: {
      big: `${cur} / ${of}`,
      caption: 'Sectors',
      note: coop ? `Team · ${plural(base.teamDarts!, 'dart')}` : plural(s.darts[base.current], 'dart'),
    },
    rows: cleared.map((c, i) => coop
      ? { value: String(s.hits[i]), meta: `${plural(s.hits[i], 'sector')} cleared`, out: false }
      : { value: String(c.length), meta: `of ${of} · ${plural(s.darts[i], 'dart')}`, out: false }),
    cleared,
  };
}

const BOARD_OPTIONS: OptionDef<FullBoardOptions>[] = [TARGET as OptionDef<FullBoardOptions>, COOP as OptionDef<FullBoardOptions>, BULL_OFF as OptionDef<FullBoardOptions>];
const BOARD_DEFAULTS: FullBoardOptions = { target: 'any', coop: false, bullOff: 'off' };

export const fullBoard: GameModule<FullBoardOptions, FullBoardView> = {
  id: 'fullboard',
  name: 'Full Board',
  blurb: 'Clear all 20 sectors and the bull, any order.',
  group: 'practice',
  minPlayers: 1,
  defaults: BOARD_DEFAULTS,
  options: BOARD_OPTIONS,
  howTo: {
    goal: 'Clear every sector from 1 to 20 and the bull, in any order.',
    turn: 'Three darts per visit. Aim at whatever is still open.',
    counts: 'One hit clears a sector; the multiplier adds nothing. With Doubles or Trebles only that ring counts, and only the bullseye (50) for the bull.',
    win: 'When someone clears the board the round is played out. Fewest darts wins; equal darts share the win. In Co-op the team clears one board together.',
  },
  record: {
    variant: (o, players) => ({
      key: ['fullboard', o.target, o.coop && players > 1 ? 'coop' : ''].filter(Boolean).join(':'),
      label: ['Full Board', choiceLabel(BOARD_OPTIONS, o, 'target'), o.coop && players > 1 ? 'Co-op' : ''].filter(Boolean).join(' · '),
    }),
    better: 'lower',
    format: v => plural(v, 'dart'),
  },
  normalizeOptions: input => normalizeByDefs(BOARD_OPTIONS, BOARD_DEFAULTS, input),
  describe: (o, players) => ['Full Board', choiceLabel(BOARD_OPTIONS, o, 'target'), ...(o.coop && players > 1 ? ['Co-op'] : [])].join(' · '),
  view: boardView,
  compact: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => boardPlay(x, players, o));
    const s = boardPlay(t, players, o);
    return compactTurns(t, s, players, s.winners.length === 1 ? s.winners[0] : null);
  },
  happenings: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => boardPlay(x, players, o));
    return turnHappenings(t, boardPlay(t, players, o));
  },
  isValidEvent: isValidTurnEvent,
};
