import { useEffect, useRef, useState } from 'react';
import type { Dart } from '../../games/darts.ts';
import type { ClientState } from '../../server/protocol.ts';
import type { FixTarget } from './components/FixSheet.tsx';
import { FixSheet } from './components/FixSheet.tsx';
import { HowToScreen } from './components/HowTo.tsx';
import { Dialog, Logo, Toasts, act, toast } from './components/ui.tsx';
import { endsNormally, isX01, visitDarts } from './match.ts';
import { onFx, useSnapshot } from './net.ts';
import { playCaller, playSound } from './sound.ts';
import { BoardPanel } from './screens/BoardPanel.tsx';
import { EffectsPage } from './screens/effects/index.tsx';
import { Lobby } from './screens/Lobby.tsx';
import { PhoneHome, PhonePilot, PhoneWatch } from './screens/Phone.tsx';
import { Players } from './screens/Players.tsx';
import { QrOverlay, Scoreboard } from './screens/Scoreboard.tsx';
import { Setup } from './screens/Setup.tsx';
import { StatsPage } from './screens/Stats.tsx';
import { Summary } from './screens/Summary.tsx';
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

function Menu({ s, wide, onClose, open }: { s: ClientState; wide: boolean; onClose: () => void; open: (what: 'new' | 'end' | Screen | 'qr' | 'bug' | 'close') => void }) {
  const pilot = s.you.isPilot;
  const item = (label: string, run: () => void, danger = false) => (
    <button key={label} className={`btn block ${danger ? 'danger' : ''}`} style={{ justifyContent: 'flex-start', height: 56 }} onClick={() => { onClose(); run(); }}>{label}</button>
  );
  // Pilot switches; the server keeps them, so they survive a restart.
  const toggles = (
    <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid var(--line)' }}><div className="seg" style={{ gridAutoColumns: '1fr' }}>
      <button aria-pressed={s.effects.sounds} onClick={() => void act({ type: 'effects', sounds: !s.effects.sounds })}>Sounds {s.effects.sounds ? 'on' : 'off'}</button>
      <button aria-pressed={s.effects.caller} onClick={() => void act({ type: 'effects', caller: !s.effects.caller })}>Caller {s.effects.caller ? 'on' : 'off'}</button>
      <button aria-pressed={s.effects.leds} onClick={() => void act({ type: 'effects', leds: !s.effects.leds })}>LEDs {s.effects.leds ? 'on' : 'off'}</button>
    </div></div>
  );
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="dialog" role="menu" aria-label="Menu" style={{ gap: 8, width: 'min(420px, calc(100vw - 32px))' }}>
        <h2 style={{ marginBottom: 8 }}>Menu</h2>
        {/* In a match only what the match needs. New match, Players and Stats are buttons on the main screen; Board panel and QR are in the header. */}
        {!pilot ? (
          <>
            {item('Take control', () => void act({ type: 'takeControl' }))}
            {!wide && item('Show QR', () => open('qr'))}
            {item('Stats', () => (location.href = '/stats'))}
            {item('Effects', () => (location.href = '/effects'))}
          </>
        ) : s.match ? (
          <>
            {item('How to play', () => open('howto'))}
            {!wide && item('Show QR', () => open('qr'))}
            {item('Effects', () => (location.href = '/effects'))}
            {item('End match', () => open('end'), true)}
          </>
        ) : (
          <>
            {!wide && item('Show QR', () => open('qr'))}
            {item('Effects', () => (location.href = '/effects'))}
            {s.you.isLocal && item('Close app', () => open('close'), true)}
          </>
        )}
        {item('Report a bug', () => open('bug'))}
        {/* Switches sit apart from the menu items, just above Close. */}
        {pilot && toggles}
        <button className="btn ghost block" style={{ marginTop: 8 }} onClick={onClose}>Close</button>
      </div>
    </>
  );
}

function BugDialog({ where, onClose }: { where: string; onClose: () => void }) {
  const [text, setText] = useState('');
  const send = async () => {
    const r = await act({ type: 'report', text, where, userAgent: navigator.userAgent });
    if (r.ok) {
      toast({ text: 'Bug reported. Thanks!' });
      onClose();
    }
  };
  return (
    <Dialog title="Report a bug" onClose={onClose} actions={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" disabled={!text.trim()} onClick={() => void send()}>Send</button>
    </>}>
      <p>What went wrong? The match so far is saved with the report.</p>
      <textarea className="field" autoFocus rows={5} maxLength={4000} value={text} onChange={e => setText(e.target.value)} aria-label="Bug description"
        style={{ height: 'auto', padding: '12px 16px', resize: 'vertical' }} />
    </Dialog>
  );
}

function Main({ s }: { s: ClientState }) {
  const wide = useWide();
  const [screen, setScreen] = useState<Screen>('main');
  const [menu, setMenu] = useState(false);
  const [fix, setFix] = useState<FixTarget | null>(null);
  const [endAsk, setEndAsk] = useState<null | 'end' | 'new'>(null);
  const [localQr, setLocalQr] = useState(false);
  const [bug, setBug] = useState(false);
  const [closeAsk, setCloseAsk] = useState(false);
  const wasPilot = useRef(s.you.isPilot);
  const resumedShown = useRef(false);
  const m = s.match;

  // Rule sounds and the caller play only in the kiosk browser on the laptop; phones stay silent.
  const isLocal = useRef(s.you.isLocal);
  isLocal.current = s.you.isLocal;
  useEffect(() => onFx(fx => {
    if (!isLocal.current) return;
    const effect = fx.sound ? playSound(fx.sound.url, fx.sound.gain) : undefined;
    if (fx.caller) playCaller(fx.caller.urls, fx.caller.gain, effect);
  }), []);

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
      void act({ type: 'closeMatch', then: then === 'new' ? 'lobby' : 'summary' }).then(r => r.ok && then === 'new' && setScreen('setup'));
    } else setEndAsk(then);
  };
  const doEnd = async (save: boolean) => {
    const then = endAsk;
    setEndAsk(null);
    const r = await act({ type: 'endMatch', save });
    if (r.ok && then === 'new') setScreen('setup');
  };

  const openFromMenu = (what: 'new' | 'end' | Screen | 'qr' | 'bug' | 'close') => {
    if (what === 'new' || what === 'end') askEnd(what);
    else if (what === 'bug') setBug(true);
    else if (what === 'close') setCloseAsk(true);
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
      {menu && <Menu s={s} wide={wide} onClose={() => setMenu(false)} open={openFromMenu} />}
      {endAsk && (
        <Dialog title="End this match?" onClose={() => setEndAsk(null)} actions={<>
          <button className="btn" onClick={() => setEndAsk(null)}>Keep playing</button>
          <button className="btn danger" onClick={() => doEnd(false)}>Discard</button>
          <button className="btn primary" onClick={() => doEnd(true)}>Save to stats</button>
        </>}>
          <p>The match isn't finished. Save keeps the darts in everyone's stats without a win or loss. Discard removes the match completely.</p>
        </Dialog>
      )}
      {closeAsk && (
        <Dialog title="Close the app?" onClose={() => setCloseAsk(false)} actions={<>
          <button className="btn" onClick={() => setCloseAsk(false)}>Cancel</button>
          <button className="btn danger" onClick={() => void act({ type: 'closeApp' })}>Close app</button>
        </>}>
          <p>This closes the kiosk and stops the server. Start it again with start.bat.</p>
        </Dialog>
      )}
      {bug && <BugDialog where={`${location.pathname} ${s.you.isPilot ? 'pilot' : 'watch'} ${wide ? 'wide' : 'phone'} screen=${pilotOnly}`} onClose={() => setBug(false)} />}
      {sheet}
    </>
  );

  if (pilotOnly === 'setup') return <><Setup s={s} onClose={() => setScreen('main')} />{dialogs}</>;
  if (pilotOnly === 'players') return <><Players s={s} onClose={() => setScreen('main')} />{dialogs}</>;
  if (pilotOnly === 'howto' && m) return <><HowToScreen game={m.game} options={m.options} onClose={() => setScreen('main')} />{dialogs}</>;
  if (pilotOnly === 'board' && !wide) {
    return <><BoardPanel s={s} wide={false} onClose={() => setScreen('main')} onShowQr={() => act({ type: 'showQr', show: true })} />{dialogs}</>;
  }

  if (!m && s.summary && pilotOnly !== 'board') return <><Summary s={s} wide={wide} onNew={() => setScreen('setup')} onMenu={() => setMenu(true)} />{dialogs}</>;

  if (wide) {
    const overlay = (
      <>
        {(s.showQr || localQr) && <QrOverlay s={s} onClose={() => (s.you.isPilot && s.showQr ? void act({ type: 'showQr', show: false }) : setLocalQr(false))} />}
        {pilotOnly === 'board' && <BoardPanel s={s} wide onClose={() => setScreen('main')} onShowQr={() => act({ type: 'showQr', show: true })} />}
        {dialogs}
      </>
    );
    return m
      ? <Scoreboard s={s} onMenu={() => setMenu(true)} onQr={toggleQr} onBoard={s.you.isPilot ? () => setScreen('board') : undefined} onFix={openFix} onEnd={() => askEnd('end')} overlay={overlay} />
      : <Lobby s={s} onMenu={() => setMenu(true)} onQr={toggleQr} onBoard={s.you.isPilot ? () => setScreen('board') : undefined} onNew={() => setScreen('setup')} onPlayers={() => setScreen('players')} overlay={overlay} />;
  }

  if (!s.you.isPilot) return <><PhoneWatch s={s} onMenu={() => setMenu(true)} />{dialogs}</>;
  return (
    <>
      {m
        ? <PhonePilot s={s} onMenu={() => setMenu(true)} onBoard={() => setScreen('board')} onFix={openFix} onEnd={() => askEnd('end')} />
        : <PhoneHome s={s} onMenu={() => setMenu(true)} onBoard={() => setScreen('board')} onNew={() => setScreen('setup')} onPlayers={() => setScreen('players')} />}
      {dialogs}
    </>
  );
}

export function App() {
  const path = usePath();
  const { state, connected } = useSnapshot();
  if (path.startsWith('/stats')) return <><StatsPage path={path} /><Toasts /></>;
  if (path.startsWith('/effects')) return <><EffectsPage /><Toasts /></>;
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
