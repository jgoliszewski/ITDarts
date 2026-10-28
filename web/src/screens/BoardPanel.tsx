import type { ReactNode } from 'react';
import { useState } from 'react';
import type { BoardAction, ClientState } from '../../../server/protocol.ts';
import { DOT, TargetBoard, coordsSpot } from '../components/Dartboard.tsx';
import { Dialog, Icon, act } from '../components/ui.tsx';
import { ago, useNow } from '../util.ts';
import { Switch } from './effects/parts.tsx';
import { boardPill } from './Scoreboard.tsx';

const CONFIRM: Partial<Record<BoardAction, { title: string; text: string; go: string }>> = {
  calibrate: { title: 'Calibrate the board?', text: 'Takes about 60 s. Pull all darts out first. Detection pauses; the match stays where it is.', go: 'Calibrate' },
  restart: { title: 'Restart Board Manager?', text: 'The board is offline for about a minute. The match stays where it is; you can enter darts by hand meanwhile.', go: 'Restart' },
};

const clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function prettyRaw(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/** Darts here do not reach the match: see whether the board reacts and what it sends (docs/UI.md, Panel tarczy). */
function BoardTest({ s, now, controls }: { s: ClientState; now: number; controls: ReactNode }) {
  const b = s.board;
  const darts = b.log.filter(e => e.coords && e.at >= s.boardTest!).reverse();
  const row = (k: string, v: string) => <><span className="muted">{k}</span><span>{v}</span></>;
  const board = (
    <div className="bt-board">
      <TargetBoard cleared={[]} target={null} ring={null} darts={[]} label="Darts thrown in the test">
        {darts.map((e, i) => {
          const [x, y] = coordsSpot(e.coords!.x, e.coords!.y);
          const last = i === darts.length - 1;
          return <circle key={e.at + ':' + i} cx={x} cy={y} r={last ? DOT + 3 : DOT} fill={last ? '#F58224' : '#FFFFFF'} stroke="#0A0A0B" strokeWidth="2" />;
        })}
      </TargetBoard>
    </div>
  );
  return (
    <div className="board-test">
      {board}
      <div className="bt-side">
      <section className="box">
        <div className="option-row">
          <div style={{ fontSize: 20, fontWeight: 800 }}>Test board</div>
          <button className="btn primary" onClick={() => void act({ type: 'boardTest', on: false })}>Done</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted2)' }}>Throw darts: they show here and do not count in the match.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '116px minmax(0, 1fr)', rowGap: 8, fontSize: 14 }}>
          {row('Connection', b.connected ? 'Connected' : 'Offline')}
          {row('Detection', b.detecting ? 'On' : 'Off')}
          {row('Takeout', b.takeout.active ? `In progress · ${ago(b.takeout.since!, now).replace(' ago', '')}` : 'No')}
          {row('Last frame', b.frameAt ? ago(b.frameAt, now) : 'Nothing yet')}
          {b.busy && row('Working', `${b.busy.action === 'calibrate' ? 'Calibrating' : 'Restarting'} · ${ago(b.busy.since, now).replace(' ago', '')}`)}
        </div>
      </section>
      {controls}
      <section className="box bt-events">
        <div className="caps" style={{ fontSize: 13 }}>Events</div>
        {b.log.length ? (
          <ol className="board-log">
            {b.log.map((e, i) => (
              <li key={e.at + ':' + i}>
                <span className="muted">{clock(e.at)}</span>
                <span>{e.text}{e.coords && <span className="muted"> · x {e.coords.x.toFixed(3)} y {e.coords.y.toFixed(3)}</span>}</span>
              </li>
            ))}
          </ol>
        ) : <span className="muted">No events yet</span>}
        <details>
          <summary className="muted">Raw</summary>
          <pre className="board-raw">{b.raw ? prettyRaw(b.raw) : 'Nothing received yet'}</pre>
        </details>
      </section>
      </div>
    </div>
  );
}

export function BoardPanel({ s, wide, onClose, onShowQr }: { s: ClientState; wide: boolean; onClose: () => void; onShowQr: () => void }) {
  const now = useNow(1000);
  const [confirm, setConfirm] = useState<BoardAction | null>(null);
  const b = s.board;
  const pill = boardPill(s);
  const status = !b.connected ? 'Offline' : `Connected · ${b.detecting ? 'detecting' : 'detection off'}`;
  const run = (a: BoardAction) => {
    setConfirm(null);
    void act({ type: 'board', action: a });
  };
  const disabled = !b.connected || !!b.busy;

  const actions: { a: BoardAction; title: string; sub: string; danger?: boolean }[] = [
    { a: 'reset', title: 'Reset', sub: 'Clears darts on the board' },
    b.detecting ? { a: 'stop', title: 'Stop detection', sub: 'Cameras pause' } : { a: 'start', title: 'Start detection', sub: 'Cameras resume' },
    { a: 'calibrate', title: 'Calibrate…', sub: '~60 s · confirm' },
    { a: 'restart', title: 'Restart…', sub: 'Board offline ~1 min', danger: true },
  ];

  const testing = s.boardTest !== null;
  const close = () => {
    if (testing) void act({ type: 'boardTest', on: false });
    onClose();
  };

  // The same buttons in the panel and in Test board, lower in the test so the events keep their room.
  const controls = (
    <div className="board-actions" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
      {actions.map(x => (
        <button key={x.a} disabled={disabled} onClick={() => (CONFIRM[x.a] ? setConfirm(x.a) : run(x.a))}
          style={{ height: testing ? 64 : 96, borderRadius: 22, background: x.danger ? 'var(--red-bg)' : 'var(--card2)', color: x.danger ? 'var(--red-soft)' : 'var(--text)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 4, padding: '0 18px', textAlign: 'left' }}>
          <span style={{ fontSize: 17, fontWeight: 800 }}>{x.title}</span>
          <span style={{ fontSize: 12, color: x.danger ? '#C9A3A5' : 'var(--muted2)' }}>{x.sub}</span>
        </button>
      ))}
    </div>
  );
  const dialog = confirm && CONFIRM[confirm] && (
    <Dialog title={CONFIRM[confirm]!.title} onClose={() => setConfirm(null)} actions={<>
      <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
      <button className={`btn ${confirm === 'restart' ? 'danger' : 'primary'}`} onClick={() => run(confirm)}>{CONFIRM[confirm]!.go}</button>
    </>}>
      <p>{CONFIRM[confirm]!.text}</p>
    </Dialog>
  );

  const body = testing ? <><BoardTest s={s} now={now} controls={controls} />{dialog}</> : (
    <>
      <section className="box">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 20, fontWeight: 800 }}><span className={`dot ${pill.dot}`} />{status}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '116px minmax(0, 1fr)', rowGap: 8, fontSize: 14 }}>
          <span className="muted">Address</span><span>{b.address}</span>
          <span className="muted">Board Manager</span><span>{b.version ? `v${b.version}` : '–'}</span>
          <span className="muted">Last event</span><span>{b.lastEvent ? `${b.lastEvent.text} · ${ago(b.lastEvent.at, now)}` : '–'}</span>
          {b.busy && <><span className="muted">Working</span><span>{b.busy.action === 'calibrate' ? 'Calibrating' : 'Restarting'} · {ago(b.busy.since, now).replace(' ago', '')}</span></>}
        </div>
      </section>
      <button className="btn" disabled={!b.connected} onClick={() => void act({ type: 'boardTest', on: true })}>Test board</button>
      <section className="box">
        <div className="option-row">
          <div>
            <div style={{ fontSize: 17, fontWeight: 800 }}>Fake board</div>
            <div style={{ fontSize: 12, color: 'var(--muted2)' }}>Click darts in a browser instead of throwing</div>
          </div>
          <Switch on={b.fake} label="Fake board" onChange={on => void act({ type: 'fakeBoard', on })} />
        </div>
        {b.fake && <a className="btn" style={{ textDecoration: 'none' }} href={`http://${location.hostname}:${b.address.split(':')[1]}/`} target="_blank" rel="noreferrer">Open fake board</a>}
      </section>
      {controls}
      {!wide && (
        <section className="box">
          <div className="caps" style={{ fontSize: 13 }}>This device</div>
          <div style={{ fontSize: 15, color: 'var(--soft)' }}>You are the pilot. The laptop shows the scoreboard only.</div>
          <button className="btn" onClick={onShowQr}>Show QR on the big screen</button>
        </section>
      )}
      <div style={{ marginTop: 'auto', fontSize: 13, color: 'var(--muted2)' }}>Camera and detection settings stay in Board Manager (:{b.address.split(':')[1] ?? '3180'}).</div>
      {dialog}
    </>
  );

  // A full screen on the laptop: the board as big as it fits, events beside it, nothing to scroll.
  if (wide && testing) return <div className="board-test-full">{body}</div>;
  if (wide) {
    return (
      <>
        <div className="scrim" onClick={close} />
        <aside className="drawer" aria-label="Board panel">
          <div className="option-row">
            <div style={{ fontSize: 32, fontWeight: 800 }}>Board</div>
            <button className="icon-btn" style={{ width: 52, height: 52, background: 'var(--raised)' }} aria-label="Close" onClick={close}>{Icon.close(22)}</button>
          </div>
          {body}
        </aside>
      </>
    );
  }
  return (
    <div className="phone">
      <header className="phone-header" style={{ padding: '0 8px' }}>
        <button className="icon-btn" style={{ background: 'transparent' }} aria-label="Back to the match" onClick={close}>{Icon.back(22)}</button>
        <h1>Board</h1>
      </header>
      <div className="phone-body">{body}</div>
    </div>
  );
}
