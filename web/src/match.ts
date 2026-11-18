// What the pilot can do right now, shared by the laptop bar and the phone pilot.
import { value } from '../../games/darts.ts';
import { dartPoints } from '../../games/bullseye.ts';
import { signed } from '../../games/turns.ts';
import { holValue } from '../../games/hol.ts';
import type { DartRec } from '../../games/x01/engine.ts';
import type { ClientState, Command, LiveMatch } from '../../server/protocol.ts';

export type X01Match = Extract<LiveMatch, { game: 'x01' }>;
export type MiniMatch = Exclude<LiveMatch, { game: 'x01' }>;

export const isX01 = (m: LiveMatch): m is X01Match => m.game === 'x01';

/** Note on a removed player's row (docs/UI.md#wycofanie-gracza), or null. */
export const removedNote = (m: LiveMatch, i: number): string | null =>
  m.view.removed[i] === 'match' ? 'Left' : m.view.removed[i] === 'leg' ? 'Back next leg' : null;

/** Props that make a player row open the removal dialog; only the pilot gets them. */
export const pickProps = (onPick: ((i: number) => void) | undefined, i: number, name: string) =>
  onPick ? { role: 'button', tabIndex: 0, 'aria-label': `${name}: remove`, onClick: () => onPick(i), onKeyDown: (e: { key: string }) => e.key === 'Enter' && onPick(i) } : {};

/** Players in the playing order (from the bull-off or the pilot's pick); setup order until it is known. */
export const playOrder = (m: LiveMatch): number[] => m.view.order ?? m.roster.map((_, i) => i);

export interface Controls {
  hint: string;
  primary: { label: string; cmd: Command } | null;
  /** “End match” next to “Next leg” when match mode is off. */
  endInstead: boolean;
  /** “Finish” in Free throw: ends the game with Save, no question (docs/GRY.md#free-throw). */
  finish: boolean;
  canUndo: boolean;
}

export function controls(s: ClientState): Controls {
  const c = baseControls(s);
  return { ...c, finish: s.match?.game === 'freethrow' && s.match.view.phase === 'throwing' && !s.match.intro };
}

function baseControls(s: ClientState): Omit<Controls, 'finish'> {
  const m = s.match;
  if (!m) return { hint: '', primary: null, endInstead: false, canUndo: false };
  const v = m.view;
  const off = isX01(m) && m.options.matchMode.kind === 'off';
  const takeout = s.board.takeout.active;
  if (m.intro) return { hint: 'Record screen', primary: { label: 'Skip', cmd: { type: 'skipIntro' } }, endInstead: false, canUndo: false };
  if (m.bullTakeout) return { hint: 'Take out the bull-off dart', primary: { label: 'Takeout done', cmd: { type: 'next' } }, endInstead: false, canUndo: true };
  switch (v.phase) {
    case 'bulloff':
      return { hint: 'Bull-off: one dart each at the bull', primary: null, endInstead: false, canUndo: !!v.bullOff?.throws.length };
    case 'matchWon':
      // Random Checkouts ends only by End match: an undo there takes the end back and play goes on.
      return { hint: m.game === 'randomco' || m.game === 'freethrow' ? 'Game over. Undo plays on.' : `${isX01(m) ? 'Match' : 'Game'} over. Undo fixes the last dart.`, primary: null, endInstead: false, canUndo: true };
    case 'legWon':
      if (takeout) return { hint: 'Board stuck? End the takeout by hand', primary: { label: 'Takeout done', cmd: { type: 'next' } }, endInstead: false, canUndo: true };
      return off
        ? { hint: 'Match mode is off', primary: { label: 'Next leg', cmd: { type: 'nextLeg' } }, endInstead: true, canUndo: true }
        : { hint: 'Next leg starts after the takeout', primary: { label: 'Next leg', cmd: { type: 'next' } }, endInstead: false, canUndo: true };
    case 'throwing': {
      if (takeout) return { hint: 'Board stuck? End the takeout by hand', primary: { label: 'Takeout done', cmd: { type: 'next' } }, endInstead: false, canUndo: true };
      const bust = isX01(m) && m.view.visit.bust;
      const hint = !s.board.connected ? 'Board offline: tap a dart to enter it'
        : bust ? 'Bust. Next player once the darts are out'
        : v.visit.darts.length ? 'Tap a dart to fix it before pulling them out'
        : 'Throw, or tap an empty dart to add it by hand';
      return { hint, primary: { label: 'Next player', cmd: { type: 'next' } }, endInstead: false, canUndo: true };
    }
  }
}

/** Is ending now the normal end of the match (no save/discard question)? */
export const endsNormally = (m: LiveMatch) =>
  m.view.phase === 'matchWon' || (isX01(m) && m.view.phase === 'legWon' && m.options.matchMode.kind === 'off');

/** Points a dart shows on its tile; in Higher or Lower T1 is worth zero, in Bullseye the dart's points (+2 … −1). */
export const dartValue = (m: LiveMatch, rec: DartRec): string | number =>
  m.game === 'bullseye' ? signed(dartPoints(rec), true) : m.game === 'hol' ? holValue(rec.dart) : value(rec.dart);

/**
 * Tile colour for a minigame dart: games counted in hits show green or red; scoring games dim the darts that did nothing.
 * Bullseye colours by the dart's points: green for a gain, red for −1, grey for 0.
 */
export const dartTone = (m: MiniMatch, good: boolean, rec?: DartRec): 'hit' | 'miss' | '' | 'dead' =>
  m.game === 'bullseye' && rec ? (dartPoints(rec) > 0 ? 'hit' : dartPoints(rec) < 0 ? 'miss' : 'dead')
  : m.game === 'hol' || m.game === '121' || m.game === 'randomco' || m.game === 'gotcha' || m.game === 'knockout' || m.game === 'freethrow' ? (good ? '' : 'dead') : good ? 'hit' : 'miss';

/** Pips for legs won toward the current set or match, or null when there is no target. */
export function legTarget(m: X01Match): number | null {
  const mm = m.options.matchMode;
  if (mm.kind === 'legs') return mm.firstTo <= 7 ? mm.firstTo : null;
  if (mm.kind === 'sets') return mm.legsPerSet <= 7 ? mm.legsPerSet : null;
  return null;
}

export function shortDescription(m: LiveMatch): string {
  if (!isX01(m)) return m.description;
  const mm = m.options.matchMode;
  const target = mm.kind === 'legs' ? `First to ${mm.firstTo}` : mm.kind === 'sets' ? `Set ${m.view.set} · First to ${mm.firstTo} sets` : 'Match mode off';
  return `${m.options.startScore} · Leg ${m.view.legNo} · ${target}`;
}

/** Names of the winners, for end screens. */
export function winnersOf(m: MiniMatch): string {
  const names = m.view.winners.map(i => m.roster[i].name);
  return names.length ? names.join(' & ') : m.roster.length > 1 ? 'Team' : m.roster[0].name;
}

/**
 * The X01 hero's corner pill (variant D, DECISIONS.md): green once checked out, amber while a double is needed to start.
 * A bust has no pill: the big BUST next to the score says it.
 */
export function heroCorner(m: X01Match): { text: string; tone: 'good' | 'warn' } | null {
  const v = m.view;
  if (v.visit.bust) return null;
  if (v.visit.checkout) return { text: 'Checked out', tone: 'good' };
  return v.checkedIn[v.current] ? null : { text: 'Needs a double to start', tone: 'warn' };
}

/** What the visit scored, for the hero's This turn and the turn card; null in games counted in hits or marks. */
export function visitScored(m: LiveMatch): number | null {
  if (isX01(m)) return m.view.visit.bust ? 0 : m.view.visit.total;
  switch (m.game) {
    case 'hol': return m.view.sum ?? 0;
    case 'shanghai': return m.view.visitPoints;
    case 'knockout': return m.view.visitScore;
    case 'freethrow': return m.view.visitTotal;
    case '121': case 'randomco': case 'gotcha':
      return m.view.visit.darts.reduce((a, d, i) => a + (m.view.visit.good[i] ? value(d.dart) : 0), 0);
    default: return null;
  }
}

/**
 * The phone's This turn line (B#17), like the turn card on the scoreboard: the visit's total in orange (`sum`), BUST or the
 * finished visit's verdict in its colour, and in games counted in hits how many so far (marks in Cricket).
 */
export function turnHead(m: LiveMatch): { text: string; tone: 'sum' | 'count' | 'good' | 'bad' } {
  if (isX01(m)) return m.view.visit.bust ? { text: 'BUST', tone: 'bad' } : { text: String(m.view.visit.total), tone: 'sum' };
  if (m.view.visit.verdict) return { text: m.view.visit.verdict.text.toUpperCase(), tone: m.view.visit.verdict.tone };
  if (m.game === 'bullseye') return { text: signed(m.view.visitPoints, true), tone: 'sum' };
  const scored = visitScored(m);
  if (scored !== null) return { text: String(scored), tone: 'sum' };
  const [n, unit] = m.game === 'cricket' ? [m.view.visitMarks, 'mark'] : [m.view.visit.good.filter(Boolean).length, 'hit'];
  return { text: `${n} ${unit}${n === 1 ? '' : 's'}`, tone: 'count' };
}

/** Games whose hero has the right half with This turn and the route or the score to beat (variant D); the rest keep their own. */
export const turnPanel = (m: LiveMatch): boolean =>
  m.game === 'x01' || m.game === '121' || m.game === 'randomco' || m.game === 'gotcha' || m.game === 'knockout';

/** Cricket from 5 players: two letters for a column, a guest keeps its number (Guest 2 → G2); the number of the place tells them apart. */
export const initials = (name: string): string => (/\d/.test(name) ? name[0] + name.replace(/\D/g, '') : name.slice(0, 2).toUpperCase());

/**
 * X01 with double in: darts before the opening double don't count, so their tiles are dimmed like a dead dart in 121.
 * The player was already in at the visit's start when they are in now and their score had left the start before it.
 */
export function x01Dead(m: X01Match): boolean[] {
  const v = m.view;
  const darts = v.visit.darts;
  const p = v.visit.player;
  if (m.options.checkIn === 'straight') return darts.map(() => false);
  let inn = v.checkedIn[p] && v.scores[p] + (v.visit.bust ? 0 : v.visit.total) !== m.options.startScore;
  return darts.map(d => {
    if (!inn && d.dart.m === 2 && d.dart.n > 0) inn = true;
    return !inn;
  });
}

/**
 * The line under "Remove Bob?" (B#8): which ways out there are, or why there is none (`blocked`, from removeBlock).
 */
export function removeIntro(canLeg: boolean, canMatch: boolean, blocked: string | null): string {
  if (canLeg && canMatch) return 'Out for this leg only, or for the rest of the match.';
  if (canLeg) return 'Out for this leg only.';
  if (canMatch) return 'Out for the rest of the match.';
  return blocked ?? '';
}

/** The lobby's rematch button: up to three names, then only how many (B#13). */
export const rematchLabel = (names: string[]): string => (names.length <= 3 ? `Rematch ${names.join(' vs ')}` : `Rematch · ${names.length} players`);

/** Setup's start button says what starts (B#4). */
export const startLabel = (game: string, players: number): string => `Start · ${game} · ${players} ${players === 1 ? 'player' : 'players'}`;

/**
 * A lobby record's game and options for New match (D6) last only while the pilot has the setup open: any other screen
 * (setup closed, control lost, which sends the screen to main) drops them, so a later New match opens the last game.
 */
export const presetFor = <T>(preset: T | null, screen: string): T | null => (screen === 'setup' ? preset : null);
