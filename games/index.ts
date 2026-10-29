// Game catalog: every playable game and its module.
import { oneTwentyOne } from './121.ts';
import { cricket } from './cricket.ts';
import { hol } from './hol.ts';
import { killer } from './killer.ts';
import { atc, fullBoard } from './race.ts';
import { randomCheckouts } from './randomco.ts';
import type { GameId, GameModule } from './turns.ts';
import { x01 } from './x01/index.ts';

export type { GameId, GameModule } from './turns.ts';

export const GAMES: Record<GameId, GameModule> = { x01, atc, fullboard: fullBoard, '121': oneTwentyOne, cricket, killer, hol, randomco: randomCheckouts };

/** In the order of the setup tiles (object keys would put '121' first). */
export const GAME_IDS: GameId[] = ['x01', 'cricket', 'atc', 'fullboard', '121', 'randomco', 'killer', 'hol'];

export const isGameId = (id: unknown): id is GameId => typeof id === 'string' && id in GAMES;

export const MAX_PLAYERS = 8;
