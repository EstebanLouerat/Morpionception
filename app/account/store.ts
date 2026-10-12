// Accounts and sessions, server side only, saved in MongoDB (see app/lib/mongo.ts).
// Every request reads the database again: several server instances may serve the app
// at once, so nothing about an account is kept in memory between two requests.
import "server-only";
import { database } from "../lib/mongo";
import { emptyStats, type GameRecord, type Stats } from "./protocol";
import { type AvatarId, type ColorId } from "./profile";

/** scrypt hash, with the settings it was made with */
export type StoredPassword = { N: number; r: number; p: number; salt: string; hash: string };

/** A game in a player's history; the opponent is looked up when shown, so a
 * renamed or deleted account is shown as it is now */
export type StoredGameRecord = Omit<GameRecord, "opponent"> & {
  /** Account of the opponent, null for a guest */
  opponentId: string | null;
};

export type StoredUser = {
  id: string;
  pseudo: string;
  /** Pseudo without case and accents, unique */
  pseudoKey: string;
  password: StoredPassword;
  avatar: AvatarId;
  color: ColorId;
  createdAt: number;
  stats: Stats;
  /** Latest games first */
  recent: StoredGameRecord[];
};

export type StoredSession = {
  /** sha256 of the cookie token: the database alone does not give access to accounts */
  _id: string;
  userId: string;
  createdAt: number;
  lastUsed: number;
  /** When MongoDB drops the session (TTL index), 30 days after it was last used */
  expiresAt: Date;
};

/** A wrong password or a sign-up, counted for the rate limits; MongoDB drops it
 * after an hour (TTL index) */
export type StoredAttempt = { key: string; at: Date };

export const usersCollection = async () => (await database()).collection<StoredUser>("users");
export const sessionsCollection = async () =>
  (await database()).collection<StoredSession>("sessions");
export const attemptsCollection = async () =>
  (await database()).collection<StoredAttempt>("attempts");

/** Read without MongoDB's own _id */
export const NO_ID = { projection: { _id: 0 } } as const;

/** Fills what an older account may lack (counters added later would be undefined) */
export const normalizeUser = (user: StoredUser): StoredUser => {
  const stats = emptyStats();
  return {
    ...user,
    stats: {
      ...stats,
      ...user.stats,
      asX: { ...stats.asX, ...user.stats?.asX },
      asO: { ...stats.asO, ...user.stats?.asO },
    },
    recent: Array.isArray(user.recent) ? user.recent : [],
  };
};

const findOne = async (filter: Partial<Pick<StoredUser, "id" | "pseudoKey">>) => {
  const user = await (await usersCollection()).findOne(filter, NO_ID);
  return user && normalizeUser(user);
};

export const findUser = (id: string) => findOne({ id });
export const findUserByKey = (key: string) => findOne({ pseudoKey: key });
