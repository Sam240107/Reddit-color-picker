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

    // Sort leaderboard desc
    displayLeaderboard.sort((a, b) => b.points - a.points || a.guesses - b.guesses);

    res.json({
      date: today,
      countdown: countdownSeconds,
      // Target color has its values obfuscated unless requested under appropriate finish state
      leaderboard: displayLeaderboard.slice(0, 10),
      comments: db.comments
    });
  });

  // API 2: Secure guess evaluation
  app.post("/api/guess", (req, res) => {
    const { r, g, b, guessesCount } = req.body;
    if (typeof r !== "number" || typeof g !== "number" || typeof b !== "number") {
      return res.status(400).json({ error: "Invalid color coordinates" });
    }

    const today = getTodayUTCString();
    const target = getDailyColor(today);

    // Euclidean distance in RGB
    const dr = r - target.r;
    const dg = g - target.g;
    const db = b - target.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);

    // Max distance is sqrt(255^2 * 3) = ~441.67
    const maxDist = Math.sqrt(255 * 255 * 3);
    const closeness = Math.max(0, Number((100 - (distance / maxDist) * 100).toFixed(1)));
    
    // We count matching if closeness is extremely high (e.g. >= 99.5% or distance < 4)
    const isCorrect = distance < 4;
    const isGameOver = isCorrect || guessesCount >= 4; // guessesCount is 0-indexed, so 4 means 5th guess

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
    const { username, closeness, guesses, streak } = req.body;
    if (!username || typeof closeness !== "number" || typeof guesses !== "number") {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const cleanUsername = username.trim().startsWith("u/") ? username.trim() : `u/${username.trim()}`;
    const today = getTodayUTCString();
    const points = Math.round(closeness * 100); // 10000 max score

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
      date: today
    };

    if (existingIndex !== -1) {
      // Keep best points
      if (points > db.leaderboard[existingIndex].points) {
        db.leaderboard[existingIndex] = newEntry;
      }
    } else {
      db.leaderboard.push(newEntry);
    }

    // Recalculate badges for today
    const todaysScores = db.leaderboard.filter(e => e.date === today);
    todaysScores.sort((a, b) => b.points - a.points || a.guesses - b.guesses);
    
    todaysScores.forEach((entry, idx) => {
      if (idx === 0) entry.badge = "Gold";
      else if (idx === 1) entry.badge = "Silver";
      else if (idx === 2) entry.badge = "Bronze";
      else if (idx < 5) entry.badge = "Iron";
      else entry.badge = "";
    });

    writeDB(db);

    res.json({
      success: true,
      leaderboard: db.leaderboard.filter(e => e.date === today).slice(0, 10)
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
