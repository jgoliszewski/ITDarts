// Cricket: close 15–20 and the bull, score on what rivals still have open (docs/GRY.md). Pure, no I/O.
import type { Happening } from './effects.ts';
import type { BullOff } from './x01/rules.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns } from './turns.ts';
import { BULL_OFF, choiceLabel, compactTurns, dartSlot, frame, isValidTurnEvent, nextIn, normalizeByDefs, plural, replayTurns, turnHappenings, walk } from './turns.ts';

export interface CricketOptions {
  mode: 'standard' | 'cutthroat';
  bullOff: BullOff;
}

export const CRICKET_SECTORS = [20, 19, 18, 17, 16, 15, 25];

interface State extends Turn {
  marks: number[][];
  points: number[];
  darts: number[];
  /** Marks that counted, for MPR: closing marks plus marks that scored. */
  scoredMarks: number[];
  /** Per visit: the marks that counted, as in `scoredMarks`. */
  visitMarks: number[];
  winners: number[];
}

function play(t: Turns, players: number, o: CricketOptions): State {
  const marks = Array.from({ length: players }, () => CRICKET_SECTORS.map(() => 0));
  const points = Array(players).fill(0), darts = Array(players).fill(0), scoredMarks = Array(players).fill(0);
  const goods: boolean[][] = [], visitMarksAll: number[] = [];
  const closedAll = (p: number) => marks[p].every(m => m >= 3);
  const others = (p: number) => points.filter((_, i) => i !== p);
  const wins = (p: number) => closedAll(p) && (players === 1
    || (o.mode === 'standard' ? points[p] >= Math.max(...others(p)) : points[p] <= Math.min(...others(p))));
  const fx: Happening[] = [];
  let winner: number | null = null, left = 3;

  for (const [vi, v] of t.visits.entries()) {
    const p = v.player;
    let visitMarks = 0;
    const freshTrebles = new Set<number>();
    const w = walk(v, (d, di) => {
      if (winner !== null) return { good: false, end: true };
      const k = CRICKET_SECTORS.indexOf(d.n);
      if (k < 0) return { good: false };
      const add = Math.min(3 - marks[p][k], d.m);
      marks[p][k] += add;
      const extra = d.m - add;
      const open = [...Array(players).keys()].filter(r => r !== p && marks[r][k] < 3);
      const scores = extra > 0 && open.length > 0;
      if (scores) {
        if (o.mode === 'standard') points[p] += extra * d.n;
        else for (const r of open) points[r] += extra * d.n;
      }
      scoredMarks[p] += add + (scores ? extra : 0);
      visitMarks += add + (scores ? extra : 0);
      if (add === 3) freshTrebles.add(d.n);
      if (add > 0 && marks[p][k] === 3) fx.push({ slot: dartSlot(vi, di, 'closed'), fact: { kind: 'game', event: 'sectorClosed' } });
      // Cut-throat points land on rivals, so anyone may be the one who now wins.
      winner = wins(p) ? p : [...Array(players).keys()].find(wins) ?? null;
      return { good: add > 0 || scores, end: winner !== null };
    });
    goods.push(w.good);
    visitMarksAll.push(visitMarks);
    darts[p] += w.used;
    left = w.dartsLeft;
    // White Horse: three trebles on three different numbers, each one fresh.
    if (w.complete && visitMarks >= 5) {
      fx.push({ slot: `V${vi + 1}:marks`, fact: { kind: 'game', event: 'marks', marks: Math.min(visitMarks, 9), whiteHorse: freshTrebles.size === 3 } });
    }
  }
  if (winner !== null) fx.push({ slot: 'match:won', fact: { kind: 'matchWon' } });
  const last = t.visits.at(-1);
  const over = winner !== null;
  const current = !last ? t.order![0] : last.closed ? nextIn(last.player, t.order!) : last.player;
  return { over, current, dartsLeft: over ? 0 : last && !last.closed ? left : 3, goods, fx, marks, points, darts, scoredMarks, visitMarks: visitMarksAll, winners: over ? [winner!] : [] };
}

export interface CricketView extends MiniView {
  marks: number[][];
  points: number[];
  /** Per sector: closed by every player. */
  dead: boolean[];
  solo: boolean;
  /** Marks of the visit on screen, the headline of the turn card. */
  visitMarks: number;
}

const mpr = (marks: number, darts: number) => (darts ? (marks / darts) * 3 : 0);

function view(events: TurnEvent[], players: number, o: CricketOptions): CricketView {
  const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
  const s = play(t, players, o);
  const f = frame(t, s);
  const solo = players === 1;
  const p = f.current;
  const w = s.winners[0];
  return {
    ...f,
    winners: s.winners,
    hero: solo
      ? { big: String(s.darts[p]), caption: 'Darts', note: `MPR ${mpr(s.scoredMarks[p], s.darts[p]).toFixed(2)}` }
      : { big: String(s.points[p]), caption: 'Points', note: `MPR ${mpr(s.scoredMarks[p], s.darts[p]).toFixed(2)}` },
    rows: s.points.map((pts, i) => ({ value: solo ? String(s.darts[i]) : String(pts), meta: `MPR ${mpr(s.scoredMarks[i], s.darts[i]).toFixed(2)}`, out: false })),
    result: w === undefined ? '' : solo ? `Closed in ${plural(s.darts[w], 'dart')}` : `${plural(s.points[w], 'point')} · MPR ${mpr(s.scoredMarks[w], s.darts[w]).toFixed(2)}`,
    scores: s.darts.map(d => (solo && s.winners.length ? d : null)),
    stats: s.darts.map((d, i) => ({ darts: d, marks: s.scoredMarks[i] })),
    marks: s.marks,
    points: s.points,
    dead: CRICKET_SECTORS.map((_, k) => s.marks.every(m => m[k] >= 3)),
    solo,
    visitMarks: f.visit.darts.length ? s.visitMarks.at(-1) ?? 0 : 0,
  };
}

const OPTIONS: OptionDef<CricketOptions>[] = [
  {
    key: 'mode',
    label: 'Mode',
    info: 'Standard: your points go to you. Cut-throat: your points go to the rivals who still have the sector open, and the lowest score wins.',
    choices: [['standard', 'Standard'], ['cutthroat', 'Cut-throat']],
    when: (_o, players) => players >= 2,
  },
  BULL_OFF as OptionDef<CricketOptions>,
];

const DEFAULTS: CricketOptions = { mode: 'standard', bullOff: 'off' };

export const cricket: GameModule<CricketOptions, CricketView> = {
  id: 'cricket',
  name: 'Cricket',
  blurb: 'Close 15 to 20 and the bull, score on open ones.',
  group: 'versus',
  minPlayers: 1,
  defaults: DEFAULTS,
  options: OPTIONS,
  howTo: {
    goal: 'Close 15, 16, 17, 18, 19, 20 and the bull before your rivals, and stay ahead on points.',
    turn: 'Three darts per visit, at any of the cricket numbers. Other numbers do nothing.',
    counts: 'A single is 1 mark, a double 2, a treble 3; 25 is 1 mark and the bullseye 2. Three marks close a number. Extra marks on a number you closed score its value while a rival still has it open.',
    win: 'Standard: close everything with at least as many points as each rival. Cut-throat: your points go to rivals who have the number open, and you win by closing everything with the fewest points. Alone, close everything in as few darts as you can.',
  },
  record: {
    variant: (_o, players) => (players === 1 ? { key: 'cricket:solo', label: 'Cricket · Solo' } : null),
    better: 'lower',
    format: v => plural(v, 'dart'),
  },
  normalizeOptions: input => normalizeByDefs(OPTIONS, DEFAULTS, input),
  describe: (o, players) => (players === 1 ? 'Cricket · Solo' : `Cricket · ${choiceLabel(OPTIONS, o, 'mode')}`),
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
