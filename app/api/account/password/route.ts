import { changePassword } from "../../../account/accounts";
import { endSessions, sessionToken } from "../../../account/auth";
import { userMutation } from "../../../account/routes";

export const dynamic = "force-dynamic";

/** New password: { current, next }. Other devices are logged out. */
export const POST = userMutation(async (user, req, body) => {
  const changed = await changePassword(req, user, body);
  // Saves the new password with the other sessions ended
  endSessions({ userId: changed.id, keepToken: sessionToken(req) });
});
