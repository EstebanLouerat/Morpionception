// Log-in with Google (OpenID Connect, authorization code flow with PKCE), server side
// only. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see the README) to offer it.
// Only Google's stable account id ("sub") and the name (for a first pseudo) are read:
// no e-mail is asked for or kept.
import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { isHttps } from "./auth";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
// The round trip through Google must end within this time
const FLOW_TTL_S = 10 * 60;
const FLOW_COOKIE = "morpion_google";
const CALLBACK_PATH = "/api/account/google/callback";

const config = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
};

export const googleEnabled = () => config() !== null;

/** login: log in or sign up; link: add Google to the logged-in account */
export type GoogleMode = "login" | "link";

/** What the browser keeps during the round trip (in an HTTP-only cookie) */
type Flow = { state: string; verifier: string; nonce: string; mode: GoogleMode; back: string | null };

/** The site's address as the browser sees it (Google sends the player back there).
 * MORPION_PUBLIC_URL sets it behind a proxy that hides it. */
export const publicOrigin = (req: NextRequest) => {
  const fixed = process.env.MORPION_PUBLIC_URL;
  if (fixed) return fixed.replace(/\/+$/, "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0].trim() || req.headers.get("host");
  return `${isHttps(req) ? "https" : "http"}://${host ?? req.nextUrl.host}`;
};

const random = () => randomBytes(32).toString("base64url");

/** The Google page to send the player to, and the cookie that remembers the flow */
export const startGoogle = (req: NextRequest, mode: GoogleMode, back: string | null) => {
  const { clientId } = config()!;
  const flow: Flow = { state: random(), verifier: random(), nonce: random(), mode, back };
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: publicOrigin(req) + CALLBACK_PATH,
    response_type: "code",
    // The account id and name only, no e-mail
    scope: "openid profile",
    state: flow.state,
    nonce: flow.nonce,
    code_challenge: createHash("sha256").update(flow.verifier).digest("base64url"),
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return { url: url.toString(), flow };
};

export const setFlowCookie = (res: NextResponse, req: NextRequest, flow: Flow) => {
  res.cookies.set(FLOW_COOKIE, Buffer.from(JSON.stringify(flow)).toString("base64url"), {
    httpOnly: true,
    // Sent back when Google redirects to the site (a top-level navigation)
    sameSite: "lax",
    secure: isHttps(req),
    path: "/api/account/google",
    maxAge: FLOW_TTL_S,
  });
};

export const clearFlowCookie = (res: NextResponse) =>
  res.cookies.set(FLOW_COOKIE, "", { httpOnly: true, path: "/api/account/google", maxAge: 0 });

export const readFlow = (req: NextRequest): Flow | null => {
  try {
    const raw = req.cookies.get(FLOW_COOKIE)?.value;
    const flow = raw && JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return flow && typeof flow.state === "string" && typeof flow.verifier === "string" ? flow : null;
  } catch {
    return null;
  }
};

const sameText = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export type GoogleIdentity = { sub: string; name: string };

/** Google's answer on the callback: the account it vouches for, or null (refused,
 * expired, or not the flow this browser started) */
export const finishGoogle = async (
  req: NextRequest,
  flow: Flow,
  code: string | null,
  state: string | null
): Promise<GoogleIdentity | null> => {
  const settings = config();
  if (!settings || !code || !state || !sameText(state, flow.state)) return null;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      redirect_uri: publicOrigin(req) + CALLBACK_PATH,
      grant_type: "authorization_code",
      code_verifier: flow.verifier,
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const { id_token: idToken } = (await res.json()) as { id_token?: unknown };
  if (typeof idToken !== "string") return null;
  // The token comes straight from Google's token endpoint over HTTPS: its claims are
  // checked, its signature need not be (OpenID Connect Core 3.1.3.7)
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const now = Date.now() / 1000;
  const valid =
    ISSUERS.includes(claims.iss as string) &&
    (claims.aud === settings.clientId ||
      (Array.isArray(claims.aud) && claims.aud.includes(settings.clientId))) &&
    typeof claims.exp === "number" &&
    claims.exp > now &&
    claims.nonce === flow.nonce &&
    typeof claims.sub === "string" &&
    claims.sub.length > 0;
  if (!valid) return null;
  const name = typeof claims.given_name === "string" ? claims.given_name : claims.name;
  return { sub: claims.sub as string, name: typeof name === "string" ? name : "" };
};
