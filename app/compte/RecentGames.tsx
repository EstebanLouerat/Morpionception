import Link from "next/link";
import styles from "./Compte.module.css";
import ui from "../ui/common.module.css";
import Icon from "../ui/Icon";
import { ButtonLink } from "../ui/Button";
import Avatar from "../account/Avatar";
import type { GameRecord } from "../account/protocol";
import Pager, { usePages } from "../ui/Pager";
import { REASON_LABELS, relativeTime } from "./format";
import { analysisHref } from "../analysis/recent";

// Games per page: the list fits on a phone screen
const PAGE_SIZE = 5;

const RESULT = {
  win: { short: "V", label: "Victoire", className: styles.win },
  draw: { short: "N", label: "Nul", className: styles.draw },
  loss: { short: "D", label: "Défaite", className: styles.loss },
};

const Opponent = ({ opponent }: { opponent: GameRecord["opponent"] }) =>
  opponent.kind === "player" ? (
    <>
      <Avatar avatar={opponent.avatar} color={opponent.color} size={28} />
      <strong className={styles.opponentName}>{opponent.pseudo}</strong>
    </>
  ) : (
    <>
      <span className={styles.anonymous} aria-hidden="true">
        <Icon name="user" size={16} />
      </span>
      <strong className={styles.opponentName}>
        {opponent.kind === "guest" ? "Invité" : "Compte supprimé"}
      </strong>
    </>
  );

/** Latest online games, newest first, page by page */
const RecentGames = ({ games }: { games: GameRecord[] }) => {
  const shown = usePages(games, PAGE_SIZE);
  return (
  <section className={ui.section}>
    <h2 className={ui.sectionTitle}>Dernières parties</h2>
    {games.length === 0 ? (
      <div className={`${ui.card} ${styles.empty}`}>
        <p className={ui.muted}>Aucune partie en ligne pour l&apos;instant.</p>
        <ButtonLink href="/jouer/ami" icon="userPlus" size="sm">
          Jouer avec un ami
        </ButtonLink>
      </div>
    ) : (
      <>
      <ol className={styles.games} start={shown.page * PAGE_SIZE + 1}>
        {shown.items.map((game) => {
          const result = RESULT[game.result];
          return (
            <li key={game.at} className={styles.game}>
              <span className={`${styles.result} ${result.className}`} title={result.label}>
                <span aria-hidden="true">{result.short}</span>
                <span className={styles.srOnly}>{result.label}</span>
              </span>
              <span className={styles.gameMain}>
                <span className={styles.opponent}>
                  <Opponent opponent={game.opponent} />
                </span>
                <small className={ui.muted}>
                  {game.ranked && (
                    <span
                      className={`${styles.rankedTag} ${
                        game.ranked.delta >= 0 ? styles.win : styles.loss
                      }`}
                    >
                      Classé {game.ranked.delta >= 0 ? `+${game.ranked.delta}` : game.ranked.delta}
                    </span>
                  )}
                  {REASON_LABELS[game.reason]} · en {game.side} · {game.boards.mine}–
                  {game.boards.theirs} en morpions
                </small>
              </span>
              <time className={styles.when} dateTime={new Date(game.at).toISOString()}>
                {relativeTime(game.at)}
              </time>
              {game.moves && (
                <Link
                  href={analysisHref(game.moves, game.side)}
                  className={styles.analyse}
                  aria-label="Analyser la partie"
                  title="Analyser la partie"
                >
                  <Icon name="analysis" size={18} />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
      <Pager page={shown.page} pages={shown.pages} onChange={shown.setPage} label="Pages des parties" />
      </>
    )}
  </section>
  );
};

export default RecentGames;
