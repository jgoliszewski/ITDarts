// LEDs tab: the WLED connection, the Stany bazowe and the controller's presets.
import { useEffect, useState } from 'react';
import type { BaseState } from '../../../../server/effects/store.ts';
import type { EffectsData } from './api.ts';
import { call, presetName, presetOf, tryLed } from './api.ts';
import { Chevron, Dot, PresetPicker } from './parts.tsx';

const BASE_LABELS: [BaseState, string][] = [['lobby', 'Lobby'], ['match', 'Match in progress'], ['takeout', 'Takeout'], ['offline', 'Board offline']];

function Connection({ d }: { d: EffectsData }) {
  const address = d.settings.wled.address;
  const [editing, setEditing] = useState(!address);
  const [value, setValue] = useState(address);
  const [info, setInfo] = useState<{ name: string; version: string } | null>(null);
  // Keyed by the address, so a new address starts fresh.
  useEffect(() => {
    if (!address) return;
    let alive = true;
    fetch('/api/wled/info').then(r => (r.ok ? r.json() : null)).then(i => alive && setInfo(i)).catch(() => undefined);
    return () => { alive = false; };
  }, [address]);

  const save = async () => {
    if (await call('PUT', '/api/effects/settings', { wled: { address: value } })) d.reload();
  };

  if (editing) {
    return (
      <section className="box">
        <b style={{ fontSize: 17 }}>WLED controller</b>
        <span className="muted" style={{ fontSize: 14 }}>Its address in the office network, e.g. 192.168.1.50. Effects are presets you design in the WLED app.</span>
        <input className="field" placeholder="192.168.1.50" value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && save()} />
        <div className="chip-row" style={{ justifyContent: 'flex-end' }}>
          {address && <button className="btn" onClick={() => setEditing(false)}>Cancel</button>}
          <button className="btn primary" onClick={save} disabled={value.trim() === address}>Connect</button>
        </div>
      </section>
    );
  }
  const ok = !!d.presets.list;
  return (
    <section className="box">
      <div className="option-row">
        <span className={`dot ${ok ? 'green' : d.presets.error ? 'red' : 'amber'}`} />
        <b style={{ flex: 1, fontSize: 18 }}>{ok ? 'Connected' : d.presets.error ? 'Not answering' : 'Connecting…'}</b>
        <button className="btn" style={{ height: 36 }} onClick={() => setEditing(true)}>Change</button>
      </div>
      <div className="fx-facts">
        <span className="muted">Address</span><span>{address}</span>
        {info && <><span className="muted">Controller</span><span>{info.name} · WLED {info.version}</span></>}
        {ok && <><span className="muted">Presets</span><span>{d.presets.list!.length} on the controller</span></>}
        {d.presets.error && <><span className="muted">Error</span><span style={{ color: 'var(--red)' }}>{d.presets.error}</span></>}
      </div>
    </section>
  );
}

export function LedsTab({ d, wide }: { d: EffectsData; wide: boolean }) {
  const [picking, setPicking] = useState<BaseState | null>(null);
  const base = d.settings.wled.base;
  const setBase = (b: BaseState, id: number | null) => call('PUT', '/api/effects/settings', { wled: { base: { [b]: id } } }).then(d.reload);
  const address = d.settings.wled.address;
  return (
    <div className="fx-col">
      {wide && <h2 className="fx-h">LEDs</h2>}
      <Connection key={address} d={d} />
      {address && (
        <>
          <section className="section">
            <span className="caps">Base states · lit between effects</span>
            {BASE_LABELS.map(([b, label]) => {
              const id = base[b];
              return (
                <div key={b} className="fx-base">
                  <button className="fx-base-main" onClick={() => setPicking(b)}>
                    <span className="grow"><b>{label}</b><span className="muted"><Dot color={presetOf(d, id)?.color} size={10} />{id === null ? 'Leave as is' : presetName(d, id)}</span></span>
                    <Chevron />
                  </button>
                  <button className="btn" disabled={id === null} onClick={() => id !== null && tryLed(id, 3, presetName(d, id))}>Try</button>
                </div>
              );
            })}
          </section>
          {d.presets.list && d.presets.list.length > 0 && (
            <section className="section">
              <div className="option-row"><span className="caps">Presets on the controller</span><span className="muted">tap to try 3 s</span></div>
              <div className="fx-presets">
                {d.presets.list.map(p => (
                  <button key={p.id} className="fx-preset" onClick={() => tryLed(p.id, 3, p.name)}>
                    <Dot color={p.color} size={14} /><span className="grow">{p.name}</span><span className="muted">#{p.id}</span>
                  </button>
                ))}
              </div>
              <span className="muted" style={{ fontSize: 13 }}>Design the presets in the WLED app. Rules pick them by name.</span>
            </section>
          )}
        </>
      )}
      {picking && <PresetPicker d={d} wide={wide} value={base[picking]} none="Leave as is" onClose={() => setPicking(null)} onPick={id => setBase(picking, id)} />}
    </div>
  );
}
