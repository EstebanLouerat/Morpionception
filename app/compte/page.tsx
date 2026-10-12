"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./Compte.module.css";
import ui from "../ui/common.module.css";
import PageShell from "../ui/PageShell";
import Icon from "../ui/Icon";
import Loader from "../ui/Loader";
import { Button, ButtonLink } from "../ui/Button";
import Avatar from "../account/Avatar";
import { logout, refreshAccount, safeReturnPath, useAccount } from "../account/client";
import type { AccountView } from "../account/protocol";
import AuthForm from "./AuthForm";
import StatsPanel from "./StatsPanel";
import RecentGames from "./RecentGames";
import { monthYear } from "./format";

// /compte?retour=/jouer/ami%3Fcode%3DABC123 goes back there once logged in
export default function Compte() {
  const router = useRouter();
  const account = useAccount();
  const [returnTo] = useState(() =>
    safeReturnPath(new URLSearchParams(window.location.search).get("retour"))
  );

  return (
    <PageShell title="Compte" backHref={returnTo ?? "/"}>
      {account.status === "loading" && <Loader label="Chargement du compte…" />}
      {account.status === "error" && (
        <div className={ui.card}>
          <p>Impossible de joindre le serveur pour charger ton compte.</p>
          <Button variant="secondary" onClick={() => refreshAccount()}>
            Réessayer
          </Button>
        </div>
      )}
      {account.status === "guest" && (
        <>
          <section className={ui.card}>
            <div className={styles.profile}>
              <span className={styles.guestAvatar}>
                <Icon name="user" size={40} />
              </span>
              <div>
                <strong className={styles.name}>Invité</strong>
                <p className={ui.muted}>
                  Crée un compte pour garder tes statistiques en ligne et choisir ton pseudo et
                  ton avatar. Amis et parties classées arrivent bientôt.
                </p>
              </div>
            </div>
          </section>
          <AuthForm onDone={() => returnTo && router.replace(returnTo)} />
        </>
      )}
      {account.status === "user" && <UserAccount account={account.account} />}
    </PageShell>
  );
}

const UserAccount = ({ account }: { account: AccountView }) => {
  const [leaving, setLeaving] = useState(false);
  return (
    <>
      <section className={ui.card}>
        <div className={styles.profile}>
          <Avatar avatar={account.avatar} color={account.color} size={72} />
          <div className={styles.identity}>
            <strong className={styles.name}>{account.pseudo}</strong>
            <span className={ui.muted}>Membre depuis {monthYear(account.createdAt)}</span>
          </div>
        </div>
        <div className={ui.row}>
          <ButtonLink href="/compte/profil" icon="edit" variant="secondary" size="sm">
            Modifier le profil
          </ButtonLink>
          <Button
            variant="secondary"
            size="sm"
            icon="logout"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true);
              const res = await logout();
              if (!res.ok) setLeaving(false);
            }}
          >
            Se déconnecter
          </Button>
        </div>
      </section>
      <StatsPanel stats={account.stats} />
      <RecentGames games={account.recent} />
    </>
  );
};
