import { Player, WinState } from '../types';
import { WINNING_COMBINATIONS, BOT_BLUNDER_CHANCE } from '../constants';

// Check current board state
export const checkWinner = (squares: Player[]): WinState | null => {
  for (let i = 0; i < WINNING_COMBINATIONS.length; i++) {
    const [a, b, c] = WINNING_COMBINATIONS[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return { winner: squares[a], line: WINNING_COMBINATIONS[i] };
    }
  }
  if (!squares.includes(null)) {
    return { winner: 'DRAW', line: null };
  }
  return null;
};

// Minimax Algorithm
const minimax = (squares: Player[], depth: number, isMaximizing: boolean): number => {
  const result = checkWinner(squares);
  if (result) {
    if (result.winner === 'O') return 10 - depth;
    if (result.winner === 'X') return depth - 10;
    if (result.winner === 'DRAW') return 0;
  }

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < squares.length; i++) {
      if (squares[i] === null) {
        squares[i] = 'O';
        const score = minimax(squares, depth + 1, false);
        squares[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < squares.length; i++) {
      if (squares[i] === null) {
        squares[i] = 'X';
        const score = minimax(squares, depth + 1, true);
        squares[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
};

export const getBotMove = (squares: Player[]): number => {
  const availableMoves = squares
    .map((val, idx) => (val === null ? idx : null))
    .filter((val) => val !== null) as number[];

  if (availableMoves.length === 0) return -1;

  // 11% Chance to make a random blunder
  const isBlunder = Math.random() < BOT_BLUNDER_CHANCE;

  if (isBlunder && availableMoves.length > 0) {
    console.log("BOT BLUNDER! Player has a chance!");
    const randomIndex = Math.floor(Math.random() * availableMoves.length);
    return availableMoves[randomIndex];
  }

  // Otherwise, play perfect
  let bestScore = -Infinity;
  let move = availableMoves[0];

  for (let i = 0; i < squares.length; i++) {
    if (squares[i] === null) {
      squares[i] = 'O';
      const score = minimax(squares, 0, false);
      squares[i] = null;
      if (score > bestScore) {
        bestScore = score;
        move = i;
      }
    }
  }

  return move;
};