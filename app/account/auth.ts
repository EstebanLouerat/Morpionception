// Passwords, sessions, rate limits and request checks for the account API, server side only.
import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { ApiFailure } from "../lib/api";
import { db, findUser, save, type StoredPassword, type StoredUser } from "./store";

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

const dropExpiredSessions = (now: number) => {
  const data = db();
  const kept = data.sessions.filter((s) => now - s.lastUsed < SESSION_TTL_MS);
  const changed = kept.length !== data.sessions.length;
  data.sessions = kept;
  return changed;
};

/** New session for the user, returns the token to put in the cookie */
export const createSession = (userId: string) => {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const data = db();
  dropExpiredSessions(now);
  data.sessions.push({ tokenHash: hashToken(token), userId, createdAt: now, lastUsed: now });
  // Oldest sessions of the user go first beyond the limit
  const own = data.sessions.filter((s) => s.userId === userId);
  if (own.length > MAX_SESSIONS_PER_USER) {
    const dropped = new Set(own.slice(0, own.length - MAX_SESSIONS_PER_USER));
    data.sessions = data.sessions.filter((s) => !dropped.has(s));
  }
  save();
  return token;
};

/** The user of a session token (null when unknown or expired), and whether the
 * session was just extended, in which case the cookie should be sent again */
export const resolveSession = (token: string | null | undefined) => {
  if (!token) return { user: null, renewed: false };
  const now = Date.now();
  const tokenHash = hashToken(token);
  const session = db().sessions.find((s) => s.tokenHash === tokenHash);
  if (!session || now - session.lastUsed >= SESSION_TTL_MS) {
    if (session && dropExpiredSessions(now)) save();
    return { user: null, renewed: false };
  }
  const user = findUser(session.userId);
  if (user && now - session.lastUsed >= SESSION_TOUCH_MS) {
    session.lastUsed = now;
    try {
      save();
      return { user, renewed: true };
    } catch {
      // Not saved: the session still works, it is extended next time
      return { user: findUser(session.userId), renewed: false };
    }
  }
  return { user, renewed: false };
};

/** Ends sessions: one (by token), or all of a user except the one kept */
export const endSessions = (opts: { token: string } | { userId: string; keepToken?: string | null }) => {
  const data = db();
  if ("token" in opts) {
    const drop = hashToken(opts.token);
    data.sessions = data.sessions.filter((s) => s.tokenHash !== drop);
  } else {
    const keep = opts.keepToken ? hashToken(opts.keepToken) : null;
    data.sessions = data.sessions.filter((s) => s.userId !== opts.userId || s.tokenHash === keep);
  }
  save();
};

// --- Requests ---

export const sessionToken = (req: NextRequest) => req.cookies.get(SESSION_COOKIE)?.value ?? null;

/** Logged-in user of the request, if any */
export const requestUser = (req: NextRequest) => resolveSession(sessionToken(req)).user;

/** Account id of the request for the online rooms: a guest when the accounts cannot
 * be read, so playing never depends on them */
export const userIdOf = (req: NextRequest) => {
  try {
    return requestUser(req)?.id ?? null;
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

// --- Rate limits (in memory, reset when the server restarts) ---

/** Address of the client, best effort: MORPION_IP_HEADER names a header set by the
 * proxy (e.g. cf-connecting-ip), else the last X-Forwarded-For entry, the one added
 * by the closest proxy. Next.js only fills X-Forwarded-For from the connection when
 * the request has none: without a proxy in front, a client can pick its own address,
 * so the per-address limits only hold behind a proxy (the per-account and
 * server-wide ones always do). */
export const clientIp = (req: NextRequest) => {
  const named = process.env.MORPION_IP_HEADER;
  const value = named ? req.headers.get(named) : req.headers.get("x-forwarded-for");
  return value?.split(",").at(-1)?.trim() || "local";
};

const LONGEST_WINDOW_MS = 60 * 60_000;
const MAX_LIMIT_KEYS = 50_000;
export const SIGNUP_SERVER_KEY = "signup:server";
const ACCOUNT_KEY_PREFIX = "pwa:";

const limits = globalThis as typeof globalThis & {
  morpionAttempts?: Map<string, number[]>;
  morpionAttemptsSweep?: ReturnType<typeof setInterval>;
};
const attempts = (limits.morpionAttempts ??= new Map<string, number[]>());
if (!limits.morpionAttemptsSweep) {
  limits.morpionAttemptsSweep = setInterval(() => {
    const now = Date.now();
    for (const [key, times] of attempts) {
      if (times.every((t) => now - t >= LONGEST_WINDOW_MS)) attempts.delete(key);
    }
  }, 60_000);
  limits.morpionAttemptsSweep.unref?.();
}

const recent = (key: string, windowMs: number, now: number) =>
  (attempts.get(key) ?? []).filter((t) => now - t < windowMs);

/** Too many attempts under this key during the window */
export const isLimited = (key: string, max: number, windowMs: number) =>
  recent(key, windowMs, Date.now()).length >= max;

export const countAttempt = (key: string) => {
  const now = Date.now();
  attempts.set(key, [...recent(key, LONGEST_WINDOW_MS, now), now]);
  if (attempts.size <= MAX_LIMIT_KEYS) return;
  // Flooded with keys (e.g. made-up addresses): forget the finished counters, then the
  // oldest ones, except those of real accounts and the server-wide one, so a flood
  // never resets the limit of an account under attack
  for (const [k, times] of attempts) {
    if (times.every((t) => now - t >= LONGEST_WINDOW_MS)) attempts.delete(k);
  }
  const accountKeys = new Set(db().users.map((u) => `${ACCOUNT_KEY_PREFIX}${u.pseudoKey}`));
  for (const k of attempts.keys()) {
    if (attempts.size <= MAX_LIMIT_KEYS / 2) break;
    if (k !== SIGNUP_SERVER_KEY && !accountKeys.has(k)) attempts.delete(k);
  }
};

// Wrong passwords allowed during the window: per account (whoever tries), per
// address and account, per address
export const PASSWORD_FAILURES = { account: 30, addressAccount: 10, address: 50, windowMs: 15 * 60_000 };

const failureKeys = (req: NextRequest, key: string) => ({
  account: `${ACCOUNT_KEY_PREFIX}${key}`,
  addressAccount: `pwia:${clientIp(req)}|${key}`,
  address: `pwi:${clientIp(req)}`,
});

/** Too many wrong passwords for this account (key = pseudoKey) or from this address */
export const isPasswordLimited = (req: NextRequest, key: string) => {
  const keys = failureKeys(req, key);
  const { windowMs } = PASSWORD_FAILURES;
  return (
    isLimited(keys.account, PASSWORD_FAILURES.account, windowMs) ||
    isLimited(keys.addressAccount, PASSWORD_FAILURES.addressAccount, windowMs) ||
    isLimited(keys.address, PASSWORD_FAILURES.address, windowMs)
  );
};

export const countPasswordFailure = (req: NextRequest, key: string) =>
  Object.values(failureKeys(req, key)).forEach(countAttempt);

/** Throws too-many-attempts when wrong passwords were typed too often for this user */
export const guardPassword = (req: NextRequest, user: StoredUser) => {
  if (isPasswordLimited(req, user.pseudoKey)) throw new ApiFailure("too-many-attempts", 429);
};
