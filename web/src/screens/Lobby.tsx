import type { ReactNode } from 'react';
import type { ClientState } from '../../../server/protocol.ts';
import { HowToOverlay } from '../components/HowTo.tsx';
import { act } from '../components/ui.tsx';
import { fmtAvg } from '../util.ts';
import { BigHeader } from './Scoreboard.tsx';

export function Lobby({ s, onMenu, onBoard, onNew, onPlayers, overlay }: {
  s: ClientState; onMenu: () => void; onBoard?: () => void; onNew: () => void; onPlayers: () => void; overlay?: ReactNode }) {
  const last = s.lastMatch;
  const takeThen = async (fn: () => void | Promise<unknown>) => {
    if (!s.you.isPilot && !(await act({ type: 'takeControl' })).ok) return;
    await fn();
  };

  return (
    <div className="big">
      <BigHeader s={s} onBoard={onBoard} onMenu={onMenu} />
      {!s.board.connected && <div className="banner">Board offline · check Board Manager on {s.board.address}</div>}
      {s.rotateBoardDue && !s.match && (
        <div className="banner info">
          Rotate the board 3 sectors
          <button className="btn banner-btn" onClick={() => takeThen(() => act({ type: 'boardRotated' }))}>Done</button>
        </div>
      )}
      <main className="lobby-main">
        <section className="lobby-start">
          <div className="lobby-text">
            <div className="kicker">{last ? 'READY FOR THE NEXT ONE' : 'NO MATCH YET'}</div>
            <h1>Game on?</h1>
          </div>
          <button className="btn primary" onClick={() => takeThen(onNew)}>New match</button>
          {last && (
            <button className="btn secondary" onClick={() => takeThen(() => act({ type: 'rematch' }))}>
              Rematch {last.players.filter(p => !p.left).map(p => p.name).join(' vs ')}
            </button>
          )}
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
        </aside>
      </main>
      <HowToOverlay s={s} />
      {overlay}
    </div>
  );
}
