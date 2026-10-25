// What the pilot can do right now, shared by the laptop bar and the phone pilot.
import type { Dart } from '../../games/darts.ts';
import type { ClientState, Command, LiveMatch } from '../../server/protocol.ts';

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
  const off = m.options.matchMode.kind === 'off';
  const takeout = s.board.takeout.active;
  switch (v.phase) {
    case 'bulloff':
      return { hint: 'Bull-off: pick who throws first', primary: null, endInstead: false, canUndo: false };
    case 'matchWon':
      return { hint: 'Match over. Undo fixes the last dart.', primary: null, endInstead: false, canUndo: true };
    case 'legWon':
      if (takeout) return { hint: 'Board stuck? End the takeout by hand', primary: { label: 'Takeout done', cmd: { type: 'next' } }, endInstead: false, canUndo: true };
      return off
        ? { hint: 'Match mode is off', primary: { label: 'Next leg', cmd: { type: 'nextLeg' } }, endInstead: true, canUndo: true }
        : { hint: 'Next leg starts after the takeout', primary: { label: 'Next leg', cmd: { type: 'next' } }, endInstead: false, canUndo: true };
    case 'throwing': {
      if (takeout) return { hint: 'Board stuck? End the takeout by hand', primary: { label: 'Takeout done', cmd: { type: 'next' } }, endInstead: false, canUndo: true };
      const hint = !s.board.connected ? 'Board offline: tap a dart to enter it'
        : v.visit.bust ? 'Bust. Next player once the darts are out'
        : v.visit.darts.length ? 'Tap a dart to fix it before pulling them out'
        : 'Throw, or tap an empty dart to add it by hand';
      return { hint, primary: { label: 'Next player', cmd: { type: 'next' } }, endInstead: false, canUndo: true };
    }
  }
}

/** Is ending now the normal end of the match (no save/discard question)? */
export const endsNormally = (m: LiveMatch) =>
  m.view.phase === 'matchWon' || (m.view.phase === 'legWon' && m.options.matchMode.kind === 'off');

export const visitDarts = (m: LiveMatch): Dart[] => m.view.visit.darts.map(d => d.dart);

/** Pips for legs won toward the current set or match, or null when there is no target. */
export function legTarget(m: LiveMatch): number | null {
  const mm = m.options.matchMode;
  if (mm.kind === 'legs') return mm.firstTo <= 7 ? mm.firstTo : null;
  if (mm.kind === 'sets') return mm.legsPerSet <= 7 ? mm.legsPerSet : null;
  return null;
}

export function shortDescription(m: LiveMatch): string {
  const mm = m.options.matchMode;
  const target = mm.kind === 'legs' ? `First to ${mm.firstTo}` : mm.kind === 'sets' ? `Set ${m.view.set} · First to ${mm.firstTo} sets` : 'Match mode off';
  return `${m.options.startScore} · Leg ${m.view.legNo} · ${target}`;
}
