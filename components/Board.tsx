import React from 'react';
import { Player } from '../types';
import { X, Circle } from 'lucide-react';

interface BoardProps {
  squares: Player[];
  onClick: (i: number) => void;
  winningLine: number[] | null;
  disabled: boolean;
  isBotTurn: boolean;
}

export const Board: React.FC<BoardProps> = ({ squares, onClick, winningLine, disabled, isBotTurn }) => {
  const containerClass = isBotTurn ? 'neon-box-pink' : 'neon-box-cyan';
  
  return (
    <div className={`grid grid-cols-3 gap-3 p-3 bg-gray-800 rounded-xl relative transition-all duration-500 ${containerClass}`}>
      {squares.map((square, i) => {
        const isWinningSquare = winningLine?.includes(i);
        return (
          <button
            key={i}
            onClick={() => onClick(i)}
            disabled={disabled || square !== null}
            className={`
              w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center rounded-lg text-4xl sm:text-5xl transition-all duration-200
              ${square === null 
                ? 'bg-gray-900 hover:bg-gray-700 cursor-pointer' 
                : 'bg-gray-900 cursor-default'}
              ${isWinningSquare ? 'bg-green-900/50 ring-2 ring-green-400' : ''}
              ${disabled && square === null ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {square === 'X' && (
              <X 
                size={60} 
                className="text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" 
                strokeWidth={3}
              />
            )}
            {square === 'O' && (
              <Circle 
                size={55} 
                className="text-pink-500 drop-shadow-[0_0_5px_rgba(236,72,153,0.8)]" 
                strokeWidth={3}
              />
            )}
          </button>
        );
      })}
      
      {/* Grid lines decoration effect - changes color based on turn */}
      <div className={`absolute inset-0 pointer-events-none rounded-xl border-2 transition-colors duration-500 ${isBotTurn ? 'border-pink-500/20' : 'border-cyan-400/20'}`}></div>
    </div>
  );
};