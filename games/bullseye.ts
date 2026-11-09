// Bullseye: points for darts near the bull; after a round in which someone reached the target, the most points win (docs/GRY.md). Pure, no I/O.
import type { Coords, Dart } from './darts.ts';
import { BOARD_RADIUS_MM } from './darts.ts';
import type { Happening } from './effects.ts';
import type { BullOff } from './x01/rules.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns } from './turns.ts';
import { BULL_OFF, compactTurns, cutShort, frame, goneAt, isGone, isValidTurnEvent, normalizeByDefs, signed, replayTurns, turnHappenings, walk } from './turns.ts';

export interface BullseyeOptions {
  firstTo: 3 | 5 | 10;
  bullOff: BullOff;
}

interface State extends Turn {
  points: number[];
  /** Points of each visit. */
  visits: number[];
  winners: number[];
  /** The round on screen is a tiebreak. */
  tiebreak: boolean;
  /** Players in the round on screen: everyone, or the tied ones in a tiebreak. */
  playing: boolean[];
}

/** The inner single ends halfway across the treble, 103 mm from the centre. */
const INNER_MM = 103;

/** Bull +2, 25 +1, inner single 0 (also without coords), anything else −1. */
export function dartPoints(rec: { dart: Dart; coords?: Coords }): number {
  const { dart: d, coords: c } = rec;
  if (d.n === 25) return d.m === 2 ? 2 : 1;
  if (d.n === 0 || d.m !== 1) return -1;
  // Compared in board units, so 103 mm itself is outside (mm × 170 would land a hair under 103).
  return !c || Math.hypot(c.x, c.y) < INNER_MM / BOARD_RADIUS_MM ? 0 : -1;
}

function play(t: Turns, players: number, o: BullseyeOptions): State {
  const points = Array(players).fill(0);
  const goods: boolean[][] = [];
  const visits: number[] = [];
  let over = false, left = 3, winners: number[] = [];
  let tiebreak = false, queue: number[] = [], pos = 0;
  /** Who plays the round, kept on screen while its last visit is open: a tiebreak shows after Takeout (as in Shanghai). */
  let held = null as { tiebreak: boolean; queue: number[] } | null;

  // A round: those still playing throw once, in the playing order.
  const newRound = (who: number[]) => {
    queue = (t.order ?? []).filter(q => who.includes(q));
    pos = 0;
  };
  newRound([...Array(players).keys()]);

  // End of the round: once someone has the target, the most points win; tied leaders play a tiebreak, round after round.
  const endRound = (keep: boolean) => {
    held = keep ? { tiebreak, queue: [...queue] } : null;
    const best = Math.max(...queue.map(q => points[q]));
    const leaders = queue.filter(q => points[q] === best);
    if (!tiebreak && best < o.firstTo) return newRound(queue);
    if (leaders.length === 1) {
      over = true;
      winners = leaders;
    } else {
      tiebreak = true;
      newRound(leaders);
    }
  };
  // A removed player leaves the round in progress and every round after (docs/UI.md#wycofanie-gracza).
  const leave = (vi: number) => {
    for (const q of goneAt(t, vi)) {
      const i = queue.indexOf(q);
      if (i < 0 || over) continue;
      queue.splice(i, 1);
      if (i < pos) pos--;
      if (pos > 0 && pos >= queue.length) endRound(!(t.visits[vi - 1]?.closed ?? true));
      // The last one left in a tiebreak wins it at once.
      if (!over && tiebreak && queue.length === 1) {
        over = true;
        winners = [...queue];
      }
    }
  };

  for (const [vi, v] of t.visits.entries()) {
    leave(vi);
    const p = v.player;
    let mine = 0;
    const w = walk(v, (_d, di) => {
      if (over) return { good: false, end: true };
      const n = dartPoints(v.darts[di]);
      points[p] += n;
      mine += n;
      return { good: n > 0 };
    });
    goods.push(w.good);
    visits.push(mine);
    left = w.dartsLeft;
    if (!w.complete || over || cutShort(t, vi)) continue;
    if (++pos >= queue.length) endRound(vi === t.visits.length - 1 && !v.closed);
  }
  leave(t.visits.length);
  // End match with Save ends the game as won: most points, ties share it, nobody when the best is 0 or below.
  if (!over && t.ended) {
    over = true;
    held = null;
    const best = Math.max(...points.filter((_, i) => !isGone(t, i)));
    winners = best > 0 ? points.flatMap((n, i) => (n === best && !isGone(t, i) ? [i] : [])) : [];
  }
  const fx: Happening[] = over && winners.length ? [{ slot: 'match:won', fact: { kind: 'matchWon' } }] : [];

  const last = t.visits.at(-1);
  const open = last && !last.closed ? last : null;
  const shown = held && !over ? held : { tiebreak, queue };
  return {
    over,
    current: open ? open.player : over ? last!.player : queue[pos],
    dartsLeft: over ? 0 : open ? left : 3,
    goods, fx, points, visits, winners,
    tiebreak: shown.tiebreak,
    playing: [...Array(players).keys()].map(q => !shown.tiebreak || shown.queue.includes(q)),
  };
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
    // Non-breaking spaces keep each value with its field when the note wraps on a phone.
    hero: { big: signed(s.points[p]), caption: s.tiebreak ? 'Tiebreak' : 'Points', note: 'Bull +2 · 25 +1 · inner single 0 · rest −1' },
    rows: s.points.map((n, i) => ({ value: signed(n), meta: s.playing[i] ? 'points' : 'Out of tiebreak', out: !s.playing[i] })),
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
    info: 'Points that end the game: checked at the end of each round, the most points win.',
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
    goal: 'Collect points near the bull. Once someone has the set number of points at the end of a round, the most points win.',
    turn: 'Three darts each, in turn.',
    counts: 'Bull +2, 25 +1, a single between the 25 and the treble 0. A treble, a double, a single outside the treble or a miss −1. Your score can go below zero.',
    win: 'The score is checked when everyone has thrown their visit for the round. If someone has the target or more, the most points win; the visit that reaches the target is played to the end. A tie at the top goes to a tiebreak for the tied players only: one visit each, added to the total, repeated until someone leads. End match with Save: the most points win, ties share the win, and nobody wins at 0 or below.',
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
