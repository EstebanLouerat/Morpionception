import styles from "./Compte.module.css";
import ui from "../ui/common.module.css";
import Badge from "../ui/Badge";
import type { Stats } from "../account/protocol";
import { percent, plural } from "./format";

/** Online games of the player: totals, results bar, side by side detail */
const StatsPanel = ({ stats }: { stats: Stats }) => {
  const { played, wins, draws, losses } = stats;
  const tiles = [
    { label: "Parties", value: String(played) },
    { label: "Victoires", value: String(wins) },
    { label: "% de victoires", value: percent(wins, played) },
    { label: "Meilleure série", value: played ? String(stats.bestStreak) : "—" },
  ];
  const details = [
    `En X : ${percent(stats.asX.wins, stats.asX.played)}`,
    `En O : ${percent(stats.asO.wins, stats.asO.played)}`,
    plural(stats.boardsWon, "morpion gagné", "morpions gagnés"),
  ];

  return (
    <section className={ui.section}>
      <div className={styles.sectionHeader}>
        <h2 className={ui.sectionTitle}>Statistiques</h2>
        <span className={styles.sectionNote}>Parties en ligne avec un ami</span>
      </div>
      <div className={styles.stats}>
        {tiles.map((t) => (
          <div key={t.label} className={styles.stat}>
            <span className={styles.statValue}>{t.value}</span>
            <span className={styles.statLabel}>{t.label}</span>
          </div>
        ))}
      </div>
      {played > 0 && (
        <div className={ui.card}>
          <div
            className={styles.resultsBar}
            role="img"
            aria-label={`${wins} victoires, ${draws} nuls, ${losses} défaites`}
          >
            {wins > 0 && <span className={styles.barWin} style={{ flexGrow: wins }} />}
            {draws > 0 && <span className={styles.barDraw} style={{ flexGrow: draws }} />}
            {losses > 0 && <span className={styles.barLoss} style={{ flexGrow: losses }} />}
          </div>
          <p className={styles.legend} aria-hidden="true">
            <span className={styles.win}>{plural(wins, "victoire", "victoires")}</span> ·{" "}
            <span className={styles.draw}>{plural(draws, "nul", "nuls")}</span> ·{" "}
            <span className={styles.loss}>{plural(losses, "défaite", "défaites")}</span>
          </p>
          <p className={ui.muted}>
            {details.join(" · ")}
            {stats.streak > 1 && ` · série en cours : ${stats.streak}`}
          </p>
        </div>
      )}
      <p className={styles.soon}>
        <span>Classement et parties classées</span>
        <Badge />
      </p>
    </section>
  );
};

export default StatsPanel;
