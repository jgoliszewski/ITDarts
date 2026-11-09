import { describe, expect, it } from 'vitest';
import { changes } from './effects.ts';
import { label, parseDart } from './darts.ts';
import type { CheckoutRow, RcOptions } from './randomco.ts';
import { callerLinesRc, canCheckOut, numbersIn, randomCheckouts as rc } from './randomco.ts';
import type { TurnEvent } from './turns.ts';
import { hint } from './x01/checkout.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const undo: TurnEvent = { t: 'undo' };
const end: TurnEvent = { t: 'end' };
const seed = (n: number): TurnEvent => ({ t: 'seed', seed: n });
const o = (x: Partial<RcOptions> = {}): RcOptions => rc.normalizeOptions({ ...rc.defaults, ...x });
/** The darts that check out n, assuming each one hits. */
const out = (n: number, rule: RcOptions['checkOut'] = 'double') => hint(n, 3, rule)!.darts.map(x => d(label(x)));

describe('random checkouts: numbers', () => {
  it('knows which numbers three darts can check out', () => {
    for (const n of [159, 162, 163, 165, 166, 168, 169]) expect(canCheckOut(n, 'double')).toBe(false);
    for (const n of [2, 40, 50, 99, 160, 161, 164, 167, 170]) expect(canCheckOut(n, 'double')).toBe(true);
    expect(canCheckOut(1, 'double')).toBe(false);
    expect(canCheckOut(1, 'single')).toBe(true);
    expect(canCheckOut(180, 'single')).toBe(true);
    expect(canCheckOut(179, 'single')).toBe(false);
    expect(canCheckOut(1, 'master')).toBe(false);
    expect(canCheckOut(180, 'master')).toBe(true);
  });

  it('never draws a number nobody can check out, and stays in the range', () => {
    const opts = o({ min: 150, max: 170 });
    const pool = numbersIn(opts);
    expect(pool).not.toContain(169);
    const seen = new Set<number>();
    for (let s = 0; s < 300; s++) {
      const n = rc.view([seed(s)], 1, opts).number;
      expect(pool).toContain(n);
      seen.add(n);
    }
    expect(seen.size).toBe(pool.length); // every allowed number turns up
  });

  it('draws the same number from the same seed', () => {
    expect(rc.view([seed(7)], 1, o({ min: 2, max: 170 })).number).toBe(rc.view([seed(7)], 1, o({ min: 2, max: 170 })).number);
    const numbers = new Set(Array.from({ length: 20 }, (_, s) => rc.view([seed(s)], 1, o({ min: 2, max: 170 })).number));
    expect(numbers.size).toBeGreaterThan(5);
  });
});

describe('random checkouts: options', () => {
  it('keeps the range within the check-out rule', () => {
    expect(o({ min: 1, max: 999 })).toMatchObject({ min: 2, max: 170 });
    expect(o({ checkOut: 'single', min: 0, max: 999 })).toMatchObject({ min: 1, max: 180 });
    expect(o({ checkOut: 'master', min: 1, max: 180 })).toMatchObject({ min: 1, max: 180 });
    expect(o({ min: 90, max: 50 })).toMatchObject({ min: 90, max: 90 });
    expect(o({ min: 'x' as unknown as number, max: 2.5 })).toMatchObject({ min: 41, max: 80 });
  });

  it('widens up when nothing below the range can be checked out', () => {
    expect(o({ checkOut: 'master', min: 1, max: 1 })).toMatchObject({ min: 1, max: 2 });
    expect(numbersIn(o({ checkOut: 'master', min: 1, max: 1 }))).toEqual([2]);
    expect(o({ checkOut: 'single', min: 1, max: 1 })).toMatchObject({ min: 1, max: 1 });
  });

  it('widens a range nobody can check out down to a number that works', () => {
    expect(o({ min: 169, max: 169 })).toMatchObject({ min: 167, max: 169 });
    expect(numbersIn(o({ min: 169, max: 169 }))).toEqual([167]);
  });

  it('names the range in the header', () => {
    expect(rc.describe(o(), 1)).toBe('Random Checkouts · 41–80 · Double out');
    expect(rc.describe(o({ min: 2, max: 170, coop: true }), 2)).toBe('Random Checkouts · Any · Double out · Co-op');
    expect(rc.describe(o({ checkOut: 'master', min: 1, max: 180 }), 1)).toBe('Random Checkouts · Any · Master out');
  });
});

describe('random checkouts: play', () => {
  const opts = o({ min: 2, max: 170 });
  const first = rc.view([seed(1)], 2, opts).number;

  it('scores down from the number and busts back to the start of the visit', () => {
    let v = rc.view([seed(1), d('S1')], 1, o({ min: 40, max: 40 }));
    expect([v.number, v.remaining]).toEqual([40, 39]);
    v = rc.view([seed(1), d('S1'), d('S20'), d('S20')], 1, o({ min: 40, max: 40 }));
    expect(v.visit.verdict).toEqual({ text: 'Bust', tone: 'bad' });
    expect(v.remaining).toBe(40);
    expect(v.points).toEqual([0]);
  });

  it('gives a point for a checkout and a new number for everyone', () => {
    const log = [seed(1), ...out(first)];
    const v = rc.view(log, 2, opts);
    expect(v.visit.verdict).toEqual({ text: 'Checkout', tone: 'good' });
    expect(v.points).toEqual([1, 0]);
    expect(v.remaining).toBe(0); // the screen keeps the checkout until the takeout
    const after = rc.view([...log, next], 2, opts);
    expect(after.number).not.toBe(first);
    expect(after.left).toEqual([after.number, after.number]);
    expect(after.current).toBe(0); // the closer throws first at the new number
  });

  it('undo of the checkout brings the number back, and checking out again draws the same next one', () => {
    const log = [seed(1), ...out(first), next];
    const second = rc.view(log, 1, opts).number;
    const undone = rc.view([...log, undo, undo], 1, opts);
    expect(undone.number).toBe(first);
    expect(undone.points).toEqual([0]);
    expect(rc.view([...log, undo, undo, ...out(first).slice(-1), next], 1, opts).number).toBe(second);
  });

  it('gives each rival their own score, and the first to check out takes the point', () => {
    const forty = o({ min: 40, max: 40 });
    const v = rc.view([seed(1), d('S20'), next, d('S10'), next, d('D10')], 2, forty);
    expect(v.points).toEqual([1, 0]);
    expect(rc.view([seed(1), d('S20'), next, d('S10'), next], 2, forty).left).toEqual([20, 30]);
    const after = rc.view([seed(1), d('S20'), next, d('S10'), next, d('D10'), next], 2, forty);
    expect(after.left).toEqual([40, 40]);
    expect(after.current).toBe(0);
    // A visit without a checkout passes the turn as usual.
    expect(rc.view([seed(1), d('S20'), next, d('S10'), next, d('D10'), next, d('S1'), next], 2, forty).current).toBe(1);
  });

  it('shares one score in co-op and the point goes to whoever checks out', () => {
    const forty = o({ min: 40, max: 40, coop: true });
    const v = rc.view([seed(1), d('S20'), next, d('D10'), next], 2, forty);
    expect(v.points).toEqual([0, 1]);
    expect(v.current).toBe(0);
    expect(rc.view([seed(1), d('S20'), next], 2, forty).left).toEqual([20, 20]);
    expect(v.rows.map(r => r.meta)).toEqual(['0 checkouts', '1 checkout']);
  });

  it('shows the checkout hint only with Hints on', () => {
    expect(rc.view([seed(1)], 1, o({ min: 40, max: 40 })).checkout).toBe('D20');
    const off = rc.view([seed(1)], 1, o({ min: 40, max: 40, hints: false }));
    expect(off.checkout).toBeNull();
    expect(off.reach).toBe(true);
  });

  it('plays Single out: 1 left is no bust and a single checks out', () => {
    const single = o({ checkOut: 'single', min: 40, max: 40 });
    const v = rc.view([seed(1), d('S20'), d('S19')], 1, single);
    expect([v.remaining, v.visit.verdict]).toEqual([1, null]);
    const out1 = rc.view([seed(1), d('S20'), d('S19'), d('S1')], 1, single);
    expect([out1.points, out1.visit.verdict?.text]).toEqual([[1], 'Checkout']);
    expect(rc.view([seed(1), d('S20'), d('S19')], 1, o({ min: 40, max: 40 })).visit.verdict?.text).toBe('Bust');
  });

  it('plays Master out: a treble checks out, 1 left busts', () => {
    const master = o({ checkOut: 'master', min: 60, max: 60 });
    expect(rc.view([seed(1), d('T20')], 1, master).points).toEqual([1]);
    expect(rc.view([seed(1), d('S20'), d('S20'), d('S20')], 1, master).points).toEqual([0]);
    const bust = rc.view([seed(1), d('S20'), d('S20'), d('S19')], 1, master);
    expect([bust.visit.verdict?.text, bust.remaining]).toEqual(['Bust', 60]);
  });

  it('a fix turns a dart into a checkout or a bust', () => {
    const forty = o({ min: 40, max: 40 });
    const fixed = rc.view([seed(1), d('S20'), d('S10'), { t: 'fix', index: 1, dart: { n: 10, m: 2 } }], 1, forty);
    expect([fixed.points, fixed.visit.verdict?.text]).toEqual([[1], 'Checkout']);
    const busted = rc.view([seed(1), d('S20'), d('D10'), { t: 'fix', index: 1, dart: { n: 10, m: 3 } }], 1, forty);
    expect([busted.points, busted.visit.verdict?.text, busted.remaining]).toEqual([[0], 'Bust', 40]);
  });

  it('counts a co-op checkout in the first visit only in the first team visit at the number', () => {
    const coop = o({ min: 40, max: 40, coop: true });
    const v = rc.view([seed(1), d('S20'), next, d('D10'), next, d('D20'), next], 2, coop);
    expect(v.stats).toEqual([
      { checkouts: 1, checkoutDarts: 1, firstVisit: 1 },
      { checkouts: 1, checkoutDarts: 1, firstVisit: 0 },
    ]);
  });

  it('keeps per-player checkout stats', () => {
    const forty = o({ min: 40, max: 40 });
    // Player 0 checks out in the first visit and throws first again; player 1 needs two visits for the next 40.
    const v = rc.view([seed(1), d('D20'), next, d('S1'), next, d('S20'), next, d('S1'), next, d('D10'), next], 2, forty);
    expect(v.stats).toEqual([
      { checkouts: 1, checkoutDarts: 1, firstVisit: 1 },
      { checkouts: 1, checkoutDarts: 4, firstVisit: 0 },
    ]);
  });
});

describe('random checkouts: end match', () => {
  const forty = o({ min: 40, max: 40 });
  // One checkout each: player 0 closes, throws again, then player 1 closes.
  const two = [seed(1), d('D20'), next, d('S1'), next, d('D20'), next];
  const twoCoop = [seed(1), d('D20'), next, d('D20'), next];
  const coopForty = o({ min: 40, max: 40, coop: true });

  it('ends as won by the most points, and equal points share the win', () => {
    const v = rc.view([...two, d('D20'), next, end], 2, forty);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([1]);
    expect(v.result).toBe('Won with 2 checkouts');
    const tie = rc.view([...two, end], 2, forty);
    expect(tie.winners).toEqual([0, 1]);
    expect(tie.result).toBe('Shared win · 1 checkout');
  });

  it('has no winner without a checkout, and none in co-op', () => {
    expect(rc.view([seed(1), d('S1'), next, end], 2, forty).winners).toEqual([]);
    const coop = rc.view([...twoCoop, end], 2, coopForty);
    expect(coop.winners).toEqual([]);
    expect(coop.result).toBe('2 checkouts together');
  });

  it('fires Game won only when someone checked out', () => {
    const won = (log: TurnEvent[], opts: RcOptions) => rc.happenings(log, 2, opts).some(h => h.fact.kind === 'matchWon');
    expect(won([seed(1), d('S1'), next, end], forty)).toBe(false);
    expect(won([...two, end], forty)).toBe(true);
    expect(won([...twoCoop, end], coopForty)).toBe(true);
    expect(won([seed(1), d('S1'), next, end], o({ min: 40, max: 40, coop: true }))).toBe(false);
  });

  it('ignores a fix and next after the end; an undo then plays on', () => {
    const s1 = d('S1');
    const after = [...two, end, { t: 'fix', index: 0, dart: { n: 20, m: 3 } } as TurnEvent, next, undo, s1];
    expect(rc.view(after, 2, forty)).toEqual(rc.view([...two, s1], 2, forty));
  });

  it('fires Game won, and an undo plays on', () => {
    const fx = rc.happenings([...two, end], 2, forty);
    expect(fx.some(h => h.fact.kind === 'matchWon')).toBe(true);
    const back = rc.view([...two, end, undo, d('S1')], 2, forty);
    expect(back.phase).toBe('throwing');
    expect(back.remaining).toBe(39);
  });

  it('ignores darts after the end', () => {
    expect(rc.view([...two, end, d('S1')], 2, forty)).toEqual(rc.view([...two, end], 2, forty));
  });
});

describe('random checkouts: history', () => {
  const forty = o({ min: 40, max: 40 });
  const row = (x: Partial<CheckoutRow>): CheckoutRow => ({ number: 40, closer: 0, darts: 1, visits: 1, busts: 0, finish: '', firstVisit: true, ...x });

  it('lists each number with who closed it, darts, visits, busts and the closing visit', () => {
    const log = [
      seed(1), d('S20'), d('S20'), next, d('D20'), next, // 0 busts, 1 checks out in his first visit
      d('S1'), next, d('S5'), next, d('S5'), next, d('S15'), d('D10'), next, // 1 throws first; 0 closes in his second visit
    ];
    expect(rc.view(log, 2, forty).history).toEqual([
      row({ closer: 1, darts: 1, visits: 2, busts: 1, finish: 'D20' }),
      row({ closer: 0, darts: 5, visits: 4, finish: 'S15 D10', firstVisit: false }),
    ]);
  });

  it('keeps the open number as “not closed” only once a visit was played at it', () => {
    const one = [seed(1), d('D20'), next];
    expect(rc.view(one, 1, forty).history).toEqual([row({ finish: 'D20' })]);
    expect(rc.view([...one, d('S1')], 1, forty).history).toHaveLength(1); // the open visit does not count yet
    expect(rc.view([...one, d('S1'), next, d('S20'), d('S20'), next, end], 1, forty).history.at(-1))
      .toEqual(row({ closer: null, darts: 0, visits: 2, busts: 1, firstVisit: false }));
    expect(rc.view([seed(1), end], 1, forty).history).toEqual([]);
  });

  it('counts the whole team in co-op, and the first visit is the team’s first', () => {
    const coop = o({ min: 40, max: 40, coop: true });
    const h = rc.view([seed(1), d('S20'), next, d('D10'), next, d('S1'), next], 2, coop).history;
    expect(h).toEqual([
      row({ closer: 1, visits: 2, firstVisit: false, finish: 'D10' }),
      row({ closer: null, darts: 0, visits: 1, firstVisit: false }),
    ]);
    expect(rc.view([seed(1), d('D20'), next], 2, coop).history[0].firstVisit).toBe(true);
  });

  it('drops the row when the checkout is undone', () => {
    const log = [seed(1), d('D20')];
    expect(rc.view(log, 1, forty).history).toEqual([row({ finish: 'D20' })]);
    expect(rc.view([...log, undo], 1, forty).history).toEqual([]);
    expect(rc.view([...log, next, undo, undo], 1, forty).history).toEqual([]);
  });

  it('follows a fix of the closing dart', () => {
    const h = rc.view([seed(1), d('S20'), d('S10'), { t: 'fix', index: 1, dart: { n: 10, m: 2 } }], 1, forty).history;
    expect(h).toEqual([row({ darts: 2, finish: 'S20 D10' })]);
  });
});

describe('random checkouts: caller', () => {
  const said = (log: TurnEvent[], opts: RcOptions) => {
    const last = log.at(-1)!;
    const cs = changes(rc.happenings(log.slice(0, -1), 1, opts), rc.happenings(log, 1, opts), 'other');
    return callerLinesRc(cs, rc.view(log, 1, opts), last.t === 'next');
  };

  it('calls the visit and “you require” for a new number, without a game shot', () => {
    const forty = o({ min: 40, max: 40, hints: false });
    expect(said([seed(1), d('D20')], forty)).toEqual(['40']);
    expect(said([seed(1), d('D20'), next], forty)).toEqual(['require_40']);
    expect(said([seed(1), d('S20'), d('S10'), d('S20')], forty)).toEqual(['busted']);
  });

  it('stays quiet about a number out of reach', () => {
    const v = rc.view([seed(1), d('S1'), next], 1, o({ min: 170, max: 170 }));
    expect(v.reach).toBe(false);
    expect(said([seed(1), d('S1'), next], o({ min: 170, max: 170 }))).toEqual(['1']);
  });
});
