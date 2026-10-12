import { NextResponse } from "next/server";
import { changePassword } from "../../../account/accounts";
import { createSession, endSessions, setSessionCookie } from "../../../account/auth";
import { userMutation } from "../../../account/routes";

export const dynamic = "force-dynamic";

/** New password: { current, next }. Every session ends, this device gets a new one:
 * a copy of its old cookie stops working too. */
export const POST = userMutation(async (user, req, body) => {
  const changed = await changePassword(req, user, body);
  // Ending the sessions saves the new password with them
  endSessions({ userId: changed.id });
  const res = NextResponse.json({ ok: true });
  setSessionCookie(res, req, createSession(changed.id));
  return res;
});
