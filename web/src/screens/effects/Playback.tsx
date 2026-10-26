// Playback tab: the pilot switches, the built-in swoosh and the effects volume.
import { useEffect, useState } from 'react';
import type { EffectsData } from './api.ts';
import { call } from './api.ts';
import { Switch } from './parts.tsx';

export function PlaybackTab({ d, wide }: { d: EffectsData; wide: boolean }) {
  const s = d.settings;
  const [volume, setVolume] = useState(s.volume);
  useEffect(() => setVolume(s.volume), [s.volume]);
  const put = (patch: object) => call('PUT', '/api/effects/settings', patch).then(d.reload);
  const row = (label: string, info: string, on: boolean, key: 'sounds' | 'leds' | 'swoosh') => (
    <div className="fx-setting">
      <span className="grow"><b>{label}</b><span className="muted">{info}</span></span>
      <Switch on={on} label={label} onChange={v => put({ [key]: v })} />
    </div>
  );
  return (
    <div className="fx-col">
      {wide && <h2 className="fx-h">Playback</h2>}
      <section className="box">
        {row('Sounds', 'Rule sounds and the swoosh, on the laptop only', s.sounds, 'sounds')}
        {row('LEDs', 'Off turns the lights off', s.leds, 'leds')}
        {row('Swoosh on the next player', 'Built in. Turn it off to use your own sound on Takeout end', s.swoosh, 'swoosh')}
        <label className="fx-volume stacked">
          <span><b>Effects volume</b> {volume}%</span>
          <input type="range" min={0} max={100} step={5} value={volume} onChange={e => setVolume(Number(e.target.value))}
            onPointerUp={() => put({ volume })} onKeyUp={() => put({ volume })} />
        </label>
      </section>
      <span className="muted" style={{ fontSize: 14 }}>The same switches are in the pilot menu. Overall loudness is set in Windows. The caller comes with its voice pack.</span>
    </div>
  );
}
