// Each game with a board in the hero, mapped to what the board shows (components/targets.ts). Pure.
import type { TargetMode } from '../../../games/race.ts';
import { SECTORS } from '../../../games/race.ts';
import type { BoardTargets, Segment, TargetRing } from '../components/targets.ts';
import { BULL, boardOf, ticks } from '../components/targets.ts';
import type { MiniMatch } from '../match.ts';

export type BoardGame = 'atc' | 'fullboard' | 'shanghai' | 'football' | 'bullseye' | 'freethrow' | 'cricket' | 'killer' | 'hare';
export type BoardMatch = Extract<MiniMatch, { game: BoardGame }>;

const OFF: Segment = { state: 'off' };
const DONE: Segment = { state: 'done' };

/** Doubles and Trebles count only that ring, and only the bullseye for the bull. */
const ringOf = (mode: TargetMode, n: number): TargetRing => (mode === 'any' ? 'any' : n === BULL ? 2 : mode === 'doubles' ? 2 : 3);

/** The board of the player throwing, with the board's label for screen readers. */
export function boardTargets(m: BoardMatch): { board: BoardTargets; label: string } {
  const cur = m.view.current;
  switch (m.game) {
    case 'atc': {
      // Cleared targets green, the next one orange in the ring that counts.
      const { targets, progress } = m.view;
      const i = progress[cur], target = i < targets.length ? targets[i] : null;
      const over: [number, Segment][] = targets.slice(0, i).map(n => [n, DONE]);
      if (target !== null) over.push([target, { state: 'target', ring: ringOf(m.options.target, target) }]);
      return { board: boardOf(OFF, over), label: target === null ? 'All targets cleared' : `Target ${m.view.hero.big}` };
    }
    case 'fullboard': {
      const cleared = new Set(m.view.cleared[cur]);
      const over = SECTORS.map((n): [number, Segment] => [n, cleared.has(n) ? DONE : { state: 'target', ring: ringOf(m.options.target, n) }]);
      return { board: boardOf(OFF, over), label: `${cleared.size} of ${SECTORS.length} sectors cleared` };
    }
    case 'shanghai': {
      // Ticks: the single, double and treble of the round's sector hit this Turn (all three is a Shanghai).
      const n = m.view.sector;
      const hit = [1, 2, 3].map(r => m.view.visit.darts.some(d => d.dart.n === n && d.dart.m === r));
      return { board: boardOf(OFF, [[n, { state: 'target', ring: 'any', ticks: hit }]]), label: `Round sector ${n}` };
    }
    case 'football': {
      // With the ball: the big singles of four sectors, or every double all round. Without: the bull, or only the bullseye.
      if (m.view.ball === cur && m.view.sectors) {
        const over = m.view.sectors.map((n): [number, Segment] => [n, { state: 'target', ring: 1 }]);
        return { board: boardOf(OFF, over), label: `Big singles ${m.view.sectors.join(' · ')} score` };
      }
      if (m.view.ball === cur) return { board: boardOf({ state: 'none' }, [], 2), label: 'Doubles score' };
      return { board: boardOf(OFF, [[BULL, { state: 'target', ring: m.options.kickOff === 'bullseye' ? 2 : 'any' }]]), label: 'The bull wins the ball' };
    }
    case 'bullseye':
      return { board: boardOf(OFF, [[BULL, { state: 'target', ring: 'any' }]]), label: 'Aim for the bull' };
    case 'freethrow':
      return { board: boardOf({ state: 'none' }), label: 'No target' };
    case 'killer': {
      // Before killer status only the own double counts. A killer aims at the doubles of living rivals (ticks: their lives);
      // the own double turns red, since hitting it costs a life. The eliminated and numbers nobody has are out of play.
      const { numbers, lives, killer: isKiller, rows } = m.view;
      const max = m.options.lives;
      const over = numbers.flatMap((n, i): [number, Segment][] => {
        if (rows[i].out) return [];
        if (i === cur) return [[n, { state: isKiller[cur] ? 'danger' : 'target', ring: 2, ticks: ticks(lives[i], max) }]];
        return isKiller[cur] ? [[n, { state: 'target', ring: 2, ticks: ticks(lives[i], max) }]] : [];
      });
      const label = isKiller[cur] ? `Rival doubles: ${over.filter(([, s]) => s.state === 'target').map(([n]) => `D${n}`).join(' · ')}` : `Your double: D${numbers[cur]}`;
      return { board: boardOf(OFF, over), label };
    }
    case 'hare': {
      // The sectors the two stand on in their colours, the target of the player throwing over them; no target once it is over.
      const { hareSector, houndSector, target } = m.view;
      const over: [number, Segment][] = [[hareSector, { state: 'hare' }], [houndSector, { state: 'hound' }]];
      const live = m.view.phase === 'throwing';
      if (live) over.push([target, { state: 'target', ring: ringOf(m.options.target, target) }]);
      return { board: { ...boardOf(OFF, over), roles: { hare: hareSector, hound: houndSector } }, label: live ? `Target ${m.view.hero.big}` : `Hare on ${hareSector}, hound on ${houndSector}` };
    }
    case 'cricket': {
      // Ticks are the marks of the player throwing; closed by them green (still scores), closed by everyone hatched.
      const { sectors, dead, marks } = m.view;
      const over = sectors.map((n, k): [number, Segment] => {
        const mk = Math.min(3, marks[cur][k]);
        return [n, dead[k] ? { state: 'closedAll' } : { state: mk >= 3 ? 'done' : 'target', ring: 'any', ticks: ticks(mk) }];
      });
      const live = sectors.filter((_, k) => !dead[k]);
      return { board: boardOf(OFF, over), label: `Sectors in play: ${live.map(s => (s === BULL ? 'Bull' : s)).join(' · ')}` };
    }
  }
}
