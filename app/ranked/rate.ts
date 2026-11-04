// Ratings after a ranked game. Server side only, called by the rooms (app/online/rooms.ts)
// once the room is saved with the result.
import "server-only";
import type { FinishedGame } from "../account/accounts";
import { NO_ID, usersCollection, type StoredRanked, type StoredUser } from "../account/store";
import type { Side } from "../game/rules";
import { database, isDuplicateKey } from "../lib/mongo";
import { PLACEMENT_GAMES } from "./config";
import { forgetLeaderboard } from "./leaderboard";
import type { RatingChange } from "./protocol";
import { newRating, rateGame, type Rating } from "./rating";

// Ratings kept for the curve on the account page
const HISTORY_LENGTH = 30;
// The log of ranked games is kept this long (it limits games against the same player)
const LOG_TTL_MS = 30 * 24 * 60 * 60_000;

/** A ranked game, logged once it is rated */
export type RankedGameLog = {
  /** room code:round, so a game is rated once */
  _id: string;
  /** Both accounts, sorted: to count the games between two players */
  pair: string;
  players: Record<Side, string>;
  winner: Side | null;
  reason: FinishedGame["reason"];
  at: Date;
  /** When MongoDB drops the log (TTL index) */
  expireAt: Date;
};

export const pairKey = (a: string, b: string) => [a, b].sort().join("|");

export const rankedGamesCollection = async () =>
  (await database()).collection<RankedGameLog>("rankedGames");

const roomsCollection = async () =>
  (await database()).collection<{ _id: string; round: number }>("rooms");

/** A ranked game that could not be rated (a deleted account, an error): its pages show
 * it instead of waiting for the points */
export const markUnrated = async (code: string, round: number) => {
  await (await roomsCollection()).updateOne({ _id: code, round }, { $set: { unrated: true }, $inc: { v: 1 } });
};

const ratingOf = (user: StoredUser): Rating => user.ranked ?? newRating();

/** Saves the new rating of a player, only if their rating is still the one read */
const saveRanked = async (user: StoredUser, before: Rating, after: Rating, score: number) => {
  const old: Partial<StoredRanked> = user.ranked ?? {};
  const ranked: StoredRanked = {
    ...after,
    wins: (old.wins ?? 0) + (score === 1 ? 1 : 0),
    losses: (old.losses ?? 0) + (score === 0 ? 1 : 0),
    draws: (old.draws ?? 0) + (score === 0.5 ? 1 : 0),
    // The best rating counts once the placement games are over
    peak: after.games >= PLACEMENT_GAMES ? Math.max(old.peak ?? 0, after.rating) : old.peak ?? 0,
    history: [...(old.history ?? []), after.rating].slice(-HISTORY_LENGTH),
  };
  const res = await (await usersCollection()).updateOne(
    user.ranked ? { id: user.id, "ranked.games": before.games } : { id: user.id, ranked: { $exists: false } },
    { $set: { ranked } }
  );
  return res.matchedCount === 1;
};

/** Rates a ranked game (once, even if asked twice) and shows the new ratings in its
 * room; returns them, or null when the game cannot be rated (a deleted account) */
export const rateRankedGame = async (
  code: string,
  round: number,
  game: FinishedGame
): Promise<Record<Side, RatingChange> | null> => {
  const { X, O } = game.players;
  if (!X || !O || X === O) return null;
  const now = Date.now();
  try {
    await (await rankedGamesCollection()).insertOne({
      _id: `${code}:${round}`,
      pair: pairKey(X, O),
      players: { X, O },
      winner: game.winner,
      reason: game.reason,
      at: new Date(now),
      expireAt: new Date(now + LOG_TTL_MS),
    });
  } catch (e) {
    // Already rated
    if (isDuplicateKey(e)) return null;
    throw e;
  }

  const users = await usersCollection();
  const read = async (id: string) => users.findOne({ id }, NO_ID);
  const [readX, readO] = await Promise.all([read(X), read(O)]);
  const players = { X: readX, O: readO };
  if (!players.X || !players.O) {
    // A player deleted their account: nobody is rated, the pages stop waiting
    await markUnrated(code, round);
    return null;
  }
  // Both new ratings come from the ratings before the game
  const before = { X: ratingOf(players.X), O: ratingOf(players.O) };
  const scoreX = game.winner === "X" ? 1 : game.winner === "O" ? 0 : 0.5;
  const rated = rateGame(before.X, before.O, scoreX, now);
  const after = { X: rated.a, O: rated.b };

  const sides: Side[] = ["X", "O"];
  for (const side of sides) {
    const score = side === "X" ? scoreX : 1 - scoreX;
    let user = players[side];
    // Changed meanwhile (another ranked game of the same account): rated again from
    // the rating as it is now
    for (let attempt = 0; user && attempt < 3; attempt++) {
      const mine = ratingOf(user);
      const next =
        attempt === 0 ? after[side] : rateGame(mine, before[side === "X" ? "O" : "X"], score, now).a;
      if (await saveRanked(user, mine, next, score)) {
        after[side] = next;
        before[side] = mine;
        break;
      }
      user = await read(user.id);
    }
  }

  const ratings: Record<Side, RatingChange> = {
    X: { before: before.X.rating, after: after.X.rating, gamesBefore: before.X.games, gamesAfter: after.X.games },
    O: { before: before.O.rating, after: after.O.rating, gamesBefore: before.O.games, gamesAfter: after.O.games },
  };
  // Shown in the room: its version changes, so the pages get it at once
  await (await roomsCollection()).updateOne({ _id: code, round }, { $set: { ratings }, $inc: { v: 1 } });
  forgetLeaderboard();
  return ratings;
};
