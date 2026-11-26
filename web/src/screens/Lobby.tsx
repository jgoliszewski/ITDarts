import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { ClientState, LobbyRecord, PlayerInfo } from '../../../server/protocol.ts';
import { GameIcon } from '../components/GameIcon.tsx';
import { HowToOverlay } from '../components/HowTo.tsx';
import { Dialog, Presence, act } from '../components/ui.tsx';
import { rematchLabel } from '../match.ts';
import { attemptCommand, attemptHint, attemptReady, gridShape, lastLine, splitValue, togglePick } from '../records.ts';
import { shortDate } from '../util.ts';
import { BigHeader } from './Scoreboard.tsx';

/**
 * Office records of the minigames on the phone pilot's home (D6): one tile per variant with a record, in the order of
 * the game groups. A tap opens New match with that game set up like the record's match; reloaded whenever a new match
 * is saved. The kiosk has its own, bigger grid of the top 8 (`RecordGrid`).
 */
export function Records({ lastId, onPick }: { lastId: number | undefined; onPick: (r: LobbyRecord) => void }) {
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
              <span className="who" title={r.who}>{r.who} · {shortDate(r.at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The kiosk's records: the 8 most played variants as big tiles (docs/UI.md, Lobby i QR). A tap opens the attempt popup. */
function RecordGrid({ lastId, onPick }: { lastId: number | undefined; onPick: (r: LobbyRecord) => void }) {
  const [records, setRecords] = useState<LobbyRecord[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/lobby/records?top=1').then(r => r.json()).then((r: LobbyRecord[]) => live && setRecords(r)).catch(() => live && setRecords([]));
    return () => { live = false; };
  }, [lastId]);
  if (records === null) return <div className="rec-grid" />;
  if (records.length === 0) {
    return <div className="rec-grid"><div className="rec-tile empty"><b>No records yet</b><span>Play a minigame to set one</span></div></div>;
  }
  const { cols, rows } = gridShape(records.length);
  return (
    <div className="rec-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
      {records.map(r => {
        const [num, unit] = splitValue(r.value);
        return (
          <button key={r.key} className="rec-tile" onClick={() => onPick(r)} aria-label={`Record attempt: ${r.label}, record ${r.value} by ${r.who}`}>
            <GameIcon game={r.game} className="rec-icon" />
            <span className="what">{r.label}</span>
            <span className="val"><span className="num">{num}</span>{unit && <span className="unit">{unit}</span>}</span>
            <span className="who" title={r.who}>{r.who}</span>
            <span className="chase">
              {r.chase.length === 0 && <span className="row none">Nobody close yet</span>}
              {r.chase.map((c, i) => (
                <span key={i} className="row" title={`${i + 2}. ${c.who} ${c.value}`}>
                  <span className="pl">{i + 2}</span><span className="nm">{c.who}</span><span className="v">{splitValue(c.value)[0]}</span>
                </span>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * “Record attempt”: the record's game and options are fixed, only the players are chosen. Solo takes exactly one, co-op
 * two or more; nobody is picked at first, and there is no Guest (a guest keeps no record).
 */
function AttemptDialog({ record: r, players, onStart, onClose }: { record: LobbyRecord; players: PlayerInfo[]; onStart: (cmd: NonNullable<ReturnType<typeof attemptCommand>>) => Promise<boolean>; onClose: () => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  // Someone archived meanwhile (from a phone) leaves the choice.
  const shown = picked.filter(id => players.some(p => p.id === id));
  const ready = attemptReady(r, shown.length);
  const start = async () => {
    const cmd = attemptCommand(r, shown, players);
    if (!cmd || busy) return;
    setBusy(true);
    try {
      if (await onStart(cmd)) onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog title="Record attempt" className="attempt" onClose={onClose} actions={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!ready || busy} onClick={() => void start()}>Start</button>
    </>}>
      <div className="attempt-what">{r.label}</div>
      <div className="attempt-beat">
        <span className="t">Record to beat</span>
        <span className="num">{r.value}</span>
        <span className="w" title={r.who}>{r.who}</span>
      </div>
      <div className={`attempt-hint ${ready ? 'ok' : ''}`}>
        <span>{attemptHint(r)}</span>
        <span className="muted">{r.coop ? `${shown.length} of max ${r.maxPlayers}` : `${shown.length} of 1`}</span>
      </div>
      <div className="chip-row attempt-chips">
        {players.map(p => {
          const on = shown.includes(p.id);
          return (
            <button key={p.id} className={`chip ${on ? 'on' : ''}`} aria-pressed={on} disabled={!on && r.maxPlayers > 1 && shown.length >= r.maxPlayers}
              onClick={() => setPicked(cur => togglePick(r, cur.filter(id => players.some(x => x.id === id)), p.id))} title={p.name}>
              <span>{p.name}</span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}

export function Lobby({ s, onMenu, onBoard, onNew, onPlayers, overlay }: {
  s: ClientState; onMenu: () => void; onBoard?: () => void; onNew: () => void; onPlayers: () => void; overlay?: ReactNode }) {
  const last = s.lastMatch;
  const [attempt, setAttempt] = useState<LobbyRecord | null>(null);
  const takeThen = async (fn: () => void | Promise<unknown>) => {
    if (!s.you.isPilot && !(await act({ type: 'takeControl' })).ok) return;
    await fn();
  };
  const players = s.players.filter(p => !p.archived);

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
        <div className="lobby-records-col">
          <RecordGrid lastId={last?.id} onPick={r => takeThen(() => setAttempt(r))} />
          <a className="all-link" href="/stats">All records <span className="arrow" aria-hidden="true">→</span></a>
        </div>
        <section className="card lobby-col">
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
          {last && <div className="last-line" title={lastLine(last)}>{lastLine(last)}{last.status === 'ended' ? ' · ended early' : ''}</div>}
          <nav className="lobby-nav">
            <button className="btn" onClick={() => takeThen(onPlayers)}>Players</button>
            <a className="btn" href="/stats">Stats</a>
            <a className="btn" href="/effects">Effects</a>
          </nav>
        </section>
      </main>
      <HowToOverlay s={s} />
      <Presence>{attempt && <AttemptDialog record={attempt} players={players} onClose={() => setAttempt(null)} onStart={async cmd => { let ok = false; await takeThen(async () => { ok = (await act(cmd)).ok; }); return ok; }} />}</Presence>
      {overlay}
    </div>
  );
}
