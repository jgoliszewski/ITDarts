import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { ClientState, LobbyRecord } from '../../../server/protocol.ts';
import { GameIcon } from '../components/GameIcon.tsx';
import { HowToOverlay } from '../components/HowTo.tsx';
import { act } from '../components/ui.tsx';
import { rematchLabel } from '../match.ts';
import { fmtAvg, shortDate } from '../util.ts';
import { BigHeader } from './Scoreboard.tsx';

/**
 * Office records of the minigames under the last match (D6): one tile per variant with a record, in the order of the
 * game groups. A tap opens New match with that game set up like the record's match. The list scrolls inside its card
 * when there are more than fit; reloaded whenever a new match is saved.
 */
function Records({ lastId, onPick }: { lastId: number | undefined; onPick: (r: LobbyRecord) => void }) {
  const [records, setRecords] = useState<LobbyRecord[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/lobby/records').then(r => r.json()).then((r: LobbyRecord[]) => live && setRecords(r)).catch(() => live && setRecords([]));
    return () => { live = false; };
  }, [lastId]);
  if (records === null) return null;
  return (
    <div className="card lobby-records">
      <div className="caps">Office records</div>
      {records.length === 0 ? (
        <div className="record-tile empty"><b>No records yet</b><span>Play a minigame to set one</span></div>
      ) : (
        <div className="record-list">
          {records.map(r => (
            <button key={r.key} className="record-tile" onClick={() => onPick(r)} aria-label={`New match: ${r.label}`}>
              <GameIcon game={r.game} className="record-icon" />
              <span className="what">{r.label}</span>
              <span className="num">{r.value}</span>
              <span className="who">{r.who} · {shortDate(r.at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Lobby({ s, onMenu, onBoard, onNew, onRecord, onPlayers, overlay }: {
  s: ClientState; onMenu: () => void; onBoard?: () => void; onNew: () => void; onRecord: (r: LobbyRecord) => void; onPlayers: () => void; overlay?: ReactNode }) {
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
              {rematchLabel(last.players.filter(p => !p.left).map(p => p.name))}
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
            <div className={`card last-match ${last.players.length > 4 ? 'many' : ''}`}>
              <div className="caps">Last match · {last.description.replace(/^X01 · /, '')}</div>
              {last.players.map((p, i) => (
                // Alone, the one player's result reads like a win, not a loss (B#12).
                <div key={i} className={`last-row ${p.winner || last.players.length === 1 ? 'win' : ''} ${p.left ? 'left' : ''}`}>
                  <span className="n">{p.name}{p.left && <small> · Left</small>}</span>
                  <span className="num">{p.value}</span>
                </div>
              ))}
              <div className="muted last-note">
                {last.game === 'x01' && <>Avg {last.players.map(p => fmtAvg(p.avg)).join(' vs ')}{last.checkout ? ` · checkout ${last.checkout}` : ''}</>}
                {last.status === 'ended' ? ' · ended early' : ''}
              </div>
            </div>
          )}
          <Records lastId={last?.id} onPick={r => takeThen(() => onRecord(r))} />
        </aside>
      </main>
      <HowToOverlay s={s} />
      {overlay}
    </div>
  );
}
