import { fail, signup } from "../../../account/accounts";
import { countSignup, isSignupLimited } from "../../../account/auth";
import { mutation, startSession } from "../../../account/routes";

export const dynamic = "force-dynamic";

/** New account: { pseudo, password } → { account }, logged in */
export const POST = mutation(async (req, body) => {
  if (await isSignupLimited(req)) fail("too-many-signups");
  const user = await signup(body);
  await countSignup(req);
  return startSession(req, user);
});
