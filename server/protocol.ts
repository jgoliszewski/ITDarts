// Messages between the server and browsers. Imported by web/ as types only.
import type { O121, View121 } from '../games/121.ts';
import type { CricketOptions, CricketView } from '../games/cricket.ts';
import type { Coords, Dart } from '../games/darts.ts';
import type { Fx } from './effects/index.ts';
import type { MatchReport, PlayerHeat } from '../games/report.ts';
import type { HolOptions, HolView } from '../games/hol.ts';
import type { KillerOptions, KillerView } from '../games/killer.ts';
import type { AtcOptions, AtcView, FullBoardOptions, FullBoardView } from '../games/race.ts';
import type { RcOptions, RcView } from '../games/randomco.ts';
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
}

/** The office record of the variant being played, for the record screen. */
export interface RecordInfo {
  label: string;
  value: string | null;
  by: string | null;
  at: number | null;
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
  /** Set once the game is over: an office record, and names with a new personal record. */
  newRecord: { office: boolean; personal: string[] } | null;
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
  /** `value` is what the lobby shows big: legs or sets in X01, the result in minigames. */
  players: { name: string; value: string; avg: number | null; winner: boolean }[];
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
  /** Test board is open since then: darts and takeouts do not reach the match. */
  boardTest: number | null;
  /** “How to play” shown on the scoreboard. */
  howTo: { game: GameId; options: unknown } | null;
  /** Pilot switches and the effects volume (0–100). `rev` changes with every effects change. */
  effects: { sounds: boolean; caller: boolean; leds: boolean; volume: number; rev: number };
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
  | { type: 'dart'; dart: Dart }
  | { type: 'fix'; index: number; dart: Dart }
  | { type: 'undo' }
  | { type: 'next' }
  | { type: 'nextLeg' }
  | { type: 'endMatch'; save: boolean }
  | { type: 'closeMatch'; then: 'summary' | 'rematch' | 'lobby' }
  | { type: 'closeSummary' }
  | { type: 'dismissResumed' }
  | { type: 'board'; action: BoardAction }
  | { type: 'fakeBoard'; on: boolean }
  | { type: 'boardTest'; on: boolean }
  | { type: 'showQr'; show: boolean }
  | { type: 'player'; cmd: PlayerCommand }
  | { type: 'effects'; sounds?: boolean; caller?: boolean; leds?: boolean }
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
  results: { played: number; won: number; winrate: number | null };
  recent: { id: number; endedAt: number; description: string; opponents: string; result: 'won' | 'lost' | 'saved' | 'played'; score: string }[];
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
  played: number;
  won: number;
  totals: Record<string, number>;
  /** Best result per record variant. */
  bests: { label: string; value: string }[];
}

/** Dart positions per player in one game and window; `distance` in metres. */
export type HeatResponse = { player: PlayerInfo; heat: PlayerHeat; distance: number }[];

export interface RecordTable {
  key: string;
  label: string;
  rows: { value: string; who: string; at: number }[];
}

export interface PlayerListItem {
  id: number;
  name: string;
  avg: number | null;
  matches: number;
  lastPlayed: number | null;
}
