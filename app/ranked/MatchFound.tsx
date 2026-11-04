"use client";

import { CSSProperties, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import styles from "./MatchFound.module.css";
import Avatar from "../account/Avatar";
import type { AccountView, PublicProfile } from "../account/protocol";
import Crown from "./Crown";
import RankEmblem from "./RankEmblem";
import { RATING } from "./config";
import type { QueueStatus, RankedRating } from "./protocol";
import { rankOf } from "./rating";

/** The animation plays this long before the game opens */
export const MATCH_FOUND_MS = 2600;

type Matched = Extract<QueueStatus, { status: "matched" }>;

const sideColor = (side: "X" | "O") => (side === "X" ? "var(--primary-x)" : "var(--primary-o)");

/** Opponent found: full screen, the two halves of the screen slam together in each
 * player's color, the players slide in, "VS" crashes down, then the game opens */
const MatchFound = ({ me, status }: { me: AccountView; status: Matched }) => {
  const reduce = useReducedMotion();
  // Side by side on wide screens, one above the other on tall ones
  const [tall, setTall] = useState(() => window.matchMedia("(orientation: portrait)").matches);
  useEffect(() => {
    const query = window.matchMedia("(orientation: portrait)");
    const onChange = () => setTall(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const mine: RankedRating = me.ranked ?? { rating: RATING.start, games: 0 };
  const theirSide = status.you === "X" ? "O" : "X";
  const far = (sign: 1 | -1) => (reduce ? {} : tall ? { y: `${sign * 100}%` } : { x: `${sign * 100}%` });

  const player = (
    profile: PublicProfile | null,
    rating: RankedRating | null,
    side: "X" | "O",
    from: 1 | -1
  ) => {
    const rank = rating && rankOf(rating.rating, rating.games);
    return (
      <motion.div
        className={`${styles.player} ${from === -1 ? styles.first : styles.second}`}
        initial={{ ...far(from), opacity: 0 }}
        animate={{ x: 0, y: 0, opacity: 1 }}
        transition={{ delay: 0.25, type: "spring", stiffness: 260, damping: 22 }}
      >
        <span className={styles.avatar}>
          {profile?.crown && <Crown place={profile.crown} size={34} className={styles.crown} />}
          {profile && <Avatar avatar={profile.avatar} color={profile.color} size={88} />}
          <span className={styles.symbol}>{side}</span>
        </span>
        <strong className={styles.name}>{profile?.pseudo ?? "Adversaire"}</strong>
        {rank && (
          <span className={styles.rank}>
            <RankEmblem rank={rank} size={30} />
            {rank.placed ? rank.label : "Placement"}
          </span>
        )}
      </motion.div>
    );
  };

  return (
    <motion.div
      className={`${styles.overlay} ${tall ? styles.tall : ""}`}
      style={{ "--mine": sideColor(status.you), "--theirs": sideColor(theirSide) } as CSSProperties}
      initial={{ opacity: reduce ? 0 : 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: reduce ? 1 : 1.12 }}
      transition={{ duration: 0.35 }}
      role="alertdialog"
      aria-live="assertive"
      aria-label="Adversaire trouvé"
    >
      {/* The two halves */}
      <motion.div
        className={`${styles.half} ${styles.halfMine}`}
        initial={far(-1)}
        animate={{ x: 0, y: 0 }}
        transition={{ type: "spring", stiffness: 210, damping: 24 }}
      />
      <motion.div
        className={`${styles.half} ${styles.halfTheirs}`}
        initial={far(1)}
        animate={{ x: 0, y: 0 }}
        transition={{ type: "spring", stiffness: 210, damping: 24 }}
      />
      {/* Where they meet: a flash */}
      {!reduce && (
        <motion.div
          className={styles.flash}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.9, 0] }}
          transition={{ delay: 0.62, duration: 0.5 }}
        />
      )}

      <motion.div
        className={styles.stage}
        animate={reduce ? {} : { x: [0, -10, 9, -6, 4, 0], y: [0, 6, -5, 3, -2, 0] }}
        transition={{ delay: 0.62, duration: 0.45 }}
      >
        <motion.p
          className={styles.title}
          initial={{ y: reduce ? 0 : -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 300, damping: 20 }}
        >
          Adversaire trouvé !
        </motion.p>
        <div className={styles.row}>
          {player(me, mine, status.you, -1)}
          <motion.span
            className={styles.vs}
            initial={{ scale: reduce ? 1 : 4, opacity: 0, rotate: reduce ? 0 : -25 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ delay: 0.5, type: "spring", stiffness: 380, damping: 14 }}
          >
            VS
          </motion.span>
          {player(status.opponent, status.opponent, theirSide, 1)}
        </div>
        <motion.p
          className={styles.note}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Tu joues {status.you} · {status.you === "X" ? "tu commences" : "ton adversaire commence"}
        </motion.p>
        {/* Time before the game opens */}
        <motion.span
          className={styles.timer}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: MATCH_FOUND_MS / 1000, ease: "linear" }}
          aria-hidden="true"
        />
      </motion.div>
    </motion.div>
  );
};

export default MatchFound;
