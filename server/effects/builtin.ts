// Built-in sounds and base rules (docs/EFEKTY.md, Dźwięki wbudowane i reguły bazowe). The list lives in code: the
// server adds a missing base rule to effects.json on load and refuses to delete one; the kiosk synthesizes the sounds.
import type { Trigger } from '../../games/effects.ts';

/** A sound the kiosk makes with WebAudio; rules point at it as `builtin:<key>`. The synthesis is in web/src/sound.ts. */
export interface BuiltinSound {
  key: string;
  name: string;
  /** What it was made for, shown in the library. */
  info: string;
  durationMs: number;
}

export const BUILTIN_PREFIX = 'builtin:';
export const builtinId = (key: string) => `${BUILTIN_PREFIX}${key}`;
export const builtinKey = (id: string): string | null => (id.startsWith(BUILTIN_PREFIX) ? id.slice(BUILTIN_PREFIX.length) : null);

/** Picked on 2026-10-27 from the proposal pages, one family per ladder. */
export const BUILTIN_SOUNDS: BuiltinSound[] = [
  { key: 'treble-15', name: 'Treble 15', info: 'Marimba sparkle, lowest of the treble ladder', durationMs: 1100 },
  { key: 'treble-16', name: 'Treble 16', info: 'Marimba sparkle, one step up', durationMs: 1100 },
  { key: 'treble-17', name: 'Treble 17', info: 'Marimba sparkle, two steps up', durationMs: 1100 },
  { key: 'treble-18', name: 'Treble 18', info: 'Marimba sparkle, three steps up', durationMs: 1100 },
  { key: 'treble-19', name: 'Treble 19', info: 'Marimba sparkle, four steps up', durationMs: 1100 },
  { key: 'treble-20', name: 'Treble 20', info: 'Marimba sparkle, top of the treble ladder', durationMs: 1100 },
  { key: 'bull', name: 'Bull', info: 'Low marimba octaves and a bell', durationMs: 1400 },
  { key: 'ton', name: 'Ton', info: 'Marimba run, three notes', durationMs: 500 },
  { key: 'ton-40', name: 'Ton 40', info: 'Marimba run, four notes and a bell', durationMs: 1300 },
  { key: '180', name: '180', info: 'Marimba run over two octaves and three bells', durationMs: 2000 },
  { key: 'leg-won', name: 'Leg won', info: 'Strummed C chord and a bell', durationMs: 1300 },
  { key: 'high-finish', name: 'High finish', info: 'Strummed G → C cadence with bells', durationMs: 1800 },
  { key: 'big-fish', name: 'Big fish', info: 'Riser, gong, strummed chord and bells', durationMs: 2300 },
  { key: 'set-won', name: 'Set won', info: 'Strummed G → C with two bells', durationMs: 1700 },
  { key: 'match-won', name: 'Match won', info: 'Strummed C F G C with marimba and bells', durationMs: 2900 },
  { key: 'bust', name: 'Bust', info: 'Three soft notes down and a low womp', durationMs: 700 },
  { key: 'no-score', name: 'No score', info: 'A slide down and a knock', durationMs: 500 },
  { key: 'madhouse', name: 'Madhouse', info: 'Low minor marimba and a high bell', durationMs: 1400 },
  { key: 'game-on', name: 'Game on', info: 'Three marimba steps up and a bell', durationMs: 1200 },
  { key: 'clean-20s', name: 'Clean 20s', info: 'Three marimba taps and a bell', durationMs: 1200 },
  { key: 'bed-and-breakfast', name: 'Bed and breakfast', info: 'Kalimba half step down', durationMs: 700 },
  { key: 'new-record', name: 'New record', info: 'Bells up and a long bell', durationMs: 1800 },
  { key: 'white-horse', name: 'White Horse', info: 'Marimba gallop and a bell', durationMs: 1500 },
  { key: 'player-out', name: 'Player out', info: 'Low minor marimba and a slide down', durationMs: 900 },
  { key: 'turn', name: 'Next player', info: 'The marimba arpeggio of the next player', durationMs: 450 },
  { key: 'hit', name: 'Hit', info: 'Marimba fifth up, as in the minigames', durationMs: 350 },
  { key: 'miss', name: 'Miss', info: 'Marimba fifth down, as in the minigames', durationMs: 350 },
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
  /** The built-in sound, as a library id. */
  sound: string;
}

const treble = (n: number): BaseRule => ({ id: `b-treble-${n}`, name: `Treble ${n}`, triggers: [{ kind: 'dart', dart: { n, m: 3 } }], sound: builtinId(`treble-${n}`) });
const T20 = { n: 20, m: 3 as const };

/** In file order, which decides ties between equal priorities (docs/EFEKTY.md, Reguły). */
export const BASE_RULES: BaseRule[] = [
  { id: 'b-180', name: '180', triggers: [{ kind: 'total', total: 180, checkout: 'any' }, { kind: 'combo', darts: [T20, T20, T20], ordered: false, checkout: 'any' }], sound: builtinId('180') },
  { id: 'b-big-fish', name: 'Big Fish', triggers: [{ kind: 'total', total: 170, checkout: 'only' }], sound: builtinId('big-fish') },
  { id: 'b-high-finish', name: 'High finish', aliases: ['Ton+ finish'], triggers: [{ kind: 'range', min: 100, max: 170, checkout: 'only' }], sound: builtinId('high-finish') },
  { id: 'b-madhouse', name: 'Madhouse', triggers: [{ kind: 'total', total: 2, checkout: 'only' }], sound: builtinId('madhouse') },
  { id: 'b-checkout', name: 'Checkout', triggers: [{ kind: 'checkout' }], sound: builtinId('leg-won') },
  { id: 'b-bust', name: 'Bust', triggers: [{ kind: 'bust' }], sound: builtinId('bust') },
  { id: 'b-clean-20s', name: 'Clean 20s', triggers: [{ kind: 'combo', darts: [{ n: 20, m: 1 }, { n: 20, m: 1 }, { n: 20, m: 1 }], ordered: false, checkout: 'any' }], sound: builtinId('clean-20s') },
  { id: 'b-bed-and-breakfast', name: 'Bed and breakfast', triggers: [{ kind: 'combo', darts: [{ n: 1, m: 1 }, { n: 5, m: 1 }, { n: 20, m: 1 }], ordered: false, checkout: 'any' }], sound: builtinId('bed-and-breakfast') },
  { id: 'b-ton-40', name: 'Ton 40', triggers: [{ kind: 'range', min: 140, max: 179, checkout: 'any' }], sound: builtinId('ton-40') },
  { id: 'b-ton', name: 'Ton', triggers: [{ kind: 'range', min: 100, max: 139, checkout: 'any' }], sound: builtinId('ton') },
  { id: 'b-no-score', name: 'No score', triggers: [{ kind: 'total', total: 0, checkout: 'no' }], sound: builtinId('no-score') },
  { id: 'b-bullseye', name: 'Bullseye', triggers: [{ kind: 'dart', dart: { n: 25, m: 2 } }], sound: builtinId('bull') },
  ...[15, 16, 17, 18, 19, 20].map(treble),
  { id: 'b-match-won', name: 'Match won', triggers: [{ kind: 'matchWon' }], sound: builtinId('match-won') },
  { id: 'b-set-won', name: 'Set won', triggers: [{ kind: 'setWon' }], sound: builtinId('set-won') },
  { id: 'b-game-on', name: 'Game on', triggers: [{ kind: 'matchStart' }], sound: builtinId('game-on') },
  { id: 'b-new-record', name: 'New record', triggers: [{ kind: 'game', event: 'newRecord' }], sound: builtinId('new-record') },
  { id: 'b-white-horse', name: 'White Horse', triggers: [{ kind: 'game', event: 'whiteHorse' }], sound: builtinId('white-horse') },
  { id: 'b-player-out', name: 'Player out', triggers: [{ kind: 'game', event: 'eliminated' }], sound: builtinId('player-out') },
];

export const baseRule = (id: string): BaseRule | undefined => BASE_RULES.find(b => b.id === id);
