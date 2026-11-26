import { describe, expect, it } from 'vitest';
import type { LobbyRecord, MatchSummary, RecordInfo, RecordResult, RosterEntry } from '../../server/protocol.ts';
import { introPills, ladderMarks, modalRows, ownRecord, recordPills, splitValue, attemptHint, attemptReady, togglePick, attemptCommand, lastLine, gridShape } from './records.ts';

const res = (raw: number, place: number, by = 'X', at = 0): RecordResult => ({ raw, value: `${raw} darts`, by, at, place });
const info = (o: Partial<RecordInfo> = {}): RecordInfo => ({
  label: 'ATC · Any · Skips', value: '23 darts', raw: 23, by: 'Ewa', at: 0, better: 'lower', coop: false, personal: [], team: null, top: [], ...o,
});
const ann: RosterEntry = { playerId: 1, name: 'Ann' };
const bob: RosterEntry = { playerId: 2, name: 'Bob' };
const guest: RosterEntry = { playerId: null, name: 'Guest 1' };

describe('record pills', () => {
  it('shows Best over the PB', () => {
    expect(recordPills(info({ personal: [res(31, 4)] }), [ann], 0, null)).toEqual([
      { kind: 'best', label: 'Best', value: 23, out: false },
      { kind: 'pb', label: 'PB', value: 31, out: false },
    ]);
  });

  it('merges them when the player holds the office record', () => {
    expect(recordPills(info({ by: 'Ann', personal: [res(23, 1)] }), [ann], 0, null)).toEqual([{ kind: 'both', label: 'Best · PB', value: 23, out: false }]);
  });

  it('does not merge a PB that only ties the record set earlier by someone else', () => {
    expect(recordPills(info({ personal: [res(23, 2)] }), [ann], 0, null).map(p => p.kind)).toEqual(['best', 'pb']);
  });

  it('shows PB – without one, Best – without an office record, and no PB for a guest', () => {
    expect(recordPills(info(), [ann], 0, null).map(p => [p.label, p.value])).toEqual([['Best', 23], ['PB', null]]);
    expect(recordPills(info({ value: null, raw: null, by: null, at: null }), [ann], 0, null).map(p => [p.label, p.value])).toEqual([['Best', null], ['PB', null]]);
    expect(recordPills(info(), [guest], 0, null).map(p => p.label)).toEqual(['Best']);
  });

  it('follows the player throwing', () => {
    const r = info({ personal: [res(23, 1), res(31, 3)] });
    expect(recordPills(r, [ann, bob], 0, null).map(p => p.label)).toEqual(['Best · PB']);
    expect(recordPills(r, [ann, bob], 1, null).map(p => [p.label, p.value])).toEqual([['Best', 23], ['PB', 31]]);
  });

  it('shows the Team best in co-op, merged as Best · Team, and no Team with a guest', () => {
    expect(recordPills(info({ coop: true, team: res(29, 3) }), [ann, bob], 1, null).map(p => [p.label, p.value])).toEqual([['Best', 23], ['Team', 29]]);
    expect(recordPills(info({ coop: true, team: res(23, 1) }), [ann, bob], 0, null).map(p => p.label)).toEqual(['Best · Team']);
    expect(recordPills(info({ coop: true }), [ann, bob], 0, null).map(p => [p.label, p.value])).toEqual([['Best', 23], ['Team', null]]);
    expect(recordPills(info({ coop: true }), [ann, guest], 0, null).map(p => p.label)).toEqual(['Best']);
  });

  it('greys a pill out once the best the game can still reach no longer beats it; a tie does not', () => {
    const r = info({ personal: [res(31, 4)] });
    expect(recordPills(r, [ann], 0, 22).map(p => p.out)).toEqual([false, false]);
    expect(recordPills(r, [ann], 0, 23).map(p => p.out)).toEqual([true, false]);
    expect(recordPills(r, [ann], 0, 31).map(p => p.out)).toEqual([true, true]);
    // More is better in Shanghai: out once the reachable maximum is at or under it.
    const sh = info({ better: 'higher', raw: 126, personal: [res(98, 2)] });
    expect(recordPills(sh, [ann], 0, 127).map(p => p.out)).toEqual([false, false]);
    expect(recordPills(sh, [ann], 0, 126).map(p => p.out)).toEqual([true, false]);
  });

  it('never greys out a missing record', () => {
    expect(recordPills(info({ value: null, raw: null }), [ann], 0, 99).map(p => p.out)).toEqual([false, false]);
  });
});

describe('own record', () => {
  it('is the PB, the Team best in co-op, and none for a guest', () => {
    expect(ownRecord(info({ personal: [res(31, 4)] }), [ann], 0)).toEqual({ label: 'PB', res: res(31, 4) });
    expect(ownRecord(info({ coop: true, team: res(29, 2) }), [ann, bob], 1)).toEqual({ label: 'Team', res: res(29, 2) });
    expect(ownRecord(info(), [guest], 0)).toBeNull();
  });
});

describe('121 ladder marks', () => {
  const r121 = (o: Partial<RecordInfo>) => info({ better: 'higher', raw: 135, ...o });

  it('gives the PB and the Best, PB first', () => {
    expect(ladderMarks(r121({ personal: [res(128, 2)] }), [ann])).toEqual([
      { value: 128, kind: 'pb', label: 'PB' },
      { value: 135, kind: 'best', label: 'Best' },
    ]);
  });

  it('merges them when the player holds the record, and gives Team in co-op', () => {
    expect(ladderMarks(r121({ raw: 128, personal: [res(128, 1)] }), [ann])).toEqual([{ value: 128, kind: 'both', label: 'Best · PB' }]);
    expect(ladderMarks(r121({ coop: true, team: res(128, 2) }), [ann, bob])).toEqual([
      { value: 128, kind: 'pb', label: 'Team' },
      { value: 135, kind: 'best', label: 'Best' },
    ]);
  });

  it('leaves out what there is none of', () => {
    expect(ladderMarks(r121({}), [ann])).toEqual([{ value: 135, kind: 'best', label: 'Best' }]);
    expect(ladderMarks(r121({ raw: null }), [ann])).toEqual([]);
    expect(ladderMarks(null, [ann])).toEqual([]);
  });
});

describe('record screen pills', () => {
  it('shows the PB of a solo player with its date, or First game', () => {
    expect(introPills(info({ personal: [res(31, 4, 'Ann', 5)] }), [ann])).toEqual({ two: false, pills: [{ kind: 'pb', label: 'PB', value: 31, who: 'Ann', when: 5 }] });
    expect(introPills(info(), [ann]).pills).toEqual([{ kind: 'pb', label: 'PB', value: null, who: 'Ann', when: 'first' }]);
  });

  it('shows Best · PB without a number for a solo record holder', () => {
    expect(introPills(info({ by: 'Ann', personal: [res(23, 1, 'Ann')] }), [ann]).pills).toEqual([{ kind: 'both', label: 'Best · PB', value: null, who: 'Ann', when: null }]);
  });

  it('shows one pill per player without dates, guests left out, two columns from 5 players', () => {
    const r = info({ personal: [res(23, 1), res(31, 3), null] });
    expect(introPills(r, [ann, bob, guest]).pills.map(p => [p.kind, p.who, p.value, p.when])).toEqual([['both', 'Ann', 23, null], ['pb', 'Bob', 31, null]]);
    const five = [1, 2, 3, 4, 5].map(i => ({ playerId: i, name: `P${i}` }));
    expect(introPills(info({ personal: five.map(() => null) }), five).two).toBe(true);
    expect(introPills(info({ personal: [null, null, null, null] }), five.slice(0, 4)).two).toBe(false);
  });

  it('shows the Team best in co-op with the lineup and nothing with a guest', () => {
    expect(introPills(info({ coop: true, team: res(29, 2, 'Ann & Bob', 7) }), [ann, bob]).pills).toEqual([{ kind: 'pb', label: 'Team', value: 29, who: 'Ann & Bob', when: 7 }]);
    expect(introPills(info({ coop: true }), [ann, bob]).pills).toEqual([{ kind: 'pb', label: 'Team', value: null, who: 'Ann & Bob', when: 'first' }]);
    expect(introPills(info({ coop: true }), [ann, guest]).pills).toEqual([]);
  });

  it('shows nothing while the variant has no record at all', () => {
    expect(introPills(info({ value: null, raw: null }), [ann]).pills).toEqual([]);
  });
});

describe('records modal', () => {
  const top = [res(23, 1, 'Ewa'), res(25, 2, 'Tom'), res(27, 3, 'Kasia'), res(29, 4, 'Piotr'), res(30, 5, 'Marek')];

  it('marks the throwing player’s row in the top 5', () => {
    const r = info({ top, personal: [res(27, 3, 'Kasia')] });
    expect(modalRows(r, [{ playerId: 3, name: 'Kasia' }], 0).map(t => t !== 'gap' && [t.place, t.me])).toEqual([[1, false], [2, false], [3, true], [4, false], [5, false]]);
  });

  it('adds the player’s place under a gap when it is below the top 5', () => {
    const r = info({ top, personal: [res(31, 7, 'Ann')] });
    const rows = modalRows(r, [ann], 0);
    expect(rows.slice(5)).toEqual(['gap', { ...res(31, 7, 'Ann'), me: true }]);
  });

  it('marks the lineup in co-op and nothing for a guest', () => {
    expect(modalRows(info({ top, coop: true, team: res(25, 2) }), [ann, bob], 0).filter(t => t !== 'gap' && t.me).map(t => t !== 'gap' && t.place)).toEqual([2]);
    expect(modalRows(info({ top }), [guest], 0).some(t => t !== 'gap' && t.me)).toBe(false);
  });
});

describe('value and unit', () => {
  it('splits a formatted record into the number and its unit', () => {
    expect(splitValue('23 darts')).toEqual(['23', 'darts']);
    expect(splitValue('1 point')).toEqual(['1', 'point']);
    expect(splitValue('Target 128')).toEqual(['128', '']);
  });
});

describe('record attempt players', () => {
  const solo = { coop: false, minPlayers: 1, maxPlayers: 1 };
  const coop = { coop: true, minPlayers: 2, maxPlayers: 4 };

  it('hints the count', () => {
    expect(attemptHint(solo)).toBe('Pick 1 player');
    expect(attemptHint(coop)).toBe('Pick 2 or more players');
  });

  it('starts solo with exactly one player', () => {
    expect([0, 1, 2].map(n => attemptReady(solo, n))).toEqual([false, true, false]);
  });

  it('starts co-op with two up to the limit', () => {
    expect([0, 1, 2, 4, 5].map(n => attemptReady(coop, n))).toEqual([false, false, true, true, false]);
  });

  it('swaps the one solo player instead of adding', () => {
    expect(togglePick(solo, [], 3)).toEqual([3]);
    expect(togglePick(solo, [3], 5)).toEqual([5]);
    expect(togglePick(solo, [3], 3)).toEqual([]);
  });

  it('toggles co-op players in the order picked and stops at the limit', () => {
    expect(togglePick(coop, [2], 1)).toEqual([2, 1]);
    expect(togglePick(coop, [2, 1], 2)).toEqual([1]);
    expect(togglePick(coop, [1, 2, 3, 4], 5)).toEqual([1, 2, 3, 4]);
  });
});

describe('record attempt command', () => {
  const players = [{ id: 1, name: 'Ann' }, { id: 2, name: 'Bob' }, { id: 3, name: 'Cy' }];
  const rec = (o: Partial<LobbyRecord>): LobbyRecord => ({
    game: 'atc', key: 'atc:any:skips', label: 'ATC', value: '23 darts', who: 'Ewa', at: 0, options: { order: 'clockwise', target: 'any', skips: true, coop: false }, chase: [],
    coop: false, minPlayers: 1, maxPlayers: 1, ...o,
  });

  it('starts a solo ATC with the record match order and the picked player', () => {
    expect(attemptCommand(rec({}), [2], players)).toEqual({
      type: 'startMatch', game: 'atc', options: { order: 'clockwise', target: 'any', skips: true, coop: false }, roster: [{ playerId: 2, name: 'Bob' }],
    });
  });

  it('plays a co-op record as co-op, in the order picked', () => {
    const r = rec({ key: 'atc:any:skips:coop', options: { order: 'random', skips: true, coop: false }, coop: true, minPlayers: 2, maxPlayers: 8 });
    const cmd = attemptCommand(r, [3, 1], players)!;
    expect(cmd.options).toEqual({ order: 'random', skips: true, coop: true });
    expect(cmd.roster).toEqual([{ playerId: 3, name: 'Cy' }, { playerId: 1, name: 'Ann' }]);
  });

  it('leaves the options alone where a game has no co-op flag', () => {
    const r = rec({ game: '121', options: { visits: 3 }, coop: true, minPlayers: 2, maxPlayers: 8 });
    expect(attemptCommand(r, [1, 2], players)!.options).toEqual({ visits: 3 });
  });

  it('drops a picked player who left the list, and refuses when the count no longer fits', () => {
    const r = rec({ coop: true, minPlayers: 2, maxPlayers: 8 });
    expect(attemptCommand(r, [1, 2, 9], players)!.roster.map(p => p.playerId)).toEqual([1, 2]);
    expect(attemptCommand(r, [1, 9], players)).toBeNull();
    expect(attemptCommand(rec({}), [], players)).toBeNull();
    expect(attemptCommand(rec({}), [1, 2], players)).toBeNull();
  });
});

describe('last match line', () => {
  const p = (name: string, value: string, o: { winner?: boolean; left?: boolean } = {}) => ({ name, value, avg: null, winner: !!o.winner, left: !!o.left });
  const m = (game: MatchSummary['game'], description: string, players: MatchSummary['players']): MatchSummary =>
    ({ id: 1, game, description, endedAt: 0, status: 'finished', players, checkout: null });

  it('names a solo player and the result', () => {
    expect(lastLine(m('121', '121', [p('Anna', 'Target 140')]))).toBe('Last: 121 · Anna · Target 140');
  });

  it('names everyone on a tie', () => {
    expect(lastLine(m('shanghai', 'Shanghai', [p('Anna', '90 points'), p('Bob', '90 points')]))).toBe('Last: Shanghai · Anna & Bob · 90 points');
  });

  it('names a co-op team that won', () => {
    expect(lastLine(m('atc', 'ATC · Co-op', [p('Anna', '58 darts', { winner: true }), p('Bob', '58 darts', { winner: true })]))).toBe('Last: ATC · Co-op · Anna & Bob · 58 darts');
  });

  it('gives both sides of a two-player X01', () => {
    expect(lastLine(m('x01', 'X01 · 501 · Double out', [p('Anna', '3', { winner: true }), p('Bob', '1')]))).toBe('Last: 501 · Double out · Anna 3–1 Bob');
  });

  it('gives only the winner of an X01 with more players', () => {
    expect(lastLine(m('x01', 'X01 · 501', [p('Anna', '1'), p('Bob', '2', { winner: true }), p('Cy', '0')]))).toBe('Last: 501 · Bob');
  });

  it('leaves out a player who left unless nobody won', () => {
    expect(lastLine(m('shanghai', 'Shanghai', [p('Anna', '90 points', { winner: true }), p('Bob', '', { left: true })]))).toBe('Last: Shanghai · Anna · 90 points');
    expect(lastLine(m('shanghai', 'Shanghai', [p('Anna', '', { left: true }), p('Bob', '80 points')]))).toBe('Last: Shanghai · Bob · 80 points');
  });
});

describe('record grid shape', () => {
  it('fills the space with fewer, bigger tiles', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(n => { const g = gridShape(n); return `${g.cols}x${g.rows}`; }))
      .toEqual(['1x1', '2x1', '2x2', '2x2', '3x2', '3x2', '4x2', '4x2']);
  });
});
