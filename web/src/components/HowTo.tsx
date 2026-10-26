// “How to play”: the game's own text in a fixed layout, on the pilot or on the big screen.
import { useState } from 'react';
import type { GameId } from '../../../games/index.ts';
import { GAMES } from '../../../games/index.ts';
import type { OptionDef } from '../../../games/turns.ts';
import type { ClientState } from '../../../server/protocol.ts';
import { Icon, act } from './ui.tsx';

export function HowToButton({ onClick, compact }: { onClick: () => void; compact?: boolean }) {
  return (
    <button className={`howto-btn ${compact ? 'compact' : ''}`} onClick={onClick}>
      <span className="q">?</span>How to play
    </button>
  );
}

/** A small “i” that unfolds one sentence about an option. */
export function Info({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={`info-btn ${open ? 'on' : ''}`} aria-label="What is this?" aria-expanded={open} onClick={() => setOpen(!open)}>i</button>
      {open && <div className="info-text">{text}</div>}
    </>
  );
}

function OptionLine({ d, options }: { d: OptionDef<any>; options: Record<string, unknown> | null }) {
  return (
    <li>
      <b>{d.label}</b>
      {d.choices.length > 0 && (
        <span className="choices">
          {d.choices.map(([v, l]) => <span key={String(v)} className={options && d.key && options[d.key] === v ? 'on' : ''}>{l}</span>)}
        </span>
      )}
      <span className="muted">{d.info}</span>
    </li>
  );
}

export function HowToBody({ game, options }: { game: GameId; options: unknown }) {
  const g = GAMES[game];
  const o = options ? (g.normalizeOptions(options) as Record<string, unknown>) : null;
  const parts: [string, string][] = [['Goal', g.howTo.goal], ['Your turn', g.howTo.turn], ['What counts', g.howTo.counts], ['How to win', g.howTo.win]];
  return (
    <div className="howto">
      {parts.map(([h, text]) => <section key={h}><h3>{h}</h3><p>{text}</p></section>)}
      <section>
        <h3>Options</h3>
        <ul>{g.options.map(d => <OptionLine key={d.label} d={d} options={o} />)}</ul>
      </section>
    </div>
  );
}

/** Full-screen on the pilot, with “Show on screen” for the big screen. */
export function HowToScreen({ game, options, onClose }: { game: GameId; options: unknown; onClose: () => void }) {
  return (
    <div className="howto-screen">
      <div className="phone" style={{ maxWidth: 720 }}>
        <header className="phone-header">
          <button className="icon-btn" style={{ background: 'transparent' }} aria-label="Back" onClick={onClose}>{Icon.back(22)}</button>
          <h1>{GAMES[game].name} · How to play</h1>
        </header>
        <div className="phone-body">
          <HowToBody game={game} options={options} />
        </div>
        <div className="p-actions">
          <button className="btn" onClick={() => act({ type: 'showHowTo', game, options })}>Show on screen</button>
          <button className="btn primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/** On the scoreboard or lobby while the pilot shows it there. The pilot or the first dart closes it. */
export function HowToOverlay({ s }: { s: ClientState }) {
  const h = s.howTo;
  if (!h) return null;
  return (
    <div className="overlay howto-overlay">
      <div className="howto-card">
        <div className="option-row">
          <div className="kicker">HOW TO PLAY · {GAMES[h.game].name.toUpperCase()}</div>
          {s.you.isPilot && <button className="btn primary" onClick={() => act({ type: 'showHowTo', game: null })}>Close</button>}
        </div>
        <HowToBody game={h.game} options={h.options} />
      </div>
    </div>
  );
}
