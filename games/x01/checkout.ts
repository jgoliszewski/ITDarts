import type { Dart } from '../darts.ts';
import { BOARD_ORDER, label, parseDart, value } from '../darts.ts';
import type { CheckOut } from './rules.ts';
import { finishesLeg, lowestFinish } from './rules.ts';

// Double-out checkouts follow the PDC checkout chart. Everything the chart doesn't cover (fewer darts than its route,
// 40 or less, setup darts when no checkout is on, single and master out) comes from an optimal policy:
// each aim minimises the expected darts still needed to finish the leg, given where darts land when they miss
// (Kohler 1982; Haugh & Wang 2022 solve darts the same way). A bust sends the score back.

/** PDC checkout chart, double out, 41–170 (news.williamhill.com/darts/checkout-table). */
const PDC: Record<number, Dart[]> = Object.fromEntries(Object.entries({
  170: 'T20 T20 Bull', 167: 'T20 T19 Bull', 164: 'T20 T18 Bull', 161: 'T20 T17 Bull', 160: 'T20 T20 D20',
  158: 'T20 T20 D19', 157: 'T20 T19 D20', 156: 'T20 T20 D18', 155: 'T20 T19 D19', 154: 'T20 T18 D20',
  153: 'T20 T19 D18', 152: 'T20 T20 D16', 151: 'T20 T17 D20', 150: 'T20 T18 D18', 149: 'T20 T19 D16',
  148: 'T20 T20 D14', 147: 'T20 T17 D18', 146: 'T20 T18 D16', 145: 'T20 T15 D20', 144: 'T20 T20 D12',
  143: 'T20 T17 D16', 142: 'T20 T14 D20', 141: 'T20 T19 D12', 140: 'T20 T20 D10', 139: 'T19 T14 D20',
  138: 'T20 T18 D12', 137: 'T20 T19 D10', 136: 'T20 T20 D8', 135: 'Bull T15 D20', 134: 'T20 T14 D16',
  133: 'T20 T19 D8', 132: 'Bull Bull D16', 131: 'T20 T13 D16', 130: 'T20 T20 D5', 129: 'T19 T16 D12',
  128: 'T18 T14 D16', 127: 'T20 T17 D8', 126: 'T19 T19 D6', 125: 'Bull T17 D12', 124: 'T20 S14 Bull',
  123: 'T19 S16 Bull', 122: 'T18 T18 D7', 121: 'T20 S11 Bull', 120: 'T20 S20 D20', 119: 'T19 S12 Bull',
  118: 'T20 S18 D20', 117: 'T20 S17 D20', 116: 'T19 S19 D20', 115: 'T19 S18 D20', 114: 'T20 S14 D20',
  113: 'T19 S16 D20', 112: 'T20 S12 D20', 111: 'T20 S11 D20', 110: 'T20 S10 D20', 109: 'T19 S12 D20',
  108: 'T19 S19 D16', 107: 'T20 S15 D16', 106: 'T20 S6 D20', 105: 'T20 S5 D20', 104: 'T18 S10 D20',
  103: 'T20 S11 D16', 102: 'T20 S10 D16', 101: 'T20 S9 D16', 100: 'T20 D20', 99: 'T19 S10 D16', 98: 'T20 D19',
  97: 'T19 D20', 96: 'T20 D18', 95: 'T19 D19', 94: 'T18 D20', 93: 'T19 D18', 92: 'T20 D16', 91: 'T17 D20',
  90: 'T20 D15', 89: 'T19 D16', 88: 'T20 D14', 87: 'T17 D18', 86: 'T18 D16', 85: 'T15 D20', 84: 'T20 D12',
  83: 'T17 D16', 82: 'Bull D16', 81: 'T19 D12', 80: 'T20 D10', 79: 'T19 D11', 78: 'T18 D12', 77: 'T19 D10',
  76: 'T20 D8', 75: 'T17 D12', 74: 'T14 D16', 73: 'T19 D8', 72: 'T16 D12', 71: 'T13 D16', 70: 'T10 D20',
  69: 'T19 D6', 68: 'T20 D4', 67: 'T17 D8', 66: 'T10 D18', 65: '25 D20', 64: 'T16 D8', 63: 'T9 D18', 62: 'T10 D16',
  61: '25 D18', 60: 'S20 D20', 59: 'S19 D20', 58: 'S18 D20', 57: 'S17 D20', 56: 'S16 D20', 55: 'S15 D20',
  54: 'S14 D20', 53: 'S13 D20', 52: 'S12 D20', 51: 'S11 D20', 50: 'S10 D20', 49: 'S9 D20', 48: 'S8 D20',
  47: 'S7 D20', 46: 'S6 D20', 45: 'S5 D20', 44: 'S4 D20', 43: 'S3 D20', 42: 'S2 D20', 41: 'S1 D20'
}).map(([n, route]) => [n, route.split(' ').map(t => parseDart(t)!)]));

const NEIGHBOURS = new Map(BOARD_ORDER.map((n, i) => [n, [BOARD_ORDER[(i + 19) % 20], BOARD_ORDER[(i + 1) % 20]]]));
const single = (n: number): Dart => ({ n, m: 1 });

// Where a good club player's dart lands for each aim: 40% in a treble or a double, 32% in the bull.
// ponytail: one fixed skill level; per-player accuracy from stats if hints feel off for strong or weak players.
const HIT = 0.4;
function spread(aim: Dart): [Dart, number][] {
  const m = 1 - HIT;
  if (aim.n === 25) {
    const [hit, inner] = aim.m === 2 ? [0.8 * HIT, single(25)] : [0.5, { n: 25, m: 2 } as Dart];
    const rest = 1 - hit;
    return [[aim, hit], [inner, aim.m === 2 ? rest * 0.45 : 0.15], ...BOARD_ORDER.map(n => [single(n), (aim.m === 2 ? rest * 0.55 : 0.35) / 20] as [Dart, number])];
  }
  const [l, r] = NEIGHBOURS.get(aim.n)!;
  if (aim.m === 3) return [[aim, HIT], [single(aim.n), m * 0.75], [single(l), m * 0.1], [single(r), m * 0.1], [{ n: l, m: 3 }, m * 0.025], [{ n: r, m: 3 }, m * 0.025]];
  if (aim.m === 2) return [[aim, HIT], [{ n: 0, m: 1 }, m * 0.4], [single(aim.n), m * 0.4], [{ n: l, m: 2 }, m * 0.07], [{ n: r, m: 2 }, m * 0.07], [single(l), m * 0.03], [single(r), m * 0.03]];
  return [[aim, 0.9], [single(l), 0.04], [single(r), 0.04], [{ n: aim.n, m: 3 }, 0.01], [{ n: aim.n, m: 2 }, 0.01]];
}

// Ties go to the first aim, so the usual targets come first.
const BY_SIZE = Array.from({ length: 20 }, (_, i) => 20 - i);
const AIMS: Dart[] = [
  ...BY_SIZE.map(n => ({ n, m: 3 as const })),
  ...[20, 16, 18, 12, 10, 8, 19, 17, 14, 15, 13, 11, 9, 6, 4, 7, 5, 3, 2, 1].map(n => ({ n, m: 2 as const })),
  { n: 25, m: 2 },
  { n: 25, m: 1 },
  ...BY_SIZE.map(n => ({ n, m: 1 as const })),
];
const SPREADS = AIMS.map(spread);

// A visit can bust only when it starts at 181 or less: the last dart needs 61 or less left after at most 120 scored.
// Mid-visit states of higher visits don't depend on where the visit started.
const BUST_REACH = 181;

interface Table {
  top: number;
  /** Expected darts to finish from the start of a visit. */
  fresh: number[];
  /** Mid-visit expected darts when the visit can't bust, per darts left (1, 2). */
  open: number[][];
  /** Best aim (index into AIMS) by darts left, remaining and visit start; start 0 when the visit can't bust. */
  aim: Map<number, number>;
}

const key = (r: number, k: number, start: number) => (start * 8192 + r) * 4 + k;
const tables = new Map<CheckOut, Table>();

function table(rule: CheckOut, upTo: number): Table {
  let t = tables.get(rule);
  // Built from the lowest finishable score up: 1 with single out, 2 otherwise.
  if (!t) tables.set(rule, (t = { top: lowestFinish(rule) - 1, fresh: [], open: [[], [], []], aim: new Map() }));
  if (upTo <= t.top) return t;
  const low = lowestFinish(rule);
  // Per aim: points and whether that landing finishes, flattened for speed.
  const landings = SPREADS.map(sp => sp.map(([d, p]) => ({ v: value(d), out: finishesLeg(d, rule), p })));
  // Advice never aims at a bust: the aimed dart, if it hits, must leave a finishable score or finish. With a bust
  // allowed, going back to a nicer start could look best (3 left from 4: T19 to bust back to D2), and `hint`, which
  // walks the aims as if they hit, stepped past the bust into a state with no aim and crashed.
  const aimed = AIMS.map(d => ({ v: value(d), out: finishesLeg(d, rule) }));
  const busts = (i: number, rr: number) => {
    const left = rr - aimed[i].v;
    return left === 0 ? !aimed[i].out : left < low;
  };

  // Expected darts are kept as a + b·x, where x is the (unknown) value of a fresh visit at the start score.
  const A = [0, 1, 2, 3].map(() => new Float64Array(upTo + 1));
  const B = [0, 1, 2, 3].map(() => new Float64Array(upTo + 1));
  const AIM = [0, 1, 2, 3].map(() => new Int16Array(upTo + 1));

  for (let r = t.top + 1; r <= upTo; r++) {
    const bustable = r <= BUST_REACH;
    // One sweep of the visit starting at r for a guess of x; returns the next guess.
    const sweep = (x: number) => {
      for (let k = 1; k <= 3; k++) {
        const lowest = k === 3 || !bustable ? r : Math.max(low, r - 60 * (3 - k));
        for (let rr = lowest; rr <= r; rr++) {
          let best = Infinity;
          for (let i = 0; i < landings.length; i++) {
            if (busts(i, rr)) continue;
            let a = 1, b = 0;
            for (const { v, out, p } of landings[i]) {
              const left = rr - v;
              if (left === 0 && out) continue;
              if (left < low) b += p; // bust: the next visit starts at r again
              else if (k === 1) left === r ? (b += p) : (a += p * t.fresh[left]);
              else if (left === r || bustable) {
                a += p * A[k - 1][left];
                b += p * B[k - 1][left];
              } else a += p * t.open[k - 1][left];
            }
            const e = a + b * x;
            if (e < best - 1e-12) {
              best = e;
              A[k][rr] = a;
              B[k][rr] = b;
              AIM[k][rr] = i;
            }
          }
        }
      }
      return A[3][r] / (1 - B[3][r]);
    };
    // Policy iteration: x is exact once the aims stop changing, usually after a few sweeps.
    let x = t.fresh[r - 1] ?? 10;
    for (let i = 0; i < 50; i++) {
      const nx = sweep(x);
      if (Math.abs(nx - x) < 1e-9) break;
      x = nx;
    }
    t.fresh[r] = x;
    for (let k = 1; k <= 3; k++) {
      const lowest = k === 3 || !bustable ? r : Math.max(low, r - 60 * (3 - k));
      for (let rr = lowest; rr <= r; rr++) t.aim.set(key(rr, k, bustable || rr === r ? r : 0), AIM[k][rr]);
    }
    // Mid-visit states of visits that can't bust: over 61 with one dart left, over 121 with two.
    for (let k = 1; k <= 2; k++) {
      if (r <= BUST_REACH - 60 * (3 - k)) continue;
      let best = Infinity;
      for (let i = 0; i < landings.length; i++) {
        let e = 1;
        for (const { v, out, p } of landings[i]) {
          const left = r - v;
          if (left === 0 && out) continue;
          e += p * (k === 1 ? t.fresh[left] : t.open[1][left]);
        }
        if (e < best - 1e-12) {
          best = e;
          t.aim.set(key(r, k, 0), i);
        }
      }
      t.open[k][r] = best;
    }
  }
  t.top = upTo;
  return t;
}

export interface Hint {
  /** Darts to aim at, assuming each one hits. */
  darts: Dart[];
  /** True when those darts check out; otherwise they set up the next visit. */
  finish: boolean;
}

/** Table gaps already logged. */
const gaps = new Set<string>();

const same = (a: Dart, b: Dart) => a.n === b.n && a.m === b.m;

/** Chart route for `remaining` within `dartsLeft`, carrying on the visit's planned route while its darts hit. */
function chart(remaining: number, dartsLeft: number, scored: number, thrown: Dart[]): Dart[] | null {
  const plan = PDC[remaining + scored];
  if (plan && thrown.length > 0 && thrown.length < plan.length && thrown.every((d, i) => same(d, plan[i]))) return plan.slice(thrown.length);
  const route = PDC[remaining];
  return route && route.length <= dartsLeft ? route : null;
}

/** Best darts for `remaining` with `dartsLeft` darts, after `thrown` darts scoring `scored` in this visit. */
export function hint(remaining: number, dartsLeft: number, rule: CheckOut, scored = 0, thrown: Dart[] = []): Hint | null {
  if (remaining < lowestFinish(rule) || dartsLeft < 1 || dartsLeft > 3) return null;
  const route = rule === 'double' ? chart(remaining, dartsLeft, scored, thrown) : null;
  if (route) return { darts: route, finish: true };
  const start = remaining + scored;
  const t = table(rule, start);
  const darts: Dart[] = [];
  let r = remaining;
  for (let k = dartsLeft; k >= 1; k--) {
    const i = t.aim.get(key(r, k, start <= BUST_REACH || r === start ? start : 0));
    // Safety net: the table covers every state the aims lead to; a gap gives the darts so far, not a crash,
    // and says so once in the log so it does not pass silently.
    if (i === undefined) {
      const gap = `${rule} ${r} left, ${k} darts, visit from ${start}`;
      if (!gaps.has(gap)) {
        gaps.add(gap);
        console.warn(`Checkout hint: no aim in the table for ${gap}`);
      }
      return darts.length ? { darts, finish: false } : null;
    }
    const d = AIMS[i];
    darts.push(d);
    r -= value(d);
    if (r === 0) return { darts, finish: true };
  }
  return { darts, finish: false };
}

export const formatRoute = (route: Dart[]) => route.map(label).join(' · ');

/** The hint as the screens show it: a checkout route, or setup darts unless it's plain scoring on T20 that leaves no finish. */
export function hintLines(remaining: number, dartsLeft: number, rule: CheckOut, scored = 0, thrown: Dart[] = []): { checkout: string | null; setup: string | null } {
  const h = hint(remaining, dartsLeft, rule, scored, thrown);
  if (!h) return { checkout: null, setup: null };
  if (h.finish) return { checkout: formatRoute(h.darts), setup: null };
  const scoring = h.darts.every(d => d.n === 20 && d.m === 3) && remaining - 60 * h.darts.length > 170;
  return { checkout: null, setup: scoring ? null : formatRoute(h.darts) };
}
