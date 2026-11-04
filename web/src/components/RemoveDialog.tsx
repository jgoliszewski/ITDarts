import { useState } from 'react';
import { removeBlock } from '../../../games/turns.ts';
import type { LiveMatch } from '../../../server/protocol.ts';
import { isX01 } from '../match.ts';
import { Dialog, act } from './ui.tsx';

/**
 * Wycofanie gracza (docs/UI.md#wycofanie-gracza): the pilot taps a player's row, picks how to remove them and confirms.
 * X01 offers the leg and the match, minigames only the match.
 */
export function RemoveDialog({ m, player, onClose }: { m: LiveMatch; player: number; onClose: () => void }) {
  const [scope, setScope] = useState<'match' | 'leg' | null>(null);
  const name = m.roster[player].name;
  const x01 = isX01(m);
  const why = (s: 'match' | 'leg') => removeBlock(m.game, m.view, player, s);
  const remove = async (s: 'match' | 'leg') => {
    onClose();
    await act({ type: 'remove', player, scope: s });
  };

  if (scope) {
    return (
      <Dialog title={`Remove ${name} from ${scope === 'match' ? 'the match' : 'this leg'}?`} onClose={onClose} actions={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn danger" onClick={() => void remove(scope)}>Remove</button>
      </>}>
        <p>{scope === 'match'
          ? `${name} stays on the list, greyed out with what they scored, and is skipped to the end of the match. Undo takes it back.`
          : `${name} sits out the rest of this leg, which counts as lost, and is back in the next one. Undo takes it back.`}</p>
      </Dialog>
    );
  }
  const canLeg = x01 && !why('leg');
  const canMatch = !why('match');
  return (
    <Dialog title={name} onClose={onClose} actions={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      {canLeg && <button className="btn" onClick={() => setScope('leg')}>Remove from leg</button>}
      {canMatch && <button className="btn danger" onClick={() => setScope('match')}>{x01 ? 'Remove from match' : 'Remove player'}</button>}
    </>}>
      {!canMatch && !canLeg && <p>{why('match')}</p>}
    </Dialog>
  );
}
