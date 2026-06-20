export interface DailyPuzzleContext {
  date: string;
  countdown: number;
  leaderboard: LeaderboardEntry[];
  comments: CommentEntry[];
}

export interface LeaderboardEntry {
  username: string;
  closeness: number;
  guesses: number;
  points: number;
  streak: number;
  badge: "Gold" | "Silver" | "Bronze" | "Iron" | "";
  date: string;
  timeSeconds?: number;
}

export interface CommentEntry {
  id: string;
  username: string;
  text: string;
  timeAgo: string;
  ups: number;
  badge?: string;
  isUser?: boolean;
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface GuessResult {
  guessColor: RGB;
  distance: number;
  closeness: number;
  isCorrect: boolean;
  score: number;
}

export interface LocalGameState {
  playedToday: boolean;
  guesses: GuessResult[];
  lastPlayedDate: string;
  streak: number;
  hasWon: boolean;
  bestCloseness: number;
}

export type GameMode = "hue" | "saturation" | "complementary" | "analogous" | "triadic";

