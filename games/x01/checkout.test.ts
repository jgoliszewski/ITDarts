// Checkout hints never crash and never aim at a bust (bug: .scratch/remove-player/REVIEW.md, crash of the checkout hint).
import { describe, expect, it } from 'vitest';
import { oneTwentyOne } from '../121.ts';
import type { Dart } from '../darts.ts';
import { parseDart, value } from '../darts.ts';
import type { TurnEvent } from '../turns.ts';
import { hint } from './checkout.ts';
import type { X01Event, X01Options } from './index.ts';
import { replay, view } from './index.ts';
import type { CheckOut } from './rules.ts';
import { finishesLeg, lowestFinish } from './rules.ts';

const D = (s: string) => parseDart(s)!;
const DARTS: Dart[] = [{ n: 0, m: 1 }, ...[1, 2, 3].flatMap(m => Array.from({ length: 20 }, (_, i) => ({ n: i + 1, m }) as Dart)), D('25'), D('Bull')];

/** Walks a hint as if every dart hits; returns why it is wrong, or null. */
function wrong(h: { darts: Dart[]; finish: boolean }, remaining: number, rule: CheckOut): string | null {
  let r = remaining;
  for (const [i, d] of h.darts.entries()) {
    r -= value(d);
    if (r === 0 && finishesLeg(d, rule)) return h.finish && i === h.darts.length - 1 ? null : 'finish not last';
    if (r < lowestFinish(rule)) return `aims at a bust with ${label(h.darts)}`;
  }
  return h.finish ? 'claims a finish it does not reach' : null;
}
const label = (ds: Dart[]) => ds.map(d => `${d.m}x${d.n}`).join(' ');
/** A checkout line from the screen that really checks out `remaining` on a double. */
const checksOut = (line: string | null, remaining: number) => {
  const ds = (line ?? '').split(' · ').map(D);
  return line !== null && ds.reduce((s, d) => s + value(d), 0) === remaining && ds.at(-1)!.m === 2;
};

describe('checkout hint', () => {
  for (const rule of ['double', 'single', 'master'] as CheckOut[]) {
    it(`gives a sound hint in every reachable spot of a visit up to 170, down to the last point (${rule} out)`, () => {
      const low = lowestFinish(rule);
      const bad: string[] = [];
      for (let start = low; start <= 170; start++) {
        for (const a of [null, ...DARTS]) {
          for (const b of a ? [null, ...DARTS] : [null]) {
            const thrown = [a, b].filter((d): d is Dart => d !== null);
            const scored = thrown.reduce((s, d) => s + value(d), 0);
            // Darts already in the visit that bust or finish end it: no hint is asked for then.
            if (thrown.some((_, i) => start - thrown.slice(0, i + 1).reduce((s, d) => s + value(d), 0) < low)) continue;
            const remaining = start - scored;
            try {
              const h = hint(remaining, 3 - thrown.length, rule, scored, thrown);
              const why = h ? wrong(h, remaining, rule) : 'no hint for a finishable score';
              if (why) bad.push(`${start} after ${label(thrown)}: ${why}`);
            } catch (e) {
              bad.push(`${start} after ${label(thrown)}: ${(e as Error).message}`);
            }
          }
        }
      }
      expect(bad.slice(0, 10)).toEqual([]);
    });
  }

  it('handles the reported spots: 8 then S1, 4 then S1, 8 then S5, 8 then S3', () => {
    for (const [start, first] of [[8, 'S1'], [4, 'S1'], [8, 'S5'], [8, 'S3']] as const) {
      const d = D(first);
      const h = hint(start - value(d), 2, 'double', value(d), [d]);
      expect(h).not.toBeNull();
      expect(wrong(h!, start - value(d), 'double')).toBeNull();
    }
    expect(hint(7, 2, 'double', 1, [D('S1')])?.finish).toBe(true);
  });

  it('shows S1 at 1 point with single out', () => {
    expect(hint(1, 3, 'single')).toEqual({ darts: [D('S1')], finish: true });
    expect(hint(1, 1, 'single', 4, [D('S4')])).toEqual({ darts: [D('S1')], finish: true });
  });
});

describe('the match view with the hint that used to crash', () => {
  let clock = 0;
  it('X01 201: 7 left with two darts after S1 from 8', () => {
    const o: X01Options = { startScore: 201, checkIn: 'straight', checkOut: 'double', matchMode: { kind: 'legs', firstTo: 1 }, bullOff: 'off' };
    const d = (s: string): X01Event => ({ t: 'dart', dart: D(s), at: ++clock });
    const next: X01Event = { t: 'next', at: 0 };
    const v = view(replay([d('T20'), d('T20'), d('T20'), next, d('S13'), next, d('S1')], 1, o), 1, o);
    expect(v.scores).toEqual([7]);
    expect(checksOut(v.checkout, 7)).toBe(true);
  });

  it('121 solo: 7 left with two darts after S1 from 8', () => {
    const d = (s: string): TurnEvent => ({ t: 'dart', dart: D(s), at: ++clock });
    const next: TurnEvent = { t: 'next', at: 0 };
    const v = oneTwentyOne.view([d('S14'), d('D16'), next, d('D16'), d('D10'), d('T5'), next, d('S1')], 1, oneTwentyOne.defaults);
    expect(v.remaining).toBe(7);
    expect(checksOut(v.checkout, 7)).toBe(true);
  });
});
