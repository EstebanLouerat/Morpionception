"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import styles from "./Classe.module.css";
import ui from "../../ui/common.module.css";
import PageShell from "../../ui/PageShell";
import Loader from "../../ui/Loader";
import { Button, ButtonLink, IconLink } from "../../ui/Button";
import { playFx } from "../../audio/engine";
import Avatar from "../../account/Avatar";
import { refreshAccount, useAccount } from "../../account/client";
import { ACCOUNT_ERROR_MESSAGES, type AccountView, type PublicProfile } from "../../account/protocol";
import Crown from "../../ranked/Crown";
import RankCard from "../../ranked/RankCard";
import RankEmblem from "../../ranked/RankEmblem";
import { POLL_MS, queue } from "../../ranked/client";
import { MATCHMAKING, PLACEMENT_GAMES, RATING } from "../../ranked/config";
import type { QueueStatus, RankedRating } from "../../ranked/protocol";
import { rankOf } from "../../ranked/rating";

// The opponent is shown this long before the game opens
const VERSUS_MS = 2200;

const formatWait = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Ranked page: your rank, the search for an opponent, the rules */
export default function Classe() {
  const account = useAccount();
  useEffect(() => {
    refreshAccount();
  }, []);

  return (
    <PageShell
      title="Classé"
      backHref="/jouer"
      actions={<IconLink href="/classement" icon="trophy" label="Top 50" />}
    >
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
  const params = useSearchParams();
  const [autoStart] = useState(() => params.get("recherche") === "1");
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  const searching = status?.status === "searching";
  const matched = status?.status === "matched" ? status : null;
  // Matched while on this page: the opponent is shown, then the game opens
  const [versus, setVersus] = useState(false);
  const searchingRef = useRef(false);
  searchingRef.current = searching;

  const ranked: RankedRating = account.ranked ?? { rating: RATING.start, games: 0 };

  const apply = useCallback((res: Awaited<ReturnType<typeof queue>>, fromSearch: boolean) => {
    if (!res.ok) {
      setError(ACCOUNT_ERROR_MESSAGES[res.error]);
      return;
    }
    setError(null);
    setStatus(res.data);
    // The wait shown counts from the first answer saying "searching" (a search already
    // going on when the page opens included)
    setStartedAt((t) => (res.data.status === "searching" ? t || Date.now() : 0));
    if (res.data.status === "matched" && fromSearch) {
      playFx("matchFound");
      setVersus(true);
    }
  }, []);

  // Where things stand when the page opens: a game on, a search going on, or nothing
  useEffect(() => {
    queue(autoStart ? "join" : "poll").then((res) => apply(res, autoStart));
  }, [autoStart, apply]);

  // While searching: the page says it is still there, and learns when a game is found
  useEffect(() => {
    if (!searching) return;
    const poll = setInterval(() => queue("poll").then((res) => apply(res, true)), POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [searching, apply]);

  // Leaving the page stops the search (a refresh too: the search would go on alone)
  useEffect(() => {
    const leave = () => {
      if (searchingRef.current) void queue("leave");
    };
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, []);

  // The opponent shown, then the game
  useEffect(() => {
    if (!versus || !matched) return;
    const timer = setTimeout(() => router.push(`/game?room=${matched.code}`), VERSUS_MS);
    return () => clearTimeout(timer);
  }, [versus, matched, router]);

  const start = async () => {
    setNow(Date.now());
    apply(await queue("join"), true);
  };
  const cancel = async () => apply(await queue("leave"), true);

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
          {matched && versus ? (
            <Versus key="versus" me={account} mine={ranked} status={matched} />
          ) : matched ? (
            <motion.div key="resume" className={styles.searchBody} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <strong className={styles.lead}>Ta partie classée est en cours</strong>
              <Button icon="play" fullWidth onClick={() => router.push(`/game?room=${matched.code}`)}>
                Reprendre la partie
              </Button>
            </motion.div>
          ) : searching ? (
            <motion.div key="searching" className={styles.searchBody} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className={styles.radar} aria-hidden="true">
                <span />
                <span />
                <span />
                <RankEmblem rank={rank} size={56} />
              </div>
              <strong className={styles.lead} role="status">
                Recherche d&apos;un adversaire… {formatWait(Math.max(0, now - (startedAt || now)))}
              </strong>
              <p className={ui.muted}>
                Écart accepté : ±{status.range} points
                {status.searching > 1 && ` · ${status.searching} joueurs en recherche`}
              </p>
              <Button variant="secondary" fullWidth onClick={cancel}>
                Annuler
              </Button>
            </motion.div>
          ) : (
            <motion.div key="idle" className={styles.searchBody} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button icon="play" fullWidth onClick={start} disabled={!status}>
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

      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>Règles</h2>
        <ul className={`${ui.card} ${styles.rules}`}>
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
      </section>
    </>
  );
};

type VersusProps = {
  me: PublicProfile;
  mine: RankedRating;
  status: Extract<QueueStatus, { status: "matched" }>;
};

/** The two players face to face, just before the game */
const Versus = ({ me, mine, status }: VersusProps) => {
  const opponent = status.opponent;
  const side = (profile: PublicProfile | null, rating: RankedRating | null, from: number) => {
    const rank = rating && rankOf(rating.rating, rating.games);
    return (
      <motion.div
        className={styles.versusPlayer}
        initial={{ x: from, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
      >
        <span className={styles.versusAvatar}>
          {profile?.crown && <Crown place={profile.crown} size={26} className={styles.versusCrown} />}
          {profile ? <Avatar avatar={profile.avatar} color={profile.color} size={64} /> : null}
        </span>
        <strong>{profile?.pseudo ?? "Adversaire"}</strong>
        {rank && (
          <span className={styles.versusRank}>
            <RankEmblem rank={rank} size={28} />
            {rank.placed ? rank.label : "Placement"}
          </span>
        )}
      </motion.div>
    );
  };
  return (
    <motion.div className={styles.versus} initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="status">
      <p className={styles.found}>Adversaire trouvé !</p>
      <div className={styles.versusRow}>
        {side(me, mine, -80)}
        <motion.span
          className={styles.versusVs}
          initial={{ scale: 3, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 300, damping: 12 }}
        >
          VS
        </motion.span>
        {side(opponent, opponent, 80)}
      </div>
      <p className={styles.versusNote}>Tu joues {status.you === "X" ? "X et tu commences" : "O, ton adversaire commence"}.</p>
    </motion.div>
  );
};
