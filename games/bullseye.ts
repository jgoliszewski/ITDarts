// Bullseye: points for darts near the bull, first to the target wins (docs/GRY.md). Pure, no I/O.
import type { Coords, Dart } from './darts.ts';
import type { Happening } from './effects.ts';
import type { BullOff } from './x01/rules.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns } from './turns.ts';
import { BULL_OFF, compactTurns, frame, isGone, isValidTurnEvent, nextUp, normalizeByDefs, replayTurns, turnHappenings, walk } from './turns.ts';

export interface BullseyeOptions {
  firstTo: 3 | 5 | 10;
  bullOff: BullOff;
}

interface State extends Turn {
  points: number[];
  /** Points of each visit. */
  visits: number[];
  winners: number[];
}

/** Board Manager coords are normalized: 1 is 170 mm from the centre. The inner single ends halfway across the treble, 103 mm. */
const INNER_MM = 103;
const BOARD_RADIUS_MM = 170;

/** Bull +2, 25 +1, inner single 0 (also without coords), anything else −1. */
export function dartPoints(rec: { dart: Dart; coords?: Coords }): number {
  const { dart: d, coords: c } = rec;
  if (d.n === 25) return d.m === 2 ? 2 : 1;
  if (d.n === 0 || d.m !== 1) return -1;
  return !c || Math.hypot(c.x, c.y) * BOARD_RADIUS_MM < INNER_MM ? 0 : -1;
}

/** A score with a real minus sign; `plus` adds + to gains (the turn card). */
export const signed = (n: number, plus = false) => (n < 0 ? `−${-n}` : plus && n > 0 ? `+${n}` : String(n));

function play(t: Turns, players: number, o: BullseyeOptions): State {
  const points = Array(players).fill(0);
  const goods: boolean[][] = [];
  const visits: number[] = [];
  let over = false, left = 3, winners: number[] = [];

  for (const v of t.visits) {
    const p = v.player;
    let mine = 0;
    const w = walk(v, (_d, di) => {
      if (over) return { good: false, end: true };
      const n = dartPoints(v.darts[di]);
      points[p] += n;
      mine += n;
      if (points[p] >= o.firstTo) {
        over = true;
        winners = [p];
      }
      return { good: n > 0, end: over };
    });
    goods.push(w.good);
    visits.push(mine);
    left = w.dartsLeft;
  }
  // End match with Save ends the game as won: most points, ties share it, nobody when the best is 0 or below.
  if (!over && t.ended) {
    over = true;
    const best = Math.max(...points.filter((_, i) => !isGone(t, i)));
    winners = best > 0 ? points.flatMap((n, i) => (n === best && !isGone(t, i) ? [i] : [])) : [];
  }
  const fx: Happening[] = over && winners.length ? [{ slot: 'match:won', fact: { kind: 'matchWon' } }] : [];

  const last = t.visits.at(-1);
  const open = last && !last.closed ? last : null;
  const current = open ? open.player : over ? last!.player : nextUp(t);
  return { over, current, dartsLeft: over ? 0 : open ? left : 3, goods, fx, points, visits, winners };
}

export interface BullseyeView extends MiniView {
  points: number[];
  /** Points of the visit on screen, 0 when it has no darts. */
  visitPoints: number;
}

function view(events: TurnEvent[], players: number, o: BullseyeOptions): BullseyeView {
  const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
  const s = play(t, players, o);
  const f = frame(t, s);
  const p = f.current;
  return {
    ...f,
    winners: s.winners,
    hero: { big: signed(s.points[p]), caption: 'Points', note: 'Bull +2 · 25 +1 · wide −1' },
    rows: s.points.map(n => ({ value: signed(n), meta: 'points', out: false })),
    result: s.winners.length ? `Points ${[...s.points].sort((a, b) => b - a).map(n => signed(n)).join(' / ')}` : '',
    scores: s.points.map(() => null),
    stats: s.points.map(n => ({ points: n })),
    points: s.points,
    visitPoints: f.visit.darts.length ? s.visits.at(-1) ?? 0 : 0,
  };
}

const OPTIONS: OptionDef<BullseyeOptions>[] = [
  {
    key: 'firstTo',
    label: 'First to',
    info: 'Points to win the game.',
    choices: [[3, '3'], [5, '5'], [10, '10']],
  },
  BULL_OFF as OptionDef<BullseyeOptions>,
];

const DEFAULTS: BullseyeOptions = { firstTo: 5, bullOff: 'off' };

export const bullseye: GameModule<BullseyeOptions, BullseyeView> = {
  id: 'bullseye',
  name: 'Bullseye',
  blurb: 'Points for the bull, minus for straying wide.',
  group: 'versus',
  minPlayers: 1,
  defaults: DEFAULTS,
  options: OPTIONS,
  howTo: {
    goal: 'Collect points near the bull. First to the set number of points wins.',
    turn: 'Three darts each, in turn.',
    counts: 'Bull +2, 25 +1, a single between the 25 and the treble 0. A treble, a double, a single outside the treble or a miss −1. Your score can go below zero.',
    win: 'Reach the target and you win at once, even mid-visit. End match with Save: the most points win, ties share the win, and nobody wins at 0 or below.',
  },
  normalizeOptions: input => normalizeByDefs(OPTIONS, DEFAULTS, input),
  describe: o => `Bullseye · First to ${o.firstTo}`,
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
