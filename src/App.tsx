import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Flame, 
  Trophy, 
  HelpCircle, 
  Edit2, 
  Check, 
  Clock, 
  Shuffle, 
  Award, 
  Send,
  Heart,
  Volume2,
  VolumeX,
  Sparkles
} from "lucide-react";
import { DailyPuzzleContext, GuessResult, RGB, CommentEntry, GameMode } from "./types";
import ColorPuzzleCanvas from "./components/ColorPuzzleCanvas";
import RedditFrame from "./components/RedditFrame";
import { toggleAudio, playSound } from "./utils/audio";

const RANDOM_NOUNS = ["Snoo", "Chroma", "Pixel", "Hue", "Vector", "Canvas", "Palette", "Mixer", "Shade", "Hex"];
const RANDOM_ADJECTIVES = ["Clever", "Expert", "Vivid", "Calm", "Neon", "Spectral", "Retro", "Sharp", "Royal", "Glow"];

function generateRandomUsername(): string {
  const adj = RANDOM_ADJECTIVES[Math.floor(Math.random() * RANDOM_ADJECTIVES.length)];
  const noun = RANDOM_NOUNS[Math.floor(Math.random() * RANDOM_NOUNS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `u/${adj}${noun}_${num}`;
}

export default function App() {
  // 1. Base User Settings & Preferences
  const [username, setUsername] = useState<string>(() => {
    const saved = localStorage.getItem("devvit_color_username");
    if (saved) return saved;
    const initial = generateRandomUsername();
    localStorage.setItem("devvit_color_username", initial);
    return initial;
  });
  
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(username.replace("u/", ""));
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    const saved = localStorage.getItem("devvit_color_sound");
    return saved !== "false";
  });

  // 2. Play Statistics Tracking
  const [streak, setStreak] = useState<number>(() => {
    return Number(localStorage.getItem("devvit_color_streak") || "0");
  });
  const [lastPlayedDate, setLastPlayedDate] = useState<string>(() => {
    return localStorage.getItem("devvit_color_last_played") || "";
  });

  // 3. Daily Content State (from server)
  const [context, setContext] = useState<DailyPuzzleContext | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [currentR, setCurrentR] = useState(128);
  const [currentG, setCurrentG] = useState(128);
  const [currentB, setCurrentB] = useState(128);

   // 4. Current Day Live Gameplay History
  const [guesses, setGuesses] = useState<GuessResult[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [targetColor, setTargetColor] = useState<RGB | null>(null);
  const [activeTab, setActiveTab] = useState<"play" | "leaderboard" | "instructions">("play");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gameMode, setGameMode] = useState<GameMode>("hue");
  const [isAutoAdvancing, setIsAutoAdvancing] = useState(false);

  // Completed levels history, timer and overall game finish state
  const [completedLevels, setCompletedLevels] = useState<{ mode: GameMode; guesses: GuessResult[]; closeness: number }[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isWholeGameFinished, setIsWholeGameFinished] = useState(false);

  const handleModeChange = async (mode: GameMode) => {
    playSound("click");
    setGameMode(mode);
    setIsAutoAdvancing(false);
    
    // Clear guesses and fetch a fresh target color for this active mode
    const newSeed = "game_" + mode + "_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("devvit_color_active_seed", newSeed);
    
    setGuesses([]);
    setIsGameOver(false);
    setTargetColor(null);
    setCurrentR(128);
    setCurrentG(128);
    setCurrentB(128);
 
    try {
      const res = await fetch(`/api/target-color?seed=${newSeed}`);
      if (res.ok) {
        const colorData = await res.json();
        setTargetColor(colorData.targetColor);
      }
    } catch (e) {
      console.error("Failed fetching new target color for mode:", e);
    }
  };
 
  const handleNextLevel = () => {
    setIsAutoAdvancing(false);
    const modeSequence: GameMode[] = ["hue", "saturation", "complementary", "analogous", "triadic"];
    const currentIndex = modeSequence.indexOf(gameMode);
    const nextIndex = (currentIndex + 1) % modeSequence.length;
    const nextMode = modeSequence[nextIndex];
    handleModeChange(nextMode);
  };

  // Sound toggle handler
  const handleToggleSound = () => {
    const nextVal = !isSoundEnabled;
    setIsSoundEnabled(nextVal);
    toggleAudio(nextVal);
    localStorage.setItem("devvit_color_sound", String(nextVal));
    playSound("click");
  };

  // Sync sound settings with Audio engine
  useEffect(() => {
    toggleAudio(isSoundEnabled);
  }, [isSoundEnabled]);

  // Fetch puzzle, comments, and highscores from Server
  const fetchGameContext = useCallback(async () => {
    try {
      const res = await fetch("/api/game-context");
      if (!res.ok) throw new Error("Faulty network response");
      const data: DailyPuzzleContext = await res.json();
      setContext(data);
      setCountdown(data.countdown);

      // Check if we have an active seed in local storage
      let activeSeed = localStorage.getItem("devvit_color_active_seed");
      if (!activeSeed) {
        // If not, generate a random one for Hue mode
        activeSeed = "game_hue_" + Math.random().toString(36).substring(2, 10);
        localStorage.setItem("devvit_color_active_seed", activeSeed);
      }

      // Determine game mode from the restored activeSeed
      let parsedMode: GameMode = "hue";
      if (activeSeed.includes("saturation")) parsedMode = "saturation";
      else if (activeSeed.includes("complementary")) parsedMode = "complementary";
      else if (activeSeed.includes("analogous")) parsedMode = "analogous";
      else if (activeSeed.includes("triadic")) parsedMode = "triadic";
      setGameMode(parsedMode);

      // Restore user gameplay state for this active seed if they already started/finished
      const savedHistoryJson = localStorage.getItem(`devvit_color_history_${activeSeed}`);
      if (savedHistoryJson) {
        const savedHistory = JSON.parse(savedHistoryJson);
        setGuesses(savedHistory.guesses || []);
        setIsGameOver(savedHistory.isGameOver || false);
        setTargetColor(savedHistory.targetColor || null);
        
        // Pick up where they left off
        if (savedHistory.guesses && savedHistory.guesses.length > 0) {
          const lastGuess = savedHistory.guesses[savedHistory.guesses.length - 1].guessColor;
          setCurrentR(lastGuess.r);
          setCurrentG(lastGuess.g);
          setCurrentB(lastGuess.b);
        }
      } else {
        // Fresh state resetting
        setGuesses([]);
        setIsGameOver(false);
        setTargetColor(null);
        setCurrentR(128);
        setCurrentG(128);
        setCurrentB(128);
      }

      // Always fetch the target color so the user can see it!
      try {
        const resColor = await fetch(`/api/target-color?seed=${activeSeed}`);
        if (resColor.ok) {
          const colorData = await resColor.json();
          setTargetColor(colorData.targetColor);
        }
      } catch (err) {
        console.error("Failed to load target color:", err);
      }

      setLoading(false);
    } catch (e) {
      console.error("Failed loading daily applets context:", e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGameContext();
  }, [fetchGameContext]);

  // Countdown clock tickers
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Midnight crossed, refresh daily puzzle state!
          clearInterval(interval);
          setLoading(true);
          fetchGameContext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown, fetchGameContext]);

  // Manage stopwatch and timer running flags
  useEffect(() => {
    if (activeTab === "play" && !isWholeGameFinished && !loading) {
      setIsTimerRunning(true);
    } else {
      setIsTimerRunning(false);
    }
  }, [activeTab, isWholeGameFinished, loading]);

  useEffect(() => {
    let timerID: NodeJS.Timeout | null = null;
    if (isTimerRunning) {
      timerID = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerID) clearInterval(timerID);
    };
  }, [isTimerRunning]);

  // Auto-advance to the next level when a level finishes (game over)
  useEffect(() => {
    if (isGameOver && guesses.length > 0) {
      if (gameMode === "triadic") {
        setIsWholeGameFinished(true);
        setIsTimerRunning(false);
        setIsAutoAdvancing(false);
        return;
      }
      setIsAutoAdvancing(true);
      const timer = setTimeout(() => {
        setIsAutoAdvancing(false);
        handleNextLevel();
      }, 3000); // give them 3s to read accuracy or see the solution markers!
      return () => {
        clearTimeout(timer);
        setIsAutoAdvancing(false);
      };
    } else {
      setIsAutoAdvancing(false);
    }
  }, [isGameOver, guesses.length, gameMode]);

  const formatCountdown = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}h ${minutes
      .toString()
      .padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`;
  };

  // Callback whenever Phaser slider drags in real-time
  const handleColorChange = (r: number, g: number, b: number) => {
    setCurrentR(r);
    setCurrentG(g);
    setCurrentB(b);
  };

  // Submit aggregate multi-level scorecard & time to global leaderboards
  const handleSubmitOverallScore = async () => {
    if (!context || completedLevels.length === 0) return;
    setIsSubmitting(true);

    const avgCloseness = completedLevels.reduce((sum, cl) => sum + cl.closeness, 0) / completedLevels.length;
    const totalGuesses = completedLevels.reduce((sum, cl) => sum + cl.guesses.length, 0);

    try {
      const res = await fetch("/api/submit-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          closeness: Number(avgCloseness.toFixed(1)),
          guesses: totalGuesses,
          streak,
          timeSeconds: elapsedTime,
        }),
      });

      if (res.ok) {
        const scoreData = await res.json();
        setContext((prev) => prev ? { ...prev, leaderboard: scoreData.leaderboard } : null);
        setActiveTab("leaderboard");
      }
    } catch (e) {
      console.error("Failed submitting overall score:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset the full 5-level ritual sequence with a clean timer and records
  const handleResetFullRitual = async () => {
    playSound("click");
    setCompletedLevels([]);
    setElapsedTime(0);
    setIsWholeGameFinished(false);
    setIsAutoAdvancing(false);
    setGameMode("hue");

    const newSeed = "game_hue_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("devvit_color_active_seed", newSeed);

    setGuesses([]);
    setIsGameOver(false);
    setTargetColor(null);
    setCurrentR(128);
    setCurrentG(128);
    setCurrentB(128);

    try {
      const res = await fetch(`/api/target-color?seed=${newSeed}`);
      if (res.ok) {
        const colorData = await res.json();
        setTargetColor(colorData.targetColor);
      }
    } catch (e) {
      console.error("Failed fetching initial color for reset:", e);
    }
  };

  // Restart the game with a brand new random seed and allow consecutive games
  const handlePlayAgain = async () => {
    playSound("click");
    setIsAutoAdvancing(false);
    const newSeed = "game_" + gameMode + "_" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("devvit_color_active_seed", newSeed);
    
    setGuesses([]);
    setIsGameOver(false);
    setTargetColor(null);
    setCurrentR(128);
    setCurrentG(128);
    setCurrentB(128);

    try {
      const res = await fetch(`/api/target-color?seed=${newSeed}`);
      if (res.ok) {
        const colorData = await res.json();
        setTargetColor(colorData.targetColor);
      }
    } catch (e) {
      console.error("Failed fetching new target color:", e);
    }
  };

  // Submit and evaluate user's RGB guess
  const handleGuessSubmit = async () => {
    if (isGameOver || isSubmitting || !context) return;
    setIsSubmitting(true);

    const activeSeed = localStorage.getItem("devvit_color_active_seed") || context.date;

    try {
      const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          r: currentR,
          g: currentG,
          b: currentB,
          guessesCount: guesses.length,
          seed: activeSeed,
          maxGuesses: 3,
          gameMode,
        }),
      });

      if (!res.ok) throw new Error("Evaluation endpoint error");
      const evaluation = await res.json();

      const newGuess: GuessResult = {
        guessColor: { r: currentR, g: currentG, b: currentB },
        distance: evaluation.distance,
        closeness: evaluation.closeness,
        isCorrect: evaluation.isCorrect,
        score: Math.round(evaluation.closeness * 100),
      };

      const updatedGuesses = [...guesses, newGuess];
      const evaluatedGameOver = evaluation.isGameOver;

      setGuesses(updatedGuesses);
      setIsGameOver(evaluatedGameOver);

      if (evaluatedGameOver) {
        setTargetColor(evaluation.targetColor);

        // STREAK HANDLING (UTC calendar boundary safe)
        const todayStr = context.date;
        let finalStreak = streak;

        if (evaluation.isCorrect || evaluation.closeness >= 95.0) {
          // Calculate yester-date string in UTC
          const currDateObj = new Date();
          const yesterDateObj = new Date(currDateObj);
          yesterDateObj.setUTCDate(currDateObj.getUTCDate() - 1);
          const yesterStr = yesterDateObj.toISOString().split("T")[0];

          if (lastPlayedDate === yesterStr) {
            finalStreak += 1;
          } else if (lastPlayedDate === todayStr) {
            // Already played today, no change
          } else {
            // Reset to 1 since they skipped a day
            finalStreak = 1;
          }

          setStreak(finalStreak);
          setLastPlayedDate(todayStr);
          localStorage.setItem("devvit_color_streak", String(finalStreak));
          localStorage.setItem("devvit_color_last_played", todayStr);
        }

        // Save progress details to local cache
        localStorage.setItem(
          `devvit_color_history_${activeSeed}`,
          JSON.stringify({
            guesses: updatedGuesses,
            isGameOver: true,
            targetColor: evaluation.targetColor,
          })
        );

        const bestEvaluatedCloseness = Math.max(...updatedGuesses.map((g) => g.closeness));
        
        // Append current level to the list of completed levels in this full sequence
        setCompletedLevels((prev) => {
          const clean = prev.filter((cl) => cl.mode !== gameMode);
          return [
            ...clean,
            {
              mode: gameMode,
              guesses: updatedGuesses,
              closeness: bestEvaluatedCloseness,
            },
          ];
        });

        if (gameMode === "triadic") {
          setIsWholeGameFinished(true);
          setIsTimerRunning(false);
        }
      } else {
        // Non-terminal state caching
        localStorage.setItem(
          `devvit_color_history_${activeSeed}`,
          JSON.stringify({
            guesses: updatedGuesses,
            isGameOver: false,
            targetColor: null,
          })
        );
      }
    } catch (e) {
      console.error("Evaluate guess crash:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Comments simulated
  const handleAddComment = async (text: string) => {
    if (!context || !text.trim()) return;

    try {
      const res = await fetch("/api/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username,
          text: text,
        }),
      });

      if (res.ok) {
        const commentData = await res.json();
        setContext((prev) => prev ? { ...prev, comments: commentData.comments } : null);
      }
    } catch (e) {
      console.error("Comment submit error:", e);
    }
  };

  // Randomize username option
  const handleRandomizeUsername = () => {
    const nextRnd = generateRandomUsername();
    setUsername(nextRnd);
    setUsernameInput(nextRnd.replace("u/", ""));
    localStorage.setItem("devvit_color_username", nextRnd);
    playSound("click");
  };

  const handleUsernameSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) return;
    const finalName = `u/${usernameInput.trim().replace(/^u\//i, "")}`;
    setUsername(finalName);
    setIsEditingUsername(false);
    localStorage.setItem("devvit_color_username", finalName);
    playSound("click");
  };

  // Generate beautiful copy-paste grid score
  const getShareText = () => {
    if (guesses.length === 0 || !context) return null;
    const bestCloseness = Math.max(...guesses.map((g) => g.closeness));
    const isWin = guesses.some((g) => g.closeness >= 99.0);
    
    // Assemble grid emojis indicating success proximity
    const emojiMap = guesses.map((g) => {
      if (g.closeness >= 98) return "🟩"; // green
      if (g.closeness >= 90) return "🟨"; // yellow
      if (g.closeness >= 75) return "🟧"; // orange
      return "🟥"; // red
    }).join("");

    const filler = Array(3 - guesses.length).fill("⬛").join("");
    const gridRow = emojiMap + filler;

    return `🎨 Daily Color Match - ${context.date}\nAccuracy: ${bestCloseness}%\nGuesses: ${guesses.length}/3\nResults: ${gridRow}\nStreak: 🔥 ${streak} days\nPlayed on r/ColorDaily (Phaser 3 Devvit!)`;
  };

  return (
    <RedditFrame
      comments={context?.comments || []}
      onAddComment={handleAddComment}
      isSoundEnabled={isSoundEnabled}
      onToggleSound={handleToggleSound}
      userScoreText={isGameOver ? getShareText() : null}
    >
      
      {/* Devvit Applet Inner Area (Max 600px styled dashboard) */}
      <div className="flex flex-col bg-[#09090b] text-[#f8fafc] w-full max-w-[600px] border-b border-[#1a1a1b]">
        
        {/* HUD: Brand + Stats header bar */}
        <div className="p-4 bg-[#09090b] border-b border-[#1a1a1b] flex justify-between items-center flex-wrap gap-2">
          {/* Logo Brand */}
          <div className="flex items-center gap-2">
            <span className="text-xl">🎨</span>
            <div className="flex flex-col">
              <span className="font-display font-bold text-sm tracking-wide bg-gradient-to-r from-[#ff4500] to-[#ff6a00] bg-clip-text text-transparent">
                CHROMA DAILY
              </span>
              <span className="text-[10px] text-gray-450 font-mono tracking-tight leading-3">
                r/ChromaDaily Custom v1.3
              </span>
            </div>
          </div>

          {/* User Streak & Identity panel */}
          <div className="flex items-center gap-3">
            
            {/* Streak Emblem */}
            <div className="flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20 text-amber-400 text-xs font-bold shadow-sm shadow-amber-500/5">
              <Flame size={14} className="animate-pulse text-amber-500" />
              <span>{streak} DAY{streak !== 1 ? "S" : ""}</span>
            </div>

            {/* Username display with in-place editor */}
            {isEditingUsername ? (
              <form onSubmit={handleUsernameSave} className="flex items-center gap-1">
                <span className="text-xs text-gray-400 font-mono">u/</span>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  maxLength={15}
                  className="bg-[#1a1a1b] border border-[#1a1a1b] text-xs px-1.5 py-0.5 rounded text-white font-mono focus:outline-none focus:border-[#ff4500] w-24"
                />
                <button type="submit" className="p-1 bg-[#ff4500] hover:bg-[#ff5722] rounded text-white">
                  <Check size={10} />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-300 font-mono font-medium hover:underline cursor-pointer select-all">
                  {username}
                </span>
                <button
                  onClick={() => {
                    setIsEditingUsername(true);
                    playSound("click");
                  }}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                  title="Rename Username"
                >
                  <Edit2 size={11} />
                </button>
                <button
                  type="button"
                  onClick={handleRandomizeUsername}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                  title="Random Snoo ID"
                >
                  <Shuffle size={11} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* HUD Sub-banner: Next puzzle timer, Level, and active Stopwatch */}
        <div className="bg-[#030303] px-4 py-2 border-b border-[#1a1a1b] flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono">
            <span className="text-[#ff452b] font-bold">🎯</span>
            <span className="font-bold text-gray-200">
              {isWholeGameFinished ? "RITUAL COMPLETED!" : `LEVEL ${completedLevels.length + 1}/5: ${gameMode.toUpperCase()}`}
            </span>
          </div>

          {/* Stopwatch Timer - active running stopwatch indicator */}
          <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/25 px-2.5 py-0.5 rounded text-green-400 text-xs font-mono font-bold animate-pulse">
            <Clock size={12} className="text-green-400" />
            <span>ELAPSED TIME: {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, "0")}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 rounded px-2.5 py-0.5">
            <span className="text-[10px] text-amber-500 font-mono font-bold">RESET:</span>
            <span className="text-xs font-bold font-mono tracking-wide text-amber-400">
              {formatCountdown(countdown)}
            </span>
          </div>
        </div>

        {/* Tabs Control row */}
        <div className="flex border-b border-[#1a1a1b] bg-[#030303] p-1 gap-1">
          <button
            onClick={() => {
              setActiveTab("play");
              playSound("click");
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "play"
                ? "bg-[#1a1a1b] text-[#ff4500] shadow font-bold border border-[#ff4500]/40"
                : "text-gray-400 hover:text-white hover:bg-[#1a1a1b]/40"
            }`}
          >
            🛡️ PLAY GAME
          </button>
          
          <button
            onClick={() => {
              setActiveTab("leaderboard");
              playSound("click");
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "leaderboard"
                ? "bg-[#1a1a1b] text-[#ff4500] shadow font-bold border border-[#ff4500]/40"
                : "text-gray-400 hover:text-white hover:bg-[#1a1a1b]/40"
            }`}
          >
            📊 GLOBAL BOARD
          </button>

          <button
            onClick={() => {
              setActiveTab("instructions");
              playSound("click");
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "instructions"
                ? "bg-[#1a1a1b] text-[#ff4500] shadow font-bold border border-[#ff4500]/40"
                : "text-gray-400 hover:text-white hover:bg-[#1a1a1b]/40"
            }`}
          >
            📜 INSTRUCTIONS
          </button>
        </div>

        {/* Content Viewbox */}
        <div className="p-4 flex flex-col min-h-[460px]">
          
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-10 h-10 border-4 border-[#ff4500] border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-gray-400 font-mono">Loading Reddit environment...</span>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              
              {/* PLAY GAME TAB */}
              {activeTab === "play" && (
                <motion.div
                  key="play-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col gap-4"
                >
                  
                  {isWholeGameFinished ? (
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="bg-[#1a1a1b] rounded-2xl p-6 border-2 border-green-500/30 shadow-2xl flex flex-col gap-6 relative overflow-hidden text-center max-w-lg mx-auto w-full"
                    >
                      {/* Success particle overlay */}
                      <div className="absolute inset-0 bg-gradient-to-b from-green-500/5 to-transparent pointer-events-none" />

                      <div className="flex flex-col items-center gap-2">
                        <span className="text-4xl">🏆</span>
                        <h3 className="font-display font-extrabold text-2xl text-green-400 tracking-tight">
                          RITUAL COMPLETED!
                        </h3>
                        <p className="text-xs text-gray-300 max-w-sm">
                          You successfully aligned all 5 spectral keys of the color wheel. Your color alignment telemetry reports ready!
                        </p>
                      </div>

                      {/* Metrics grid */}
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div className="bg-[#030303]/60 p-4 rounded-xl border border-[#272729] flex flex-col items-center">
                          <span className="text-[10px] text-gray-400 font-mono tracking-wider font-bold">AVG ACCURACY</span>
                          <span className="text-xl font-extrabold text-white mt-1">
                            {(completedLevels.reduce((acc, curr) => acc + curr.closeness, 0) / Math.max(1, completedLevels.length)).toFixed(1)}%
                          </span>
                        </div>

                        <div className="bg-[#030303]/60 p-4 rounded-xl border border-[#272729] flex flex-col items-center">
                          <span className="text-[10px] text-gray-400 font-mono tracking-wider font-bold">TOTAL TIME</span>
                          <span className="text-xl font-extrabold text-white mt-1">
                            {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, "0")}
                          </span>
                        </div>

                        <div className="bg-[#030303]/60 p-4 rounded-xl border border-[#272729] flex flex-col items-center flex-1">
                          <span className="text-[10px] text-gray-400 font-mono tracking-wider font-bold">TOTAL GUESSES</span>
                          <span className="text-xl font-extrabold text-white mt-1">
                            {completedLevels.reduce((acc, curr) => acc + curr.guesses.length, 0)}/15
                          </span>
                        </div>

                        <div className="bg-[#030303]/60 p-4 rounded-xl border border-[#272729] flex flex-col items-center justify-center flex-1">
                          <span className="text-[10px] text-gray-400 font-mono tracking-wider font-bold">SPEED RATING</span>
                          <span className="text-[10px] font-extrabold text-green-400 mt-2 bg-green-500/10 px-2.5 py-0.5 rounded border border-green-500/20 font-sans tracking-wide">
                            {elapsedTime < 60 ? "⚡ LIGHTNING" : elapsedTime < 125 ? "🏃 SWIFT SOLVER" : "🐢 STEADY SYNC"}
                          </span>
                        </div>
                      </div>

                      {/* Detailed level summary list */}
                      <div className="bg-[#030303]/45 rounded-xl p-3.5 text-left border border-[#272729] flex flex-col gap-2">
                        <span className="text-[10px] text-[#ff4500] font-mono block font-bold uppercase tracking-wider">Level Performance Breakdown:</span>
                        <div className="flex flex-col gap-2 text-xs text-gray-300">
                          {completedLevels.map((lvl, index) => (
                            <div key={lvl.mode} className="flex justify-between items-center border-b border-[#1a1a1b]/60 pb-1.5 last:border-0 last:pb-0">
                              <span className="capitalize font-mono font-medium text-gray-400">
                                {index + 1}. {lvl.mode} Match
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-green-400">{lvl.closeness.toFixed(1)}%</span>
                                <span className="text-[9px] bg-[#1a1a1b] px-2 py-0.5 rounded text-gray-400 font-mono font-bold">
                                  {lvl.guesses.length}/3 guesses
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Leaderboard submit CTA */}
                      <div className="flex flex-col gap-3 p-4 bg-green-500/5 rounded-xl border border-green-500/15">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-400 font-medium">Rank Identity ID:</span>
                          <span className="font-bold text-white font-mono">{username}</span>
                        </div>
                        <button
                          disabled={isSubmitting}
                          onClick={handleSubmitOverallScore}
                          className="py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer font-sans"
                        >
                          {isSubmitting ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            "🚀 RECORD PERFORMANCE TO LEADERBOARDS"
                          )}
                        </button>
                      </div>

                      {/* Restart CTA */}
                      <div className="flex flex-col gap-1.5 mt-2">
                        <button
                          onClick={handleResetFullRitual}
                          className="py-2.5 bg-[#ff4500] hover:bg-[#ff5722] text-white font-bold text-xs rounded-lg transition-all shadow cursor-pointer font-sans"
                        >
                          🔄 RESTART RITUAL & RESET TIMERS
                        </button>
                        <span className="text-[9px] text-gray-400 font-mono font-medium">
                          r/ColorDaily • Match spectral frequencies
                        </span>
                      </div>
                    </motion.div>
                  ) : (
                    <>
                      {/* BEAUTIFUL METHOD COLOR GAME MODES */}
                      <div className="bg-[#1a1a1b]/60 p-1.5 rounded-xl border border-[#272729] flex flex-wrap gap-1">
                        {[
                          { mode: "hue", label: "🎨 Hue", desc: "Angle" },
                          { mode: "saturation", label: "🌈 Saturation", desc: "Angle & radius" },
                          { mode: "complementary", label: "☯️ Complementary", desc: "Opposite colors" },
                          { mode: "analogous", label: "🌸 Analogous", desc: "Neighbor shades" },
                          { mode: "triadic", label: "🔺 Triadic", desc: "Three corner mix" }
                        ].map((item) => (
                          <button
                            key={item.mode}
                            onClick={() => handleModeChange(item.mode as GameMode)}
                            className={`flex-1 min-w-[90px] py-1.5 px-1 rounded-lg flex flex-col items-center justify-center transition-all ${
                              gameMode === item.mode
                                ? "bg-[#ff4500] text-white font-bold shadow-md scale-[1.02]"
                                : "bg-transparent text-gray-400 hover:text-white hover:bg-[#272729]"
                            }`}
                          >
                            <span className="text-xs font-bold leading-tight">{item.label}</span>
                            <span className="text-[9px] opacity-75 mt-0.5">{item.desc}</span>
                          </button>
                        ))}
                      </div>

                      {/* Informative top overlay state when finished */}
                      {isGameOver && (
                        <motion.div
                          initial={{ scale: 0.95, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="bg-[#1a1a1b]/60 rounded-xl p-4 border border-[#ff4500]/25 shadow-lg flex flex-col gap-3 relative overflow-hidden"
                        >
                          {/* Decorative elements */}
                          <div className="absolute right-3 top-3 opacity-20 text-[#ff4500]">
                            <Sparkles size={24} />
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xl">🎉</span>
                            <div className="flex flex-col">
                              <h4 className="font-display font-bold text-sm text-[#ff4500]">
                                LEVEL MATCH FINISHED!
                              </h4>
                              <p className="text-xs text-gray-300">
                                You used {guesses.length}/3 guesses on Level {gameMode === "hue" ? 1 : gameMode === "saturation" ? 2 : gameMode === "complementary" ? 3 : gameMode === "analogous" ? 4 : 5}.
                                Your highest match was{" "}
                                <strong className="text-white">
                                  {guesses.length > 0 ? Math.max(...guesses.map((g) => g.closeness)) : 0}%
                                </strong>
                                .
                              </p>
                              {isAutoAdvancing && (
                                <div className="mt-1.5 text-[11px] text-green-400 font-bold bg-green-500/10 border border-green-500/20 rounded px-2 py-0.5 max-w-max flex items-center gap-1.5 animate-pulse">
                                  <span>🔮 Auto-advancing level in 3 seconds...</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Display comparison box */}
                          {targetColor && (
                            <div className="grid grid-cols-2 gap-3 bg-[#030303]/60 rounded-lg p-2.5 border border-[#1a1a1b]/65">
                              <div className="flex flex-col items-center gap-1.5 border-r border-[#1a1a1b]">
                                <span className="text-[10px] text-gray-400 font-mono">TARGET RGB:</span>
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className="w-6 h-6 rounded border border-[#1a1a1b]/70"
                                    style={{ backgroundColor: `rgb(${targetColor.r}, ${targetColor.g}, ${targetColor.b})` }}
                                  />
                                  <span className="text-xs text-gray-200 font-mono font-bold">
                                    {targetColor.r}, {targetColor.g}, {targetColor.b}
                                  </span>
                                </div>
                              </div>

                              <div className="flex flex-col items-center gap-1.5">
                                <span className="text-[10px] text-gray-400 font-mono">YOUR CLOSEST:</span>
                                {guesses.length > 0 && (
                                  <div className="flex items-center gap-1.5">
                                    <div
                                      className="w-6 h-6 rounded border border-[#1a1a1b]/70"
                                      style={{
                                        backgroundColor: `rgb(${
                                          guesses.reduce((prev, curr) => (curr.closeness > prev.closeness ? curr : prev)).guessColor.r
                                        }, ${
                                          guesses.reduce((prev, curr) => (curr.closeness > prev.closeness ? curr : prev)).guessColor.g
                                        }, ${
                                          guesses.reduce((prev, curr) => (curr.closeness > prev.closeness ? curr : prev)).guessColor.b
                                        })`,
                                      }}
                                    />
                                    <span className="text-xs text-gray-200 font-mono font-bold">
                                      {guesses.reduce((prev, curr) => (curr.closeness > prev.closeness ? curr : prev)).guessColor.r},{" "}
                                      {guesses.reduce((prev, curr) => (curr.closeness > prev.closeness ? curr : prev)).guessColor.g},{" "}
                                      {guesses.reduce((prev, curr) => (curr.closeness > prev.closeness ? curr : prev)).guessColor.b}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="text-xs text-gray-400 leading-relaxed font-sans select-all p-2.5 bg-[#030303] rounded font-mono border border-[#1a1a1b]/65 text-center relative">
                            <span className="absolute left-1.5 top-1 text-[9px] text-gray-500 bg-[#09090b] px-1 rounded">Score Grid</span>
                            {guesses.map((g) => (g.closeness >= 98 ? "🟩" : g.closeness >= 90 ? "🟨" : g.closeness >= 75 ? "🟧" : "🟥")).join("")}
                            {Array(3 - guesses.length).fill("⬛").join("")}
                          </div>

                          <div className="flex flex-col gap-2 mt-1">
                            <button
                              onClick={handleNextLevel}
                              className="w-full py-2.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg"
                            >
                              👉 PROCEED TO NEXT LEVEL (
                              {gameMode === "hue"
                                ? "SATURATION"
                                : gameMode === "saturation"
                                ? "COMPLEMENTARY"
                                : gameMode === "complementary"
                                ? "ANALOGOUS"
                                : gameMode === "analogous"
                                ? "TRIADIC"
                                : "HUE MATCHING"}
                              ) ➡️
                            </button>
                            <button
                              onClick={handlePlayAgain}
                              className="w-full py-2 bg-[#ff4500]/10 hover:bg-[#ff4500]/20 text-[#ff4500] text-xs font-bold rounded-lg border border-[#ff4500]/30 transition-colors flex items-center justify-center gap-2"
                            >
                              🔄 REPLAY CURRENT LEVEL
                            </button>
                            <p className="text-[11px] text-gray-400 text-center">
                              🎮 Sandbox mode active: Play as many matches as you like! Next daily reset in{" "}
                              <strong className="text-[#ff4500]">{formatCountdown(countdown)}</strong>.
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {/* Phaser 3 interactive drawing Area */}
                      <ColorPuzzleCanvas
                        guesses={guesses}
                        maxGuesses={3}
                        isGameOver={isGameOver}
                        targetColor={targetColor}
                        currentR={currentR}
                        currentG={currentG}
                        currentB={currentB}
                        gameMode={gameMode}
                        onColorChange={handleColorChange}
                        onGuessSubmitted={handleGuessSubmit}
                        isSoundEnabled={isSoundEnabled}
                      />
                    </>
                  )}
                  
                </motion.div>
              )}

              {/* GLOBAL LEADERBOARD */}
              {activeTab === "leaderboard" && (
                <motion.div
                  key="leaderboard-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex justify-between items-center border-b border-[#1a1a1b] pb-2">
                    <div className="flex items-center gap-1.5">
                      <Trophy size={16} className="text-amber-400" />
                      <h3 className="font-display font-medium text-sm text-slate-200">
                        Today&apos;s Daily Leaderboard
                      </h3>
                    </div>
                    <span className="text-[10px] bg-[#1a1a1b] text-gray-400 px-2 py-0.5 rounded font-mono">
                      DATE: {context?.date}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-[#1a1a1b] bg-[#030303]/40">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#030303] border-b border-[#1a1a1b] text-gray-400 text-[10px] tracking-wider font-mono">
                          <th className="py-2.5 px-3">RANK</th>
                          <th className="py-2.5 px-3">REDDITOR</th>
                          <th className="py-2.5 px-3 text-center">ACCURACY</th>
                          <th className="py-2.5 px-3 text-center">GUESSES</th>
                          <th className="py-2.5 px-3 text-center">TIME</th>
                          <th className="py-2.5 px-2 text-center">STREAK</th>
                        </tr>
                      </thead>
                      <tbody>
                        {context && context.leaderboard && context.leaderboard.length > 0 ? (
                          context.leaderboard.map((entry, index) => {
                            const isMe = entry.username.toLowerCase() === username.toLowerCase();
                            const timeStr = entry.timeSeconds !== undefined 
                              ? (Math.floor(entry.timeSeconds / 60) > 0 
                                  ? `${Math.floor(entry.timeSeconds / 60)}m ${entry.timeSeconds % 60}s` 
                                  : `${entry.timeSeconds % 60}s`) 
                              : "—";

                            return (
                              <tr
                                key={entry.username + index}
                                className={`border-b border-[#1a1a1b] hover:bg-[#1a1a1b]/20 transition-colors ${
                                  isMe ? "bg-[#ff4500]/5 font-semibold text-[#ff4500]" : ""
                                }`}
                              >
                                <td className="py-2.5 px-3 font-mono flex items-center gap-1.5">
                                  {index === 0 && <span className="text-amber-400 font-bold">🥇</span>}
                                  {index === 1 && <span className="text-slate-400 font-bold">🥈</span>}
                                  {index === 2 && <span className="text-amber-700 font-bold">🥉</span>}
                                  {index > 2 && <span className="text-gray-500 font-bold pl-2">{index + 1}</span>}
                                </td>
                                <td className="py-2.5 px-3 font-mono font-medium max-w-[120px] truncate">
                                  {entry.username} {isMe && <span className="text-[9px] bg-[#ff4500]/10 border border-[#ff4500]/20 text-[#ff4500] rounded px-1 ml-1 font-bold">YOU</span>}
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold">
                                  {entry.closeness}%
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-gray-300">
                                  {entry.guesses}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-green-400">
                                  {timeStr}
                                </td>
                                <td className="py-2.5 px-2 text-center">
                                  <div className="flex items-center justify-center gap-0.5 text-amber-500 font-bold font-mono">
                                    <Flame size={12} fill="currentColor" />
                                    <span>{entry.streak}d</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-8 px-3 text-center text-gray-500 font-mono">
                              No submissions yet today. Be the first to play!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-[#030303]/60 rounded-xl p-3 border border-[#1a1a1b] flex items-center gap-3">
                    <Award size={20} className="text-[#ff4500] shrink-0" />
                    <div>
                      <h4 className="font-bold text-xs text-gray-300 leading-normal">Weekly Reddit Badges</h4>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        Top 3 matched spots on the scorecard table earn Gold 🥇, Silver 🥈, or Bronze 🥉 badges immediately shown in their comments. Play daily to scale up!
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* INSTRUCTIONS TAB */}
              {activeTab === "instructions" && (
                <motion.div
                  key="instructions-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="flex flex-col gap-4 text-slate-300 text-xs leading-relaxed"
                >
                  <div className="flex items-center gap-1.5 border-b border-[#1a1a1b] pb-2">
                    <HelpCircle size={16} className="text-[#ff4500]" />
                    <h3 className="font-display font-medium text-sm text-slate-200">
                      How to Play Devvit Color Match
                    </h3>
                  </div>

                  <div className="flex flex-col gap-3">
                    <p>
                      Welcome to the color wheel matching ritual on Reddit! Your objective is to match the target color shown in the center split-disc using interactive color wheel controls.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                      
                      <div className="bg-[#030303]/40 p-3 rounded-xl border border-[#1a1a1b] flex gap-2">
                        <span className="text-lg">🎯</span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-200 text-xs">Progression Mode</span>
                          <span className="text-gray-400 text-[11px] mt-0.5">
                            Play through Hue, Saturation, Complementary, Analogous, and Triadic challenges! Auto-advances when finished.
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#030303]/40 p-3 rounded-xl border border-[#1a1a1b] flex gap-2">
                        <span className="text-lg">🎚️</span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-200 text-xs">Color Wheel Matching</span>
                          <span className="text-gray-400 text-[11px] mt-0.5">
                            Drag the white handle around the color wheel to match the visual tone. Keep an eye on the split-disc preview in the middle!
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#030303]/40 p-3 rounded-xl border border-[#1a1a1b] flex gap-2">
                        <span className="text-lg">📊</span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-250 text-xs">3 Attempts Per Level</span>
                          <span className="text-gray-400 text-[11px] mt-0.5">
                            You get 3 tries to achieve 100% closeness. When tries are exhausted or matched, the level automatically advances!
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#030303]/40 p-3 rounded-xl border border-[#1a1a1b] flex gap-2">
                        <span className="text-lg">🔥</span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-200 text-xs">Global Leaderboards</span>
                          <span className="text-gray-400 text-[11px] mt-0.5">
                            Achieve high accuracy to post your record scoreboard, secure active streaks, and lock in Weekly Reddit Badge spots!
                          </span>
                        </div>
                      </div>

                    </div>

                    <div className="border-t border-[#1a1a1b] pt-3 mt-2 flex flex-col gap-2">
                      <h4 className="font-bold text-xs text-slate-200 uppercase tracking-wider">
                        Accuracy Distance Color Scale (Closeness)
                      </h4>
                      <div className="flex items-center gap-1 w-full h-2 rounded overflow-hidden">
                        <div className="flex-1 bg-red-500 h-full"></div>
                        <div className="flex-1 bg-orange-500 h-full"></div>
                        <div className="flex-1 bg-amber-500 h-full"></div>
                        <div className="flex-1 bg-green-400 h-full"></div>
                        <div className="flex-1 bg-emerald-500 h-full"></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                        <span>FREEZING COLD (&lt;70%)</span>
                        <span>WARM (&gt;85%)</span>
                        <span>PERFECT MATCH (100%)</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-gray-400 text-center italic mt-2">
                      🛠️ Crafted for the Devvit Developers Showcase. Built with Phaser 3 vector mechanics & React state controllers.
                    </p>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          )}

        </div>

        {/* Mini App footer bar */}
        <div className="py-2.5 px-4 bg-[#0e0e11]/40 border-t border-[#25252a] flex justify-between items-center text-[10px] text-gray-500">
          <div className="flex items-center gap-1">
            <Heart size={10} className="text-rose-500 animate-pulse fill-rose-500" />
            <span>Built by the AI Studio Build agent</span>
          </div>
          <span>r/ChromaDaily is unofficial • v1.3</span>
        </div>

      </div>
    </RedditFrame>
  );
}
