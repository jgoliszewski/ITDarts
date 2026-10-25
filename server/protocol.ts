// Messages between the server and browsers. Imported by web/ as types only.
import type { Dart } from '../games/darts.ts';
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
  connected: boolean;
  version: string | null;
  detecting: boolean;
  lastEvent: { text: string; at: number } | null;
  takeout: { active: boolean; since: number | null };
  busy: { action: BoardAction; since: number } | null;
}

export interface LiveMatch {
  key: string;
  game: 'x01';
  options: X01Options;
  description: string;
  roster: RosterEntry[];
  startedAt: number;
  view: X01View;
  /** Match came back after a server restart; the pilot shows a notice. */
  resumed: boolean;
  lastFix: { index: number; at: number } | null;
}

export interface MatchSummary {
  id: number;
  description: string;
  endedAt: number;
  status: 'finished' | 'ended';
  players: { name: string; legs: number; sets: number; avg: number | null; winner: boolean }[];
  checkout: string | null;
}

export interface ClientState {
  you: { clientId: string; isPilot: boolean; isLocal: boolean };
  pilot: { clientId: string; deviceName: string; connected: boolean } | null;
  board: BoardStatus;
  match: LiveMatch | null;
  lastMatch: MatchSummary | null;
  players: PlayerInfo[];
  recentPlayerIds: number[];
  urls: string[];
  showQr: boolean;
}

export type PlayerCommand =
  | { action: 'create'; name: string }
  | { action: 'rename'; id: number; name: string }
  | { action: 'merge'; from: number; into: number }
  | { action: 'archive'; id: number; archived: boolean }
  | { action: 'anonymize'; id: number };

export type Command =
  | { type: 'takeControl' }
  | { type: 'startMatch'; game: 'x01'; options: X01Options; roster: RosterEntry[] }
  | { type: 'rematch' }
  | { type: 'bullOff'; starter: number }
  | { type: 'dart'; dart: Dart }
  | { type: 'fix'; index: number; dart: Dart }
  | { type: 'undo' }
  | { type: 'next' }
  | { type: 'nextLeg' }
  | { type: 'endMatch'; save: boolean }
  | { type: 'closeMatch'; then: 'rematch' | 'lobby' }
  | { type: 'dismissResumed' }
  | { type: 'board'; action: BoardAction }
  | { type: 'showQr'; show: boolean }
  | { type: 'player'; cmd: PlayerCommand }
  | { type: 'closeApp' };

export type ClientMessage =
  | { type: 'hello'; clientId: string; deviceName: string }
  | { type: 'cmd'; id: number; cmd: Command };

export type ServerMessage =
  | { type: 'state'; state: ClientState }
  | { type: 'result'; id: number; ok: boolean; error?: string; playerId?: number };

// ---------- stats API ----------

export type StatsWindow = '7d' | '30d' | '90d' | '365d' | 'all' | 'l10' | 'l100';

export interface PlayerStatsResponse {
  player: PlayerInfo;
  window: StatsWindow;
  x01: import('../games/x01/stats.ts').X01Stats;
  results: { played: number; won: number; winrate: number | null };
  recent: { id: number; endedAt: number; description: string; opponents: string; result: 'won' | 'lost' | 'saved'; score: string }[];
  opponents: { id: number; name: string; played: number; won: number }[];
}

export interface H2HResponse {
  window: StatsWindow;
  players: [PlayerInfo, PlayerInfo];
  played: number;
  wins: [number, number];
  avg: [number | null, number | null];
}

export interface PlayerListItem {
  id: number;
  name: string;
  avg: number | null;
  matches: number;
  lastPlayed: number | null;
}
