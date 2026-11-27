// Game catalog: every playable game and its module.
import { oneTwentyOne } from './121.ts';
import { cricket } from './cricket.ts';
import { freethrow } from './freethrow.ts';
import { football } from './football.ts';
import { bullseye } from './bullseye.ts';
import { bobs27 } from './bobs27.ts';
import { catch40 } from './catch40.ts';
import { gotcha } from './gotcha.ts';
import { hareAndHounds } from './hare.ts';
import { hol } from './hol.ts';
import { killer } from './killer.ts';
import { knockout } from './knockout.ts';
import { atc, fullBoard } from './race.ts';
import { randomCheckouts } from './randomco.ts';
import { shanghai } from './shanghai.ts';
import type { GameGroup, GameId, GameModule } from './turns.ts';
import { x01 } from './x01/index.ts';

export type { GameGroup, GameId, GameModule } from './turns.ts';

export const GAMES: Record<GameId, GameModule> = { x01, atc, fullboard: fullBoard, '121': oneTwentyOne, cricket, killer, hol, randomco: randomCheckouts, shanghai, gotcha, knockout, football, bullseye, freethrow, hare: hareAndHounds, catch40, bobs27 };

/** In the order of the setup tiles within their groups (object keys would put '121' first). */
export const GAME_IDS: GameId[] = ['x01', 'atc', 'fullboard', '121', 'randomco', 'freethrow', 'catch40', 'bobs27', 'cricket', 'killer', 'hol', 'shanghai', 'gotcha', 'knockout', 'football', 'bullseye', 'hare'];

const GROUP_TITLES: [GameGroup, string][] = [['classic', 'Classic'], ['practice', 'Practice'], ['versus', 'Versus']];

export const GAME_GROUPS = GROUP_TITLES.map(([group, title]) => ({ group, title, ids: GAME_IDS.filter(id => GAMES[id].group === group) }));

export const isGameId = (id: unknown): id is GameId => typeof id === 'string' && id in GAMES;

export const MAX_PLAYERS = 8;
