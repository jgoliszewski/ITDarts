// Game icons (docs/UI.md, Ikony gier): line icons on the 24 grid like the rest of the app, one per game.
import type { ReactNode } from 'react';
import type { GameId } from '../../../games/index.ts';

const dot = (cx: number, cy: number, r = 1.3) => <circle cx={cx} cy={cy} r={r} fill="currentColor" stroke="none" />;

const PATHS: Record<GameId, ReactNode> = {
  // Board with a crosshair.
  x01: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" />{dot(12, 12)}<path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" /></>,
  // Round arrow about the bull.
  atc: <><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 3.5v4h-4" />{dot(12, 12, 1.6)}</>,
  // Board in quarters, one quarter ticked off.
  fullboard: <><circle cx="12" cy="12" r="9" /><path d="M12 3v18M3 12h18" /><path d="M13.8 8.2l1.7 1.7 3-3.4" /></>,
  // Ladder of targets.
  '121': <path d="M7 2.5v19M17 2.5v19M7 7h10M7 12h10M7 17h10" />,
  // Dice.
  randomco: <><rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />{dot(8.5, 8.5)}{dot(12, 12)}{dot(15.5, 15.5)}</>,
  // Closed sector mark.
  cricket: <><circle cx="12" cy="12" r="9" /><path d="M8 8l8 8M16 8l-8 8" /></>,
  // Skull.
  killer: <><path d="M12 3a7.5 7.5 0 0 0-7.5 7.5c0 2.6 1.3 4.4 3 5.5v3a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-3c1.7-1.1 3-2.9 3-5.5A7.5 7.5 0 0 0 12 3z" /><circle cx="9" cy="11" r="1.6" /><circle cx="15" cy="11" r="1.6" /><path d="M10.5 20v-2.5M13.5 20v-2.5" /></>,
  // Up and down.
  hol: <path d="M8 20V4M4 8l4-4 4 4M16 4v16M12 16l4 4 4-4" />,
  // Single, double, treble.
  shanghai: <><rect x="3" y="14" width="4.5" height="6.5" rx="1" /><rect x="9.75" y="9" width="4.5" height="11.5" rx="1" /><rect x="16.5" y="3.5" width="4.5" height="17" rx="1" /></>,
  // Back to zero.
  gotcha: <><ellipse cx="7" cy="16" rx="3" ry="4.5" /><path d="M20 16C20 8 14 5 9 7.5" /><path d="M12.4 8.3L9 7.5l1.4-3.2" /></>,
  // A life.
  knockout: <path d="M12 20.5s-7.5-4.6-9.4-9.4A5 5 0 0 1 12 6.4a5 5 0 0 1 9.4 4.7C19.5 15.9 12 20.5 12 20.5z" />,
  // Ball.
  football: <><circle cx="12" cy="12" r="9" /><path d="M12 8.6l3.2 2.3-1.2 3.8h-4l-1.2-3.8z" /><path d="M12 8.6V3M15.2 10.9l5.4-1.8M14 14.7l3.3 4.6M10 14.7l-3.3 4.6M8.8 10.9L3.4 9.1" /></>,
  // A dart in flight.
  freethrow: <><path d="M3.5 20.5l3-3" /><path d="M6.5 17.5l9-9" /><path d="M13 6l1-3.5 1.5 1.5M18 11l3.5-1-1.5-1.5" /><path d="M15.5 8.5L19 5" /></>,
  // A dart in the bull.
  bullseye: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" />{dot(12, 12, 1.6)}<path d="M13.4 10.6l6-6M17 3.5h2.5V6" /></>,
};

/** One game's icon in the text colour; `stroke` is thinner when drawn big as a tile's background. */
export function GameIcon({ game, size = 20, stroke = 2, className }: { game: GameId; size?: number; stroke?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[game]}
    </svg>
  );
}
