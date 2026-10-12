// Shared steps of the account route handlers, server side only.
import { NextResponse, type NextRequest } from "next/server";
import { readJson, respond } from "../lib/api";
import { accountView, fail } from "./accounts";
import {
  createSession,
  endSessions,
  isCrossSite,
  requestUser,
  sessionToken,
  setSessionCookie,
} from "./auth";
import type { StoredUser } from "./store";

type Handler = (req: NextRequest, body: unknown) => unknown;

/** Handler of a request that changes something: same-site only, JSON body */
export const mutation = (handler: Handler) => (req: NextRequest) =>
  respond(async () => {
    if (isCrossSite(req)) fail("forbidden-origin");
    return handler(req, await readJson(req));
  });

/** Same, for the logged-in user only */
export const userMutation = (
  handler: (user: StoredUser, req: NextRequest, body: unknown) => unknown
) => mutation(async (req, body) => handler((await requestUser(req)) ?? fail("unauthorized"), req, body));

/** { account } response that starts a new session (sign-up, log-in), ending the
 * session the browser had until now */
export const startSession = async (req: NextRequest, user: StoredUser) => {
  const previous = sessionToken(req);
  if (previous) await endSessions({ token: previous });
  const res = NextResponse.json({ account: await accountView(user) });
  setSessionCookie(res, req, await createSession(user.id));
  return res;
};
