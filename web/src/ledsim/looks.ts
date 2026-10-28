// LED simulator (docs/MAPA.md): the rings's behaviours computed in the browser, so effects can be picked without the
// board. Every behaviour is a pure function of time since the effect started; `clock` mimics WLED effects that run on
// the controller's clock and so start anywhere in their cycle.

import type { Look, Paint, Rgb } from '../../../server/effects/leds.ts';

export type { Look, Paint, Rgb };

/** A WLED segment: LEDs [start, stop), counted backwards when `rev`. */
export interface Seg {
  start: number;
  stop: number;
  rev?: boolean;
}

const TAU = Math.PI * 2;
const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const smooth = (x: number) => {
  const v = clamp(x);
  return v * v * (3 - 2 * v);
};

/** A stable random number in [0, 1) for (n, seed). */
export function hash(n: number, seed: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed + 0x27d4eb2f, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

export function mix(a: Rgb, b: Rgb, w: number): Rgb {
  return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, a[2] + (b[2] - a[2]) * w];
}

export function hsv(h: number, s = 1, v = 1): Rgb {
  const i = Math.floor(((h % 1) + 1) % 1 * 6), f = ((h % 1) + 1) % 1 * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  return [r * 255, g * 255, b * 255];
}

const paint = (c: Paint, i: number, len: number, t: number): Rgb => (c === 'rainbow' ? hsv(i / len + t * 0.15) : c);

/** How strongly the behaviour shows at LED i of a segment (0 = background, 1 = colour), with `t` already shifted. */
function amount(look: Look, i: number, len: number, t: number, seed: number): number {
  const rate = look.rate;
  switch (look.kind) {
    case 'solid':
    case 'rainbow':
      return 1;
    case 'pulse': {
      const p = rate ?? 1.5;
      return (1 - Math.cos((TAU * t) / p)) / 2;
    }
    case 'blink': {
      const p = rate ?? 0.5;
      return (t % p) < p / 2 ? 1 : 0;
    }
    case 'fill': {
      // WLED Wipe: the colour fills the segment, then the background wipes over it from the same end.
      const ft = rate ?? 1.1, cyc = t % (2 * ft), edge = 1.5;
      const pos = ((cyc % ft) / ft) * len;
      const lit = clamp((pos - i) / edge + 0.5);
      return cyc < ft ? lit : 1 - lit;
    }
    case 'run': {
      const bands = look.size ?? 4.7, cps = rate ?? 1.8;
      return (Math.sin(TAU * ((i * bands) / len - t * cps)) + 1) / 2;
    }
    case 'ripple': {
      // Waves spread both ways from random points and fade as they go.
      const every = 1 / (rate ?? 3), life = 1.4, speed = 18;
      let v = 0;
      for (let k = Math.max(0, Math.floor((t - life) / every)); k * every <= t; k++) {
        const age = t - k * every - hash(k, seed + 7) * every * 0.6;
        if (age < 0 || age > life) continue;
        const d = Math.abs(i - hash(k, seed) * len);
        const ring = clamp(1 - Math.abs(d - age * speed) / 3);
        v = Math.max(v, ring * (1 - age / life));
      }
      return v;
    }
    case 'burst': {
      // Starbursts: a flash at a random point and sparks flying out, slowing and fading.
      const every = 1 / (rate ?? 2.5), life = 1.1, sparks = look.size ?? 6;
      let v = 0;
      for (let k = Math.max(0, Math.floor((t - life) / every)); k * every <= t; k++) {
        const age = t - k * every;
        if (age > life) continue;
        const c = hash(k, seed) * len, fade = Math.pow(1 - age / life, 1.6);
        v = Math.max(v, clamp(1 - Math.abs(i - c) / 2) * clamp(1 - age / 0.2));
        for (let s = 0; s < sparks; s++) {
          const vel = (hash(k * 31 + s, seed + 3) * 2 - 1) * 26;
          const pos = c + vel * (age - (age * age) / (2 * life));
          v = Math.max(v, clamp(1 - Math.abs(i - pos) / 1.4) * fade);
        }
      }
      return v;
    }
    case 'dissolve': {
      // Random LEDs switch to the colour and later back, each at its own moment.
      const on = hash(i, seed) * look.dur * 0.45, off = look.dur * 0.55 + hash(i, seed + 1) * look.dur * 0.4;
      return t >= on && t < off ? 1 : 0;
    }
  }
}

/**
 * The rings at `t` seconds into their looks: `looks[i]` plays on `segs[i]`, so the board ring and the wall ring can
 * differ. A null look, or one past its end, leaves its segment on the base. Writes into `out`.
 */
export function render(looks: (Look | null)[], t: number, base: Rgb, segs: Seg[], seed: number, out: Rgb[]) {
  for (let j = 0; j < out.length; j++) out[j] = base;
  segs.forEach((seg, si) => {
    const look = looks[si];
    if (!look || t < 0 || t >= look.dur) return;
    const tt = t + (look.clock ? hash(1, seed + 11) * 4 : 0);
    const bg = look.bg ?? base, bri = look.bri ?? 1;
    let env = 1;
    if (look.fadeIn) env = Math.min(env, smooth(t / look.fadeIn));
    if (look.fadeOut) env = Math.min(env, smooth((look.dur - t) / look.fadeOut));
    const len = seg.stop - seg.start;
    for (let i = 0; i < len; i++) {
      const c = look.kind === 'rainbow' ? hsv(i / len - tt * (look.rate ?? 0.6)) : paint(look.color, i, len, tt);
      const fx = mix(bg, c, amount(look, i, len, tt, seed + si * 101)).map(v => v * bri) as Rgb;
      out[seg.rev ? seg.stop - 1 - i : seg.start + i] = mix(base, fx, env);
    }
  });
}
