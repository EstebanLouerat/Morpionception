import { NextResponse } from "next/server";
import { deleteAccount } from "../../../account/accounts";
import { clearSessionCookie } from "../../../account/auth";
import { userMutation } from "../../../account/routes";

export const dynamic = "force-dynamic";

/** Delete the account: { password }. Stats and sessions go with it. */
export const POST = userMutation(async (user, req, body) => {
  await deleteAccount(req, user, body);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
});
