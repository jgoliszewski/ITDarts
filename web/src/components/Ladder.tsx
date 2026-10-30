// 121 ladder of targets with the record flag, and the odometer for the target (docs/GRY.md#121).
import { useRef } from 'react';
import { START_TARGET } from '../../../games/121.ts';

/** Targets ahead of the current one on the ladder. */
export const AHEAD = 3;

export interface Rung {
  /** null is the empty field before the first target. */
  target: number | null;
  done: boolean;
  current: boolean;
  /** The office record stands here; 'far' pins it to the right edge when the record is beyond the window. */
  flag: 'here' | 'far' | null;
}

/**
 * The window of the ladder: the last target checked out, the current one and `AHEAD` more. The flag sits on the
 * record's field, hangs on the right edge while the record is further ahead, and disappears once it is beaten and
 * out of the window.
 */
export function ladderWindow(target: number, record: number | null): Rung[] {
  const rungs: Rung[] = [];
  for (let t = target - 1; t <= target + AHEAD; t++) {
    const shown = t >= START_TARGET;
    rungs.push({ target: shown ? t : null, done: shown && t < target, current: t === target, flag: shown && record === t ? 'here' : null });
  }
  if (record !== null && record > target + AHEAD) rungs[rungs.length - 1].flag = 'far';
  return rungs;
}

/** Remembers the previous value across renders and says how it moved. */
function useStep(value: number): number {
  const prev = useRef(value);
  const step = value - prev.current;
  prev.current = value;
  return step;
}

export function Ladder({ target, record }: { target: number; record: number | null }) {
  // A checkout moves the ladder one field left; the field sliding out stays in the track so there is no gap.
  const slide = useStep(target) === 1;
  const rungs = ladderWindow(target, record);
  const outgoing = target - 2 >= START_TARGET ? target - 2 : null;
  return (
    <div className="ladder" aria-label={`Target ${target}${record ? `, office record ${record}` : ''}`}>
      <div key={slide ? target : 'still'} className={`track ${slide ? 'slide' : ''}`}>
        <div className="rung done out">{outgoing !== null && <><span className="num">{outgoing}</span><span className="check">✓</span></>}</div>
        {rungs.map((r, i) => (
          <div key={i} className={`rung ${r.done ? 'done' : ''} ${r.current ? 'current' : ''}`}>
            {r.flag && <span className={`flag ${r.flag}`}>Best {record}{r.flag === 'far' ? ' →' : ''}</span>}
            {r.target !== null && <span className="num">{r.target}</span>}
            {r.done && <span className="check">✓</span>}
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
