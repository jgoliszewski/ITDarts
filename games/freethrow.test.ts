import { describe, expect, it } from 'vitest';
import { BASE_RULES } from '../server/effects/builtin.ts';
import { parseDart } from './darts.ts';
import type { Change } from './effects.ts';
import { changes, pickRule } from './effects.ts';
import { callerLinesFreethrow, freethrow } from './freethrow.ts';
import type { TurnEvent } from './turns.ts';
import type { X01Options } from './x01/index.ts';
import { callerLines, x01 } from './x01/index.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const end: TurnEvent = { t: 'end' };
const undo: TurnEvent = { t: 'undo' };
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];
const o = freethrow.defaults;
const lim = (visits: 10 | 20 | 30) => ({ ...o, visits });
const view = (log: TurnEvent[], opts = o) => freethrow.view(log, 1, opts);

describe('free throw scoring', () => {
  it('sums the visit on the hero, with the visit number under a limit', () => {
    const v = view([d('T20'), d('S5')], lim(20));
    expect(v.hero).toMatchObject({ big: '65', caption: 'This visit', note: 'Visit 1 of 20' });
    expect(view([d('T20')]).hero.note).toBe('');
    expect(view([...visit('S1', 'S1', 'S1'), d('S2')], lim(20)).hero.note).toBe('Visit 2 of 20');
  });

  it('shows the finished visit until Takeout, then an empty one', () => {
    expect(view([d('T20'), d('T20'), d('T20')]).hero.big).toBe('180');
    expect(view([d('T20'), d('T20'), d('T20'), next]).hero.big).toBe('0');
  });

  it('counts a miss as a dart that does not colour as a miss', () => {
    const v = view([d('T20'), d('Miss')]);
    expect(v.visit.good).toEqual([true, true]);
  });

  it('keeps average of 3 darts, darts, highest visit and 60+/80+/100+', () => {
    const log = [...visit('T20', 'T20', 'T20'), ...visit('S20', 'S20', 'S20'), ...visit('T20', 'S20', 'S20'), ...visit('S1', 'S1', 'S1')];
    const v = view(log);
    // 180, 60, 100, 3: 343 points in 12 darts
    expect(v.stats[0]).toEqual({ darts: 12, points: 343, visits: 4, best: 180, v60: 3, v80: 2, v100: 2 });
    expect(v.rows[0]).toEqual({ value: '85.8', meta: '12 darts', out: false });
  });

  it('counts 60+, 80+ and 100+ from the exact total', () => {
    const at = (...totals: string[][]) => view(totals.flatMap(t => visit(...t))).stats[0];
    expect(at(['T20', 'Miss', 'Miss'], ['T20', 'S20', 'Miss'])).toMatchObject({ v60: 2, v80: 1, v100: 0 });
    expect(at(['S20', 'S20', 'S19'], ['T20', 'S19', 'Miss'], ['T20', 'S20', 'S20'], ['T20', 'T13', 'Miss'])).toMatchObject({ v60: 3, v80: 2, v100: 1 });
  });

  it('closes a short visit with misses and counts them as darts', () => {
    const v = view([d('S20'), next]);
    expect(v.stats[0]).toMatchObject({ darts: 3, points: 20, visits: 1, v60: 0 });
  });

  it('leaves out an open visit from visits and highest, but counts its darts', () => {
    const v = view([d('T20'), d('T20')]);
    expect(v.stats[0]).toMatchObject({ darts: 2, points: 120, visits: 0, best: 0, v60: 0 });
  });

  it('lets a fix change the sum', () => {
    expect(view([d('S20'), d('S20'), d('S20'), { t: 'fix', index: 0, dart: parseDart('T20')! }]).hero.big).toBe('100');
  });

  it('shows no average before any dart', () => {
    expect(view([]).rows[0]).toEqual({ value: '–', meta: '0 darts', out: false });
  });
});

describe('free throw end', () => {
  const full = (n: number) => Array.from({ length: n }, () => visit('S1', 'S1', 'S1')).flat();

  it('plays on without a limit', () => {
    expect(view(full(40)).phase).toBe('throwing');
  });

  it('ends after the last visit of the limit, not before, with nobody winning', () => {
    expect(view(full(9), lim(10)).phase).toBe('throwing');
    const nine = [...full(9), d('S1'), d('S1')];
    expect(view(nine, lim(10)).phase).toBe('throwing');
    const v = view([...nine, d('S1')], lim(10));
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([]);
    expect(v.result).toBe('10 visits · average 3.0');
    expect(freethrow.happenings([...nine, d('S1')], 1, lim(10)).some(h => h.fact.kind === 'matchWon')).toBe(false);
  });

  it('counts a visit closed early toward the limit', () => {
    expect(view([...full(9), d('S1'), next], lim(10)).phase).toBe('matchWon');
  });

  it('takes no more darts after the limit', () => {
    const v = view([...full(10), d('T20')], lim(10));
    expect(v.stats[0].darts).toBe(30);
  });

  it('undo reopens the last visit of the limit', () => {
    const v = view([...full(10), undo], lim(10));
    expect(v.phase).toBe('throwing');
    expect(v.visit.darts).toHaveLength(2);
  });

  it('ends on End match with Save without a winner or Match won, and undo takes it back', () => {
    const log = [...visit('T20', 'T20', 'T20'), end];
    const v = view(log);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([]);
    expect(freethrow.happenings(log, 1, o).some(h => h.fact.kind === 'matchWon')).toBe(false);
    expect(view([...log, undo]).phase).toBe('throwing');
  });
});

describe('free throw module', () => {
  it('is solo practice with a Visits option', () => {
    expect(freethrow.id).toBe('freethrow');
    expect(freethrow.name).toBe('Free throw');
    expect(freethrow.group).toBe('practice');
    expect(freethrow.minPlayers).toBe(1);
    expect(freethrow.maxPlayers).toBe(1);
    expect(freethrow.defaults.visits).toBe(0);
  });

  it('keeps only valid Visits choices', () => {
    expect(freethrow.normalizeOptions({ visits: 20 }).visits).toBe(20);
    expect(freethrow.normalizeOptions({ visits: 7 }).visits).toBe(0);
    expect(freethrow.normalizeOptions(null).visits).toBe(0);
  });

  it('describes the limit', () => {
    expect(freethrow.describe(o, 1)).toBe('Free throw');
    expect(freethrow.describe(lim(10), 1)).toBe('Free throw · 10 visits');
  });

  it('compacts the visits and has no winner', () => {
    const legs = freethrow.compact(visit('S20', 'S5', 'S1'), 1, o);
    expect(legs).toHaveLength(1);
    expect(legs[0].winner).toBeNull();
    expect(legs[0].visits[0].dartsCount).toBe(3);
  });
});

// The visit fact must be the one X01 reports for the same visit, so every rule of the visits fires the same.
describe('free throw facts', () => {
  const X01_OPTS: X01Options = { startScore: 501, checkIn: 'straight', checkOut: 'double', matchMode: { kind: 'legs', firstTo: 1 }, bullOff: 'off' };
  const visitFact = (hs: { slot: string; fact: { kind: string } }[]) => hs.filter(h => h.fact.kind === 'visit');
  const cases: [string, string[], boolean][] = [
    ['180', ['T20', 'T20', 'T20'], false],
    ['140', ['T20', 'T20', 'S20'], false],
    ['26', ['S1', 'S5', 'S20'], false],
    ['0', ['Miss', 'Miss', 'Miss'], false],
    ['closed early', ['T20'], true],
  ];

  for (const [name, darts, close] of cases) {
    const log = [...darts.map(d), ...(close ? [next] : [])];
    it(`reports the same visit as X01 for ${name}, in the same slot`, () => {
      const a = visitFact(freethrow.happenings(log, 1, o));
      const b = visitFact(x01.happenings(log, 1, X01_OPTS));
      expect(a).toHaveLength(1);
      expect(a).toEqual(b);
    });

    it(`picks the same base rule as X01 for ${name}`, () => {
      const rules = BASE_RULES.map(r => ({ ...r, enabled: true }));
      const fired = (game: { happenings: (e: TurnEvent[], p: number, o: never) => never[] }, opts: unknown): Change[] =>
        changes(game.happenings(log.slice(0, -1), 1, opts as never), game.happenings(log, 1, opts as never), 'other');
      const ft = pickRule(rules, fired(freethrow as never, o));
      const xx = pickRule(rules, fired(x01 as never, X01_OPTS));
      expect(ft?.id).toBe(xx?.id);
    });
  }

  it('picks 180, Ton 40, Bed and breakfast and No score as in X01', () => {
    const rules = BASE_RULES.map(r => ({ ...r, enabled: true }));
    const id = (...s: string[]) => {
      const log = s.map(d);
      return pickRule(rules, changes(freethrow.happenings(log.slice(0, -1), 1, o), freethrow.happenings(log, 1, o), 'other').filter(c => c.fact.kind === 'visit'))?.id;
    };
    expect(id('T20', 'T20', 'T20')).toBe('b-180');
    expect(id('T20', 'T20', 'S20')).toBe('b-ton-40');
    expect(id('S1', 'S5', 'S20')).toBe('b-bed-and-breakfast');
    expect(id('Miss', 'Miss', 'Miss')).toBe('b-no-score');
  });

  it('reports each thrown dart and the start, never a match won', () => {
    const hs = freethrow.happenings([d('T20'), d('Bull')], 1, o);
    expect(hs.map(h => h.fact.kind)).toEqual(['legStart', 'dart', 'dart']);
  });

  it('fires nothing for the misses a short visit is filled with', () => {
    const hs = freethrow.happenings([d('S1'), next], 1, o);
    expect(hs.filter(h => h.fact.kind === 'dart')).toHaveLength(1);
  });
});

describe('free throw caller', () => {
  const fired = (log: TurnEvent[]) => changes(freethrow.happenings(log.slice(0, -1), 1, o), freethrow.happenings(log, 1, o), 'other');

  it('says game on at the start', () => {
    expect(callerLinesFreethrow(changes([], freethrow.happenings([], 1, o), 'other'))).toEqual(['gameon']);
    // Later events do not say it again.
    expect(callerLinesFreethrow(fired([d('S1')]))).toEqual([]);
  });

  it('calls the visit total as X01 does, and no score as busted', () => {
    expect(callerLinesFreethrow(fired([d('T20'), d('T20'), d('T20')]))).toEqual(['180']);
    expect(callerLinesFreethrow(fired([d('S1'), d('S5'), d('S20')]))).toEqual(['26']);
    expect(callerLinesFreethrow(fired([d('Miss'), d('Miss'), d('Miss')]))).toEqual(['busted']);
  });

  it('says the same as the X01 caller for a plain visit', () => {
    const log = [d('T20'), d('S19'), d('S3')];
    const x = x01.happenings(log, 1, { startScore: 501, checkIn: 'straight', checkOut: 'double', matchMode: { kind: 'legs', firstTo: 1 }, bullOff: 'off' });
    const cs = changes(x01.happenings(log.slice(0, -1), 1, { startScore: 501, checkIn: 'straight', checkOut: 'double', matchMode: { kind: 'legs', firstTo: 1 }, bullOff: 'off' }), x, 'other');
    expect(callerLines(cs, { phase: 'matchWon' } as never, false)).toEqual(callerLinesFreethrow(fired(log)));
  });

  it('says nothing while the visit is open', () => {
    expect(callerLinesFreethrow(fired([d('T20')]))).toEqual([]);
  });
});
