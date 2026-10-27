import { describe, expect, it } from 'vitest';
import { parseDart } from '../darts.ts';
import type { X01Event, X01Options } from './index.ts';
import { compact, formatRoute, hint, hintLines, replay, view, x01Stats } from './index.ts';

const opts = (o: Partial<X01Options> = {}): X01Options => ({
  startScore: 501, checkIn: 'straight', checkOut: 'double', matchMode: { kind: 'legs', firstTo: 2 }, bullOff: 'off', ...o,
});

let clock = 0;
const d = (s: string): X01Event => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: X01Event = { t: 'next', at: 0 };
const visit = (...s: string[]): X01Event[] => [...s.map(d), next];
const run = (events: X01Event[], o = opts(), players = 2) => view(replay(events, players, o), players, o);

describe('scoring', () => {
  it('subtracts darts and switches players on next', () => {
    const v = run(visit('T20', 'T20', 'T20'));
    expect(v.scores).toEqual([321, 501]);
    expect(v.current).toBe(1);
    expect(v.stats[0].lastVisits).toEqual([180]);
    expect(v.stats[0].c180).toBe(1);
  });

  it('fills missing darts with misses when the visit ends', () => {
    const raw = replay([d('S20'), next], 2, opts());
    const legs = compact(raw, 2, opts());
    expect(legs[0].visits[0].darts.map(x => x.dart.n)).toEqual([20, 0, 0]);
    expect(legs[0].visits[0].dartsCount).toBe(3);
  });

  it('busts below 2 with double out and restores the score', () => {
    const v = run([...visit('S20'), ...visit('S1'), d('S20'), d('S19')], opts({ startScore: 40 }));
    expect(v.visit.bust).toBe(true);
    expect(v.scores[0]).toBe(20);
    expect(v.visit.dartsLeft).toBe(0);
  });

  it('busts a finish on a single with double out', () => {
    const v = run([d('S20'), d('S20')], opts({ startScore: 40 }));
    expect(v.visit.bust).toBe(true);
    expect(v.scores[0]).toBe(40);
  });

  it('ignores darts after a bust', () => {
    const v = run([d('T20'), d('S5')], opts({ startScore: 50 }));
    expect(v.visit.darts).toHaveLength(1);
  });

  it('allows a single finish with single out and a treble with master out', () => {
    expect(run([d('S20'), d('S20')], opts({ startScore: 40, checkOut: 'single' })).phase).toBe('legWon');
    expect(run([d('T20')], opts({ startScore: 60, checkOut: 'master' })).phase).toBe('legWon');
    expect(run([d('S20'), d('S19')], opts({ startScore: 40, checkOut: 'master' })).visit.bust).toBe(true);
  });

  it('scores nothing before the opening double with double in', () => {
    const v = run([d('T20'), d('D10'), d('T20')], opts({ checkIn: 'double' }));
    expect(v.scores[0]).toBe(501 - 20 - 60);
  });
});

describe('legs and match', () => {
  // Player 0 wins a nine-darter; player 1 throws S1 twice.
  const leg = (_o?: X01Options) => [...visit('T20', 'T20', 'T20'), ...visit('S1'), ...visit('T20', 'T20', 'T20'), ...visit('S1'), ...visit('T20', 'T19', 'D12')];

  it('wins a leg on a double and starts the next one on next', () => {
    const o = opts();
    const won = run(leg().slice(0, -1), o);
    expect(won.phase).toBe('legWon');
    expect(won.lastLeg).toMatchObject({ winner: 0, darts: 9, avg: 167 });
    const after = run(leg(o), o);
    expect(after.phase).toBe('throwing');
    expect(after.legs).toEqual([1, 0]);
    expect(after.current).toBe(1);
    expect(after.scores).toEqual([501, 501]);
  });

  it('wins the match at first to N legs', () => {
    const o = opts({ matchMode: { kind: 'legs', firstTo: 1 } });
    const v = run(leg(o), o);
    expect(v.phase).toBe('matchWon');
    expect(v.matchWinner).toBe(0);
  });

  it('waits for nextLeg when match mode is off', () => {
    const o = opts({ matchMode: { kind: 'off' } });
    expect(run(leg(o), o).phase).toBe('legWon');
    expect(run([...leg(o), { t: 'nextLeg' }], o).phase).toBe('throwing');
  });

  it('counts sets', () => {
    const o = opts({ startScore: 40, matchMode: { kind: 'sets', firstTo: 2, legsPerSet: 2 } });
    // Leg 1: player 0 starts and wins. Leg 2: player 1 starts, player 0 wins the set.
    const events = [...visit('D20'), ...visit('S1'), ...visit('D20')];
    const v = run(events, o);
    expect(v.sets).toEqual([1, 0]);
    expect(v.legs).toEqual([0, 0]);
    expect(v.set).toBe(2);
  });
});

describe('undo and fix', () => {
  it('undoes one dart, then reopens the previous visit with its darts', () => {
    const events = [d('T20'), d('S5'), d('T20'), next];
    let v = run([...events, { t: 'undo' }]);
    expect(v.current).toBe(0);
    expect(v.visit.darts).toHaveLength(3);
    v = run([...events, { t: 'undo' }, { t: 'undo' }]);
    expect(v.visit.darts).toHaveLength(2);
    expect(v.scores[0]).toBe(501 - 65);
  });

  it('drops auto-filled misses when reopening a visit', () => {
    const v = run([d('T20'), next, { t: 'undo' }]);
    expect(v.visit.darts).toHaveLength(1);
    expect(v.visit.dartsLeft).toBe(2);
  });

  it('fixes a dart in the current visit and drops its coordinates', () => {
    const events: X01Event[] = [{ t: 'dart', dart: { n: 5, m: 1 }, coords: { x: 1, y: 2 }, at: 1 }, { t: 'fix', index: 0, dart: { n: 20, m: 3 } }];
    const v = run(events);
    expect(v.scores[0]).toBe(441);
    expect(v.visit.darts[0].coords).toBeUndefined();
  });

  it('a fix can undo a checkout', () => {
    const o = opts({ startScore: 40 });
    const v = run([d('D20'), { t: 'fix', index: 0, dart: { n: 20, m: 1 } }], o);
    expect(v.phase).toBe('throwing');
    expect(v.scores[0]).toBe(20);
  });

  it('undo from a fresh leg goes back into the winning visit', () => {
    const o = opts({ startScore: 40 });
    const v = run([d('D20'), next, { t: 'undo' }], o);
    expect(v.phase).toBe('legWon');
    expect(v.legs).toEqual([1, 0]);
    expect(run([d('D20'), next, { t: 'undo' }, { t: 'undo' }], o).phase).toBe('throwing');
  });
});

describe('bull-off', () => {
  it('waits for the starter and ignores darts until then', () => {
    const o = opts({ bullOff: 'closest' });
    expect(run([d('T20')], o).phase).toBe('bulloff');
    const v = run([d('T20'), { t: 'start', starter: 1 }, d('T20')], o);
    expect(v.current).toBe(1);
    expect(v.scores).toEqual([501, 441]);
  });
});

describe('hints', () => {
  const r = (n: number, darts = 3, scored = 0) => {
    const h = hint(n, darts, 'double', scored)!;
    return (h.finish ? '' : 'setup ') + formatRoute(h.darts);
  };
  it('suggests standard finishes', () => {
    expect(r(170)).toBe('T20 · T20 · Bull');
    expect(r(100)).toBe('T20 · D20');
    expect(r(40)).toBe('D20');
    expect(r(50)).toBe('S10 · D20');
    expect(r(50, 1)).toBe('Bull');
    expect(r(60)).toBe('S20 · D20');
    expect(r(141)).toBe('T20 · T19 · D12');
  });
  it('never sets up a double with a double', () => {
    expect(r(62)).toBe('T10 · D16');
    for (let n = 41; n <= 170; n++) {
      const h = hint(n, 3, 'double')!;
      expect(h.darts.slice(0, -1).some(x => x.m === 2 && x.n !== 25), `${n}: ${formatRoute(h.darts)}`).toBe(false);
    }
  });
  it('sets up the next visit when no checkout is on', () => {
    for (const n of [169, 168, 166, 165, 163, 162, 159]) expect(r(n)).toMatch(/^setup /);
    expect(r(100, 1)).toBe('setup T20');
    expect(r(35, 1)).toMatch(/^setup S/); // a single that leaves a double
  });
  it('shows setup darts only when they are more than plain T20s', () => {
    expect(hintLines(501, 3, 'double')).toEqual({ checkout: null, setup: null });
    expect(hintLines(169, 3, 'double').setup).toMatch(/^T20 · /);
  });
  it('updates after each dart of the visit', () => {
    const v = run([d('T20'), d('S1')], opts({ startScore: 141 }));
    expect(v.scores[0]).toBe(80);
    expect(v.checkout).toBeNull();
    expect(v.setup).not.toBeNull();
    expect(run([d('T20')], opts({ startScore: 141 })).checkout).toBe('T19 · D12');
  });
  it('follows the PDC chart and carries on its route while the darts hit', () => {
    for (const [n, route] of [[130, 'T20 · T20 · D5'], [52, 'S12 · D20'], [132, 'Bull · Bull · D16']] as const) expect(r(n)).toBe(route);
    expect(run([d('T20')], opts({ startScore: 130 })).checkout).toBe('T20 · D5'); // not the chart route for 70
    expect(run([d('S20')], opts({ startScore: 130 })).checkout).toBe('T20 · Bull'); // off the plan, 110 in two darts
    expect(run([d('T20'), d('S20')], opts({ startScore: 130 })).checkout).toBe('Bull');
  });
});

describe('history stats', () => {
  it('computes averages, until 170 and checkout %', () => {
    const o = opts();
    const opponent = visit('S1');
    const events = [
      ...visit('T20', 'T20', 'T20'), ...opponent,
      ...visit('T20', 'T20', 'T20'), ...opponent,
      ...visit('T20', 'T19', 'S12'), ...opponent,
      d('D5'), d('D1'),
    ];
    const legs = compact(replay(events, 2, o), 2, o);
    const mine = legs.flatMap((l, legId) =>
      l.visits.filter(v => v.player === 0).map(v => ({ ...v, legId, legFinished: l.winner !== null, darts: v.darts.map(x => x.dart), checkOut: o.checkOut })));
    const s = x01Stats(mine);
    expect(s.avg).toBe(Math.round((501 / 11) * 300) / 100);
    expect(s.first9).toBe(163);
    expect(s.until170).toBe(180);
    expect(s.checkoutAttempts).toBe(3); // S12 at 24, D5 at 12, D1 at 2
    expect(s.checkoutPct).toBe(33.3);
    expect(s.highestCheckout).toBe(12);
    expect(s.bestLeg).toBe(11);
    expect(s.c180).toBe(2);
    expect(s.c100).toBe(1);
  });
});
