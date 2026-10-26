// Sounds tab: the Biblioteka dźwięków with upload, preview and per-file volume.
import { useEffect, useState } from 'react';
import type { Sound } from '../../../../server/effects/store.ts';
import { Dialog, Icon, toast } from '../../components/ui.tsx';
import { playFile } from '../../sound.ts';
import type { EffectsData } from './api.ts';
import { call } from './api.ts';
import { Sheet } from './parts.tsx';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_SECONDS = 10;

/** Length of an audio file, measured by the browser before the upload. */
function duration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(a.duration);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('unreadable'));
    };
    a.src = url;
  });
}

function Upload({ d }: { d: EffectsData }) {
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) return toast({ text: 'File is larger than 5 MB', kind: 'error' });
    let seconds: number;
    try {
      seconds = await duration(file);
    } catch {
      return toast({ text: 'This browser cannot read that file. Use mp3, wav or ogg.', kind: 'error' });
    }
    if (!(seconds > 0) || seconds > MAX_SECONDS) return toast({ text: 'Sound is longer than 10 s', kind: 'error' });
    setBusy(true);
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 40) || 'Sound';
    try {
      const r = await fetch(`/api/sounds?name=${encodeURIComponent(name)}&duration=${Math.ceil(seconds * 1000)}`, {
        method: 'POST', headers: { 'content-type': file.type.startsWith('audio/') ? file.type : 'application/octet-stream' }, body: file,
      });
      if (!r.ok) toast({ text: ((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'Upload failed', kind: 'error' });
      else toast({ text: `Added “${name}”` });
    } finally {
      setBusy(false);
      d.reload();
    }
  };
  return (
    <label className="fx-upload">
      <span className="fx-upload-icon">{busy ? '…' : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>}</span>
      <span className="grow"><b>{busy ? 'Uploading…' : 'Upload a sound'}</b><span className="muted">mp3, wav or ogg · up to 5 MB and 10 s</span></span>
      <input type="file" accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg" hidden disabled={busy}
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f); }} />
    </label>
  );
}

function SoundMenu({ d, s, wide, onClose }: { d: EffectsData; s: Sound; wide: boolean; onClose: () => void }) {
  const [name, setName] = useState(s.name);
  const [askDelete, setAskDelete] = useState(false);
  const users = d.rules.filter(r => r.sounds.includes(s.id)).map(r => r.name || 'Unnamed rule');
  const rename = async () => {
    if (name.trim() && name.trim() !== s.name && (await call('PUT', `/api/sounds/${s.id}`, { name }))) d.reload();
    onClose();
  };
  if (askDelete) {
    return (
      <Dialog title={`Delete “${s.name}”?`} onClose={onClose} actions={<>
        <button className="btn" onClick={onClose}>Keep</button>
        <button className="btn danger" onClick={() => call('DELETE', `/api/sounds/${s.id}`).then(() => { d.reload(); onClose(); })}>Delete</button>
      </>}>
        <p>The file is removed from the library and from the laptop.</p>
      </Dialog>
    );
  }
  return (
    <Sheet title={s.name} wide={wide} onClose={onClose}>
      <label className="section">
        <span className="caps">Name</span>
        <input className="field" value={name} maxLength={40} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && rename()} />
      </label>
      <button className="btn primary block" onClick={rename}>Rename</button>
      <button className="btn danger block" disabled={users.length > 0} onClick={() => setAskDelete(true)}>Delete</button>
      {users.length > 0 && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Used by {users.join(', ')}. Take it out of {users.length === 1 ? 'that rule' : 'those rules'} to delete it.</p>}
    </Sheet>
  );
}

function SoundRow({ d, s, onMenu }: { d: EffectsData; s: Sound; onMenu: () => void }) {
  const [volume, setVolume] = useState(s.volume);
  useEffect(() => setVolume(s.volume), [s.volume]);
  const commit = () => volume !== s.volume && call('PUT', `/api/sounds/${s.id}`, { volume }).then(d.reload);
  return (
    <div className="fx-sound">
      <div className="fx-sound-top">
        <button className="icon-btn" aria-label={`Play ${s.name}`} onClick={() => playFile(`/sounds/${s.file}`, (d.settings.volume / 100) * (volume / 100))}>{Icon.play(18)}</button>
        <span className="grow">
          <b>{s.name}</b>
          <span className="muted">{(s.durationMs / 1000).toFixed(1)} s · {s.usedBy ? `used by ${s.usedBy} ${s.usedBy === 1 ? 'rule' : 'rules'}` : 'not used yet'}</span>
        </span>
        <button className="icon-btn" aria-label={`More for ${s.name}`} onClick={onMenu}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
        </button>
      </div>
      <label className="fx-volume">
        <span>Volume {volume}%</span>
        <input type="range" min={0} max={200} step={5} value={volume} onChange={e => setVolume(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} />
      </label>
    </div>
  );
}

export function SoundsTab({ d, wide }: { d: EffectsData; wide: boolean }) {
  const [menu, setMenu] = useState<number | null>(null);
  const open = d.sounds.find(s => s.id === menu);
  return (
    <div className="fx-col">
      {wide && <h2 className="fx-h">Sounds</h2>}
      <Upload d={d} />
      <div className="option-row"><span className="caps">Library · {d.sounds.length} {d.sounds.length === 1 ? 'sound' : 'sounds'}</span><span className="muted">▶ plays on this device</span></div>
      {d.sounds.length === 0 && <p className="muted" style={{ margin: 0 }}>No sounds yet. Rules pick their sounds from here.</p>}
      {d.sounds.map(s => <SoundRow key={s.id} d={d} s={s} onMenu={() => setMenu(s.id)} />)}
      {open && <SoundMenu key={open.id} d={d} s={open} wide={wide} onClose={() => setMenu(null)} />}
    </div>
  );
}
