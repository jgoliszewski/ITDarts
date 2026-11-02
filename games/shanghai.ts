// Shanghai: one sector per round, score on it, S + D + T in one visit wins (docs/GRY.md). Pure, no I/O.
import type { Happening } from './effects.ts';
import type { BullOff } from './x01/rules.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns } from './turns.ts';
import { BULL_OFF, compactTurns, frame, isValidTurnEvent, normalizeByDefs, plural, replayTurns, turnHappenings, walk } from './turns.ts';

export interface ShanghaiOptions {
  rounds: 7 | 20;
  bullOff: BullOff;
}

/** The tiebreak is played on this sector. */
export const TIEBREAK_SECTOR = 20;

interface State extends Turn {
  points: number[];
  darts: number[];
  hits: number[];
  shanghais: number[];
  /** Round on screen: 1-based, past `rounds` means a tiebreak round. */
  round: number;
  sector: number;
  /** Players still in the tiebreak (everyone before it). */
  playing: boolean[];
  /** Points of the visit on screen, 0 before its first dart. */
  visitPoints: number;
  winners: number[];
  /** The game was won by a Shanghai. */
  byShanghai: boolean;
}

const sectorOf = (round: number, o: ShanghaiOptions) => (round <= o.rounds ? round : TIEBREAK_SECTOR);

function play(t: Turns, players: number, o: ShanghaiOptions): State {
  const points = Array(players).fill(0), darts = Array(players).fill(0), hits = Array(players).fill(0), shanghais = Array(players).fill(0);
  const goods: boolean[][] = [], visitPts: number[] = [];
  const fx: Happening[] = [];
  let round = 1, queue: number[] = [], pos = 0, left = 3;
  let over = false, winner: number | null = null, byShanghai = false;
  /** The round and who plays it, kept on screen while the last visit is open: the next round shows after Takeout. */
  let held: { round: number; queue: number[] } | null = null;

  // A round: those still playing throw once, in the playing order.
  const newRound = (who: number[]) => {
    queue = (t.order ?? []).filter(q => who.includes(q));
    pos = 0;
  };
  newRound([...Array(players).keys()]);

  for (const [vi, v] of t.visits.entries()) {
    const sector = sectorOf(round, o), p = v.player;
    const seen = new Set<number>();
    let pts = 0;
    const w = walk(v, d => {
      if (over) return { good: false, end: true };
      const good = d.n === sector;
      if (good) {
        pts += sector * d.m;
        seen.add(d.m);
        hits[p]++;
      }
      return { good };
    });
    goods.push(w.good);
    visitPts.push(over ? 0 : pts);
    if (!over) {
      darts[p] += w.used;
      points[p] += pts;
    }
    left = w.dartsLeft;
    if (!w.complete || over) continue;

    const shanghai = seen.size === 3;
    if (shanghai) {
      shanghais[p]++;
      fx.push({ slot: `V${vi + 1}:shanghai`, fact: { kind: 'game', event: 'shanghai' } });
      // With rivals it wins at once, in the tiebreak too; alone the game goes on.
      if (players > 1) {
        over = true;
        winner = p;
        byShanghai = true;
        continue;
      }
    }
    if (++pos < queue.length) continue;

    // End of the round.
    held = vi === t.visits.length - 1 && !v.closed ? { round, queue: [...queue] } : null;
    const best = Math.max(...queue.map(q => points[q]));
    const leaders = queue.filter(q => points[q] === best);
    if (round >= o.rounds && leaders.length === 1) {
      over = true;
      winner = leaders[0];
    } else if (round >= o.rounds) {
      round++;
      newRound(leaders);
    } else {
      round++;
      newRound(queue);
    }
  }
  if (over) fx.push({ slot: 'match:won', fact: { kind: 'matchWon' } });

  const last = t.visits.at(-1);
  const open = last && !last.closed ? last : null;
  const shown = last && (!last.closed || over) ? visitPts.at(-1) ?? 0 : 0;
  const shownRound = held && !over ? held.round : round;
  const shownQueue = held && !over ? held.queue : queue;
  const tiebreak = shownRound > o.rounds;
  return {
    over,
    current: open ? open.player : over ? last!.player : queue[pos],
    dartsLeft: over ? 0 : open ? left : 3,
    goods, fx, points, darts, hits, shanghais,
    round: shownRound,
    sector: sectorOf(shownRound, o),
    playing: [...Array(players).keys()].map(q => !tiebreak || shownQueue.includes(q)),
    visitPoints: shown,
    winners: winner === null ? [] : [winner],
    byShanghai,
  };
}

export interface ShanghaiView extends MiniView {
  round: number;
  rounds: number;
  sector: number;
  tiebreak: boolean;
  points: number[];
  visitPoints: number;
}

function view(events: TurnEvent[], players: number, o: ShanghaiOptions): ShanghaiView {
  const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
  const s = play(t, players, o);
  const tiebreak = s.round > o.rounds;
  const w = s.winners[0];
  const result = w === undefined ? ''
    : s.byShanghai ? `Shanghai on ${s.sector}`
    : players === 1 ? `${plural(s.points[w], 'point')}`
    : `${plural(s.points[w], 'point')}${tiebreak ? ' · Tiebreak' : ''}`;
  return {
    ...frame(t, s),
    winners: s.winners,
    hero: {
      big: String(s.sector),
      caption: tiebreak ? 'Tiebreak' : `Round ${s.round} / ${o.rounds}`,
      note: `${plural(s.visitPoints, 'point')} this visit`,
    },
    rows: s.points.map((p, i) => ({
      value: String(p),
      meta: s.playing[i] ? `${plural(s.hits[i], 'hit')}${s.shanghais[i] ? ` · ${s.shanghais[i]}× Shanghai` : ''}` : 'Out of tiebreak',
      out: !s.playing[i],
    })),
    result,
    scores: s.points.map(p => (players === 1 && s.over ? p : null)),
    stats: s.points.map((_, i) => ({ darts: s.darts[i], hits: s.hits[i], shanghais: s.shanghais[i] })),
    round: s.round,
    rounds: o.rounds,
    sector: s.sector,
    tiebreak,
    points: s.points,
    visitPoints: s.visitPoints,
  };
}

const OPTIONS: OptionDef<ShanghaiOptions>[] = [
  {
    key: 'rounds',
    label: 'Rounds',
    info: 'One sector per round, from 1 up: 7 rounds is sectors 1–7, 20 rounds is 1–20. A tie at the top is decided on 20.',
    choices: [[7, '7'], [20, '20']],
  },
  BULL_OFF as OptionDef<ShanghaiOptions>,
];

const DEFAULTS: ShanghaiOptions = { rounds: 7, bullOff: 'off' };

export const shanghai: GameModule<ShanghaiOptions, ShanghaiView> = {
  id: 'shanghai',
  name: 'Shanghai',
  blurb: "Score on the round's number. Single, double and treble in one visit wins.",
  group: 'versus',
  minPlayers: 1,
  defaults: DEFAULTS,
  options: OPTIONS,
  howTo: {
    goal: 'Collect the most points over the rounds. Each round has one target number, starting at 1.',
    turn: 'Three darts per visit, at the number of the round. Everyone throws once per round.',
    counts: 'Only the round number scores: its value times the multiplier (S5 is 5, D5 is 10, T5 is 15). Other numbers, the bull and misses score nothing.',
    win: 'A single, a double and a treble of the round number in one visit is a Shanghai and wins the game at once; alone it only scores. Otherwise the most points after the last round wins. A tie at the top goes to a tiebreak on 20 for the tied players only, repeated until someone leads.',
  },
  record: {
    variant: (o, players) => (players === 1 ? { key: `shanghai:solo:${o.rounds}`, label: `Shanghai · Solo · ${o.rounds} rounds` } : null),
    better: 'higher',
    format: v => plural(v, 'point'),
  },
  normalizeOptions: input => normalizeByDefs(OPTIONS, DEFAULTS, input),
  describe: o => `Shanghai · ${o.rounds} rounds`,
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
