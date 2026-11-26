import { describe, expect, it } from 'vitest';
import type { LobbyRecord, MatchSummary, RecordInfo, RecordResult, RosterEntry } from '../../server/protocol.ts';
import { introPills, ladderMarks, modalRows, ownRecord, recordPills, splitValue, attemptHint, attemptReady, togglePick, attemptCommand, lastLine, recordPages, groupTitle, gestureDown, gestureMove, gestureEnd, gestureClick, idleGesture, lockAxis, rubberBand, holdPosition, swipeSpeed, projectPage, springStep, dotWeight, nextPage } from './records.ts';

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
    game: 'atc', key: 'atc:any:skips', label: 'ATC', title: 'ATC', sub: '', value: '23 darts', who: 'Ewa', at: 0, options: { order: 'clockwise', target: 'any', skips: true, coop: false }, chase: [],
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

const rec = (game: string, i: number): LobbyRecord => ({
  game: game as LobbyRecord['game'], key: `${game}:${i}`, label: `${game} · v${i}`, title: game.toUpperCase(), sub: `v${i}`, value: '1 darts', who: 'X', at: 0,
  options: {}, chase: [], coop: false, minPlayers: 1, maxPlayers: 1,
});
/** Records of the games in order: `recs(['atc', 3], ['cricket', 2])` is three ATC and two Cricket variants. */
const recs = (...games: [string, number][]) => games.flatMap(([g, n]) => Array.from({ length: n }, (_, i) => rec(g, i)));
/** A page as text: its size, then `TITLE items@row.col` for each group. */
const show = (p: ReturnType<typeof recordPages>[number]) => `${p.cols}x${p.rows} ` + p.groups.map(g => `${groupTitle(g).toUpperCase()} ${g.items.length}@${g.row}.${g.col}`).join(' | ');
const tiles = (pages: ReturnType<typeof recordPages>) => pages.flatMap(p => p.groups).reduce((n, g) => n + g.items.length, 0);

describe('record pages', () => {
  it('has no page without records', () => {
    expect(recordPages([])).toEqual([]);
  });

  it('puts one record on one page, as big as the page', () => {
    expect(recordPages(recs(['atc', 1])).map(show)).toEqual(['1x1 ATC 1@0.0']);
  });

  it('puts 4 records of one game on one page, as 2×2', () => {
    expect(recordPages(recs(['atc', 4])).map(show)).toEqual(['2x2 ATC 4@0.0']);
  });

  it('makes every page the same 4×2 grid, so a tile is as big on each page', () => {
    const pages = recordPages(recs(['atc', 8], ['cricket', 3], ['shanghai', 2], ['hol', 1]));
    expect(pages.map(p => [p.cols, p.rows])).toEqual([[4, 2], [4, 2]]);
    // The second page has one row of small groups; its tiles stay as small as on the full page.
    expect(recordPages(recs(['atc', 8], ['cricket', 2])).map(show)).toEqual(['4x2 ATC 8@0.0', '4x2 CRICKET 2@0.0']);
  });

  it('makes tiles bigger only for 4 records or fewer in all: 1, 2 side by side, 2×2', () => {
    expect(recordPages(recs(['atc', 1])).map(show)).toEqual(['1x1 ATC 1@0.0']);
    expect(recordPages(recs(['atc', 1], ['hol', 1])).map(show)).toEqual(['2x1 ATC 1@0.0 | HOL 1@0.1']);
    expect(recordPages(recs(['atc', 2])).map(show)).toEqual(['2x1 ATC 2@0.0']);
    expect(recordPages(recs(['atc', 3])).map(show)).toEqual(['2x2 ATC 3@0.0']);
    expect(recordPages(recs(['atc', 2], ['hol', 1])).map(show)).toEqual(['2x2 ATC 2@0.0 | HOL 1@1.0']);
    expect(recordPages(recs(['atc', 2], ['hol', 2])).map(show)).toEqual(['2x2 ATC 2@0.0 | HOL 2@1.0']);
    expect(recordPages(recs(['atc', 1], ['hol', 1], ['cricket', 1], ['shanghai', 1])).map(show)).toEqual(['2x2 ATC 1@0.0 | HOL 1@0.1 | CRICKET 1@1.0 | SHANGHAI 1@1.1']);
  });

  it('keeps the 4×2 grid when 4 records in two games do not fit 2×2 (3 and 1), and from 5 records on', () => {
    expect(recordPages(recs(['atc', 3], ['hol', 1])).map(show)).toEqual(['4x2 ATC 3@0.0 | HOL 1@0.3']);
    expect(recordPages(recs(['atc', 2], ['hol', 2], ['cricket', 1])).map(show)).toEqual(['4x2 ATC 2@0.0 | HOL 2@0.2 | CRICKET 1@1.0']);
  });

  it('gives a group of 5 to 8 a page of its own', () => {
    expect(recordPages(recs(['atc', 5])).map(show)).toEqual(['4x2 ATC 5@0.0']);
    expect(recordPages(recs(['atc', 8], ['cricket', 1])).map(show)).toEqual(['4x2 ATC 8@0.0', '4x2 CRICKET 1@0.0']);
  });

  it('packs small groups first-fit into rows, two rows to a page, without holes', () => {
    // 3 + 3 does not fit one row, so Cricket opens row 2; Shanghai's 1 fills row 1 and Hol's 1 row 2.
    const pages = recordPages(recs(['atc', 3], ['cricket', 3], ['shanghai', 1], ['hol', 1]));
    expect(pages.map(show)).toEqual(['4x2 ATC 3@0.0 | SHANGHAI 1@0.3 | CRICKET 3@1.0 | HOL 1@1.3']);
  });

  it('starts a second page when two rows are full', () => {
    const pages = recordPages(recs(['atc', 4], ['cricket', 4], ['shanghai', 2], ['hol', 2]));
    expect(pages.map(show)).toEqual(['4x2 ATC 4@0.0 | CRICKET 4@1.0', '4x2 SHANGHAI 2@0.0 | HOL 2@0.2']);
  });

  it('puts the pages of big groups first and keeps the order of games otherwise', () => {
    const pages = recordPages(recs(['atc', 2], ['cricket', 6], ['shanghai', 2]));
    expect(pages.map(show)).toEqual(['4x2 CRICKET 6@0.0', '4x2 ATC 2@0.0 | SHANGHAI 2@0.2']);
  });

  it('treats a group of exactly 4 as a small one: it shares pages in the order of the games', () => {
    expect(recordPages(recs(['atc', 2], ['cricket', 4])).map(show)).toEqual(['4x2 ATC 2@0.0 | CRICKET 4@1.0']);
  });

  it('pages 10 variants of one game as the game and “(cont.)”, nothing cut', () => {
    const pages = recordPages(recs(['atc', 10]));
    expect(pages.map(show)).toEqual(['4x2 ATC 8@0.0', '4x2 ATC (CONT.) 2@0.0']);
    expect(pages.flatMap(p => p.groups.flatMap(g => g.items)).map(r => r.key)).toEqual(recs(['atc', 10]).map(r => r.key));
  });

  it('continues a game of 13 as a second big page', () => {
    expect(recordPages(recs(['atc', 13])).map(show)).toEqual(['4x2 ATC 8@0.0', '4x2 ATC (CONT.) 5@0.0']);
  });

  it('lets the rest of a big game share rows with small games', () => {
    expect(recordPages(recs(['atc', 12], ['cricket', 3], ['hol', 1])).map(show))
      .toEqual(['4x2 ATC 8@0.0', '4x2 ATC (CONT.) 4@0.0 | CRICKET 3@1.0 | HOL 1@1.3']);
  });

  it('keeps every tile of 18 and of 30 variants, at most 8 to a page', () => {
    const eighteen = recordPages(recs(['atc', 6], ['cricket', 3], ['shanghai', 3], ['hol', 2], ['gotcha', 2], ['killer', 2]));
    expect(tiles(eighteen)).toBe(18);
    expect(eighteen).toHaveLength(3);
    const thirty = recordPages(recs(['atc', 9], ['fullboard', 6], ['121', 4], ['cricket', 3], ['shanghai', 3], ['hol', 2], ['killer', 2], ['gotcha', 1]));
    expect(tiles(thirty)).toBe(30);
    expect(thirty.every(p => tiles([p]) <= 8)).toBe(true);
    expect(thirty).toHaveLength(4);
  });

  it('never packs more than 4 tiles into a row', () => {
    const pages = recordPages(recs(['a', 2], ['b', 3], ['c', 2], ['d', 1], ['e', 3], ['f', 4], ['g', 1]));
    expect(tiles(pages)).toBe(16);
    for (const p of pages) for (let r = 0; r < p.rows; r++) {
      expect(p.groups.filter(g => g.row === r).reduce((n, g) => n + g.items.length, 0)).toBeLessThanOrEqual(4);
    }
  });
});

describe('record swipe', () => {
  it('stays a tap until 10 px, then locks the axis it went furthest in', () => {
    expect(lockAxis(9, 0)).toBeNull();
    expect(lockAxis(0, -9)).toBeNull();
    expect(lockAxis(10, 0)).toBe('x');
    expect(lockAxis(-12, 3)).toBe('x');
    expect(lockAxis(2, 10)).toBe('y');
    expect(lockAxis(11, 11)).toBe('y');
  });

  it('pulls the page past an end with a rubber band: slows down and stays under the page width', () => {
    expect(rubberBand(0, 1000)).toBe(0);
    expect(rubberBand(100, 1000)).toBeCloseTo((100 * 1000 * 0.55) / (1000 + 55), 5);
    expect(rubberBand(100, 1000)).toBeLessThan(100);
    expect(rubberBand(-100, 1000)).toBeCloseTo(-rubberBand(100, 1000), 5);
    expect(rubberBand(1e6, 1000)).toBeLessThan(1000);
    expect(rubberBand(300, 1000)).toBeGreaterThan(rubberBand(100, 1000));
  });

  it('follows the finger 1:1 inside the strip and with the rubber band outside it', () => {
    // 3 pages of 1000: the strip runs 0..2000.
    expect(holdPosition(1000, -300, 2000, 1000)).toBe(1300);
    expect(holdPosition(1000, 300, 2000, 1000)).toBe(700);
    expect(holdPosition(0, 100, 2000, 1000)).toBeCloseTo(-rubberBand(100, 1000), 5);
    expect(holdPosition(2000, -100, 2000, 1000)).toBeCloseTo(2000 + rubberBand(100, 1000), 5);
    expect(holdPosition(0, -100, 2000, 1000)).toBe(100);
  });

  it('measures the speed in px/s over the last 120 ms only', () => {
    expect(swipeSpeed([[0, 0], [30, 50], [100, 100]], 110)).toBeCloseTo(1000);
    // Held still before the release: the old fast moves are out of the window.
    expect(swipeSpeed([[0, 0], [200, 50], [200, 400]], 450)).toBe(0);
    expect(swipeSpeed([], 0)).toBe(0);
  });

  it('rests on the page nearest to where the momentum carries it', () => {
    // From page 1 of 4 (width 1000); a slow release at 400 stays, at 600 goes on (position alone).
    expect(projectPage(400, 0, 1000, 0, 3)).toBe(0);
    expect(projectPage(600, 0, 1000, 0, 3)).toBe(1);
    // A flick: 1000 px/s projects 499 px further, so 1300 -> page 2 (max one from the start, which was 1).
    expect(projectPage(1100, 1000, 1000, 1, 3)).toBe(2);
    expect(projectPage(900, -1000, 1000, 1, 3)).toBe(0);
    // The speed counts, not only the place: 300 px/s back from 1100 projects to 950, still page 1; the same speed forward from 600 reaches page 1.
    expect(projectPage(1100, -300, 1000, 1, 3)).toBe(1);
    expect(projectPage(400, 300, 1000, 0, 3)).toBe(1);
    expect(projectPage(400, 100, 1000, 0, 3)).toBe(0);
    // Not even a gentle drag carries a short way too far back.
    expect(projectPage(1050, -50, 1000, 1, 3)).toBe(1);
  });

  it('never goes more than one page from where it started, nor past the ends', () => {
    expect(projectPage(1500, 20000, 1000, 1, 3)).toBe(2);
    expect(projectPage(1500, -20000, 1000, 1, 3)).toBe(0);
    expect(projectPage(2900, 5000, 1000, 3, 3)).toBe(3);
    expect(projectPage(-50, -5000, 1000, 0, 3)).toBe(0);
  });
});

describe('record page spring', () => {
  const run = (x: number, v: number, target: number, response: number, seconds: number) => {
    let s = { x, v };
    const xs = [x];
    for (let t = 0; t < seconds; t += 1 / 60) { s = springStep(s.x, s.v, target, 1 / 60, response); xs.push(s.x); }
    return { ...s, xs };
  };

  it('converges on the target and is done in about its response time', () => {
    const r = run(0, 0, 1000, 0.35, 0.8);
    expect(r.x).toBeGreaterThan(999);
    expect(Math.abs(r.v)).toBeLessThan(5);
    // Not there yet after a seventh of the time.
    expect(run(0, 0, 1000, 0.35, 0.05).x).toBeLessThan(500);
  });

  it('never overshoots, from rest or from a fast release', () => {
    expect(Math.max(...run(0, 0, 1000, 0.35, 2).xs)).toBeLessThanOrEqual(1000.0001);
    // Released towards the target at 5000 px/s: it may arrive quickly, never past.
    expect(Math.max(...run(500, 5000, 1000, 0.35, 2).xs)).toBeLessThanOrEqual(1000.0001);
    expect(Math.min(...run(900, -3000, 0, 0.45, 2).xs)).toBeGreaterThanOrEqual(-0.0001);
  });

  it('carries the finger’s speed on: the first step moves with it, no seam', () => {
    const still = springStep(0, 0, 1000, 1 / 60, 0.35);
    const flung = springStep(0, 3000, 1000, 1 / 60, 0.35);
    expect(flung.x).toBeGreaterThan(still.x);
    // Released away from the target it first goes on that way and turns round.
    expect(springStep(500, -2000, 1000, 1 / 60, 0.35).x).toBeLessThan(500);
  });

  it('is slower with a longer response', () => {
    expect(run(0, 0, 1000, 0.45, 0.2).x).toBeLessThan(run(0, 0, 1000, 0.35, 0.2).x);
  });

  it('stays put at its target', () => {
    expect(springStep(1000, 0, 1000, 1 / 60, 0.35)).toEqual({ x: 1000, v: 0 });
  });
});

describe('record dots', () => {
  it('is full on the page and falls to nothing a page away', () => {
    expect([0, 1, 2].map(i => dotWeight(1, i, 3))).toEqual([0, 1, 0]);
  });

  it('moves over continuously with the strip', () => {
    expect(dotWeight(1.25, 1, 3)).toBeCloseTo(0.75);
    expect(dotWeight(1.25, 2, 3)).toBeCloseTo(0.25);
    expect(dotWeight(1.25, 0, 3)).toBe(0);
  });

  it('hands the last dot over to the first while the strip runs on to the copy of the first page', () => {
    expect(dotWeight(2.5, 2, 3)).toBeCloseTo(0.5);
    expect(dotWeight(2.5, 0, 3)).toBeCloseTo(0.5);
    expect(dotWeight(3, 0, 3)).toBe(1);
    expect(dotWeight(3, 2, 3)).toBe(0);
  });
});

describe('record rotation', () => {
  it('goes to the next page and wraps from the last to the first as one slide on', () => {
    expect(nextPage(0, 3)).toEqual({ page: 1, wrap: false });
    expect(nextPage(1, 3)).toEqual({ page: 2, wrap: false });
    expect(nextPage(2, 3)).toEqual({ page: 0, wrap: true });
  });
});

describe('record gesture', () => {
  const W = 1000;
  const at = (strip = { x: 0, moving: false }, n = 4) => gestureDown(idleGesture, { id: 1, x: 500, y: 300, t: 0 }, strip, W, n);
  /** Plays the moves in order (finger x at 8 ms apart) and returns the last result and the gesture. */
  const drag = (g: ReturnType<typeof at>, xs: number[], y = 300, id = 1) => {
    let r = g, t = 0;
    for (const x of xs) { t += 8; r = gestureMove(r.gesture, { id, x, y, t }, W); }
    return { r, t };
  };

  it('holds the strip under the finger 1:1 from where the axis locked', () => {
    const { r } = drag(at(), [495, 480, 440, 400]);
    // Locked at 480 (20 px sideways), the strip then moves with the finger: 80 px more.
    expect(r.move).toEqual({ kind: 'hold', x: 80 });
    expect(r.gesture.touch.phase).toBe('dragging');
  });

  it('is only a tap until the hysteresis: no move, nothing to block', () => {
    const { r } = drag(at(), [495, 492]);
    expect(r.move).toBeNull();
    expect(r.gesture.touch.phase).toBe('pressed');
    expect(r.gesture.block).toBe(false);
  });

  it('says to capture the pointer once, when it locks sideways', () => {
    const first = drag(at(), [480]).r;
    expect(first.locked).toBe(true);
    expect(gestureMove(first.gesture, { id: 1, x: 460, y: 300, t: 40 }, W).locked).toBe(false);
  });

  it('ignores a second pointer while one is down: it neither moves, ends, nor takes over the gesture', () => {
    const down = at();
    const second = gestureDown(down.gesture, { id: 2, x: 100, y: 100, t: 5 }, { x: 0, moving: false }, W, 4);
    expect(second.gesture).toBe(down.gesture);
    const moved = drag(down, [480, 440]).r;
    expect(gestureMove(moved.gesture, { id: 2, x: 900, y: 300, t: 60 }, W).move).toBeNull();
    expect(gestureEnd(moved.gesture, { id: 2, x: 900, y: 300, t: 60 }, W).gesture).toBe(moved.gesture);
    // The first pointer still ends the gesture, which goes idle (so the tiles take taps again).
    expect(gestureEnd(moved.gesture, { id: 1, x: 440, y: 300, t: 70 }, W).gesture.touch.phase).toBe('idle');
  });

  it('ends the gesture on a cancel like on a release: the strip runs on, the touch is idle', () => {
    const { r, t } = drag(at(), [480, 400, 300]);
    const end = gestureEnd(r.gesture, { id: 1, x: 300, y: 300, t: t + 4 }, W);
    expect(end.gesture.touch.phase).toBe('idle');
    expect(end.move).toMatchObject({ kind: 'spring', to: 1 });
  });

  it('lets a fast drag run on to the next page, and a slow short one back', () => {
    const fast = drag(at(), [480, 450, 420, 390]);
    expect(gestureEnd(fast.r.gesture, { id: 1, x: 380, y: 300, t: fast.t + 8 }, W).move).toMatchObject({ kind: 'spring', to: 1 });
    const slow = drag(at(), [480, 470, 460]);
    expect(gestureEnd(slow.r.gesture, { id: 1, x: 460, y: 300, t: slow.t + 400 }, W).move).toEqual({ kind: 'spring', to: 0, v: 0 });
  });

  it('catches a moving strip where it is: stop, held, and the click after it is blocked', () => {
    const d = at({ x: 420, moving: true });
    expect(d.move).toEqual({ kind: 'stop' });
    expect(d.gesture.block).toBe(true);
    // Let go without moving: on to the page it is nearest to, no tap.
    expect(gestureEnd(d.gesture, { id: 1, x: 500, y: 300, t: 50 }, W).move).toEqual({ kind: 'spring', to: 0, v: 0 });
    expect(gestureEnd(at({ x: 600, moving: true }).gesture, { id: 1, x: 500, y: 300, t: 50 }, W).move).toEqual({ kind: 'spring', to: 1, v: 0 });
  });

  it('does not catch a strip at rest, and a tap leaves the click free', () => {
    const d = at();
    expect(d.move).toBeNull();
    expect(d.gesture.block).toBe(false);
    const up = gestureEnd(d.gesture, { id: 1, x: 500, y: 300, t: 40 }, W);
    expect(up.move).toBeNull();
    expect(up.gesture.touch.phase).toBe('idle');
    expect(gestureClick(up.gesture).blocked).toBe(false);
  });

  it('ends a vertical move with nothing to drag: idle, strip untouched, click free', () => {
    const { r } = drag(at(), [500, 500, 500], 340);
    expect(r.gesture.touch).toMatchObject({ phase: 'pressed', axis: 'y' });
    const up = gestureEnd(r.gesture, { id: 1, x: 500, y: 340, t: 60 }, W);
    expect(up.move).toBeNull();
    expect(up.gesture.touch.phase).toBe('idle');
    expect(gestureClick(up.gesture).blocked).toBe(false);
  });

  it('blocks the click that follows a drag once, with no timer, and the next down frees it', () => {
    const { r, t } = drag(at(), [480, 400]);
    const up = gestureEnd(r.gesture, { id: 1, x: 400, y: 300, t }, W);
    expect(up.gesture.block).toBe(true);
    const c = gestureClick(up.gesture);
    expect(c.blocked).toBe(true);
    expect(gestureClick(c.gesture).blocked).toBe(false);
    // A drag that gets no click at all: the next press clears the block.
    expect(gestureDown(up.gesture, { id: 3, x: 5, y: 5, t: 900 }, { x: 0, moving: false }, W, 4).gesture.block).toBe(false);
  });

  it('holds the strip past the ends with the rubber band and starts a caught one beyond the last page from the copy', () => {
    expect(drag(at(), [520, 700]).r.move).toEqual({ kind: 'hold', x: -rubberBand(180, W) });
    const copy = at({ x: 3900, moving: true });
    expect(copy.gesture.touch).toMatchObject({ max: 4000, from: 4 });
    expect(at({ x: 2900, moving: true }).gesture.touch).toMatchObject({ max: 3000, from: 3 });
  });

  it('ignores presses with one page only, and with a mouse button that is not the main one', () => {
    expect(at({ x: 0, moving: false }, 1).gesture).toBe(idleGesture);
    expect(gestureDown(idleGesture, { id: 1, x: 5, y: 5, t: 0, mouse: true, button: 2 }, { x: 0, moving: false }, W, 4).gesture).toBe(idleGesture);
    expect(gestureDown(idleGesture, { id: 1, x: 5, y: 5, t: 0, mouse: true, button: 0 }, { x: 0, moving: false }, W, 4).gesture.touch.phase).toBe('pressed');
  });
});
