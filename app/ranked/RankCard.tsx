import type { CSSProperties } from "react";
import styles from "./Ranked.module.css";
import RankEmblem from "./RankEmblem";
import { PLACEMENT_GAMES } from "./config";
import { rankOf } from "./rating";

type RankCardProps = {
  rating: number;
  games: number;
  /** Bigger emblem, for the ranked page */
  large?: boolean;
};

/** A player's rank: emblem, tier and division, points, and the way to the next step */
const RankCard = ({ rating, games, large = false }: RankCardProps) => {
  const rank = rankOf(rating, games);
  const size = large ? 96 : 72;
  if (!rank.placed) {
    const done = PLACEMENT_GAMES - rank.placementLeft;
    return (
      <div className={styles.rankCard}>
        <RankEmblem rank={rank} size={size} />
        <div className={styles.rankInfo}>
          <strong className={styles.rankLabel}>Placement</strong>
          <span className={styles.rankPoints}>
            {done} / {PLACEMENT_GAMES} parties
          </span>
          <div className={styles.progress} aria-hidden="true">
            <span style={{ width: `${(done / PLACEMENT_GAMES) * 100}%` }} />
          </div>
          <small className={styles.rankHint}>
            Ton rang sera révélé après {PLACEMENT_GAMES} parties classées.
          </small>
        </div>
      </div>
    );
  }
  const shown = Math.round(rating);
  return (
    <div className={styles.rankCard}>
      <RankEmblem rank={rank} size={size} />
      <div className={styles.rankInfo}>
        <strong className={styles.rankLabel}>
          <span
            className={styles.tierName}
            style={{ "--tier": rank.tier.color, "--tier-dark": rank.tier.dark } as CSSProperties}
          >
            {rank.label}
          </span>
        </strong>
        <span className={styles.rankPoints}>{shown} points</span>
        {rank.to !== null ? (
          <>
            <div
              className={styles.progress}
              role="progressbar"
              aria-valuemin={rank.from}
              aria-valuemax={rank.to}
              aria-valuenow={shown}
              aria-label="Progression vers la division suivante"
            >
              <span
                style={{ width: `${rank.progress * 100}%`, background: rank.tier.color }}
              />
            </div>
            <small className={styles.rankHint}>
              {rank.to - shown} points avant {rankOf(rank.to, games).label}
            </small>
          </>
        ) : (
          <small className={styles.rankHint}>Le sommet du classement !</small>
        )}
      </div>
    </div>
  );
};

export default RankCard;
