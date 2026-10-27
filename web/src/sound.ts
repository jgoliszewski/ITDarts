// Sounds of the kiosk: rule files, the caller, and the built-in sounds made with WebAudio (docs/EFEKTY.md, Dźwięki
// wbudowane), so there are no files to ship for those.
import { BUILTIN_SOUNDS, builtinKey } from '../../server/effects/builtin.ts';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
  } catch {
    return null;
  }
  // Without the kiosk's autoplay flag the context starts suspended until a click.
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const buffers = new Map<string, Promise<AudioBuffer | null>>();
let playing: AudioBufferSourceNode | null = null;
/** When the effect sound or the turn sound ends, in AudioContext time; the caller waits for it. */
let effectEnd = 0;

function load(a: AudioContext, url: string): Promise<AudioBuffer | null> {
  let b = buffers.get(url);
  if (!b) {
    b = fetch(url)
      .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then(data => a.decodeAudioData(data))
      .catch(() => {
        buffers.delete(url);
        return null;
      });
    buffers.set(url, b);
  }
  return b;
}

/** A Reguła's sound file. A new one cuts the one still playing; gain can go above 1 for quiet files. */
export async function playFile(url: string, gain: number) {
  const a = audio();
  if (!a) return;
  const buf = await load(a, url);
  if (!buf) return;
  playing?.stop();
  const src = a.createBufferSource();
  src.buffer = buf;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(g).connect(a.destination);
  src.onended = () => {
    if (playing === src) playing = null;
  };
  playing = src;
  src.start();
  effectEnd = a.currentTime + buf.duration;
}

/** A Reguła's sound by its library id: a file under /sounds/ or `builtin:<key>`, which is synthesized here. */
export function playSound(url: string, gain: number): Promise<void> {
  const key = builtinKey(url);
  if (key === null) return playFile(url, gain);
  builtinSound(key, gain);
  return Promise.resolve();
}

/** Longest the caller waits for an effect sound (docs/EFEKTY.md#caller). */
const CALLER_WAIT_S = 2;
let callerQueue: Promise<void> = Promise.resolve();

function playToEnd(a: AudioContext, buf: AudioBuffer, gain: number): Promise<void> {
  return new Promise(done => {
    const src = a.createBufferSource();
    src.buffer = buf;
    const g = a.createGain();
    g.gain.value = gain;
    src.connect(g).connect(a.destination);
    src.onended = () => done();
    src.start();
  });
}

/**
 * The caller: its files one after another, after the effect sound of the same event (`after`) and at most 2 s later.
 * Calls queue up, so a score and the next player's “you require” never talk over each other.
 */
export function playCaller(urls: string[], gain: number, after: Promise<unknown> = Promise.resolve()) {
  callerQueue = callerQueue.then(async () => {
    await after;
    const a = audio();
    if (!a) return;
    const bufs = await Promise.all(urls.map(u => load(a, u)));
    const wait = Math.min(Math.max(effectEnd - a.currentTime, 0), CALLER_WAIT_S);
    if (wait > 0) await new Promise(r => setTimeout(r, wait * 1000));
    for (const b of bufs) if (b) await playToEnd(a, b, gain);
  }).catch(() => undefined);
}

// ---------- synthesis ----------

/** A short room: convolution with decaying noise. `space` on a voice is how much of it goes there. */
let wet: GainNode | null = null;
function reverb(a: AudioContext): GainNode {
  if (wet) return wet;
  const sec = 1.8, n = a.sampleRate * sec, buf = a.createBuffer(2, n, a.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6);
  }
  const conv = a.createConvolver();
  conv.buffer = buf;
  wet = a.createGain();
  wet.gain.value = 0.4;
  wet.connect(conv).connect(a.destination);
  return wet;
}

function out(a: AudioContext, node: AudioNode, space: number) {
  node.connect(a.destination);
  if (space > 0) {
    const g = a.createGain();
    g.gain.value = space;
    node.connect(g).connect(reverb(a));
  }
}

interface Voice {
  type?: OscillatorType;
  space?: number;
  /** The pitch slides to this frequency over the whole duration. */
  glide?: number;
}

/** One voice with a fast attack and an exponential decay. */
function tone(a: AudioContext, t: number, freq: number, dur: number, peak: number, attack: number, v: Voice = {}) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = v.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (v.glide) o.frequency.exponentialRampToValueAtTime(v.glide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  out(a, g, v.space ?? 0);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** A marimba note: the fundamental plus a short fourth partial for the wooden knock. */
function marimba(a: AudioContext, t: number, freq: number, volume: number, space = 0) {
  tone(a, t, freq, 0.28, volume * 0.4, 0.002, { space });
  tone(a, t, freq * 4, 0.06, volume * 0.12, 0.001, { space });
}

/** A small bell: inharmonic partials over a long fundamental. */
function bell(a: AudioContext, t: number, freq: number, volume: number, space: number, dur: number) {
  tone(a, t, freq, dur, volume * 0.32, 0.002, { space });
  tone(a, t, freq * 2.76, dur * 0.4, volume * 0.09, 0.001, { space });
  tone(a, t, freq * 5.4, dur * 0.15, volume * 0.04, 0.001, { space });
}

function kalimba(a: AudioContext, t: number, freq: number, volume: number, space = 0.15) {
  tone(a, t, freq, 0.55, volume * 0.4, 0.003, { space });
  tone(a, t, freq * 2.01, 0.25, volume * 0.14, 0.002, { space });
  tone(a, t, freq * 6, 0.03, volume * 0.08, 0.001, { space });
}

/** A marimba chord strummed from the bottom, 18 ms between notes. */
function strum(a: AudioContext, t: number, freqs: number[], volume: number, space: number) {
  freqs.forEach((f, i) => marimba(a, t + i * 0.018, f, volume, space));
}

/** Filtered noise, with the filter sweeping from f0 to f1. */
function noise(a: AudioContext, t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, peak: number, q = 1, space = 0) {
  const n = Math.ceil(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const s = a.createBufferSource();
  s.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g);
  out(a, g, space);
  s.start(t);
  s.stop(t + dur + 0.05);
}

/** A soft knock on wood: low-passed noise and a dropping sine. */
function knock(a: AudioContext, t: number, volume: number) {
  noise(a, t, 0.08, 'lowpass', 900, 200, 0.5 * volume);
  tone(a, t, 150, 0.12, 0.4 * volume, 0.002, { glide: 70 });
}

/** A gong: inharmonic partials with a long decay. */
function gong(a: AudioContext, t: number, freq: number, volume: number, dur: number, space = 0.5) {
  [[1, 0.38], [1.48, 0.2], [2.37, 0.14], [3.1, 0.09], [4.2, 0.05]].forEach(([r, p], i) => tone(a, t, freq * r, dur * (1 - i * 0.12), volume * p, 0.004, { space }));
}

const C4 = 261.63, Eb4 = 311.13, G4 = 392.0, Ab4 = 415.3, A4 = 440, B4 = 493.88;
const C5 = 523.25, D5 = 587.33, Eb5 = 622.25, E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880, B5 = 987.77;
const C6 = 1046.5, D6 = 1174.66, Eb6 = 1244.51, E6 = 1318.51, G6 = 1567.98, C7 = 2093, E7 = 2637.02;

const CHORD_C = [C4, 329.63, G4, C5], CHORD_F = [349.23, A4, C5, F5], CHORD_G = [G4, B4, D5, G5], CHORD_C_HI = [C5, E5, G5, C6];
const seq = (t: number, freqs: number[], step: number, play: (t: number, f: number) => void) => freqs.forEach((f, i) => play(t + i * step, f));

/** A treble sparkle transposed up the pentatonic: T15 starts on C5, T20 on C6. */
function sparkle(a: AudioContext, t: number, v: number, ratio: number) {
  seq(t, [C5, E5, G5, C6].map(f => f * ratio), 0.04, (t, f) => marimba(a, t, f, v, 0.2));
  bell(a, t + 0.16, E6 * ratio, v * 0.7, 0.4, 0.9);
}
const PENTATONIC = [C5, D5, E5, G5, A5, C6].map(f => f / C5);

/** Picked on 2026-10-27 from the proposal pages. `v` is the gain, with the effects volume already in it. */
const BUILTIN: Record<string, (a: AudioContext, t: number, v: number) => void> = {
  'treble-15': (a, t, v) => sparkle(a, t, v, PENTATONIC[0]),
  'treble-16': (a, t, v) => sparkle(a, t, v, PENTATONIC[1]),
  'treble-17': (a, t, v) => sparkle(a, t, v, PENTATONIC[2]),
  'treble-18': (a, t, v) => sparkle(a, t, v, PENTATONIC[3]),
  'treble-19': (a, t, v) => sparkle(a, t, v, PENTATONIC[4]),
  'treble-20': (a, t, v) => sparkle(a, t, v, PENTATONIC[5]),
  bull: (a, t, v) => {
    marimba(a, t, C4, v * 1.2, 0.3);
    marimba(a, t + 0.07, C5, v, 0.3);
    bell(a, t + 0.1, E5, v * 0.8, 0.5, 1.3);
  },
  ton: (a, t, v) => seq(t, [C5, E5, G5], 0.07, (t, f) => marimba(a, t, f, v, 0.1)),
  'ton-40': (a, t, v) => {
    seq(t, [C5, E5, G5, C6], 0.065, (t, f) => marimba(a, t, f, v, 0.15));
    bell(a, t + 0.26, E6, v * 0.8, 0.4, 1.0);
  },
  '180': (a, t, v) => {
    seq(t, [C5, E5, G5, C6, E6, G6, C7], 0.05, (t, f) => marimba(a, t, f, v, 0.25));
    bell(a, t + 0.35, G6, v * 0.8, 0.6, 1.4);
    bell(a, t + 0.41, C7, v, 0.6, 1.5);
    bell(a, t + 0.47, E7, v * 0.6, 0.6, 1.5);
  },
  'leg-won': (a, t, v) => {
    strum(a, t, CHORD_C_HI, v, 0.25);
    bell(a, t + 0.05, C6, v * 0.9, 0.45, 1.2);
  },
  'high-finish': (a, t, v) => {
    strum(a, t, CHORD_G, v, 0.2);
    strum(a, t + 0.3, CHORD_C_HI, v, 0.35);
    seq(t + 0.32, [C6, E6, G6], 0.06, (t, f) => bell(a, t, f, v * 0.9, 0.55, 1.4));
  },
  'big-fish': (a, t, v) => {
    noise(a, t, 0.7, 'bandpass', 200, 3000, v * 0.22, 3, 0.3);
    tone(a, t, 110, 0.7, v * 0.15, 0.05, { type: 'triangle', space: 0.3, glide: 440 });
    gong(a, t + 0.7, 98, v, 1.8);
    strum(a, t + 0.7, [C5, E5, G5, C6, E6], v, 0.4);
    seq(t + 0.75, [C6, E6, G6, C7], 0.05, (t, f) => bell(a, t, f, v * 0.8, 0.6, 1.5));
  },
  'set-won': (a, t, v) => {
    strum(a, t, CHORD_G, v, 0.2);
    seq(t + 0.08, [G5, B5], 0.08, (t, f) => marimba(a, t, f, v, 0.2));
    strum(a, t + 0.32, CHORD_C_HI, v, 0.3);
    bell(a, t + 0.34, E6, v * 0.8, 0.5, 1.2);
    bell(a, t + 0.44, C6, v * 0.8, 0.5, 1.2);
  },
  'match-won': (a, t, v) => {
    const chords = [CHORD_C, CHORD_F, CHORD_G], arps = [[C5, E5, G5], [F5, A5, C6], [G5, B5, D6]];
    chords.forEach((c, i) => {
      strum(a, t + i * 0.4, c, v, 0.2);
      seq(t + i * 0.4 + 0.1, arps[i], 0.06, (t, f) => marimba(a, t, f, v * 0.8, 0.2));
    });
    strum(a, t + 1.2, [C5, E5, G5, C6, E6], v, 0.4);
    bell(a, t + 1.22, C6, v, 0.6, 1.6);
    bell(a, t + 1.28, G6, v * 0.7, 0.6, 1.6);
    bell(a, t + 1.34, C7, v * 0.5, 0.6, 1.6);
  },
  bust: (a, t, v) => {
    seq(t, [Eb5, C5, Ab4], 0.11, (t, f) => tone(a, t, f, 0.35, v * 0.22, 0.01, { type: 'triangle', space: 0.25 }));
    tone(a, t + 0.1, 180, 0.5, v * 0.3, 0.02, { space: 0.2, glide: 90 });
  },
  'no-score': (a, t, v) => {
    tone(a, t, 440, 0.3, v * 0.22, 0.01, { type: 'triangle', space: 0.15, glide: 220 });
    knock(a, t + 0.3, v * 0.9);
  },
  madhouse: (a, t, v) => {
    marimba(a, t, C4, v * 1.1, 0.3);
    marimba(a, t + 0.09, Eb4, v, 0.3);
    bell(a, t + 0.15, Eb6, v * 0.8, 0.5, 1.2);
  },
  'game-on': (a, t, v) => {
    seq(t, [C5, D5, E5], 0.07, (t, f) => marimba(a, t, f, v, 0.15));
    bell(a, t + 0.21, G5, v * 0.8, 0.4, 1.0);
  },
  'clean-20s': (a, t, v) => {
    seq(t, [C6, C6, C6], 0.09, (t, f) => marimba(a, t, f, v, 0.15));
    bell(a, t + 0.27, E6, v * 0.7, 0.4, 0.9);
  },
  'bed-and-breakfast': (a, t, v) => seq(t, [C5, B4], 0.11, (t, f) => kalimba(a, t, f, v * 0.9)),
  'new-record': (a, t, v) => {
    seq(t, [C6, E6, G6, C7], 0.07, (t, f) => bell(a, t, f, v * 0.8, 0.5, 1.2));
    bell(a, t + 0.35, E7, v * 0.6, 0.6, 1.4);
  },
  'white-horse': (a, t, v) => {
    [0, 0.06, 0.18, 0.24, 0.3, 0.42].forEach((d, i) => marimba(a, t + d, i % 3 === 2 ? G5 : C5, v * 0.9, 0.15));
    bell(a, t + 0.5, C6, v * 0.8, 0.4, 1.0);
  },
  'player-out': (a, t, v) => {
    marimba(a, t, Eb4, v * 1.1, 0.3);
    marimba(a, t + 0.1, C4, v * 1.1, 0.3);
    tone(a, t, 260, 0.8, v * 0.2, 0.02, { space: 0.2, glide: 130 });
  },
  turn: (a, t, v) => [C5, E5, G5].forEach((f, i) => marimba(a, t + i * 0.075, f, v)),
  hit: (a, t, v) => {
    marimba(a, t, C5, v);
    marimba(a, t + 0.06, G5, v);
  },
  miss: (a, t, v) => {
    marimba(a, t, G4, v);
    marimba(a, t + 0.06, C4, v);
  },
};

/** A built-in sound by its key; the caller waits for its listed length. */
export function builtinSound(key: string, gain: number) {
  const play = BUILTIN[key];
  const a = audio();
  if (!play || !a) return;
  const t = a.currentTime + 0.01;
  play(a, t, gain);
  effectEnd = Math.max(effectEnd, t + (BUILTIN_SOUNDS.find(s => s.key === key)?.durationMs ?? 0) / 1000);
}

/** The next player's turn: a marimba arpeggio, C5 E5 G5 (picked after the first tests in place of a noise swoosh). */
export const turnSound = (volume = 0.6) => builtinSound('turn', volume);

/** A counted dart in the minigames with hit sounds: a fifth up, C5 G5 (docs/EFEKTY.md, Wbudowane dźwięki). */
export const hitSound = (volume = 0.45) => builtinSound('hit', volume);

/** A dart that did not count: the mirror of the hit, G4 C4. */
export const missSound = (volume = 0.45) => builtinSound('miss', volume);
