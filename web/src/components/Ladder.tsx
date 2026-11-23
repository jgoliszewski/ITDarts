// 121 ladder of targets as a vertical chain of numbered dots with the record flags, and the odometer for the target (docs/GRY.md#121).
import { useState } from 'react';
import { START_TARGET } from '../../../games/121.ts';
import type { LadderMark } from '../records.ts';
import { stepOf } from './interaction.ts';

/** Targets ahead of the current one on the ladder. */
export const AHEAD = 3;

export interface LadderFlag extends LadderMark {
  /** Pinned to the right edge: the record is beyond the window. */
  far: boolean;
  /** Checked out in this game: the rung is green and the flag gets a tick. */
  beaten: boolean;
}

export interface Rung {
  /** null is the empty field before the first target. */
  target: number | null;
  done: boolean;
  current: boolean;
  /** The records that stand here, in the order of `marks`. */
  flags: LadderFlag[];
}

/**
 * The window of the ladder: the last target checked out, the current one and `AHEAD` more. A flag sits on its record's
 * field, hangs on the right edge while the record is further ahead, and disappears once it is beaten and out of the window.
 */
export function ladderWindow(target: number, marks: LadderMark[]): Rung[] {
  const rungs: Rung[] = [];
  for (let t = target - 1; t <= target + AHEAD; t++) {
    const shown = t >= START_TARGET;
    const flags = shown ? marks.filter(m => m.value === t).map(m => ({ ...m, far: false, beaten: t < target })) : [];
    rungs.push({ target: shown ? t : null, done: shown && t < target, current: t === target, flags });
  }
  rungs[rungs.length - 1].flags.push(...marks.filter(m => m.value > target + AHEAD).map(m => ({ ...m, far: true, beaten: false })));
  return rungs;
}

/**
 * How the value moved last time. The step holds until the value changes again, so later renders (every snapshot from
 * the server) keep the same key and class and the slide or roll it started plays to the end. Derived state, so the
 * render stays pure under StrictMode. Keep `stepOf` in state, not in a ref: a ref written during render gave step 0
 * on the next snapshot and cut the slide off (K10/K11 in the motion audit). No test covers this wiring (vitest has no
 * DOM); the live check is in .scratch/ui-overhaul/t02/EVIDENCE.md.
 */
function useStep(value: number): number {
  const [last, setLast] = useState(() => stepOf(null, value));
  const next = stepOf(last, value);
  if (next !== last) setLast(next);
  return next.step;
}

/** `onOpen` makes the flags buttons that open the records modal. */
export function Ladder({ target, marks, onOpen }: { target: number; marks: LadderMark[]; onOpen?: () => void }) {
  // A checkout moves the ladder one step up; the step going out stays in the track so there is no gap.
  const slide = useStep(target) === 1;
  const rungs = ladderWindow(target, marks);
  const outgoing = target - 2 >= START_TARGET ? target - 2 : null;
  return (
    <div className="ladder" aria-label={`Target ${target}${marks.map(m => `, ${m.label} ${m.value}`).join('')}`}>
      <div key={slide ? target : 'still'} className={`track ${slide ? 'slide' : ''}`}>
        <div className={`rung done ${outgoing === null ? 'blank' : ''}`}>{outgoing !== null && <span className="dot">{outgoing}</span>}</div>
        {rungs.map((r, i) => (
          <div key={i} className={`rung ${r.done ? 'done' : ''} ${r.current ? 'current' : ''} ${r.target === null ? 'blank' : ''}`}>
            {r.target !== null && <span className="dot">{r.target}</span>}
            {r.flags.map((f, k) => (
              <span key={f.kind} className={`flag ${f.kind} ${f.far ? 'far' : 'here'} ${f.beaten ? 'beaten' : ''} ${k ? 'second' : ''}`}
                {...(onOpen ? { role: 'button', tabIndex: 0, onClick: onOpen, onKeyDown: (e: { key: string }) => e.key === 'Enter' && onOpen() } : {})}>
                {f.label} {f.value}{f.far ? ' ↓' : ''}{f.beaten ? ' ✓' : ''}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A number whose changed digits roll up like a counter when it grows; any other change is shown at once. */
export function Odometer({ value }: { value: number }) {
  const step = useStep(value);
  const now = String(value), before = String(value - step);
  const roll = step > 0 && before.length === now.length;
  return (
    <span className="odometer" aria-label={now}>
      {[...now].map((d, i) => (
        roll && before[i] !== d
          ? <span key={`${i}-${value}`} className="digit roll"><span className="stack"><span>{before[i]}</span><span>{d}</span></span></span>
          : <span key={i} className="digit">{d}</span>
      ))}
    </span>
  );
}
