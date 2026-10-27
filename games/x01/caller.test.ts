import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDart } from '../darts.ts';
import { changes } from '../effects.ts';
import type { X01Event, X01Options } from './index.ts';
import { CALLER_KEYS, callerLines, happenings, replay, view } from './index.ts';

const opts = (o: Partial<X01Options> = {}): X01Options => ({
  startScore: 501, checkIn: 'straight', checkOut: 'double', matchMode: { kind: 'legs', firstTo: 2 }, bullOff: 'off', ...o,
});

let clock = 0;
const d = (s: string): X01Event => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: X01Event = { t: 'next', at: 0 };
const fix = (index: number, s: string): X01Event => ({ t: 'fix', index, dart: parseDart(s)! });

/** What the caller says after the last event of the log, the way the hub asks. */
function said(log: X01Event[], o = opts(), players = 2): string[] {
  const last = log.at(-1)!;
  const cause = last.t === 'fix' ? 'fix' : last.t === 'undo' ? 'undo' : 'other';
  const cs = changes(happenings(replay(log.slice(0, -1), players, o), players, o), happenings(replay(log, players, o), players, o), cause);
  return callerLines(cs, view(replay(log, players, o), players, o), last.t === 'next' || last.t === 'nextLeg' || last.t === 'start');
}

/** What the caller says when the match starts (the hub's own call, with no event yet). */
function atStart(o = opts(), players = 2): string[] {
  const raw = replay([], players, o);
  return callerLines(changes([], happenings(raw, players, o), 'other'), view(raw, players, o), true);
}

describe('caller', () => {
  it('says game on when the match starts, and you require when the start score is a finish', () => {
    expect(atStart()).toEqual(['gameon']);
    expect(atStart(opts({ startScore: 170 }))).toEqual(['gameon', 'require_170']);
  });

  it('says game on after the bull-off, not before', () => {
    const o = opts({ bullOff: 'closest' });
    expect(atStart(o)).toEqual([]);
    expect(said([{ t: 'start', starter: 1 }], o)).toEqual(['gameon']);
  });

  it('calls the score after the third dart and nothing more on Next player', () => {
    expect(said([d('T20'), d('T20')])).toEqual([]);
    expect(said([d('T20'), d('T20'), d('T20')])).toEqual(['180']);
    expect(said([d('T20'), d('T20'), d('T20'), next])).toEqual([]);
  });

  it('calls a short visit on Next player, then the next player’s you require', () => {
    expect(said([d('S20'), d('S20'), next], opts({ startScore: 101 }))).toEqual(['40', 'require_101']);
  });

  it('says no score for a visit of 0 and for a bust', () => {
    expect(said([d('S0'), d('S0'), d('S0')])).toEqual(['busted']);
    const o = opts({ startScore: 40 });
    expect(said([d('T20')], o)).toEqual(['busted']);
  });

  it('says you require only when the checkout hint has a route', () => {
    // 169 is a bogey number with double out.
    expect(said([d('T20'), d('T20'), d('T20'), next], opts({ startScore: 349 }), 1)).toEqual([]);
    expect(said([d('T20'), d('T20'), d('T20'), next], opts({ startScore: 350 }), 1)).toEqual(['require_170']);
    // Double in: no route before the first double, so 100 stays silent; straight in leaves 40, a finish.
    expect(said([d('S20'), d('S20'), d('S20'), next], opts({ startScore: 100, checkIn: 'double' }), 1)).toEqual([]);
    expect(said([d('S20'), d('S20'), d('S20'), next], opts({ startScore: 100 }), 1)).toEqual(['require_40']);
  });

  it('says game shot with the leg number instead of the score, and match shot at the end', () => {
    expect(said([d('D20')], opts({ startScore: 40 }))).toEqual(['gameshot_l1_n']);
    const o = opts({ startScore: 40, matchMode: { kind: 'legs', firstTo: 2 } });
    // The next leg starts from 40 again, which is a finish.
    expect(said([d('D20'), next], o)).toEqual(['gameon', 'require_40']);
    // Player 2 starts the second leg and takes it: one leg each.
    expect(said([d('D20'), next, d('D20')], o)).toEqual(['gameshot_l2_n']);
    expect(said([d('D20'), next, d('D20')], o, 1)).toEqual(['matchshot']);
  });

  it('numbers legs within the set', () => {
    const o = opts({ startScore: 40, matchMode: { kind: 'sets', firstTo: 2, legsPerSet: 1 } });
    // One leg wins a set, so the second set's first leg is leg one again.
    expect(said([d('D20'), next, d('D20')], o, 1)).toEqual(['matchshot']);
    const o2 = opts({ startScore: 40, matchMode: { kind: 'sets', firstTo: 2, legsPerSet: 2 } });
    expect(said([d('D20'), next, d('D20'), next, d('D20')], o2, 1)).toEqual(['gameshot_l1_n']);
  });

  it('stays silent on a game shot after the twentieth leg', () => {
    const o = opts({ startScore: 40, matchMode: { kind: 'off' } });
    const legs = Array.from({ length: 20 }, (): X01Event[] => [d('D20'), { t: 'nextLeg' }]).flat();
    expect(said([...legs.slice(0, -1)], o, 1)).toEqual(['gameshot_l20_n']);
    expect(said([...legs, d('D20')], o, 1)).toEqual([]);
  });

  it('calls a fixed visit again, and says nothing on undo', () => {
    const log = [d('S20'), d('T20'), d('T20')];
    expect(said([...log, fix(0, 'T20')])).toEqual(['180']);
    expect(said([...log, { t: 'undo' }])).toEqual([]);
  });

  it('has a recording for every line in every voice', () => {
    const voices = readdirSync('assets/caller', { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name);
    expect(voices).toContain('huw');
    const missing = voices.flatMap(v => CALLER_KEYS.filter(k => !existsSync(`assets/caller/${v}/${k}.mp3`)).map(k => `${v}/${k}`));
    expect(missing).toEqual([]);
  });
});
