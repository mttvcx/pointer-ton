/** Shared types for points leaderboard (safe for client + server imports). */

export interface LeaderboardEntry {
  user_id: string;
  username: string | null;
  wallet_address: string | null;
  total_points: number;
  active_days: number;
  rank: number;
}

export interface LeaderboardPageResult {
  podium: LeaderboardEntry[];
  rows: LeaderboardEntry[];
  total: number;
  page: number;
  pageSize: number;
  tableTotal: number;
  tablePages: number;
  you: LeaderboardEntry | null;
}
