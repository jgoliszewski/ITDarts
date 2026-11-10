// LEDs of the Momenty (docs/MAPA.md, Przypisania; docs/EFEKTY.md, Ledy). One list in code: the simulator draws it
// (npm run led-sim), `npm run leds:upload` saves it on the controller as presets with fixed numbers, and the base
// rules point at those numbers, so home and office have the same presets.
//
// The controller drives two rings, one per segment. The board ring lights the board; the wall ring sits behind it and
// lights the wall. A Moment's effect is a calm colour wash on the board ring and motion in the same colour on the wall
// ring, both for the same time, at most 2 s; only the end of a game runs longer (round 2 of issue #9).

import type { FxGroup } from '../../games/effects.ts';

export type Rgb = [number, number, number];
/** A colour, or the rainbow spread over the ring (WLED palette 11). */
export type Paint = Rgb | 'rainbow';

export type Kind = 'solid' | 'pulse' | 'fill' | 'run' | 'ripple' | 'burst' | 'rainbow' | 'dissolve' | 'blink';

export interface Look {
  kind: Kind;
  color: Paint;
  /** What the behaviour plays over (WLED colour 2); the base when unset. */
  bg?: Rgb;
  /** Seconds from the start to the return to the base. */
  dur: number;
  /** Crossfade from the base and back, in seconds (WLED `transition`); 0 is a hard switch. */
  fadeIn?: number;
  fadeOut?: number;
  /** Tempo: pulse and blink period in s, fill time in s, run and rainbow cycles per s, ripple and burst events per s. */
  rate?: number;
  /** Run: bands per ring. Burst: sparks per event. */
  size?: number;
  /** Starts anywhere in its cycle, like Breathe, Wipe and Running on the controller. */
  clock?: boolean;
  /** Brightness of the effect, 0–1. */
  bri?: number;
}

/** Different looks for the two rings; null leaves that ring on the base. */
export interface Split {
  board: Look | null;
  wall: Look | null;
}
export type Effect = Look | Split;
export const rings = (e: Effect): Split => ('kind' in e ? { board: e, wall: e } : e);
/** How long an effect plays: its longer ring. */
export const effectSeconds = (e: Effect) => Math.max(rings(e).board?.dur ?? 0, rings(e).wall?.dur ?? 0);

// ---------- the ring ----------

/** LEDs on the controller and where the second ring starts, checked at the board (issue #10). */
export const LED_COUNT = 100;
export const SPLIT_AT = 48;
/** Which segment lights the board: 0 is LEDs 0–47, checked at the board (issue #10). */
export const BOARD_SEGMENT: 0 | 1 = 0;

// ---------- colours (docs/MAPA.md, Q8): no gold, no black, no dimmed colours ----------

export const WARM: Rgb = [255, 204, 155]; // Gameon, the base; plain 255,255,255 looks blue on this strip
export const WHITE: Rgb = [255, 255, 255];
export const ORANGE: Rgb = [255, 115, 0]; // 255,80,0 looks almost red
export const EMBER: Rgb = [255, 40, 0];
export const RED: Rgb = [255, 0, 0];
export const CRIMSON: Rgb = [255, 0, 40];
export const GREEN: Rgb = [0, 255, 40];
export const TEAL: Rgb = [0, 200, 120];
export const PURPLE: Rgb = [150, 0, 255];
export const MAGENTA: Rgb = [255, 0, 160];
export const YELLOW: Rgb = [255, 190, 0]; // the Pope's rules (26, 60); 255,255,0 tends to look lime on WS2812, tune at the board

// ---------- the Momenty ----------

/** The fade in, as on the controller (`transition` 0.2 s), and the fade back to the base (the base preset's own). */
export const FADE_IN = 0.2;
export const FADE_OUT = 0.7;

type Motion = Omit<Look, 'dur' | 'fadeIn' | 'fadeOut'>;
const wash = (color: Paint, dur: number): Look => ({ kind: 'solid', color, dur, fadeIn: FADE_IN, fadeOut: FADE_OUT });
/** The board ring's wash and the wall ring's motion (or the base), for the same time. */
const pair = (colour: Paint, dur: number, wall: Motion | null): Split =>
  ({ board: wash(colour, dur), wall: wall && { ...wall, dur, fadeIn: FADE_IN, fadeOut: FADE_OUT } });
const run = (color: Rgb, bg: Rgb, rate = 1.4): Motion => ({ kind: 'run', color, bg, size: 2.5, rate });
const ripple = (color: Rgb, bg: Rgb): Motion => ({ kind: 'ripple', color, bg, rate: 3 });
const fill = (color: Rgb, bg: Rgb): Motion => ({ kind: 'fill', color, bg, rate: 0.8 });
/** The wall ring in the board ring's colour, still: Dissolve flickered on the controller (issue #10). */
const still = (color: Rgb): Motion => ({ kind: 'solid', color });
const flow = (rate: number): Motion => ({ kind: 'rainbow', color: 'rainbow', rate });
const sparks = (color: Rgb, bg: Rgb): Motion => ({ kind: 'burst', color, bg, rate: 3 });

export type LedKey =
  | 'base' | 'offline' | 'game-on' | 'leg-start' | 'treble' | 'treble-20' | 'bull' | 'ton' | 'ton-40' | '180' | 'clean-20s' | 'bnb'
  | 'no-score' | 'bust' | 'checkout' | 'madhouse' | 'high-finish' | 'big-fish' | 'set-won' | 'match-won' | 'hit' | 'miss'
  | 'sector-closed' | 'white-horse' | 'life-lost' | 'killer' | 'attempt-failed' | 'player-out' | 'new-record' | 'pope';

/** Every LED look with its preset number; numbers never move, so a preset is overwritten in place by the next upload. */
export const LEDS: Record<LedKey, { preset: number; name: string; group: FxGroup; effect: Effect }> = {
  // Base states stay still: the cameras read moving light as a takeout.
  base: { preset: 100, name: 'Base', group: 'match', effect: { kind: 'solid', color: WARM, dur: 0 } },
  // Breathe over warm white was hard to see; nothing is detected while the board is offline, so plain red.
  offline: { preset: 101, name: 'Board offline', group: 'board', effect: { kind: 'solid', color: RED, dur: 0 } },
  'game-on': { preset: 102, name: 'Game on', group: 'match', effect: pair(WHITE, 2, fill(WHITE, WARM)) },
  'leg-start': { preset: 103, name: 'Leg start', group: 'match', effect: wash(WHITE, 0.9) },
  treble: { preset: 104, name: 'Treble 15-19', group: 'darts', effect: pair(ORANGE, 0.7, run(ORANGE, EMBER)) },
  'treble-20': { preset: 105, name: 'Treble 20', group: 'darts', effect: pair(ORANGE, 1, flow(1.2)) },
  bull: { preset: 106, name: 'Bullseye', group: 'darts', effect: pair(GREEN, 1.4, ripple(GREEN, TEAL)) },
  ton: { preset: 107, name: 'Ton', group: 'visits', effect: pair(ORANGE, 1.4, run(ORANGE, EMBER, 1.2)) },
  'ton-40': { preset: 108, name: 'Ton 40', group: 'visits', effect: pair(ORANGE, 1.6, run(ORANGE, EMBER, 1.8)) },
  '180': { preset: 109, name: '180', group: 'visits', effect: pair(ORANGE, 2, sparks(WHITE, ORANGE)) },
  'clean-20s': { preset: 110, name: 'Clean 20s', group: 'visits', effect: pair(ORANGE, 0.8, run(ORANGE, EMBER, 1.2)) },
  bnb: { preset: 111, name: 'Bed and breakfast', group: 'visits', effect: pair(MAGENTA, 0.8, ripple(PURPLE, MAGENTA)) },
  'no-score': { preset: 112, name: 'No score', group: 'visits', effect: pair(RED, 1.4, still(RED)) },
  bust: { preset: 113, name: 'Bust', group: 'visits', effect: pair(RED, 1.4, still(RED)) },
  checkout: { preset: 114, name: 'Checkout', group: 'legEnd', effect: pair(GREEN, 2, fill(GREEN, TEAL)) },
  madhouse: { preset: 115, name: 'Madhouse', group: 'legEnd', effect: pair(PURPLE, 2, ripple(PURPLE, MAGENTA)) },
  'high-finish': { preset: 116, name: 'High finish', group: 'legEnd', effect: pair(GREEN, 2, ripple(GREEN, TEAL)) },
  'big-fish': { preset: 117, name: 'Big Fish', group: 'legEnd', effect: pair(GREEN, 2, flow(0.9)) },
  'set-won': { preset: 118, name: 'Set won', group: 'legEnd', effect: pair(GREEN, 2, run(GREEN, TEAL, 1)) },
  // The game is over and nothing is detected: both rings celebrate, longer.
  'match-won': {
    preset: 119, name: 'Match won', group: 'legEnd',
    effect: { board: { kind: 'rainbow', color: 'rainbow', dur: 6, fadeIn: FADE_IN, fadeOut: FADE_OUT, rate: 0.3 }, wall: { ...sparks(WHITE, ORANGE), size: 8, dur: 6, fadeIn: FADE_IN, fadeOut: FADE_OUT } },
  },
  // Both rings, long enough to reach full colour: 0.45 s on the board ring alone was hard to see.
  hit: { preset: 120, name: 'Hit', group: 'minigames', effect: pair(ORANGE, 0.8, still(ORANGE)) },
  miss: { preset: 121, name: 'Miss', group: 'minigames', effect: pair(RED, 0.8, still(RED)) },
  // Falls mid-visit: moving light on a ring reads as a takeout and the next dart is lost, so still and as short as Hit.
  'sector-closed': { preset: 122, name: 'Sector closed', group: 'minigames', effect: pair(GREEN, 0.8, still(GREEN)) },
  'white-horse': { preset: 123, name: 'White Horse', group: 'minigames', effect: pair(PURPLE, 2, run(WHITE, PURPLE)) },
  'life-lost': { preset: 124, name: 'Life lost', group: 'minigames', effect: pair(RED, 1, still(RED)) },
  killer: { preset: 125, name: 'Became killer', group: 'minigames', effect: pair(CRIMSON, 1.4, still(CRIMSON)) },
  'attempt-failed': { preset: 126, name: 'Attempt failed', group: 'minigames', effect: pair(CRIMSON, 1.4, still(CRIMSON)) },
  'player-out': { preset: 127, name: 'Player out', group: 'minigames', effect: pair(RED, 2, still(RED)) },
  'new-record': {
    preset: 128, name: 'New record', group: 'minigames',
    effect: { board: { kind: 'rainbow', color: 'rainbow', dur: 3, fadeIn: FADE_IN, fadeOut: FADE_OUT, rate: 0.4 }, wall: { ...ripple(ORANGE, EMBER), dur: 3, fadeIn: FADE_IN, fadeOut: FADE_OUT } },
  },
  // Our rules with the Pope's voice (Bed and breakfast 26, Clean 20s 60) in effects/effects.json; not a base default.
  pope: { preset: 129, name: 'Pope', group: 'visits', effect: pair(YELLOW, 0.8, ripple(YELLOW, ORANGE)) },
};

/** The presets the upload owns; anything in this range that is not in LEDS is removed. */
export const PRESET_RANGE: [number, number] = [100, 149];

/** What a base rule gets by default: its preset and how long it plays. */
export const ledDefault = (key: LedKey) => ({ preset: LEDS[key].preset, seconds: Math.round(effectSeconds(LEDS[key].effect) * 10) / 10 });

/** Default presets of the Stany bazowe; the takeout keeps whatever is on (docs/EFEKTY.md). */
export const BASE_PRESETS = { lobby: LEDS.base.preset, match: LEDS.base.preset, takeout: null, offline: LEDS.offline.preset };

// ---------- WLED presets ----------

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** Effect numbers, speed and intensity from the simulator's tempo, from the WLED 0.15 effect code. */
function wledFx(l: Look, len: number): { fx: number; sx: number; ix: number } {
  switch (l.kind) {
    case 'solid': return { fx: 0, sx: 128, ix: 128 };
    case 'blink': return { fx: 1, sx: 200, ix: 128 };
    // Breathe: one swell per 65536 / ((sx >> 3) + 10) ms.
    case 'pulse': return { fx: 2, sx: clamp(((65.536 / (l.rate ?? 1.5)) - 10) * 8), ix: 128 };
    // Wipe: fill and empty in 750 + (255 - sx) * 150 ms.
    case 'fill': return { fx: 3, sx: clamp(255 - ((l.rate ?? 1.1) * 2000 - 750) / 150), ix: 128 };
    // Running: sx * 1000 / 512 / 256 cycles per s; ix >> 2 is the bands' scale, so bands = (ix >> 2) * len / 256.
    case 'run': return { fx: 15, sx: clamp((l.rate ?? 1.8) * 131), ix: clamp((4 * (l.size ?? 4.7) * 256) / len) };
    case 'ripple': return { fx: 79, sx: 200, ix: 200 };
    case 'burst': return { fx: 89, sx: 255, ix: 220 };
    // Rainbow: ((sx >> 2) + 2) / 65.536 cycles per s; ix 128 spreads one rainbow over the ring.
    case 'rainbow': return { fx: 9, sx: clamp(((l.rate ?? 0.6) * 65.536 - 2) * 4), ix: 128 };
    case 'dissolve': return { fx: 18, sx: 220, ix: 200 };
  }
}

// Copied from the Gameon preset made in the WLED app, so every field WLED saves is set.
const SEGMENT = { grp: 1, spc: 0, of: 0, on: true, frz: false, bri: 255, cct: 127, set: 0, n: '', sel: true, rev: false, mi: false, si: 0, m12: 0, c1: 128, c2: 128, c3: 16, o1: false, o2: false, o3: false };
const MAX_SEGMENTS = 32;

function segment(id: number, start: number, stop: number, look: Look | null) {
  const l = look ?? LEDS.base.effect as Look;
  const { fx, sx, ix } = wledFx(l, stop - start);
  const rainbow = l.color === 'rainbow';
  const col = [rainbow ? WHITE : l.color, l.bg ?? WARM, WARM];
  // Palette 2 (primary colour) turns WLED's Rainbow effect into one colour, so every rainbow needs palette 11.
  return { id, start, stop, ...SEGMENT, col, fx, sx, ix, pal: rainbow ? 11 : 2 };
}

/**
 * The preset as WLED keeps it in presets.json. Effects fade in with `transition`; the base presets carry the fade back,
 * since WLED uses the transition of the preset it goes to.
 */
export function wledPreset(key: LedKey) {
  const { name, effect } = LEDS[key];
  const r = rings(effect);
  const looks = BOARD_SEGMENT === 0 ? [r.board, r.wall] : [r.wall, r.board];
  const isBase = key === 'base' || key === 'offline';
  return {
    n: `ITD ${name}`.slice(0, 32),
    on: true,
    bri: 239,
    transition: Math.round((isBase ? FADE_OUT : FADE_IN) * 10),
    mainseg: 0,
    seg: [
      segment(0, 0, SPLIT_AT, looks[0]),
      segment(1, SPLIT_AT, LED_COUNT, looks[1]),
      ...Array.from({ length: MAX_SEGMENTS - 2 }, () => ({ stop: 0 })),
    ],
  };
}
