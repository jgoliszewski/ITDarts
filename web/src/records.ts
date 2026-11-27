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

/** A page: always the 4×2 grid (a lone group of 5–8 records fills it, small groups share its two rows); only 1–4 records in all get 1 / 2×1 / 2×2. */
export interface RecordPage { cols: number; rows: number; groups: RecordGroup[] }

export const groupTitle = (g: Pick<RecordGroup, 'title' | 'cont'>) => (g.cont ? `${g.title} (cont.)` : g.title);

/** The grid cells a group takes on its page: as many columns as tiles (up to the page's), and a second row only when its tiles wrap. */
export function groupSpan(g: Pick<RecordGroup, 'items'>, page: Pick<RecordPage, 'cols'>): { cols: number; rows: number } {
  const cols = Math.min(g.items.length, page.cols);
  return { cols, rows: Math.ceil(g.items.length / cols) };
}

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
 * Pages of big groups come first. Nothing is cut. Every page is the same 4×2 grid, so a tile is as big on each page (empty
 * places stay empty); only when there are 4 records or fewer in all they get bigger: 1, 2 side by side, or 2×2.
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
  const pages: RecordPage[] = big.map(g => ({ cols: PAGE_COLS, rows: 2, groups: [g] }));
  const rows = packRows(small, PAGE_COLS);
  for (let i = 0; i < rows.length; i += 2) pages.push({ cols: PAGE_COLS, rows: 2, groups: placeRows(rows.slice(i, i + 2)) });
  return records.length <= PAGE_COLS && pages.length === 1 ? [compactPage(pages[0].groups, records.length) ?? pages[0]] : pages;
}

const size = (r: RecordGroup[]) => r.reduce((n, g) => n + g.items.length, 0);

/** First-fit: each group goes into the first row that still has room for it, so no row has a hole a later group would fit. */
function packRows(groups: RecordGroup[], width: number): RecordGroup[][] {
  const rows: RecordGroup[][] = [];
  for (const g of groups) {
    const row = rows.find(r => size(r) + g.items.length <= width);
    if (row) row.push(g); else rows.push([g]);
  }
  return rows;
}

const placeRows = (rows: RecordGroup[][]) => rows.flatMap((r, row) => r.map((g, k) => ({ ...g, row, col: size(r.slice(0, k)) })));

/** 1 to 4 records in all: 1 tile, 2 side by side, or 2×2, when the groups fit that; null when they do not (3 and 1 of two games). */
function compactPage(groups: RecordGroup[], total: number): RecordPage | null {
  const cols = total <= 1 ? 1 : 2;
  if (groups.length === 1) return { cols, rows: total <= 2 ? 1 : 2, groups };
  const rows = packRows(groups.map(g => ({ ...g, row: 0, col: 0 })), cols);
  return groups.every(g => g.items.length <= cols) && rows.length <= 2 ? { cols, rows: rows.length, groups: placeRows(rows) } : null;
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

/** A pointer event as the gesture sees it: `x`/`y` in px, `t` in ms; `mouse` and `button` tell a mouse that is not the main button. */
export interface PointerStep { id: number; x: number; y: number; t: number; mouse?: boolean; button?: number }

/** One finger (or the mouse) on the strip: `start` is the strip's place when it went down, `pos` where it is held now. */
export type Touch =
  | { phase: 'idle' }
  | { phase: 'pressed' | 'dragging'; id: number; x: number; y: number; start: number; pos: number; from: number; max: number; axis: 'x' | 'y' | null; pts: [number, number][]; caught: boolean };

/** `block`: the click that follows this gesture is not a tap on a tile (it ended a drag, or caught a moving strip). */
export interface Gesture { touch: Touch; block: boolean }
export const idleGesture: Gesture = { touch: { phase: 'idle' }, block: false };

/** What the strip is to do: stop where it is, be held at `x`, or run on (spring) to page `to` with speed `v` px/s. */
export type StripMove = { kind: 'stop' } | { kind: 'hold'; x: number } | { kind: 'spring'; to: number; v: number };
export interface GestureResult { gesture: Gesture; move: StripMove | null; /** The touch has just become a sideways drag: capture the pointer. */ locked?: boolean }

const ignore = (gesture: Gesture): GestureResult => ({ gesture, move: null });

/**
 * A pointer goes down on the strip (`x` px from the first page, `moving` when it is not at rest on a page; `n` pages). A moving
 * strip is caught and stays where it is. A second pointer while one is down is ignored, so it cannot take over the gesture.
 * The click block of the last gesture ends here.
 */
export function gestureDown(g: Gesture, e: PointerStep, strip: { x: number; moving: boolean }, width: number, n: number): GestureResult {
  if (n < 2 || (e.mouse && e.button !== 0) || g.touch.phase !== 'idle') return ignore(g);
  const caught = strip.moving;
  const touch: Touch = {
    phase: 'pressed', id: e.id, x: e.x, y: e.y, start: strip.x, pos: strip.x, from: Math.round(strip.x / width),
    max: (strip.x > (n - 1) * width ? n : n - 1) * width, axis: null, pts: [[e.x, e.t]], caught,
  };
  return { gesture: { touch, block: caught }, move: caught ? { kind: 'stop' } : null };
}

/** The pointer moves: after the hysteresis a sideways move locks the axis, and the strip follows 1:1 from that point. */
export function gestureMove(g: Gesture, e: PointerStep, width: number): GestureResult {
  const t = g.touch;
  if (t.phase === 'idle' || e.id !== t.id) return ignore(g);
  let locked = false, next = t;
  if (t.axis === null) {
    const axis = lockAxis(e.x - t.x, e.y - t.y);
    if (axis === null) return ignore(g);
    // The strip follows from where the finger was when the lock came, so there is no jump at the lock.
    next = axis === 'x' ? { ...t, phase: 'dragging', axis, x: e.x } : { ...t, axis };
    locked = axis === 'x';
  }
  if (next.phase !== 'dragging') return { gesture: { ...g, touch: next }, move: null };
  const pts: [number, number][] = [...next.pts.slice(-5), [e.x, e.t]];
  const pos = holdPosition(next.start, e.x - next.x, next.max, width);
  return { gesture: { touch: { ...next, pts, pos }, block: true }, move: { kind: 'hold', x: pos }, locked };
}

/**
 * The pointer goes up, or the system cancels it (the same). A drag lets the strip run on from the finger's speed to the page its
 * momentum reaches; a caught strip that was not dragged runs on to the page it is nearest to; a plain tap does nothing.
 */
export function gestureEnd(g: Gesture, e: PointerStep, width: number): GestureResult {
  const t = g.touch;
  if (t.phase === 'idle' || e.id !== t.id) return ignore(g);
  const gesture: Gesture = { touch: { phase: 'idle' }, block: g.block };
  if (t.axis === 'x') {
    const v = 0 - swipeSpeed(t.pts, e.t);
    return { gesture, move: { kind: 'spring', to: projectPage(t.pos, v, width, t.from, t.max / width), v } };
  }
  if (t.caught) return { gesture, move: { kind: 'spring', to: Math.max(0, Math.min(t.max / width, Math.round(t.pos / width))), v: 0 } };
  return { gesture, move: null };
}

/** A click arrives: it is swallowed once when it follows a gesture that moved or caught the strip. */
export const gestureClick = (g: Gesture): { gesture: Gesture; blocked: boolean } => ({ gesture: { ...g, block: false }, blocked: g.block });

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
