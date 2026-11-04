// The best ranked players and their crowns. Server side only.
import "server-only";
import type { Crown } from "../account/protocol";
import { usersCollection, type StoredUser } from "../account/store";
import { LEADERBOARD, PLACEMENT_GAMES } from "./config";
import type { Leaderboard, LeaderboardEntry } from "./protocol";

const DAY_MS = 24 * 60 * 60_000;
// The list is read again at most this often by each server instance: it is asked for
// by every page showing a player (crowns), not only by the leaderboard page
const CACHE_MS = 15_000;

/** Accounts on the leaderboard: placed, and active lately */
export const rankedFilter = (now: number) => ({
  "ranked.games": { $gte: PLACEMENT_GAMES },
  ...(LEADERBOARD.activeDays > 0 && {
    "ranked.lastPlayedAt": { $gte: now - LEADERBOARD.activeDays * DAY_MS },
  }),
});

const cache = globalThis as typeof globalThis & {
  morpionLeaderboard?: { at: number; board: Promise<LeaderboardEntry[]> };
};

const read = async (now: number): Promise<LeaderboardEntry[]> => {
  const users = await (await usersCollection())
    .find(rankedFilter(now), {
      projection: { _id: 0, id: 1, pseudo: 1, avatar: 1, color: 1, ranked: 1 },
    })
    // Same rating: the one with more games first, then the oldest account
    .sort({ "ranked.rating": -1, "ranked.games": -1, createdAt: 1 })
    .limit(LEADERBOARD.size)
    .toArray();
  return users.map((user: Partial<StoredUser>, index) => ({
    id: user.id!,
    pseudo: user.pseudo!,
    avatar: user.avatar!,
    color: user.color!,
    ...(index < 3 && { crown: (index + 1) as Crown }),
    position: index + 1,
    rating: Math.round(user.ranked!.rating),
    games: user.ranked!.games,
    wins: user.ranked!.wins ?? 0,
    losses: user.ranked!.losses ?? 0,
    draws: user.ranked!.draws ?? 0,
  }));
};

/** The best players, read again every few seconds */
export const leaderboard = async (): Promise<Leaderboard> => {
  const now = Date.now();
  if (!cache.morpionLeaderboard || now - cache.morpionLeaderboard.at > CACHE_MS) {
    const board = read(now);
    cache.morpionLeaderboard = { at: now, board };
    // A failed read is tried again at the next request
    board.catch(() => {
      if (cache.morpionLeaderboard?.board === board) cache.morpionLeaderboard = undefined;
    });
  }
  return { players: await cache.morpionLeaderboard.board, activeDays: LEADERBOARD.activeDays };
};

/** A ranked game changed the ratings: read the list again at the next request */
export const forgetLeaderboard = () => {
  cache.morpionLeaderboard = undefined;
};

/** Crowns of the 3 best players, by account id. Pages showing players keep working
 * (without crowns) if the list cannot be read. */
export const crowns = async () => {
  const byId = new Map<string, Crown>();
  try {
    for (const player of (await leaderboard()).players)
      if (player.crown) byId.set(player.id, player.crown);
  } catch (e) {
    console.error("Classement : lecture impossible", e);
  }
  return byId;
};

/** Place of a player among the leaderboard players (also beyond the list), null when
 * not on it (not placed, or inactive) */
export const positionOf = async (user: StoredUser) => {
  const now = Date.now();
  const ranked = user.ranked;
  if (!ranked || ranked.games < PLACEMENT_GAMES) return null;
  if (LEADERBOARD.activeDays > 0 && (ranked.lastPlayedAt ?? 0) < now - LEADERBOARD.activeDays * DAY_MS)
    return null;
  // On the cached list: the same place as shown there
  const listed = (await leaderboard()).players.find((p) => p.id === user.id);
  if (listed) return listed.position;
  const better = await (await usersCollection()).countDocuments({
    ...rankedFilter(now),
    "ranked.rating": { $gt: ranked.rating },
  });
  return better + 1;
};
