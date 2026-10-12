"use client";

import { IconLink, RoundLink } from "../ui/Button";
import Avatar from "./Avatar";
import { useAccount } from "./client";

/** Top bar button to /compte: the avatar once logged in */
const AccountLink = () => {
  const { account } = useAccount();
  return account ? (
    <RoundLink href="/compte" label={`Compte de ${account.pseudo}`}>
      <Avatar avatar={account.avatar} color={account.color} size={46} />
    </RoundLink>
  ) : (
    <IconLink href="/compte" icon="user" label="Compte" />
  );
};

export default AccountLink;
