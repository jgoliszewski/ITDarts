// Hare and Hounds: a chase round the board for two, the hare runs 20 targets, the hound catches him (docs/GRY.md). Pure, no I/O.
import { BOARD_ORDER } from './darts.ts';
import type { Happening } from './effects.ts';
import { TARGET, hits, targetLabel } from './race.ts';
import type { TargetMode } from './race.ts';
import type { BullOff } from './x01/rules.ts';
import type { GameModule, MiniView, OptionDef, Turn, TurnEvent, Turns } from './turns.ts';
import { BULL_OFF, choiceLabel, compactTurns, dartSlot, frame, isGone, isValidTurnEvent, nextUp, normalizeByDefs, replayTurns, turnHappenings, walk } from './turns.ts';

export interface HareOptions {
  target: TargetMode;
  headStart: 2 | 3 | 4 | 5;
  bullOff: BullOff;
}

const LAP = BOARD_ORDER.length;

/** The sector after standing at `pos` (counted from the hare's start on 20, negative behind it). */
const sectorAfter = (pos: number) => BOARD_ORDER[(((pos + 1) % LAP) + LAP) % LAP];
const sectorAt = (pos: number) => BOARD_ORDER[((pos % LAP) + LAP) % LAP];

interface State extends Turn {
  /** Targets the hare has cleared (he wins at 20) and the hound's hits. */
  hare: number;
  hound: number;
  /** Player index per role. */
  hareP: number;
  houndP: number;
  /** Winning player, null while running or when the match was ended. */
  winner: number | null;
  darts: number[];
  hits: number[];
}

function play(t: Turns, o: HareOptions): State {
  const [hareP, houndP] = t.order ?? [0, 1];
  let hare = 0, hound = 0, winner: number | null = null, over = false, left = 3;
  const darts = [0, 0], hit = [0, 0];
  const goods: boolean[][] = [];
  const fx: Happening[] = [];
  const win = (p: number) => {
    over = true;
    winner = p;
  };
  for (const [vi, v] of t.visits.entries()) {
    const isHare = v.player === hareP;
    const w = walk(v, (d, di) => {
      if (over) return { good: false, end: true };
      // The hound stands `headStart` sectors behind the hare's start, so his position is hound - headStart.
      const good = hits(d, isHare ? sectorAfter(hare) : sectorAfter(hound - o.headStart), o.target);
      if (good) {
        fx.push({ slot: dartSlot(vi, di, 'hit'), fact: { kind: 'game', event: 'targetHit' } });
        if (isHare) {
          if (++hare >= LAP) win(hareP);
        } else if (++hound - o.headStart === hare) win(houndP);
      }
      // The rest of a winning visit's darts are gone.
      return { good, end: over };
    });
    goods.push(w.good);
    darts[v.player] += w.used;
    hit[v.player] += w.good.filter(Boolean).length;
    left = w.dartsLeft;
  }
  // Without a pursuer the other one has won; End match with Save ends it with no winner.
  if (!over && (isGone(t, hareP) || isGone(t, houndP))) win(isGone(t, hareP) ? houndP : hareP);
  if (t.ended) over = true;
  if (winner !== null) fx.push({ slot: 'match:won', fact: { kind: 'matchWon' } });
  const last = t.visits.at(-1);
  const open = last && !last.closed ? last : null;
  return { over, current: open ? open.player : nextUp(t), dartsLeft: over ? 0 : open ? left : 3, goods, fx, hare, hound, hareP, houndP, winner, darts, hits: hit };
}

export interface HareView extends MiniView {
  /** Player indexes by role. */
  hare: number;
  hound: number;
  /** Sectors they stand on: the hare's last cleared one (20 at the start), the hound's. */
  hareSector: number;
  houndSector: number;
  /** Sectors from the hound to the hare. */
  gap: number;
  /** Targets the hare has cleared, of 20. */
  hareHits: number;
  /** The sector the player on turn aims at. */
  target: number;
}

function view(events: TurnEvent[], players: number, o: HareOptions): HareView {
  const t = replayTurns(events, players, o.bullOff, x => play(x, o));
  const s = play(t, o);
  const f = frame(t, s);
  const gap = s.hare + o.headStart - s.hound;
  const isHare = f.current === s.hareP;
  const target = isHare ? sectorAfter(s.hare) : sectorAfter(s.hound - o.headStart);
  const role = (p: number) => (p === s.hareP ? 'Hare' : 'Hound');
  const caught = s.winner === s.houndP && !isGone(t, s.hareP);
  const result = s.winner === null ? (s.over ? 'No winner' : '')
    : caught ? `Hound caught the hare on ${sectorAt(s.hare)}`
    : s.winner === s.hareP && s.hare >= LAP ? 'Hare made it round the board' : `${role(s.winner)} won`;
  return {
    ...f,
    // The visit that catches the hare headlines its turn card.
    visit: caught && f.visit.player === s.houndP ? { ...f.visit, verdict: { text: 'Caught', tone: 'good' } } : f.visit,
    winners: s.winner === null ? [] : [s.winner],
    hero: { big: targetLabel(target, o.target), caption: role(f.current), note: `Gap ${gap}` },
    // Hits of the hare of 20; the hound's of his way to the hare (hits + gap), so his bar fills as he closes in.
    rows: [0, 1].map(p => ({
      value: p === s.hareP ? `${s.hare} / ${LAP}` : `${s.hound} / ${s.hare + o.headStart}`,
      meta: role(p),
      out: false,
    })),
    result,
    scores: [null, null],
    stats: [0, 1].map(p => ({
      darts: s.darts[p], hits: s.hits[p],
      hareWins: s.winner === p && p === s.hareP ? 1 : 0,
      houndWins: s.winner === p && p === s.houndP ? 1 : 0,
    })),
    hare: s.hareP,
    hound: s.houndP,
    hareSector: sectorAt(s.hare),
    houndSector: sectorAt(s.hound - o.headStart),
    gap,
    hareHits: s.hare,
    target,
  };
}

const OPTIONS: OptionDef<HareOptions>[] = [
  // The bull is not on the way, so ATC's note on the bullseye does not apply.
  { ...(TARGET as OptionDef<HareOptions>), info: 'Which ring counts: any segment of the target, only its double or only its treble.' },
  {
    key: 'headStart',
    label: 'Head start',
    info: 'How many sectors the hound starts behind the hare. A longer head start helps the hare; 4 evens out Doubles and Trebles.',
    choices: [[2, '2'], [3, '3'], [4, '4'], [5, '5']],
  },
  BULL_OFF as OptionDef<HareOptions>,
];

const DEFAULTS: HareOptions = { target: 'any', headStart: 3, bullOff: 'off' };

const describe = (o: HareOptions) => ['Hare and Hounds', ...(o.target === 'any' ? [] : [choiceLabel(OPTIONS, o, 'target')]), `Head start ${o.headStart}`].join(' · ');

export const hareAndHounds: GameModule<HareOptions, HareView> = {
  id: 'hare',
  name: 'Hare and Hounds',
  blurb: 'A chase round the board for two.',
  group: 'versus',
  minPlayers: 2,
  maxPlayers: 2,
  defaults: DEFAULTS,
  options: OPTIONS,
  howTo: {
    goal: 'The hare runs once round the board, 20 targets from the 20 and back. The hound starts a few sectors behind and has to catch him.',
    turn: 'Three darts per visit. The player who throws first is the hare; a rematch swaps the roles. After a hit your next dart already goes at the next sector on the way.',
    counts: 'Your target is the next sector clockwise from where you stand: 1, 18, 4, 13 and on for the hare. With Doubles or Trebles only that ring counts. A double or treble moves you one sector, no skips.',
    win: 'The hare wins by clearing 20 targets. The hound wins by hitting the sector the hare stands on, and his remaining darts are gone. Tip: set Head start to 4 for Doubles and Trebles.',
  },
  normalizeOptions: input => normalizeByDefs(OPTIONS, DEFAULTS, input),
  describe,
  view,
  compact: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => play(x, o));
    const s = play(t, o);
    return compactTurns(t, s, players, s.winner);
  },
  happenings: (events, players, o) => {
    const t = replayTurns(events, players, o.bullOff, x => play(x, o));
    return turnHappenings(t, play(t, o));
  },
  isValidEvent: isValidTurnEvent,
};
