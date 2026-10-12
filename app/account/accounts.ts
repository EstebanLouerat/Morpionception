// Account operations behind the account API, and game results for the stats. Server side only.
import "server-only";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import type { OutcomeReason, Side } from "../game/rules";
import { ApiFailure } from "../lib/api";
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
import { db, findUser, findUserByKey, save, type StoredPassword, type StoredUser } from "./store";

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

/** Profile of an account, null for a guest (or if the accounts cannot be read:
 * online games must keep working without them) */
export const profileOf = (userId: string | null) => {
  if (!userId) return null;
  try {
    const user = findUser(userId);
    return user ? publicProfile(user) : null;
  } catch {
    return null;
  }
};

const opponentOf = (opponentId: string | null): GameRecord["opponent"] => {
  if (!opponentId) return { kind: "guest" };
  const profile = profileOf(opponentId);
  return profile ? { kind: "player", ...profile } : { kind: "deleted" };
};

export const accountView = (user: StoredUser): AccountView => ({
  ...publicProfile(user),
  id: user.id,
  createdAt: user.createdAt,
  stats: user.stats,
  recent: user.recent.map(({ opponentId, ...game }) => ({ ...game, opponent: opponentOf(opponentId) })),
});

/** Same password hash (compared by value: the data may have been reloaded from disk) */
const samePassword = (a: StoredPassword, b: StoredPassword) => a.hash === b.hash && a.salt === b.salt;

const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];

const validPseudo = (raw: unknown) => {
  const check = checkPseudo(raw);
  return check.ok ? check.pseudo : fail("invalid-pseudo");
};

const pseudoTakenBy = (pseudo: string, except?: string) => {
  const user = findUserByKey(pseudoKey(pseudo));
  return !!user && user.id !== except;
};

export const signup = async (body: unknown) => {
  const { pseudo: rawPseudo, password } = (body ?? {}) as Record<string, unknown>;
  const pseudo = validPseudo(rawPseudo);
  if (checkPassword(password)) fail("invalid-password");
  if (db().users.length >= maxAccounts()) fail("accounts-full");
  if (pseudoTakenBy(pseudo)) fail("pseudo-taken");
  const hashed = await hashPassword(password as string);
  // Checked again: another sign-up may have taken the pseudo while hashing
  if (pseudoTakenBy(pseudo)) fail("pseudo-taken");
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
  db().users.push(user);
  save();
  return user;
};

/** The user with these credentials, null when they do not match */
export const login = async (req: NextRequest, body: unknown) => {
  const { pseudo, password } = (body ?? {}) as Record<string, unknown>;
  if (typeof pseudo !== "string" || typeof password !== "string") return fail("bad-request");
  // A pseudo no account can have: no need to check anything
  if (!isPlausiblePseudo(pseudo)) return null;
  const key = pseudoKey(pseudo);
  if (isPasswordLimited(req, key)) fail("too-many-attempts");
  const user = findUserByKey(key);
  if (!user) {
    await burnPasswordCheck(password);
    countPasswordFailure(req, key);
    return null;
  }
  const checked = user.password;
  if (!(await verifyPassword(password, checked))) {
    countPasswordFailure(req, key);
    return null;
  }
  // Deleted or password changed while checking: the old password no longer opens it
  const current = findUser(user.id);
  if (!current || !samePassword(current.password, checked)) return null;
  if (isOutdatedHash(checked)) {
    const rehashed = await hashPassword(password);
    const now = findUser(user.id);
    if (!now || !samePassword(now.password, checked)) return null;
    now.password = rehashed;
    save();
    return now;
  }
  return current;
};

/** Checks the password of a logged-in user (counted like log-in failures) and
 * returns the user as they are once checked */
const confirmPassword = async (req: NextRequest, user: StoredUser, password: unknown) => {
  guardPassword(req, user);
  const checked = user.password;
  if (typeof password !== "string" || !(await verifyPassword(password, checked))) {
    countPasswordFailure(req, user.pseudoKey);
    fail("bad-credentials");
  }
  const current = findUser(user.id);
  if (!current) return fail("unauthorized");
  if (!samePassword(current.password, checked)) return fail("bad-credentials");
  return current;
};

export const updateProfile = (user: StoredUser, body: unknown) => {
  const { pseudo, avatar, color } = (body ?? {}) as Record<string, unknown>;
  if (pseudo === undefined && avatar === undefined && color === undefined) fail("bad-request");
  if (avatar !== undefined && !isAvatarId(avatar)) fail("bad-request");
  if (color !== undefined && !isColorId(color)) fail("bad-request");
  if (pseudo !== undefined) {
    const next = validPseudo(pseudo);
    if (pseudoTakenBy(next, user.id)) fail("pseudo-taken");
    user.pseudo = next;
    user.pseudoKey = pseudoKey(next);
  }
  if (isAvatarId(avatar)) user.avatar = avatar;
  if (isColorId(color)) user.color = color;
  save();
  return user;
};

/** New password; returns the user so the caller can end their other sessions in
 * the same step */
export const changePassword = async (req: NextRequest, user: StoredUser, body: unknown) => {
  const { current, next } = (body ?? {}) as Record<string, unknown>;
  if (checkPassword(next)) fail("invalid-password");
  const checked = (await confirmPassword(req, user, current)).password;
  const hashed = await hashPassword(next as string);
  // Looked up again after the hash: changed or deleted meanwhile?
  const now = findUser(user.id) ?? fail("unauthorized");
  if (!samePassword(now.password, checked)) fail("bad-credentials");
  now.password = hashed;
  return now;
};

export const deleteAccount = async (req: NextRequest, user: StoredUser, body: unknown) => {
  const confirmed = await confirmPassword(req, user, (body as { password?: unknown } | null)?.password);
  const data = db();
  data.users = data.users.filter((u) => u.id !== confirmed.id);
  data.sessions = data.sessions.filter((s) => s.userId !== confirmed.id);
  save();
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
export const recordGame = (game: FinishedGame) => {
  const sides: Side[] = ["X", "O"];
  const users = { X: findAccount(game.players.X), O: findAccount(game.players.O) };
  // A player against their own account (two devices) does not count
  if (users.X && users.X === users.O) return false;
  const at = Date.now();
  let changed = false;

  for (const side of sides) {
    const user = users[side];
    if (!user) continue;
    const other: Side = side === "X" ? "O" : "X";
    const result: GameResult = !game.winner ? "draw" : game.winner === side ? "win" : "loss";
    const stats = user.stats;
    const asSide = side === "X" ? stats.asX : stats.asO;

    stats.played++;
    asSide.played++;
    stats.boardsWon += game.boards[side];
    if (result === "win") {
      stats.wins++;
      asSide.wins++;
      stats.streak++;
      stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
    } else if (result === "loss") {
      stats.losses++;
      stats.streak = 0;
    } else {
      stats.draws++;
      stats.streak = 0;
    }

    user.recent = [
      {
        at,
        result,
        reason: game.reason,
        side,
        opponentId: users[other]?.id ?? null,
        boards: { mine: game.boards[side], theirs: game.boards[other] },
      },
      ...user.recent,
    ].slice(0, MAX_RECENT_GAMES);
    changed = true;
  }
  if (changed) save();
  return true;
};

const findAccount = (userId: string | null) => (userId ? findUser(userId) : null);
