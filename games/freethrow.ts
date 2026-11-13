// Free throw: practice throws with no target and no winner; the visit total is what counts (docs/GRY.md). Pure, no I/O.
import { value } from './darts.ts';
import type { Change, Happening } from './effects.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns } from './turns.ts';
import { compactTurns, frame, isValidTurnEvent, nextUp, normalizeByDefs, plural, replayTurns, turnHappenings, walk } from './turns.ts';

export interface FreethrowOptions {
  /** Visits that end the game, 0 for no limit. */
  visits: 0 | 10 | 20 | 30;
}

interface State extends Turn {
  darts: number;
  points: number;
  /** Complete visits. */
  visits: number;
  best: number;
  v60: number;
  v80: number;
  v100: number;
}

const sum = (v: { darts: { dart: Parameters<typeof value>[0] }[] }) => v.darts.reduce((a, r) => a + value(r.dart), 0);

function play(t: Turns, o: FreethrowOptions): State {
  const s = { darts: 0, points: 0, visits: 0, best: 0, v60: 0, v80: 0, v100: 0 };
  const goods: boolean[][] = [];
  const fx: Happening[] = [];
  let left = 3, over = false;
  for (const [vi, v] of t.visits.entries()) {
    if (over) break;
    // No dart is a miss in the view: every dart is shown alike.
    const w = walk(v, () => ({ good: true }));
    goods.push(w.good);
    left = w.dartsLeft;
    const total = sum(v);
    s.darts += v.darts.length;
    s.points += total;
    if (!w.complete) continue;
    s.visits++;
    s.best = Math.max(s.best, total);
    if (total >= 60) s.v60++;
    if (total >= 80) s.v80++;
    if (total >= 100) s.v100++;
    // The same fact and slot as an X01 visit without a bust, so every visit rule fires as in X01.
    fx.push({ slot: `L1V${vi + 1}`, fact: { kind: 'visit', total, darts: v.darts.map(r => r.dart), checkout: false } });
    // The last visit of the limit stays on screen until it is closed (Takeout), like any other visit.
    if (o.visits && s.visits >= o.visits && v.closed) over = true;
  }
  if (t.ended) over = true;
  const last = t.visits.at(-1);
  const open = last && !last.closed && !over ? last : null;
  return { over, current: nextUp(t), dartsLeft: over ? 0 : open ? left : 3, goods, fx, ...s };
}

export interface FreethrowView extends MiniView {
  /** Sum of the visit on screen. */
  visitTotal: number;
}

const fmtAvg = (a: number | null) => (a === null ? '–' : a.toFixed(1));

function view(events: TurnEvent[], players: number, o: FreethrowOptions): FreethrowView {
  const t = replayTurns(events, players, 'off', x => play(x, o));
  const s = play(t, o);
  const f = frame(t, s);
  const average = s.darts ? (s.points / s.darts) * 3 : null;
  const shown = f.visit.darts.length > 0;
  const visitNo = o.visits ? Math.min(o.visits, shown ? t.visits.length : t.visits.length + 1) : shown ? t.visits.length : t.visits.length + 1;
  const visitTotal = sum(f.visit);
  return {
    ...f,
    winners: [],
    hero: { big: String(visitTotal), caption: 'This visit', note: o.visits ? `Visit ${visitNo} of ${o.visits}` : '' },
    rows: [{ value: fmtAvg(average), meta: `average · ${plural(s.darts, 'dart')}`, out: false }],
    result: s.over ? `${plural(s.visits, 'visit')} · average ${fmtAvg(average)}` : '',
    scores: [null],
    stats: [{ darts: s.darts, points: s.points, visits: s.visits, best: s.best, v60: s.v60, v80: s.v80, v100: s.v100 }],
    visitTotal,
  };
}

/** The caller as in X01 for a plain visit: the total, 0 as busted; no checkout, no “you require”. */
export const callerLinesFreethrow = (cs: Change[]): string[] =>
  cs.flatMap(({ fact, before }) => {
    if (fact.kind === 'legStart' && !before) return ['gameon'];
    return fact.kind === 'visit' ? [fact.total > 0 ? String(fact.total) : 'busted'] : [];
  });

const OPTIONS: OptionDef<FreethrowOptions>[] = [
  {
    key: 'visits',
    label: 'Visits',
    info: 'Visits after which the game ends by itself. Unlimited: play until you end the match.',
    choices: [[0, 'Unlimited'], [10, '10'], [20, '20'], [30, '30']],
  },
];

const DEFAULTS: FreethrowOptions = { visits: 0 };

export const freethrow: GameModule<FreethrowOptions, FreethrowView> = {
  id: 'freethrow',
  name: 'Free throw',
  blurb: 'Practice darts with no target. Just the visit totals.',
  group: 'practice',
  minPlayers: 1,
  maxPlayers: 1,
  defaults: DEFAULTS,
  options: OPTIONS,
  howTo: {
    goal: 'Practice: there is no target and nobody wins.',
    turn: 'Three darts per visit, then Takeout. Alone only.',
    counts: 'Every dart counts at face value, as in X01. The screen shows the total of the visit, your average of 3 darts and your best visit.',
    win: 'The game has no winner. With a limit it ends after the last visit; Unlimited has no end of its own: End match and Save.',
  },
  normalizeOptions: input => normalizeByDefs(OPTIONS, DEFAULTS, input),
  describe: o => (o.visits ? `Free throw · ${o.visits} visits` : 'Free throw'),
  view,
  compact: (events, players, o) => {
    const t = replayTurns(events, players, 'off', x => play(x, o));
    return compactTurns(t, play(t, o), players, null);
  },
  happenings: (events, players, o) => {
    const t = replayTurns(events, players, 'off', x => play(x, o));
    return turnHappenings(t, play(t, o));
  },
  isValidEvent: isValidTurnEvent,
};
