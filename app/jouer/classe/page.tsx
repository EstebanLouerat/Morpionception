"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./Classe.module.css";
import ui from "../../ui/common.module.css";
import PageShell from "../../ui/PageShell";
import Loader from "../../ui/Loader";
import Dialog from "../../ui/Dialog";
import { Button, ButtonLink, IconButton, IconLink } from "../../ui/Button";
import { refreshAccount, useAccount } from "../../account/client";
import type { AccountView } from "../../account/protocol";
import Crown from "../../ranked/Crown";
import RankCard from "../../ranked/RankCard";
import RankEmblem from "../../ranked/RankEmblem";
import { gameHref, useRankedSearch } from "../../ranked/RankedSearch";
import { formatWait } from "../../ranked/client";
import { MATCHMAKING, PLACEMENT_GAMES, RATING } from "../../ranked/config";
import type { RankedRating } from "../../ranked/protocol";
import { rankOf } from "../../ranked/rating";

/** Ranked page: your rank, the search for an opponent, the rules */
export default function Classe() {
  const account = useAccount();
  const [rules, setRules] = useState(false);
  useEffect(() => {
    refreshAccount();
  }, []);

  return (
    <PageShell
      title="Classé"
      backHref="/jouer"
      actions={
        <>
          <IconButton icon="help" label="Règles" onClick={() => setRules(true)} />
          <IconLink href="/classement" icon="trophy" label="Top 50" />
        </>
      }
    >
      <Rules open={rules} onClose={() => setRules(false)} />
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
        <section className={ui.card}>
          <strong className={styles.lead}>Le mode classé demande un compte</strong>
          <p className={ui.muted}>
            Ton rang et tes points sont liés à ton compte&nbsp;: crée-en un en quelques secondes,
            sans e-mail.
          </p>
          <ButtonLink href={`/compte?retour=${encodeURIComponent("/jouer/classe")}`} icon="user" fullWidth>
            Se connecter ou créer un compte
          </ButtonLink>
        </section>
      )}
      {account.status === "user" && <Ranked account={account.account} />}
    </PageShell>
  );
}

const Ranked = ({ account }: { account: AccountView }) => {
  const router = useRouter();
  const { status, startedAt, error, start, cancel } = useRankedSearch();
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const searching = status?.status === "searching" ? status : null;
  const matched = status?.status === "matched" ? status : null;

  useEffect(() => {
    if (!searching) return;
    const clock = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(clock);
  }, [searching]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setNow(Date.now());
    await action();
    setBusy(false);
  };

  const ranked: RankedRating = account.ranked ?? { rating: RATING.start, games: 0 };
  const rank = rankOf(ranked.rating, ranked.games);
  const record = account.ranked;

  return (
    <>
      <section className={ui.card}>
        <div className={styles.cardHeader}>
          <RankCard rating={ranked.rating} games={ranked.games} large />
          {account.crown && <Crown place={account.crown} size={34} className={styles.cardCrown} />}
        </div>
        {record && record.games > 0 && (
          <p className={ui.muted}>
            {record.wins} V · {record.draws} N · {record.losses} D
            {rank.placed && ` · meilleur : ${record.peak} pts`}
            {record.position !== null && (
              <>
                {" · "}
                <Link href="/classement" className={styles.link}>
                  {record.position === 1 ? "1er" : `${record.position}e`} au classement
                </Link>
              </>
            )}
          </p>
        )}
      </section>

      <section className={`${ui.card} ${styles.search}`}>
        <AnimatePresence mode="wait">
          {matched ? (
            <motion.div key="resume" className={styles.searchBody} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <strong className={styles.lead}>Ta partie classée est en cours</strong>
              <Button icon="play" fullWidth onClick={() => router.push(gameHref(matched.code))}>
                Reprendre la partie
              </Button>
            </motion.div>
          ) : searching ? (
            <motion.div key="searching" className={styles.searchBody} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className={styles.radar} aria-hidden="true">
                <span />
                <span />
                <span />
                <RankEmblem rank={rank} size={48} />
              </div>
              <strong className={styles.lead} role="status">
                Recherche d&apos;un adversaire… {formatWait(now - (startedAt || now))}
              </strong>
              <p className={ui.muted}>
                Écart accepté : ±{searching.range} points
                {searching.searching > 1 && ` · ${searching.searching} joueurs en recherche`}
              </p>
              <p className={styles.hint}>Tu peux quitter cette page : la recherche continue.</p>
              <Button variant="secondary" fullWidth onClick={() => run(cancel)} disabled={busy}>
                Annuler
              </Button>
            </motion.div>
          ) : (
            <motion.div key="idle" className={styles.searchBody} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button icon="play" fullWidth onClick={() => run(start)} disabled={!status || busy}>
                Rechercher une partie
              </Button>
              {status?.status === "idle" && status.searching > 0 && (
                <p className={ui.muted}>
                  {status.searching === 1
                    ? "1 joueur en recherche en ce moment"
                    : `${status.searching} joueurs en recherche en ce moment`}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </section>
    </>
  );
};

/** The rules of ranked play, in a window opened from the top bar */
const Rules = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <Dialog open={open} title="Règles du classé" onClose={onClose}>
    <ul className={styles.rules}>
      <li>
        Adversaire de niveau proche, camp tiré au sort, chrono de {MATCHMAKING.clockSeconds / 60} minutes
        par joueur qui démarre tout de suite.
      </li>
      <li>
        Les {PLACEMENT_GAMES} premières parties placent ton rang&nbsp;: elles rapportent ou coûtent
        beaucoup de points. Ensuite les écarts se resserrent.
      </li>
      <li>Abandonner ou quitter une partie compte comme une défaite.</li>
      <li>
        Un adversaire absent au début peut être laissé après {MATCHMAKING.noShowSeconds} secondes&nbsp;: la
        partie est annulée, sans points perdus.
      </li>
      <li>Les 3 meilleurs joueurs du classement portent une couronne d&apos;or, d&apos;argent ou de bronze.</li>
    </ul>
  </Dialog>
);
