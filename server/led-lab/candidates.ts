// Candidate WLED presets for the LED lab (npm run led-lab). Built exactly like the presets made in the WLED app:
// both halves (0–48, 48–100) get the full segment object, every other segment slot is cleared with {stop: 0}.
// The palette is always set: with 2 (* Color 1) an effect uses the colours below, a named palette brings its own.

type Rgb = [number, number, number];

export interface Candidate {
  id: string;
  name: string;
  /** The trigger it is proposed for. */
  group: string;
  /** What it is meant for, shown on the page. */
  use: string;
  /** Seconds it plays before going back to the base preset; null for base states (they stay). */
  dur: number | null;
  fx: number;
  col: [Rgb, Rgb, Rgb];
  sx: number;
  ix: number;
  pal: number;
  c1?: number;
  c2?: number;
  c3?: number;
  o1?: boolean;
  o2?: boolean;
  o3?: boolean;
  bri?: number;
}

/** What the page can change before keeping a candidate. */
export interface Tweak {
  sx?: number;
  ix?: number;
  bri?: number;
  dur?: number;
  col?: [string, string, string];
}

const WARM: Rgb = [255, 204, 155]; // Gameon white; plain 255,255,255 looks blue on this strip
const DIM: Rgb = [60, 40, 25]; // dim warm white, where an effect needs a darker background than the base
const RED: Rgb = [255, 0, 0];
const GOLD: Rgb = [255, 170, 0];
const GREEN: Rgb = [0, 220, 60];
const PURPLE: Rgb = [170, 0, 255];
const ACCENT: Rgb = [245, 130, 36]; // --accent in the app

type Def = Omit<Candidate, 'group' | 'pal' | 'sx' | 'ix' | 'col'> & Partial<Pick<Candidate, 'pal' | 'sx' | 'ix'>> & { col: Rgb[] };
/** One trigger's proposals; pal defaults to 2 (* Color 1), sx and ix to 128, unset colours to warm white (the background). */
const group = (name: string, defs: Def[]): Candidate[] =>
  defs.map(d => ({ pal: 2, sx: 128, ix: 128, ...d, group: name, col: [d.col[0], d.col[1] ?? WARM, d.col[2] ?? WARM] }));

// Round 3 (2026-10-28): proposals per trigger with a built-in sound (BASE_RULES), so each moment gets its own look.
// Learned in rounds 1–2: nothing may move during takeout (motion keeps the board in takeout); Sparkle and Starburst on
// palettes with black (Fire) flicker; solid flashes, ripples, bright starbursts, wipes and running bands look good.
/** The effects per trigger; the kept ones are on the controller (npm run led-lab:upload). */
export const TRIGGERS: Candidate[] = [
  ...group('Base states', [
    { id: 'lobby-waves', name: 'Lobby Sunset', use: 'Lobby: slow warm waves (check the board ignores the motion)', dur: null, fx: 67, col: [WARM], sx: 40, pal: 13 },
    { id: 'offline', name: 'Board Offline', use: 'Board offline: red breathing', dur: null, fx: 2, col: [[180, 0, 0], [10, 0, 0]], sx: 70, ix: 252, bri: 255 },
  ]),
  ...group('Game on', [
    { id: 'game-on', name: 'Warm Fill', use: 'Warm white fills the dimmed ring and stays as Gameon', dur: 1.2, fx: 3, col: [WARM, DIM], sx: 245 },
    { id: 'game-on-accent', name: 'Orange Fill', use: 'App orange fills the ring, then Gameon', dur: 1.2, fx: 3, col: [ACCENT], sx: 245 },
    { id: 'game-on-flash', name: 'Orange Flash', use: 'One app orange flash, then Gameon', dur: 0.5, fx: 0, col: [ACCENT] },
  ]),
  ...group('Bullseye', [
    { id: 'bull-ripple', name: 'Green Ripple', use: 'Green ripples', dur: 1.2, fx: 79, col: [[0, 200, 40]], sx: 200, ix: 200 },
    { id: 'bull-blink', name: 'Red Green Blink', use: 'The bull colours blink in turn', dur: 1, fx: 1, col: [GREEN, RED], sx: 230 },
    { id: 'bull-burst', name: 'Green Burst', use: 'Green starbursts', dur: 1.4, fx: 89, col: [GREEN], sx: 255, ix: 200 },
  ]),
  ...group('Treble 20', [
    { id: 't20-flash', name: 'Orange Flash', use: 'Short app orange flash', dur: 0.4, fx: 0, col: [ACCENT] },
    { id: 't20-running', name: 'Orange Run', use: 'Orange and warm bands rush round', dur: 0.9, fx: 15, col: [ACCENT, WARM], sx: 250, ix: 100 },
    { id: 't20-fill', name: 'Full Fill', use: 'Top of the treble ladder: the ring fills orange', dur: 1.1, fx: 98, col: [ACCENT, WARM], sx: 230, ix: 100 },
  ]),
  ...group('Treble 15–19', [
    { id: 'treble-ladder', name: 'Ladder Fill', use: 'Fills part of the ring like the sound ladder: Intensity is the %, 50 for T15 up to 90 for T19', dur: 1.1, fx: 98, col: [ACCENT, WARM], sx: 230, ix: 70 },
    { id: 'treble-flash', name: 'Warm Flash', use: 'A softer flash than T20, the same for 15–19', dur: 0.4, fx: 0, col: [[255, 170, 90]] },
  ]),
  ...group('Ton', [
    { id: 'ton-flash', name: 'Gold Flash', use: 'Short gold flash; Ton comes often, keep it small', dur: 0.4, fx: 0, col: [GOLD] },
    { id: 'ton-running', name: 'Gold Run', use: 'Gold and warm bands rush round once', dur: 0.8, fx: 15, col: [GOLD, WARM], sx: 250, ix: 100 },
  ]),
  ...group('Ton 40', [
    { id: 'ton40-ripple', name: 'Gold Ripple', use: 'Gold ripples, the Bull Ripple look in gold', dur: 1.4, fx: 79, col: [GOLD], sx: 200, ix: 200 },
    { id: 'ton40-theater', name: 'Gold Theater', use: 'Gold theater chase over warm white', dur: 1.4, fx: 13, col: [GOLD, WARM], sx: 220 },
    { id: 'ton40-fill', name: 'Gold Fill', use: 'Gold fills the ring', dur: 1.3, fx: 98, col: [GOLD, WARM], sx: 230, ix: 100 },
  ]),
  ...group('180', [
    { id: '180-rainbow-burst', name: 'Rainbow Burst', use: 'Rainbow starbursts, New Record style', dur: 4, fx: 89, col: [WARM], sx: 255, ix: 255, pal: 11 },
    { id: '180-ripple-rainbow', name: 'Rainbow Ripple', use: 'Rainbow ripples all over', dur: 4, fx: 99, col: [WARM], sx: 220, ix: 255 },
    { id: '180-theater-rainbow', name: 'Rainbow Theater', use: 'Fast rainbow theater chase', dur: 3, fx: 14, col: [WARM], sx: 240 },
  ]),
  ...group('Clean 20s', [
    { id: 'clean20-running', name: 'Orange Run', use: 'Orange and warm bands, a three-dart reward', dur: 1.2, fx: 15, col: [ACCENT, WARM], sx: 240, ix: 100 },
    { id: 'clean20-theater', name: 'Orange Theater', use: 'Orange theater chase over warm white', dur: 1.2, fx: 13, col: [ACCENT, WARM], sx: 220 },
  ]),
  ...group('Bed and breakfast', [
    { id: 'bnb-pastel', name: 'Pastel Waves', use: 'Soft pastel waves, a joke not a reward', dur: 1.5, fx: 67, col: [WARM], sx: 200, pal: 20 },
    { id: 'bnb-pink', name: 'Pink Flash', use: 'One soft pink flash', dur: 0.6, fx: 0, col: [[255, 120, 140]] },
  ]),
  ...group('Big Fish', [
    { id: 'big-fish-burst', name: 'Ocean Burst', use: 'Ocean starbursts (kept in round 2)', dur: 4, fx: 89, col: [WARM], sx: 255, ix: 220, pal: 51 },
    { id: 'big-fish-ripple', name: 'Ocean Ripple', use: 'Big ocean ripples', dur: 4, fx: 79, col: [WARM], sx: 230, ix: 255, pal: 51 },
    { id: 'big-fish-aqua', name: 'Aqua Flash Burst', use: 'Starbursts on the Aqua Flash palette, brighter', dur: 4, fx: 89, col: [WARM], sx: 255, ix: 255, pal: 63 },
  ]),
  ...group('High finish', [
    { id: 'high-finish-ripple', name: 'Green Ripple', use: 'Big green ripples, more than Checkout', dur: 2, fx: 79, col: [GREEN], sx: 220, ix: 255 },
    { id: 'high-finish-burst', name: 'Green Burst', use: 'Green starbursts', dur: 2, fx: 89, col: [GREEN], sx: 255, ix: 230 },
  ]),
  ...group('Checkout', [
    { id: 'checkout-run', name: 'Green Run', use: 'Green and warm bands running', dur: 2, fx: 15, col: [GREEN, WARM], sx: 230, ix: 100 },
    { id: 'checkout-sweep', name: 'Green Sweep', use: 'Green sweeps over warm white', dur: 2, fx: 6, col: [GREEN, WARM], sx: 235 },
    { id: 'checkout-flash', name: 'Green Flash', use: 'One green flash', dur: 0.8, fx: 0, col: [GREEN] },
  ]),
  ...group('Madhouse', [
    { id: 'madhouse-drip', name: 'Purple Drip', use: 'Purple drips, the long road to D1', dur: 1.5, fx: 96, col: [PURPLE], sx: 200, ix: 200 },
    { id: 'madhouse-ripple', name: 'Purple Ripple', use: 'Purple ripples', dur: 1.5, fx: 79, col: [PURPLE], sx: 200, ix: 220 },
  ]),
  ...group('Bust', [
    { id: 'bust-blink', name: 'Red Blink', use: 'Two hard red blinks', dur: 1.2, fx: 1, col: [RED], sx: 230 },
    { id: 'bust-flash', name: 'Red Flash', use: 'One red flash', dur: 0.6, fx: 0, col: [RED] },
  ]),
  ...group('No score', [
    { id: 'no-score', name: 'Dim Rust', use: 'The ring drops to dim rust', dur: 1, fx: 0, col: [[120, 40, 10]] },
    { id: 'no-score-grey', name: 'Grey Dip', use: 'The ring dips to dim grey', dur: 0.8, fx: 0, col: [[40, 40, 40]] },
  ]),
  ...group('Set won', [
    { id: 'set-won-burst', name: 'Gold Burst', use: 'Gold starbursts', dur: 3, fx: 89, col: [GOLD], sx: 255, ix: 200 },
    { id: 'set-won-ripple', name: 'Gold Ripple', use: 'Big gold ripples', dur: 3, fx: 79, col: [GOLD], sx: 220, ix: 255 },
    { id: 'set-won-theater', name: 'Gold Green Theater', use: 'Gold theater chase over green', dur: 3, fx: 13, col: [GOLD, GREEN], sx: 220 },
  ]),
  ...group('Match won', [
    { id: 'match-won-burst', name: 'Party Burst', use: 'Party-coloured starbursts', dur: 6, fx: 89, col: [WARM], sx: 255, ix: 230, pal: 6 },
    { id: 'match-won-ripple', name: 'Rainbow Ripple', use: 'Rainbow ripples, long', dur: 6, fx: 99, col: [WARM], sx: 220, ix: 255 },
    { id: 'match-won-fireworks-1d', name: 'Party Fireworks 1D', use: 'Like the 180 preset, on the Party palette', dur: 6, fx: 90, col: [WARM], pal: 6 },
  ]),
  ...group('New record', [
    { id: 'new-record', name: 'Magenta Burst', use: 'Magenta starbursts (liked in round 1)', dur: 3, fx: 89, col: [WARM], sx: 255, ix: 180, pal: 40 },
    { id: 'new-record-ripple', name: 'Magenta Ripple', use: 'Magenta ripples', dur: 3, fx: 79, col: [WARM], sx: 220, ix: 255, pal: 40 },
  ]),
  ...group('White Horse', [
    { id: 'white-horse', name: 'White Theater', use: 'White theater chase gallop', dur: 2, fx: 13, col: [[255, 255, 255], DIM], sx: 200 },
    { id: 'white-horse-run', name: 'White Run', use: 'White bands galloping round', dur: 2, fx: 15, col: [[255, 255, 255], DIM], sx: 240, ix: 100 },
  ]),
  ...group('Player out', [
    { id: 'player-out', name: 'Red Drip', use: 'Red drips', dur: 2, fx: 96, col: [RED], sx: 200, ix: 200 },
    { id: 'player-out-flash', name: 'Red Flash', use: 'One red flash', dur: 0.6, fx: 0, col: [RED] },
  ]),
  ...group('Minigame events without a sound', [
    { id: 'hit-flash', name: 'Hit Flash', use: 'Target hit, cricket mark: short flash in the app orange', dur: 0.5, fx: 0, col: [ACCENT] },
    { id: 'sector-closed', name: 'Sector Closed', use: 'Sector closed / done: app orange wipe over warm white', dur: 1.2, fx: 3, col: [ACCENT, WARM], sx: 245 },
    { id: 'life-lost-flash', name: 'Life Lost', use: 'Life lost: one red-orange flash, no blinking', dur: 0.6, fx: 0, col: [[255, 30, 0]] },
  ]),
];

// Round 4 (2026-10-28): basic behaviours, built up from the bottom. Each one in pure white, strong orange and rainbow
// (red only where a bad moment might use it), to see which behaviours read well and do not glitch on this ring before
// effects are put together from them. The background is the base the ring comes from (Gameon warm white), never black.
const WHITE: Rgb = [255, 255, 255];
const ORANGE: Rgb = [255, 115, 0]; // 255,80,0 looked almost red on the ring
const RAINBOW = 11;

type Basic = { fx: number; sx?: number; ix?: number; dur: number; rainbowFx?: number; bg?: Rgb; suffix?: string };
/** One behaviour in white, orange, rainbow and, when `red`, red; the colour goes in slot 1, the base in slot 2. */
const behaviour = (name: string, use: string, b: Basic, red = false): Candidate[] => {
  const key = name.toLowerCase().replace(/ /g, '-') + (b.suffix ? `-${b.suffix}` : '');
  const v = (id: string, colour: string, col: Rgb, pal = 2, fx = b.fx): Candidate =>
    ({ id: `basic-${key}-${id}`, name: colour + (b.bg ? ' on white' : ''), group: name, use, dur: b.dur, fx, sx: b.sx ?? 128, ix: b.ix ?? 128, pal, col: [col, b.bg ?? WARM, WARM] });
  return [
    v('white', 'White', WHITE),
    v('orange', 'Orange', ORANGE),
    v('rainbow', 'Rainbow', WHITE, RAINBOW, b.rainbowFx),
    ...(red ? [v('red', 'Red', [255, 0, 0])] : []),
  ];
};

const BASICS: Candidate[] = [
  ...behaviour('Flash', 'The whole ring in one colour for a moment (rainbow: a moving rainbow)', { fx: 0, dur: 0.5, rainbowFx: 9, sx: 200 }, true),
  ...behaviour('Pulse', 'One smooth swell from the base to the colour and back', { fx: 2, sx: 200, dur: 1.5 }, true),
  ...behaviour('Fill', 'The colour fills the ring from one point, then drains back to the base', { fx: 3, sx: 245, dur: 2.2 }),
  ...behaviour('Run', 'Bands of colour run round the ring', { fx: 15, sx: 240, ix: 100, dur: 1.5 }),
  ...behaviour('Comet', 'One dot with a tail swings round the ring', { fx: 92, sx: 230, ix: 200, dur: 1.5 }),
  ...behaviour('Burst', 'Bright starbursts', { fx: 89, sx: 255, ix: 220, dur: 2 }),
  ...behaviour('Ripple', 'Waves spread out from random points', { fx: 79, sx: 220, ix: 220, dur: 2 }),
  // Round 5: orange and rainbow bursts looked glitchy, probably from fading into warm white; these fade into white.
  ...behaviour('Burst', 'Bright starbursts fading into white instead of warm white', { fx: 89, sx: 255, ix: 220, dur: 2, bg: WHITE, suffix: 'on-white' }).slice(1),
  // Round 5: Blink was harsh and irregular. Blink, Breathe and Wipe run on the controller's clock, so they start at a random
  // point of their cycle; Heartbeat starts its beat when the effect starts, so these two always look the same.
  // Heartbeat at speed 0 (40 bpm): beats at 0 and 0.5 s, the next pair at 1.5 s. Round 6: the first versions were cut
  // mid-fade, so Fade Flash now fades out fast enough to be done before the second beat and Double Pulse stops just
  // before the next pair. Longer than 0.48 s or 1.4 s brings the next beat back (the app rounds to 0.1 s).
  ...behaviour('Fade Flash', 'One beat: the colour at once, then a fade to the base, done before 0.5 s', { fx: 100, sx: 0, ix: 255, dur: 0.48 }, true),
  ...behaviour('Double Pulse', 'Two soft beats, lub-dub, fully faded before the next pair at 1.5 s', { fx: 100, sx: 0, ix: 200, dur: 1.4 }, true),
];

/** A basic behaviour reused for one trigger, with its own id so the verdict and tweaks are its own. */
const variant = (from: string, group: string, name: string, use: string, change: Partial<Candidate>): Candidate => {
  const b = BASICS.find(c => c.id === from);
  if (!b) throw new Error(`No basic ${from}`);
  return { ...b, id: `${group.toLowerCase().replace(/ /g, '-')}-${name.toLowerCase().replace(/ /g, '-')}`, group, name, use, ...change };
};

// Round 7 (2026-10-28), from the first look in a match: Fill did not suit Checkout, Ripple in rainbow was barely
// visible on Big Fish, and Double Pulse was too quick and too sharp, so it goes from Bullseye and Bed and breakfast.
const ROUND7: Candidate[] = [
  variant('basic-pulse-orange', 'Checkout', 'Orange Pulse', 'One slow orange swell', { dur: 2 }),
  variant('basic-run-orange', 'Checkout', 'Orange Run', 'Orange bands, longer than Ton 40', { dur: 2.2 }),
  variant('basic-ripple-white', 'Checkout', 'White Ripple', 'White ripples', { dur: 2.2 }),
  variant('basic-flash-rainbow', 'Checkout', 'Rainbow Sweep', 'The moving rainbow over the whole ring', { dur: 1.5 }),
  variant('basic-flash-rainbow', 'Big Fish', 'Rainbow Wave', 'The whole ring a moving rainbow: nothing to blend away', { dur: 4 }),
  variant('basic-burst-on-white-rainbow', 'Big Fish', 'Rainbow Burst', 'Rainbow starbursts fading into white (also Match won)', { dur: 4 }),
  variant('basic-run-rainbow', 'Big Fish', 'Rainbow Run', 'Rainbow bands, longer than Madhouse', { dur: 4 }),
  variant('basic-ripple-rainbow', 'Big Fish', 'Strong Ripple', 'Ripple at full speed and wave count, full brightness', { dur: 4, sx: 255, ix: 255, bri: 255 }),
  variant('basic-pulse-orange', 'Bullseye', 'Orange Pulse', 'One slow orange swell instead of two beats', { dur: 2, sx: 150 }),
  variant('basic-flash-orange', 'Bullseye', 'Long Flash', 'Orange for a second, then the fade back to the base', { dur: 1 }),
  // Double Pulse is out altogether: Heartbeat jumps to full colour at once, which looked too sharp.
  variant('basic-pulse-white', 'Bed and breakfast', 'White Pulse', 'One soft white swell (Ton has the same)', { dur: 1.5 }),
  variant('basic-ripple-white', 'Bed and breakfast', 'White Ripple', 'White ripples, short', { dur: 1.5 }),
  variant('basic-flash-rainbow', 'Bed and breakfast', 'Rainbow Sweep', 'A short moving rainbow, the joke version', { dur: 1 }),
];

/** What the lab page shows now. */
export const CANDIDATES = [...ROUND7, ...BASICS];
export const BASICS_AND_TRIGGERS = [...ROUND7, ...BASICS, ...TRIGGERS];

/**
 * Which candidate (or preset number already on the controller) each base rule plays and for how long (docs/EFEKTY.md, Presety z LED labu), set by
 * npm run led-lab:upload. Small moments flash, medium ones pulse or run, big ones fill or ripple, the biggest burst;
 * white is neutral, orange good, rainbow the biggest moments, red bad. Rules not listed are left as they are.
 */
export const ASSIGN: Record<string, [candidate: string | number, seconds: number]> = {
  ...Object.fromEntries([15, 16, 17, 18, 19].map(n => [`b-treble-${n}`, ['basic-flash-white', 0.5]])),
  'b-treble-20': ['basic-flash-orange', 0.5],
  'b-ton': ['basic-pulse-white', 1.5],
  'b-clean-20s': ['basic-run-white', 1.5],
  'b-ton-40': ['basic-run-orange', 1.5],
  'b-bullseye': ['bullseye-long-flash', 1],
  'b-bed-and-breakfast': ['bed-and-breakfast-white-ripple', 1.5],
  'b-madhouse': ['basic-run-rainbow', 1.5],
  'b-game-on': ['basic-fill-white', 2.2],
  'b-checkout': ['checkout-rainbow-sweep', 1.5],
  'b-high-finish': ['basic-fill-rainbow', 2.2],
  'b-set-won': ['basic-ripple-orange', 3],
  'b-big-fish': ['big-fish-rainbow-burst', 4],
  'b-new-record': ['basic-pulse-rainbow', 3],
  'b-white-horse': ['basic-burst-white', 2],
  'b-180': ['basic-burst-on-white-orange', 4],
  'b-match-won': ['basic-burst-on-white-rainbow', 6],
  'b-bust': [3, 1.4], // the user's own Bust preset (Dissolve), chosen in the app
  'b-player-out': ['basic-pulse-red', 1.5],
  'b-no-score': ['basic-flash-red', 0.5],
};

/** Base states: a candidate, a preset number already on the controller, or null for none. */
export const ASSIGN_BASE: Record<'lobby' | 'match' | 'takeout' | 'offline', string | number | null> = {
  // Every state the board watches in must be static: the cameras read moving light as a takeout.
  lobby: 1,
  match: 1, // static Gameon warm white: effects return here
  takeout: null, // anything moving during takeout keeps the board in takeout
  offline: 'basic-pulse-red',
};

/** Where the presets already on the controller compete. */
export const SAVED_IN: Record<number, string> = { 1: 'Base states', 3: 'Bust', 4: 'Checkout', 5: '180', 6: 'Treble 20', 8: 'No score' };

// Copied from preset 1 (Gameon), so every field WLED saves is set and nothing is left to the previous state.
const SEGMENT = { grp: 1, spc: 0, of: 0, on: true, frz: false, bri: 255, cct: 127, set: 0, n: '', sel: true, rev: false, mi: false, si: 0, m12: 0 };
const HALVES = [[0, 48], [48, 100]];
const MAX_SEGMENTS = 32;

const hex = (h: string): Rgb => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as Rgb;

/** The full WLED state, the same object that goes into presets.json once kept (plus "n"). */
export function build(c: Candidate, t: Tweak = {}) {
  const col = t.col ? t.col.map(hex) : c.col;
  const seg = HALVES.map(([start, stop], id) => ({
    id, start, stop, ...SEGMENT,
    col, fx: c.fx, sx: t.sx ?? c.sx, ix: t.ix ?? c.ix, pal: c.pal,
    c1: c.c1 ?? 128, c2: c.c2 ?? 128, c3: c.c3 ?? 16, o1: c.o1 ?? false, o2: c.o2 ?? false, o3: c.o3 ?? false,
  }));
  return {
    on: true,
    bri: t.bri ?? c.bri ?? 239,
    transition: c.dur === null ? 7 : 0,
    mainseg: 0,
    seg: [...seg, ...Array.from({ length: MAX_SEGMENTS - seg.length }, () => ({ stop: 0 }))],
  };
}
