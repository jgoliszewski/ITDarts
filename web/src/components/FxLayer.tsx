// Scoreboard animations (docs/EFEKTY.md): hard-coded, never block the pilot, gone within about 2 s.
import { useMemo, useSyncExternalStore } from 'react';
import type { Anim } from '../../../server/effects/index.ts';
import { onFx } from '../net.ts';

const MS: Record<Anim, number> = { '180': 2000, '140': 1500, bust: 700, confetti: 3200, tile: 1600 };

let current: { anim: Anim; id: number } | null = null;
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

onFx(fx => {
  if (!fx.anim) return;
  const id = ++seq;
  current = { anim: fx.anim, id };
  emit();
  setTimeout(() => {
    if (current?.id !== id) return;
    current = null;
    emit();
  }, MS[fx.anim]);
});

/** The animation playing now, with an id that changes for every new one. */
export function useAnim(): { anim: Anim; id: number } | null {
  return useSyncExternalStore(l => (listeners.add(l), () => listeners.delete(l)), () => current);
}

const CONFETTI = ['#F58224', '#F5F5F5', '#1F8A52', '#F5B83D', '#B8322F'];

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 90 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    dur: 2 + Math.random() * 0.8,
    drift: (Math.random() - 0.5) * 30,
    spin: (Math.random() - 0.5) * 1440,
    color: CONFETTI[i % CONFETTI.length],
    w: 14 + Math.random() * 14,
  })), []);
  return (
    <div className="fx-confetti">
      {bits.map((b, i) => (
        <span key={i} style={{
          left: `${b.left}%`, background: b.color, width: `calc(${b.w} * var(--u))`, height: `calc(${b.w * 0.45} * var(--u))`,
          animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, ['--drift' as string]: `${b.drift}vw`, ['--spin' as string]: `${b.spin}deg`,
        }} />
      ))}
    </div>
  );
}

/** Drawn over the scoreboard, under the dialogs. `total` is the visit total for the 140+ badge. */
export function FxLayer({ total }: { total: number | null }) {
  const a = useAnim();
  if (!a || a.anim === 'tile') return null;
  return (
    <div className="fx-layer" key={a.id} aria-hidden="true">
      {a.anim === '180' && <div className="fx-180"><span className="num">180</span></div>}
      {a.anim === '140' && total !== null && <div className="fx-ton num">{total}</div>}
      {a.anim === 'bust' && <div className="fx-bust" />}
      {a.anim === 'confetti' && <Confetti />}
    </div>
  );
}
