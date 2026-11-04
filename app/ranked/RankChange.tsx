"use client";

import { CSSProperties, useEffect, useState } from "react";
import { AnimatePresence, animate, motion } from "framer-motion";
import confetti from "canvas-confetti";
import styles from "./Ranked.module.css";
import RankEmblem from "./RankEmblem";
import { PLACEMENT_GAMES } from "./config";
import type { RatingChange } from "./protocol";
import { rankChange, rankOf, type Rank, type RankChangeKind } from "./rating";
import { playFx } from "../audio/engine";

// Counting the points, then the new rank shows up
const COUNT_S = 1.3;
const REVEAL_DELAY_MS = 1500;

const BANNERS: Record<RankChangeKind, string> = {
  placement: "Classement révélé !",
  promotion: "Promotion !",
  up: "Division supérieure !",
  down: "Division inférieure…",
  demotion: "Rétrogradation…",
  same: "",
};

const burst = (rank: Rank, big: boolean) => {
  const colors = [rank.tier.color, rank.tier.dark, "#ffffff"];
  // Above the end of game modal
  const shot = (angle: number, x: number) =>
    confetti({
      particleCount: big ? 90 : 45,
      angle,
      spread: big ? 75 : 55,
      startVelocity: big ? 55 : 40,
      origin: { x, y: 0.55 },
      colors,
      zIndex: 3000,
    });
  shot(60, 0.15);
  shot(120, 0.85);
  if (big) setTimeout(() => shot(90, 0.5), 250);
};

/** Points won or lost in a ranked game, then the new rank: a burst of light for a
 * promotion, a crack and a fall for a demotion, a spin for the end of the placement */
const RankChange = ({ change }: { change: RatingChange }) => {
  const before = rankOf(change.before, change.gamesBefore);
  const after = rankOf(change.after, change.gamesAfter);
  const kind = rankChange(before, after);
  const delta = Math.round(change.after) - Math.round(change.before);
  const placing = !after.placed;
  const goingUp = kind === "placement" || kind === "promotion" || kind === "up";
  const goingDown = kind === "down" || kind === "demotion";
  const mastermind = after.tier.id === "mastermind" && after.placed && before.tier.id !== "mastermind";

  const [points, setPoints] = useState(Math.round(change.before));
  const [revealed, setRevealed] = useState(kind === "same");
  const shown = revealed ? after : before;

  // The points count up (or down)
  useEffect(() => {
    let lastTick = 0;
    const controls = animate(Math.round(change.before), Math.round(change.after), {
      duration: COUNT_S,
      ease: "easeOut",
      onUpdate: (value) => {
        setPoints(Math.round(value));
        const now = performance.now();
        if (!placing && now - lastTick > 90) {
          lastTick = now;
          playFx("pointsTick");
        }
      },
    });
    return () => controls.stop();
  }, [change.before, change.after, placing]);

  // Then the new rank
  useEffect(() => {
    if (kind === "same") return;
    const timer = setTimeout(() => {
      setRevealed(true);
      if (goingUp) {
        playFx("rankUp");
        burst(after, kind !== "up" || mastermind);
      } else playFx("rankDown");
    }, REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
    // after is derived from change: the effect runs once per change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [change, kind]);

  // The bar fills to the end (or empties) before the rank changes
  const progress = placing
    ? (Math.min(PLACEMENT_GAMES, change.gamesAfter) / PLACEMENT_GAMES) * 100
    : revealed
    ? after.progress * 100
    : kind === "same"
    ? after.progress * 100
    : goingUp
    ? 100
    : 0;

  const tierStyle = { "--tier": shown.tier.color, "--tier-dark": shown.tier.dark } as CSSProperties;

  return (
    <div
      className={`${styles.change} ${revealed && goingUp ? styles.changeUp : ""} ${
        revealed && goingDown ? styles.changeDown : ""
      }`}
      style={tierStyle}
    >
      <div className={styles.stage}>
        {/* Light behind a new rank */}
        <AnimatePresence>
          {revealed && goingUp && (
            <motion.div
              className={styles.rays}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${shown.placed}-${shown.step}`}
            className={styles.stageEmblem}
            initial={
              kind === "placement" && revealed
                ? { rotateY: 900, scale: 0.4, opacity: 0 }
                : goingUp && revealed
                ? { scale: 0, rotate: -25, opacity: 0 }
                : goingDown && revealed
                ? { y: -60, opacity: 0, filter: "grayscale(1)" }
                : { scale: 0.8, opacity: 0 }
            }
            animate={{ scale: 1, rotate: 0, rotateY: 0, y: 0, opacity: 1, filter: "grayscale(0)" }}
            exit={
              goingDown
                ? { x: [0, -8, 8, -6, 6, 0], y: 70, rotate: 18, opacity: 0, transition: { duration: 0.6 } }
                : { scale: 1.4, opacity: 0, transition: { duration: 0.25 } }
            }
            transition={
              kind === "placement"
                ? { duration: 1.1, ease: "easeOut" }
                : { type: "spring", stiffness: 260, damping: 14 }
            }
          >
            <RankEmblem rank={shown} size={104} title={shown.placed ? shown.label : "Placement"} />
            {/* Cracks on a rank about to be lost */}
            {goingDown && !revealed && (
              <motion.svg
                className={styles.cracks}
                viewBox="0 0 100 100"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: COUNT_S * 0.8 }}
                aria-hidden="true"
              >
                <path d="M52 10 L46 30 L56 42 L44 58 L52 72 L48 90" />
                <path d="M46 30 L32 36 M56 42 L70 40 M44 58 L30 64" />
              </motion.svg>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {revealed && kind !== "same" && (
          <motion.p
            className={`${styles.banner} ${mastermind ? styles.bannerMastermind : ""} ${
              goingDown ? styles.bannerDown : ""
            }`}
            initial={{ scale: 0.4, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 15 }}
          >
            {mastermind ? "MORPION MASTERMIND !" : BANNERS[kind]}
          </motion.p>
        )}
      </AnimatePresence>

      <p className={styles.changeLabel}>
        {shown.placed ? (
          <span className={styles.tierName}>{shown.label}</span>
        ) : (
          `Placement ${Math.min(PLACEMENT_GAMES, change.gamesAfter)} / ${PLACEMENT_GAMES}`
        )}
      </p>
      {placing ? (
        <p className={styles.changePoints}>Ton rang sera révélé après {PLACEMENT_GAMES} parties.</p>
      ) : (
        <p className={styles.changePoints}>
          <strong>{points}</strong> points{" "}
          <motion.span
            className={delta >= 0 ? styles.deltaUp : styles.deltaDown}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 400, damping: 12 }}
          >
            {delta >= 0 ? `+${delta}` : delta}
          </motion.span>
        </p>
      )}
      <div className={styles.progress} aria-hidden="true">
        <motion.span
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: revealed ? 0.6 : COUNT_S, ease: "easeOut" }}
          style={{ background: placing ? undefined : shown.tier.color }}
        />
      </div>
    </div>
  );
};

export default RankChange;
