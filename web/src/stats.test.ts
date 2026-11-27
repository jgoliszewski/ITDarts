import { describe, expect, it } from 'vitest';
import type { X01Stats } from '../../games/x01/stats.ts';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { pick } from './useJson.ts';
import { GAMES } from '../../games/index.ts';
import { TrendChart } from './components/StatParts.tsx';
import { fill, gameCompareRows, gameRows, gameStats, playerColor, x01CompareRows, x01Rows } from './components/Compare.tsx';
import { X01_METRICS, x01Delta, MIN_TREND, chartScale, delta, doubleName, METRICS, percent, perMatch, previousLabel, profileMetrics, sharedBestLeg, versusAverage, visitShare, noTrendNote, windowLabel, windowPhrase, windowsShown, winTile } from './stats.ts';
import type { GameStatsResponse, PlayerStatsResponse } from '../../server/protocol.ts';

describe('delta', () => {
  it('is green when the figure moved the better way and red when it did not', () => {
    expect(delta(52.4, 50, 'higher')).toEqual({ text: '▲ 2.4', tone: 'good' });
    expect(delta(48.7, 50, 'higher')).toEqual({ text: '▼ 1.3', tone: 'bad' });
  });
  it('turns the colours round when less is better', () => {
    expect(delta(10, 12.5, 'lower')).toEqual({ text: '▼ 2.5', tone: 'good' });
    expect(delta(14, 12.5, 'lower')).toEqual({ text: '▲ 1.5', tone: 'bad' });
  });
  it('has no colour for no change, also when the difference only shows below the decimals', () => {
    expect(delta(50, 50, 'higher')).toEqual({ text: '= 0.0', tone: 'flat' });
    expect(delta(50.04, 50, 'higher')).toEqual({ text: '= 0.0', tone: 'flat' });
    expect(delta(1.234, 1.236, 'higher', 2)).toEqual({ text: '= 0.00', tone: 'flat' });
  });
  it('is missing when either side is', () => {
    expect(delta(50, null, 'higher')).toBeNull();
    expect(delta(null, 50, 'higher')).toBeNull();
    expect(delta(50, undefined, 'higher')).toBeNull();
    expect(delta(0, 0, 'higher')).toEqual({ text: '= 0.0', tone: 'flat' }); // zero is a value
  });
  it('names the previous Okno', () => {
    expect(previousLabel('30d')).toBe('vs previous 30 days');
    expect(previousLabel('l10')).toBe('vs previous 10 legs');
    expect(previousLabel('l100', 'matches')).toBe('vs previous 100 matches');
    expect(previousLabel('all')).toBe('');
  });
});

describe('shares and averages', () => {
  it('gives a percentage of visits and survives a division by zero', () => {
    expect(percent(1, 3)).toBe(33.3);
    expect(percent(0, 5)).toBe(0);
    expect(percent(undefined, 5)).toBe(0);
    expect(percent(3, 0)).toBeNull();
    expect(visitShare(8, { visits: 185 })).toBe(4.3);
    expect(visitShare(0, { visits: 0 })).toBeNull();
  });
  it('averages a counter over matches', () => {
    expect(perMatch(7, 2)).toBe(3.5);
    expect(perMatch(undefined, 2)).toBe(0);
    expect(perMatch(7, 0)).toBeNull();
  });
});

const x = (bestLegs: X01Stats['bestLegs']) => ({ bestLegs });

describe('Best leg in Compare', () => {
  it('takes the start score the two played most between them', () => {
    // 301: 3 + 1 legs, 201: 2 + 5 legs.
    const r = sharedBestLeg([x([{ startScore: 301, legs: 3, best: 18 }, { startScore: 201, legs: 2, best: 12 }]), x([{ startScore: 201, legs: 5, best: 14 }, { startScore: 301, legs: 1, best: null }])]);
    expect(r).toEqual({ startScore: 201, best: [12, 14] });
  });
  it('takes the higher start score on a tie and null where a player has not played it', () => {
    const r = sharedBestLeg([x([{ startScore: 201, legs: 2, best: 12 }]), x([{ startScore: 301, legs: 2, best: 20 }])]);
    expect(r).toEqual({ startScore: 301, best: [null, 20] });
  });
  it('is null when nobody has played a leg', () => {
    expect(sharedBestLeg([x([]), x([])])).toBeNull();
  });
});

const X: X01Stats = {
  legs: 4, legsWon: 2, darts: 100, visits: 40, busts: 4, bustRate: 10, highestVisit: 140, avg: 50, first9: 55, checkoutPct: 20, checkoutHits: 2,
  checkoutAttempts: 10, highestCheckout: 80, bestLeg: 18, bestLegStart: 301, bestLegs: [{ startScore: 301, legs: 4, best: 18 }], doubles: [], c60: 8, c80: 4, c100: 2,
};

describe('X01 rows', () => {
  const label = (rows: { label: string }[]) => rows.map(r => r.label);

  it('compares frequencies, Bust rate with less as better, and Best leg at the shared start score', () => {
    const rows = x01CompareRows([X, { ...X, bustRate: 5, bestLegs: [{ startScore: 301, legs: 1, best: 22 }], c60: 20 }]);
    expect(label(rows)).toEqual(['Average', 'First 9', 'Checkout %', 'Bust rate', 'Highest visit', 'Highest checkout', 'Best leg · 301', '60+ (% of visits)', '80+ (% of visits)', '100+ (% of visits)', 'Darts']);
    // The profile adds its Winrate between the bands and Darts, which stays at the bottom.
    expect(label(x01CompareRows([X, X], [{ label: 'Winrate', values: ['50%', '50%'] }])).slice(-3)).toEqual(['100+ (% of visits)', 'Winrate', 'Darts']);
    const get = (l: string) => rows.find(r => r.label === l)!;
    expect(get('Bust rate')).toMatchObject({ values: ['10%', '5%'], better: 'lower' });
    expect(get('Best leg · 301')).toMatchObject({ values: ['18', '22'], better: 'lower' });
    expect(get('60+ (% of visits)').values).toEqual(['20%', '50%']);
    expect(get('Darts').better).toBeUndefined();
  });
  it('shows dashes for a player without visits', () => {
    const none: X01Stats = { ...X, visits: 0, bustRate: null, bestLegs: [], bestLeg: null, bestLegStart: null };
    const rows = x01CompareRows([X, none]);
    expect(rows.find(r => r.label === '60+ (% of visits)')!.values).toEqual(['20%', '–']);
    expect(rows.find(r => r.label === 'Best leg · 301')!.values).toEqual(['18', '–']);
    expect(x01CompareRows([none, none]).find(r => r.label.startsWith('Best leg'))!.label).toBe('Best leg');
  });
  it('keeps counts in the match summary, with Bust rate and Highest visit but no Until 170', () => {
    const rows = x01Rows([X]);
    expect(label(rows)).toEqual(['Average', 'First 9', 'Checkout %', 'Bust rate', 'Highest visit', 'Highest checkout', 'Best leg', '60+', '80+', '100+', 'Darts']);
    expect(rows.find(r => r.label === '60+')!.values).toEqual(['8']);
  });
  it('names the double of a bull', () => {
    expect(doubleName(25)).toBe('Bull');
    expect(doubleName(16)).toBe('D16');
  });
});

describe('the figures of each game', () => {
  const tot = (t: Record<string, number>, matches = 1, previous: { matches: number; totals: Record<string, number> } | null = null) => ({ totals: t, matches, previous });

  it('has exactly one headline per game, and the direction in one place', () => {
    for (const [game, ms] of Object.entries(METRICS)) expect(ms!.filter(m => m.main), game).toHaveLength(1);
    expect(METRICS.randomco!.find(m => m.label === 'Darts per checkout')!.better).toBe('lower');
    expect(METRICS.atc!.find(m => m.label === 'Darts')!.better).toBeUndefined();
  });

  it('puts a counter per match with the sum in small print, and the arrow on the headline only', () => {
    const [goals] = profileMetrics('football', tot({ goals: 9 }, 3, { matches: 3, totals: { goals: 6 } }));
    expect(goals).toMatchObject({ label: 'Goals', value: '3.0', sub: '9 in total', main: true, delta: { text: '▲ 1.0', tone: 'good' } });
    const [hit, dart] = profileMetrics('atc', tot({ hits: 5, darts: 20 }, 2, { matches: 3, totals: { hits: 4, darts: 10 } }));
    expect(hit).toMatchObject({ value: '25%', delta: { text: '▼ 15.0 pp', tone: 'bad' } });
    expect(dart).toMatchObject({ value: '20', delta: null });
  });

  it('has no arrow without a previous Okno, and no division by zero', () => {
    expect(profileMetrics('killer', tot({ taken: 4 }, 2))[0].delta).toBeNull();
    const [none] = profileMetrics('killer', tot({}, 0, { matches: 3, totals: { taken: 3 } }));
    expect(none).toMatchObject({ value: '–', delta: null });
    expect(profileMetrics('atc', tot({}))[0].value).toBe('–');
  });

  it('colours Darts per checkout green when it falls', () => {
    const [m] = profileMetrics('randomco', tot({ checkouts: 4, checkoutDarts: 20 }, 2, { matches: 3, totals: { checkouts: 4, checkoutDarts: 28 } }));
    expect(m).toMatchObject({ label: 'Darts per checkout', value: '5.0', delta: { text: '▼ 2.0', tone: 'good' } });
  });

  it('shows Visits survived as a share, or a dash for matches saved before it existed', () => {
    expect(profileMetrics('hol', tot({ visits: 8, survived: 6 }))[0]).toMatchObject({ value: '75%', sub: '6 / 8 visits' });
    expect(profileMetrics('hol', tot({}))[0]).toMatchObject({ value: '–', sub: 'no data yet', delta: null });
  });

  it('gives Free throw an Average, the bands as a share of visits and the highest visit as it is', () => {
    const f = profileMetrics('freethrow', tot({ darts: 9, points: 283, visits: 3, best: 180, v60: 1, v80: 0, v100: 2 }));
    expect(f.map(m => [m.label, m.value])).toEqual([['Average', '94.3'], ['Darts', '9'], ['Highest visit', '180'], ['60+', '33.3%'], ['80+', '0%'], ['100+', '66.7%']]);
    expect(f[3].sub).toBe('1 of 3 visits');
  });

  it('gives Hare and Hounds the hit rate and the wins by role as totals', () => {
    const h = profileMetrics('hare', { ...tot({ darts: 40, hits: 10, hareWins: 2, houndWins: 1 }), matches: 4 });
    expect(h.map(m => [m.label, m.value])).toEqual([['Hit rate', '25%'], ['Wins as hare', '2'], ['Wins as hound', '1'], ['Hits', '10'], ['Darts', '40']]);
  });

  it('gives Catch 40 points per match, checkout % and darts per checkout', () => {
    const c = profileMetrics('catch40', { ...tot({ points: 150, attempts: 80, checkouts: 60, checkoutDarts: 174 }), matches: 2 });
    expect(c.map(m => [m.label, m.value])).toEqual([['Points', '75.0'], ['Checkout %', '75%'], ['Darts per checkout', '2.9']]);
    expect(c[1].sub).toBe('60 / 80 targets');
  });

  it('knows a headline for every game with minigame stats', () => {
    for (const g of ['atc', 'fullboard', 'shanghai', 'cricket', '121', 'randomco', 'knockout', 'killer', 'football', 'gotcha', 'bullseye', 'hol', 'freethrow', 'hare', 'catch40'] as const) {
      expect(METRICS[g]?.some(m => m.main), g).toBe(true);
    }
  });

  it('compares per match, not totals', () => {
    const solo = { played: 1, versus: { played: 0, won: 0, winrate: null } };
    const rows = gameCompareRows('football', [{ totals: { goals: 9 }, matches: 3, ...solo }, { totals: { goals: 4 }, matches: 1, ...solo }]);
    expect(rows[0]).toEqual({ label: 'Goals / match', values: ['3.0', '4.0'], nums: [3, 4], better: 'higher' });
    expect(gameCompareRows('randomco', [{ ...tot({ checkouts: 2, checkoutDarts: 8 }), ...solo }, { ...tot({}), ...solo }])[0]).toMatchObject({ better: 'lower', values: ['4.0', '–'] });
  });

  it('adds Played, and Winrate only when somebody has versus matches', () => {
    const solo = { totals: {}, matches: 1, played: 3, versus: { played: 0, won: 0, winrate: null } };
    const versus = { totals: {}, matches: 1, played: 4, versus: { played: 4, won: 1, winrate: 25 } };
    const labels = (gs: typeof solo[]) => gameCompareRows('football', gs).map(r => r.label);
    expect(labels([solo, solo])).toEqual(['Goals / match', 'Played']);
    const rows = gameCompareRows('football', [solo, versus]);
    expect(rows.map(r => r.label)).toEqual(['Goals / match', 'Played', 'Winrate']);
    expect(rows[2]).toMatchObject({ values: ['–', '25%'], nums: [null, 25], better: 'higher' });
  });

  it('keeps the labels of a match card and the figures of the profile bound, with the same direction', () => {
    // gameStats (the live card and the match summary) and METRICS (the profile and Compare) are two lists tied by label.
    for (const game of Object.keys(GAMES) as (keyof typeof GAMES)[]) {
      if (game === 'x01') continue;
      const labels = gameStats(game, {}).map(([l]) => l);
      for (const l of labels) expect(METRICS[game]?.some(m => m.label === l), `${game}: ${l}`).toBe(true);
      const rows = gameRows(game, [{}]);
      for (const r of rows) expect(r.better, `${game}: ${r.label}`).toBe(METRICS[game]!.find(m => m.label === r.label)!.better);
    }
  });

  it('turns an X01 arrow by the direction of the figure, from the one definition', () => {
    expect(X01_METRICS.bustRate.better).toBe('lower');
    expect(x01Delta('checkoutPct', { ...X, checkoutPct: 25 }, { avg: 50, first9: 55, checkoutPct: 20 })).toEqual({ text: '▲ 5.0 pp', tone: 'good' });
    expect(x01Delta('avg', { ...X, avg: 48 }, { avg: 50, first9: 55, checkoutPct: 20 })).toEqual({ text: '▼ 2.0', tone: 'bad' });
    expect(x01Delta('avg', X, null)).toBeNull();
  });
});

describe('data kept per key', () => {
  it('shows the data only under the key it was fetched for', () => {
    const held = { key: 'x01', data: { x01: {} }, error: false };
    expect(pick(held, 'x01')).toEqual({ data: { x01: {} }, error: false });
    // A screen switched to another game must get nothing, not the old game's response.
    expect(pick(held, 'cricket')).toEqual({ data: null, error: false });
    expect(pick({ key: null, data: null, error: false }, 'x01')).toEqual({ data: null, error: false });
    expect(pick({ key: 'x01', data: null, error: true }, 'x01').error).toBe(true);
    expect(pick({ key: 'x01', data: null, error: true }, 'cricket').error).toBe(false);
  });
});

describe('Checkout % format', () => {
  it('always has one decimal, in Compare and anywhere that uses the definition', () => {
    expect(X01_METRICS.checkoutPct.fmt(8)).toBe('8.0%');
    expect(X01_METRICS.checkoutPct.fmt(33.7)).toBe('33.7%');
    expect(X01_METRICS.checkoutPct.fmt(null)).toBe('–');
    expect(X01_METRICS.checkoutPct.plain(8)).toBe('8.0'); // the profile tile, without the unit
    expect(X01_METRICS.checkoutPct.plain(null)).toBe('–');
    expect(x01CompareRows([{ ...X, checkoutPct: 8 }, { ...X, checkoutPct: 10.1 }]).find(r => r.label === 'Checkout %')!.values).toEqual(['8.0%', '10.1%']);
  });
});

describe('winrate tile', () => {
  it('shows only Played for a game with solo matches only', () => {
    expect(winTile({ played: 5, versus: { played: 0, won: 0, winrate: null } })).toEqual({ label: 'Played', value: '5' });
    expect(winTile({ played: 0, versus: { played: 0, won: 0, winrate: null } })).toEqual({ label: 'Played', value: '0' });
  });
  it('shows the winrate of versus matches, the played total small when solo ones came too', () => {
    expect(winTile({ played: 4, versus: { played: 4, won: 1, winrate: 25 } })).toEqual({ label: 'Winrate', value: '25%', sub: '1 of 4 matches' });
    expect(winTile({ played: 6, versus: { played: 4, won: 1, winrate: 25 } }).sub).toBe('1 of 4 matches · 6 played');
  });
});

describe('Average chart', () => {
  const draw = (points: number[], avg: number | null) => renderToStaticMarkup(createElement(TrendChart, { points, avg }));
  it('draws the dashed line only for the average of the Okno, and nothing below 3 matches', () => {
    expect(draw([50, 40, 30], 45)).toContain('class="mean"');
    expect(draw([50, 40, 30], null)).not.toContain('class="mean"');
    expect(draw([50, 40], 45)).toBe('');
  });
  it('puts the dashed line at the Average of the Okno, not at the mean of the points', () => {
    const points = [50, 40, 30, 60]; // the mean of the points is 45; the Average of the Okno is 52
    const m = draw(points, 52);
    const y1 = Number(/<line[^>]*\sy1="([\d.]+)"[^>]*class="mean"/.exec(m)![1]);
    const { lo, hi } = chartScale([...points, 52]);
    expect(y1).toBeCloseTo(240 - 26 - ((52 - lo) / (hi - lo)) * (240 - 52), 5);
    const meanY = 240 - 26 - ((45 - lo) / (hi - lo)) * (240 - 52);
    expect(Math.abs(y1 - meanY)).toBeGreaterThan(1);
  });
  it('puts the last value under its point when the line comes down to it', () => {
    const num = (m: string, re: RegExp) => Number(re.exec(m)![1]);
    const gap = (m: string) => num(m, /<text[^>]*\sy="([\d.]+)"[^>]*class="last"/) - [...m.matchAll(/cy="([\d.]+)"/g)].map(x => Number(x[1])).at(-1)!;
    const down = gap(draw([50, 60, 40], 50)), up = gap(draw([50, 40, 60], 50));
    expect(down).toBeGreaterThan(0);
    expect(up).toBeLessThan(0);
  });
  it('dates the first, middle and last match under the axis', () => {
    const day = (d: number) => new Date(2026, 10, d, 12).getTime();
    const m = renderToStaticMarkup(createElement(TrendChart, { points: [50, 40, 30, 60, 55], avg: null, dates: [1, 2, 3, 4, 5].map(day) }));
    expect([...m.matchAll(/class="tick">(\d+ Nov)</g)].map(x => x[1])).toEqual(['1 Nov', '3 Nov', '5 Nov']);
    expect(m).toContain('aria-label="Average match by match: 50.0, 40.0, 30.0, 60.0, 55.0"');
  });
  it('needs 3 matches', () => {
    expect(MIN_TREND).toBe(3);
  });
  it('gives whole steps around the data and never a flat axis', () => {
    expect(chartScale([31.2, 48.8])).toEqual({ lo: 30, hi: 50, step: 5 });
    expect(chartScale([30, 30, 30])).toEqual({ lo: 30, hi: 35, step: 5 });
    expect(chartScale([10, 80])).toEqual({ lo: 10, hi: 80, step: 10 });
  });
  it('takes a wider step when one match is far from the rest, so the axis keeps at most 8 steps', () => {
    expect(chartScale([15, 120.6])).toEqual({ lo: 0, hi: 140, step: 20 });
    expect(chartScale([0, 180])).toEqual({ lo: 0, hi: 200, step: 25 });
  });
});

// A#24 (scoreboard audit): the Knockout card said "1 visits".
describe('Knockout visits on the live card', () => {
  it('says one visit in the singular', () => {
    expect(gameStats('knockout', { points: 60, visits: 1 })[0][2]).toBe('1 visit');
    expect(gameStats('knockout', { points: 120, visits: 2 })[0][2]).toBe('2 visits');
    expect(gameStats('knockout', {})[0][2]).toBe('0 visits');
  });
});
describe('bars in the comparison', () => {
  const row = (nums: (number | null)[], better: 'higher' | 'lower' = 'higher') => ({ label: 'x', values: nums.map(String), nums, better });
  it('splits the bar by share, 1/value when less is better', () => {
    expect(fill(row([30, 10]), 0)).toBe(0.75);
    expect(fill(row([10, 30], 'lower'), 0)).toBe(0.75);
  });
  it('has no bar when there is nothing to compare with: one value, or one player', () => {
    expect(fill(row([42, null]), 0)).toBeNull();
    expect(fill(row([42]), 0)).toBeNull();
    expect(fill(row([null, 5, null]), 1)).toBeNull();
    expect(fill(row([0, 0]), 0)).toBe(0);
  });
  it('has no bar for a player without a value or a row without a direction', () => {
    expect(fill(row([null, 5, 7]), 0)).toBeNull();
    expect(fill({ label: 'Darts', values: ['3', '4'], nums: [3, 4] }, 0)).toBeNull();
  });
  it('colours players from the tokens, round after four', () => {
    expect([0, 1, 2, 3, 4].map(playerColor)).toEqual(['var(--p1)', 'var(--p2)', 'var(--p3)', 'var(--p4)', 'var(--p1)']);
  });
});

describe('Okna', () => {
  it('shows the four everyday Okna, all seven once More is open', () => {
    expect(windowsShown(false, '30d')).toEqual(['30d', '90d', 'all', 'l10']);
    expect(windowsShown(true, '30d')).toEqual(['7d', '30d', '90d', '365d', 'all', 'l10', 'l100']);
  });
  it('opens More when the current Okno is one of the hidden ones', () => {
    for (const w of ['7d', '365d', 'l100'] as const) expect(windowsShown(false, w)).toContain(w);
  });
  it('counts matches in minigames and legs in X01', () => {
    expect(windowLabel('l10', 'matches')).toBe('Last 10 matches');
    expect(windowLabel('l100')).toBe('Last 100 legs');
    expect(windowLabel('90d')).toBe('3M');
  });
  it('says why a headline has no trend', () => {
    expect(noTrendNote('all')).toBe('No trend for All time');
    expect(noTrendNote('30d', 'matches')).toBe('No trend · fewer than 3 matches before');
  });
  it('names time Okna in a sentence, not leg Okna or All time', () => {
    expect(windowPhrase('30d')).toBe('the last 30 days');
    expect(windowPhrase('365d')).toBe('the last year');
    expect(windowPhrase('l10')).toBeNull();
    expect(windowPhrase('all')).toBeNull();
  });
});

describe('percentage changes', () => {
  it('move in points', () => {
    expect(delta(22.5, 20, 'higher', 1, 'pp')).toEqual({ text: '▲ 2.5 pp', tone: 'good' });
    expect(delta(20, 20, 'higher', 1, 'pp')).toEqual({ text: '= 0.0 pp', tone: 'flat' });
    expect(x01Delta('checkoutPct', X, { avg: 50, first9: 50, checkoutPct: 25 })).toEqual({ text: '▼ 5.0 pp', tone: 'bad' });
    expect(x01Delta('avg', X, { avg: 48, first9: 50, checkoutPct: 25 })).toEqual({ text: '▲ 2.0', tone: 'good' });
  });
  it('in minigames too, only for percentages', () => {
    const hit = profileMetrics('atc', { totals: { hits: 30, darts: 100 }, matches: 2, previous: { matches: 2, totals: { hits: 20, darts: 100 } } });
    expect(hit[0].delta).toEqual({ text: '▲ 10.0 pp', tone: 'good' });
    const goals = profileMetrics('football', { totals: { goals: 9 }, matches: 3, previous: { matches: 3, totals: { goals: 6 } } });
    expect(goals[0].delta).toEqual({ text: '▲ 1.0', tone: 'good' });
  });
});

describe('solo summary against the average', () => {
  // The Okno already holds the match (saved before the summary), so each fixture adds it to the player's other matches.
  const game = (totals: Record<string, number>, matches: number) => ({ totals, matches }) as GameStatsResponse;
  it('compares the match headline with the average of the other matches in the Okno', () => {
    // Free throw: 3 darts for 90; the other 4 matches 30 darts for 600, 60 per 3 darts.
    expect(versusAverage('freethrow', { totals: { darts: 3, points: 90 } }, game({ darts: 33, points: 690 }, 5))).toEqual({ text: '▲ 30.0', tone: 'good' });
    // Random Checkouts: 5 darts per checkout here, 3 in the other 2 matches; fewer is better.
    expect(versusAverage('randomco', { totals: { checkouts: 2, checkoutDarts: 10 } }, game({ checkouts: 6, checkoutDarts: 22 }, 3))).toEqual({ text: '▲ 2.0', tone: 'bad' });
    // Football: 3 goals here against 6 in the other 3 matches.
    expect(versusAverage('football', { totals: { goals: 3 } }, game({ goals: 9 }, 4))).toEqual({ text: '▲ 1.0', tone: 'good' });
  });
  it('takes the Average in X01, without the match', () => {
    // 45.5 over 30 darts here, 50 over 90 darts before: the Okno says 48.88 over 120 darts.
    const okno = { x01: { ...X, avg: 48.88, darts: 120 } } as PlayerStatsResponse;
    expect(versusAverage('x01', { x01: { ...X, avg: 45.5, darts: 30 } }, okno)).toEqual({ text: '▼ 4.5', tone: 'bad' });
  });
  it('has no line for the first match in the Okno, never “= 0.0”', () => {
    expect(versusAverage('x01', { x01: { ...X, avg: 45.5, darts: 30 } }, { x01: { ...X, avg: 45.5, darts: 30 } } as PlayerStatsResponse)).toBeNull();
    expect(versusAverage('freethrow', { totals: { darts: 3, points: 90 } }, game({ darts: 3, points: 90 }, 1))).toBeNull();
  });
  it('is null without a headline, without the match figure or without an average', () => {
    expect(versusAverage('x01', {}, { x01: X } as PlayerStatsResponse)).toBeNull();
    expect(versusAverage('atc', { totals: { hits: 1, darts: 3 } }, game({}, 0))).toBeNull();
    expect(versusAverage('x01', { x01: X }, game({ darts: 3 }, 1))).toBeNull();
  });
});
