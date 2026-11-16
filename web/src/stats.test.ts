import { describe, expect, it } from 'vitest';
import type { X01Stats } from '../../games/x01/stats.ts';
import { gameCompareRows, x01CompareRows, x01Rows } from './components/Compare.tsx';
import { MIN_TREND, chartScale, delta, doubleName, METRICS, percent, perMatch, previousLabel, profileMetrics, sharedBestLeg, visitShare, winTile } from './stats.ts';

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
    expect(hit).toMatchObject({ value: '25%', delta: { text: '▼ 15.0', tone: 'bad' } });
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

  it('knows a headline for every game with minigame stats', () => {
    for (const g of ['atc', 'fullboard', 'shanghai', 'cricket', '121', 'randomco', 'knockout', 'killer', 'football', 'gotcha', 'bullseye', 'hol', 'freethrow'] as const) {
      expect(METRICS[g]?.some(m => m.main), g).toBe(true);
    }
  });

  it('compares per match, not totals', () => {
    const rows = gameCompareRows('football', [{ totals: { goals: 9 }, matches: 3 }, { totals: { goals: 4 }, matches: 1 }]);
    expect(rows).toEqual([{ label: 'Goals / match', values: ['3.0', '4.0'], nums: [3, 4], better: 'higher' }]);
    expect(gameCompareRows('randomco', [tot({ checkouts: 2, checkoutDarts: 8 }), tot({})])[0]).toMatchObject({ better: 'lower', values: ['4.0', '–'] });
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
  it('needs 3 matches', () => {
    expect(MIN_TREND).toBe(3);
  });
  it('gives whole steps around the data and never a flat axis', () => {
    expect(chartScale([31.2, 48.8])).toEqual({ lo: 30, hi: 50, step: 5 });
    expect(chartScale([30, 30, 30])).toEqual({ lo: 30, hi: 35, step: 5 });
    expect(chartScale([10, 80])).toEqual({ lo: 10, hi: 80, step: 10 });
  });
});
