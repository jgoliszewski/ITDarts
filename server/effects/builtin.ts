// Built-in sounds and base rules (docs/EFEKTY.md, Dźwięki wbudowane i reguły bazowe). The list lives in code: the
// server adds a missing base rule to effects.json on load and refuses to delete one; the kiosk synthesizes the sounds.
import type { FxGroup, Trigger } from '../../games/effects.ts';
import type { LedKey } from './leds.ts';

/** A sound the kiosk makes with WebAudio; rules point at it as `builtin:<key>`. The synthesis is in web/src/sound.ts. */
export interface BuiltinSound {
  key: string;
  name: string;
  /** What it was made for, shown in the library. */
  info: string;
  durationMs: number;
  /** The group of the Moment it was made for (docs/MAPA.md). */
  group: FxGroup;
  /** Volume in % until it is changed on the page; quieter where the sound comes with every visit or dart. */
  volume?: number;
}

export const BUILTIN_PREFIX = 'builtin:';
export const builtinId = (key: string) => `${BUILTIN_PREFIX}${key}`;
export const builtinKey = (id: string): string | null => (id.startsWith(BUILTIN_PREFIX) ? id.slice(BUILTIN_PREFIX.length) : null);

/** Picked on 2026-10-27 from the proposal pages, one family per ladder; richness follows strength since 2026-10-28 (docs/MAPA.md). */
export const BUILTIN_SOUNDS: BuiltinSound[] = [
  { key: 'treble-15', name: 'Treble 15', info: 'Three quick marimba notes, lowest of the treble ladder', durationMs: 400, group: 'darts' },
  { key: 'treble-16', name: 'Treble 16', info: 'Three quick marimba notes, one step up', durationMs: 400, group: 'darts' },
  { key: 'treble-17', name: 'Treble 17', info: 'Three quick marimba notes, two steps up', durationMs: 400, group: 'darts' },
  { key: 'treble-18', name: 'Treble 18', info: 'Three quick marimba notes, three steps up', durationMs: 400, group: 'darts' },
  { key: 'treble-19', name: 'Treble 19', info: 'Three quick marimba notes, four steps up', durationMs: 400, group: 'darts' },
  { key: 'treble-20', name: 'Treble 20', info: 'Three quick marimba notes, top of the treble ladder', durationMs: 400, group: 'darts' },
  { key: 'bull', name: 'Bull', info: 'Low marimba octaves and a bell', durationMs: 1400, group: 'darts' },
  { key: 'ton', name: 'Ton', info: 'Marimba run, three notes and a small bell', durationMs: 950, group: 'visits' },
  { key: 'ton-40', name: 'Ton 40', info: 'Marimba run, four notes and a bell', durationMs: 1300, group: 'visits' },
  { key: '180', name: '180', info: 'Marimba run over two octaves and three bells', durationMs: 2000, group: 'visits' },
  { key: 'leg-won', name: 'Leg won', info: 'Strummed C chord and a bell', durationMs: 1300, group: 'legEnd' },
  { key: 'high-finish', name: 'High finish', info: 'Strummed G → C cadence with bells', durationMs: 1800, group: 'legEnd' },
  { key: 'big-fish', name: 'Big fish', info: 'Riser, gong, strummed chord and bells', durationMs: 2300, group: 'legEnd' },
  { key: 'set-won', name: 'Set won', info: 'Strummed G → C → C a step up, with bells', durationMs: 2100, group: 'legEnd' },
  { key: 'match-won', name: 'Match won', info: 'Strummed C F G C with marimba and bells', durationMs: 2900, group: 'legEnd' },
  { key: 'bust', name: 'Bust', info: 'Three marimba notes down and a low slide', durationMs: 600, group: 'visits' },
  { key: 'no-score', name: 'No score', info: 'Three marimba notes down, no slide', durationMs: 500, group: 'visits' },
  { key: 'madhouse', name: 'Madhouse', info: 'Low minor marimba and a high bell', durationMs: 1400, group: 'legEnd' },
  { key: 'game-on', name: 'Game on', info: 'Three marimba steps up and a bell', durationMs: 1200, group: 'match' },
  { key: 'clean-20s', name: 'Clean 20s', info: 'Three high marimba taps', durationMs: 500, group: 'visits' },
  { key: 'bed-and-breakfast', name: 'Bed and breakfast', info: 'Kalimba half step down', durationMs: 700, group: 'visits' },
  { key: 'new-record', name: 'New record', info: 'Bells up and a long bell', durationMs: 1800, group: 'minigames' },
  { key: 'white-horse', name: 'White Horse', info: 'Marimba gallop and a bell', durationMs: 1500, group: 'minigames' },
  { key: 'player-out', name: 'Player out', info: 'Two low marimba notes down and a long slide', durationMs: 1200, group: 'minigames' },
  { key: 'turn', name: 'Next player', info: 'The marimba arpeggio of the next player', durationMs: 450, group: 'match', volume: 75 },
  { key: 'hit', name: 'Hit', info: 'Marimba fifth up', durationMs: 350, group: 'minigames', volume: 56 },
  { key: 'miss', name: 'Miss', info: 'Marimba fifth down', durationMs: 350, group: 'minigames', volume: 56 },
];

export const isBuiltinSound = (id: string) => BUILTIN_SOUNDS.some(s => builtinId(s.key) === id);

/** A rule that is always there: it can be edited and switched off, and “Reset to default” brings this back. */
export interface BaseRule {
  /** Fixed, so the same rule at home and at work is one rule; `b-` tells it from the random ids. */
  id: string;
  name: string;
  /** Names of older starter rules in effects.json that become this rule. */
  aliases?: string[];
  triggers: Trigger[];
  /** The built-in sound, as a library id, or none. */
  sound: string | null;
  /** The LED look from leds.ts; its preset and length are the rule's default LEDs. */
  led: LedKey | null;
}

const treble = (n: number): BaseRule => ({ id: `b-treble-${n}`, name: `Treble ${n}`, triggers: [{ kind: 'dart', dart: { n, m: 3 } }], sound: builtinId(`treble-${n}`), led: n === 20 ? 'treble-20' : 'treble' });
const T20 = { n: 20, m: 3 as const };

/** In file order, which decides ties between equal priorities (docs/EFEKTY.md, Reguły). */
export const BASE_RULES: BaseRule[] = [
  { id: 'b-180', name: '180', triggers: [{ kind: 'total', total: 180, checkout: 'any' }, { kind: 'combo', darts: [T20, T20, T20], ordered: false, checkout: 'any' }], sound: builtinId('180'), led: '180' },
  { id: 'b-big-fish', name: 'Big Fish', triggers: [{ kind: 'total', total: 170, checkout: 'only' }], sound: builtinId('big-fish'), led: 'big-fish' },
  { id: 'b-high-finish', name: 'High finish', aliases: ['Ton+ finish'], triggers: [{ kind: 'range', min: 100, max: 170, checkout: 'only' }], sound: builtinId('high-finish'), led: 'high-finish' },
  { id: 'b-madhouse', name: 'Madhouse', triggers: [{ kind: 'total', total: 2, checkout: 'only' }], sound: builtinId('madhouse'), led: 'madhouse' },
  { id: 'b-checkout', name: 'Checkout', triggers: [{ kind: 'checkout' }], sound: builtinId('leg-won'), led: 'checkout' },
  { id: 'b-bust', name: 'Bust', triggers: [{ kind: 'bust' }], sound: builtinId('bust'), led: 'bust' },
  { id: 'b-clean-20s', name: 'Clean 20s', triggers: [{ kind: 'combo', darts: [{ n: 20, m: 1 }, { n: 20, m: 1 }, { n: 20, m: 1 }], ordered: false, checkout: 'any' }], sound: builtinId('clean-20s'), led: 'clean-20s' },
  { id: 'b-bed-and-breakfast', name: 'Bed and breakfast', triggers: [{ kind: 'combo', darts: [{ n: 1, m: 1 }, { n: 5, m: 1 }, { n: 20, m: 1 }], ordered: false, checkout: 'any' }], sound: builtinId('bed-and-breakfast'), led: 'bnb' },
  { id: 'b-ton-40', name: 'Ton 40', triggers: [{ kind: 'range', min: 140, max: 179, checkout: 'any' }], sound: builtinId('ton-40'), led: 'ton-40' },
  { id: 'b-ton', name: 'Ton', triggers: [{ kind: 'range', min: 100, max: 139, checkout: 'any' }], sound: builtinId('ton'), led: 'ton' },
  { id: 'b-no-score', name: 'No score', triggers: [{ kind: 'total', total: 0, checkout: 'no' }], sound: builtinId('no-score'), led: 'no-score' },
  { id: 'b-bullseye', name: 'Bullseye', triggers: [{ kind: 'dart', dart: { n: 25, m: 2 } }], sound: builtinId('bull'), led: 'bull' },
  ...[15, 16, 17, 18, 19, 20].map(treble),
  { id: 'b-match-won', name: 'Match won', triggers: [{ kind: 'matchWon' }], sound: builtinId('match-won'), led: 'match-won' },
  { id: 'b-set-won', name: 'Set won', triggers: [{ kind: 'setWon' }], sound: builtinId('set-won'), led: 'set-won' },
  { id: 'b-game-on', name: 'Game on', triggers: [{ kind: 'matchStart' }], sound: builtinId('game-on'), led: 'game-on' },
  { id: 'b-new-record', name: 'New record', triggers: [{ kind: 'game', event: 'newRecord' }], sound: builtinId('new-record'), led: 'new-record' },
  { id: 'b-white-horse', name: 'White Horse', triggers: [{ kind: 'game', event: 'whiteHorse' }], sound: builtinId('white-horse'), led: 'white-horse' },
  { id: 'b-shanghai', name: 'Shanghai', triggers: [{ kind: 'game', event: 'shanghai' }], sound: builtinId('white-horse'), led: 'white-horse' },
  { id: 'b-gotcha', name: 'Gotcha', triggers: [{ kind: 'game', event: 'gotcha' }], sound: builtinId('bed-and-breakfast'), led: 'bnb' },
  { id: 'b-goal', name: 'Goal', triggers: [{ kind: 'game', event: 'goal' }], sound: builtinId('ton'), led: 'ton' },
  { id: 'b-player-out', name: 'Player out', triggers: [{ kind: 'game', event: 'eliminated' }], sound: builtinId('player-out'), led: 'player-out' },
  // Added 2026-10-28 (docs/MAPA.md): the minigame events, Leg start, and the sounds that were hard-coded before.
  { id: 'b-life-lost', name: 'Life lost', triggers: [{ kind: 'game', event: 'lifeLost' }], sound: builtinId('no-score'), led: 'life-lost' },
  { id: 'b-lowest', name: 'Lowest visit', triggers: [{ kind: 'game', event: 'lowest' }], sound: builtinId('no-score'), led: 'life-lost' },
  { id: 'b-attempt-failed', name: 'Attempt failed', triggers: [{ kind: 'game', event: 'attemptFailed' }], sound: builtinId('no-score'), led: 'attempt-failed' },
  { id: 'b-became-killer', name: 'Became killer', triggers: [{ kind: 'game', event: 'becameKiller' }], sound: null, led: 'killer' },
  { id: 'b-sector-closed', name: 'Sector closed', triggers: [{ kind: 'game', event: 'sectorClosed' }], sound: builtinId('hit'), led: 'sector-closed' },
  { id: 'b-leg-start', name: 'Leg start', triggers: [{ kind: 'legStart' }], sound: null, led: 'leg-start' },
  { id: 'b-next-player', name: 'Next player', triggers: [{ kind: 'nextPlayer' }], sound: builtinId('turn'), led: null },
  { id: 'b-hit', name: 'Hit', triggers: [{ kind: 'hit' }], sound: builtinId('hit'), led: 'hit' },
  { id: 'b-miss', name: 'Miss', triggers: [{ kind: 'miss' }], sound: builtinId('miss'), led: 'miss' },
];

export const baseRule = (id: string): BaseRule | undefined => BASE_RULES.find(b => b.id === id);
