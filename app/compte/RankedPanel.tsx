import styles from "./Compte.module.css";
import ui from "../ui/common.module.css";
import { ButtonLink } from "../ui/Button";
import RankCard from "../ranked/RankCard";
import { PLACEMENT_GAMES } from "../ranked/config";
import type { RankedSummary } from "../ranked/protocol";

/** Rating after each of the latest games, as a small curve */
const RatingCurve = ({ history }: { history: number[] }) => {
  if (history.length < 2) return null;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const span = Math.max(1, max - min);
  const points = history
    .map((r, i) => `${(i / (history.length - 1)) * 100},${36 - ((r - min) / span) * 32}`)
    .join(" ");
  const last = history[history.length - 1];
  const rising = last >= history[0];
  return (
    <svg
      className={styles.curve}
      viewBox="-2 0 104 40"
      preserveAspectRatio="none"
      role="img"
      aria-label={`Points sur les ${history.length} dernières parties : de ${history[0]} à ${last}`}
    >
      <polyline points={points} className={rising ? styles.curveUp : styles.curveDown} />
    </svg>
  );
};

/** Ranked play of the account: rank, results, place, rating curve */
const RankedPanel = ({ ranked }: { ranked: RankedSummary | null }) => (
  <section className={ui.section}>
    <div className={styles.sectionHeader}>
      <h2 className={ui.sectionTitle}>Classé</h2>
      {ranked?.position != null && (
        <span className={styles.sectionNote}>
          {ranked.position === 1 ? "1er" : `${ranked.position}e`} au classement
        </span>
      )}
    </div>
    <div className={ui.card}>
      {ranked ? (
        <>
          <RankCard rating={ranked.rating} games={ranked.games} />
          <p className={ui.muted}>
            {ranked.wins} V · {ranked.draws} N · {ranked.losses} D
            {ranked.games >= PLACEMENT_GAMES && ` · meilleur : ${ranked.peak} points`}
          </p>
          {ranked.games >= PLACEMENT_GAMES && <RatingCurve history={ranked.history} />}
        </>
      ) : (
        <p className={ui.muted}>
          Pas encore de partie classée. Joue {PLACEMENT_GAMES} parties de placement pour découvrir
          ton rang, du Bois au Morpion Mastermind.
        </p>
      )}
      <div className={ui.row}>
        <ButtonLink href="/jouer/classe" icon="trophy" size="sm">
          Jouer en classé
        </ButtonLink>
        <ButtonLink href="/classement" variant="secondary" size="sm">
          Top 50
        </ButtonLink>
      </div>
    </div>
  </section>
);

export default RankedPanel;
