// Match summary (docs/UI.md, Podsumowanie meczu): numbers and dart positions of one match, guests included. Pure.
import type { GameId, MiniView } from './turns.ts';
import type { LegRecord, X01View } from './x01/engine.ts';
import type { CheckOut } from './x01/rules.ts';
import type { X01Stats } from './x01/stats.ts';
import { x01Stats } from './x01/stats.ts';

/** Where one player's darts landed: board coords (1 = 170 mm, y up), darts without a position, and visits thrown. */
export interface PlayerHeat {
  darts: [number, number][];
  noPos: number;
  visits: number;
}

export interface MatchReport {
  game: GameId;
  description: string;
  kicker: string;
  title: string;
  line: string;
  names: string[];
  heat: PlayerHeat[];
  /** Metres walked to the board and back, per player. */
  distance: number[];
  x01: X01Stats[] | null;
  /** The minigame's own per-player totals, as kept in history. */
  totals: Record<string, number>[] | null;
}

/** Each visit is a walk to the board and back. */
export const walked = (visits: number, ocheMeters: number) => Math.round(visits * 2 * ocheMeters * 10) / 10;

export function heatOf(legs: LegRecord[], players: number): PlayerHeat[] {
  const out = Array.from({ length: players }, (): PlayerHeat => ({ darts: [], noPos: 0, visits: 0 }));
  for (const leg of legs) for (const v of leg.visits) {
    const h = out[v.player];
    h.visits++;
    for (const d of v.darts) {
      if (d.coords) h.darts.push([Math.round(d.coords.x * 1e4) / 1e4, Math.round(d.coords.y * 1e4) / 1e4]);
      else h.noPos++;
    }
  }
  return out;
}

export function x01Of(legs: LegRecord[], players: number, checkOut: CheckOut): X01Stats[] {
  return Array.from({ length: players }, (_, p) => x01Stats(legs.flatMap((leg, legId) => leg.visits.filter(v => v.player === p).map(v => ({
    legId,
    legFinished: leg.winner !== null,
    visitNo: v.visitNo,
    start: v.start,
    scored: v.scored,
    bust: v.bust,
    checkout: v.checkout,
    dartsCount: v.dartsCount,
    darts: v.darts.map(d => d.dart),
    checkOut,
  })))));
}

export function matchReport(m: {
  game: GameId;
  description: string;
  names: string[];
  legs: LegRecord[];
  view: X01View | MiniView;
  checkOut: CheckOut | null;
  ended: boolean;
  ocheMeters: number;
}): MatchReport {
  const n = m.names.length;
  const heat = heatOf(m.legs, n);
  let kicker: string, title: string, line: string;
  if ('winners' in m.view) {
    const w = m.view.winners;
    kicker = m.ended ? 'MATCH ENDED' : w.length > 1 ? 'SHARED WIN' : w.length === 1 ? 'WINNER' : 'GAME OVER';
    title = w.length ? w.map(i => m.names[i]).join(' & ') : n > 1 ? 'Team' : m.names[0];
    line = m.view.result;
  } else {
    const v = m.view;
    const sets = v.sets.some(s => s > 0);
    const won = sets ? v.sets : v.legs;
    // An ended match with no leg won has no score to show.
    line = won.some(x => x > 0) ? [...won].sort((a, b) => b - a).join('–') : '';
    const best = Math.max(...v.legs);
    const leader = v.matchWinner ?? (v.legs.filter(x => x === best).length === 1 ? v.legs.indexOf(best) : null);
    // The same words as the minigames (docs/UI.md, Start i koniec meczu).
    kicker = m.ended ? 'MATCH ENDED' : 'WINNER';
    title = !m.ended && leader !== null ? m.names[leader] : m.names.join(' vs ');
  }
  return {
    game: m.game,
    description: m.description,
    kicker,
    title,
    line,
    names: m.names,
    heat,
    distance: heat.map(h => walked(h.visits, m.ocheMeters)),
    x01: m.checkOut ? x01Of(m.legs, n, m.checkOut) : null,
    totals: 'winners' in m.view ? m.view.stats : null,
  };
}
