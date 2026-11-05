import { accountView, unlinkGoogle } from "../../../../account/accounts";
import { findUser } from "../../../../account/store";
import { userMutation } from "../../../../account/routes";

export const dynamic = "force-dynamic";

/** Unlinks Google from the account (it needs a password to log in): { account } */
export const POST = userMutation(async (user) => {
  await unlinkGoogle(user);
  return { account: await accountView((await findUser(user.id)) ?? user) };
});
