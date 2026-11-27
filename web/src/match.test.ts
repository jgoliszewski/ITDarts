import { describe, expect, it } from 'vitest';
import { parseDart } from '../../games/darts.ts';
import type { MiniMatch, X01Match } from './match.ts';
import { lineupBlock, shuffled, throwOrder, aimHint, controls, dartTone, heroCorner, initialsOf, cricketHeaders, presetFor, rematchLabel, removeIntro, turnHead, startLabel, turnPanel, visitScored, x01Dead } from './match.ts';
import type { ClientState, LiveMatch } from '../../server/protocol.ts';

// Bug reports: ATC and Cricket darts on the main screen were orange, the summary showed green and red.
describe('minigame dart tile colour', () => {
  const tone = (game: string, good: boolean) => dartTone({ game } as MiniMatch, good);

  it('shows hits green and misses red in games counted in hits', () => {
    for (const game of ['atc', 'cricket', 'fullboard', 'shanghai', 'bobs27', 'football', 'hare']) {
      expect(tone(game, true)).toBe('hit');
      expect(tone(game, false)).toBe('miss');
    }
  });

  it('colours Bullseye darts by their points: a gain green, −1 red, 0 grey', () => {
    const t = (s: string, coords?: { x: number; y: number }) => dartTone({ game: 'bullseye' } as MiniMatch, false, { dart: parseDart(s)!, coords, at: 0 });
    expect([t('Bull'), t('25'), t('S20'), t('S20', { x: 0.9, y: 0 }), t('T20'), t('Miss')]).toEqual(['hit', 'hit', 'dead', 'miss', 'miss', 'miss']);
  });

  it('dims darts that did nothing in scoring games', () => {
    for (const game of ['hol', '121', 'catch40', 'randomco', 'gotcha', 'knockout']) {
      expect(tone(game, true)).toBe('');
      expect(tone(game, false)).toBe('dead');
    }
  });
});

describe('Finish in Free throw', () => {
  const st = (game: string, phase: string, takeout = false) =>
    ({ match: { game, intro: false, bullTakeout: false, options: {}, view: { phase, visit: { darts: [], dartsLeft: 3 } } }, board: { connected: true, takeout: { active: takeout } } }) as unknown as ClientState;

  it('shows while throwing, also during the takeout, and only in Free throw', () => {
    expect(controls(st('freethrow', 'throwing')).finish).toBe(true);
    expect(controls(st('freethrow', 'throwing', true)).finish).toBe(true);
    expect(controls(st('freethrow', 'matchWon')).finish).toBe(false);
    expect(controls(st('randomco', 'throwing')).finish).toBe(false);
  });
});

// Variant D (DECISIONS.md): the hero's corner pill only for "Checked out" and "Needs a double to start"; a bust shows as BUST.
describe('X01 hero corner', () => {
  const x = (visit: object, checkedIn = true) => ({ game: 'x01', view: { current: 0, checkedIn: [checkedIn], visit: { bust: false, checkout: false, ...visit } } }) as unknown as X01Match;

  it('shows a checkout in green', () => {
    expect(heroCorner(x({ checkout: true }))).toEqual({ text: 'Checked out', tone: 'good' });
  });

  it('asks for a double in amber until the player is in', () => {
    expect(heroCorner(x({}, false))).toEqual({ text: 'Needs a double to start', tone: 'warn' });
  });

  it('shows nothing for a bust (the big BUST says it) or a plain visit', () => {
    expect(heroCorner(x({ bust: true }, false))).toBeNull();
    expect(heroCorner(x({}))).toBeNull();
  });
});

describe('visit total', () => {
  const d = (s: string) => ({ dart: parseDart(s)!, at: 0 });
  const mini = (game: string, view: object) => ({ game, view: { visit: { darts: [d('T20'), d('S5'), d('S1')], good: [true, false, true] }, ...view } }) as unknown as LiveMatch;

  it('is the X01 visit total, 0 after a bust', () => {
    expect(visitScored({ game: 'x01', view: { visit: { total: 85, bust: false } } } as unknown as LiveMatch)).toBe(85);
    expect(visitScored({ game: 'x01', view: { visit: { total: 85, bust: true } } } as unknown as LiveMatch)).toBe(0);
  });

  it('counts only the darts that scored in 121, Random Checkouts and Gotcha', () => {
    for (const game of ['121', 'catch40', 'randomco', 'gotcha']) expect(visitScored(mini(game, {}))).toBe(61);
  });

  it('takes the game\'s own number elsewhere, and none in games counted in hits', () => {
    expect(visitScored(mini('knockout', { visitScore: 66 }))).toBe(66);
    expect(visitScored(mini('freethrow', { visitTotal: 70 }))).toBe(70);
    expect(visitScored(mini('hol', { sum: 41 }))).toBe(41);
    expect(visitScored(mini('atc', {}))).toBeNull();
    expect(visitScored(mini('hare', {}))).toBeNull();
  });
});

describe('hero with a This turn panel', () => {
  it('is X01 and the minigames that score a visit without a board', () => {
    for (const game of ['x01', '121', 'catch40', 'randomco', 'gotcha', 'knockout']) expect(turnPanel({ game } as LiveMatch)).toBe(true);
    for (const game of ['hol', 'atc', 'cricket', 'killer', 'shanghai', 'freethrow', 'football', 'bullseye', 'hare']) expect(turnPanel({ game } as LiveMatch)).toBe(false);
  });
});

describe('Hare and Hounds aim on the phone', () => {
  const hare = (target: string, phase = 'throwing') => ({ game: 'hare', options: { target }, view: { phase, target: 17 } }) as unknown as LiveMatch;

  it('names the sector, with the ring in Doubles and Trebles', () => {
    expect([aimHint(hare('any')), aimHint(hare('doubles')), aimHint(hare('trebles'))]).toEqual(['Throw at 17', 'Throw at the double 17', 'Throw at the treble 17']);
  });

  it('says nothing once the game is over, nor in other games', () => {
    expect(aimHint(hare('any', 'matchWon'))).toBeNull();
    expect(aimHint({ ...hare('any'), game: 'atc' } as unknown as LiveMatch)).toBeNull();
  });
});

describe('Avatar initials', () => {
  it('takes two letters of a one-word name, a guest keeps its number', () => {
    expect(initialsOf(['Anna', 'Bo', 'Ż', 'Guest 2', 'Guest 12'])).toEqual(['AN', 'BO', 'Ż', 'G2', 'G12']);
  });
  it('takes the first letters of the first two words', () => {
    expect(initialsOf(['Kuba G.', 'ola ma kota'])).toEqual(['KG', 'OM']);
  });
  it('lets a later name with the same pair take its next letter', () => {
    expect(initialsOf(['Anna', 'Andrzej'])).toEqual(['AN', 'AD']);
    expect(initialsOf(['Anna', 'Annika'])).toEqual(['AN', 'AI']);
  });
  it('skips letters whose pair is taken too', () => {
    expect(initialsOf(['Anna', 'Annika', 'Ania', 'Anita'])).toEqual(['AN', 'AI', 'AA', 'AT']);
  });
  it('keeps the asked pair when no pair is free', () => {
    expect(initialsOf(['Ola', 'Ol'])).toEqual(['OL', 'OL']);
  });
  it('skips punctuation and keeps whole code points', () => {
    expect(initialsOf(["O'Neil", '.Kuba', '\u{1D49C}nna', '\u{1F600}Bob'])).toEqual(['ON', 'KU', '\u{1D49C}N', 'BO']);
  });
  it('does not depend on the case of the name', () => {
    expect(initialsOf(['anna', 'ANDRZEJ'])).toEqual(['AN', 'AD']);
  });
});

describe('Cricket headers', () => {
  it('shows names up to 4 players until a name overflows, then avatars for all', () => {
    expect(cricketHeaders(3, false)).toBe('names');
    expect(cricketHeaders(3, true)).toBe('avatars');
    expect(cricketHeaders(4, true)).toBe('avatars');
  });
  it('shows numbers with avatars from 5 players, fitting or not', () => {
    expect(cricketHeaders(5, false)).toBe('numbers');
    expect(cricketHeaders(8, true)).toBe('numbers');
  });
});

describe("Bob's 27 visit", () => {
  const b = (delta: number, verdict: { text: string; tone: 'good' | 'bad' } | null = null) => ({ game: 'bobs27', view: { delta, visit: { darts: [], verdict } } }) as unknown as LiveMatch;

  it('scores what the visit gave or cost, with a sign on the phone', () => {
    expect(visitScored(b(20))).toBe(20);
    expect(visitScored(b(-10))).toBe(-10);
    expect(turnHead(b(20))).toEqual({ text: '+20', tone: 'sum' });
    expect(turnHead(b(-10))).toEqual({ text: '−10', tone: 'sum' });
  });

  it('headlines a finished visit with its verdict, going out in red', () => {
    expect(turnHead(b(-10, { text: 'Out', tone: 'bad' }))).toEqual({ text: 'OUT', tone: 'bad' });
  });
});

describe('visit total, more games', () => {
  it('takes Shanghai visit points and treats an empty Higher or Lower sum as 0', () => {
    expect(visitScored({ game: 'shanghai', view: { visitPoints: 42, visit: { darts: [] } } } as unknown as LiveMatch)).toBe(42);
    expect(visitScored({ game: 'hol', view: { sum: null, visit: { darts: [] } } } as unknown as LiveMatch)).toBe(0);
  });
});

// Review t03: with double in, darts before the opening double don't count and are dimmed like a dead dart in 121.
describe('X01 darts that do not count before the double in', () => {
  const d = (s: string) => ({ dart: parseDart(s)!, at: 0 });
  const x = (darts: string[], o: { checkIn?: string; score: number; checkedIn: boolean; total: number }) => ({
    game: 'x01', options: { checkIn: o.checkIn ?? 'double', startScore: 501 },
    view: { current: 0, scores: [o.score], checkedIn: [o.checkedIn], visit: { player: 0, darts: darts.map(d), total: o.total, bust: false } },
  }) as unknown as X01Match;

  it('dims every dart while the player is not in', () => {
    expect(x01Dead(x(['S20', 'T5'], { score: 501, checkedIn: false, total: 0 }))).toEqual([true, true]);
  });

  it('counts the opening double and the darts after it', () => {
    expect(x01Dead(x(['S20', 'D10', 'S5'], { score: 476, checkedIn: true, total: 25 }))).toEqual([true, false, false]);
  });

  it('dims nothing once the player was in before the visit, or with a straight in', () => {
    expect(x01Dead(x(['S20', 'T5'], { score: 300, checkedIn: true, total: 35 }))).toEqual([false, false]);
    expect(x01Dead(x(['S20', 'T5'], { checkIn: 'straight', score: 466, checkedIn: true, total: 35 }))).toEqual([false, false]);
  });
});

// B#13 and B#4 (lobby and setup audit): a rematch of many players doesn't list them all; Start says what starts.
describe('lobby and setup labels', () => {
  it('names up to three players in a rematch, then counts them', () => {
    expect(rematchLabel(['Anna'])).toBe('Rematch Anna');
    expect(rematchLabel(['Anna', 'Bob', 'Cy'])).toBe('Rematch Anna vs Bob vs Cy');
    expect(rematchLabel(['Anna', 'Bob', 'Cy', 'Dee'])).toBe('Rematch');
  });

  it('says the game and the players on the start button', () => {
    expect(startLabel('Killer', 2)).toBe('Start · Killer · 2 players');
    expect(startLabel('Free throw', 1)).toBe('Start · Free throw · 1 player');
  });
});

// Review t04: a record's game must not stick to a later New match after control was lost or the setup was left.
describe('setup preset from a lobby record', () => {
  const rec = { game: 'atc' as const, options: { order: 'random' } };
  it('lives only while the setup is open for the pilot', () => {
    expect(presetFor(rec, 'setup')).toBe(rec);
    expect(presetFor(rec, 'main')).toBeNull();
    expect(presetFor(rec, 'players')).toBeNull();
    expect(presetFor(null, 'setup')).toBeNull();
  });

  it('is gone for the next New match once the pilot left the setup (lost control sends the screen to main)', () => {
    let preset: typeof rec | null = rec;
    preset = presetFor(preset, 'setup'); // the tile opened the setup
    preset = presetFor(preset, 'main'); // a phone took control, the kiosk went back to the main screen
    expect(presetFor(preset, 'setup')).toBeNull(); // New match later: the last game, not the record's
  });
});

describe('remove dialog line (B#8)', () => {
  it('names the ways out the pilot has', () => {
    expect(removeIntro(true, true, null)).toBe('Out for this leg only, or for the rest of the match.');
    expect(removeIntro(false, true, null)).toBe('Out for the rest of the match.');
    expect(removeIntro(true, false, 'Only two would be left')).toBe('Out for this leg only.');
  });

  it('says why when there is no way out', () => {
    expect(removeIntro(false, false, 'Only two would be left: end the match instead')).toBe('Only two would be left: end the match instead');
  });
});

// B#17 and the turn card (docs/UI.md, Tura i takeout): the phone's This turn line says what the scoreboard says.
describe('phone This turn line', () => {
  const d = (s: string) => ({ dart: parseDart(s)!, at: 0 });
  const mini = (game: string, view: object, good = [true, false, true], verdict: object | null = null) =>
    ({ game, view: { visit: { darts: [d('T20'), d('S5'), d('S1')], good, verdict }, ...view } }) as unknown as LiveMatch;

  it('shows the X01 visit total as the turn sum, BUST in red after a bust', () => {
    expect(turnHead({ game: 'x01', view: { visit: { total: 85, bust: false } } } as unknown as LiveMatch)).toEqual({ text: '85', tone: 'sum' });
    expect(turnHead({ game: 'x01', view: { visit: { total: 85, bust: true } } } as unknown as LiveMatch)).toEqual({ text: 'BUST', tone: 'bad' });
  });

  it('shows what the visit scored in scoring minigames, with a sign in Bullseye', () => {
    expect(turnHead(mini('121', {}))).toEqual({ text: '61', tone: 'sum' });
    expect(turnHead(mini('hol', { sum: 41 }))).toEqual({ text: '41', tone: 'sum' });
    expect(turnHead(mini('bullseye', { visitPoints: -2 }))).toEqual({ text: '−2', tone: 'sum' });
  });

  it('counts hits, or marks in Cricket, in games counted in hits', () => {
    expect(turnHead(mini('atc', {}))).toEqual({ text: '2 hits', tone: 'count' });
    expect(turnHead(mini('atc', {}, [false, true, false]))).toEqual({ text: '1 hit', tone: 'count' });
    expect(turnHead(mini('atc', {}, [false, false, false]))).toEqual({ text: '0 hits', tone: 'count' });
    expect(turnHead(mini('cricket', { visitMarks: 4 }))).toEqual({ text: '4 marks', tone: 'count' });
  });

  it("shows the finished visit's verdict in its colour", () => {
    expect(turnHead(mini('killer', {}, [false, false, false], { text: 'Life lost', tone: 'bad' }))).toEqual({ text: 'LIFE LOST', tone: 'bad' });
    expect(turnHead(mini('121', {}, [true, true, true], { text: 'Checkout', tone: 'good' }))).toEqual({ text: 'CHECKOUT', tone: 'good' });
  });
});

describe('New match: lineup and Random order', () => {
  const solo = { minPlayers: 1, maxPlayers: 1 };
  const two = { minPlayers: 2, maxPlayers: 2 };
  const many = { minPlayers: 2, maxPlayers: undefined };
  it('asks for players first, then names the lineup the game needs', () => {
    expect(lineupBlock(two, 0)).toBe('Pick players');
    expect(lineupBlock(two, 3)).toBe('2 players');
    expect(lineupBlock(solo, 2)).toBe('Solo only');
    expect(lineupBlock(many, 1)).toBe('2+ players');
  });
  it('lets a fitting lineup through', () => {
    expect(lineupBlock(two, 2)).toBeNull();
    expect(lineupBlock(solo, 1)).toBeNull();
    expect(lineupBlock(many, 8)).toBeNull();
  });
  it('draws the order for Random with 2+ players only; Closest, PDC and solo keep it', () => {
    const a = ['a', 'b', 'c'];
    expect(throwOrder(a, 'off', () => 0)).toEqual(['b', 'c', 'a']);
    expect(throwOrder(a, 'closest', () => 0)).toBe(a);
    expect(throwOrder(a, 'pdc', () => 0)).toBe(a);
    expect(throwOrder(['a'], 'off', () => 0)).toEqual(['a']);
    expect(throwOrder([], 'off', () => 0)).toEqual([]);
  });
  it('shuffles into a permutation without touching the input', () => {
    const a = [1, 2, 3, 4, 5];
    const r = shuffled(a, () => 0);
    expect(a).toEqual([1, 2, 3, 4, 5]);
    expect([...r].sort()).toEqual(a);
    expect(r).not.toEqual(a);
    expect(shuffled([], () => 0)).toEqual([]);
  });
});
