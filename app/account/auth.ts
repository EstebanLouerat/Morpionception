// Passwords, sessions, rate limits and request checks for the account API, server side only.
import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { ApiFailure } from "../lib/api";
import {
  attemptsCollection,
  findUser,
  sessionsCollection,
  type StoredPassword,
  type StoredUser,
} from "./store";

// --- Passwords ---

// 16 MiB of memory and about 50 ms per hash: fine for a small server
const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;
// Hashes running at once, beyond that requests are refused (each one costs CPU and memory)
const MAX_HASHING = 8;
let hashing = 0;

const derive = async (password: string, salt: Buffer, params: { N: number; r: number; p: number }) => {
  if (hashing >= MAX_HASHING) throw new ApiFailure("server-busy", 503);
  hashing++;
  try {
    return await new Promise<Buffer>((resolve, reject) =>
      // Same password typed on another device with accents composed differently
      scrypt(password.normalize("NFC"), salt, KEY_LENGTH, params, (err, key) =>
        err ? reject(err) : resolve(key)
      )
    );
  } finally {
    hashing--;
  }
};

export const hashPassword = async (password: string): Promise<StoredPassword> => {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, SCRYPT);
  return { ...SCRYPT, salt: salt.toString("base64"), hash: hash.toString("base64") };
};

export const verifyPassword = async (password: string, stored: StoredPassword) => {
  const hash = await derive(password, Buffer.from(stored.salt, "base64"), stored);
  const expected = Buffer.from(stored.hash, "base64");
  return expected.length === hash.length && timingSafeEqual(hash, expected);
};

/** The hash was made with older settings and should be made again */
export const isOutdatedHash = (stored: StoredPassword) =>
  stored.N !== SCRYPT.N || stored.r !== SCRYPT.r || stored.p !== SCRYPT.p;

// Checked when the pseudo is unknown, so a log-in takes as long either way. Random
// bytes, not a real hash: nothing to compute first, and no password matches it.
const DUMMY_PASSWORD: StoredPassword = {
  ...SCRYPT,
  salt: randomBytes(16).toString("base64"),
  hash: randomBytes(KEY_LENGTH).toString("base64"),
};
export const burnPasswordCheck = (password: string) => verifyPassword(password, DUMMY_PASSWORD);

// --- Sessions ---

export const SESSION_COOKIE = "morpion_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;
// lastUsed is saved (and the cookie renewed) at most this often, not on every request
const SESSION_TOUCH_MS = 60 * 60_000;
const MAX_SESSIONS_PER_USER = 10;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const expiry = (lastUsed: number) => new Date(lastUsed + SESSION_TTL_MS);

/** New session for the user, returns the token to put in the cookie */
export const createSession = async (userId: string) => {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const sessions = await sessionsCollection();
  await sessions.insertOne({
    _id: hashToken(token),
    userId,
    createdAt: now,
    lastUsed: now,
    expiresAt: expiry(now),
  });
  // Oldest sessions of the user go first beyond the limit
  const dropped = await sessions
    .find({ userId }, { projection: { _id: 1 } })
    .sort({ createdAt: -1 })
    .skip(MAX_SESSIONS_PER_USER)
    .toArray();
  if (dropped.length) await sessions.deleteMany({ _id: { $in: dropped.map((s) => s._id) } });
  return token;
};

/** The user of a session token (null when unknown or expired), and whether the
 * session was just extended, in which case the cookie should be sent again */
export const resolveSession = async (token: string | null | undefined) => {
  if (!token) return { user: null, renewed: false };
  const now = Date.now();
  const sessions = await sessionsCollection();
  const session = await sessions.findOne({ _id: hashToken(token) });
  // Expired sessions are dropped by MongoDB, but not right away
  if (!session || now - session.lastUsed >= SESSION_TTL_MS) return { user: null, renewed: false };
  const user = await findUser(session.userId);
  if (user && now - session.lastUsed >= SESSION_TOUCH_MS) {
    try {
      await sessions.updateOne({ _id: session._id }, { $set: { lastUsed: now, expiresAt: expiry(now) } });
      return { user, renewed: true };
    } catch (e) {
      // Not saved: the session still works, it is extended next time
      console.error("Session non prolongée", e);
    }
  }
  return { user, renewed: false };
};

/** Ends sessions: one (by token), or all of a user except the one kept */
export const endSessions = async (
  opts: { token: string } | { userId: string; keepToken?: string | null }
) => {
  const sessions = await sessionsCollection();
  if ("token" in opts) await sessions.deleteOne({ _id: hashToken(opts.token) });
  else {
    const keep = opts.keepToken ? hashToken(opts.keepToken) : null;
    await sessions.deleteMany(keep ? { userId: opts.userId, _id: { $ne: keep } } : { userId: opts.userId });
  }
};

// --- Requests ---

export const sessionToken = (req: NextRequest) => req.cookies.get(SESSION_COOKIE)?.value ?? null;

/** Logged-in user of the request, if any */
export const requestUser = async (req: NextRequest) => (await resolveSession(sessionToken(req))).user;

/** Account id of the request for the online rooms: a guest when the accounts cannot
 * be read, so playing never depends on them */
export const userIdOf = async (req: NextRequest) => {
  try {
    return (await requestUser(req))?.id ?? null;
  } catch {
    return null;
  }
};

// Secure cookies are only sent over HTTPS: on plain HTTP (a phone on the local
// network in development) the session would never come back.
// MORPION_SECURE_COOKIES=1 forces them, behind a proxy that does not say it is HTTPS.
const isHttps = (req: NextRequest) =>
  process.env.MORPION_SECURE_COOKIES === "1" ||
  req.nextUrl.protocol === "https:" ||
  req.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https";

export const setSessionCookie = (res: NextResponse, req: NextRequest, token: string) => {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps(req),
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
};

export const clearSessionCookie = (res: NextResponse) => {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
};

/** A request sent by a page of another site (CSRF). Browsers say where a request
 * comes from with Sec-Fetch-Site; older ones are checked with Origin, which must match
 * the host asked for or the one a proxy forwarded. Neither header (not a browser):
 * allowed, the SameSite=Lax cookie already keeps it out of cross-site requests. */
export const isCrossSite = (req: NextRequest) => {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";
  const origin = req.headers.get("origin");
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return true;
  }
  return host !== req.headers.get("host") && host !== req.headers.get("x-forwarded-host");
};

// --- Rate limits (saved in MongoDB, so every server instance counts the same attempts) ---

/** Address of the client, best effort: MORPION_IP_HEADER names a header set by the
 * proxy (e.g. cf-connecting-ip), else the last X-Forwarded-For entry, the one added
 * by the closest proxy (on Vercel, the address Vercel saw). Next.js only fills
 * X-Forwarded-For from the connection when the request has none: without a proxy in
 * front, a client can pick its own address, so the per-address limits only hold behind
 * a proxy (the per-account and server-wide ones always do). */
export const clientIp = (req: NextRequest) => {
  const named = process.env.MORPION_IP_HEADER;
  const value = named ? req.headers.get(named) : req.headers.get("x-forwarded-for");
  return value?.split(",").at(-1)?.trim() || "local";
};

export const SIGNUP_SERVER_KEY = "signup:server";

/** Too many attempts under this key during the window (an hour at most: older
 * attempts are dropped) */
export const isLimited = async (key: string, max: number, windowMs: number) => {
  const attempts = await attemptsCollection();
  const count = await attempts.countDocuments(
    { key, at: { $gt: new Date(Date.now() - windowMs) } },
    { limit: max }
  );
  return count >= max;
};

export const countAttempts = async (...keys: string[]) => {
  const at = new Date();
  await (await attemptsCollection()).insertMany(keys.map((key) => ({ key, at })));
};

// Wrong passwords allowed during the window: per account (whoever tries), per
// address and account, per address
export const PASSWORD_FAILURES = { account: 30, addressAccount: 10, address: 50, windowMs: 15 * 60_000 };

const failureKeys = (req: NextRequest, key: string) => ({
  account: `pwa:${key}`,
  addressAccount: `pwia:${clientIp(req)}|${key}`,
  address: `pwi:${clientIp(req)}`,
});

/** Too many wrong passwords for this account (key = pseudoKey) or from this address */
export const isPasswordLimited = async (req: NextRequest, key: string) => {
  const keys = failureKeys(req, key);
  const { windowMs } = PASSWORD_FAILURES;
  const limited = await Promise.all([
    isLimited(keys.account, PASSWORD_FAILURES.account, windowMs),
    isLimited(keys.addressAccount, PASSWORD_FAILURES.addressAccount, windowMs),
    isLimited(keys.address, PASSWORD_FAILURES.address, windowMs),
  ]);
  return limited.includes(true);
};

export const countPasswordFailure = (req: NextRequest, key: string) =>
  countAttempts(...Object.values(failureKeys(req, key)));

/** Throws too-many-attempts when wrong passwords were typed too often for this user */
export const guardPassword = async (req: NextRequest, user: StoredUser) => {
  if (await isPasswordLimited(req, user.pseudoKey)) throw new ApiFailure("too-many-attempts", 429);
};
