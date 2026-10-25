import { useState } from 'react';
import type { BoardAction, ClientState } from '../../../server/protocol.ts';
import { Dialog, Icon, act } from '../components/ui.tsx';
import { ago, useNow } from '../util.ts';
import { boardPill } from './Scoreboard.tsx';

const CONFIRM: Partial<Record<BoardAction, { title: string; text: string; go: string }>> = {
  calibrate: { title: 'Calibrate the board?', text: 'Takes about 60 s. Pull all darts out first. Detection pauses; the match stays where it is.', go: 'Calibrate' },
  restart: { title: 'Restart Board Manager?', text: 'The board is offline for about a minute. The match stays where it is; you can enter darts by hand meanwhile.', go: 'Restart' },
};

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

  const body = (
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        {actions.map(x => (
          <button key={x.a} disabled={disabled} onClick={() => (CONFIRM[x.a] ? setConfirm(x.a) : run(x.a))}
            style={{ height: 96, borderRadius: 22, background: x.danger ? 'var(--red-bg)' : 'var(--card2)', color: x.danger ? 'var(--red-soft)' : 'var(--text)', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', gap: 4, padding: '0 18px', textAlign: 'left' }}>
            <span style={{ fontSize: 17, fontWeight: 800 }}>{x.title}</span>
            <span style={{ fontSize: 12, color: x.danger ? '#C9A3A5' : 'var(--muted2)' }}>{x.sub}</span>
          </button>
        ))}
      </div>
      {!wide && (
        <section className="box">
          <div className="caps" style={{ fontSize: 13 }}>This device</div>
          <div style={{ fontSize: 15, color: 'var(--soft)' }}>You are the pilot. The laptop shows the scoreboard only.</div>
          <button className="btn" onClick={onShowQr}>Show QR on the big screen</button>
        </section>
      )}
      <div style={{ marginTop: 'auto', fontSize: 13, color: 'var(--muted2)' }}>Camera and detection settings stay in Board Manager (:{b.address.split(':')[1] ?? '3180'}).</div>
      {confirm && CONFIRM[confirm] && (
        <Dialog title={CONFIRM[confirm]!.title} onClose={() => setConfirm(null)} actions={<>
          <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
          <button className={`btn ${confirm === 'restart' ? 'danger' : 'primary'}`} onClick={() => run(confirm)}>{CONFIRM[confirm]!.go}</button>
        </>}>
          <p>{CONFIRM[confirm]!.text}</p>
        </Dialog>
      )}
    </>
  );

  if (wide) {
    return (
      <>
        <div className="scrim" onClick={onClose} />
        <aside className="drawer" aria-label="Board panel">
          <div className="option-row">
            <div style={{ fontSize: 32, fontWeight: 800 }}>Board</div>
            <button className="icon-btn" style={{ width: 52, height: 52, background: 'var(--raised)' }} aria-label="Close" onClick={onClose}>{Icon.close(22)}</button>
          </div>
          {body}
        </aside>
      </>
    );
  }
  return (
    <div className="phone">
      <header className="phone-header" style={{ padding: '0 8px' }}>
        <button className="icon-btn" style={{ background: 'transparent' }} aria-label="Back to the match" onClick={onClose}>{Icon.back(22)}</button>
        <h1>Board</h1>
      </header>
      <div className="phone-body">{body}</div>
    </div>
  );
}
