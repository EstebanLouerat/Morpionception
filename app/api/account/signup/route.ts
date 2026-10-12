import { fail, signup } from "../../../account/accounts";
import { SIGNUP_SERVER_KEY, clientIp, countAttempts, isLimited } from "../../../account/auth";
import { mutation, startSession } from "../../../account/routes";

export const dynamic = "force-dynamic";

// Sign-ups per hour: per address (friends behind one home connection share it)
// and for the whole server, which a made-up address cannot get around
const MAX_SIGNUPS_PER_ADDRESS = 20;
const MAX_SIGNUPS_PER_SERVER = 30;
const SIGNUP_WINDOW_MS = 60 * 60_000;

/** New account: { pseudo, password } → { account }, logged in */
export const POST = mutation(async (req, body) => {
  const addressKey = `signup:${clientIp(req)}`;
  const limited = await Promise.all([
    isLimited(addressKey, MAX_SIGNUPS_PER_ADDRESS, SIGNUP_WINDOW_MS),
    isLimited(SIGNUP_SERVER_KEY, MAX_SIGNUPS_PER_SERVER, SIGNUP_WINDOW_MS),
  ]);
  if (limited.includes(true)) fail("too-many-signups");
  const user = await signup(body);
  await countAttempts(addressKey, SIGNUP_SERVER_KEY);
  return startSession(req, user);
});
