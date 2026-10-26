import type { BullOffView, BullThrow } from '../../../games/bulloff.ts';
import { BOARD_ORDER, label } from '../../../games/darts.ts';
import type { LiveMatch } from '../../../server/protocol.ts';
import { arc } from './Dartboard.tsx';

// Real board sizes in mm, colours as on the Dartboard keypad.
const BULL_MM = 6.35, OUTER_MM = 15.9;
const BANDS: [number, number, boolean][] = [[OUTER_MM, 99, false], [99, 107, true], [107, 162, false], [162, 170, true]];

const mmText = (t: BullThrow) => (t.mm === null ? '–' : `${t.mm.toFixed(1)} mm`);

/** This round's throws, closest first. */
export const roundThrows = (b: BullOffView) => b.throws.filter(t => t.round === b.round).sort((a, z) => (a.mm ?? Infinity) - (z.mm ?? Infinity));

/** What the players should do now. */
export function bullStatus(m: LiveMatch, b: BullOffView): string {
  const name = (p: number) => m.roster[p].name;
  if (b.winner !== null) return `${name(b.winner)} starts${m.bullTakeout ? ' · take out the dart' : ''}`;
  if (m.bullTakeout) return `Take out the dart · ${name(b.next!)} next`;
  return `${name(b.next!)}, throw at the bull${b.round > 0 ? ' (tie: throw again)' : ''}`;
}

/** The bull close up, zoomed to fit this round's darts. */
export function BullZoom({ m, b, size }: { m: LiveMatch; b: BullOffView; size: number }) {
  const shown = roundThrows(b);
  const far = Math.max(0, ...shown.map(t => t.mm ?? 0));
  // Always shows the treble ring (107 mm) for scale; zooms out further only for a wild dart.
  const R = Math.min(190, Math.max(115, far * 1.15));
  const leader = shown[0]?.player;
  return (
    <svg width={size} height={size} viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`} role="img" aria-label="Bull-off darts around the bull">
      <circle r={R} fill="#141416" />
      {BOARD_ORDER.map((n, k) => BANDS.map(([r1, r2, ring]) => (
        <path key={`${n}-${r1}`} d={arc(r1, r2, k * 18 - 9, k * 18 + 9)} stroke="#0A0A0B" strokeWidth={R / 300}
          fill={ring ? (k % 2 === 0 ? '#B8322F' : '#1F8A52') : k % 2 === 0 ? '#232327' : '#4A4A50'} />
      )))}
      <circle r={OUTER_MM} fill="#1F8A52" stroke="#0A0A0B" strokeWidth={R / 300} />
      <circle r={BULL_MM} fill="#B8322F" stroke="#0A0A0B" strokeWidth={R / 300} />
      {/* Each dart's distance as a ring: the next dart has to land inside the leader's ring to win. */}
      {shown.filter(t => t.mm !== null).map(t => (
        <circle key={`ring${t.player}`} r={t.mm!} fill="none" stroke={t.player === leader ? '#F58224' : '#F5F5F5'}
          strokeOpacity={t.player === leader ? 1 : 0.6} strokeWidth={R / 200} strokeDasharray={`${R / 50} ${R / 70}`} />
      ))}
      {shown.filter(t => t.coords).map(t => {
        const x = t.coords!.x * 170, y = -t.coords!.y * 170, top = t.player === leader;
        return (
          <g key={t.player}>
            <circle cx={x} cy={y} r={R * 0.025} fill={top ? '#F58224' : '#F5F5F5'} stroke="#0A0A0B" strokeWidth={R / 150} />
            <text x={x} y={y - R * 0.07} fill={top ? '#F58224' : '#F5F5F5'} fontSize={R * 0.08} fontWeight="700" textAnchor="middle"
              fontFamily="Inter, sans-serif" stroke="#0A0A0B" strokeWidth={R / 120} paintOrder="stroke">{m.roster[t.player].name}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function BullRows({ m, b }: { m: LiveMatch; b: BullOffView }) {
  return (
    <div className="bull-rows">
      {roundThrows(b).map((t, i) => (
        <div key={t.player} className={`bull-row ${i === 0 ? 'lead' : ''}`}>
          <span className="who">{m.roster[t.player].name}</span>
          <span className="muted">{label(t.dart)}</span>
          <span className="num">{mmText(t)}</span>
        </div>
      ))}
    </div>
  );
}
