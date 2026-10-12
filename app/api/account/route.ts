import { NextResponse, type NextRequest } from "next/server";
import { accountView, updateProfile } from "../../account/accounts";
import { resolveSession, sessionToken, setSessionCookie } from "../../account/auth";
import { userMutation } from "../../account/routes";
import { respond } from "../../lib/api";

export const dynamic = "force-dynamic";

/** The logged-in account: { account } (null for a guest) */
export function GET(req: NextRequest) {
  return respond(() => {
    const token = sessionToken(req);
    const { user, renewed } = resolveSession(token);
    const res = NextResponse.json({ account: user && accountView(user) });
    // An active player stays logged in: the cookie lasts 30 days from the last visit
    if (user && renewed && token) setSessionCookie(res, req, token);
    return res;
  });
}

/** Profile change: { pseudo?, avatar?, color? } → { account } */
export const PATCH = userMutation((user, _req, body) => ({
  account: accountView(updateProfile(user, body)),
}));
