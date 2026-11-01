import { describe, expect, it } from 'vitest';
import { parseDart } from './darts.ts';
import { GAMES } from './index.ts';
import { matchReport } from './report.ts';
import type { X01Event, X01Options } from './x01/index.ts';

const o: X01Options = { startScore: 101, checkIn: 'straight', checkOut: 'double', matchMode: { kind: 'off' }, bullOff: 'off' };
let clock = 0;
const d = (s: string, coords = true): X01Event => ({ t: 'dart', dart: parseDart(s)!, ...(coords && { coords: { x: 0, y: 0.6 } }), at: ++clock });
const next: X01Event = { t: 'next', at: 0 };

describe('match report', () => {
  it('compares an X01 match, guests included, and walks two oche lengths per visit', () => {
    // Player 1 checks out 101 in two visits; player 2 throws one visit, one dart entered by hand.
    const events = [d('T20'), d('S1'), d('S20'), next, d('S5'), d('S5', false), d('S5'), next, d('D10')];
    const x01 = GAMES.x01;
    const view = x01.view(events, 2, o);
    const r = matchReport({
      game: 'x01', description: 'X01', names: ['Ann', 'Guest 1'], legs: x01.compact(events, 2, o), view,
      checkOut: 'double', ended: false, ocheMeters: 2.5,
    });
    expect([r.kicker, r.title, r.line]).toEqual(['WINNER', 'Ann', '1–0']);
    expect(r.x01!.map(x => x.darts)).toEqual([4, 3]);
    expect(r.x01![0].highestCheckout).toBe(20);
    expect(r.heat.map(h => [h.darts.length, h.noPos, h.visits])).toEqual([[4, 0, 2], [2, 1, 1]]);
    expect(r.distance).toEqual([10, 5]);
  });

  it('heads an ended match with the players, and a minigame with its result', () => {
    const atc = GAMES.atc;
    const events = [{ t: 'dart', dart: parseDart('S1')!, at: 1 }];
    const r = matchReport({
      game: 'atc', description: 'ATC', names: ['Ann'], legs: atc.compact(events, 1, atc.defaults), view: atc.view(events, 1, atc.defaults),
      checkOut: null, ended: true, ocheMeters: 2.37,
    });
    expect(r.kicker).toBe('MATCH ENDED');
    expect(r.x01).toBeNull();
    expect(r.totals).toHaveLength(1);
  });
});
