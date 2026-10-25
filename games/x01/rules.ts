import type { Dart } from '../darts.ts';
import { value } from '../darts.ts';

export type CheckIn = 'straight' | 'double';
export type CheckOut = 'double' | 'single' | 'master';

export type MatchMode =
  | { kind: 'off' }
  | { kind: 'legs'; firstTo: number }
  | { kind: 'sets'; firstTo: number; legsPerSet: number };

export type BullOff = 'off' | 'closest' | 'pdc';

export interface X01Options {
  startScore: number;
  checkIn: CheckIn;
  checkOut: CheckOut;
  matchMode: MatchMode;
  bullOff: BullOff;
}

export const DEFAULT_OPTIONS: X01Options = {
  startScore: 501,
  checkIn: 'straight',
  checkOut: 'double',
  matchMode: { kind: 'legs', firstTo: 3 },
  bullOff: 'off',
};

/** Can this dart open scoring under the check-in rule? */
export const opensScoring = (d: Dart, rule: CheckIn) => rule === 'straight' || (d.m === 2 && d.n > 0);

/** Can this dart finish the leg under the check-out rule? */
export function finishesLeg(d: Dart, rule: CheckOut): boolean {
  if (d.n === 0) return false;
  if (rule === 'single') return true;
  if (rule === 'master') return d.m >= 2;
  return d.m === 2;
}

/** Lowest score that can still be finished; anything below it after a dart is a bust. */
export const lowestFinish = (rule: CheckOut) => (rule === 'single' ? 1 : 2);

/** Is `remaining` finishable with one dart? Used for checkout % (darts at a finish). */
export function oneDartFinish(remaining: number, rule: CheckOut): boolean {
  if (remaining === 50) return true;
  if (remaining === 25) return rule === 'single';
  if (remaining <= 0) return false;
  const double = remaining <= 40 && remaining % 2 === 0;
  if (rule === 'double') return double;
  const triple = remaining <= 60 && remaining % 3 === 0;
  if (rule === 'master') return double || triple;
  return remaining <= 20 || double || triple;
}

export interface DartOutcome {
  scored: number;
  bust: boolean;
  checkout: boolean;
  checkedIn: boolean;
}

/** Applies one dart to a remaining score. */
export function scoreDart(remaining: number, checkedIn: boolean, d: Dart, o: Pick<X01Options, 'checkIn' | 'checkOut'>): DartOutcome {
  if (!checkedIn && !opensScoring(d, o.checkIn)) return { scored: 0, bust: false, checkout: false, checkedIn: false };
  const left = remaining - value(d);
  if (left === 0) {
    const ok = finishesLeg(d, o.checkOut);
    return { scored: ok ? value(d) : 0, bust: !ok, checkout: ok, checkedIn: true };
  }
  if (left < lowestFinish(o.checkOut)) return { scored: 0, bust: true, checkout: false, checkedIn: true };
  return { scored: value(d), bust: false, checkout: false, checkedIn: true };
}

export function describeOptions(o: X01Options): string {
  const parts = ['X01', String(o.startScore)];
  if (o.checkIn === 'double') parts.push('Double in');
  parts.push(o.checkOut === 'double' ? 'Double out' : o.checkOut === 'master' ? 'Master out' : 'Single out');
  const mm = o.matchMode;
  if (mm.kind === 'off') parts.push('Match mode off');
  else if (mm.kind === 'legs') parts.push(`First to ${mm.firstTo} ${mm.firstTo === 1 ? 'leg' : 'legs'}`);
  else parts.push(`First to ${mm.firstTo} ${mm.firstTo === 1 ? 'set' : 'sets'}`);
  return parts.join(' · ');
}
