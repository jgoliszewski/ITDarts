// Gotcha: race to an exact score; landing on a rival's score sends them back to zero (docs/GRY.md). Pure, no I/O.
import type { Change, Happening } from './effects.ts';
import { value } from './darts.ts';
import type { BullOff } from './x01/rules.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns } from './turns.ts';
import { BULL_OFF, compactTurns, cutShort, frame, isGone, isValidTurnEvent, nextUp, normalizeByDefs, plural, replayTurns, rotate, turnHappenings, walk } from './turns.ts';

export interface GotchaOptions {
  target: 101 | 201 | 301;
  firstTo: number;
  bullOff: BullOff;
}

interface State extends Turn {
  totals: number[];
  gotchas: number[];
  /** Players sent to zero by the last visit. */
  zeroed: number[];
  /** Points of the visit on screen, 0 before its first dart or after a bust. */
  visitScore: number;
  winners: number[];
  points: number[];
  game: number;
  /** The finished visit on screen won a game (not the match); the game's scores stay until the takeout. */
  gameWon: boolean;
}

function play(t: Turns, players: number, o: GotchaOptions): State {
  const totals = Array(players).fill(0), gotchas = Array(players).fill(0);
  const goods: boolean[][] = [];
  const fx: Happening[] = [];
  const points = Array(players).fill(0);
  let over = false, winner: number | null = null, left = 3, zeroed: number[] = [], visitScore = 0;
  let game = 0, gameEnd = -1;
  /** The finished game's scores, shown while its winning visit is still open. */
  let held: number[] = [];

  for (const [vi, v] of t.visits.entries()) {
    const p = v.player, start = totals[p];
    let bust = false, won = false;
    const w = walk(v, d => {
      if (over) return { good: false, end: true };
      const sum = totals[p] + value(d);
      if (sum > o.target) {
        bust = true;
        return { good: false, end: true };
      }
      totals[p] = sum;
      won = sum === o.target;
      return { good: true, end: won };
    });
    if (bust) totals[p] = start;
    goods.push(w.good);
    left = w.dartsLeft;
    zeroed = [];
    visitScore = bust ? 0 : totals[p] - start;
    if (!w.complete || over) continue;

    const V = `V${vi + 1}`;
    if (bust) fx.push({ slot: `${V}:bust`, fact: { kind: 'bust' } });
    else fx.push({ slot: `${V}:total`, fact: { kind: 'calledTotal', total: totals[p] - start } });
    if (won) {
      points[p]++;
      if (points[p] >= o.firstTo) {
        over = true;
        winner = p;
        continue;
      }
      // Next game: everyone back to zero, the starter moves on one place in the playing order.
      fx.push({ slot: `G${game + 1}:won`, fact: { kind: 'checkout' } });
      held = [...totals];
      totals.fill(0);
      game++;
      gameEnd = vi;
      fx.push({ slot: `G${game + 1}:start`, fact: { kind: 'legStart' } });
      continue;
    }
    // At the end of the visit, a changed score sends every rival on the same score back to zero. A visit cut short by
    // the thrower's removal keeps its points but sends no one back (docs/UI.md#wycofanie-gracza).
    if (!bust && totals[p] !== start && !cutShort(t, vi)) {
      zeroed = totals.map((x, q) => (q !== p && x === totals[p] && !isGone(t, q, vi) ? q : -1)).filter(q => q >= 0);
      for (const q of zeroed) totals[q] = 0;
      gotchas[p] += zeroed.length;
      if (zeroed.length) fx.push({ slot: `${V}:gotcha`, fact: { kind: 'game', event: 'gotcha' } });
    }
  }
  if (over) fx.push({ slot: 'match:won', fact: { kind: 'matchWon' } });

  const last = t.visits.at(-1);
  const open = last && !last.closed ? last : null;
  const gameEnded = gameEnd >= 0 && gameEnd === t.visits.length - 1;
  const starter = gameEnded ? rotate(t.order!, game).find(q => !isGone(t, q)) : undefined;
  const current = open ? open.player : over ? last!.player : starter ?? nextUp(t);
  const gameWon = gameEnded && !!open;
  // `zeroed` is the last visit's, also after its Takeout, until the next visit's first dart: a visit cut short by Next player
  // is only decided then. The visit's points stay on screen only while the visit does.
  const shown = !!last && (!last.closed || over);
  return { over, current, dartsLeft: over ? 0 : open ? left : 3, goods, fx, totals: gameWon ? held : totals, gotchas, zeroed, visitScore: shown ? visitScore : 0, winners: winner === null ? [] : [winner], points, game, gameWon };
}

export interface GotchaView extends MiniView {
  target: number;
  totals: number[];
  /** Players sent to zero by the last visit, kept until the next visit's first dart. */
  zeroed: number[];
  visitScore: number;
  points: number[];
  game: number;
}

function view(events: TurnEvent[], players: number, o: GotchaOptions): GotchaView {
  const t = replayTurns(events, players, o.bullOff, x => play(x, players, o));
  const s = play(t, players, o);
  const f = frame(t, s);
  const left = (i: number) => o.target - s.totals[i];
  const multi = o.firstTo > 1;
  return {
    ...f,
    visit: { ...f.visit, verdict: f.visit.verdict ?? (s.gameWon ? { text: 'Game won', tone: 'good' } : null) },
    winners: s.winners,
    hero: { big: String(s.totals[f.current]), caption: 'Score', note: `${multi ? `Game ${s.gameWon ? s.game : s.game + 1} · ` : ''}Left ${left(f.current)}` },
    rows: s.totals.map((x, i) => ({ value: String(x), meta: `Left ${left(i)}${multi ? ` · ${plural(s.points[i], 'point')}` : ''}`, out: false })),
    result: !s.over ? '' : multi ? `Points ${[...s.points].sort((a, b) => b - a).join('–')}` : `Hit ${o.target} exactly`,
    scores: s.totals.map(() => null),
    stats: s.gotchas.map(g => ({ gotchas: g })),
    target: o.target,
    totals: s.totals,
    zeroed: s.zeroed,
    visitScore: s.visitScore,
    points: s.points,
    game: s.game + 1,
  };
}

/** The caller in Gotcha and Knockout: the visit's score as in X01, busted, and nothing else (no “you require”, no game shot). */
export const callerLinesGotcha = (cs: Change[]): string[] =>
  cs.flatMap(({ fact, before }) => {
    if (fact.kind === 'legStart' && !before) return ['gameon'];
    if (fact.kind === 'calledTotal') return [fact.total > 0 ? String(fact.total) : 'busted'];
    return fact.kind === 'bust' ? ['busted'] : [];
  });

const OPTIONS: OptionDef<GotchaOptions>[] = [
  {
    key: 'target',
    label: 'Target',
    info: 'The exact score to reach, counting up from 0. No double needed; going over is a bust.',
    choices: [[101, '101'], [201, '201'], [301, '301']],
  },
  {
    key: 'firstTo',
    label: 'First to',
    info: 'Games to win the match. Each game starts again from 0 with the same target.',
    choices: [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']],
  },
  BULL_OFF as OptionDef<GotchaOptions>,
];

const DEFAULTS: GotchaOptions = { target: 201, firstTo: 1, bullOff: 'off' };

export const gotcha: GameModule<GotchaOptions, GotchaView> = {
  id: 'gotcha',
  name: 'Gotcha',
  blurb: 'Race to an exact score. Match a rival to send them back to zero.',
  group: 'versus',
  minPlayers: 2,
  defaults: DEFAULTS,
  options: OPTIONS,
  howTo: {
    goal: 'Be the first to reach the target score exactly, counting up from 0.',
    turn: 'Three darts per visit. Your points add to your score.',
    counts: 'Every dart counts at face value; no double is needed. Going over the target is a bust: your score goes back to where the visit started and the visit ends.',
    win: 'Hit the target exactly and you win the game at once, even in the middle of a visit; first to the set number of games wins the match. Gotcha: if your visit ends on the same score as a rival, that rival goes back to 0. A bust or a visit that scores nothing zeroes nobody.',
  },
  points: { of: v => v.points, show: o => o.firstTo > 1 },
  normalizeOptions: input => normalizeByDefs(OPTIONS, DEFAULTS, input),
  describe: o => `Gotcha · ${o.target}${o.firstTo > 1 ? ` · First to ${o.firstTo}` : ''}`,
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
