// Quick games (GLOSSARY: Szybka gra): three saved games per set, once started from New match with one tap (no UI since 2026-11-27).
// The server keeps them for every device; the setup and the hub share these rules.
import { GAMES, MAX_PLAYERS, isGameId } from './index.ts';
import type { GameId } from './turns.ts';
import { choiceLabel } from './turns.ts';
import type { BullOff, X01Options } from './x01/rules.ts';

/** Solo: shown for one player; multi: for 2 or more (and before anyone is picked). */
export type QuickSet = 'solo' | 'multi';
/** A slot's options never hold the bull-off: it comes from the Players step at the start. */
export interface QuickSlot { game: GameId; options: Record<string, unknown> }
export type QuickGames = Record<QuickSet, (QuickSlot | null)[]>;

export const QUICK_SLOTS = 3;

export const QUICK_START: QuickGames = {
  solo: [{ game: '121', options: { visits: 4, refill: false } }, null, null],
  multi: [{ game: 'x01', options: { startScore: 501, checkIn: 'straight', checkOut: 'double', matchMode: { kind: 'off' } } }, null, null],
};

export const quickSet = (players: number): QuickSet => (players === 1 ? 'solo' : 'multi');

/** Players a set stands for: what a slot's options and label are worked out with. */
export const setPlayers = (set: QuickSet) => (set === 'solo' ? 1 : 2);

export function fitsSet(game: GameId, set: QuickSet): boolean {
  const g = GAMES[game];
  return set === 'solo' ? g.minPlayers <= 1 : (g.maxPlayers ?? MAX_PLAYERS) >= 2;
}

export const hasBullOff = (game: GameId) => GAMES[game].options.some(d => d.key === 'bullOff');

/** The game's options cleaned by its module, without the bull-off; null when it is not a game or does not fit the set. */
export function normalizeSlot(input: unknown, set: QuickSet): QuickSlot | null {
  const s = input as { game?: unknown; options?: unknown } | null;
  if (!s || !isGameId(s.game) || !fitsSet(s.game, set)) return null;
  const { bullOff: _, ...options } = GAMES[s.game].normalizeOptions(s.options) as Record<string, unknown>;
  return { game: s.game, options };
}

/** Stored quick games, three slots per set; nothing stored gives the starting set. */
export function normalizeQuickGames(input: unknown): QuickGames {
  if (input === null || input === undefined) return structuredClone(QUICK_START);
  const q = input as Partial<Record<QuickSet, unknown[]>>;
  const set = (k: QuickSet) => Array.from({ length: QUICK_SLOTS }, (_, i) => normalizeSlot(Array.isArray(q[k]) ? q[k][i] : null, k));
  return { solo: set('solo'), multi: set('multi') };
}

/** The options a match starts with: the bull-off from the Players step goes only to games that have one. */
export function withBullOff(game: GameId, options: Record<string, unknown>, bullOff: BullOff): Record<string, unknown> {
  const { bullOff: _, ...rest } = options;
  return hasBullOff(game) ? { ...rest, bullOff } : rest;
}

/** One line for a quick game tile, e.g. “501 · Double out · No match mode”: On/Off options by name when on, Mode by its value. */
export function slotLabel(game: GameId, input: unknown, players: number): string {
  const g = GAMES[game];
  const o = g.normalizeOptions(input) as Record<string, unknown>;
  if (game === 'x01') {
    const x = o as unknown as X01Options;
    const mm = x.matchMode;
    return [
      String(x.startScore),
      ...(x.checkIn === 'double' ? ['Double in'] : []),
      `${choiceLabel(g.options, o, 'checkOut')} out`,
      mm.kind === 'off' ? 'No match mode' : `First to ${mm.firstTo} ${mm.kind === 'legs' ? 'leg' : 'set'}${mm.firstTo === 1 ? '' : 's'}`,
    ].join(' · ');
  }
  const parts = game === 'randomco' ? [`Range ${o.min}–${o.max}`] : [];
  for (const d of g.options) {
    if (!d.key || d.key === 'bullOff' || (d.when && !d.when(o, players))) continue;
    const v = o[d.key];
    if (typeof v === 'boolean') v && parts.push(d.label);
    else parts.push(d.key === 'mode' ? choiceLabel(g.options, o, d.key) : `${d.label} ${choiceLabel(g.options, o, d.key)}`);
  }
  return parts.join(' · ');
}
