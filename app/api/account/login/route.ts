import { fail, login } from "../../../account/accounts";
import { mutation, startSession } from "../../../account/routes";

export const dynamic = "force-dynamic";

/** Log in: { pseudo, password } → { account } (wrong passwords are rate limited) */
export const POST = mutation(async (req, body) => {
  const user = await login(req, body);
  return user ? startSession(req, user) : fail("bad-credentials");
});
