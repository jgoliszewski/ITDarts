// Game catalog. Only X01 is playable; the rest waits for issue #3.
export interface GameInfo {
  id: string;
  name: string;
  available: boolean;
}

export const GAMES: GameInfo[] = [
  { id: 'x01', name: 'X01', available: true },
  { id: '121', name: '121', available: false },
  { id: 'cricket', name: 'Cricket', available: false },
  { id: 'atc', name: 'Around the Clock', available: false },
  { id: 'killer', name: 'Killer', available: false },
];
