// X01 match engine: replays the event log of one match into its state. Pure, no I/O.
import type { BullDart, BullEvent, BullOffView } from '../bulloff.ts';
import { beforeStart, bullView, fromStarter, undoStart } from '../bulloff.ts';
import type { Coords, Dart } from '../darts.ts';
import { MISS } from '../darts.ts';
import type { Happening } from '../effects.ts';
import type { Removal, RemoveEvent, Removed } from '../turns.ts';
import { hintLines } from './checkout.ts';
import type { X01Options } from './rules.ts';
import { scoreDart } from './rules.ts';

export type X01Event =
  | { t: 'start'; starter: number }
  | { t: 'dart'; dart: Dart; coords?: Coords; at: number }
  | { t: 'fix'; index: number; dart: Dart }
  | { t: 'undo' }
  | { t: 'next'; at?: number }
  | { t: 'nextLeg' }
  | RemoveEvent
  | BullEvent;

export interface DartRec {
  dart: Dart;
  coords?: Coords;
  at: number;
}

interface VisitRec {
  player: number;
  darts: DartRec[];
  /** Misses added when the visit was closed with fewer than three darts. */
  filled: number;
  closed: boolean;
  /** Ended by its thrower's removal: only the darts thrown count (docs/UI.md#wycofanie-gracza). */
  cut?: boolean;
}

interface LegRec {
  set: number;
  starter: number;
  visits: VisitRec[];
}

export interface Raw {
  /** Playing order from the bull-off or the pilot's pick; null until it is known. */
  order: number[] | null;
  legs: LegRec[];
  bull: BullDart[];
  /** Removals; `at` is the index of the leg they happened in. */
  removed: Removal[];
}

export interface VisitResult {
  player: number;
  darts: DartRec[];
  start: number;
  scored: number;
  bust: boolean;
  /** Index of the dart that finished the leg, or -1. */
  checkoutAt: number;
  closed: boolean;
  /** Darts that count for averages: 3 for a closed visit, fewer only for the finishing one. */
  dartsCount: number;
  /** Darts that still take effect (nothing after a bust or a checkout). */
  live: number;
  /** Score left after each live dart, or null when the dart did not change it. */
  left: (number | null)[];
}

export interface LegResult {
  set: number;
  starter: number;
  visits: VisitResult[];
  scores: number[];
  winner: number | null;
}

// ---------- analysis ----------

export function analyzeLeg(leg: LegRec, players: number, o: X01Options): LegResult {
  const scores = Array.from({ length: players }, () => o.startScore);
  const checkedIn = Array.from({ length: players }, () => o.checkIn === 'straight');
  let winner: number | null = null;
  const visits: VisitResult[] = leg.visits.map(v => {
    const start = scores[v.player];
    let remaining = start;
    let inn = checkedIn[v.player];
    let bust = false;
    let checkoutAt = -1;
    let live = 0;
    const left: (number | null)[] = [];
    for (const [i, rec] of v.darts.entries()) {
      if (bust || checkoutAt >= 0) break;
      const r = scoreDart(remaining, inn, rec.dart, o);
      live = i + 1;
      inn = r.checkedIn;
      if (r.bust) bust = true;
      else {
        remaining -= r.scored;
        if (r.checkout) checkoutAt = i;
      }
      left.push(r.scored > 0 && !r.checkout ? remaining : null);
    }
    if (bust) remaining = start;
    scores[v.player] = remaining;
    checkedIn[v.player] = inn;
    if (checkoutAt >= 0) winner = v.player;
    const dartsCount = checkoutAt >= 0 ? checkoutAt + 1 : v.closed && !v.cut ? 3 : v.darts.length;
    return { player: v.player, darts: v.darts, start, scored: bust ? 0 : start - remaining, bust, checkoutAt, closed: v.closed, dartsCount, live, left };
  });
  return { set: leg.set, starter: leg.starter, visits, scores, winner };
}

interface Tally {
  legs: number[];
  sets: number[];
  matchWinner: number | null;
  /** Set number for the leg after the current one. */
  nextSet: number;
}

function tally(results: LegResult[], players: number, o: X01Options): Tally {
  const legs = Array(players).fill(0);
  const sets = Array(players).fill(0);
  let matchWinner: number | null = null;
  let set = 1;
  const mm = o.matchMode;
  for (const r of results) {
    if (r.winner === null) continue;
    legs[r.winner]++;
    if (mm.kind === 'legs' && legs[r.winner] >= mm.firstTo) matchWinner = r.winner;
    if (mm.kind === 'sets' && legs[r.winner] >= mm.legsPerSet) {
      sets[r.winner]++;
      legs.fill(0);
      set++;
      if (sets[r.winner] >= mm.firstTo) matchWinner = r.winner;
    }
  }
  return { legs, sets, matchWinner, nextSet: set };
}

// ---------- reducer ----------

export function initialRaw(o: X01Options, players: number): Raw {
  return o.bullOff === 'off'
    ? { order: fromStarter(0, players), legs: [{ set: 1, starter: 0, visits: [] }], bull: [], removed: [] }
    : { order: null, legs: [], bull: [], removed: [] };
}

/** How player `p` is out of leg `li` (docs/UI.md#wycofanie-gracza): for the match from that leg on, or for that leg only. */
export function removedIn(raw: Raw, li: number, p: number): Removed {
  const mine = raw.removed.filter(x => x.player === p);
  return mine.some(x => x.scope === 'match' && x.at <= li) ? 'match' : mine.some(x => x.scope === 'leg' && x.at === li) ? 'leg' : null;
}

/** Next in the playing order after `p`, skipping those removed from leg `li`. */
function nextInLeg(raw: Raw, li: number, p: number): number {
  const order = raw.order!;
  const i = order.indexOf(p);
  for (let k = 1; k <= order.length; k++) {
    const q = order[(i + k) % order.length];
    if (!removedIn(raw, li, q)) return q;
  }
  return p;
}

function currentPlayer(raw: Raw, r: LegResult): number {
  if (r.winner !== null) return r.winner;
  const li = raw.legs.length - 1;
  const last = r.visits.at(-1);
  if (last) return last.closed ? nextInLeg(raw, li, last.player) : last.player;
  return removedIn(raw, li, r.starter) ? nextInLeg(raw, li, r.starter) : r.starter;
}

function startNextLeg(raw: Raw, results: LegResult[], players: number, o: X01Options) {
  const leg = raw.legs.at(-1)!;
  const last = leg.visits.at(-1);
  if (last) last.closed = true;
  const set = tally(results, players, o).nextSet;
  // The starter moves on by one place in the playing order each leg, past those removed from the match;
  // one removed from a leg only keeps his turn to start.
  const order = raw.order!;
  let starter = order[(order.indexOf(leg.starter) + 1) % players];
  while (raw.removed.some(r => r.player === starter && r.scope === 'match') && starter !== leg.starter) {
    starter = order[(order.indexOf(starter) + 1) % players];
  }
  raw.legs.push({ set, starter, visits: [] });
}

const mark = (raw: Raw) => {
  const leg = raw.legs.at(-1);
  const last = leg?.visits.at(-1);
  return `${raw.legs.length}:${leg?.visits.length ?? 0}:${last?.darts.length ?? 0}:${last?.closed ?? true}`;
};

/** Closes the open visit: Next player fills in misses, unless the visit already ended with a bust. */
function closeVisit(visit: VisitRec, bust: boolean, at: number | undefined) {
  if (!bust) {
    while (visit.darts.length < 3) {
      visit.darts.push({ dart: MISS, at: at ?? visit.darts.at(-1)?.at ?? 0 });
      visit.filled++;
    }
  }
  visit.closed = true;
}

function reopenLast(leg: LegRec) {
  const last = leg.visits.at(-1);
  if (!last) return;
  last.closed = false;
  last.cut = false;
  last.darts.splice(last.darts.length - last.filled);
  last.filled = 0;
  if (last.darts.length === 0) leg.visits.pop();
}

export function applyEvent(raw: Raw, e: X01Event, players: number, o: X01Options): void {
  if (raw.order === null) {
    const order = beforeStart(raw.bull, e, players, o.bullOff);
    if (order !== null) {
      raw.order = order;
      raw.legs = [{ set: 1, starter: order[0], visits: [] }];
    }
    return;
  }
  const leg = raw.legs.at(-1)!;
  const results = raw.legs.map(l => analyzeLeg(l, players, o));
  const cur = results.at(-1)!;
  const t = tally(results, players, o);
  const open = leg.visits.at(-1)?.closed === false ? leg.visits.at(-1)! : null;
  const openResult = open ? cur.visits.at(-1)! : null;
  const removal = raw.removed.at(-1);
  if (e.t === 'undo' && removal?.mark === mark(raw)) {
    raw.removed.pop();
    if (removal.closed) reopenLast(leg);
    return;
  }

  switch (e.t) {
    case 'remove': {
      const li = raw.legs.length - 1;
      const already = removedIn(raw, li, e.player);
      if (e.player < 0 || e.player >= players || already === 'match' || (already && e.scope === 'leg') || t.matchWinner !== null) return;
      if (e.scope === 'leg' && cur.winner !== null) return;
      // Removed during their own visit: it ends with the darts thrown, no misses filled in.
      const closed = !!open && open.player === e.player && cur.winner === null;
      if (closed) {
        open!.closed = true;
        open!.cut = true;
      }
      raw.removed.push({ player: e.player, scope: e.scope, at: li, closed, cut: closed, mark: mark(raw) });
      return;
    }
    case 'start':
    case 'bull':
      return;
    case 'dart': {
      if (cur.winner !== null) return;
      if (openResult && (openResult.bust || openResult.checkoutAt >= 0 || open!.darts.length >= 3)) return;
      const visit = open ?? { player: currentPlayer(raw, cur), darts: [], filled: 0, closed: false };
      if (!open) leg.visits.push(visit);
      visit.darts.push({ dart: e.dart, coords: e.coords, at: e.at });
      return;
    }
    case 'fix': {
      if (!open || e.index < 0 || e.index >= open.darts.length) return;
      // A fixed dart keeps its time but loses the board coordinates.
      open.darts[e.index] = { dart: e.dart, at: open.darts[e.index].at };
      return;
    }
    case 'undo': {
      if (open) {
        open.darts.pop();
        if (open.darts.length === 0) leg.visits.pop();
      } else if (leg.visits.length > 0) {
        reopenLast(leg);
      } else if (raw.legs.length > 1) {
        raw.legs.pop();
        reopenLast(raw.legs.at(-1)!);
      } else if (o.bullOff !== 'off') {
        undoStart(raw.bull, players, o.bullOff);
        raw.order = null;
        raw.legs = [];
      }
      return;
    }
    case 'next': {
      if (cur.winner !== null) {
        if (t.matchWinner === null && o.matchMode.kind !== 'off') startNextLeg(raw, results, players, o);
        return;
      }
      const visit = open ?? { player: currentPlayer(raw, cur), darts: [], filled: 0, closed: false };
      if (!open) leg.visits.push(visit);
      closeVisit(visit, !!openResult?.bust, e.at);
      return;
    }
    case 'nextLeg': {
      if (cur.winner !== null && t.matchWinner === null) startNextLeg(raw, results, players, o);
      return;
    }
  }
}

export function replay(events: X01Event[], players: number, o: X01Options): Raw {
  const raw = initialRaw(o, players);
  for (const e of events) applyEvent(raw, e, players, o);
  return raw;
}

// ---------- view ----------

export interface PlayerMatchStats {
  legAvg: number | null;
  matchAvg: number | null;
  bestVisit: number;
  c60: number;
  c80: number;
  c100: number;
  /** Last closed visits, oldest first; null marks a bust. */
  lastVisits: (number | null)[];
}

export interface X01View {
  phase: 'bulloff' | 'throwing' | 'legWon' | 'matchWon';
  current: number;
  set: number;
  legNo: number;
  scores: number[];
  legs: number[];
  sets: number[];
  checkedIn: boolean[];
  visit: { player: number; darts: DartRec[]; total: number; bust: boolean; checkout: boolean; dartsLeft: number };
  /** Checkout route for the darts left, or null. */
  checkout: string | null;
  /** Setup darts for the next visit when no checkout is on, or null. */
  setup: string | null;
  lastLeg: { winner: number; checkout: Dart; darts: number; avg: number | null } | null;
  matchWinner: number | null;
  stats: PlayerMatchStats[];
  bullOff: BullOffView | null;
  /** Playing order, null during the bull-off. */
  order: number[] | null;
  /** Per player: removed from the match or from this leg (docs/UI.md#wycofanie-gracza). */
  removed: Removed[];
}

const avg = (points: number, darts: number) => (darts > 0 ? Math.round((points / darts) * 3 * 100) / 100 : null);

function playerStats(results: LegResult[], p: number): PlayerMatchStats {
  let points = 0, darts = 0, legPoints = 0, legDarts = 0, best = 0, c60 = 0, c80 = 0, c100 = 0;
  const visits: (number | null)[] = [];
  results.forEach((r, i) => {
    for (const v of r.visits) {
      if (v.player !== p) continue;
      points += v.scored;
      darts += v.dartsCount;
      if (i === results.length - 1) {
        legPoints += v.scored;
        legDarts += v.dartsCount;
      }
      if (!v.closed && v.checkoutAt < 0) continue;
      best = Math.max(best, v.scored);
      if (v.scored >= 100) c100++;
      else if (v.scored >= 80) c80++;
      else if (v.scored >= 60) c60++;
      visits.push(v.bust ? null : v.scored);
    }
  });
  return { legAvg: avg(legPoints, legDarts), matchAvg: avg(points, darts), bestVisit: best, c60, c80, c100, lastVisits: visits.slice(-6) };
}

export function view(raw: Raw, players: number, o: X01Options): X01View {
  const stats = Array.from({ length: players }, (_, p) => playerStats([], p));
  if (raw.order === null) {
    return {
      phase: 'bulloff', current: 0, set: 1, legNo: 1,
      scores: Array(players).fill(o.startScore), legs: Array(players).fill(0), sets: Array(players).fill(0),
      checkedIn: Array(players).fill(o.checkIn === 'straight'),
      visit: { player: 0, darts: [], total: 0, bust: false, checkout: false, dartsLeft: 3 },
      checkout: null, setup: null, lastLeg: null, matchWinner: null, stats,
      bullOff: bullView(raw.bull, players, o.bullOff), order: null, removed: Array(players).fill(null),
    };
  }
  const results = raw.legs.map(l => analyzeLeg(l, players, o));
  const cur = results.at(-1)!;
  const t = tally(results, players, o);
  const current = currentPlayer(raw, cur);
  const last = cur.visits.at(-1);
  const openVisit = last && (!last.closed || cur.winner !== null) ? last : null;
  const visitDarts = openVisit ? openVisit.darts : [];
  const total = openVisit ? openVisit.scored : 0;
  const dartsLeft = openVisit && !openVisit.closed ? (openVisit.bust || openVisit.checkoutAt >= 0 ? 0 : 3 - openVisit.darts.length) : 3;

  // Checked-in state per player as of now.
  const checkedIn = Array.from({ length: players }, (_, p) => {
    if (o.checkIn === 'straight') return true;
    return cur.visits.some(v => v.player === p && v.darts.slice(0, v.live).some(d => d.dart.m === 2 && d.dart.n > 0));
  });

  let lastLeg: X01View['lastLeg'] = null;
  const wonLeg = cur.winner !== null ? cur : null;
  if (wonLeg) {
    const winVisit = wonLeg.visits.find(v => v.checkoutAt >= 0)!;
    const mine = wonLeg.visits.filter(v => v.player === wonLeg.winner);
    const darts = mine.reduce((a, v) => a + v.dartsCount, 0);
    lastLeg = {
      winner: wonLeg.winner!,
      checkout: winVisit.darts[winVisit.checkoutAt].dart,
      darts,
      avg: avg(o.startScore, darts),
    };
  }

  const remaining = cur.scores[current];
  const hints = cur.winner === null && checkedIn[current] ? hintLines(remaining, dartsLeft, o.checkOut, total, visitDarts.slice(0, openVisit?.live ?? 0).map(d => d.dart)) : { checkout: null, setup: null };
  const legNo = o.matchMode.kind === 'sets' ? results.filter(r => r.set === cur.set).length : results.length;

  return {
    phase: t.matchWinner !== null ? 'matchWon' : cur.winner !== null ? 'legWon' : 'throwing',
    current,
    set: cur.set,
    legNo,
    scores: cur.scores,
    legs: t.legs,
    sets: t.sets,
    checkedIn,
    visit: {
      player: current,
      darts: visitDarts,
      total,
      bust: openVisit?.bust ?? false,
      checkout: (openVisit?.checkoutAt ?? -1) >= 0,
      dartsLeft,
    },
    ...hints,
    lastLeg,
    matchWinner: t.matchWinner,
    stats: Array.from({ length: players }, (_, p) => playerStats(results, p)),
    bullOff: bullView(raw.bull, players, o.bullOff),
    order: raw.order,
    removed: Array.from({ length: players }, (_, p) => removedIn(raw, raw.legs.length - 1, p)),
  };
}

// ---------- effects ----------

/** Every Wyzwalacz occurrence so far (games/effects.ts). Slots are leg, visit and dart numbers. */
export function happenings(raw: Raw, players: number, o: X01Options): Happening[] {
  if (raw.order === null) return [];
  const out: Happening[] = [];
  const results = raw.legs.map(l => analyzeLeg(l, players, o));
  let sets = 0;
  results.forEach((r, li) => {
    const L = `L${li + 1}`;
    out.push({ slot: `${L}:start`, fact: { kind: 'legStart' } });
    r.visits.forEach((v, vi) => {
      const V = `${L}V${vi + 1}`;
      // Misses filled in by Next player are no throws.
      const thrown = v.darts.length - raw.legs[li].visits[vi].filled;
      v.darts.slice(0, Math.min(thrown, v.live)).forEach((d, di) => {
        out.push({ slot: `${V}D${di + 1}`, fact: { kind: 'dart', dart: d.dart } });
        const left = v.left[di];
        // A bust later in the visit does not take back what this dart left.
        if (left !== null) out.push({ slot: `${V}D${di + 1}:left`, fact: { kind: 'left', score: left } });
      });
      if (!(v.closed || v.bust || v.checkoutAt >= 0 || v.darts.length >= 3)) return;
      out.push({
        slot: V,
        fact: v.bust ? { kind: 'bust' } : { kind: 'visit', total: v.scored, darts: v.darts.slice(0, v.live).map(d => d.dart), checkout: v.checkoutAt >= 0 },
      });
    });
    if (r.winner === null) return;
    out.push({ slot: `${L}:won`, fact: { kind: 'checkout' } });
    const t = tally(results.slice(0, li + 1), players, o);
    const setsNow = t.sets.reduce((a, b) => a + b, 0);
    if (setsNow > sets) out.push({ slot: `S${setsNow}:won`, fact: { kind: 'setWon' } });
    sets = setsNow;
    if (t.matchWinner !== null) out.push({ slot: 'match:won', fact: { kind: 'matchWon' } });
  });
  return out;
}

// ---------- history ----------

export interface VisitRecord {
  player: number;
  /** 1-based visit number of this player in the leg. */
  visitNo: number;
  start: number;
  scored: number;
  bust: boolean;
  checkout: boolean;
  dartsCount: number;
  darts: DartRec[];
}

export interface LegRecord {
  set: number;
  legNo: number;
  starter: number;
  winner: number | null;
  visits: VisitRecord[];
}

/** Compacts the match to the darts that stand, as stored in history (ADR 0004). */
export function compact(raw: Raw, players: number, o: X01Options): LegRecord[] {
  const results = raw.legs.map(l => analyzeLeg(l, players, o));
  const perSet = new Map<number, number>();
  return results
    .map(r => {
      const legNo = (perSet.get(r.set) ?? 0) + 1;
      perSet.set(r.set, legNo);
      const counter = Array(players).fill(0);
      return {
        set: r.set,
        legNo,
        starter: r.starter,
        winner: r.winner,
        visits: r.visits
          .filter(v => v.darts.length > 0)
          .map(v => ({
            player: v.player,
            visitNo: ++counter[v.player],
            start: v.start,
            scored: v.scored,
            bust: v.bust,
            checkout: v.checkoutAt >= 0,
            dartsCount: v.dartsCount,
            darts: v.darts.slice(0, v.bust || v.checkoutAt >= 0 ? v.live : v.darts.length),
          })),
      };
    })
    .filter(l => l.visits.length > 0);
}
