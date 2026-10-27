import { useEffect, useState } from 'react';
import type { Dart } from '../../../games/darts.ts';
import { BOARD_ORDER, label, value } from '../../../games/darts.ts';
import { Dartboard } from './Dartboard.tsx';

export interface FixTarget {
  /** Dart index in the visit. */
  index: number;
  /** What the board read; null when adding a missing dart. */
  dart: Dart | null;
}

const same = (a: Dart | null, n: number, m: number) => !!a && a.n === n && a.m === m;

function Key({ n, m, cur, onPick, small, bare }: { n: number; m: 1 | 2 | 3; cur: Dart | null; onPick: (d: Dart) => void; small?: boolean; bare?: boolean }) {
  const d = { n, m };
  return (
    <button className={`key ${small ? 'sm' : ''} ${same(cur, n, m) ? 'on' : ''}`} onClick={() => onPick(d)} aria-label={label(d)}>
      <b>{bare ? n : label(d)}</b>
      {!small && <small>{value(d)}</small>}
    </button>
  );
}

/** The keypad from the “All” tab: Single/Double/Triple and 1–20. */
export function Keypad({ cur, onPick }: { cur: Dart | null; onPick: (d: Dart) => void }) {
  const [mult, setMult] = useState<1 | 2 | 3>(cur && cur.n > 0 && cur.n <= 20 ? cur.m : 1);
  return (
    <>
      <div className="mult-row">
        {([['Single', 1], ['Double', 2], ['Triple', 3]] as const).map(([l, m]) => (
          <button key={m} aria-pressed={mult === m} onClick={() => setMult(m)}>{l}</button>
        ))}
      </div>
      <div className="num-grid">
        {Array.from({ length: 20 }, (_, i) => <Key key={i} n={i + 1} m={mult} cur={cur} onPick={onPick} small bare />)}
      </div>
      <Others cur={cur} onPick={onPick} />
    </>
  );
}

function Others({ cur, onPick }: { cur: Dart | null; onPick: (d: Dart) => void }) {
  return (
    <div className="fix-grid">
      <span className="rl">Other</span>
      <Key n={0} m={1} cur={cur} onPick={onPick} small />
      <Key n={25} m={1} cur={cur} onPick={onPick} small />
      <Key n={25} m={2} cur={cur} onPick={onPick} small />
    </div>
  );
}

function Nearby({ cur, onPick }: { cur: Dart | null; onPick: (d: Dart) => void }) {
  const base = cur && cur.n >= 1 && cur.n <= 20 ? cur.n : 20;
  const i = BOARD_ORDER.indexOf(base);
  const cols = [BOARD_ORDER[(i + 19) % 20], base, BOARD_ORDER[(i + 1) % 20]];
  return (
    <>
      <div className="fix-grid">
        <span />
        {cols.map(n => <span key={n} className="cl">{n === base && cur ? `${n} · READ` : n}</span>)}
      </div>
      {([['Double', 2], ['Single', 1], ['Triple', 3]] as const).map(([name, m]) => (
        <div key={m} className="fix-grid">
          <span className="rl">{name}</span>
          {cols.map(n => <Key key={n} n={n} m={m} cur={cur} onPick={onPick} />)}
        </div>
      ))}
      <Others cur={cur} onPick={onPick} />
    </>
  );
}

export function FixSheet({ target, visit, wide, who, onPick, onClose }: {
  target: FixTarget;
  visit: Dart[];
  wide: boolean;
  who: string;
  onPick: (d: Dart) => void;
  onClose: () => void;
}) {
  const adding = target.dart === null;
  const [tab, setTab] = useState<'nearby' | 'all'>(adding ? 'all' : 'nearby');
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);

  const title = adding ? `Add dart ${target.index + 1}` : `Fix dart ${target.index + 1}`;
  const head = (
    <div className="sheet-head">
      <b>{title}</b>
      <span>{adding ? who : <>read as <b style={{ color: 'var(--text)', fontSize: 14 }}>{label(target.dart!)}</b></>}</span>
      {/* On the wide screen Cancel sits in the header so the keypad fits without scrolling. */}
      {wide && <button className="btn danger" onClick={onClose}>Cancel</button>}
    </div>
  );
  const tabs = (
    <div className="seg" role="tablist">
      <button role="tab" aria-pressed={tab === 'nearby'} onClick={() => setTab('nearby')}>Nearby</button>
      <button role="tab" aria-pressed={tab === 'all'} onClick={() => setTab('all')}>All</button>
    </div>
  );
  const pad = tab === 'nearby' ? <Nearby cur={target.dart} onPick={onPick} /> : <Keypad cur={target.dart} onPick={onPick} />;

  if (wide) {
    return (
      <>
        <div className="scrim" onClick={onClose} />
        <div className="wide-fix" role="dialog" aria-modal="true" aria-label={title}>
          <div className="left">
            {head}
            {tabs}
            {pad}
          </div>
          <div className="board-wrap">
            <Dartboard marks={visit} selected={target.dart} onPick={onPick} size={900} />
            <p className="muted">Or tap where the dart really landed, outside the board for a miss.</p>
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="grab" />
        {head}
        {tabs}
        {pad}
        <button className="btn block" onClick={onClose}>Cancel</button>
      </div>
    </>
  );
}
