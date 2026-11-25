// What the records show during a game: the hero's record pills, the 121 ladder flags, the record screen and the records
// modal (docs/GRY.md#rekordy-i-ekran-rekordu). Pure, so it can be tested without a DOM.
import type { Command, LobbyRecord, MatchSummary, PlayerInfo, RecordInfo, RecordResult, RosterEntry } from '../../server/protocol.ts';

export type RecordKind = 'best' | 'pb' | 'both';

export interface Pill {
  kind: RecordKind;
  label: string;
  /** null shows as “–”. */
  value: number | null;
  /** The game can no longer beat it. */
  out: boolean;
}

/** The player's own record next to the office one: the PB, in co-op the Team best. Null for a guest, and in co-op with one, who keep none. */
export function ownRecord(r: RecordInfo, roster: RosterEntry[], player: number): { label: 'PB' | 'Team'; res: RecordResult | null } | null {
  if (r.coop) return roster.some(p => p.playerId === null) ? null : { label: 'Team', res: r.team };
  return roster[player]?.playerId == null ? null : { label: 'PB', res: r.personal[player] ?? null };
}

/** Their own best is the office record itself (a tie set later is not). */
const holds = (res: RecordResult | null | undefined) => res?.place === 1;

/** Best over PB (Team), or one merged pill; `bound` is the best the game can still reach, null when the game does not tell. */
export function recordPills(r: RecordInfo, roster: RosterEntry[], player: number, bound: number | null): Pill[] {
  // A tie beats nothing, as at the end of the game.
  const out = (v: number | null) => v !== null && bound !== null && (r.better === 'lower' ? bound >= v : bound <= v);
  const own = ownRecord(r, roster, player);
  if (own && holds(own.res)) return [{ kind: 'both', label: `Best · ${own.label}`, value: r.raw, out: out(r.raw) }];
  const pills: Pill[] = [{ kind: 'best', label: 'Best', value: r.raw, out: out(r.raw) }];
  if (own) pills.push({ kind: 'pb', label: own.label, value: own.res?.raw ?? null, out: out(own.res?.raw ?? null) });
  return pills;
}

export interface LadderMark {
  value: number;
  kind: RecordKind;
  label: string;
}

/** 121: the targets the ladder flags, the PB (Team) first; only those that exist. */
export function ladderMarks(r: RecordInfo | null, roster: RosterEntry[]): LadderMark[] {
  if (!r || r.raw === null) return [];
  const own = ownRecord(r, roster, 0);
  if (own && holds(own.res)) return [{ value: r.raw, kind: 'both', label: `Best · ${own.label}` }];
  return [...(own?.res ? [{ value: own.res.raw, kind: 'pb' as const, label: own.label }] : []), { value: r.raw, kind: 'best', label: 'Best' }];
}

export interface IntroPill {
  kind: RecordKind;
  label: string;
  value: number | null;
  who: string;
  /** The date, 'first' for no result yet, null for none shown. */
  when: number | 'first' | null;
}

/**
 * The record screen under the office record: the PB of each player (no guests; with several players without dates, in two
 * columns from 5), or the co-op Team best. Nothing while the variant has no record at all.
 */
export function introPills(r: RecordInfo, roster: RosterEntry[]): { two: boolean; pills: IntroPill[] } {
  if (r.raw === null) return { two: false, pills: [] };
  if (r.coop) {
    const own = ownRecord(r, roster, 0);
    const pills: IntroPill[] = own ? [{ kind: 'pb', label: 'Team', value: own.res?.raw ?? null, who: own.res?.by ?? roster.map(p => p.name).join(' & '), when: own.res?.at ?? 'first' }] : [];
    return { two: false, pills };
  }
  const solo = roster.length === 1;
  const pills = roster.flatMap((p, i): IntroPill[] => {
    if (p.playerId === null) return [];
    const res = r.personal[i];
    // The number is right above for a solo record holder.
    if (holds(res)) return [{ kind: 'both', label: 'Best · PB', value: solo ? null : res!.raw, who: p.name, when: null }];
    return [{ kind: 'pb', label: 'PB', value: res?.raw ?? null, who: p.name, when: solo ? res?.at ?? 'first' : null }];
  });
  return { two: roster.length >= 5, pills };
}

export type TopRow = (RecordResult & { me: boolean }) | 'gap';

/** The office top 5 with the throwing player's (co-op: the lineup's) row marked, and that row under a gap when it is lower. */
export function modalRows(r: RecordInfo, roster: RosterEntry[], player: number): TopRow[] {
  const mine = ownRecord(r, roster, player)?.res ?? null;
  const rows: TopRow[] = r.top.map(t => ({ ...t, me: t.place === mine?.place }));
  return mine && mine.place > r.top.length ? [...rows, 'gap', { ...mine, me: true }] : rows;
}

/** “23 darts” → ['23', 'darts']; a value with its word first (121's “Target 128”) keeps only the number. */
export function splitValue(value: string): [string, string] {
  const m = /^(\d+)\s*(.*)$/.exec(value);
  return m ? [m[1], m[2]] : [value.replace(/^\D+/, ''), ''];
}

/** What a record attempt takes (the lobby's “Record attempt” popup): a solo record exactly one player, a co-op one two or more up to the game's limit. */
export interface AttemptRule { coop: boolean; minPlayers: number; maxPlayers: number }

export const attemptHint = (r: AttemptRule) => (r.minPlayers === r.maxPlayers ? `Pick ${r.minPlayers} player${r.minPlayers === 1 ? '' : 's'}` : `Pick ${r.minPlayers} or more players`);

/** Start is enabled only for a count the record allows. */
export const attemptReady = (r: AttemptRule, picked: number) => picked >= r.minPlayers && picked <= r.maxPlayers;

/** A tap on a player: solo swaps the choice; co-op toggles, and a full lineup ignores one more. Order of picking is the order of play. */
export function togglePick(r: AttemptRule, picked: number[], id: number): number[] {
  if (picked.includes(id)) return picked.filter(p => p !== id);
  if (r.maxPlayers === 1) return [id];
  return picked.length >= r.maxPlayers ? picked : [...picked, id];
}

/**
 * The Start of a record attempt: the record match's options (a co-op record is played as co-op), the picked players in the
 * order picked. Players who are no longer on the list (archived meanwhile) drop out; null when the count no longer fits.
 */
export function attemptCommand(r: LobbyRecord, picked: number[], players: Pick<PlayerInfo, 'id' | 'name'>[]): Extract<Command, { type: 'startMatch' }> | null {
  const roster: RosterEntry[] = picked.flatMap(id => { const p = players.find(x => x.id === id); return p ? [{ playerId: p.id, name: p.name }] : []; });
  if (!attemptReady(r, roster.length)) return null;
  const options = r.coop && r.options && typeof r.options === 'object' && 'coop' in r.options ? { ...r.options, coop: true } : r.options;
  return { type: 'startMatch', game: r.game, options, roster };
}

/**
 * The lobby's one line about the last match. X01 with two players gives both sides (“501 · Anna 3–1 Bob”), with more only the winner,
 * as a lone number says nothing. Minigames give the winners (everyone in a solo or a tie, nobody who left) and the first result.
 */
export function lastLine(last: MatchSummary): string {
  const desc = last.description.replace(/^X01 · /, '');
  const winners = last.players.filter(p => p.winner);
  const who = winners.length ? winners : last.players.filter(p => !p.left);
  const body = last.game === 'x01'
    ? (last.players.length === 2 ? [desc, `${last.players[0].name} ${last.players[0].value}–${last.players[1].value} ${last.players[1].name}`] : [desc, who.map(p => p.name).join(' & ')])
    : [desc, who.map(p => p.name).join(' & '), who[0]?.value];
  return `Last: ${body.filter(Boolean).join(' · ')}`;
}
