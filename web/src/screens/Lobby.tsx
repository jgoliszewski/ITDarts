import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ClientState, LobbyRecord, PlayerInfo } from '../../../server/protocol.ts';
import { GameIcon } from '../components/GameIcon.tsx';
import { HowToOverlay } from '../components/HowTo.tsx';
import { Dialog, Presence, act } from '../components/ui.tsx';
import { rematchLabel } from '../match.ts';
import type { RecordPage } from '../records.ts';
import { PAGE_COLS, ROTATE_RESPONSE, SWIPE_RESPONSE, attemptCommand, attemptHint, attemptReady, dotWeight, groupByGame, groupTitle, holdPosition, lastLine, lockAxis, nextPage, projectPage, recordPages, splitValue, springStep, swipeSpeed, togglePick } from '../records.ts';
import { shortDate } from '../util.ts';
import { BigHeader } from './Scoreboard.tsx';

/**
 * Office records of the minigames on the phone pilot's home (D6): one tile per variant with a record, grouped by game
 * (a heading each) in the order of the game groups. A tap opens New match with that game set up like the record's match;
 * reloaded whenever a new match is saved. The kiosk has its own, bigger pages (`RecordGrid`).
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
        <div className="record-groups">
          {[...groupByGame(records)].map(([game, items]) => (
            <section key={game} className="record-group">
              <h2 className="record-ghead"><GameIcon game={game} className="record-gico" /><span>{items[0].title}</span><span className="gline" /></h2>
              <div className="record-list">
                {items.map(r => (
                  <button key={r.key} className="record-tile" onClick={() => onPick(r)} aria-label={`New match: ${r.label}`}>
                    <span className="what">{r.sub || r.title}</span>
                    <span className="num">{r.value}</span>
                    <span className="who" title={r.who}>{r.who} · {shortDate(r.at)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const ROTATE_MS = 10_000;

function RecordTile({ r, tab, onPick }: { r: LobbyRecord; tab: boolean; onPick: (r: LobbyRecord) => void }) {
  const [num, unit] = splitValue(r.value);
  return (
    <button className="rec-tile" tabIndex={tab ? 0 : -1} onClick={() => onPick(r)} aria-label={`Record attempt: ${r.label}, record ${r.value} by ${r.who}`}>
      <span className="what">{r.sub || r.title}</span>
      <span className="val"><span className="num">{num}</span>{unit && <span className="unit">{unit}</span>}</span>
      <span className="who" title={r.who}>{r.who}</span>
      <span className="chase">
        {r.chase.length === 0 && <span className="row none">Nobody close yet</span>}
        {r.chase.map((c, i) => (
          <span key={i} className="row" title={`${i + 2}. ${c.who} ${c.value}`}>
            <span className={`pl ${i === 1 ? 'bronze' : ''}`}>{i + 2}</span><span className="nm">{c.who}</span><span className="v">{splitValue(c.value)[0]}</span>
          </span>
        ))}
      </span>
    </button>
  );
}

function RecordPageView({ page, tab, clone, onPick }: { page: RecordPage; tab: boolean; clone?: boolean; onPick: (r: LobbyRecord) => void }) {
  return (
    <div className="rec-page" aria-hidden={clone || undefined} style={{ gridTemplateColumns: `repeat(${page.cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${page.rows}, minmax(0, 1fr))` }}>
      {page.groups.map(g => (
        <section key={`${g.game}${g.cont}`} className="rec-group" style={{ gridRow: g.row + 1, gridColumn: `${g.col + 1} / span ${Math.min(g.items.length, PAGE_COLS)}` }}>
          <h2 className="rec-ghead"><GameIcon game={g.game} className="rec-gico" /><span>{groupTitle(g)}</span><span className="gline" /></h2>
          <div className="rec-tiles" style={{ gridTemplateColumns: `repeat(${Math.min(g.items.length, PAGE_COLS)}, minmax(0, 1fr))` }}>
            {g.items.map(r => <RecordTile key={r.key} r={r} tab={tab} onPick={onPick} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * The kiosk's records: every variant with a record as big tiles, grouped by game, on pages (docs/UI.md, Lobby i QR).
 * The slide ignores prefers-reduced-motion on purpose (docs/UI.md): a released swipe always runs on, it never jumps.
 * The pages sit in a strip that a critically damped spring (rAF, only `transform`) moves: by swipe (the strip is under the
 * finger 1:1, and on release the spring starts with the finger's speed towards the page its momentum reaches, one page
 * at most), by the dots, and by itself every 10 s (not while dragging or while `paused`, the attempt popup being open).
 * A moving strip can be caught at any moment and is then held where it is. The strip has the first page once more behind
 * the last, so the rotation slides on from the last page to the first instead of running back. A tap opens the attempt popup.
 */
function RecordGrid({ lastId, paused, onPick }: { lastId: number | undefined; paused: boolean; onPick: (r: LobbyRecord) => void }) {
  const [records, setRecords] = useState<LobbyRecord[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/api/lobby/records?top=1').then(r => r.json()).then((r: LobbyRecord[]) => live && setRecords(r)).catch(() => live && setRecords([]));
    return () => { live = false; };
  }, [lastId]);
  const pages = useMemo(() => recordPages(records ?? []), [records]);
  const n = pages.length;
  const [page, setPage] = useState(0);
  const [dragging, setDragging] = useState(false);
  // Counts every page change, so a tap on the dot of the current page also starts the 10 s over.
  const [changes, setChanges] = useState(0);
  const cur = Math.min(page, Math.max(0, n - 1));
  const pager = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const dots = useRef<HTMLElement[]>([]);
  // The strip: x px from the first page (n * width is the copy of the first page behind the last), v px/s, the spring's goal.
  const strip = useRef({ x: 0, v: 0, goal: 0, response: SWIPE_RESPONSE, raf: 0, last: 0 });
  const touch = useRef<{ id: number; x: number; y: number; from: number; start: number; axis: 'x' | 'y' | null; pts: [number, number][]; max: number } | null>(null);
  const moved = useRef(false);

  const paint = (x: number) => {
    const w = pager.current?.clientWidth || 1;
    if (track.current) track.current.style.transform = `translate3d(${-x}px, 0, 0)`;
    dots.current.forEach((d, i) => d?.style.setProperty('--k', String(dotWeight(x / w, i, n))));
  };
  const stop = () => { cancelAnimationFrame(strip.current.raf); strip.current.raf = 0; };
  const put = (x: number) => { const s = strip.current; stop(); s.x = x; s.v = 0; paint(x); };
  /** The spring runs to its goal; on the copy of the first page it lands, the strip goes back to the real one unseen. */
  const frame = (t: number) => {
    const s = strip.current;
    const dt = Math.min((t - s.last) / 1000, 1 / 30);
    s.last = t;
    ({ x: s.x, v: s.v } = springStep(s.x, s.v, s.goal, dt, s.response));
    if (Math.abs(s.x - s.goal) < 0.4 && Math.abs(s.v) < 8) {
      s.x = s.goal === n * (pager.current?.clientWidth || 1) ? 0 : s.goal;
      s.v = 0;
      s.raf = 0;
    } else s.raf = requestAnimationFrame(frame);
    paint(s.x);
  };
  /** Lets the strip run to page `to` (n: the copy of the first) from where it is, with the speed it has. */
  const spring = (to: number, response: number) => {
    const s = strip.current;
    s.goal = to * (pager.current?.clientWidth || 1);
    s.response = response;
    if (!s.raf) { s.last = performance.now(); s.raf = requestAnimationFrame(frame); }
  };
  const go = (to: number, wrap = false, response = SWIPE_RESPONSE) => {
    setPage(to % n);
    setChanges(c => c + 1);
    spring(wrap ? n : to, response);
  };
  useEffect(() => stop, []);
  // New pages (the list was reloaded) or a resized screen: stay where you are, or on the last page when yours is gone.
  useLayoutEffect(() => {
    const at = () => { setPage(cur); put(cur * (pager.current?.clientWidth || 1)); };
    at();
    window.addEventListener('resize', at);
    return () => window.removeEventListener('resize', at);
  }, [pages]);
  useLayoutEffect(() => paint(strip.current.x));

  useEffect(() => {
    if (n < 2 || paused || dragging) return;
    const t = window.setTimeout(() => { const next = nextPage(cur, n); go(next.page, next.wrap, ROTATE_RESPONSE); }, ROTATE_MS);
    return () => clearTimeout(t);
  }, [n, cur, paused, dragging, changes]);

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (n < 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const s = strip.current, w = pager.current!.clientWidth;
    // Caught on the move: the strip stops where it is (no jump), and the tap that follows is not a tap on a tile.
    if (s.raf || s.x !== Math.round(s.x / w) * w) { stop(); s.v = 0; moved.current = true; }
    const from = Math.round(s.x / w);
    touch.current = { id: e.pointerId, x: e.clientX, y: e.clientY, from, start: s.x, axis: null, pts: [[e.clientX, e.timeStamp]], max: (s.x > (n - 1) * w ? n : n - 1) * w };
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = touch.current;
    if (!d || e.pointerId !== d.id) return;
    if (d.axis === null) {
      d.axis = lockAxis(e.clientX - d.x, e.clientY - d.y);
      if (d.axis === 'x') {
        // The strip follows from here on 1:1, not from where the finger went down: no jump at the lock.
        d.x = e.clientX;
        moved.current = true;
        setDragging(true);
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* the pointer is gone */ }
      }
    }
    if (d.axis !== 'x') return;
    d.pts = [...d.pts.slice(-5), [e.clientX, e.timeStamp]];
    const s = strip.current;
    s.x = holdPosition(d.start, e.clientX - d.x, d.max, pager.current!.clientWidth);
    paint(s.x);
  };
  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = touch.current;
    if (!d || e.pointerId !== d.id) return;
    touch.current = null;
    const s = strip.current, w = pager.current!.clientWidth;
    if (d.axis !== 'x') {
      // A caught strip that was not dragged runs on to the page it is nearest to.
      if (moved.current) { const at = Math.max(0, Math.min(d.max / w, Math.round(s.x / w))); setPage(at % n); setChanges(c => c + 1); spring(at, SWIPE_RESPONSE); }
      window.setTimeout(() => { moved.current = false; }, 0);
      return;
    }
    setDragging(false);
    s.v = -swipeSpeed(d.pts, e.timeStamp);
    const to = projectPage(s.x, s.v, w, d.from, d.max / w);
    setPage(to % n);
    setChanges(c => c + 1);
    spring(to, SWIPE_RESPONSE);
    // The click that ends the drag must not open the tile under the finger.
    window.setTimeout(() => { moved.current = false; }, 0);
  };

  return (
    <>
      <div ref={pager} className={`rec-pager ${dragging ? 'dragging' : ''}`} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onClickCapture={e => { if (moved.current) { e.stopPropagation(); e.preventDefault(); } }}>
        {records !== null && n === 0 ? (
          <div className="rec-page" style={{ gridTemplateColumns: '1fr', gridTemplateRows: '1fr' }}><div className="rec-tile empty"><b>No records yet</b><span>Play a minigame to set one</span></div></div>
        ) : (
          <div className="rec-track" ref={track}>
            {pages.map((p, i) => <RecordPageView key={i} page={p} tab={i === cur} onPick={onPick} />)}
            {n > 1 && <RecordPageView page={pages[0]} tab={false} clone onPick={onPick} />}
          </div>
        )}
      </div>
      <div className="rec-foot">
        {n > 1 && (
          <>
            <div className="rec-dots">
              {pages.map((_, i) => <button key={i} className="rec-dot" aria-label={`Records page ${i + 1} of ${n}`} aria-current={i === cur ? 'true' : undefined} onClick={() => go(i)}><i ref={el => { if (el) dots.current[i] = el; }} /></button>)}
            </div>
            <div className="rec-names">{pages[cur].groups.map(groupTitle).join(' · ')}</div>
          </>
        )}
        <a className="all-link" href="/stats">All records <span className="arrow" aria-hidden="true">→</span></a>
      </div>
    </>
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
          <RecordGrid lastId={last?.id} paused={attempt !== null} onPick={r => takeThen(() => setAttempt(r))} />
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
