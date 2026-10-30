// Sounds tab: the Biblioteka dźwięków with upload, preview and per-file volume.
import { useEffect, useRef, useState } from 'react';
import type { Sound } from '../../../../server/effects/store.ts';
import { Dialog, Icon, toast } from '../../components/ui.tsx';
import { playFile, playSound } from '../../sound.ts';
import type { EffectsData } from './api.ts';
import { call } from './api.ts';
import { slug } from '../../../../server/effects/slug.ts';
import { Chevron, SearchField, Sheet, matchesQuery } from './parts.tsx';

// Each file stays in the repo's git history (docs/EFEKTY.md, Konfiguracja w repo).
const MAX_BYTES = 2 * 1024 * 1024;
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

/** A file the browser can read, waiting for its name. */
interface Picked {
  file: File;
  seconds: number;
  url: string;
}

const EXT: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/wave': 'wav', 'audio/ogg': 'ogg' };
const extOf = (f: File) => EXT[f.type] ?? f.name.split('.').pop()?.toLowerCase() ?? 'mp3';

/**
 * Asks for the name before the upload: the name also becomes the file name in the repo, which a later rename keeps
 * (docs/EFEKTY.md, Konfiguracja w repo).
 */
function NameNewSound({ d, picked, wide, onClose }: { d: EffectsData; picked: Picked; wide: boolean; onClose: () => void }) {
  const [name, setName] = useState(() => picked.file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40));
  const [busy, setBusy] = useState(false);
  // The name from the file is a guess: selected, so typing replaces it.
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);
  const clean = name.trim().replace(/\s+/g, ' ');
  const taken = d.sounds.some(s => s.name.toLowerCase() === clean.toLowerCase());
  const upload = async () => {
    if (!clean || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/sounds?name=${encodeURIComponent(clean)}&duration=${Math.ceil(picked.seconds * 1000)}`, {
        method: 'POST', headers: { 'content-type': picked.file.type.startsWith('audio/') ? picked.file.type : 'application/octet-stream' }, body: picked.file,
      });
      if (!r.ok) {
        toast({ text: ((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'Upload failed', kind: 'error' });
        return;
      }
      toast({ text: `Added “${clean}”` });
      d.reload();
      onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title="Name the new sound" wide={wide} onClose={onClose}>
      <div className="fx-variant">
        <button className="icon-btn" aria-label="Play the new sound" onClick={() => playFile(picked.url, d.settings.volume / 100)}>{Icon.play(16)}</button>
        <span className="grow">{picked.file.name}</span>
        <span className="muted">{picked.seconds.toFixed(1)} s</span>
      </div>
      <label className="section">
        <span className="caps">Name</span>
        <input ref={field} className="field" maxLength={40} value={name} placeholder="e.g. Crowd roar"
          onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && upload()} />
      </label>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {clean ? <>File in the repo: <b>effects/sounds/{slug(clean)}.{extOf(picked.file)}</b>. Renaming later keeps this file name.</> : 'Give it a name people will find.'}
        {taken && ' A sound with this name already exists.'}
      </p>
      <div className="chip-row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!clean || busy} onClick={upload}>{busy ? 'Uploading…' : 'Add sound'}</button>
      </div>
    </Sheet>
  );
}

function Upload({ d, wide }: { d: EffectsData; wide: boolean }) {
  const [picked, setPicked] = useState<Picked | null>(null);
  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked.url); }, [picked]);
  const pick = async (file: File) => {
    if (file.size > MAX_BYTES) return toast({ text: 'File is larger than 2 MB', kind: 'error' });
    let seconds: number;
    try {
      seconds = await duration(file);
    } catch {
      return toast({ text: 'This browser cannot read that file. Use mp3, wav or ogg.', kind: 'error' });
    }
    if (!(seconds > 0) || seconds > MAX_SECONDS) return toast({ text: 'Sound is longer than 10 s', kind: 'error' });
    setPicked({ file, seconds, url: URL.createObjectURL(file) });
  };
  return (
    <>
      <label className="fx-upload">
        <span className="fx-upload-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg></span>
        <span className="grow"><b>Upload a sound</b><span className="muted">mp3, wav or ogg · up to 2 MB and 10 s</span></span>
        <input type="file" accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg" hidden
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void pick(f); }} />
      </label>
      {picked && <NameNewSound d={d} picked={picked} wide={wide} onClose={() => setPicked(null)} />}
    </>
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

/** A library sound, or a built-in one (docs/EFEKTY.md, Dźwięki wbudowane): the same row without the “⋯” menu. */
function SoundRow({ d, s, onMenu }: { d: EffectsData; s: Sound; onMenu?: () => void }) {
  const [volume, setVolume] = useState(s.volume);
  useEffect(() => setVolume(s.volume), [s.volume]);
  const commit = () => volume !== s.volume && call('PUT', `/api/sounds/${s.id}`, { volume }).then(d.reload);
  const used = s.usedBy ? `used by ${s.usedBy} ${s.usedBy === 1 ? 'rule' : 'rules'}` : 'not used yet';
  return (
    <div className="fx-sound">
      <div className="fx-sound-top">
        <button className="icon-btn" aria-label={`Play ${s.name}`} onClick={() => playSound(s.url, (d.settings.volume / 100) * (volume / 100))}>{Icon.play(18)}</button>
        <span className="grow">
          <b>{s.name}</b>
          <span className="muted">{s.builtin ? `${s.builtin.info} · ${used}` : `${(s.durationMs / 1000).toFixed(1)} s · ${used}`}</span>
        </span>
        {onMenu && (
          <button className="icon-btn" aria-label={`More for ${s.name}`} onClick={onMenu}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
          </button>
        )}
      </div>
      <label className="fx-volume">
        <span>Volume {volume}%</span>
        <input type="range" min={0} max={200} step={5} value={volume} onChange={e => setVolume(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} />
      </label>
    </div>
  );
}

export function SoundsTab({ d, wide }: { d: EffectsData; wide: boolean }) {
  const [menu, setMenu] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [builtinOpen, setBuiltinOpen] = useState(false);
  const files = d.sounds.filter(s => !s.builtin);
  const builtin = d.sounds.filter(s => s.builtin);
  const open = files.find(s => s.id === menu);
  const shown = files.filter(s => matchesQuery(q, s.name, s.file));
  const shownBuiltin = builtin.filter(s => matchesQuery(q, s.name, s.builtin!.info));
  return (
    <div className="fx-col">
      {wide && <h2 className="fx-h">Sounds</h2>}
      <Upload d={d} wide={wide} />
      <SearchField value={q} onChange={setQ} placeholder="Search sounds" />
      <div className="option-row">
        <span className="caps">Library · {q ? `${shown.length} of ${files.length}` : files.length} {files.length === 1 ? 'sound' : 'sounds'}</span>
        <span className="muted">▶ plays on this device</span>
      </div>
      {files.length === 0 && <p className="muted" style={{ margin: 0 }}>No files yet. Rules pick their sounds from here and from the built-in ones below.</p>}
      {files.length > 0 && shown.length === 0 && <p className="muted" style={{ margin: 0 }}>No sound matches “{q}”.</p>}
      {shown.map(s => <SoundRow key={s.id} d={d} s={s} onMenu={() => setMenu(s.id)} />)}
      {open && <SoundMenu key={open.id} d={d} s={open} wide={wide} onClose={() => setMenu(null)} />}
      <button className="option-row fx-group" aria-expanded={builtinOpen || !!q} onClick={() => setBuiltinOpen(!builtinOpen)}>
        <span className="caps">Built-in · {builtin.length} sounds</span>
        <span className="muted">made by the kiosk, no files<Chevron /></span>
      </button>
      {(builtinOpen || q) && shownBuiltin.map(s => <SoundRow key={s.id} d={d} s={s} />)}
      {(builtinOpen || q) && shownBuiltin.length === 0 && <p className="muted" style={{ margin: 0 }}>No built-in sound matches “{q}”.</p>}
    </div>
  );
}
