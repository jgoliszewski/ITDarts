// Messages between the server and browsers. Imported by web/ as types only.
import type { O121, View121 } from '../games/121.ts';
import type { CricketOptions, CricketView } from '../games/cricket.ts';
import type { Coords, Dart } from '../games/darts.ts';
import type { Fx } from './effects/index.ts';
import type { MatchReport, PlayerHeat } from '../games/report.ts';
import type { FreethrowOptions, FreethrowView } from '../games/freethrow.ts';
import type { BullseyeOptions, BullseyeView } from '../games/bullseye.ts';
import type { Bobs27Options, Bobs27View } from '../games/bobs27.ts';
import type { Catch40Options, Catch40View } from '../games/catch40.ts';
import type { HareOptions, HareView } from '../games/hare.ts';
import type { FootballOptions, FootballView } from '../games/football.ts';
import type { GotchaOptions, GotchaView } from '../games/gotcha.ts';
import type { HolOptions, HolView } from '../games/hol.ts';
import type { KillerOptions, KillerView } from '../games/killer.ts';
import type { KnockoutOptions, KnockoutView } from '../games/knockout.ts';
import type { AtcOptions, AtcView, FullBoardOptions, FullBoardView } from '../games/race.ts';
import type { RcOptions, RcView } from '../games/randomco.ts';
import type { ShanghaiOptions, ShanghaiView } from '../games/shanghai.ts';
import type { QuickGames, QuickSet } from '../games/quick.ts';
import type { GameId } from '../games/turns.ts';
import type { X01Options, X01View } from '../games/x01/index.ts';

/** A seat in a match: a registered player or a guest for this match only. */
export interface RosterEntry {
  playerId: number | null;
  name: string;
}

export interface PlayerInfo {
  id: number;
  name: string;
  archived: boolean;
}

export type BoardAction = 'reset' | 'start' | 'stop' | 'calibrate' | 'restart';

export interface BoardStatus {
  address: string;
  /** Playing on the built-in fake board instead of the real one (Panel tarczy). */
  fake: boolean;
  connected: boolean;
  version: string | null;
  detecting: boolean;
  lastEvent: { text: string; at: number } | null;
  /** The last events, newest first, with the dart's position for throws (Panel tarczy, Test board). */
  log: { text: string; at: number; coords?: Coords }[];
  /** When Board Manager last sent anything, and what. */
  frameAt: number | null;
  raw: string | null;
  takeout: { active: boolean; since: number | null };
  busy: { action: BoardAction; since: number } | null;
}

interface Games {
  x01: { options: X01Options; view: X01View };
  atc: { options: AtcOptions; view: AtcView };
  fullboard: { options: FullBoardOptions; view: FullBoardView };
  '121': { options: O121; view: View121 };
  cricket: { options: CricketOptions; view: CricketView };
  killer: { options: KillerOptions; view: KillerView };
  hol: { options: HolOptions; view: HolView };
  randomco: { options: RcOptions; view: RcView };
  shanghai: { options: ShanghaiOptions; view: ShanghaiView };
  gotcha: { options: GotchaOptions; view: GotchaView };
  knockout: { options: KnockoutOptions; view: KnockoutView };
  football: { options: FootballOptions; view: FootballView };
  bullseye: { options: BullseyeOptions; view: BullseyeView };
  freethrow: { options: FreethrowOptions; view: FreethrowView };
  hare: { options: HareOptions; view: HareView };
  catch40: { options: Catch40Options; view: Catch40View };
  bobs27: { options: Bobs27Options; view: Bobs27View };
}

/** One result in the records of a variant: the number, as shown, who and when, and its place in the office ranking. */
export interface RecordResult {
  raw: number;
  value: string;
  by: string;
  at: number;
  /** 1-based, counting one result per player (co-op: per lineup). */
  place: number;
}

/**
 * The records of the variant being played, for the record screen, the record pills, the 121 ladder flags and the records
 * modal (docs/GRY.md#rekordy-i-ekran-rekordu). Worked out at the start, and again when a player leaves the match.
 */
export interface RecordInfo {
  label: string;
  /** The office record. */
  value: string | null;
  /** The record as a number, for the 121 ladder. */
  raw: number | null;
  by: string | null;
  at: number | null;
  better: 'lower' | 'higher';
  coop: boolean;
  /** Per roster player: the personal best (PB); null for a guest, a player without one, and in co-op. */
  personal: (RecordResult | null)[];
  /** Co-op: the best result of exactly this lineup, players who left the match not counted; null when there is none or a guest plays. */
  team: RecordResult | null;
  /** The office top 5, one result per player (co-op: per lineup). */
  top: RecordResult[];
}

interface LiveBase {
  key: string;
  description: string;
  roster: RosterEntry[];
  startedAt: number;
  /** Match came back after a server restart; the pilot shows a notice. */
  resumed: boolean;
  lastFix: { index: number; at: number } | null;
  record: RecordInfo | null;
  /** The record screen is up. */
  intro: boolean;
  /** Set once the game is over: an office record, names with a new personal record, and in co-op a new Team best. */
  newRecord: { office: boolean; personal: string[]; team: boolean } | null;
  /** A bull-off dart waits for its takeout; the bull-off screen stays up until then. */
  bullTakeout: boolean;
  /** Counts visits handed to the next player since the server started; the kiosk plays the turn sound when it goes up. */
  turnPass: number;
}

export type LiveMatch = { [G in GameId]: LiveBase & { game: G } & Games[G] }[GameId];

export interface MatchSummary {
  id: number;
  game: GameId;
  description: string;
  endedAt: number;
  status: 'finished' | 'ended';
  /** `value` is what the lobby shows big: legs or sets in X01, the result in minigames. `left`: removed from the match. */
  players: { name: string; value: string; avg: number | null; winner: boolean; left: boolean }[];
  checkout: string | null;
}

export interface ClientState {
  you: { clientId: string; isPilot: boolean; isLocal: boolean };
  pilot: { clientId: string; deviceName: string; connected: boolean } | null;
  board: BoardStatus;
  match: LiveMatch | null;
  lastMatch: MatchSummary | null;
  /** The match summary screen, shown instead of the lobby until the pilot moves on. */
  summary: MatchReport | null;
  players: PlayerInfo[];
  recentPlayerIds: number[];
  urls: string[];
  showQr: boolean;
  /** Lobby banner: the board was not rotated by 3 sectors for 30+ days (or never). */
  rotateBoardDue: boolean;
  /** Test board is open since then: darts and takeouts do not reach the match. */
  boardTest: number | null;
  /** “How to play” shown on the scoreboard. */
  howTo: { game: GameId; options: unknown } | null;
  /** Pilot switches, the master volume over all kiosk sound (0–100) with Mute, and the effects volume (0–100). `rev` changes with every effects change. */
  effects: { sounds: boolean; caller: boolean; leds: boolean; master: number; muted: boolean; volume: number; rev: number };
  /** Quick start on the Players step of New match: three slots for solo and three for 2+, the same on every device. */
  quickGames: QuickGames;
}

export type PlayerCommand =
  | { action: 'create'; name: string }
  | { action: 'rename'; id: number; name: string }
  | { action: 'merge'; from: number; into: number }
  | { action: 'archive'; id: number; archived: boolean }
  | { action: 'anonymize'; id: number };

export type Command =
  | { type: 'takeControl' }
  | { type: 'startMatch'; game: GameId; options: unknown; roster: RosterEntry[] }
  | { type: 'skipIntro' }
  | { type: 'reroll' }
  | { type: 'showHowTo'; game: GameId | null; options?: unknown }
  | { type: 'rematch' }
  | { type: 'bullOff'; starter: number }
  /** `coords` (Board Manager units) only from a tap on the fix board (Add dart). */
  | { type: 'dart'; dart: Dart; coords?: Coords }
  /** `coords` (Board Manager units) only from a tap on the fix board. */
  | { type: 'fix'; index: number; dart: Dart; coords?: Coords }
  | { type: 'undo' }
  | { type: 'next' }
  | { type: 'nextLeg' }
  | { type: 'remove'; player: number; scope: 'match' | 'leg' }
  | { type: 'endMatch'; save: boolean }
  | { type: 'closeMatch'; then: 'summary' | 'rematch' | 'lobby' }
  | { type: 'closeSummary' }
  | { type: 'dismissResumed' }
  | { type: 'board'; action: BoardAction }
  | { type: 'fakeBoard'; on: boolean }
  | { type: 'boardTest'; on: boolean }
  | { type: 'showQr'; show: boolean }
  | { type: 'boardRotated' }
  /** Saves a quick game in its slot, or empties the slot with null. */
  | { type: 'setQuickGame'; set: QuickSet; index: number; slot: { game: GameId; options: unknown } | null }
  | { type: 'player'; cmd: PlayerCommand }
  | { type: 'effects'; sounds?: boolean; caller?: boolean; leds?: boolean; master?: number; muted?: boolean }
  | { type: 'ledsWhite' }
  | { type: 'closeApp' }
  | { type: 'report'; text: string; where: string; userAgent: string };

export type ClientMessage =
  | { type: 'hello'; clientId: string; deviceName: string }
  | { type: 'cmd'; id: number; cmd: Command };

export type ServerMessage =
  | { type: 'state'; state: ClientState }
  /** An effect to play now: the sound only on the kiosk, the animation on the scoreboard. */
  | { type: 'fx'; fx: Fx }
  | { type: 'result'; id: number; ok: boolean; error?: string; playerId?: number };

// ---------- stats API ----------

export type StatsWindow = '7d' | '30d' | '90d' | '365d' | 'all' | 'l10' | 'l100';

export interface PlayerStatsResponse {
  player: PlayerInfo;
  window: StatsWindow;
  x01: import('../games/x01/stats.ts').X01Stats;
  /** The same figures for the Okno right before this one (docs/STATYSTYKI.md, Progres); null for All time, with no leg in this Okno, or with fewer than 3 legs there. */
  previous: { avg: number | null; first9: number | null; checkoutPct: number | null } | null;
  /** The player's Average in each X01 match of the Okno, oldest first. */
  trend: { matchId: number; endedAt: number; avg: number }[];
  results: { played: number; won: number; winrate: number | null };
  recent: RecentMatch[];
  opponents: { id: number; name: string; played: number; won: number }[];
}

export interface H2HResponse {
  window: StatsWindow;
  players: [PlayerInfo, PlayerInfo];
  played: number;
  wins: [number, number];
  avg: [number | null, number | null];
}

/** Stats of one player in one minigame. Totals are the game's per-player stats summed over matches. */
export interface GameStatsResponse {
  player: PlayerInfo;
  game: GameId;
  window: StatsWindow;
  /** Matches played, solo too, without those the player left. */
  played: number;
  /** Winrate as in X01: finished matches of two or more registered players with one winner, without those the player left. Solo games: all zero, `winrate` null. */
  versus: { played: number; won: number; winrate: number | null };
  /** Matches `totals` were summed from (those the player left included): the denominator of "per match". */
  matches: number;
  totals: Record<string, number>;
  /** `matches` and `totals` of the Okno right before this one; null for All time, with no match in this Okno, or with fewer than 3 matches there. */
  previous: { matches: number; totals: Record<string, number> } | null;
  /** Best result per record variant. */
  bests: { label: string; value: string }[];
  /** The last matches of this game in the Okno, newest first, 10 at most. */
  recent: RecentMatch[];
}

/** Dart positions per player in one game and window; `distance` in metres. */
export type HeatResponse = { player: PlayerInfo; heat: PlayerHeat; distance: number }[];

/** An office record of a minigame variant for the lobby (D6): the tile opens New match with `options`. */
export interface LobbyRecord {
  game: GameId;
  key: string;
  label: string;
  /** The game's short name as the label starts with it (“ATC”): the lobby's group heading. */
  title: string;
  /** `label` without the game name (“Any · Skips · Clockwise”): the tile under its group heading. */
  sub: string;
  value: string;
  who: string;
  at: number;
  /** The record match's options, normalized; the variant key alone can't give them back (ATC's order is not in it). */
  options: unknown;
  /** The 2nd and 3rd best results, formatted like `value`; fewer when there are fewer. */
  chase: { who: string; value: string }[];
  /** A co-op record takes `minPlayers`..`maxPlayers` players (2 up to the game's limit), any other exactly one. */
  coop: boolean;
  minPlayers: number;
  maxPlayers: number;
}

/** A row of Recent matches: `opponents` null for a solo match, `score` from the player's side (X01 legs, minigame result). */
export interface RecentMatch {
  id: number;
  endedAt: number;
  description: string;
  opponents: string | null;
  result: 'won' | 'lost' | 'saved' | 'played' | 'left';
  score: string;
}

export interface RecordTable {
  key: string;
  label: string;
  rows: { value: string; who: string; at: number }[];
}

export interface PlayerListItem {
  id: number;
  name: string;
  /** X01 Average of the last 30 days. */
  avg: number | null;
  /** The same for the 30 days before; null with fewer than 3 legs then. */
  avgPrev: number | null;
  /** Matches of the last 30 days, all games, without those the player left. */
  matches: number;
  lastPlayed: number | null;
}
