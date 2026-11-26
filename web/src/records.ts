// What the records show during a game: the hero's record pills, the 121 ladder flags, the record screen and the records
// modal (docs/GRY.md#rekordy-i-ekran-rekordu). Pure, so it can be tested without a DOM.
import type { GameId } from '../../games/index.ts';
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

/** Tiles on a kiosk page: 4 columns, 2 rows. */
export const PAGE_COLS = 4;
export const PAGE_TILES = 8;

/** The records of one game on a page. `cont` marks a game that goes on from an earlier page. */
export interface RecordGroup {
  game: GameId;
  title: string;
  cont: boolean;
  items: LobbyRecord[];
  /** The place on the page's grid: row index and first column (0-based); the group spans `items.length` columns. */
  row: number;
  col: number;
}

/** A page: a lone group of 5–8 records fills it (`rows` is 1 and `cols` at most 4), small groups share its up to two rows. */
export interface RecordPage { cols: number; rows: number; groups: RecordGroup[] }

export const groupTitle = (g: Pick<RecordGroup, 'title' | 'cont'>) => (g.cont ? `${g.title} (cont.)` : g.title);

/** The records by game, the games in the order of their first record (the phone lists them so, under a heading each). */
export function groupByGame(records: LobbyRecord[]): Map<GameId, LobbyRecord[]> {
  const games = new Map<GameId, LobbyRecord[]>();
  for (const r of records) games.set(r.game, [...(games.get(r.game) ?? []), r]);
  return games;
}

/**
 * The kiosk's pages (docs/UI.md, Lobby i QR). The records come game after game; a game with more than 4 records gets pages of
 * its own, 8 each (a game over 8 goes on as “<Game> (cont.)”). What is left, at most 4 per game, is packed first-fit into
 * rows of 4 tiles (a small group fills the first row that has room, so there are no holes) and two rows make a page.
 * Pages of big groups come first. Nothing is cut.
 */
export function recordPages(records: LobbyRecord[]): RecordPage[] {
  const games = groupByGame(records);
  const big: RecordGroup[] = [];
  const small: RecordGroup[] = [];
  for (const [game, all] of games) {
    let rest = all, cont = false;
    while (rest.length > 0) {
      const take = rest.length > PAGE_COLS ? Math.min(PAGE_TILES, rest.length) : rest.length;
      (take > PAGE_COLS ? big : small).push({ game, title: all[0].title, cont, items: rest.slice(0, take), row: 0, col: 0 });
      rest = rest.slice(take);
      cont = true;
    }
  }
  const rows: RecordGroup[][] = [];
  for (const g of small) {
    const row = rows.find(r => r.reduce((n, x) => n + x.items.length, 0) + g.items.length <= PAGE_COLS);
    if (row) row.push(g); else rows.push([g]);
  }
  const pages: RecordPage[] = big.map(g => ({ cols: Math.min(PAGE_COLS, g.items.length), rows: 1, groups: [g] }));
  for (let i = 0; i < rows.length; i += 2) {
    const chunk = rows.slice(i, i + 2);
    const groups = chunk.flatMap((r, row) => r.map((g, k) => ({ ...g, row, col: r.slice(0, k).reduce((n, x) => n + x.items.length, 0) })));
    pages.push({ cols: Math.max(...chunk.map(r => r.reduce((n, g) => n + g.items.length, 0))), rows: chunk.length, groups });
  }
  return pages;
}

/** A touch moves the page only after it went this far (hysteresis); until then it is a tap. */
export const AXIS_LOCK = 10;
/** The page-change spring: critically damped, so it never overshoots. Its response is the time it takes to settle, about. */
export const SWIPE_RESPONSE = 0.35;
export const ROTATE_RESPONSE = 0.45;
/** iOS's deceleration rate per ms, for the momentum projection. */
const DECELERATION = 0.998;
/** The rubber band's stiffness (iOS's 0.55): the pull never reaches the page width. */
export const RUBBER_COEFF = 0.55;

/** Which way a touch goes once it is far enough: null while it is still a tap, then the axis it keeps (sideways = the pages, vertical = nothing). */
export function lockAxis(dx: number, dy: number): 'x' | 'y' | null {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK) return null;
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
}

/** The rubber band past an end: `offset` px of finger travel beyond it gives a pull that slows down and stays under `dimension` (iOS). */
export const rubberBand = (offset: number, dimension: number) =>
  (offset * dimension * RUBBER_COEFF) / (dimension + RUBBER_COEFF * Math.abs(offset));

/** Where the strip is while a finger holds it: `start` less the finger's travel, with the ends pulled back by the rubber band. */
export function holdPosition(start: number, travel: number, max: number, width: number): number {
  const x = start - travel;
  if (x < 0) return -rubberBand(-x, width);
  if (x > max) return max + rubberBand(x - max, width);
  return x;
}

/** The speed in px/s over the moves of the last 120 ms before `now` ([x, time ms] pairs); holding still before the release is no speed. */
export function swipeSpeed(points: [number, number][], now: number): number {
  const recent = points.filter(p => now - p[1] < 120);
  const a = recent[0], b = recent[recent.length - 1];
  return a && b && b[1] > a[1] ? ((b[0] - a[0]) / (b[1] - a[1])) * 1000 : 0;
}

/**
 * The page a released strip comes to rest on: the one nearest to where its momentum would carry it (`velocity` px/s, the
 * strip's own direction), but at most one page from the one it started on, and within 0..`last`.
 */
export function projectPage(position: number, velocity: number, width: number, from: number, last: number): number {
  const rest = position + (velocity / 1000) * (DECELERATION / (1 - DECELERATION));
  return Math.max(Math.max(0, from - 1), Math.min(Math.min(last, from + 1), Math.round(rest / width)));
}

/** One step of a critically damped spring (no overshoot) of `dt` seconds towards `target`; `response` is its settling time. */
export function springStep(x: number, v: number, target: number, dt: number, response: number): { x: number; v: number } {
  const w = (2 * Math.PI) / response;
  const d = x - target;
  const e = Math.exp(-w * dt);
  const c = v + w * d;
  return { x: target + (d + c * dt) * e, v: (v - w * c * dt) * e };
}

/** How much dot `i` of `n` is the current one for the strip at page position `at` (0..n, n being the first page again): 1 on it, 0 a page away, between while it moves. */
export function dotWeight(at: number, i: number, n: number): number {
  const d = Math.abs(((at - i) % n + n) % n);
  return Math.max(0, 1 - Math.min(d, n - d));
}

/** The auto-rotation's next page; after the last the first, and `wrap` tells the strip to slide on instead of back. */
export const nextPage = (page: number, pages: number) => ({ page: (page + 1) % pages, wrap: page === pages - 1 });

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
