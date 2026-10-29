// The Momenty for the LED simulator (docs/MAPA.md): each with its strength, mood and built-in sound, and its LEDs from
// server/effects/leds.ts, the same list the controller gets.
import { LEDS, WARM, type Effect, type LedKey } from '../../../server/effects/leds.ts';

export type Strength = 'S' | 'M' | 'L' | 'XL';
export type Mood = 'neutral' | 'good' | 'bad' | 'fun';

export interface Moment {
  /** The LED key in leds.ts, where there is one. */
  id: string;
  name: string;
  group: string;
  /** When it plays. */
  when: string;
  strength: Strength;
  mood: Mood;
  /** How often it comes in an ordinary office game. */
  often: string;
  /** Built-in sound key, or null for silence. */
  sound: string | null;
  note?: string;
}

export const MOMENTS: Moment[] = [
  { id: 'game-on', name: 'Game on', group: 'Match', when: 'Match starts', strength: 'L', mood: 'neutral', often: 'once a match', sound: 'game-on' },
  { id: 'leg-start', name: 'Leg start', group: 'Match', when: 'Next leg starts', strength: 'S', mood: 'neutral', often: 'every leg', sound: null, note: 'No sound; the caller says "game on"' },
  { id: 'next-player', name: 'Next player', group: 'Match', when: 'Visit passes to the next player', strength: 'S', mood: 'neutral', often: 'every visit', sound: 'turn', note: 'No LEDs' },

  { id: 'treble', name: 'Treble 15–19', group: 'Dart', when: 'T15 … T19', strength: 'S', mood: 'good', often: 'a few a leg', sound: 'treble-17' },
  { id: 'treble-20', name: 'Treble 20', group: 'Dart', when: 'T20', strength: 'S', mood: 'good', often: 'often in X01', sound: 'treble-20' },
  { id: 'bull', name: 'Bullseye', group: 'Dart', when: 'Bull (50)', strength: 'M', mood: 'good', often: 'now and then', sound: 'bull' },

  { id: 'ton', name: 'Ton', group: 'Visit', when: 'Visit 100–139', strength: 'M', mood: 'good', often: 'a few a leg', sound: 'ton' },
  { id: 'ton-40', name: 'Ton 40', group: 'Visit', when: 'Visit 140–179', strength: 'M', mood: 'good', often: 'now and then', sound: 'ton-40' },
  { id: '180', name: '180', group: 'Visit', when: 'Visit 180', strength: 'XL', mood: 'good', often: 'rare', sound: '180' },
  { id: 'clean-20s', name: 'Clean 20s', group: 'Visit', when: 'Three single 20s', strength: 'S', mood: 'good', often: 'now and then', sound: 'clean-20s' },
  { id: 'bnb', name: 'Bed and breakfast', group: 'Visit', when: '1 · 5 · 20 (26)', strength: 'S', mood: 'fun', often: 'often for beginners', sound: 'bed-and-breakfast' },
  { id: 'no-score', name: 'No score', group: 'Visit', when: 'Visit 0', strength: 'S', mood: 'bad', often: 'a few a match', sound: 'no-score' },
  { id: 'bust', name: 'Bust', group: 'Visit', when: 'Bust', strength: 'M', mood: 'bad', often: 'a few a match', sound: 'bust' },

  { id: 'checkout', name: 'Checkout', group: 'Leg end', when: 'Leg won (also a won minigame)', strength: 'L', mood: 'good', often: 'every leg', sound: 'leg-won' },
  { id: 'madhouse', name: 'Madhouse', group: 'Leg end', when: 'Checkout on D1', strength: 'L', mood: 'fun', often: 'rare', sound: 'madhouse' },
  { id: 'high-finish', name: 'High finish', group: 'Leg end', when: 'Checkout 100–170', strength: 'L', mood: 'good', often: 'rare', sound: 'high-finish' },
  { id: 'big-fish', name: 'Big Fish', group: 'Leg end', when: 'Checkout 170', strength: 'XL', mood: 'good', often: 'very rare', sound: 'big-fish' },
  { id: 'set-won', name: 'Set won', group: 'Leg end', when: 'Set won', strength: 'L', mood: 'good', often: 'matches on sets', sound: 'set-won' },
  { id: 'match-won', name: 'Match won', group: 'Leg end', when: 'Match won', strength: 'XL', mood: 'good', often: 'once a match', sound: 'match-won' },

  { id: 'hit', name: 'Hit', group: 'Minigames', when: 'A dart that counts (ATC, Full Board, Cricket, Higher or Lower)', strength: 'S', mood: 'good', often: 'every dart', sound: 'hit' },
  { id: 'miss', name: 'Miss', group: 'Minigames', when: 'A dart that does not count', strength: 'S', mood: 'bad', often: 'every dart', sound: 'miss' },
  { id: 'sector-closed', name: 'Sector closed', group: 'Minigames', when: 'Cricket: sector closed', strength: 'M', mood: 'good', often: 'a few a game', sound: 'hit' },
  { id: 'white-horse', name: 'White Horse', group: 'Minigames', when: 'Cricket: three different trebles', strength: 'L', mood: 'good', often: 'very rare', sound: 'white-horse' },
  { id: 'life-lost', name: 'Life lost', group: 'Minigames', when: 'Killer, 121: a life goes', strength: 'M', mood: 'bad', often: 'a few a game', sound: 'no-score' },
  { id: 'killer', name: 'Became killer', group: 'Minigames', when: 'Killer: player becomes a killer', strength: 'M', mood: 'good', often: 'once per player', sound: null },
  { id: 'attempt-failed', name: 'Attempt failed', group: 'Minigames', when: '121: no checkout in the attempt', strength: 'M', mood: 'bad', often: 'a few a game', sound: 'no-score' },
  { id: 'player-out', name: 'Player out', group: 'Minigames', when: 'Player eliminated', strength: 'L', mood: 'bad', often: 'a few a game', sound: 'player-out' },
  { id: 'new-record', name: 'New record', group: 'Minigames', when: 'Office or personal record', strength: 'L', mood: 'good', often: 'rare', sound: 'new-record' },

  { id: 'offline', name: 'Board offline', group: 'Base states', when: 'Board Manager not answering (loops)', strength: 'M', mood: 'bad', often: 'rare', sound: null },
];

export { WARM };

/** The base states loop in the simulator; on the controller they stay until the next change. */
const looping = (e: Effect): Effect => ('kind' in e && e.dur === 0 ? { ...e, dur: 60 } : e);
/** A Moment's LEDs, as the controller gets them; none for Next player. */
export const lookOf = (id: string): Effect | undefined => {
  const led = LEDS[id as LedKey];
  return led && looping(led.effect);
};
