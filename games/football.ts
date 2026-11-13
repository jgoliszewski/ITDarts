// Football: win the ball with a bull, then score goals with doubles (docs/GRY.md). Pure, no I/O.
import type { Coords, Dart } from './darts.ts';
import { BOARD_ORDER, isBigSingle } from './darts.ts';
import type { Happening } from './effects.ts';
import type { BullOff } from './x01/rules.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns, Verdict } from './turns.ts';
import { BULL_OFF, choiceLabel, compactTurns, dartSlot, frame, goneAt, isGone, isValidTurnEvent, nextUp, normalizeByDefs, plural, replayTurns, seeded, turnHappenings, walk } from './turns.ts';

export interface FootballOptions {
  /** What takes the ball: any bull, or only the bullseye. */
  kickOff: 'any' | 'bullseye';
  /** What scores with the ball: the doubles, or the big singles of four sectors drawn at every take of the ball. */
  goalsOn: 'singles' | 'doubles';
  goals: 3 | 5 | 10;
  bullOff: BullOff;
}

interface State extends Turn {
  goals: number[];
  /** Who has the ball, null while it is in the centre. */
  ball: number | null;
  /** Per visit: goals scored and whom the ball was won from (null: from the centre, undefined: not won). */
  visits: { goals: number; wonFrom: number | null | undefined }[];
  winners: number[];
  /** Sectors whose big single scores (goalsOn singles): drawn at each take of the ball, kept when it is freed. Null before the first. */
  sectors: number[] | null;
}

const takesBall = (d: Dart, o: FootballOptions) => d.n === 25 && (o.kickOff === 'any' || d.m === 2);
const isGoal = (d: Dart, c: Coords | undefined, o: FootballOptions, sectors: number[] | null) =>
  o.goalsOn === 'singles'
    ? !!sectors?.includes(d.n) && isBigSingle({ dart: d, coords: c })
    : d.m === 2 && d.n >= 1 && d.n <= 20;

/** Four sectors a quarter of the board apart: every fifth place in BOARD_ORDER, from a random start 0–4. */
const drawSectors = (rnd: () => number) => {
  const k = Math.floor(rnd() * 5);
  return [0, 5, 10, 15].map(s => BOARD_ORDER[k + s]);
};

function play(t: Turns, players: number, o: FootballOptions): State {
  const goals = Array(players).fill(0);
  const goods: boolean[][] = [];
  const fx: Happening[] = [];
  const visits: State['visits'] = [];
  let ball: number | null = null, over = false, left = 3, winners: number[] = [];
  let sectors: number[] | null = null;
  // One generator for the whole replay, drawn in order, so undo and fixes give the same sectors.
  const rnd = seeded(t.seed);

  // The ball of a removed player is free (docs/UI.md#wycofanie-gracza).
  const free = (vi: number) => {
    if (ball !== null && goneAt(t, vi).includes(ball)) ball = null;
  };
  for (const [vi, v] of t.visits.entries()) {
    free(vi);
    const p = v.player;
    const mine: State['visits'][number] = { goals: 0, wonFrom: undefined };
    const w = walk(v, (d, di) => {
      if (over) return { good: false, end: true };
      if (takesBall(d, o)) {
        if (ball === p) return { good: false };
        if (mine.wonFrom === undefined) mine.wonFrom = ball;
        ball = p;
        if (o.goalsOn === 'singles') sectors = drawSectors(rnd);
        return { good: true };
      }
      if (ball !== p || !isGoal(d, v.darts[di].coords, o, sectors)) return { good: false };
      goals[p]++;
      mine.goals++;
      fx.push({ slot: dartSlot(vi, di, 'goal'), fact: { kind: 'game', event: 'goal' } });
      if (goals[p] >= o.goals) {
        over = true;
        winners = [p];
      }
      return { good: true, end: over };
    });
    goods.push(w.good);
    visits.push(mine);
    left = w.dartsLeft;
  }
  free(t.visits.length);
  // End match with Save ends the game as won: most goals, ties share it, nobody at 0–0.
  if (!over && t.ended) {
    over = true;
    const best = Math.max(...goals.filter((_, i) => !isGone(t, i)));
    winners = best > 0 ? goals.flatMap((g, i) => (g === best && !isGone(t, i) ? [i] : [])) : [];
  }
  if (over && winners.length) fx.push({ slot: 'match:won', fact: { kind: 'matchWon' } });

  const last = t.visits.at(-1);
  const open = last && !last.closed ? last : null;
  const current = open ? open.player : over ? last!.player : nextUp(t);
  return { over, current, dartsLeft: over ? 0 : open ? left : 3, goods, fx, goals, ball, visits, winners, sectors };
}

export interface FootballView extends MiniView {
  goals: number[];
  ball: number | null;
  /** Sectors whose big single scores (Goals on Big singles), null before the ball is first won and with Doubles. */
  sectors: number[] | null;
  /** The visit on screen won the ball: from this player, or from the centre (null). Undefined when it did not. */
  wonFrom: number | null | undefined;
}

/** The turn card's headline: goals first, then a won ball. */
function verdict(x: State['visits'][number] | undefined): Verdict | null {
  if (!x) return null;
  if (x.goals) return { text: x.goals === 1 ? 'Goal!' : `${x.goals} goals!`, tone: 'good' };
  return x.wonFrom !== undefined ? { text: 'Ball won', tone: 'good' } : null;
}

function view(events: TurnEvent[], players: number, o: FootballOptions): FootballView {
  const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
  const s = play(t, players, o);
  const f = frame(t, s);
  const shown = f.visit.darts.length ? s.visits.at(-1) : undefined;
  const p = f.current;
  const bull = o.kickOff === 'any' ? 'the bull' : 'the bullseye';
  return {
    ...f,
    visit: { ...f.visit, verdict: f.visit.verdict ?? (f.visit.dartsLeft === 0 ? verdict(shown) : null) },
    winners: s.winners,
    hero: {
      big: String(s.goals[p]),
      caption: 'Goals',
      note: s.ball === p ? (s.sectors ? `Your ball · big singles ${s.sectors.join(' · ')} score` : 'Your ball · doubles score') : s.ball === null ? `Ball in the centre · hit ${bull}` : `Ball with a rival · hit ${bull}`,
    },
    rows: s.goals.map((g, i) => ({ value: String(g), meta: s.ball === i ? '⚽ Ball' : plural(g, 'goal'), out: false })),
    result: s.winners.length ? `Goals ${[...s.goals].sort((a, b) => b - a).join('–')}` : '',
    scores: s.goals.map(() => null),
    stats: s.goals.map(g => ({ goals: g })),
    goals: s.goals,
    ball: s.ball,
    sectors: s.sectors,
    wonFrom: shown?.wonFrom,
  };
}

const OPTIONS: OptionDef<FootballOptions>[] = [
  {
    key: 'kickOff',
    label: 'Kick-off',
    info: 'What takes the ball: any bull (25 or 50), or the bullseye only.',
    choices: [['any', '25/50'], ['bullseye', 'Bull only']],
  },
  {
    key: 'goalsOn',
    label: 'Goals on',
    info: 'What scores with the ball: the big single (between the treble and the double) of four sectors drawn each time the ball is won, or any double.',
    choices: [['singles', 'Big singles'], ['doubles', 'Doubles']],
  },
  {
    key: 'goals',
    label: 'Goals',
    info: 'Goals to win the game.',
    choices: [[3, '3'], [5, '5'], [10, '10']],
  },
  BULL_OFF as OptionDef<FootballOptions>,
];

const DEFAULTS: FootballOptions = { kickOff: 'any', goalsOn: 'singles', goals: 5, bullOff: 'off' };

export const football: GameModule<FootballOptions, FootballView> = {
  id: 'football',
  name: 'Football',
  blurb: 'Win the ball on the bull, score on big singles or doubles.',
  group: 'versus',
  minPlayers: 2,
  defaults: DEFAULTS,
  options: OPTIONS,
  howTo: {
    goal: 'Win the ball with a bull, then score goals. First to the set number of goals wins.',
    turn: 'Three darts each, in turn. There is one ball, in the centre at the start.',
    counts: 'A bull takes the ball, from the centre or from whoever has it. With the ball you keep it and score goals. Goals on Doubles: every double 1–20 is a goal. Goals on Big singles: only the big single (between the treble and the double) of four sectors a quarter of the board apart counts, and every time the ball is won, from the centre or from a rival, four new sectors are drawn. A bull never scores.',
    win: 'Reach the goal target and you win at once, even mid-visit.',
  },
  // Options saved before Goals on existed (history, a match in progress) played Doubles, not the new default.
  normalizeOptions: input => normalizeByDefs(OPTIONS, { ...DEFAULTS, goalsOn: 'doubles' }, input),
  describe: o => `Football · ${choiceLabel(OPTIONS, o, 'kickOff')} · ${choiceLabel(OPTIONS, o, 'goalsOn')} · First to ${o.goals}`,
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
