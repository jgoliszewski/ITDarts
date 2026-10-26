// The caller (docs/EFEKTY.md#caller): what the referee says in X01. Pure, no I/O.
// Lines are darts-caller sound-file keys; the recordings are assets/caller/<key>.mp3.
import type { Change } from '../effects.ts';
import type { X01View } from './engine.ts';

/** Gameshot recordings go up to the twentieth leg; later legs stay silent. */
export const GAMESHOT_LEGS = 20;

/** Every key the caller can say, for the check that the recordings are all there. */
export const CALLER_KEYS = [
  ...Array.from({ length: 180 }, (_, i) => String(i + 1)),
  'busted', 'gameon', 'you_require', 'matchshot',
  ...Array.from({ length: GAMESHOT_LEGS }, (_, i) => `gameshot_l${i + 1}_n`),
];

/**
 * What to say for the changes of one log event. `view` is the match after the event; `turnStart` is true when the
 * event handed the visit to a player (next player, next leg, the start after the bull-off, the match start).
 * A fix calls the fixed visit again, because `changes` reports it changed; an undo reports nothing.
 */
export function callerLines(cs: Change[], view: X01View, turnStart: boolean): string[] {
  const out: string[] = [];
  if (cs.some(c => c.fact.kind === 'legStart' && !c.before)) out.push('gameon');
  for (const { fact } of cs) {
    // A checkout visit is called as the game shot below, not as a score.
    if (fact.kind === 'visit' && !fact.checkout) out.push(fact.total > 0 ? String(fact.total) : 'busted');
    if (fact.kind === 'bust') out.push('busted');
  }
  if (cs.some(c => c.fact.kind === 'matchWon')) out.push('matchshot');
  else if (cs.some(c => c.fact.kind === 'checkout') && view.legNo <= GAMESHOT_LEGS) out.push(`gameshot_l${view.legNo}_n`);
  // “You require” only when the checkout hint has a route: within reach, checked in, and not a bogey number.
  if (turnStart && view.phase === 'throwing' && view.visit.darts.length === 0 && view.checkout !== null) {
    out.push('you_require', String(view.scores[view.current]));
  }
  return out;
}
