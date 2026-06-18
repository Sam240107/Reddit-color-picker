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
import { DailyPuzzleContext, GuessResult, RGB, CommentEntry } from "./types";
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

      // Restore user gameplay state for *Today* if they already started/finished
      const savedHistoryJson = localStorage.getItem(`devvit_color_history_${data.date}`);
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

  // Submit and evaluate user's RGB guess
  const handleGuessSubmit = async () => {
    if (isGameOver || isSubmitting || !context) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          r: currentR,
          g: currentG,
          b: currentB,
          guessesCount: guesses.length,
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
          `devvit_color_history_${context.date}`,
          JSON.stringify({
            guesses: updatedGuesses,
            isGameOver: true,
            targetColor: evaluation.targetColor,
          })
        );

        // Secure submission of final score to server board
        const bestEvaluatedCloseness = Math.max(...updatedGuesses.map((g) => g.closeness));
        const finalSubmitRes = await fetch("/api/submit-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username,
            closeness: bestEvaluatedCloseness,
            guesses: updatedGuesses.length,
            streak: finalStreak,
          }),
        });

        if (finalSubmitRes.ok) {
          const scoreData = await finalSubmitRes.json();
          setContext((prev) => prev ? { ...prev, leaderboard: scoreData.leaderboard } : null);
        }
      } else {
        // Non-terminal state caching
        localStorage.setItem(
          `devvit_color_history_${context.date}`,
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

    const filler = Array(5 - guesses.length).fill("⬛").join("");
    const gridRow = emojiMap + filler;

    return `🎨 Daily Color Match - ${context.date}\nAccuracy: ${bestCloseness}%\nGuesses: ${guesses.length}/5\nResults: ${gridRow}\nStreak: 🔥 ${streak} days\nPlayed on r/ColorDaily (Phaser 3 Devvit!)`;
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

        {/* HUD Sub-banner: Next puzzle timer & state information */}
        <div className="bg-[#030303] px-4 py-2 border-b border-[#1a1a1b] flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-450 font-mono">
            <Clock size={12} className="text-[#ff4500]" />
            <span>MIDNIGHT UTC REFRESH:</span>
          </div>

          <div className="flex items-center gap-1 bg-[#ff4500]/10 border border-[#ff4500]/20 rounded px-2 py-0.5">
            <span className="text-xs font-bold font-mono tracking-wide text-[#ff4500]">
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
                            PUZZLE MATCH FINISHED!
                          </h4>
                          <p className="text-xs text-gray-300">
                            You used {guesses.length}/5 guesses. Your highest match was{" "}
                            <strong className="text-white">
                              {Math.max(...guesses.map((g) => g.closeness))}%
                            </strong>
                            .
                          </p>
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
                        {Array(5 - guesses.length).fill("⬛").join("")}
                      </div>

                      <p className="text-[11px] text-gray-400 text-center mt-1">
                        🔒 One game per day limits cheating! Next puzzle resets in{" "}
                        <strong className="text-[#ff4500]">{formatCountdown(countdown)}</strong>.
                      </p>
                    </motion.div>
                  )}

                  {/* Phaser 3 interactive drawing Area */}
                  <ColorPuzzleCanvas
                    guesses={guesses}
                    maxGuesses={5}
                    isGameOver={isGameOver}
                    targetColor={targetColor}
                    currentR={currentR}
                    currentG={currentG}
                    currentB={currentB}
                    onColorChange={handleColorChange}
                    onGuessSubmitted={handleGuessSubmit}
                    isSoundEnabled={isSoundEnabled}
                  />
                  
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
                          <th className="py-2.5 px-2 text-center">STREAK</th>
                        </tr>
                      </thead>
                      <tbody>
                        {context && context.leaderboard && context.leaderboard.length > 0 ? (
                          context.leaderboard.map((entry, index) => {
                            const isMe = entry.username.toLowerCase() === username.toLowerCase();
                            
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
                                  {entry.guesses}/5
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
                            <td colSpan={5} className="py-8 px-3 text-center text-gray-500 font-mono">
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
                      Welcome to the daily wavelength matching ritual inside Reddit. Your objective is simple: guess the hidden RGB target color using a series of slider test mixes.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
                      
                      <div className="bg-[#030303]/40 p-3 rounded-xl border border-[#1a1a1b] flex gap-2">
                        <span className="text-lg">🎯</span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-200 text-xs">One Puzzle Daily</span>
                          <span className="text-gray-400 text-[11px] mt-0.5">
                            A single secret color is generated securely on the server daily at midnight UTC. All Reddit players face the same color!
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#030303]/40 p-3 rounded-xl border border-[#1a1a1b] flex gap-2">
                        <span className="text-lg">🎚️</span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-200 text-xs">RGB Mixing Control</span>
                          <span className="text-gray-400 text-[11px] mt-0.5">
                            Drag the Red, Green, and Blue sliders to match. The color previews represent yours (YOUR MIX) vs the target.
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#030303]/40 p-3 rounded-xl border border-[#1a1a1b] flex gap-2">
                        <span className="text-lg">📊</span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-250 text-xs">5 Precious Attempts</span>
                          <span className="text-gray-400 text-[11px] mt-0.5">
                            Each guess evaluated for distance. The glow-filled sensor bar shows if you are Freezing Cold or getting Warmer.
                          </span>
                        </div>
                      </div>

                      <div className="bg-[#030303]/40 p-3 rounded-xl border border-[#1a1a1b] flex gap-2">
                        <span className="text-lg">🔥</span>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-200 text-xs">Daily Streaks</span>
                          <span className="text-gray-400 text-[11px] mt-0.5">
                            Earn 95%+ accuracy to update your highscore and extend your play streak. Skip a day and streak resets to zero!
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
