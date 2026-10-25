import { useState } from 'react';
import type { ClientState, PlayerInfo } from '../../../server/protocol.ts';
import { Dialog, Icon, act } from '../components/ui.tsx';

type Pending = { kind: 'anonymize' | 'merge'; player: PlayerInfo } | null;

export function Players({ s, onClose }: { s: ClientState; onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const [rename, setRename] = useState('');
  const [newName, setNewName] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [mergeInto, setMergeInto] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const active = s.players.filter(p => !p.archived);
  const archived = s.players.filter(p => p.archived && p.name !== 'Deleted player');

  const create = async () => {
    if (!newName.trim()) return;
    if ((await act({ type: 'player', cmd: { action: 'create', name: newName } })).ok) setNewName('');
  };

  const row = (p: PlayerInfo) => (
    <div key={p.id} className="box" style={{ padding: 0, gap: 0 }}>
      <button className="list-row" style={{ background: 'transparent', textAlign: 'left' }} onClick={() => { setOpen(open === p.id ? null : p.id); setRename(p.name); }}>
        <span className="grow">{p.name}</span>
        <span className="muted" style={{ fontSize: 13, paddingRight: 8 }}>{open === p.id ? 'Close' : 'Edit'}</span>
      </button>
      {open === p.id && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <form className="option-row" onSubmit={async e => { e.preventDefault(); if ((await act({ type: 'player', cmd: { action: 'rename', id: p.id, name: rename } })).ok) setOpen(null); }}>
            <input className="field" value={rename} maxLength={24} onChange={e => setRename(e.target.value)} aria-label={`New name for ${p.name}`} />
            <button className="btn" type="submit" disabled={rename.trim() === p.name}>Rename</button>
          </form>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <button className="btn" onClick={() => { setPending({ kind: 'merge', player: p }); setMergeInto(null); }}>Merge…</button>
            <button className="btn" onClick={() => act({ type: 'player', cmd: { action: 'archive', id: p.id, archived: !p.archived } })}>{p.archived ? 'Restore' : 'Archive'}</button>
            <button className="btn danger" onClick={() => setPending({ kind: 'anonymize', player: p })}>Delete…</button>
          </div>
          <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>
            Archive hides the player from lists and keeps the stats. Delete removes the name; matches stay as “Deleted player”.
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="phone" style={{ maxWidth: 640 }}>
      <header className="phone-header">
        <button className="icon-btn" style={{ background: 'transparent' }} aria-label="Back" onClick={onClose}>{Icon.back(22)}</button>
        <h1>Players</h1>
      </header>
      <div className="phone-body">
        <form className="option-row" onSubmit={e => { e.preventDefault(); void create(); }}>
          <input className="field" value={newName} maxLength={24} placeholder="New player name" aria-label="New player name" onChange={e => setNewName(e.target.value)} />
          <button className="btn primary" type="submit" disabled={!newName.trim()}>Create</button>
        </form>
        {active.length === 0 && <p className="muted" style={{ margin: 0 }}>No players yet. Create one for everyone who wants stats.</p>}
        {active.map(row)}
        {archived.length > 0 && (
          <>
            <button className="btn ghost" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Hide' : 'Show'} archived ({archived.length})</button>
            {showArchived && archived.map(row)}
          </>
        )}
      </div>

      {pending?.kind === 'anonymize' && (
        <Dialog title={`Delete ${pending.player.name}?`} onClose={() => setPending(null)} actions={<>
          <button className="btn" onClick={() => setPending(null)}>Cancel</button>
          <button className="btn danger" onClick={async () => { await act({ type: 'player', cmd: { action: 'anonymize', id: pending.player.id } }); setPending(null); setOpen(null); }}>Delete name</button>
        </>}>
          <p>The name is removed for good and the player disappears from lists. Their matches stay, shown as “Deleted player”, so other players' stats don't change.</p>
        </Dialog>
      )}
      {pending?.kind === 'merge' && (
        <Dialog title={`Merge ${pending.player.name} into…`} onClose={() => setPending(null)} actions={<>
          <button className="btn" onClick={() => setPending(null)}>Cancel</button>
          <button className="btn primary" disabled={mergeInto === null} onClick={async () => {
            await act({ type: 'player', cmd: { action: 'merge', from: pending.player.id, into: mergeInto! } });
            setPending(null);
            setOpen(null);
          }}>Merge</button>
        </>}>
          <p>All matches of {pending.player.name} move to the player you pick, and {pending.player.name} is removed. Use it for typos and duplicates.</p>
          <div className="chip-row">
            {s.players.filter(p => p.id !== pending.player.id && p.name !== 'Deleted player').map(p => (
              <button key={p.id} className={`chip ${mergeInto === p.id ? 'on' : ''}`} onClick={() => setMergeInto(p.id)}>{p.name}</button>
            ))}
          </div>
        </Dialog>
      )}
    </div>
  );
}
