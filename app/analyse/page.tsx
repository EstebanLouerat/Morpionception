"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./Analyse.module.css";
import ui from "../ui/common.module.css";
import PageShell from "../ui/PageShell";
import Icon, { type IconName } from "../ui/Icon";
import { ButtonLink } from "../ui/Button";
import { playFx } from "../audio/engine";
import type { Side } from "../game/rules";
import { decodeMoves } from "../analysis/review";
import { analysisHref, useRecentGames, type RecentGame, type RecentMode } from "../analysis/recent";
import Review from "./Review";

const MODE_ICONS: Record<RecentMode, IconName> = { ia: "bot", local: "device", ami: "users", classe: "trophy" };

/** The analysis of a game (?coups=…, the side played here in ?toi=), or the games
 * finished on this device to pick one */
export default function Analyse() {
  const params = useSearchParams();
  const encoded = params.get("coups");
  const toi = params.get("toi");
  const you: Side | null = toi === "X" || toi === "O" ? toi : null;
  const moves = useMemo(() => decodeMoves(encoded), [encoded]);
  const recent = useRecentGames();

  if (encoded === null)
    return (
      <PageShell title="Analyse" backHref="/jouer">
        <Home games={recent.slice(0, 6)} />
      </PageShell>
    );

  // Names from the device's own record of the game, when it has one
  const known = recent.find((g) => g.moves === encoded);
  const me = you ?? known?.you ?? null;
  const names: Record<Side, string> = { X: "", O: "" };
  if (me) {
    names[me] = "Toi";
    names[me === "X" ? "O" : "X"] = known?.opponent || "Adversaire";
  }
  return (
    <PageShell title={moves.length ? "Analyse de la partie" : "Plateau libre"} backHref="/analyse" wide>
      {/* A fresh review for each game */}
      <Review key={encoded} moves={moves} you={me} names={names} />
    </PageShell>
  );
}

const resultOf = (g: RecentGame) => {
  if (!g.winner) return { text: "Égalité", kind: "draw" };
  if (!g.you) return { text: `${g.winner} gagne`, kind: "draw" };
  return g.winner === g.you ? { text: "Victoire", kind: "win" } : { text: "Défaite", kind: "loss" };
};

const opponentOf = (g: RecentGame) =>
  g.mode === "local" ? "Sur le même écran" : `contre ${g.opponent}`;

const Home = ({ games }: { games: RecentGame[] }) => (
  <>
    <section className={ui.section}>
      <p className={ui.muted}>
        Le moteur rejoue chaque position de ta partie et note chaque coup : meilleur coup, imprécision, erreur
        ou gaffe, avec le coup qu&apos;il aurait joué.
      </p>
    </section>
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>Tes dernières parties</h2>
      {games.length ? (
        <ul className={styles.games}>
          {games.map((g) => {
            const result = resultOf(g);
            return (
              <li key={g.at}>
                <Link href={analysisHref(g.moves, g.you)} className={styles.game} onClick={() => playFx("click")}>
                  <span className={styles.gameIcon}>
                    <Icon name={MODE_ICONS[g.mode]} size={20} />
                  </span>
                  <span className={styles.gameText}>
                    <strong>{opponentOf(g)}</strong>
                    <small>
                      {new Date(g.at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} ·{" "}
                      {g.moves.length / 2} coups
                    </small>
                  </span>
                  <span className={`${styles.result} ${styles[result.kind]}`}>{result.text}</span>
                  <Icon name="chevronRight" size={18} />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={ui.muted}>
          Aucune partie terminée sur cet appareil pour l&apos;instant. Joue une partie, puis touche « Analyser la
          partie » à la fin.
        </p>
      )}
    </section>
    <ButtonLink href="/analyse?coups=" variant="secondary" icon="search" fullWidth>
      Plateau libre
    </ButtonLink>
  </>
);
