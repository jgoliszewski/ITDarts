// One visit of a checkout attempt (121, Catch 40): X01 scoring with double out, a bust, and the early end of a hopeless last visit. Pure, no I/O.
import { hint } from './x01/checkout.ts';
import { scoreDart } from './x01/rules.ts';
import type { Visit, Walked } from './turns.ts';
import { walk } from './turns.ts';

const RULE = { checkIn: 'straight', checkOut: 'double' } as const;

export interface AttemptVisit {
  w: Walked;
  bust: boolean;
  out: boolean;
  /** Score after the visit; a bust puts it back to where the visit started. */
  remaining: number;
}

/**
 * Plays the darts of one visit from `remaining`. On the attempt's last visit (`lastVisit`) it also ends as soon as the
 * darts left can't check out (e.g. one dart on an odd score), see docs/GRY.md#121. `dead`: the game is over, nothing counts.
 */
export function attemptVisit(v: Visit, from: number, lastVisit: boolean, dead = false): AttemptVisit {
  let remaining = from, bust = false, out = false;
  const w = walk(v, (d, i) => {
    if (dead) return { good: false, end: true };
    const r = scoreDart(remaining, true, d, RULE);
    if (r.bust) {
      bust = true;
      return { good: false, end: true };
    }
    remaining -= r.scored;
    if (r.checkout) out = true;
    const hopeless = lastVisit && !r.checkout && i < 2 && !hint(remaining, 2 - i, 'double')?.finish;
    return { good: r.scored > 0, end: r.checkout || hopeless };
  });
  return { w, bust, out, remaining: bust ? from : remaining };
}
