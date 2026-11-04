// Messages exchanged between the ranked pages and the ranked API (app/api/ranked).
import type { Side } from "../game/rules";
import type { PublicProfile } from "../account/protocol";

/** What the pages need to show a rank (see rankOf in rating.ts) */
export type RankedRating = { rating: number; games: number };

/** A player's rating before and after a ranked game */
export type RatingChange = {
  before: number;
  after: number;
  gamesBefore: number;
  gamesAfter: number;
};

/** The ranked side of an account, on the account page */
export type RankedSummary = RankedRating & {
  wins: number;
  losses: number;
  draws: number;
  /** Best rating once placed */
  peak: number;
  /** Place among the active ranked players, null until placed (or when inactive) */
  position: number | null;
  /** Ratings after the latest games, oldest first */
  history: number[];
};

export type QueueAction = "join" | "poll" | "leave";

export type QueueStatus =
  | { status: "idle"; searching: number }
  /** range: rating difference accepted right now */
  | { status: "searching"; since: number; range: number; searching: number }
  | {
      status: "matched";
      code: string;
      token: string;
      you: Side;
      opponent: (PublicProfile & RankedRating) | null;
    };

export type LeaderboardEntry = PublicProfile &
  RankedRating & {
    id: string;
    position: number;
    wins: number;
    losses: number;
    draws: number;
  };

export type Leaderboard = {
  players: LeaderboardEntry[];
  /** Only players with a ranked game in this many days (0: everyone) */
  activeDays: number;
};
