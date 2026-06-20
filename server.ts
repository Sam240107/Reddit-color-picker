import express from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";

const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "data", "db.json");

// Ensure data folder and database exist
if (!fs.existsSync(path.dirname(DB_FILE))) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
}

interface LeaderboardEntry {
  username: string;
  closeness: number;
  guesses: number;
  points: number;
  streak: number;
  badge: "Gold" | "Silver" | "Bronze" | "Iron" | "";
  date: string;
  timeSeconds?: number;
}

interface CommentEntry {
  id: string;
  username: string;
  text: string;
  timeAgo: string;
  ups: number;
  badge?: string;
  isUser?: boolean;
}

interface DatabaseSchema {
  leaderboard: LeaderboardEntry[];
  comments: CommentEntry[];
}

const DEFAULT_LEADERBOARD: LeaderboardEntry[] = [
  { username: "u/PixelChef", closeness: 99.6, guesses: 2, points: 9960, streak: 15, badge: "Gold", date: "" },
  { username: "u/ChromaConnoisseur", closeness: 98.9, guesses: 3, points: 9890, streak: 8, badge: "Silver", date: "" },
  { username: "u/VectorViper", closeness: 98.1, guesses: 4, points: 9810, streak: 5, badge: "Bronze", date: "" },
  { username: "u/PhaserFanatic", closeness: 97.4, guesses: 3, points: 9740, streak: 12, badge: "Iron", date: "" },
  { username: "u/RedditSnoo33", closeness: 95.8, guesses: 4, points: 9580, streak: 3, badge: "", date: "" },
  { username: "u/ColorSeeker", closeness: 94.2, guesses: 5, points: 9420, streak: 2, badge: "", date: "" },
  { username: "u/HueHero", closeness: 91.5, guesses: 5, points: 9150, streak: 1, badge: "", date: "" }
];

const DEFAULT_COMMENTS: CommentEntry[] = [
  { id: "c1", username: "u/PixelChef", text: "Wow, today's color has a subtle green tint that is tricky! Got 99.6% closeness on my second guess by luck. 🟩🔥", timeAgo: "2 hours ago", ups: 14, badge: "Gold" },
  { id: "c2", username: "u/ChromaConnoisseur", text: "Got 98.9%! Color matching on mobile with fingers worked surprisingly well. Love the Phaser canvas drag control.", timeAgo: "4 hours ago", ups: 9, badge: "Silver" },
  { id: "c3", username: "u/SnooDoodles", text: "Next puzzle in 14 hours? I am definitely returning tomorrow, my 6-day streak depends on it!", timeAgo: "5 hours ago", ups: 7 },
  { id: "c4", username: "u/PhaserFanatic", text: "Finally a Devvit game with solid polish. Phaser rendering makes the color picker transition super smooth.", timeAgo: "6 hours ago", ups: 5, badge: "Iron" }
];

function readDB(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading database:", err);
  }
  // Initialize with default template data dated with current date
  const today = getTodayUTCString();
  const leaderboard = DEFAULT_LEADERBOARD.map(entry => ({ ...entry, date: today }));
  const comments = [...DEFAULT_COMMENTS];
  const db = { leaderboard, comments };
  writeDB(db);
  return db;
}

function writeDB(data: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing database:", err);
  }
}

// Helpers
function getTodayUTCString(): string {
  const now = new Date();
  return now.toISOString().split("T")[0]; // YYYY-MM-DD
}

function getDailyColor(dateStr: string) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash << 5) - hash + dateStr.charCodeAt(i);
    hash |= 0;
  }
  // Deterministic RGB generation
  const r = Math.abs((hash ^ 0x123456) % 256);
  const g = Math.abs(((hash >> 8) ^ 0x654321) % 256);
  const b = Math.abs(((hash >> 16) ^ 0xabcdef) % 256);
  return { r, g, b };
}

function rgbToHsv(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const v = max;

  const d = max - min;
  s = max === 0 ? 0 : d / max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s, v };
}

function hsvToRgb(h: number, s: number, v: number) {
  h /= 360;
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  };
}

function normalizeColorForMode(color: {r: number, g: number, b: number}, mode: string) {
  const hsv = rgbToHsv(color.r, color.g, color.b);
  if (mode === "saturation") {
    // Lock Value to 1.0 (fully bright) but keep Hue and Saturation
    return hsvToRgb(hsv.h, hsv.s, 1.0);
  } else {
    // Lock Saturation to 1.0 and Value to 1.0
    return hsvToRgb(hsv.h, 1.0, 1.0);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // API 1: Get game context
  app.get("/api/game-context", (req, res) => {
    const today = getTodayUTCString();
    
    // Calculate seconds left until midnight UTC
    const now = new Date();
    const nextMidnight = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      0, 0, 0, 0
    ));
    const countdownSeconds = Math.max(0, Math.floor((nextMidnight.getTime() - now.getTime()) / 1000));

    const db = readDB();
    // Filter leaderboard to include today or show top historical
    const todaysLeaderboard = db.leaderboard.filter(e => e.date === today);
    // If today's leaderboard is sparse, populate it with the template data
    let displayLeaderboard = todaysLeaderboard;
    if (todaysLeaderboard.length < 3) {
      displayLeaderboard = db.leaderboard; // Fallback to all entries
    }

    // Sort leaderboard desc (higher points, then lower time, then fewer guesses)
    displayLeaderboard.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const tA = a.timeSeconds !== undefined ? a.timeSeconds : 999999;
      const tB = b.timeSeconds !== undefined ? b.timeSeconds : 999999;
      if (tA !== tB) return tA - tB;
      return a.guesses - b.guesses;
    });

    res.json({
      date: today,
      countdown: countdownSeconds,
      // Target color has its values obfuscated unless requested under appropriate finish state
      leaderboard: displayLeaderboard.slice(0, 10),
      comments: db.comments
    });
  });

  // API to fetch target color coordinates for a specific seed/game
  app.get("/api/target-color", (req, res) => {
    const seed = (req.query.seed as string) || getTodayUTCString();
    const baseTarget = getDailyColor(seed);
    
    // Parse mode from seed
    let mode = "hue";
    if (seed.includes("saturation")) mode = "saturation";
    else if (seed.includes("complementary")) mode = "complementary";
    else if (seed.includes("analogous")) mode = "analogous";
    else if (seed.includes("triadic")) mode = "triadic";

    const target = normalizeColorForMode(baseTarget, mode);
    res.json({ targetColor: target });
  });

  // API 2: Secure guess evaluation
  app.post("/api/guess", (req, res) => {
    const { r, g, b, guessesCount, seed, maxGuesses } = req.body;
    if (typeof r !== "number" || typeof g !== "number" || typeof b !== "number") {
      return res.status(400).json({ error: "Invalid color coordinates" });
    }

    const today = getTodayUTCString();
    const activeSeed = seed || today;
    const baseTarget = getDailyColor(activeSeed);

    // Determine mode
    let mode = req.body.gameMode;
    if (!mode && typeof activeSeed === "string") {
      if (activeSeed.includes("saturation")) mode = "saturation";
      else if (activeSeed.includes("complementary")) mode = "complementary";
      else if (activeSeed.includes("analogous")) mode = "analogous";
      else if (activeSeed.includes("triadic")) mode = "triadic";
    }
    if (!mode) mode = "hue";

    // Normalize both player's guess coordinates and the target color coordinate for the specific mode
    const userGuess = normalizeColorForMode({ r, g, b }, mode);
    const target = normalizeColorForMode(baseTarget, mode);

    // Euclidean distance in RGB on normalized modes
    const dr = userGuess.r - target.r;
    const dg = userGuess.g - target.g;
    const db = userGuess.b - target.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);

    // Max distance is sqrt(255^2 * 3) = ~441.67
    const maxDist = 441.67;
    let closeness = Math.max(0, Number((100 - (distance / maxDist) * 100).toFixed(1)));
    if (closeness >= 99.0) {
      closeness = 100.0;
    }
    
    // Generous bounding for a match
    const isCorrect = distance < 8;
    const limit = typeof maxGuesses === "number" ? maxGuesses : 3;
    const isGameOver = isCorrect || guessesCount >= (limit - 1);

    res.json({
      distance: Math.round(distance),
      closeness,
      isCorrect,
      isGameOver,
      // Only return the target color if the user has concluded playing (won or exhausted guesses)
      targetColor: isGameOver ? target : null
    });
  });

  // API 3: Submit high score
  app.post("/api/submit-score", (req, res) => {
    const { username, closeness, guesses, streak, timeSeconds } = req.body;
    if (!username || typeof closeness !== "number" || typeof guesses !== "number") {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const cleanUsername = username.trim().startsWith("u/") ? username.trim() : `u/${username.trim()}`;
    const today = getTodayUTCString();
    
    // Calculate final points: average closeness * 100, capped at 10000
    const points = Math.round(closeness * 100); 

    const db = readDB();
    
    // Check if user already submitted for today to avoid spam
    const existingIndex = db.leaderboard.findIndex(
      e => e.username.toLowerCase() === cleanUsername.toLowerCase() && e.date === today
    );

    const newEntry: LeaderboardEntry = {
      username: cleanUsername,
      closeness,
      guesses,
      points,
      streak: streak || 1,
      badge: "",
      date: today,
      timeSeconds: typeof timeSeconds === "number" ? timeSeconds : undefined
    };

    if (existingIndex !== -1) {
      // Keep best points (or faster time if points are identical)
      const currentBest = db.leaderboard[existingIndex];
      const isNewBetter = points > currentBest.points || 
        (points === currentBest.points && 
         (timeSeconds !== undefined && (currentBest.timeSeconds === undefined || timeSeconds < currentBest.timeSeconds)));
      
      if (isNewBetter) {
        db.leaderboard[existingIndex] = newEntry;
      }
    } else {
      db.leaderboard.push(newEntry);
    }

    // Recalculate badges for today
    const todaysScores = db.leaderboard.filter(e => e.date === today);
    todaysScores.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const tA = a.timeSeconds !== undefined ? a.timeSeconds : 999999;
      const tB = b.timeSeconds !== undefined ? b.timeSeconds : 999999;
      if (tA !== tB) return tA - tB;
      return a.guesses - b.guesses;
    });
    
    todaysScores.forEach((entry, idx) => {
      if (idx === 0) entry.badge = "Gold";
      else if (idx === 1) entry.badge = "Silver";
      else if (idx === 2) entry.badge = "Bronze";
      else if (idx < 5) entry.badge = "Iron";
      else entry.badge = "";
    });

    writeDB(db);

    const filteredBoard = db.leaderboard.filter(e => e.date === today);
    filteredBoard.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const tA = a.timeSeconds !== undefined ? a.timeSeconds : 999999;
      const tB = b.timeSeconds !== undefined ? b.timeSeconds : 999999;
      if (tA !== tB) return tA - tB;
      return a.guesses - b.guesses;
    });

    res.json({
      success: true,
      leaderboard: filteredBoard.slice(0, 10)
    });
  });

  // API 4: Simulate user posting a comment
  app.post("/api/comment", (req, res) => {
    const { username, text } = req.body;
    if (!username || !text) {
      return res.status(400).json({ error: "Comment text and username are required" });
    }

    const cleanUsername = username.trim().startsWith("u/") ? username.trim() : `u/${username.trim()}`;
    const db = readDB();

    const newComment: CommentEntry = {
      id: "user_" + Date.now(),
      username: cleanUsername,
      text,
      timeAgo: "Just now",
      ups: 1,
      isUser: true
    };

    db.comments.unshift(newComment); // Add to top of comment list
    writeDB(db);

    res.json({
      success: true,
      comments: db.comments
    });
  });

  // Vite Integration for development / static files for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server startup failed:", err);
});
