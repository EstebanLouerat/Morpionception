"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./Compte.module.css";
import ui from "../ui/common.module.css";
import PageShell from "../ui/PageShell";
import Icon from "../ui/Icon";
import Loader from "../ui/Loader";
import { Button, IconButton, IconLink } from "../ui/Button";
import Tabs from "../ui/Tabs";
import Avatar from "../account/Avatar";
import { logout, refreshAccount, safeReturnPath, useAccount } from "../account/client";
import { ACCOUNT_ERROR_MESSAGES, type AccountView } from "../account/protocol";
import AuthForm from "./AuthForm";
import StatsPanel from "./StatsPanel";
import RankedPanel from "./RankedPanel";
import Crown from "../ranked/Crown";
import RecentGames from "./RecentGames";
import { monthYear } from "./format";

// /compte?retour=/jouer/ami%3Fcode%3DABC123 goes back there once logged in
export default function Compte() {
  const router = useRouter();
  const account = useAccount();
  const params = useSearchParams();
  const [returnTo] = useState(() => safeReturnPath(params.get("retour")));
  // Fresh stats when coming back from a game
  useEffect(() => {
    refreshAccount();
  }, []);

  return (
    <PageShell title="Compte" backHref={returnTo ?? "/"} wide={account.status === "user"}>
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
        <div className={ui.columns}>
          <section className={ui.card}>
            <div className={styles.profile}>
              <span className={styles.guestAvatar}>
                <Icon name="user" size={40} />
              </span>
              <div>
                <strong className={styles.name}>Invité</strong>
                <p className={ui.muted}>
                  Crée un compte pour garder tes statistiques en ligne, jouer en classé et
                  choisir ton pseudo et ton avatar. Les amis arrivent bientôt.
                </p>
              </div>
            </div>
          </section>
          {account.expired && (
            <p className={styles.error} role="alert">
              {ACCOUNT_ERROR_MESSAGES.unauthorized}
            </p>
          )}
          <AuthForm onDone={() => returnTo && router.replace(returnTo)} />
        </div>
      )}
      {account.status === "user" && <UserAccount account={account.account} />}
    </PageShell>
  );
}

const UserAccount = ({ account }: { account: AccountView }) => {
  const [leaving, setLeaving] = useState(false);
  return (
    <>
      <section className={`${ui.card} ${styles.headerCard}`}>
        <div className={styles.profile}>
          <span className={styles.avatarWrap}>
            <Avatar avatar={account.avatar} color={account.color} size={64} />
            {account.crown && <Crown place={account.crown} size={30} className={styles.avatarCrown} />}
          </span>
          <div className={styles.identity}>
            <strong className={styles.name}>{account.pseudo}</strong>
            <span className={ui.muted}>Membre depuis {monthYear(account.createdAt)}</span>
          </div>
          <div className={styles.headerActions}>
            <IconLink href="/compte/profil" icon="edit" label="Modifier le profil" />
            <IconButton
              icon="logout"
              label="Se déconnecter"
              disabled={leaving}
              onClick={async () => {
                setLeaving(true);
                const res = await logout();
                if (!res.ok) setLeaving(false);
              }}
            />
          </div>
        </div>
      </section>
      <Tabs
        label="Ton compte"
        allOnWide
        tabs={[
          { id: "ranked", label: "Classé", content: <RankedPanel ranked={account.ranked} /> },
          { id: "stats", label: "Stats", content: <StatsPanel stats={account.stats} /> },
          { id: "games", label: "Parties", content: <RecentGames games={account.recent} /> },
        ]}
      />
    </>
  );
};
