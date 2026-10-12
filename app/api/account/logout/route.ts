import { NextResponse } from "next/server";
import { clearSessionCookie, endSessions, sessionToken } from "../../../account/auth";
import { mutation } from "../../../account/routes";

export const dynamic = "force-dynamic";

/** Log out: ends this session */
export const POST = mutation((req) => {
  const token = sessionToken(req);
  if (token) endSessions({ token });
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
});
