import { useEffect, useRef, useState } from 'react';
import type { Dart } from '../../games/darts.ts';
import type { ClientState } from '../../server/protocol.ts';
import type { FixTarget } from './components/FixSheet.tsx';
import { FixSheet } from './components/FixSheet.tsx';
import { HowToScreen } from './components/HowTo.tsx';
import { Dialog, Logo, Toasts, act, toast } from './components/ui.tsx';
import { endsNormally, isX01, visitDarts } from './match.ts';
import { useSnapshot } from './net.ts';
import { BoardPanel } from './screens/BoardPanel.tsx';
import { Lobby } from './screens/Lobby.tsx';
import { PhoneHome, PhonePilot, PhoneWatch } from './screens/Phone.tsx';
import { Players } from './screens/Players.tsx';
import { QrOverlay, Scoreboard } from './screens/Scoreboard.tsx';
import { Setup } from './screens/Setup.tsx';
import { StatsPage } from './screens/Stats.tsx';
import { useWide } from './util.ts';

type Screen = 'main' | 'setup' | 'players' | 'board' | 'howto';

function usePath(): string {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const on = () => setPath(location.pathname);
    addEventListener('popstate', on);
    return () => removeEventListener('popstate', on);
  }, []);
  return path;
}

function Menu({ s, onClose, open }: { s: ClientState; onClose: () => void; open: (what: 'new' | 'end' | Screen | 'qr') => void }) {
  const pilot = s.you.isPilot;
  const item = (label: string, run: () => void, danger = false) => (
    <button key={label} className={`btn block ${danger ? 'danger' : ''}`} style={{ justifyContent: 'flex-start', height: 56 }} onClick={() => { onClose(); run(); }}>{label}</button>
  );
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dialog" role="menu" aria-label="Menu" style={{ gap: 8, width: 'min(420px, calc(100vw - 32px))' }}>
        <h2 style={{ marginBottom: 8 }}>Menu</h2>
        {pilot ? (
          <>
            {item('New match', () => open('new'))}
            {s.match && item('How to play', () => open('howto'))}
            {s.match && item('End match', () => open('end'))}
            {item('Board panel', () => open('board'))}
            {item('Players', () => open('players'))}
            {item('Show QR', () => open('qr'))}
            {item('Stats', () => (location.href = '/stats'))}
            {s.you.isLocal && item('Close app', () => void act({ type: 'closeApp' }), true)}
          </>
        ) : (
          <>
            {item('Take control', () => void act({ type: 'takeControl' }))}
            {item('Show QR', () => open('qr'))}
            {item('Stats', () => (location.href = '/stats'))}
          </>
        )}
        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={onClose}>Close</button>
      </div>
    </>
  );
}

function Main({ s }: { s: ClientState }) {
  const wide = useWide();
  const [screen, setScreen] = useState<Screen>('main');
  const [menu, setMenu] = useState(false);
  const [fix, setFix] = useState<FixTarget | null>(null);
  const [endAsk, setEndAsk] = useState<null | 'end' | 'new'>(null);
  const [localQr, setLocalQr] = useState(false);
  const wasPilot = useRef(s.you.isPilot);
  const resumedShown = useRef(false);
  const m = s.match;

  // Lost control: say who took it and offer it back.
  useEffect(() => {
    if (wasPilot.current && !s.you.isPilot && s.pilot) {
      toast({ text: `${s.pilot.deviceName} took control`, action: { label: 'Take back', run: () => void act({ type: 'takeControl' }) }, ms: 8000 });
      setScreen('main');
      setFix(null);
    }
    wasPilot.current = s.you.isPilot;
  }, [s.you.isPilot, s.pilot]);

  useEffect(() => {
    if (m?.resumed && s.you.isPilot && !resumedShown.current) {
      resumedShown.current = true;
      toast({ text: 'Match resumed after a restart', action: { label: 'End match', run: () => setEndAsk('end') }, ms: 10000 });
      void act({ type: 'dismissResumed' });
    }
  }, [m?.resumed, s.you.isPilot]);

  // The fix sheet belongs to one visit; close it when the visit moves on.
  const visitKey = m ? `${isX01(m) ? `${m.view.legNo}-${m.view.set}` : m.view.visit.darts.length === 0}-${m.view.current}-${m.view.phase}` : '';
  useEffect(() => setFix(null), [visitKey]);

  const openFix = (index: number) => {
    if (!m) return;
    const d = m.view.visit.darts[index];
    setFix({ index, dart: d ? d.dart : null });
  };
  const pickFix = (d: Dart) => {
    if (!fix) return;
    void act(fix.dart ? { type: 'fix', index: fix.index, dart: d } : { type: 'dart', dart: d });
    setFix(null);
  };

  const askEnd = (then: 'end' | 'new') => {
    if (!m) return then === 'new' && setScreen('setup');
    if (endsNormally(m)) {
      void act({ type: 'closeMatch', then: 'lobby' }).then(r => r.ok && then === 'new' && setScreen('setup'));
    } else setEndAsk(then);
  };
  const doEnd = async (save: boolean) => {
    const then = endAsk;
    setEndAsk(null);
    const r = await act({ type: 'endMatch', save });
    if (r.ok && then === 'new') setScreen('setup');
  };

  const openFromMenu = (what: 'new' | 'end' | Screen | 'qr') => {
    if (what === 'new' || what === 'end') askEnd(what);
    else if (what === 'qr') {
      if (s.you.isPilot) void act({ type: 'showQr', show: true });
      else setLocalQr(true);
    } else setScreen(what);
  };

  const toggleQr = () => {
    if (s.you.isPilot) void act({ type: 'showQr', show: !s.showQr });
    else setLocalQr(!localQr);
  };

  const pilotOnly = s.you.isPilot ? screen : 'main';
  const sheet = fix && m && (
    <FixSheet target={fix} visit={visitDarts(m)} wide={wide} who={m.roster[m.view.current].name} onPick={pickFix} onClose={() => setFix(null)} />
  );
  const dialogs = (
    <>
      {menu && <Menu s={s} onClose={() => setMenu(false)} open={openFromMenu} />}
      {endAsk && (
        <Dialog title="End this match?" onClose={() => setEndAsk(null)} actions={<>
          <button className="btn" onClick={() => setEndAsk(null)}>Keep playing</button>
          <button className="btn danger" onClick={() => doEnd(false)}>Discard</button>
          <button className="btn primary" onClick={() => doEnd(true)}>Save to stats</button>
        </>}>
          <p>The match isn't finished. Save keeps the darts in everyone's stats without a win or loss. Discard removes the match completely.</p>
        </Dialog>
      )}
      {sheet}
    </>
  );

  if (pilotOnly === 'setup') return <><Setup s={s} onClose={() => setScreen('main')} />{dialogs}</>;
  if (pilotOnly === 'players') return <><Players s={s} onClose={() => setScreen('main')} />{dialogs}</>;
  if (pilotOnly === 'howto' && m) return <><HowToScreen game={m.game} options={m.options} onClose={() => setScreen('main')} />{dialogs}</>;
  if (pilotOnly === 'board' && !wide) {
    return <><BoardPanel s={s} wide={false} onClose={() => setScreen('main')} onShowQr={() => act({ type: 'showQr', show: true })} />{dialogs}</>;
  }

  if (wide) {
    const overlay = (
      <>
        {(s.showQr || localQr) && <QrOverlay s={s} onClose={() => (s.you.isPilot && s.showQr ? void act({ type: 'showQr', show: false }) : setLocalQr(false))} />}
        {pilotOnly === 'board' && <BoardPanel s={s} wide onClose={() => setScreen('main')} onShowQr={() => act({ type: 'showQr', show: true })} />}
        {dialogs}
      </>
    );
    return m
      ? <Scoreboard s={s} onMenu={() => setMenu(true)} onQr={toggleQr} onFix={openFix} onEnd={() => askEnd('end')} onNew={() => askEnd('new')} overlay={overlay} />
      : <Lobby s={s} onMenu={() => setMenu(true)} onQr={toggleQr} onNew={() => setScreen('setup')} overlay={overlay} />;
  }

  if (!s.you.isPilot) return <><PhoneWatch s={s} onMenu={() => setMenu(true)} />{dialogs}</>;
  return (
    <>
      {m
        ? <PhonePilot s={s} onMenu={() => setMenu(true)} onBoard={() => setScreen('board')} onFix={openFix} onEnd={() => askEnd('end')} onNew={() => askEnd('new')} />
        : <PhoneHome s={s} onMenu={() => setMenu(true)} onBoard={() => setScreen('board')} onNew={() => setScreen('setup')} onPlayers={() => setScreen('players')} />}
      {dialogs}
    </>
  );
}

export function App() {
  const path = usePath();
  const { state, connected } = useSnapshot();
  if (path.startsWith('/stats')) return <><StatsPage path={path} /><Toasts /></>;
  return (
    <>
      {!connected && state && <div className="banner" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 80 }}>Lost connection to ITDarts · reconnecting…</div>}
      {state ? <Main s={state} /> : (
        <div className="center-msg" style={{ height: '100%' }}>
          <Logo />
          <p>{connected ? 'Loading…' : 'Connecting to ITDarts…'}</p>
        </div>
      )}
      <Toasts />
    </>
  );
}
