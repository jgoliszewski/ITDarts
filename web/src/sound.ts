// Built-in sounds of the kiosk (docs/EFEKTY.md, Wbudowane dźwięki), made with WebAudio, so there are no files to ship.
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

/** A Reguła's sound (docs/EFEKTY.md). A new one cuts the one still playing; gain can go above 1 for quiet files. */
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

/** One sine voice with a fast attack and an exponential decay. */
function tone(a: AudioContext, t: number, freq: number, dur: number, peak: number, attack: number) {
  const o = a.createOscillator();
  const g = a.createGain();
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** A marimba note: the fundamental plus a short fourth partial for the wooden knock. */
function marimba(a: AudioContext, t: number, freq: number, volume: number) {
  tone(a, t, freq, 0.28, volume * 0.4, 0.002);
  tone(a, t, freq * 4, 0.06, volume * 0.12, 0.001);
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99;

/** The next player's turn: a marimba arpeggio, C5 E5 G5 (picked after the first tests in place of a noise swoosh). */
export function turnSound(volume = 0.6) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  [C5, E5, G5].forEach((f, i) => marimba(a, t + i * 0.075, f, volume));
  effectEnd = Math.max(effectEnd, t + 2 * 0.075 + 0.28);
}

const C4 = 261.63, G4 = 392.0;

/** A counted dart in the minigames with hit sounds: a fifth up, C5 G5 (docs/EFEKTY.md, Wbudowane dźwięki). */
export function hitSound(volume = 0.45) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  marimba(a, t, C5, volume);
  marimba(a, t + 0.06, G5, volume);
}

/** A dart that did not count: the mirror of the hit, G4 C4. */
export function missSound(volume = 0.45) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + 0.01;
  marimba(a, t, G4, volume);
  marimba(a, t + 0.06, C4, volume);
}
