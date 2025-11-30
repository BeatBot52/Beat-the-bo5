
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

  // Helper to determine coordinates for the winning line
  const getLineCoordinates = (line: number[]) => {
    // Map grid index to percentage coordinates (center of squares)
    // 0: 16.66%, 1: 50%, 2: 83.33%
    const getCoord = (idx: number) => {
      const row = Math.floor(idx / 3);
      const col = idx % 3;
      return {
        x: (col * 33.33) + 16.66,
        y: (row * 33.33) + 16.66
      };
    };

    const start = getCoord(line[0]);
    const end = getCoord(line[2]);

    return { 
      x1: start.x, 
      y1: start.y, 
      x2: end.x, 
      y2: end.y 
    };
  };

  const coords = winningLine ? getLineCoordinates(winningLine) : null;
  const winner = winningLine ? squares[winningLine[0]] : null;
  const lineColor = winner === 'O' ? '#ec4899' : '#22d3ee'; // Pink for Bot, Cyan for Player
  
  // Construct path string (M x1 y1 L x2 y2)
  // We use percentages for the path to be responsive
  const pathD = coords ? `M ${coords.x1} ${coords.y1} L ${coords.x2} ${coords.y2}` : '';

  return (
    <div className={`w-full aspect-square grid grid-cols-3 gap-2 md:gap-4 p-3 md:p-5 bg-gray-800 rounded-xl relative transition-all duration-500 ${containerClass} ${isBotTurn ? 'scale-[1.01] shadow-[0_0_30px_rgba(236,72,153,0.5)]' : ''}`}>
      {squares.map((square, i) => {
        const isWinningSquare = winningLine?.includes(i);
        return (
          <button
            key={i}
            onClick={() => onClick(i)}
            disabled={disabled || square !== null}
            className={`
              w-full h-full aspect-square
              flex items-center justify-center rounded-lg 
              transition-all duration-200 relative z-10
              ${square === null 
                ? 'bg-gray-900 hover:bg-gray-700 cursor-pointer' 
                : 'bg-gray-900 cursor-default'}
              ${isWinningSquare ? 'bg-opacity-80' : ''}
              ${disabled && square === null ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {square === 'X' && (
              <X 
                className="w-[60%] h-[60%] text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)] symbol-appear" 
                strokeWidth={3}
              />
            )}
            {square === 'O' && (
              <Circle 
                className="w-[60%] h-[60%] text-pink-500 drop-shadow-[0_0_5px_rgba(236,72,153,0.8)] symbol-appear" 
                strokeWidth={3}
              />
            )}
          </button>
        );
      })}
      
      {/* Grid lines decoration effect - changes color based on turn */}
      <div className={`absolute inset-0 pointer-events-none rounded-xl border-2 transition-colors duration-500 ${isBotTurn ? 'border-pink-500/20' : 'border-cyan-400/20'}`}></div>

      {/* Winning Connection Animation */}
      {winningLine && coords && (
        <svg 
          viewBox="0 0 100 100" 
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none z-20 rounded-xl overflow-visible"
        >
          <defs>
            {/* Glow Filter */}
            <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 1. The Glow (Thick blurred line) */}
          <path 
            d={pathD} 
            stroke={lineColor} 
            strokeWidth="4" 
            strokeLinecap="round" 
            opacity="0.6"
            filter="url(#neon-glow)"
          >
             <animate attributeName="stroke-dasharray" from="0, 200" to="200, 0" dur="0.4s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" />
          </path>

          {/* 2. The Core Beam (Sharp line) */}
          <path 
            id="win-path"
            d={pathD} 
            stroke={lineColor} 
            strokeWidth="2" 
            strokeLinecap="round"
            className="drop-shadow-md"
          >
            <animate attributeName="stroke-dasharray" from="0, 200" to="200, 0" dur="0.4s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" />
          </path>

          {/* 3. The Energy Spark (Particle following the line) */}
          <circle r="3" fill="#ffffff">
            <animateMotion dur="0.4s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1">
              <mpath href="#win-path" />
            </animateMotion>
            <animate attributeName="opacity" values="1;0" dur="0.6s" fill="freeze" />
            <animate attributeName="r" values="3;6;0" dur="0.6s" fill="freeze" />
          </circle>
        </svg>
      )}
    </div>
  );
};
