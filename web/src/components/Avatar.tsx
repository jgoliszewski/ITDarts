import type { CSSProperties } from 'react';
import { initialsOf, rematchLabel } from '../match.ts';
import { playerColor } from './Compare.tsx';

/**
 * Round initials (docs/UI.md, Awatary graczy): a disc in the player's place colour with black letters.
 * `tone` null is the neutral disc of New match, `left` the grey one of a removed player. The full name is the label.
 */
export function Avatar({ text, tone, name, left = false, size, decorative = false }: { text: string; tone: string | null; name: string; left?: boolean; size?: string; decorative?: boolean }) {
  const style = { '--tone': left ? 'var(--off)' : tone ?? undefined, '--sz': size } as CSSProperties;
  // `decorative` when the name is written next to it: a reader would say it twice.
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': name };
  return <span className={`avatar ${tone === null && !left ? 'neutral' : ''} ${Array.from(text).length > 2 ? 'long' : ''}`} style={style} {...a11y} title={name}>{text}</span>;
}

/** Content of a Rematch button: names up to 3 players, from 4 a row of avatars in the last match's colours and order (full names are the labels). */
export function RematchLabel({ players }: { players: { name: string; left?: boolean }[] }) {
  const staying = players.filter(p => !p.left);
  if (staying.length <= 3) return <>{rematchLabel(staying.map(p => p.name))}</>;
  const ini = initialsOf(players.map(p => p.name));
  return <>Rematch<span className="av-row">{players.map((p, i) => p.left ? null : <Avatar key={i} text={ini[i]} tone={playerColor(i)} name={p.name} />)}</span></>;
}

/** A Killer number next to its player: avatar and number. */
export function AvatarChip({ text, tone, name, value, left = false }: { text: string; tone: string; name: string; value: string | number; left?: boolean }) {
  return <span className="av-chip"><Avatar text={text} tone={tone} name={name} left={left} /><b className="num">{value}</b></span>;
}
