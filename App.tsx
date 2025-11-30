
import React, { useState, useEffect, useRef } from 'react';
import { Trash2, RotateCcw, Trophy, User, Zap, Lightbulb, X as XIcon, Volume2, VolumeX, ScanLine, Timer, AlertTriangle, Download } from 'lucide-react';
import { Player, WinState, GameStage, GameSettings, LeaderboardEntry } from './types';
import { TAUNTS, HINTS, BOT_BLUNDER_CHANCE, LEADERBOARD_COMMENTS, SCANNING_MESSAGES, AWAY_MESSAGES, GAME_DURATION } from './constants';
import { checkWinner, getBotMove } from './services/ai';
import { Board } from './components/Board';
import { TrashTalk } from './components/TrashTalk';
import { ConfettiEffect } from './components/ConfettiEffect';

export default function App() {
  const [stage, setStage] = useState<GameStage>(GameStage.LOGIN);
  const [settings, setSettings] = useState<GameSettings>({ playerName: '', totalRounds: 1 });
  
  const [squares, setSquares] = useState<Player[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState<boolean>(true);
  const [winState, setWinState] = useState<WinState | null>(null);
  
  const [botTaunt, setBotTaunt] = useState<string>(TAUNTS.START[0]);
  const [roundsPlayed, setRoundsPlayed] = useState<number>(0);
  const [scores, setScores] = useState({ player: 0, bot: 0 });
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isShaking, setIsShaking] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(SCANNING_MESSAGES[0]);
  
  // Timer State
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  // Audio state
  const [isMuted, setIsMuted] = useState(true);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // PWA Install Prompt State
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  const turnTimeoutRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Derived state for visuals
  const isBotTurn = !isXNext && stage === GameStage.PLAYING && !winState && !isScanning;
  const isPlayerTurn = isXNext && stage === GameStage.PLAYING && !winState && !isScanning;

  // --- PWA Install Handler ---
  useEffect(() => {
    const handleInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.then((choiceResult: any) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
        setInstallPrompt(null);
      }
    });
  };

  // --- TTS Handling ---
  useEffect(() => {
    if (!window.speechSynthesis) return;

    const speak = (text: string) => {
      if (isMuted) return;
      
      // Cancel previous speech to avoid queue buildup
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      speechRef.current = utterance;
      
      // Try to find a robotic/weird voice
      const voices = window.speechSynthesis.getVoices();
      const botVoice = voices.find(v => v.name.includes('Google US English')) || 
                       voices.find(v => v.name.includes('Samantha')) ||
                       voices[0];
      
      if (botVoice) utterance.voice = botVoice;
      utterance.pitch = 0.8; // Lower pitch for "bot" feel
      utterance.rate = 1.1;  // Slightly faster
      
      window.speechSynthesis.speak(utterance);
    };

    if (botTaunt) {
      speak(botTaunt);
    }
  }, [botTaunt, isMuted]);

  // --- Tab Visibility Warfare ---
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        document.title = AWAY_MESSAGES[Math.floor(Math.random() * AWAY_MESSAGES.length)];
      } else {
        document.title = "Beat The Bot";
        if (stage === GameStage.PLAYING && !winState) {
          setBotTaunt("Oh, look who decided to come back.");
        }
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [stage, winState]);

  // Load leaderboard on mount
  useEffect(() => {
    const saved = localStorage.getItem('btb_leaderboard');
    if (saved) {
      try {
        setLeaderboard(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse leaderboard");
      }
    }
  }, []);

  // --- Timer Logic ---
  useEffect(() => {
    if (stage === GameStage.PLAYING && !winState && !isScanning && isTimerRunning) {
      timerIntervalRef.current = window.setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleTimeout();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [stage, winState, isScanning, isTimerRunning]);

  const handleTimeout = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsTimerRunning(false);
    
    const result: WinState = { winner: 'O', line: null, reason: 'TIMEOUT' };
    setWinState(result);
    setBotTaunt(TAUNTS.TIMEOUT[Math.floor(Math.random() * TAUNTS.TIMEOUT.length)]);
    handleGameEnd(result);
  };

  // AI Turn Effect
  useEffect(() => {
    if (stage !== GameStage.PLAYING || isXNext || winState || isScanning) return;

    // Bot "thinking" delay
    const delay = Math.random() * 800 + 500;
    turnTimeoutRef.current = window.setTimeout(() => {
      const move = getBotMove(squares);
      if (move !== -1) {
        handleMove(move);
        const randomTaunt = TAUNTS.MOVE[Math.floor(Math.random() * TAUNTS.MOVE.length)];
        // Only change taunt if we aren't losing due to timeout in the split second
        if (timeLeft > 0) setBotTaunt(randomTaunt);
        
        setIsShaking(true);
        setTimeout(() => setIsShaking(false), 400);
      }
    }, delay);

    return () => {
      if (turnTimeoutRef.current) clearTimeout(turnTimeoutRef.current);
    };
  }, [isXNext, stage, winState, squares, isScanning]);

  const handleMove = (i: number) => {
    if (squares[i] || winState || isScanning || timeLeft <= 0) return;

    const nextSquares = squares.slice();
    nextSquares[i] = isXNext ? 'X' : 'O';
    setSquares(nextSquares);
    setIsXNext(!isXNext);

    const result = checkWinner(nextSquares);
    if (result) {
      setIsTimerRunning(false); // Stop timer immediately on win
      if (result.winner === 'X') {
        // Trigger fake cheat scanning
        setIsScanning(true);
        setBotTaunt("WAIT. CALCULATING...");
        
        // Cycle through fake scanning messages
        let scanSteps = 0;
        const scanInterval = setInterval(() => {
          setScanMessage(SCANNING_MESSAGES[Math.floor(Math.random() * SCANNING_MESSAGES.length)]);
          scanSteps++;
          if (scanSteps > 4) {
             clearInterval(scanInterval);
             setIsScanning(false);
             setWinState(result);
             handleGameEnd(result);
          }
        }, 800);
      } else {
        setWinState(result);
        handleGameEnd(result);
      }
    }
  };

  const handleHint = () => {
     const randomHint = HINTS[Math.floor(Math.random() * HINTS.length)];
     setBotTaunt(randomHint);
  };

  const handleBotHover = () => {
    if (stage !== GameStage.PLAYING || winState || isScanning) return;
    const randomTaunt = TAUNTS.HOVER[Math.floor(Math.random() * TAUNTS.HOVER.length)];
    setBotTaunt(randomTaunt);
  };

  const handleGameEnd = (result: WinState) => {
    const newRoundsPlayed = roundsPlayed + 1;
    setRoundsPlayed(newRoundsPlayed);
    
    let newScores = { ...scores };
    
    if (result.winner === 'X') {
      newScores.player += 1;
      setBotTaunt(TAUNTS.LOSE[Math.floor(Math.random() * TAUNTS.LOSE.length)]);
      
      const timeTaken = GAME_DURATION - timeLeft;
      
      const newEntry: LeaderboardEntry = {
        id: Date.now().toString(),
        name: settings.playerName,
        date: new Date().toLocaleDateString(),
        roundsWon: 1,
        timeTaken: timeTaken,
        botComment: LEADERBOARD_COMMENTS[Math.floor(Math.random() * LEADERBOARD_COMMENTS.length)]
      };
      
      // Add new entry, sort by time taken (ascending), then by date
      const updatedLeaderboard = [...leaderboard, newEntry]
        .sort((a, b) => a.timeTaken - b.timeTaken)
        .slice(0, 50);

      setLeaderboard(updatedLeaderboard);
      localStorage.setItem('btb_leaderboard', JSON.stringify(updatedLeaderboard));

    } else if (result.winner === 'O') {
      newScores.bot += 1;
      // If it wasn't a timeout, show a generic win message
      if (result.reason !== 'TIMEOUT') {
        setBotTaunt(TAUNTS.WIN[Math.floor(Math.random() * TAUNTS.WIN.length)]);
      }
    } else {
      setBotTaunt(TAUNTS.DRAW[Math.floor(Math.random() * TAUNTS.DRAW.length)]);
    }

    setScores(newScores);
  };

  const startGame = () => {
    if (!settings.playerName.trim()) return;
    setStage(GameStage.PLAYING);
    resetBoard();
    setRoundsPlayed(0);
    setScores({ player: 0, bot: 0 });
    setBotTaunt(TAUNTS.START[Math.floor(Math.random() * TAUNTS.START.length)]);
  };

  const resetBoard = () => {
    setSquares(Array(9).fill(null));
    setWinState(null);
    setIsXNext(true); 
    setIsScanning(false);
    setTimeLeft(GAME_DURATION);
    setIsTimerRunning(true);
  };

  const resetGameFull = () => {
    setStage(GameStage.LOGIN);
    setSettings({ ...settings, playerName: '' });
    setIsTimerRunning(false);
  };

  const nextRound = () => {
     resetBoard();
  }

  const isSessionOver = roundsPlayed >= settings.totalRounds && winState !== null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[url('https://images.unsplash.com/photo-1535868463750-c78d9543614f?q=80&w=2076&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat bg-blend-multiply bg-gray-900 overflow-hidden select-none">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>
      
      {/* Top Controls */}
      <div className="absolute top-4 right-4 z-40 flex gap-2">
         <button 
           onClick={() => setIsMuted(!isMuted)}
           className={`p-3 bg-gray-900/80 border rounded-full transition-all hover:scale-110 active:scale-95 shadow-lg group ${isMuted ? 'border-gray-600 text-gray-400' : 'border-pink-500 text-pink-500 hover:bg-pink-500/20'}`}
           title={isMuted ? "Enable Bot Voice" : "Mute Bot Voice"}
         >
           {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} className="animate-pulse" />}
         </button>
      </div>
      
      {/* Top Left - Winners Board */}
      <div className="absolute top-4 left-4 z-40">
         <button 
           onClick={() => setShowLeaderboard(true)}
           className="px-4 py-3 bg-gray-900/90 border-2 border-yellow-500/60 rounded-lg hover:bg-yellow-500/10 text-yellow-500 transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(234,179,8,0.2)] flex items-center gap-2 group"
           title="Check who got lucky"
         >
           <Trophy size={20} className="group-hover:animate-bounce" />
           <span className="font-bold font-mono tracking-wide hidden sm:inline text-sm">HALL OF MIRACLES</span>
         </button>
      </div>

      <ConfettiEffect active={winState?.winner === 'X' && !isScanning} />

      <div className="relative z-10 w-full max-w-lg flex flex-col items-center">
        
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 neon-text-pink tracking-tighter italic transform -skew-x-6 drop-shadow-lg glitch-hover cursor-default">
            BEAT THE BOT
          </h1>
          <p className="text-cyan-400 font-mono mt-2 text-lg tracking-widest uppercase glow-cyan">
            Good luck, meatbag 😈
          </p>
        </div>

        {stage === GameStage.LOGIN && (
          <div className="bg-gray-800/90 p-8 rounded-2xl shadow-2xl border border-pink-500/30 backdrop-blur-md w-full animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col gap-6">
              <div>
                <label className="block text-pink-500 font-bold mb-2 font-mono">IDENTIFY YOURSELF</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="ENTER NAME"
                    className="w-full bg-gray-900 border-2 border-gray-700 text-white pl-10 pr-4 py-2 rounded focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 font-mono transition-all uppercase"
                    value={settings.playerName}
                    onChange={(e) => setSettings({ ...settings, playerName: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-cyan-400 font-bold mb-2 font-mono">SELECT ROUNDS</label>
                <div className="flex gap-4">
                  {[1, 2, 3].map(num => (
                    <button
                      key={num}
                      onClick={() => setSettings({ ...settings, totalRounds: num })}
                      className={`flex-1 py-3 rounded border-2 font-bold transition-all duration-200 ${
                        settings.totalRounds === num
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]'
                          : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-500'
                      }`}
                    >
                      {num} {num === 1 ? 'ROUND' : 'ROUNDS'}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="bg-black/30 p-3 rounded border border-gray-700 text-xs text-gray-400 flex items-start gap-2">
                 <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                 <span>WARNING: 20-second timer active. Brain lag results in immediate termination.</span>
              </div>

              <button
                onClick={startGame}
                disabled={!settings.playerName}
                className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black py-4 rounded shadow-lg transform hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed glitch-hover uppercase tracking-widest text-xl mt-4 relative overflow-hidden group"
              >
                <span className="relative z-10">INITIATE PROTOCOL</span>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              </button>

              {installPrompt && (
                <button
                  onClick={handleInstallClick}
                  className="w-full mt-2 bg-gray-900 border border-cyan-500/50 text-cyan-400 py-3 rounded font-mono font-bold uppercase tracking-widest hover:bg-cyan-900/20 transition-all flex items-center justify-center gap-2 group animate-pulse"
                >
                  <Download size={20} className="group-hover:animate-bounce" />
                  INSTALL NEURAL LINK
                </button>
              )}
            </div>
          </div>
        )}

        {stage === GameStage.PLAYING && (
          <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-500">
            
            {/* Timer Display */}
            <div className={`mb-4 flex items-center gap-2 text-2xl font-black font-mono transition-colors duration-300 ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                <Timer size={24} className={timeLeft <= 5 ? 'animate-spin' : ''} />
                <span className="tracking-widest">00:{timeLeft.toString().padStart(2, '0')}</span>
            </div>
            
            {/* Scoreboard */}
            <div className="flex w-full justify-between gap-2 mb-4">
              <div className={`flex flex-col items-center w-1/3 p-2 rounded-lg border transition-all duration-300 ${isPlayerTurn ? 'bg-cyan-900/40 border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-black/40 border-gray-700 opacity-60'}`}>
                <span className="text-xs text-gray-400 font-mono mb-1">YOU (X)</span>
                <span className={`text-2xl font-bold ${isPlayerTurn ? 'text-cyan-300 drop-shadow-[0_0_5px_cyan]' : 'text-cyan-700'}`}>{scores.player}</span>
              </div>
              
              <div className="flex flex-col items-center w-1/3 py-2 bg-black/20 rounded-lg border border-gray-800">
                <span className="text-xs text-gray-500 font-mono">ROUND</span>
                <span className="text-xl font-bold text-gray-300">{roundsPlayed} / {settings.totalRounds}</span>
              </div>
              
              <div 
                onMouseEnter={handleBotHover}
                className={`flex flex-col items-center w-1/3 p-2 rounded-lg border transition-all duration-300 cursor-help ${isBotTurn ? 'bg-pink-900/40 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.3)] animate-pulse' : 'bg-black/40 border-gray-700 opacity-60'}`}
              >
                <span className="text-xs text-gray-400 font-mono mb-1">BOT (O)</span>
                <span className={`text-2xl font-bold ${isBotTurn ? 'text-pink-300 drop-shadow-[0_0_5px_magenta]' : 'text-pink-800'}`}>{scores.bot}</span>
              </div>
            </div>

            <TrashTalk message={botTaunt} />

            <div className={`relative my-4 transition-transform ${isShaking ? 'shake-hard' : ''}`}>
              <Board 
                squares={squares} 
                onClick={handleMove} 
                winningLine={winState?.line || null}
                disabled={winState !== null || !isXNext || isScanning}
                isBotTurn={isBotTurn}
              />
              
              {/* Scanning Overlay (Fake Cheat Detection) */}
              {isScanning && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 rounded-xl backdrop-blur-sm animate-in fade-in duration-200 overflow-hidden border-2 border-red-500">
                  <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_#ef4444] scan-line-anim"></div>
                  <ScanLine size={48} className="text-red-500 animate-pulse mb-4" />
                  <h3 className="text-2xl font-bold text-red-500 animate-pulse text-center px-4 font-mono">
                    CHEATER DETECTED
                  </h3>
                  <p className="text-red-300 font-mono mt-2 text-sm text-center px-6">
                    {scanMessage}
                  </p>
                </div>
              )}

              {/* Result Overlay */}
              {winState && !isScanning && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 rounded-xl backdrop-blur-sm animate-in zoom-in duration-300">
                   <div className="text-center p-4">
                      {winState.winner === 'X' ? (
                        <>
                           <h2 className="text-4xl font-black text-cyan-400 mb-2 drop-shadow-lg animate-bounce">
                             NO WAY!
                           </h2>
                           <p className="text-white font-mono text-sm">Completed in {GAME_DURATION - timeLeft}s</p>
                        </>
                      ) : winState.winner === 'O' ? (
                        <>
                           <h2 className="text-4xl font-black text-pink-500 mb-2 drop-shadow-lg">
                             {winState.reason === 'TIMEOUT' ? 'TIME UP!' : 'REKT!'}
                           </h2>
                           {winState.reason === 'TIMEOUT' && <p className="text-red-500 font-mono text-sm">TOO SLOW MEATBAG</p>}
                        </>
                      ) : (
                        <h2 className="text-3xl font-black text-gray-300 mb-2">
                          DRAW
                        </h2>
                      )}
                      
                      {!isSessionOver ? (
                         <button 
                            onClick={nextRound}
                            className="mt-4 px-6 py-2 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors flex items-center gap-2 mx-auto"
                         >
                           NEXT ROUND <Zap size={18} />
                         </button>
                      ) : (
                         <div className="mt-4">
                            <p className="text-sm text-gray-400 mb-3">SESSION COMPLETE</p>
                            <button 
                                onClick={resetGameFull}
                                className="px-6 py-2 bg-pink-600 text-white font-bold rounded hover:bg-pink-500 transition-colors flex items-center gap-2 mx-auto"
                            >
                              NEW GAME <RotateCcw size={18} />
                            </button>
                         </div>
                      )}
                   </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-4 mt-8">
              <button 
                  onClick={handleHint}
                  disabled={winState !== null || isScanning}
                  className="px-4 py-2 rounded bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 hover:bg-yellow-500/30 transition-colors flex items-center gap-2 text-xs font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Lightbulb size={14} /> Need Help?
              </button>

              <button 
                  onClick={resetGameFull}
                  className="px-4 py-2 rounded bg-gray-800 text-gray-400 border border-gray-700 hover:bg-red-900/50 hover:text-red-400 hover:border-red-800 transition-colors flex items-center gap-2 text-xs font-bold uppercase group"
              >
                <Trash2 size={14} className="group-hover:rotate-12 transition-transform" /> Rage Quit
              </button>
            </div>

          </div>
        )}
      </div>

      {/* Winners Board Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-gray-900 border-2 border-yellow-500/50 rounded-xl p-6 shadow-[0_0_50px_rgba(234,179,8,0.2)] max-h-[80vh] flex flex-col relative">
            <button 
              onClick={() => setShowLeaderboard(false)} 
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              <XIcon size={24} />
            </button>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-800">
              <Trophy size={32} className="text-yellow-500 animate-pulse" />
              <div className="flex flex-col">
                 <h2 className="text-2xl md:text-3xl font-black text-yellow-500 font-orbitron tracking-wide">
                   HALL OF MIRACLES
                 </h2>
                 <p className="text-xs text-gray-400 font-mono">RANKED BY SPEED (LUCK)</p>
              </div>
            </div>
            
            <div className="overflow-y-auto space-y-3 pr-2 flex-1 custom-scrollbar">
              {leaderboard.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-500 font-mono opacity-50">
                     <p className="text-xl">NO WINNERS YET</p>
                     <p className="text-sm">I am inevitable.</p>
                  </div>
              ) : (
                  leaderboard.map((entry, idx) => (
                      <div key={idx} className="bg-black/40 border border-gray-800 p-4 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-3 hover:border-yellow-500/30 transition-colors group">
                          <div className="flex items-center gap-4">
                              <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold font-mono text-lg border ${idx === 0 ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'}`}>
                                {idx + 1}
                              </div>
                              <div>
                                  <div className="text-lg font-bold text-white tracking-wide">{entry.name}</div>
                                  <div className="flex gap-4 text-xs font-mono text-gray-400">
                                      <span>{entry.date}</span>
                                      <span className="text-cyan-400 font-bold">TIME: {entry.timeTaken}s</span>
                                  </div>
                              </div>
                          </div>
                          <div className="sm:text-right pl-14 sm:pl-0">
                              <div className="text-[10px] text-pink-500 font-bold uppercase tracking-wider mb-0.5">BOT_COMMENT.LOG</div>
                              <div className="text-cyan-400 font-mono text-sm italic border-l-2 border-cyan-500/30 pl-2 sm:border-none sm:pl-0">
                                "{entry.botComment || 'System glitch.'}"
                              </div>
                          </div>
                      </div>
                  ))
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800 text-center text-xs text-gray-600 font-mono">
               FASTEST CLICKERS OR BIGGEST CHEATERS?
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
