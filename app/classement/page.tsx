"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import styles from "./Classement.module.css";
import ui from "../ui/common.module.css";
import Pager, { usePages } from "../ui/Pager";
import PageShell from "../ui/PageShell";
import Loader from "../ui/Loader";
import { Button, ButtonLink } from "../ui/Button";
import Avatar from "../account/Avatar";
import { useAccount } from "../account/client";
import { ACCOUNT_ERROR_MESSAGES } from "../account/protocol";
import Crown from "../ranked/Crown";
import RankEmblem from "../ranked/RankEmblem";
import { fetchLeaderboard } from "../ranked/client";
import { LEADERBOARD, PLACEMENT_GAMES } from "../ranked/config";
import type { Leaderboard, LeaderboardEntry } from "../ranked/protocol";
import { rankOf } from "../ranked/rating";

const place = (n: number) => (n === 1 ? "1er" : `${n}e`);

// Rows of the list shown per page: as many as the screen holds below its top (no
// scrolling), measured on the page
const ROW_HEIGHT = 57;
// The pager under the list, and the bottom margin of the page
const BELOW_LIST = 76;

/** Where an element's top would be without FitToScreen's scale, in page pixels. The
 * scaled content shrinks toward its own top left corner, so only the part below that
 * corner is scaled. */
const unscaledTop = (el: HTMLElement) => {
  const top = el.getBoundingClientRect().top;
  const fitted = el.closest<HTMLElement>("[data-scale]");
  const scale = Number(fitted?.dataset.scale ?? 1);
  if (!fitted || scale === 1) return { top, scale: 1 };
  const origin = fitted.getBoundingClientRect().top;
  return { top: origin + (top - origin) / scale, scale };
};

const useRowsThatFit = (list: React.RefObject<HTMLDivElement | null>, ready: boolean) => {
  const [rows, setRows] = useState(5);
  useLayoutEffect(() => {
    if (!ready) return;
    const measure = () => {
      const el = list.current;
      if (!el) return;
      const { top, scale } = unscaledTop(el);
      const row = (el.querySelector("li")?.getBoundingClientRect().height ?? ROW_HEIGHT * scale) / scale;
      setRows(Math.max(3, Math.floor((window.innerHeight - top - BELOW_LIST) / row)));
    };
    measure();
    // Again when the window changes, or when the page was scaled to fit after loading
    window.addEventListener("resize", measure);
    window.addEventListener("fitscale", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("fitscale", measure);
    };
  }, [list, ready]);
  return rows;
};

/** The best ranked players: a podium for the crowned three, then the list */
export default function Classement() {
  const account = useAccount();
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    fetchLeaderboard().then((res) => {
      if (res.ok) setBoard(res.data);
      else setError(ACCOUNT_ERROR_MESSAGES[res.error]);
    });
  };
  useEffect(load, []);

  const me = account.status === "user" ? account.account : null;
  const players = board?.players ?? [];
  const podium = players.slice(0, 3);
  const rest = players.slice(3);
  const meListed = !!me && players.some((p) => p.id === me.id);
  const listRef = useRef<HTMLDivElement>(null);
  const rows = useRowsThatFit(listRef, rest.length > 0);
  const shown = usePages(rest, rows);
  // Opens on the page with your place
  const myIndex = rest.findIndex((p) => p.id === me?.id);
  const { setPage } = shown;
  useEffect(() => {
    if (myIndex >= 0) setPage(Math.floor(myIndex / rows));
  }, [myIndex, rows, setPage]);

  return (
    <PageShell title="Classement" backHref="/" wide>
      <p className={ui.muted}>
        Top {LEADERBOARD.size} des joueurs classés
        {board && board.activeDays > 0 && `, actifs ces ${board.activeDays} derniers jours`}.
      </p>

      {error && (
        <div className={ui.card}>
          <p>{error}</p>
          <Button variant="secondary" onClick={load}>
            Réessayer
          </Button>
        </div>
      )}
      {!board && !error && <Loader label="Chargement du classement…" />}

      {board && players.length === 0 && (
        <div className={`${ui.card} ${styles.empty}`}>
          <strong>Personne n&apos;est encore classé</strong>
          <p className={ui.muted}>
            Joue tes {PLACEMENT_GAMES} parties de placement et prends la première place !
          </p>
          <ButtonLink href="/jouer/classe" icon="trophy">
            Jouer en classé
          </ButtonLink>
        </div>
      )}

      {podium.length > 0 && (
      <div className={styles.layout}>
        <ol className={styles.podium} aria-label="Podium">
          {/* Second, first, third: the winner in the middle */}
          {[podium[1], podium[0], podium[2]].map(
            (player, i) =>
              player && (
                <motion.li
                  key={player.id}
                  className={`${styles.step} ${styles[`step${player.position}`]} ${
                    player.id === me?.id ? styles.mine : ""
                  }`}
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: [0.15, 0, 0.3][i], type: "spring", stiffness: 200, damping: 18 }}
                >
                  <span className={styles.podiumAvatar}>
                    {player.crown && (
                      <Crown
                        place={player.crown}
                        size={player.position === 1 ? 40 : 32}
                        className={styles.podiumCrown}
                      />
                    )}
                    <Avatar avatar={player.avatar} color={player.color} size={player.position === 1 ? 72 : 58} />
                  </span>
                  <strong className={styles.podiumName}>{player.pseudo}</strong>
                  <RankEmblem rank={rankOf(player.rating, player.games)} size={30} />
                  <span className={styles.podiumRating}>{player.rating}</span>
                  <span className={styles.pedestal}>{player.position}</span>
                </motion.li>
              )
          )}
        </ol>

      {rest.length > 0 && (
        <div className={styles.listBlock} ref={listRef}>
          <ol className={styles.list} start={4 + shown.page * rows}>
            {shown.items.map((player) => (
              <Row key={player.id} player={player} mine={player.id === me?.id} />
            ))}
          </ol>
          <Pager page={shown.page} pages={shown.pages} onChange={shown.setPage} label="Pages du classement" />
        </div>
      )}
      </div>
      )}

      {me && !meListed && board && (
        <div className={styles.you}>
          {me.ranked && me.ranked.position !== null ? (
            <Row
              player={{
                ...me,
                position: me.ranked.position,
                rating: me.ranked.rating,
                games: me.ranked.games,
                wins: me.ranked.wins,
                losses: me.ranked.losses,
                draws: me.ranked.draws,
              }}
              mine
              asDiv
            />
          ) : (
            <p className={ui.muted}>
              {me.ranked && me.ranked.games >= PLACEMENT_GAMES
                ? "Joue une partie classée pour revenir au classement."
                : `Termine tes ${PLACEMENT_GAMES} parties de placement pour apparaître au classement.`}{" "}
              <ButtonLink href="/jouer/classe" size="sm" icon="trophy">
                Jouer en classé
              </ButtonLink>
            </p>
          )}
        </div>
      )}
    </PageShell>
  );
}

type RowProps = { player: LeaderboardEntry; mine: boolean; asDiv?: boolean };

const Row = ({ player, mine, asDiv = false }: RowProps) => {
  const rank = rankOf(player.rating, player.games);
  const Tag = asDiv ? "div" : "li";
  return (
    <Tag className={`${styles.row} ${mine ? styles.mine : ""}`}>
      <span className={styles.position}>{place(player.position)}</span>
      <Avatar avatar={player.avatar} color={player.color} size={36} />
      <span className={styles.player}>
        <strong>
          {player.pseudo}
          {mine && <span className={styles.youTag}> (toi)</span>}
        </strong>
        <small>
          {player.wins} V · {player.draws} N · {player.losses} D
        </small>
      </span>
      <span className={styles.rank}>
        <RankEmblem rank={rank} size={30} title={rank.label} />
        <span className={styles.rankText}>
          <span>{rank.label}</span>
          <strong>{player.rating}</strong>
        </span>
      </span>
    </Tag>
  );
};
