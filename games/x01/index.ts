import { isValidDart } from '../darts.ts';
import type { X01Event } from './engine.ts';
import { compact, replay, view } from './engine.ts';
import type { X01Options } from './rules.ts';
import { DEFAULT_OPTIONS, describeOptions } from './rules.ts';

export * from './checkout.ts';
export * from './engine.ts';
export * from './rules.ts';
export * from './stats.ts';

const START_SCORES = [101, 170, 301, 501, 701, 901];

/** Accepts options from the pilot, falling back to defaults for anything malformed. */
export function normalizeOptions(input: unknown): X01Options {
  const o = (input ?? {}) as Partial<X01Options>;
  const int = (v: unknown, lo: number, hi: number, dflt: number) => (Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi ? (v as number) : dflt);
  const mm = o.matchMode as X01Options['matchMode'] | undefined;
  return {
    startScore: START_SCORES.includes(o.startScore as number) ? o.startScore! : DEFAULT_OPTIONS.startScore,
    checkIn: o.checkIn === 'double' ? 'double' : 'straight',
    checkOut: o.checkOut === 'single' || o.checkOut === 'master' ? o.checkOut : 'double',
    matchMode:
      mm?.kind === 'off' ? { kind: 'off' }
      : mm?.kind === 'sets' ? { kind: 'sets', firstTo: int(mm.firstTo, 1, 11, 2), legsPerSet: int(mm.legsPerSet, 1, 7, 3) }
      : { kind: 'legs', firstTo: int(mm?.firstTo, 1, 21, 3) },
    bullOff: o.bullOff === 'closest' || o.bullOff === 'pdc' ? o.bullOff : 'off',
  };
}

export function isValidEvent(e: X01Event): boolean {
  switch (e.t) {
    case 'dart': return isValidDart(e.dart);
    case 'fix': return Number.isInteger(e.index) && isValidDart(e.dart);
    case 'start': return Number.isInteger(e.starter);
    default: return e.t === 'undo' || e.t === 'next' || e.t === 'nextLeg';
  }
}

export const x01 = {
  id: 'x01',
  name: 'X01',
  normalizeOptions,
  describe: describeOptions,
  view: (events: X01Event[], players: number, o: X01Options) => view(replay(events, players, o), players, o),
  compact: (events: X01Event[], players: number, o: X01Options) => compact(replay(events, players, o), players, o),
};
