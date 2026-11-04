"use client";

import { IconLink, RoundLink } from "../ui/Button";
import Crown from "../ranked/Crown";
import Avatar from "./Avatar";
import styles from "./Avatar.module.css";
import { useAccount } from "./client";

/** Top bar button to /compte: the avatar once logged in */
const AccountLink = () => {
  const { account } = useAccount();
  return account ? (
    <RoundLink href="/compte" label={`Compte de ${account.pseudo}`} className={styles.crowned}>
      <Avatar avatar={account.avatar} color={account.color} size={46} />
      {account.crown && <Crown place={account.crown} size={24} className={styles.crown} />}
    </RoundLink>
  ) : (
    <IconLink href="/compte" icon="user" label="Compte" />
  );
};

export default AccountLink;
