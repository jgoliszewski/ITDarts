import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Coords, Dart } from '../../games/darts.ts';
import type { ClientState } from '../../server/protocol.ts';
import type { FixTarget } from './components/FixSheet.tsx';
import { FixSheet } from './components/FixSheet.tsx';
import { RemoveDialog } from './components/RemoveDialog.tsx';
import { HowToScreen } from './components/HowTo.tsx';
import { Dialog, Logo, Presence, Toasts, act, toast } from './components/ui.tsx';
import type { LobbyRecord } from '../../server/protocol.ts';
import { endsNormally, isX01, presetFor } from './match.ts';
import { onFx, useSnapshot } from './net.ts';
import { playCaller, playSound, setMaster } from './sound.ts';
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

/** Fades the app in when `key` changes (not on the first render). Opacity only, so it stays under reduced motion. */
function useScreenFade(key: string) {
  const prev = useRef(key);
  useLayoutEffect(() => {
    if (prev.current === key) return;
    prev.current = key;
    // The tokens from styles.css; the build may write 200ms as .2s.
    const css = getComputedStyle(document.documentElement);
    const dur = css.getPropertyValue('--dur-base').trim();
    document.getElementById('root')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: parseFloat(dur) * (dur.endsWith('ms') ? 1 : 1000), easing: css.getPropertyValue('--ease-out').trim() });
  }, [key]);
}

/**
 * Master volume over everything the kiosk plays, and Mute (docs/EFEKTY.md, Dźwięk). The slider saves when let go and the
 * server then plays a short Next player sound on the kiosk at the new level, from any Pilot. Mute leaves Sounds and
 * Caller as they are and greys the slider out.
 */
function MasterVolume({ s }: { s: ClientState }) {
  const [moving, setMoving] = useState<number | null>(null);
  const level = moving ?? s.effects.master;
  const muted = s.effects.muted;
  const commit = async () => {
    if (moving === null) return;
    await act({ type: 'effects', master: moving });
    setMoving(null);
  };
  return (
    <div className="master-volume">
      <div className="master-head"><b>Volume</b><span className="num">{muted ? `Muted · ${level}%` : `${level}%`}</span></div>
      <div className="master-controls">
        <input type="range" min={0} max={100} step={5} value={level} disabled={muted} aria-label="Volume" aria-valuetext={`${level} percent`}
          onChange={e => setMoving(Number(e.target.value))} onPointerUp={() => void commit()} onKeyUp={() => void commit()} onBlur={() => void commit()} />
        <button className="btn" aria-pressed={muted} onClick={() => void act({ type: 'effects', muted: !muted })}>{muted ? 'Unmute' : 'Mute'}</button>
      </div>
    </div>
  );
}

function Menu({ s, wide, onClose, open }: { s: ClientState; wide: boolean; onClose: () => void; open: (what: 'new' | 'end' | Screen | 'qr' | 'bug' | 'close') => void }) {
  const pilot = s.you.isPilot;
  const item = (label: string, run: () => void, danger = false) => (
    <button key={label} className={`btn block menu-item ${danger ? 'danger' : ''}`} onClick={() => { onClose(); run(); }}>{label}</button>
  );
  // The one destructive item goes last, apart from the rest (A#14).
  const end = pilot && (s.match ? item('End match', () => open('end'), true) : s.you.isLocal && item('Close app', () => open('close'), true));
  return (
    <Dialog title="Menu" className="menu" onClose={onClose} actions={<button className="btn ghost block" onClick={onClose}>Close</button>}>
      {/* In a match only what the match needs. New match, Players and Stats are buttons on the main screen; Board panel is in the header. */}
      {!pilot ? (
        <>
          {item('Take control', () => void act({ type: 'takeControl' }))}
          {item('Stats', () => (location.href = '/stats'))}
          {item('Effects', () => (location.href = '/effects'))}
        </>
      ) : (
        <>
          {s.match && item('How to play', () => open('howto'))}
          {!wide && item('Show QR', () => open('qr'))}
          {item('Effects', () => (location.href = '/effects'))}
        </>
      )}
      {item('Report a bug', () => open('bug'))}
      {/* Pilot switches; the server keeps them, so they survive a restart. */}
      {pilot && (
        <div className="menu-group"><MasterVolume s={s} /><div className="seg">
          <button aria-pressed={s.effects.sounds} onClick={() => void act({ type: 'effects', sounds: !s.effects.sounds })}>Sounds {s.effects.sounds ? 'on' : 'off'}</button>
          <button aria-pressed={s.effects.caller} onClick={() => void act({ type: 'effects', caller: !s.effects.caller })}>Caller {s.effects.caller ? 'on' : 'off'}</button>
          <button aria-pressed={s.effects.leds} onClick={() => void act({ type: 'effects', leds: !s.effects.leds })}>LEDs {s.effects.leds ? 'on' : 'off'}</button>
        </div></div>
      )}
      {end && <div className="menu-group">{end}</div>}
    </Dialog>
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
  // A record tile in the lobby opens New match with its game and options (D6).
  const [preset, setPreset] = useState<Pick<LobbyRecord, 'game' | 'options'> | null>(null);
  const [menu, setMenu] = useState(false);
  const [fix, setFix] = useState<FixTarget | null>(null);
  const [removeOf, setRemoveOf] = useState<number | null>(null);
  const [endAsk, setEndAsk] = useState<null | 'end' | 'new'>(null);
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
  const pickFix = (d: Dart, coords?: Coords) => {
    if (!fix) return;
    void act(fix.dart ? { type: 'fix', index: fix.index, dart: d, ...(coords && { coords }) } : { type: 'dart', dart: d, ...(coords && { coords }) });
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
    else if (what === 'qr') void act({ type: 'showQr', show: true });
    else setScreen(what);
  };

  const openRecord = (r: LobbyRecord) => { setPreset({ game: r.game, options: r.options }); setScreen('setup'); };
  const pilotOnly = s.you.isPilot ? screen : 'main';
  // A record's preset is one-shot: leaving the setup in any way (or losing control) drops it (review t04).
  useEffect(() => setPreset(p => presetFor(p, pilotOnly)), [pilotOnly]);
  const sheet = fix && m && (
    // Keyed by width: turning to the wide layout swaps the sheet's box, and the new box needs its own focus trap.
    <FixSheet key={wide ? 'wide' : 'sheet'} target={fix} visit={m.view.visit.darts} wide={wide} who={m.roster[m.view.current].name} onPick={pickFix} onClose={() => setFix(null)} />
  );
  const dialogs = (
    <>
      <Presence>{menu && <Menu s={s} wide={wide} onClose={() => setMenu(false)} open={openFromMenu} />}</Presence>
      <Presence>{endAsk && (
        <Dialog title="End this match?" onClose={() => setEndAsk(null)} actions={<>
          <button className="btn" onClick={() => setEndAsk(null)}>Keep playing</button>
          <button className="btn danger" onClick={() => doEnd(false)}>Discard</button>
          <button className="btn primary" onClick={() => doEnd(true)}>Save to stats</button>
        </>}>
          <p>{m?.game === 'randomco' && m.view.phase === 'throwing'
            ? "Save ends the game: the most checkouts wins, and the darts go into everyone's stats. Discard removes the match completely."
            : m?.game === 'catch40' && m.view.phase === 'throwing'
            ? "Save ends the game: the most points wins, and the darts go into everyone's stats, but not into the records. Discard removes the match completely."
            : m?.game === 'bobs27' && m.view.phase === 'throwing'
            ? "Save ends the game: the best score of those still in wins, and the darts go into everyone's stats, but not into the records. Discard removes the match completely."
            : "The match isn't finished. Save keeps the darts in everyone's stats without a win or loss. Discard removes the match completely."}</p>
        </Dialog>
      )}</Presence>
      <Presence>{closeAsk && (
        <Dialog title="Close the app?" onClose={() => setCloseAsk(false)} actions={<>
          <button className="btn" onClick={() => setCloseAsk(false)}>Cancel</button>
          <button className="btn danger" onClick={() => void act({ type: 'closeApp' })}>Close app</button>
        </>}>
          <p>This closes the kiosk and stops the server. Start it again with start.bat.</p>
        </Dialog>
      )}</Presence>
      <Presence>{bug && <BugDialog where={`${location.pathname} ${s.you.isPilot ? 'pilot' : 'watch'} ${wide ? 'wide' : 'phone'} screen=${pilotOnly}`} onClose={() => setBug(false)} />}</Presence>
      <Presence>{sheet}</Presence>
      <Presence>{removeOf !== null && m && <RemoveDialog m={m} player={removeOf} onClose={() => setRemoveOf(null)} onEndMatch={() => askEnd('end')} />}</Presence>
    </>
  );

  // Screen changes fade in (DESIGN.md, Ruch: crossfade ~200 ms). The key names the screen, never match data, so a new
  // dart or a new active player never fades anything.
  const screenKey = pilotOnly === 'setup' || pilotOnly === 'players' || (pilotOnly === 'howto' && m) || (pilotOnly === 'board' && !wide)
    ? pilotOnly
    : !m && s.summary && pilotOnly !== 'board' ? 'summary'
      : wide ? (m ? 'scoreboard' : 'lobby')
        : !s.you.isPilot ? 'watch' : m ? 'pilot' : 'home';
  useScreenFade(screenKey);

  if (pilotOnly === 'setup') return <><Setup s={s} preset={preset} onClose={() => setScreen('main')} />{dialogs}</>;
  if (pilotOnly === 'players') return <><Players s={s} onClose={() => setScreen('main')} />{dialogs}</>;
  if (pilotOnly === 'howto' && m) return <><HowToScreen game={m.game} options={m.options} onClose={() => setScreen('main')} />{dialogs}</>;
  if (pilotOnly === 'board' && !wide) {
    return <><BoardPanel s={s} wide={false} onClose={() => setScreen('main')} onShowQr={() => act({ type: 'showQr', show: true })} />{dialogs}</>;
  }

  if (!m && s.summary && pilotOnly !== 'board') return <><Summary s={s} wide={wide} onNew={() => setScreen('setup')} onMenu={() => setMenu(true)} />{dialogs}</>;

  if (wide) {
    const overlay = (
      <>
        {s.showQr && <QrOverlay s={s} onClose={() => { if (s.you.isPilot) void act({ type: 'showQr', show: false }); }} />}
        <Presence>{pilotOnly === 'board' && <BoardPanel s={s} wide onClose={() => setScreen('main')} onShowQr={() => act({ type: 'showQr', show: true })} />}</Presence>
        {dialogs}
      </>
    );
    return m
      ? <Scoreboard s={s} onMenu={() => setMenu(true)} onBoard={s.you.isPilot ? () => setScreen('board') : undefined} onFix={openFix} onEnd={() => askEnd('end')} onPlayer={s.you.isPilot ? setRemoveOf : undefined} overlay={overlay} />
      : <Lobby s={s} onMenu={() => setMenu(true)} onBoard={s.you.isPilot ? () => setScreen('board') : undefined} onNew={() => setScreen('setup')} onPlayers={() => setScreen('players')} overlay={overlay} />;
  }

  if (!s.you.isPilot) return <><PhoneWatch s={s} onMenu={() => setMenu(true)} />{dialogs}</>;
  return (
    <>
      {m
        ? <PhonePilot s={s} onMenu={() => setMenu(true)} onBoard={() => setScreen('board')} onFix={openFix} onEnd={() => askEnd('end')} onPlayer={setRemoveOf} />
        : <PhoneHome s={s} onMenu={() => setMenu(true)} onBoard={() => setScreen('board')} onNew={() => setScreen('setup')} onRecord={openRecord} onPlayers={() => setScreen('players')} />}
      {dialogs}
    </>
  );
}

export function App() {
  const path = usePath();
  const { state, connected } = useSnapshot();
  // Every page of this browser plays through the master: the kiosk, and the previews on /effects.
  const master = state?.effects.master, muted = state?.effects.muted;
  useEffect(() => { if (master !== undefined) setMaster(master, !!muted); }, [master, muted]);
  if (path.startsWith('/stats')) return <><StatsPage path={path} /><Toasts /></>;
  if (path.startsWith('/effects')) return <><EffectsPage /><Toasts /></>;
  return (
    <>
      {!connected && state && <div className="banner fixed">Lost connection to ITDarts · reconnecting…</div>}
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
