// What the pilot can do right now, shared by the laptop bar and the phone pilot.
import type { Dart } from '../../games/darts.ts';
import { value } from '../../games/darts.ts';
import { holValue } from '../../games/hol.ts';
import type { ClientState, Command, LiveMatch } from '../../server/protocol.ts';

export type X01Match = Extract<LiveMatch, { game: 'x01' }>;
export type MiniMatch = Exclude<LiveMatch, { game: 'x01' }>;

export const isX01 = (m: LiveMatch): m is X01Match => m.game === 'x01';

export interface Controls {
  hint: string;
  primary: { label: string; cmd: Command } | null;
  /** “End match” next to “Next leg” when match mode is off. */
  endInstead: boolean;
  canUndo: boolean;
}

export function controls(s: ClientState): Controls {
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
      return { hint: `${isX01(m) ? 'Match' : 'Game'} over. Undo fixes the last dart.`, primary: null, endInstead: false, canUndo: true };
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

export const visitDarts = (m: LiveMatch): Dart[] => m.view.visit.darts.map(d => d.dart);

/** Points a dart shows on its tile; in Higher or Lower T1 is worth zero. */
export const dartValue = (m: LiveMatch, d: Dart): number => (m.game === 'hol' ? holValue(d) : value(d));

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
 * Hit or miss sound for a new dart (docs/EFEKTY.md, Wbudowane dźwięki). `before` is how many darts the visit on screen had.
 * ATC, Full Board and Cricket sound every dart; Higher or Lower sounds once, when the visit is decided. Other games stay silent.
 */
export function dartCue(m: LiveMatch, before: number): 'hit' | 'miss' | null {
  if (isX01(m) || m.view.phase === 'bulloff') return null;
  const v = m.view.visit;
  if (v.darts.length !== before + 1) return null;
  if (m.game === 'atc' || m.game === 'fullboard' || m.game === 'cricket') return v.good.at(-1) ? 'hit' : 'miss';
  if (m.game === 'hol' && v.dartsLeft === 0) return v.verdict?.tone === 'bad' ? 'miss' : 'hit';
  return null;
}
