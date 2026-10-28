// Playback tab: the pilot switches, the built-in turn sound, the caller and both volumes.
import { useEffect, useState } from 'react';
import { Icon } from '../../components/ui.tsx';
import { playCaller } from '../../sound.ts';
import type { EffectsData } from './api.ts';
import { call } from './api.ts';
import { Seg, Switch } from './parts.tsx';

/** A volume slider that saves when let go. */
function Volume({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="fx-volume stacked">
      <span><b>{label}</b> {v}%</span>
      <input type="range" min={0} max={100} step={5} value={v} onChange={e => setV(Number(e.target.value))}
        onPointerUp={() => onSave(v)} onKeyUp={() => onSave(v)} />
    </label>
  );
}

export function PlaybackTab({ d, wide }: { d: EffectsData; wide: boolean }) {
  const s = d.settings;
  const put = (patch: object) => call('PUT', '/api/effects/settings', patch).then(d.reload);
  const row = (label: string, info: string, on: boolean, key: 'sounds' | 'caller' | 'leds', preview?: () => void) => (
    <div className="fx-setting">
      <span className="grow"><b>{label}</b><span className="muted">{info}</span></span>
      {preview && <button className="icon-btn" aria-label={`Play ${label}`} onClick={preview}>{Icon.play(18)}</button>}
      <Switch on={on} label={label} onChange={v => put({ [key]: v })} />
    </div>
  );
  return (
    <div className="fx-col">
      {wide && <h2 className="fx-h">Playback</h2>}
      <section className="box">
        {row('Sounds', 'Rule sounds, on the laptop only', s.sounds, 'sounds')}
        {row('Caller', 'The referee in X01: scores, “you require”, game shot. On the laptop only', s.caller, 'caller')}
        <div className="fx-setting" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10, paddingBlock: 12 }}>
          <span className="grow"><b>Caller voice</b><span className="muted">One folder per voice in assets/caller</span></span>
          <Seg label="Caller voice" value={s.callerVoice} onChange={callerVoice => put({ callerVoice })}
            options={d.callerVoices.map(v => [v, v[0].toUpperCase() + v.slice(1)] as [string, string])} />
          <div className="chip-row">
            {([['180', '180'], ['require_40', 'You require 40'], ['gameshot_l1_n', 'Game shot']] as const).map(([k, label]) => (
              <button key={k} className="fx-chip play" aria-label={`Play ${label}`} onClick={() => playCaller([`/caller/${s.callerVoice}/${k}.mp3`], s.callerVolume / 100)}>
                {Icon.play(14)} {label}
              </button>
            ))}
          </div>
        </div>
        {row('LEDs', 'Off turns the lights off', s.leds, 'leds')}
        <Volume label="Effects volume" value={s.volume} onSave={volume => put({ volume })} />
        <Volume label="Caller volume" value={s.callerVolume} onSave={callerVolume => put({ callerVolume })} />
      </section>
      <span className="muted" style={{ fontSize: 14 }}>The same switches are in the pilot menu. Overall loudness is set in Windows.</span>
    </div>
  );
}
