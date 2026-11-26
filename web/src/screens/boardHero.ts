// What the left column and the player list show around the board in the games with one (docs/UI.md, Ekran wyników). Pure.
import { SECTORS } from '../../../games/race.ts';
import type { BoardMatch } from './boardTargets.ts';

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');
const per = (darts: number, done: number) => (done ? (darts / done).toFixed(1) : '–');

/** The kicker over the big number, only where the number would read wrong without it: Cricket's points need none. */
export const boardCaption = (m: BoardMatch): string | null => (m.game === 'cricket' && !m.view.solo ? null : m.view.hero.caption);

/**
 * The line under the big number, without what the board already shows: progress and darts (ATC, Full Board, also in the
 * stats), the double to hit (Killer) and the ring that scores (Football). Who has the ball, MPR and the game's rules stay.
 */
export function boardNote(m: BoardMatch): string | null {
  const v = m.view;
  switch (m.game) {
    case 'atc': case 'fullboard': case 'killer': return null;
    case 'football':
      return m.view.ball === v.current ? '⚽ Your ball' : m.view.ball === null ? 'Ball in the centre' : `${m.roster[m.view.ball].name} has the ball`;
    default: return v.hero.note || null;
  }
}

/** Two or three numbers of the player throwing in this match, at the bottom of the left column; only what the view already holds. */
export function boardStats(m: BoardMatch): [string, string][] {
  const p = m.view.current;
  switch (m.game) {
    case 'atc': case 'fullboard': {
      const { darts, hits } = m.view.stats[p] as { darts: number; hits: number };
      // Co-op: one shared progress, so the team's darts per target.
      const done = m.game === 'atc' ? m.view.progress[p] : m.view.cleared[p].length;
      return [['Darts', String(darts)], ['Hit rate', pct(hits, darts)], [m.game === 'atc' ? 'Per target' : 'Per sector', per(m.view.teamDarts ?? darts, done)]];
    }
    case 'shanghai': {
      const { darts, hits, shanghais } = m.view.stats[p] as { darts: number; hits: number; shanghais: number };
      return [['Darts', String(darts)], ['Hit rate', pct(hits, darts)], ['Shanghais', String(shanghais)]];
    }
    case 'cricket': {
      const { darts, marks } = m.view.stats[p] as { darts: number; marks: number };
      // Solo: the darts are the big number.
      return m.view.solo ? [['Marks', String(marks)]] : [['Marks', String(marks)], ['Darts', String(darts)]];
    }
    case 'killer': {
      const rivals = m.view.rows.filter((r, i) => i !== p && !r.out).length;
      return [['Lives taken', String((m.view.stats[p] as { taken: number }).taken)], ['Rivals left', String(rivals)]];
    }
    case 'freethrow': {
      const { darts, points, best } = m.view.stats[0] as { darts: number; points: number; best: number };
      return [['Average', darts ? ((points / darts) * 3).toFixed(1) : '–'], ['Darts', String(darts)], ['Highest visit', String(best)]];
    }
    case 'football': {
      const left = m.options.goals - m.view.goals[p];
      return [['To win', String(left)]];
    }
    // Bullseye: the points are the big number, and the view keeps nothing else.
    default: return [];
  }
}

/** How far player `i` is towards the end of the game, 0–1, for the bar in their row; null where the game has no such line. */
export function boardProgress(m: BoardMatch, i: number): number | null {
  switch (m.game) {
    case 'atc': return Math.min(1, m.view.progress[i] / m.view.targets.length);
    case 'fullboard': return m.view.cleared[i].length / SECTORS.length;
    case 'football': return Math.min(1, m.view.goals[i] / m.options.goals);
    default: return null;
  }
}
