// Ranked matchmaking: players searching for a game wait in the queue (MongoDB `queue`
// collection, one entry per account); every request of a searching page tries to pair
// them, under a lock so two server instances never pair the same player twice.
// Server side only.
import "server-only";
import { randomInt } from "node:crypto";
import { fail, profilesOf } from "../account/accounts";
import type { StoredUser } from "../account/store";
import type { Side } from "../game/rules";
import { database, isDuplicateKey } from "../lib/mongo";
import { createRankedRoom, discardRoom, isRoomPlaying } from "../online/rooms";
import { MATCHMAKING } from "./config";
import type { QueueStatus } from "./protocol";
import { pairKey, rankedGamesCollection } from "./rate";
import { newRating } from "./rating";

// A searching page asks every 1.5 s: without a word for this long, it is gone (closed,
// or in the background) and nobody is paired with it
const STALE_MS = 10_000;
// MongoDB drops a search this long after the page last asked (TTL index)
const SEARCH_TTL_MS = 60_000;
// The pairing lock is free again after this long, even if its holder never frees it
const LOCK_MS = 5_000;
const DAY_MS = 24 * 60 * 60_000;

type Match = {
  code: string;
  token: string;
  you: Side;
  opponentId: string;
  opponentRating: number;
  opponentGames: number;
};

type QueueEntry = {
  /** The account */
  _id: string;
  rating: number;
  games: number;
  /** When the search started */
  since: number;
  /** When the searching page last asked */
  seenAt: number;
  /** When MongoDB drops the entry (TTL index) */
  expireAt: Date;
  /** The game found, kept while it is played (to come back to it) */
  match: Match | null;
};

const queueCollection = async () => (await database()).collection<QueueEntry>("queue");
const locksCollection = async () =>
  (await database()).collection<{ _id: string; until: number }>("locks");

/** Rating difference accepted after waiting since `since` */
const rangeOf = (since: number, now: number) =>
  Math.round(MATCHMAKING.rangeStart + (MATCHMAKING.rangeGrowthPerSecond * Math.max(0, now - since)) / 1000);

const searchingCount = async (now: number) =>
  (await queueCollection()).countDocuments({ match: null, seenAt: { $gt: now - STALE_MS } });

/** These two played too many ranked games together lately */
const playedTooOften = async (a: string, b: string, now: number) => {
  const limit = MATCHMAKING.sameOpponentPerDay;
  const count = await (await rankedGamesCollection()).countDocuments(
    { pair: pairKey(a, b), at: { $gt: new Date(now - DAY_MS) } },
    { limit }
  );
  return count >= limit;
};

/** Makes the game of two waiting players; false if one of them stopped searching */
const startGame = async (a: QueueEntry, b: QueueEntry) => {
  const [x, o] = randomInt(2) ? [a, b] : [b, a];
  const room = await createRankedRoom({
    X: { id: x._id, rating: { rating: x.rating, games: x.games } },
    O: { id: o._id, rating: { rating: o.rating, games: o.games } },
  });
  const queue = await queueCollection();
  const give = async (entry: QueueEntry, you: Side, opponent: QueueEntry) =>
    (
      await queue.updateOne(
        { _id: entry._id, match: null },
        {
          $set: {
            match: {
              code: room.code,
              token: room.tokens[you],
              you,
              opponentId: opponent._id,
              opponentRating: opponent.rating,
              opponentGames: opponent.games,
            },
            // Kept while the room is
            expireAt: room.expireAt,
          },
        }
      )
    ).matchedCount === 1;
  if (!(await give(x, "X", o))) {
    await discardRoom(room.code);
    return false;
  }
  if (!(await give(o, "O", x))) {
    await queue.updateOne({ _id: x._id, "match.code": room.code }, { $set: { match: null } });
    await discardRoom(room.code);
    return false;
  }
  return true;
};

/** Pairs the waiting players, the longest waiting first, each with the closest rating
 * their waiting time allows. Does nothing if another request is pairing right now. */
const pairPlayers = async (now: number) => {
  const locks = await locksCollection();
  const until = now + LOCK_MS;
  try {
    const lock = await locks.findOneAndUpdate(
      { _id: "matchmaking", until: { $lt: now } },
      { $set: { until } },
      { upsert: true, returnDocument: "after" }
    );
    if (!lock) return;
  } catch (e) {
    // Held by another request: the lock exists and is not free
    if (isDuplicateKey(e)) return;
    throw e;
  }
  try {
    const waiting = await (await queueCollection())
      .find({ match: null, seenAt: { $gt: now - STALE_MS } })
      .sort({ since: 1 })
      .toArray();
    const paired = new Set<string>();
    for (const a of waiting) {
      if (paired.has(a._id)) continue;
      let best: QueueEntry | null = null;
      for (const b of waiting) {
        if (b._id === a._id || paired.has(b._id)) continue;
        const gap = Math.abs(a.rating - b.rating);
        // The one who waited longer widens the search for both
        if (gap > Math.max(rangeOf(a.since, now), rangeOf(b.since, now))) continue;
        if (best && gap >= Math.abs(a.rating - best.rating)) continue;
        if (await playedTooOften(a._id, b._id, now)) continue;
        best = b;
      }
      if (best && (await startGame(a, best))) {
        paired.add(a._id);
        paired.add(best._id);
      }
    }
  } finally {
    await locks.updateOne({ _id: "matchmaking", until }, { $set: { until: 0 } });
  }
};

const matchedStatus = async (match: Match): Promise<QueueStatus> => {
  const opponent = (await profilesOf([match.opponentId])).get(match.opponentId);
  return {
    status: "matched",
    code: match.code,
    token: match.token,
    you: match.you,
    opponent: opponent
      ? { ...opponent, rating: Math.round(match.opponentRating), games: match.opponentGames }
      : null,
  };
};

/** Starts a search (join), keeps it going and asks for news (poll), or stops it (leave).
 * A player whose ranked game is still on gets it back instead. */
export const queueAction = async (user: StoredUser, body: unknown): Promise<QueueStatus> => {
  const action = (body as { action?: unknown } | null)?.action;
  if (action !== "join" && action !== "poll" && action !== "leave") return fail("bad-request");
  const queue = await queueCollection();
  const now = Date.now();
  let entry = await queue.findOne({ _id: user.id });

  // The game found earlier is over (or gone): that search is done
  if (entry?.match && !(await isRoomPlaying(entry.match.code))) {
    await queue.deleteOne({ _id: user.id, "match.code": entry.match.code });
    entry = null;
  }
  if (entry?.match) return matchedStatus(entry.match);

  if (action === "leave") {
    await queue.deleteOne({ _id: user.id, match: null });
    // Paired just before: the game is on, the player is sent to it
    const after = await queue.findOne({ _id: user.id });
    if (after?.match) return matchedStatus(after.match);
    return { status: "idle", searching: await searchingCount(now) };
  }
  if (!entry && action === "poll") return { status: "idle", searching: await searchingCount(now) };

  const rating = user.ranked ?? newRating();
  try {
    // A new search, or the page saying it is still searching
    await queue.updateOne(
      { _id: user.id, match: null },
      {
        $set: {
          rating: rating.rating,
          games: rating.games,
          seenAt: now,
          expireAt: new Date(now + SEARCH_TTL_MS),
        },
        $setOnInsert: { since: now },
      },
      { upsert: true }
    );
  } catch (e) {
    // Paired meanwhile: the entry has a match and the upsert collided with it
    if (!isDuplicateKey(e)) throw e;
  }
  await pairPlayers(now);

  entry = await queue.findOne({ _id: user.id });
  if (entry?.match) return matchedStatus(entry.match);
  const since = entry?.since ?? now;
  return {
    status: "searching",
    since,
    range: rangeOf(since, Date.now()),
    searching: await searchingCount(now),
  };
};
