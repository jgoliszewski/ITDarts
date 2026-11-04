// Wycofanie gracza (docs/UI.md#wycofanie-gracza): every game from its event log.
import { describe, expect, it } from 'vitest';
import { parseDart } from './darts.ts';
import { GAMES } from './index.ts';
import type { GameId } from './index.ts';
import type { MiniView, TurnEvent } from './turns.ts';
import { removeBlock } from './turns.ts';

let clock = 0;
const d = (s: string): TurnEvent => ({ t: 'dart', dart: parseDart(s)!, at: ++clock });
const next: TurnEvent = { t: 'next', at: 0 };
const visit = (...s: string[]): TurnEvent[] => [...s.map(d), next];
const remove = (player: number): TurnEvent => ({ t: 'remove', player, scope: 'match' });
const undo: TurnEvent = { t: 'undo' };
const play = (game: GameId, log: TurnEvent[], players = 3, o: object = {}): MiniView & Record<string, any> =>
  GAMES[game].view(log, players, { ...GAMES[game].defaults, ...o });

describe('a game with a plain queue (Around the Clock)', () => {
  it('skips the removed player from then on and greys him out', () => {
    const v = play('atc', [...visit('S1'), remove(1)]);
    expect(v.current).toBe(2);
    expect(v.removed).toEqual([null, 'match', null]);
    expect(play('atc', [...visit('S1'), remove(1), ...visit('S1')]).current).toBe(0);
  });

  it('ends the visit of a player removed mid-visit with the darts thrown and goes on to the next', () => {
    const v = play('atc', [d('S1'), remove(0)]);
    expect(v.current).toBe(1);
    expect(v.visit.darts).toEqual([]);
    expect(v.visit.dartsLeft).toBe(3);
    const after = play('atc', [d('S1'), remove(0), d('S1')]);
    expect(after.visit.player).toBe(1);
    expect(after.progress).toEqual([1, 1, 0]);
  });

  it('plays out the round without the removed player and does not let him win', () => {
    // Ola (1) is removed after finishing in the same number of darts as Kuba; Kuba then wins alone.
    const o = { order: 'numeric', target: 'any', skips: false };
    const all = [...Array(21).keys()].map(i => (i < 20 ? `S${i + 1}` : 'S25'));
    const v = (log: TurnEvent[]) => play('atc', log, 3, o);
    const three = (xs: string[]) => [...xs.map(d), next];
    const visits = (p: string[]) => Array.from({ length: 7 }, (_, i) => p.slice(3 * i, 3 * i + 3));
    const kuba = visits(all), ola = visits(all), ada = visits(Array(21).fill('S20'));
    const log: TurnEvent[] = [];
    for (let i = 0; i < 6; i++) log.push(...three(kuba[i]), ...three(ola[i]), ...three(ada[i]));
    log.push(...three(kuba[6]), ...three(ola[6]), remove(1));
    expect(v(log).phase).toBe('throwing');
    expect(v(log).current).toBe(2);
    const done = v([...log, ...three(ada[6])]);
    expect(done.phase).toBe('matchWon');
    expect(done.winners).toEqual([0]);
  });
});

describe('undo', () => {
  it('takes back a removal when it is the last thing done', () => {
    const v = play('atc', [...visit('S1'), remove(1), undo]);
    expect(v.removed).toEqual([null, null, null]);
    expect(v.current).toBe(1);
  });

  it('reopens the visit a removal ended', () => {
    const v = play('atc', [d('S1'), remove(0), undo]);
    expect(v.removed).toEqual([null, null, null]);
    expect(v.current).toBe(0);
    expect(v.visit.darts.map(x => x.dart.n)).toEqual([1]);
    expect(v.visit.dartsLeft).toBe(2);
  });

  it('undoes the darts after a removal first, then the removal', () => {
    const log = [...visit('S1'), remove(1), d('S1')];
    expect(play('atc', [...log, undo]).removed).toEqual([null, 'match', null]);
    expect(play('atc', [...log, undo, undo]).removed).toEqual([null, null, null]);
  });
});

describe('cricket', () => {
  // Kuba (0) keeps 20 open; Ola (1) and Ada (2) close it.
  const start = [...visit('S1'), ...visit('T20'), ...visit('T20'), ...visit('S1')];

  it('stops a removed player’s open sectors from giving points', () => {
    expect(play('cricket', [...start, ...visit('S20')]).points).toEqual([0, 20, 0]);
    const v = play('cricket', [...start, remove(0), ...visit('S20')]);
    expect(v.points).toEqual([0, 0, 0]);
    expect(v.dead[0]).toBe(true);
  });

  it('keeps his points frozen in cut-throat', () => {
    expect(play('cricket', [...start, ...visit('S20')], 3, { mode: 'cutthroat' }).points).toEqual([20, 0, 0]);
    expect(play('cricket', [...start, remove(0), ...visit('S20')], 3, { mode: 'cutthroat' }).points).toEqual([0, 0, 0]);
  });

  it('lets a player win without beating the removed player’s points', () => {
    // Kuba scores 57 on 19 before he goes; Ola closes everything with no points and wins over Ada alone.
    const log = [...visit('T19', 'T19'), ...visit('S1'), ...visit('S1'), remove(0),
      ...visit('T20', 'T19', 'T18'), ...visit('S1'), ...visit('T17', 'T16', 'T15'), ...visit('S1'), ...visit('D25', 'S25')];
    const v = play('cricket', log);
    expect(v.points[0]).toBe(57);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([1]);
  });
});

describe('killer', () => {
  // Numbers 1, 2, 3 for Kuba, Ola and Ada.
  const numbers: TurnEvent = { t: 'numbers', numbers: [1, 2, 3] };

  it('takes a removed player out of the queue, and nobody hits his number any more', () => {
    const log = [numbers, ...visit('D1'), remove(1), ...visit('S5'), ...visit('D2', 'D3')];
    const v = play('killer', log);
    expect(v.removed).toEqual([null, 'match', null]);
    expect(v.lives).toEqual([3, 3, 2]);
    expect(v.current).toBe(2);
    expect(play('killer', [numbers, ...visit('D1'), remove(1)]).rows[1].out).toBe(true);
  });

  it('lets the last one standing win with the removed player counted out', () => {
    const log = [numbers, ...visit('D1'), remove(1), ...visit('S5'), ...visit('D3', 'D3', 'D3')];
    const v = play('killer', log);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
    // No elimination Wyzwalacz for the removal: only Ada going out.
    const out = GAMES.killer.happenings(log, 3, GAMES.killer.defaults).filter(h => h.fact.kind === 'game' && h.fact.event === 'eliminated');
    expect(out).toHaveLength(1);
  });
});

describe('football', () => {
  it('frees the ball a removed player had', () => {
    const log = [...visit('D25'), remove(0)];
    expect(play('football', [...visit('D25')]).ball).toBe(0);
    expect(play('football', log).ball).toBeNull();
    // Ola needs the bull first: a double scores nothing without the ball.
    expect(play('football', [...log, ...visit('D20')]).goals).toEqual([0, 0, 0]);
  });

  it('leaves the removed player out of the winners on End match with Save', () => {
    // Kuba leads, then is level with Ola when he goes.
    const log = [...visit('D25', 'D20', 'D20'), ...visit('D25', 'D20'), remove(0), { t: 'end' } as TurnEvent];
    const v = play('football', log);
    expect(v.goals).toEqual([2, 1, 0]);
    const level = play('football', [...visit('D25', 'D20'), ...visit('D25', 'D20'), remove(0), { t: 'end' } as TurnEvent]);
    expect(level.winners).toEqual([1]);
    expect(v.winners).toEqual([1]);
  });
});

describe('co-op (121)', () => {
  it('lets the team play on without the removed player', () => {
    const v = play('121', [...visit('S20'), remove(1)]);
    expect(v.current).toBe(2);
    expect(v.remaining).toBe(101);
    expect(play('121', [...visit('S20'), remove(1), ...visit('S1'), ...visit('S1')]).current).toBe(2);
  });
});

describe('gotcha', () => {
  it('does not send a removed player back to zero', () => {
    const log = [...visit('S20'), remove(0), ...visit('S20')];
    expect(play('gotcha', [...visit('S20'), ...visit('S20')]).totals).toEqual([0, 20, 0]);
    expect(play('gotcha', log).totals).toEqual([20, 20, 0]);
  });

  it('does not let a visit cut short by removal send a rival back to zero', () => {
    // Ola is on 15, Kuba on 20; Ola's S5 makes 20 and she is removed before the visit ends.
    const before = [...visit('S20'), ...visit('S15'), ...visit('S1'), ...visit(), d('S5')];
    expect(play('gotcha', [...before, next]).totals).toEqual([0, 20, 1]);
    const v = play('gotcha', [...before, remove(1)]);
    expect(v.totals).toEqual([20, 20, 1]);
    expect(v.zeroed).toEqual([]);
  });
});

describe('knockout', () => {
  it('ends the round in progress without the removed player', () => {
    // Kuba throws lowest and is removed before Ada: the round is decided between Ola and Ada.
    const log = [...visit('S1'), ...visit('S20'), remove(0), ...visit('S5')];
    const v = play('knockout', log);
    expect(v.lives).toEqual([3, 3, 2]);
    expect(v.roundEnd).toEqual({ losers: [2], out: [], replayed: false });
    expect(v.removed).toEqual(['match', null, null]);
    // Next round starts one place on and skips him.
    expect(v.current).toBe(1);
  });

  it('closes the round when the one still to throw is removed', () => {
    const v = play('knockout', [...visit('S1'), ...visit('S20'), remove(2)]);
    expect(v.lives).toEqual([2, 3, 3]);
    expect(v.current).toBe(1);
  });

  it('lets the last one standing win with the removed player counted out', () => {
    // Ola throws lowest three rounds running against Ada.
    const log = [remove(0), ...visit('S1'), ...visit('S20'), ...visit('S1'), ...visit('S20'), ...visit('S20'), ...visit('S1')];
    const v = play('knockout', log);
    expect(v.lives).toEqual([3, 0, 3]);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([2]);
  });
});

describe('higher or lower', () => {
  it('treats a removed player like one who is out, also in the next game', () => {
    // Range 26–45. Kuba goes high, Ola is removed, Ada fails: Kuba wins the game, and the next one is Kuba against Ada.
    const log = [...visit('T20', 'S1', 'S1'), remove(1), ...visit('S20', 'S10', 'S1')];
    const v = play('hol', log, 3, { firstTo: 2 });
    expect(v.points).toEqual([1, 0, 0]);
    expect(v.removed).toEqual([null, 'match', null]);
    // Game 2 starts one place on, with Ola, who is gone: Ada, then Kuba.
    expect(v.current).toBe(2);
    expect(play('hol', [...log, ...visit('T20', 'S1', 'S1')], 3, { firstTo: 2 }).current).toBe(0);
  });

  it('ends the round when the one still to throw is removed', () => {
    // Kuba fails, Ola goes high, Ada is removed: Ola is the only survivor and wins the game.
    const v = play('hol', [...visit('S20', 'S10', 'S1'), ...visit('T20', 'S1', 'S1'), remove(2)], 3, { firstTo: 2 });
    expect(v.points).toEqual([0, 1, 0]);
  });
});

describe('shanghai', () => {
  it('drops a removed player from the rounds and from the final standings', () => {
    // Kuba leads every round and is removed before round 7: Ola wins over Ada.
    const rounds = (r: number) => [...visit(`T${r}`), ...visit(`D${r}`), ...visit(`S${r}`)];
    const log = [...[1, 2, 3, 4, 5, 6].flatMap(rounds), remove(0), ...visit('D7')];
    const v = play('shanghai', log);
    expect(v.current).toBe(2);
    expect(v.round).toBe(7);
    const done = play('shanghai', [...log, ...visit('S7')]);
    expect(done.phase).toBe('matchWon');
    expect(done.winners).toEqual([1]);
  });

  it('ends the round when the last one to throw in it is removed', () => {
    const rounds = (r: number) => [...visit(`S${r}`), ...visit(`D${r}`), ...visit(`T${r}`)];
    const v = play('shanghai', [...[1, 2, 3, 4, 5, 6].flatMap(rounds), ...visit('S7'), ...visit('D7'), remove(2)]);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([1]);
  });
});

describe('when the Pilot may remove a player', () => {
  it('allows it while at least two would still play', () => {
    expect(removeBlock('atc', play('atc', visit('S1')), 1, 'match')).toBeNull();
  });

  it('blocks it when fewer than two would be left, counting players already out', () => {
    expect(removeBlock('atc', play('atc', visit('S1'), 2), 1, 'match')).toMatch(/End match/);
    expect(removeBlock('atc', play('atc', [remove(0)]), 1, 'match')).toMatch(/End match/);
    // Killer: Ada is out of lives, so removing Ola would leave Kuba alone.
    const killer = play('killer', [{ t: 'numbers', numbers: [1, 2, 3] }, ...visit('D1'), ...visit('S5'), ...visit('S5'), ...visit('D3', 'D3', 'D3')]);
    expect(killer.removed).toEqual([null, null, null]);
    expect(removeBlock('killer', killer, 1, 'match')).toMatch(/End match/);
  });

  it('blocks it during the bull-off, after the game and twice for the same player', () => {
    expect(removeBlock('atc', play('atc', [], 3, { bullOff: 'closest' }), 1, 'match')).toMatch(/bull-off/);
    expect(removeBlock('atc', play('atc', [...visit('S1'), remove(1)], 4), 1, 'match')).toMatch(/already/);
    const won = play('knockout', [...visit('S20'), ...visit('S1'), ...visit('S1'), ...visit('S20'), ...visit('S20'), ...visit('S1')], 2);
    expect(won.phase).toBe('matchWon');
    expect(removeBlock('knockout', won, 0, 'match')).toMatch(/over/);
  });

  it('removes from a leg in X01 only', () => {
    expect(removeBlock('atc', play('atc', visit('S1')), 1, 'leg')).toMatch(/X01/);
  });
});

describe('removed while throwing (no misses filled in)', () => {
  it('ends the visit with only the darts thrown', () => {
    // Around the Clock counts darts per player: one thrown, not three.
    const v = play('atc', [d('S1'), remove(0)]);
    expect(v.stats[0].darts).toBe(1);
  });

  it('does not judge a higher or lower visit cut short, so no fake failure', () => {
    const log = [...visit('T20', 'S1', 'S1'), d('S1'), remove(1)];
    const v = play('hol', log, 3, { firstTo: 2 });
    expect([v.lo, v.hi]).toEqual([26, 62]);
    expect(v.current).toBe(2);
    const facts = GAMES.hol.happenings(log, 3, { ...GAMES.hol.defaults, firstTo: 2 }).map(h => h.fact);
    expect(facts.some(f => f.kind === 'game' && f.event === 'eliminated')).toBe(false);
  });

  it('leaves a knockout visit cut short out of the round: the lowest of the rest loses the life', () => {
    const v = play('knockout', [...visit('S10'), ...visit('S20'), d('S1'), remove(2)]);
    expect(v.lives[0]).toBeLessThan(v.lives[1]);
  });

  it('does not let a shanghai leader removed during the last round win', () => {
    const rounds = (r: number) => [...visit(`D${r}`), ...visit(`S${r}`), ...visit(`T${r}`)];
    const v = play('shanghai', [...[1, 2, 3, 4, 5, 6].flatMap(rounds), ...visit('S7'), ...visit('S7'), d('S7'), remove(2)]);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([0]);
  });
});

describe('a round in progress keeps its result on screen until the takeout', () => {
  it('knockout: removing someone else while the last visit waits for the takeout', () => {
    const v = play('knockout', [...visit('S1'), ...visit('S20'), d('S5'), d('S5'), d('S5'), remove(3)], 4);
    expect(v.roundTotals).toEqual([1, 20, 15, null]);
  });

  it('shanghai: the round number stays until the takeout', () => {
    const v = play('shanghai', [...visit('S1'), ...visit('S1'), d('S1'), d('S1'), d('S1'), remove(3)], 4);
    expect(v.round).toBe(1);
  });
});

describe('the last player left in a round', () => {
  // Kuba (0) and Ada (2) tie after 7 rounds of Shanghai; Ola (1) and Ela (3) score nothing.
  const tied = [1, 2, 3, 4, 5, 6, 7].flatMap(r => [...visit(`S${r}`), ...visit(), ...visit(`S${r}`), ...visit()]);

  it('wins the shanghai tiebreak at once when the other one is removed', () => {
    expect(play('shanghai', tied, 4).tiebreak).toBe(true);
    const v = play('shanghai', [...tied, remove(0)], 4);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([2]);
  });

  it('wins the shanghai tiebreak when removed after his rival has thrown', () => {
    const v = play('shanghai', [...tied, ...visit('S20'), remove(2)], 4);
    expect(v.winners).toEqual([0]);
  });

  // Round 1 of Higher or Lower: Kuba above, Ola below, Ada and Ela fail; Kuba and Ola are left in the game.
  const round1 = [...visit('T20', 'T20', 'T20'), ...visit('S1', 'S1', 'S1'), ...visit(), ...visit()];

  it('wins the higher or lower game at once when the other one still in it is removed', () => {
    const v = play('hol', [...round1, remove(0)], 4);
    expect(v.phase).toBe('matchWon');
    expect(v.winners).toEqual([1]);
  });

  it('starts the next higher or lower game with everyone still in the match, never an empty one', () => {
    const v = play('hol', [...round1, remove(0)], 4, { firstTo: 2 });
    expect(v.points).toEqual([0, 1, 0, 0]);
    expect(v.game).toBe(2);
    expect(v.rows.map(r => r.out)).toEqual([true, false, false, false]);
    const w = play('hol', [...round1, remove(0), remove(1)], 4, { firstTo: 2 });
    expect([2, 3]).toContain(w.current);
    expect(play('hol', [...round1, remove(0), remove(1), d('S20')], 4, { firstTo: 2 }).visit.player).toBe(w.current);
  });
});
