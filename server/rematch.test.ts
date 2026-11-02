import { describe, expect, it } from 'vitest';
import { rematchSetup } from './hub.ts';
import type { RosterEntry } from './protocol.ts';

const roster: RosterEntry[] = ['A', 'B', 'C'].map(name => ({ playerId: null, name }));
const names = (r: RosterEntry[]) => r.map(p => p.name).join('');

describe('rematch', () => {
  it('with a bull-off on keeps the options and the setup order, so a new bull-off decides', () => {
    for (const bullOff of ['closest', 'pdc']) {
      const [o, r] = rematchSetup({ startScore: 501, bullOff }, roster);
      expect(o).toMatchObject({ bullOff });
      expect(names(r)).toBe('ABC');
    }
  });

  it('with the bull-off off, the next player in the setup order starts', () => {
    const [o, r] = rematchSetup({ bullOff: 'off' }, roster);
    expect(o).toMatchObject({ bullOff: 'off' });
    expect(names(r)).toBe('BCA');
    expect(names(rematchSetup({}, roster)[1])).toBe('BCA');
  });
});
