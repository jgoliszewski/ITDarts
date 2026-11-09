import { label } from '../../../games/darts.ts';
import type { DartRec } from '../../../games/x01/engine.ts';
import type { ClientState } from '../../../server/protocol.ts';
import { dartValue } from '../match.ts';

/** A dart tile's face, the same in every game: the field big, what it is worth small (docs/UI.md, Ekran wyników). */
export function DartFace({ m, rec }: { m: NonNullable<ClientState['match']>; rec: DartRec }) {
  return <><span className="num">{label(rec.dart)}</span><span className="lbl">{dartValue(m, rec)}</span></>;
}
