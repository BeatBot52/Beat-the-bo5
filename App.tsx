
import React, { useState, useEffect, useRef } from 'react';
import { Trash2, RotateCcw, Trophy, User, Zap, Lightbulb, X as XIcon, Volume2, VolumeX, ScanLine, Timer, AlertTriangle, Download, WifiOff, Skull, Crown } from 'lucide-react';
import { Player, WinState, GameStage, GameSettings, LeaderboardEntry } from './types';
import { TAUNTS, HINTS, BOT_BLUNDER_CHANCE, LEADERBOARD_COMMENTS, SCANNING_MESSAGES, AWAY_MESSAGES, GAME_DURATION } from './constants';
import { checkWinner, getBotMove } from './services/ai';
import { playPlayerMove, playBotMove, playWin, playLose, playDraw, playTicker, playPowerDown, playStamp } from './services/audio';
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
  
  // New visual states
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [victimCount, setVictimCount] = useState(0);
  const [showVictimStamp, setShowVictimStamp] = useState(false);
  const [flashScreen, setFlashScreen] = useState(false);

  // Timer State
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  
  // Audio state
  const [isMuted, setIsMuted] = useState(true);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  // PWA Install State
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  const turnTimeoutRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const resultTimeoutRef = useRef<number | null>(null);

  // Derived state for visuals
  const isBotTurn = !isXNext && stage === GameStage.PLAYING && !winState && !isScanning;
  const isPlayerTurn = isXNext && stage === GameStage.PLAYING && !winState && !isScanning;
  
  // Get Top Player
  const topPlayer = leaderboard.length > 0 ? leaderboard[0] : null;
  const topThree = leaderboard.slice(0, 3);

  // --- Network Status ---
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- PWA Install Handler ---
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }

    const handleInstallPrompt = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
    };
  }, []);

  const handleInstallClick = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
          setInstallPrompt(null);
        }
      });
    } else {
      setBotTaunt("MANUAL OVERRIDE: Tap the 3 dots ↗️ and select 'Install App' or 'Add to Home Screen'.");
      alert("To install for Offline Play:\n\n1. Tap the browser menu (⋮ or ↗️)\n2. Select 'Add to Home Screen' or 'Install App'");
    }
  };

  // --- TTS Handling ---
  useEffect(() => {
    if (!window.speechSynthesis) return;

    const speak = (text: string) => {
      if (isMuted) return;
      
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      speechRef.current = utterance;
      
      const voices = window.speechSynthesis.getVoices();
      const botVoice = voices.find(v => v.name.includes('Google US English')) || 
                       voices.find(v => v.name.includes('Samantha')) ||
                       voices[0];
      
      if (botVoice) utterance.voice = botVoice;
      utterance.pitch = 0.8;
      utterance.rate = 1.1;
      
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

  // Load leaderboard & victim count on mount
  useEffect(() => {
    const saved = localStorage.getItem('btb_leaderboard');
    if (saved) {
      try {
        setLeaderboard(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse leaderboard");
      }
    }
    const savedVictims = localStorage.getItem('btb_victim_count');
    if (savedVictims) {
        setVictimCount(parseInt(savedVictims));
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
          // Panic Ticker Sound
          if (prev <= 11 && !isMuted) { // prev is about to become prev-1
             playTicker();
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
  }, [stage, winState, isScanning, isTimerRunning, isMuted]);

  const handleTimeout = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsTimerRunning(false);
    
    const result: WinState = { winner: 'O', line: null, reason: 'TIMEOUT' };
    setWinState(result);
    setBotTaunt(TAUNTS.TIMEOUT[Math.floor(Math.random() * TAUNTS.TIMEOUT.length)]);
    if (!isMuted) playLose();
    handleGameEnd(result);
  };

  // AI Turn Effect
  useEffect(() => {
    if (stage !== GameStage.PLAYING || isXNext || winState || isScanning) return;

    const delay = Math.random() * 800 + 500;
    turnTimeoutRef.current = window.setTimeout(() => {
      const move = getBotMove(squares);
      if (move !== -1) {
        handleMove(move);
        const randomTaunt = TAUNTS.MOVE[Math.floor(Math.random() * TAUNTS.MOVE.length)];
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

    // Play Move Sound
    if (!isMuted) {
       if (isXNext) playPlayerMove();
       else playBotMove();
    }

    const nextSquares = squares.slice();
    nextSquares[i] = isXNext ? 'X' : 'O';
    setSquares(nextSquares);
    setIsXNext(!isXNext);

    const result = checkWinner(nextSquares);
    if (result) {
      setIsTimerRunning(false);
      setFlashScreen(true);
      setTimeout(() => setFlashScreen(false), 500); // Reset flash

      if (result.winner === 'X') {
        setIsScanning(true);
        setBotTaunt("WAIT. CALCULATING...");
        
        let scanSteps = 0;
        const scanInterval = setInterval(() => {
          setScanMessage(SCANNING_MESSAGES[Math.floor(Math.random() * SCANNING_MESSAGES.length)]);
          scanSteps++;
          if (scanSteps > 4) {
             clearInterval(scanInterval);
             setIsScanning(false);
             setWinState(result);
             if (!isMuted) playWin();
             handleGameEnd(result);
          }
        }, 800);
      } else {
        setWinState(result);
        if (result.reason !== 'TIMEOUT' && !isMuted) playLose();
        handleGameEnd(result);
      }
    } else if (result === null && !nextSquares.includes(null)) {
        // Draw implicit check (though checkWinner returns DRAW object usually)
    } else {
       // Check for draw explicitly if not caught above
       if (!nextSquares.includes(null) && !result) {
           const drawState: WinState = { winner: 'DRAW', line: null };
           setWinState(drawState);
           if (!isMuted) playDraw();
           handleGameEnd(drawState);
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
      
      const updatedLeaderboard = [...leaderboard, newEntry]
        .sort((a, b) => a.timeTaken - b.timeTaken)
        .slice(0, 50);

      setLeaderboard(updatedLeaderboard);
      localStorage.setItem('btb_leaderboard', JSON.stringify(updatedLeaderboard));

    } else if (result.winner === 'O') {
      newScores.bot += 1;
      if (result.reason !== 'TIMEOUT') {
        setBotTaunt(TAUNTS.WIN[Math.floor(Math.random() * TAUNTS.WIN.length)]);
      }
      
      // Update Victim Count
      const newVictims = victimCount + 1;
      setVictimCount(newVictims);
      localStorage.setItem('btb_victim_count', newVictims.toString());
      
      // Trigger Victim Stamp with Delay
      setTimeout(() => {
          setShowVictimStamp(true);
          if (!isMuted) playStamp();
          setIsShaking(true); // Big shake on stamp
          setTimeout(() => {
              setShowVictimStamp(false);
              setIsShaking(false);
          }, 2500);
      }, 600);
    } else {
      setBotTaunt(TAUNTS.DRAW[Math.floor(Math.random() * TAUNTS.DRAW.length)]);
    }

    setScores(newScores);

    // Drama Delay - Wait before showing the overlay so player can see the board/line
    // If bot wins, we wait longer to let the stamp animation finish
    const delay = result.winner === 'O' ? 3200 : 1500;
    
    resultTimeoutRef.current = window.setTimeout(() => {
        setShowResultOverlay(true);
    }, delay);
  };

  const startGame = () => {
    if (!settings.playerName.trim()) return;
    setStage(GameStage.PLAYING);
    resetBoardLogic();
    setRoundsPlayed(0);
    setScores({ player: 0, bot: 0 });
    setBotTaunt(TAUNTS.START[Math.floor(Math.random() * TAUNTS.START.length)]);
  };

  const resetBoardLogic = () => {
    setSquares(Array(9).fill(null));
    setWinState(null);
    setIsXNext(true); 
    setIsScanning(false);
    setShowResultOverlay(false);
    setShowVictimStamp(false);
    setTimeLeft(GAME_DURATION);
    setIsTimerRunning(true);
  };

  const handleResetWithAnimation = (fullReset: boolean) => {
    // Trigger CRT Power Off
    setIsResetting(true);
    if (!isMuted) playPowerDown();
    
    setTimeout(() => {
        if (fullReset) {
            setStage(GameStage.LOGIN);
            setSettings({ ...settings, playerName: '' });
            setIsTimerRunning(false);
        } else {
            resetBoardLogic();
        }
        setIsResetting(false);
    }, 600); // Wait for animation
  };

  const nextRound = () => {
     handleResetWithAnimation(false);
  }

  const resetGameFull = () => {
     handleResetWithAnimation(true);
  };

  const isSessionOver = roundsPlayed >= settings.totalRounds && winState !== null;

  // Calculate Panic Animation
  const getTimerStyle = () => {
    if (timeLeft > 10) return {};
    const intensity = (11 - timeLeft) * 1.5;
    const x = (Math.random() - 0.5) * intensity;
    const y = (Math.random() - 0.5) * intensity;
    const rot = (Math.random() - 0.5) * intensity;
    return {
       transform: `translate(${x}px, ${y}px) rotate(${rot}deg)`,
       color: timeLeft <= 5 ? '#ef4444' : '#f59e0b' // Red vs Orange
    };
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-[url('https://images.unsplash.com/photo-1535868463750-c78d9543614f?q=80&w=2076&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat bg-blend-multiply bg-gray-900 overflow-hidden select-none ${isResetting ? 'crt-off-anim' : ''}`}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>
      {/* Screen Flash Overlay */}
      <div className={`fixed inset-0 bg-white pointer-events-none z-[60] ${flashScreen ? 'flash-active' : 'opacity-0'}`}></div>
      
      {/* Top Controls */}
      <div className="absolute top-4 right-4 z-50 flex gap-2 md:gap-4 md:top-6 md:right-6">
         <button 
           onClick={handleInstallClick}
           className="flex items-center gap-2 px-3 py-2 md:px-5 md:py-3 bg-gray-900/80 border border-cyan-500 text-cyan-500 rounded-full hover:bg-cyan-500/20 transition-all hover:scale-105 active:scale-95 shadow-lg group"
           title="Install App for Offline Play"
         >
           <Download className="w-5 h-5 md:w-6 md:h-6 group-hover:animate-bounce" />
           <span className="hidden sm:inline font-bold text-xs md:text-sm">INSTALL APP</span>
         </button>

         <button 
           onClick={() => setIsMuted(!isMuted)}
           className={`p-3 md:p-4 bg-gray-900/80 border rounded-full transition-all hover:scale-110 active:scale-95 shadow-lg group ${isMuted ? 'border-gray-600 text-gray-400' : 'border-pink-500 text-pink-500 hover:bg-pink-500/20'}`}
           title={isMuted ? "Enable Bot Voice" : "Mute Bot Voice"}
         >
           {isMuted ? <VolumeX className="w-6 h-6 md:w-7 md:h-7" /> : <Volume2 className="w-6 h-6 md:w-7 md:h-7 animate-pulse" />}
         </button>
      </div>
      
      <div className="absolute top-4 left-4 z-40 md:top-6 md:left-6">
         <button 
           onClick={() => setShowLeaderboard(true)}
           className="px-4 py-3 md:px-6 md:py-4 bg-gray-900/90 border-2 border-yellow-500/60 rounded-lg hover:bg-yellow-500/10 text-yellow-500 transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(234,179,8,0.2)] flex items-center gap-2 group"
           title="Check who got lucky"
         >
           <Trophy className="w-5 h-5 md:w-7 md:h-7 group-hover:animate-bounce" />
           <span className="font-bold font-mono tracking-wide hidden sm:inline text-sm md:text-base">HALL OF MIRACLES</span>
         </button>
      </div>

      <ConfettiEffect active={winState?.winner === 'X' && !isScanning} />

      {/* Main Game Container */}
      <div className="relative z-10 w-full max-w-md md:max-w-xl lg:max-w-2xl flex flex-col items-center transition-all duration-300">
        
        {/* Header */}
        <div className="text-center mb-6 md:mb-8 flex flex-col items-center">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 neon-text-pink tracking-tighter italic transform -skew-x-6 drop-shadow-lg glitch-hover cursor-default">
            BEAT THE BOT
          </h1>
          <p className="text-cyan-400 font-mono mt-2 text-lg md:text-2xl tracking-widest uppercase glow-cyan">
            Good luck, meatbag 😈
          </p>

          {/* Arcade Style Victim Counter */}
          <div className="mt-4 flex flex-col items-center animate-pulse group hover:scale-105 transition-transform">
              <div className="text-pink-600 font-black tracking-widest text-sm md:text-base mb-1 group-hover:text-pink-400">GLOBAL VICTIMS</div>
              <div className="bg-black border-4 border-pink-700 px-6 py-2 rounded-lg shadow-[0_0_20px_rgba(236,72,153,0.5)] bg-[linear-gradient(rgba(18,16,16,0)50%,rgba(0,0,0,0.25)50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,6px_100%]">
                  <div className="font-mono text-4xl md:text-6xl text-pink-500 font-bold tabular-nums drop-shadow-[0_0_15px_rgba(236,72,153,1)] tracking-widest">
                       {victimCount.toString().padStart(4, '0')}
                  </div>
              </div>
          </div>
          
          {isOffline && (
             <div className="inline-flex items-center gap-2 mt-4 px-3 py-1 bg-red-900/50 rounded-full border border-red-500 text-red-300 text-xs md:text-sm font-bold animate-pulse">
               <WifiOff size={12} /> OFFLINE MODE ACTIVE
             </div>
          )}
        </div>

        {stage === GameStage.LOGIN && (
          <div className="bg-gray-800/90 p-8 md:p-12 rounded-2xl shadow-2xl border border-pink-500/30 backdrop-blur-md w-full animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col gap-6 md:gap-8">
              <div>
                <label className="block text-pink-500 font-bold mb-2 font-mono md:text-lg">IDENTIFY YOURSELF</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 md:left-4 md:top-4 text-gray-400" size={20} />
                  <input
                    type="text"
                    maxLength={12}
                    placeholder="ENTER NAME"
                    className="w-full bg-gray-900 border-2 border-gray-700 text-white pl-10 pr-4 py-2 md:py-3 md:pl-12 md:text-xl rounded focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 font-mono transition-all uppercase"
                    value={settings.playerName}
                    onChange={(e) => setSettings({ ...settings, playerName: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-cyan-400 font-bold mb-2 font-mono md:text-lg">SELECT ROUNDS</label>
                <div className="flex gap-4">
                  {[1, 3, 5].map(num => (
                    <button
                      key={num}
                      onClick={() => setSettings({ ...settings, totalRounds: num })}
                      className={`flex-1 py-3 md:py-4 rounded border-2 font-bold md:text-xl transition-all duration-200 ${
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

              {/* Top 3 Leaderboard Preview */}
              <div className="mt-4 p-4 bg-black/40 border border-yellow-500/30 rounded-lg">
                 <div className="flex items-center gap-2 mb-3">
                   <Crown className="text-yellow-500 w-5 h-5" />
                   <h3 className="text-yellow-500 font-bold tracking-wider text-sm">FASTEST SURVIVORS</h3>
                 </div>
                 {topThree.length > 0 ? (
                    <div className="space-y-2">
                      {topThree.map((entry, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs md:text-sm font-mono">
                           <div className="flex items-center gap-2">
                             <span className={`w-5 h-5 flex items-center justify-center rounded-full font-bold text-[10px] ${
                               idx === 0 ? 'bg-yellow-500 text-black' : 
                               idx === 1 ? 'bg-gray-400 text-black' : 'bg-orange-700 text-white'
                             }`}>{idx + 1}</span>
                             <span className="text-gray-300">{entry.name}</span>
                           </div>
                           <span className="text-cyan-400 font-bold">{entry.timeTaken}s</span>
                        </div>
                      ))}
                    </div>
                 ) : (
                    <div className="text-gray-600 text-xs italic text-center py-2">NO RECORDS FOUND</div>
                 )}
              </div>
              
              <div className="bg-black/30 p-3 md:p-4 rounded border border-gray-700 text-xs md:text-sm text-gray-400 flex items-start gap-2">
                 <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                 <span>WARNING: {GAME_DURATION}-second timer active. Brain lag results in immediate termination.</span>
              </div>

              <button
                onClick={startGame}
                disabled={!settings.playerName}
                className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black py-4 md:py-5 rounded shadow-lg transform hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed glitch-hover uppercase tracking-widest text-xl md:text-2xl mt-4 relative overflow-hidden group"
              >
                <span className="relative z-10">INITIATE PROTOCOL</span>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              </button>
            </div>
          </div>
        )}

        {stage === GameStage.PLAYING && (
          <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-500">
            
            {/* Massive Panic Timer */}
            <div 
               className="mb-1 flex items-center gap-3 font-black font-mono transition-all duration-100 ease-linear"
               style={getTimerStyle()}
            >
                <Timer className={`w-8 h-8 md:w-16 md:h-16 ${timeLeft <= 10 ? 'animate-spin' : ''}`} />
                <span className={`text-4xl md:text-7xl lg:text-8xl tracking-widest ${timeLeft > 10 ? 'text-cyan-400' : ''}`}>
                   00:{timeLeft.toString().padStart(2, '0')}
                </span>
            </div>

            {/* Time To Beat Indicator */}
            <div className="mb-6 flex items-center gap-2 text-xs md:text-sm bg-gray-900/80 px-4 py-1.5 rounded-full border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
               <Trophy className="w-3 h-3 md:w-4 md:h-4 text-yellow-500" />
               <span className="text-gray-400 tracking-wide">TARGET TO BEAT:</span>
               {topPlayer ? (
                 <span className="text-yellow-400 font-mono font-bold animate-pulse">
                    {topPlayer.timeTaken}s <span className="text-gray-500 text-[10px] ml-1">({topPlayer.name})</span>
                 </span>
               ) : (
                 <span className="text-gray-600 font-mono">--</span>
               )}
            </div>
            
            {/* Scoreboard - Full width of parent */}
            <div className="flex w-full justify-between gap-2 md:gap-4 mb-4">
              <div className={`flex flex-col items-center w-1/3 p-2 md:p-4 rounded-lg border transition-all duration-300 ${isPlayerTurn ? 'bg-cyan-900/40 border-cyan-500 shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-black/40 border-gray-700 opacity-60'}`}>
                <span className="text-xs md:text-sm text-gray-400 font-mono mb-1">YOU (X)</span>
                <span className={`text-2xl md:text-4xl font-bold ${isPlayerTurn ? 'text-cyan-300 drop-shadow-[0_0_5px_cyan]' : 'text-cyan-700'}`}>{scores.player}</span>
              </div>
              
              <div className="flex flex-col items-center w-1/3 py-2 md:py-4 bg-black/20 rounded-lg border border-gray-800">
                <span className="text-xs md:text-sm text-gray-500 font-mono">ROUND</span>
                <span className="text-xl md:text-3xl font-bold text-gray-300">{roundsPlayed} / {settings.totalRounds}</span>
              </div>
              
              <div 
                onMouseEnter={handleBotHover}
                className={`flex flex-col items-center w-1/3 p-2 md:p-4 rounded-lg border transition-all duration-300 cursor-help ${isBotTurn ? 'bg-pink-900/40 border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.3)] animate-pulse' : 'bg-black/40 border-gray-700 opacity-60'}`}
              >
                <span className="text-xs md:text-sm text-gray-400 font-mono mb-1">BOT (O)</span>
                <span className={`text-2xl md:text-4xl font-bold ${isBotTurn ? 'text-pink-300 drop-shadow-[0_0_5px_magenta]' : 'text-pink-800'}`}>{scores.bot}</span>
              </div>
            </div>

            <div className="w-full">
               <TrashTalk message={botTaunt} />
            </div>

            <div className={`relative w-full my-4 transition-transform ${isShaking ? 'shake-hard' : ''}`}>
              <Board 
                squares={squares} 
                onClick={handleMove} 
                winningLine={winState?.line || null}
                disabled={winState !== null || !isXNext || isScanning}
                isBotTurn={isBotTurn}
              />

              {/* VICTIM STAMP OVERLAY */}
              {showVictimStamp && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
                     <div className="relative">
                         <h1 className="text-6xl md:text-9xl font-black text-red-600 tracking-tighter -rotate-12 border-8 border-red-600 p-4 md:p-8 bg-black/80 backdrop-blur transform scale-150 stamp-anim shadow-[0_0_100px_red] mix-blend-hard-light">
                             VICTIM #{victimCount}
                         </h1>
                         <div className="absolute -bottom-10 left-0 right-0 text-center">
                             <span className="bg-red-600 text-black font-bold px-4 py-1 text-xl animate-bounce">PROCESSED</span>
                         </div>
                     </div>
                  </div>
              )}
              
              {/* Scanning Overlay (Fake Cheat Detection) */}
              {isScanning && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 rounded-xl backdrop-blur-sm animate-in fade-in duration-200 overflow-hidden border-2 border-red-500">
                  <div className="absolute top-0 left-0 w-full h-1 bg-red-500 shadow-[0_0_15px_#ef4444] scan-line-anim"></div>
                  <ScanLine size={48} className="text-red-500 animate-pulse mb-4 w-12 h-12 md:w-20 md:h-20" />
                  <h3 className="text-2xl md:text-4xl font-bold text-red-500 animate-pulse text-center px-4 font-mono">
                    CHEATER DETECTED
                  </h3>
                  <p className="text-red-300 font-mono mt-2 text-sm md:text-xl text-center px-6">
                    {scanMessage}
                  </p>
                </div>
              )}

              {/* Result Overlay with Drama Delay */}
              {winState && !isScanning && showResultOverlay && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 rounded-xl backdrop-blur-md animate-in zoom-in duration-300">
                   <div className="text-center p-4 w-full">
                      {winState.winner === 'X' ? (
                        <>
                           <h2 className="text-4xl md:text-6xl font-black text-cyan-400 mb-2 drop-shadow-lg animate-bounce">
                             NO WAY!
                           </h2>
                           <p className="text-white font-mono text-sm md:text-xl">Completed in {GAME_DURATION - timeLeft}s</p>
                        </>
                      ) : winState.winner === 'O' ? (
                        <>
                           <h2 className="text-4xl md:text-6xl font-black text-pink-500 mb-2 drop-shadow-lg">
                             {winState.reason === 'TIMEOUT' ? 'TIME UP!' : 'REKT!'}
                           </h2>
                           {winState.reason === 'TIMEOUT' && <p className="text-red-500 font-mono text-sm md:text-xl">TOO SLOW MEATBAG</p>}
                        </>
                      ) : (
                        <h2 className="text-3xl md:text-5xl font-black text-gray-300 mb-2">
                          DRAW
                        </h2>
                      )}
                      
                      {!isSessionOver ? (
                         <button 
                            onClick={nextRound}
                            className="mt-6 px-6 py-3 md:px-10 md:py-4 bg-white text-black font-bold rounded-full hover:bg-cyan-400 hover:scale-110 transition-all flex items-center gap-2 mx-auto md:text-2xl shadow-lg"
                         >
                           NEXT ROUND <Zap className="w-5 h-5 md:w-7 md:h-7" />
                         </button>
                      ) : (
                         <div className="mt-6">
                            <p className="text-sm md:text-lg text-gray-400 mb-3">SESSION COMPLETE</p>
                            <button 
                                onClick={resetGameFull}
                                className="px-6 py-3 md:px-10 md:py-4 bg-pink-600 text-white font-bold rounded hover:bg-pink-500 hover:scale-105 transition-all flex items-center gap-2 mx-auto md:text-2xl shadow-lg border border-pink-400"
                            >
                              NEW GAME <RotateCcw className="w-5 h-5 md:w-7 md:h-7" />
                            </button>
                         </div>
                      )}
                   </div>
                </div>
              )}
            </div>
            
            <div className="flex gap-4 mt-2 md:mt-4 w-full justify-center">
              <button 
                  onClick={handleHint}
                  disabled={winState !== null || isScanning}
                  className="px-4 py-2 md:px-6 md:py-3 rounded bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 hover:bg-yellow-500/30 transition-colors flex items-center gap-2 text-xs md:text-sm font-bold uppercase disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Lightbulb className="w-4 h-4 md:w-5 md:h-5" /> Need Help?
              </button>

              <button 
                  onClick={resetGameFull}
                  className="px-4 py-2 md:px-6 md:py-3 rounded bg-gray-800 text-gray-400 border border-gray-700 hover:bg-red-900/50 hover:text-red-400 hover:border-red-800 transition-colors flex items-center gap-2 text-xs md:text-sm font-bold uppercase group"
              >
                <Trash2 className="w-4 h-4 md:w-5 md:h-5 group-hover:rotate-12 transition-transform" /> Rage Quit
              </button>
            </div>

          </div>
        )}
      </div>

      {/* Winners Board Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-gray-900 border-2 border-yellow-500/50 rounded-xl p-6 md:p-8 shadow-[0_0_50px_rgba(234,179,8,0.2)] max-h-[80vh] flex flex-col relative">
            <button 
              onClick={() => setShowLeaderboard(false)} 
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
            >
              <XIcon className="w-6 h-6 md:w-8 md:h-8" />
            </button>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-800">
              <Trophy className="text-yellow-500 animate-pulse w-8 h-8 md:w-10 md:h-10" />
              <div className="flex flex-col">
                 <h2 className="text-2xl md:text-3xl font-black text-yellow-500 font-orbitron tracking-wide">
                   HALL OF MIRACLES
                 </h2>
                 <p className="text-xs md:text-sm text-gray-400 font-mono">RANKED BY SPEED (LUCK)</p>
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
                              <div className={`flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-full font-bold font-mono text-lg md:text-xl border ${idx === 0 ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'}`}>
                                {idx + 1}
                              </div>
                              <div>
                                  <div className="text-lg md:text-xl font-bold text-white tracking-wide">{entry.name}</div>
                                  <div className="flex gap-4 text-xs md:text-sm font-mono text-gray-400">
                                      <span>{entry.date}</span>
                                      <span className="text-cyan-400 font-bold">TIME: {entry.timeTaken}s</span>
                                  </div>
                              </div>
                          </div>
                          <div className="sm:text-right pl-14 sm:pl-0">
                              <div className="text-[10px] md:text-xs text-pink-500 font-bold uppercase tracking-wider mb-0.5">BOT_COMMENT.LOG</div>
                              <div className="text-cyan-400 font-mono text-sm md:text-base italic border-l-2 border-cyan-500/30 pl-2 sm:border-none sm:pl-0">
                                "{entry.botComment || 'System glitch.'}"
                              </div>
                          </div>
                      </div>
                  ))
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800 text-center text-xs md:text-sm text-gray-600 font-mono">
               FASTEST CLICKERS OR BIGGEST CHEATERS?
            </div>
          </div>
        </div>
      )}
    </div>
  );
}