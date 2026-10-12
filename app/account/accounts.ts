// Account operations behind the account API, and game results for the stats. Server side only.
import "server-only";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type { OutcomeReason, Side } from "../game/rules";
import { ApiFailure } from "../lib/api";
import { isDuplicateKey } from "../lib/mongo";
import {
  burnPasswordCheck,
  countPasswordFailure,
  guardPassword,
  hashPassword,
  isOutdatedHash,
  isPasswordLimited,
  verifyPassword,
} from "./auth";
import {
  AVATARS,
  AVATAR_COLORS,
  checkPassword,
  checkPseudo,
  isAvatarId,
  isColorId,
  isPlausiblePseudo,
  pseudoKey,
} from "./profile";
import {
  emptyStats,
  type AccountError,
  type AccountView,
  type GameRecord,
  type GameResult,
  type PublicProfile,
} from "./protocol";
import {
  NO_ID,
  findUser,
  findUserByKey,
  normalizeUser,
  sessionsCollection,
  usersCollection,
  type StoredGameRecord,
  type StoredPassword,
  type StoredUser,
} from "./store";

const MAX_RECENT_GAMES = 20;
// Accounts the server accepts in total (MORPION_MAX_ACCOUNTS to change it)
const maxAccounts = () => Number(process.env.MORPION_MAX_ACCOUNTS) || 5000;

const STATUS: Record<AccountError, number> = {
  "bad-request": 400,
  unauthorized: 401,
  "bad-credentials": 401,
  "invalid-pseudo": 400,
  "invalid-password": 400,
  "pseudo-taken": 409,
  "too-many-attempts": 429,
  "too-many-signups": 429,
  "server-busy": 503,
  "accounts-full": 503,
  "storage-unavailable": 503,
  "forbidden-origin": 403,
  network: 503,
};

export const fail = (reason: AccountError): never => {
  throw new ApiFailure(reason, STATUS[reason]);
};

export const publicProfile = (user: StoredUser): PublicProfile => ({
  pseudo: user.pseudo,
  avatar: user.avatar,
  color: user.color,
});

/** Profiles of these accounts by id; deleted accounts are missing */
export const profilesOf = async (ids: (string | null | undefined)[]) => {
  const wanted = [...new Set(ids.filter((id): id is string => !!id))];
  const profiles = new Map<string, PublicProfile>();
  if (!wanted.length) return profiles;
  const found = await (await usersCollection())
    .find({ id: { $in: wanted } }, { projection: { _id: 0, id: 1, pseudo: 1, avatar: 1, color: 1 } })
    .toArray();
  for (const user of found) profiles.set(user.id, publicProfile(user));
  return profiles;
};

export const accountView = async (user: StoredUser): Promise<AccountView> => {
  const opponents = await profilesOf(user.recent.map((game) => game.opponentId));
  const opponentOf = (opponentId: string | null): GameRecord["opponent"] => {
    if (!opponentId) return { kind: "guest" };
    const profile = opponents.get(opponentId);
    return profile ? { kind: "player", ...profile } : { kind: "deleted" };
  };
  return {
    ...publicProfile(user),
    id: user.id,
    createdAt: user.createdAt,
    stats: user.stats,
    recent: user.recent.map(({ opponentId, ...game }) => ({ ...game, opponent: opponentOf(opponentId) })),
  };
};

/** Same password hash (compared by value: the account may have been read again) */
const samePassword = (a: StoredPassword, b: StoredPassword) => a.hash === b.hash && a.salt === b.salt;

/** Replaces the password, only if it is still the one checked (not changed meanwhile);
 * returns whether it was */
const replacePassword = async (id: string, checked: StoredPassword, next: StoredPassword) => {
  const res = await (await usersCollection()).updateOne(
    { id, "password.hash": checked.hash, "password.salt": checked.salt },
    { $set: { password: next } }
  );
  return res.matchedCount === 1;
};

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

const validPseudo = (raw: unknown) => {
  const check = checkPseudo(raw);
  return check.ok ? check.pseudo : fail("invalid-pseudo");
};

const pseudoTakenBy = async (pseudo: string, except?: string) => {
  const user = await findUserByKey(pseudoKey(pseudo));
  return !!user && user.id !== except;
};

export const signup = async (body: unknown) => {
  const { pseudo: rawPseudo, password } = (body ?? {}) as Record<string, unknown>;
  const pseudo = validPseudo(rawPseudo);
  if (checkPassword(password)) fail("invalid-password");
  const users = await usersCollection();
  if ((await users.estimatedDocumentCount()) >= maxAccounts()) fail("accounts-full");
  if (await pseudoTakenBy(pseudo)) fail("pseudo-taken");
  const hashed = await hashPassword(password as string);
  const user: StoredUser = {
    id: randomUUID(),
    pseudo,
    pseudoKey: pseudoKey(pseudo),
    password: hashed,
    avatar: pick(AVATARS).id,
    color: pick(AVATAR_COLORS).id,
    createdAt: Date.now(),
    stats: emptyStats(),
    recent: [],
  };
  try {
    // The unique index refuses a pseudo another sign-up took while hashing
    await users.insertOne({ ...user });
  } catch (e) {
    if (isDuplicateKey(e)) fail("pseudo-taken");
    throw e;
  }
  return user;
};

/** The user with these credentials, null when they do not match */
export const login = async (req: NextRequest, body: unknown) => {
  const { pseudo, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof pseudo !== "string" || typeof password !== "string") return fail("bad-request");
  // A pseudo no account can have: no need to check anything
  if (!isPlausiblePseudo(pseudo)) return null;
  const key = pseudoKey(pseudo);
  if (await isPasswordLimited(req, key)) fail("too-many-attempts");
  const user = await findUserByKey(key);
  if (!user) {
    await burnPasswordCheck(password);
    await countPasswordFailure(req, key);
    return null;
  }
  const checked = user.password;
  if (!(await verifyPassword(password, checked))) {
    await countPasswordFailure(req, key);
    return null;
  }
  // Deleted or password changed while checking: the old password no longer opens it
  const current = await findUser(user.id);
  if (!current || !samePassword(current.password, checked)) return null;
  if (isOutdatedHash(checked)) {
    const rehashed = await hashPassword(password);
    if (!(await replacePassword(user.id, checked, rehashed))) return null;
    return { ...current, password: rehashed };
  }
  return current;
};

/** Checks the password of a logged-in user (counted like log-in failures) and
 * returns the user as they are once checked */
const confirmPassword = async (req: NextRequest, user: StoredUser, password: unknown) => {
  await guardPassword(req, user);
  const checked = user.password;
  if (typeof password !== "string" || !(await verifyPassword(password, checked))) {
    await countPasswordFailure(req, user.pseudoKey);
    fail("bad-credentials");
  }
  const current = await findUser(user.id);
  if (!current) return fail("unauthorized");
  if (!samePassword(current.password, checked)) return fail("bad-credentials");
  return current;
};

export const updateProfile = async (user: StoredUser, body: unknown) => {
  const { pseudo, avatar, color } = (body ?? {}) as Record<string, unknown>;
  if (pseudo === undefined && avatar === undefined && color === undefined) fail("bad-request");
  if (avatar !== undefined && !isAvatarId(avatar)) fail("bad-request");
  if (color !== undefined && !isColorId(color)) fail("bad-request");
  const changes: Partial<StoredUser> = {};
  if (pseudo !== undefined) {
    const next = validPseudo(pseudo);
    if (await pseudoTakenBy(next, user.id)) fail("pseudo-taken");
    changes.pseudo = next;
    changes.pseudoKey = pseudoKey(next);
  }
  if (isAvatarId(avatar)) changes.avatar = avatar;
  if (isColorId(color)) changes.color = color;
  try {
    const updated = await (await usersCollection()).findOneAndUpdate(
      { id: user.id },
      { $set: changes },
      { ...NO_ID, returnDocument: "after" }
    );
    return updated ? normalizeUser(updated) : fail("unauthorized");
  } catch (e) {
    // Another account took the pseudo meanwhile
    if (isDuplicateKey(e)) fail("pseudo-taken");
    throw e;
  }
};

/** New password; returns the user so the caller can end their other sessions */
export const changePassword = async (req: NextRequest, user: StoredUser, body: unknown) => {
  const { current, next } = (body ?? {}) as Record<string, unknown>;
  if (checkPassword(next)) fail("invalid-password");
  const confirmed = await confirmPassword(req, user, current);
  const hashed = await hashPassword(next as string);
  // Changed or deleted while hashing: the password checked no longer applies
  if (!(await replacePassword(confirmed.id, confirmed.password, hashed))) {
    return (await findUser(confirmed.id)) ? fail("bad-credentials") : fail("unauthorized");
  }
  return { ...confirmed, password: hashed };
};

export const deleteAccount = async (req: NextRequest, user: StoredUser, body: unknown) => {
  const confirmed = await confirmPassword(req, user, (body as { password?: unknown } | null)?.password);
  await (await usersCollection()).deleteOne({ id: confirmed.id });
  await (await sessionsCollection()).deleteMany({ userId: confirmed.id });
};

// --- Stats ---

export type FinishedGame = {
  reason: OutcomeReason;
  winner: Side | null;
  /** Account of each side, null for a guest */
  players: Record<Side, string | null>;
  /** Small boards won by each side */
  boards: Record<Side, number>;
};

/** Adds an online game to the stats of the accounts that played it.
 * Returns false when it cannot count (both sides are the same account). */
export const recordGame = async (game: FinishedGame) => {
  const sides: Side[] = ["X", "O"];
  // A player against their own account (two devices) does not count
  if (game.players.X && game.players.X === game.players.O) return false;
  const users = await usersCollection();
  // Deleted accounts count as guests
  const existing = await profilesOf([game.players.X, game.players.O]);
  const accountOf = (side: Side) => {
    const id = game.players[side];
    return id && existing.has(id) ? id : null;
  };
  const at = Date.now();
  const counter = (field: string) => ({ $ifNull: [`$stats.${field}`, 0] });
  const plusOne = (field: string) => ({ $add: [counter(field), 1] });

  await Promise.all(
    sides.map((side) => {
      const id = accountOf(side);
      if (!id) return;
      const other: Side = side === "X" ? "O" : "X";
      const result: GameResult = !game.winner ? "draw" : game.winner === side ? "win" : "loss";
      const record: StoredGameRecord = {
        at,
        result,
        reason: game.reason,
        side,
        opponentId: accountOf(other),
        boards: { mine: game.boards[side], theirs: game.boards[other] },
      };
      const asSide = side === "X" ? "asX" : "asO";
      const ifResult = (wanted: GameResult, field: string) =>
        result === wanted ? plusOne(field) : counter(field);
      // A single update, applied by the database as a whole: two games ending at once
      // both count
      return users.updateOne({ id }, [
        {
          $set: {
            "stats.played": plusOne("played"),
            "stats.wins": ifResult("win", "wins"),
            "stats.losses": ifResult("loss", "losses"),
            "stats.draws": ifResult("draw", "draws"),
            // A loss or a draw ends the series
            "stats.streak": result === "win" ? plusOne("streak") : { $literal: 0 },
            "stats.boardsWon": { $add: [counter("boardsWon"), game.boards[side]] },
            [`stats.${asSide}.played`]: plusOne(`${asSide}.played`),
            [`stats.${asSide}.wins`]: ifResult("win", `${asSide}.wins`),
            recent: {
              $slice: [
                { $concatArrays: [[{ $literal: record }], { $ifNull: ["$recent", []] }] },
                MAX_RECENT_GAMES,
              ],
            },
          },
        },
        { $set: { "stats.bestStreak": { $max: [counter("bestStreak"), "$stats.streak"] } } },
      ]);
    })
  );
  return true;
};
