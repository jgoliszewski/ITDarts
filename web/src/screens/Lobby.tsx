import type { ReactNode } from 'react';
import type { ClientState } from '../../../server/protocol.ts';
import { Qr, act } from '../components/ui.tsx';
import { fmtAvg } from '../util.ts';
import { BigHeader } from './Scoreboard.tsx';

export function Lobby({ s, onMenu, onQr, onNew, overlay }: { s: ClientState; onMenu: () => void; onQr: () => void; onNew: () => void; overlay?: ReactNode }) {
  const url = s.urls[0] ?? location.origin + '/';
  const last = s.lastMatch;
  const sets = last?.players.some(p => p.sets > 0);
  const takeThen = async (fn: () => void | Promise<unknown>) => {
    if (!s.you.isPilot && !(await act({ type: 'takeControl' })).ok) return;
    await fn();
  };

  return (
    <div className="big">
      <BigHeader s={s} onQr={onQr} onMenu={onMenu} />
      {!s.board.connected && <div className="banner">Board offline · check Board Manager on {s.board.address}</div>}
      <main className="lobby-main">
        <section className="lobby-qr">
          <Qr text={url} />
          <div className="lobby-text">
            <div className="kicker">{last ? 'READY FOR THE NEXT ONE' : 'NO MATCH YET'}</div>
            <h1>Scan to take<br />control</h1>
            <p>Your phone becomes the pilot: start a match, pick players, fix darts.</p>
            <div className="url">or open <b style={{ color: 'var(--text)' }}>{url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</b></div>
          </div>
        </section>
        <aside className="lobby-side">
          {last && (
            <div className="card">
              <div className="caps">Last match · {last.description.replace(/^X01 · /, '')}</div>
              {last.players.map((p, i) => (
                <div key={i} className={`last-row ${p.winner ? 'win' : ''}`}>
                  <span className="n">{p.name}</span>
                  <span className="num">{sets ? p.sets : p.legs}</span>
                </div>
              ))}
              <div className="muted" style={{ fontSize: 'calc(20 * var(--u))' }}>
                Avg {last.players.map(p => fmtAvg(p.avg)).join(' vs ')}{last.checkout ? ` · checkout ${last.checkout}` : ''}
                {last.status === 'ended' ? ' · ended early' : ''}
              </div>
            </div>
          )}
          <div className="card lobby-actions">
            <div className="muted" style={{ fontSize: 'calc(22 * var(--u))' }}>{s.you.isPilot ? 'Using this screen as the pilot?' : `Pilot: ${s.pilot?.deviceName ?? 'nobody yet'}`}</div>
            <button className="btn primary" onClick={() => takeThen(onNew)}>New match here</button>
            {last && (
              <button className="btn secondary" onClick={() => takeThen(() => act({ type: 'rematch' }))}>
                Rematch {last.players.map(p => p.name).join(' vs ')}
              </button>
            )}
          </div>
        </aside>
      </main>
      {overlay}
    </div>
  );
}
