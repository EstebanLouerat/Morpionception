import { NextResponse, type NextRequest } from "next/server";
import { ApiFailure } from "../../../../lib/api";
import { googleSignIn, linkGoogle } from "../../../../account/accounts";
import {
  countSignup,
  createSession,
  endSessions,
  isSignupLimited,
  requestUser,
  sessionToken,
  setSessionCookie,
} from "../../../../account/auth";
import { clearFlowCookie, finishGoogle, publicOrigin, readFlow } from "../../../../account/google";
import { findUserByGoogle } from "../../../../account/store";

export const dynamic = "force-dynamic";

// What the account page says after the round trip (?google=…)
const ERRORS: Record<string, string> = {
  "google-taken": "deja-lie",
  "too-many-signups": "trop",
  "accounts-full": "plein",
};

/** Google sends the browser back here: log in (or sign up), or link the account */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const origin = publicOrigin(req);
  const flow = readFlow(req);
  const go = (path: string) => {
    const res = NextResponse.redirect(origin + path);
    clearFlowCookie(res);
    return res;
  };
  const back = flow?.mode === "link" ? "/compte/profil?onglet=security" : "/compte";
  const withNote = (path: string, note: string) => `${path}${path.includes("?") ? "&" : "?"}google=${note}`;

  if (!flow) return go("/compte?google=echec");
  // Closed or refused on Google's page
  if (params.get("error")) return go(withNote(back, "annule"));
  try {
    const identity = await finishGoogle(req, flow, params.get("code"), params.get("state"));
    if (!identity) return go(withNote(back, "echec"));

    if (flow.mode === "link") {
      const user = await requestUser(req);
      if (!user) return go("/compte?google=echec");
      await linkGoogle(user, identity.sub);
      return go(withNote(back, "lie"));
    }

    // A new account counts against the sign-up limits; a known one just logs in
    const known = await findUserByGoogle(identity.sub);
    if (!known && (await isSignupLimited(req))) return go("/compte?google=trop");
    const { user, created } = known
      ? { user: known, created: false }
      : await googleSignIn(identity.sub, identity.name);
    if (created) await countSignup(req);
    const previous = sessionToken(req);
    if (previous) await endSessions({ token: previous });
    // A new player first sees their account (pseudo picked from the Google name)
    const res = go(created ? "/compte?google=bienvenue" : flow.back ?? "/compte");
    setSessionCookie(res, req, await createSession(user.id));
    return res;
  } catch (e) {
    if (e instanceof ApiFailure) return go(withNote(back, ERRORS[e.reason] ?? "echec"));
    console.error("Connexion Google impossible", e);
    return go(withNote(back, "echec"));
  }
}
