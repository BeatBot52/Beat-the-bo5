export type Player = 'X' | 'O' | null;

export interface WinState {
  winner: Player | 'DRAW';
  line: number[] | null;
  reason?: 'TIMEOUT' | 'NORMAL';
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  date: string;
  roundsWon: number;
  timeTaken: number; // Time in seconds
  botComment?: string;
}

export enum GameStage {
  LOGIN = 'LOGIN',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export interface GameSettings {
  playerName: string;
  totalRounds: number; // 1, 2, or 3
}