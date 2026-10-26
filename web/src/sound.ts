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

/** The next player's turn: noise through a band-pass filter that sweeps up and back down. */
export function swoosh(volume = 0.5) {
  const a = audio();
  if (!a) return;
  const len = 0.5;
  const peak = 0.16;
  const t = a.currentTime;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * len), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.5;
  filter.frequency.setValueAtTime(500, t);
  filter.frequency.exponentialRampToValueAtTime(3200, t + peak);
  filter.frequency.exponentialRampToValueAtTime(700, t + len);
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + peak);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t);
  src.stop(t + len);
}
