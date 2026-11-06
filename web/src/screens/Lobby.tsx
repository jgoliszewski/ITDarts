import type { ReactNode } from 'react';
import type { ClientState } from '../../../server/protocol.ts';
import { HowToOverlay } from '../components/HowTo.tsx';
import { Qr, act, pilotUrl } from '../components/ui.tsx';
import { fmtAvg } from '../util.ts';
import { BigHeader } from './Scoreboard.tsx';

export function Lobby({ s, onMenu, onQr, onBoard, onNew, onPlayers, overlay }: {
  s: ClientState; onMenu: () => void; onQr: () => void; onBoard?: () => void; onNew: () => void; onPlayers: () => void; overlay?: ReactNode }) {
  const url = pilotUrl(s);
  const last = s.lastMatch;
  const takeThen = async (fn: () => void | Promise<unknown>) => {
    if (!s.you.isPilot && !(await act({ type: 'takeControl' })).ok) return;
    await fn();
  };

  return (
    <div className="big">
      <BigHeader s={s} onQr={onQr} onBoard={onBoard} onMenu={onMenu} />
      {!s.board.connected && <div className="banner">Board offline · check Board Manager on {s.board.address}</div>}
      {s.rotateBoardDue && !s.match && (
        <div className="banner info">
          Rotate the board 3 sectors
          <button className="btn banner-btn" onClick={() => takeThen(() => act({ type: 'boardRotated' }))}>Done</button>
        </div>
      )}
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
          <nav className="lobby-nav">
            <button className="btn" onClick={() => takeThen(onPlayers)}>Players</button>
            <a className="btn" href="/stats">Stats</a>
            <a className="btn" href="/effects">Effects</a>
          </nav>
          {last && (
            <div className="card">
              <div className="caps">Last match · {last.description.replace(/^X01 · /, '')}</div>
              {last.players.map((p, i) => (
                <div key={i} className={`last-row ${p.winner ? 'win' : ''} ${p.left ? 'left' : ''}`}>
                  <span className="n">{p.name}{p.left && <small> · Left</small>}</span>
                  <span className="num">{p.value}</span>
                </div>
              ))}
              <div className="muted" style={{ fontSize: 'calc(20 * var(--u))' }}>
                {last.game === 'x01' && <>Avg {last.players.map(p => fmtAvg(p.avg)).join(' vs ')}{last.checkout ? ` · checkout ${last.checkout}` : ''}</>}
                {last.status === 'ended' ? ' · ended early' : ''}
              </div>
            </div>
          )}
          <div className="card lobby-actions">
            <div className="muted" style={{ fontSize: 'calc(22 * var(--u))' }}>{s.you.isPilot ? 'Using this screen as the pilot?' : `Pilot: ${s.pilot?.deviceName ?? 'nobody yet'}`}</div>
            <button className="btn primary" onClick={() => takeThen(onNew)}>New match here</button>
            {last && (
              <button className="btn secondary" onClick={() => takeThen(() => act({ type: 'rematch' }))}>
                Rematch {last.players.filter(p => !p.left).map(p => p.name).join(' vs ')}
              </button>
            )}
          </div>
        </aside>
      </main>
      <HowToOverlay s={s} />
      {overlay}
    </div>
  );
}
