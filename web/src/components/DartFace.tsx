import type { Dart } from '../../../games/darts.ts';
import { label } from '../../../games/darts.ts';
import type { ClientState } from '../../../server/protocol.ts';
import { dartValue } from '../match.ts';

/** A dart tile's face, the same in every game: the field big, what it is worth small (docs/UI.md, Ekran wyników). */
export function DartFace({ m, dart }: { m: NonNullable<ClientState['match']>; dart: Dart }) {
  return <><span className="num">{label(dart)}</span><span className="lbl">{dartValue(m, dart)}</span></>;
}
