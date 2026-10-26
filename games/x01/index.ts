import { isValidDart } from '../darts.ts';
import type { GameModule, OptionDef } from '../turns.ts';
import { BULL_OFF } from '../turns.ts';
import type { X01Event, X01View } from './engine.ts';
import { compact, happenings, replay, view } from './engine.ts';
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
    case 'bull': return isValidDart(e.dart);
    case 'start': return Number.isInteger(e.starter);
    default: return e.t === 'undo' || e.t === 'next' || e.t === 'nextLeg';
  }
}

export const X01_OPTIONS: OptionDef<X01Options>[] = [
  { key: 'startScore', label: 'Start score', info: 'Points everyone starts from.', choices: [[301, '301'], [501, '501'], [701, '701']] },
  { key: 'checkIn', label: 'Check-in', info: 'Double: your score starts counting with your first double.', choices: [['straight', 'Straight'], ['double', 'Double']] },
  {
    key: 'checkOut',
    label: 'Check-out',
    info: 'How the last dart must land: on a double, on anything, or on a double or treble (Master).',
    choices: [['double', 'Double'], ['single', 'Single'], ['master', 'Master']],
  },
  { label: 'Match mode', info: 'Off: play leg after leg until you end it. Legs or Sets: first to N wins the match.', choices: [] },
  BULL_OFF as OptionDef<X01Options>,
];

export const x01: GameModule<X01Options, X01View> = {
  id: 'x01',
  name: 'X01',
  blurb: 'Count down from 501 and finish on a double.',
  minPlayers: 1,
  defaults: DEFAULT_OPTIONS,
  options: X01_OPTIONS,
  howTo: {
    goal: 'Get from the start score (501) down to exactly zero before your rivals.',
    turn: 'Three darts per visit. Your visit total comes off your score.',
    counts: 'Every dart scores its value: doubles twice, trebles three times, 25 and the bullseye 50. Going below zero, to exactly 1 with double out, or finishing on the wrong ring is a bust: the score goes back to where the visit started.',
    win: 'The finishing dart must match the check-out rule, usually a double. That wins the leg; first to the set number of legs (or sets) wins the match.',
  },
  normalizeOptions,
  describe: describeOptions,
  view: (events: X01Event[], players: number, o: X01Options) => view(replay(events, players, o), players, o),
  compact: (events: X01Event[], players: number, o: X01Options) => compact(replay(events, players, o), players, o),
  happenings: (events: X01Event[], players: number, o: X01Options) => happenings(replay(events, players, o), players, o),
  isValidEvent,
};
