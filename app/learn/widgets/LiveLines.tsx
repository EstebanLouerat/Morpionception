"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import styles from "./Widgets.module.css";
import { LINES, type GameState } from "../../game/rules";
import { playFx } from "../../audio/engine";
import { boardName, capital, liveLines, mostLiveBoards } from "../positions";
import { celebrate } from "./celebrate";

const BOARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const at = (i: number) => ({ x: 50 + (i % 3) * 100, y: 50 + Math.floor(i / 3) * 100 });

/** The big board (its boards won shown by their winner): tap a board to see which of its
 * lines the player can still complete (green) and which are dead (red). Solved once the
 * board that keeps the most is found. */
const LiveLines = ({ id, state, prompt }: { id: string; state: GameState; prompt: string }) => {
  // The lines each board keeps, and the answer: computed once, the position never changes
  const live = useMemo(() => BOARDS.map((b) => liveLines(state, state.currentPlayer, b)), [state]);
  const best = useMemo(() => mostLiveBoards(state, state.currentPlayer), [state]);
  // The center first: its dead lines are the lesson
  const [pick, setPick] = useState(4);
  const [seen, setSeen] = useState<number[]>([4]);
  const [found, setFound] = useState(false);

  const winner = state.winners[pick];
  const all = LINES.filter((line) => line.includes(pick));
  const alive = live[pick];
  const isBest = best.includes(pick);

  const tap = (b: number) => {
    setPick(b);
    if (!seen.includes(b)) setSeen([...seen, b]);
    if (!found && best.includes(b)) {
      setFound(true);
      celebrate(id);
    } else playFx("select");
  };

  const dead = all.length - alive.length;
  const caption = winner
    ? winner === state.currentPlayer
      ? "Cette grille est déjà à toi : touche une grille ouverte."
      : `${winner} a gagné ${boardName(pick)} : toutes les lignes qui passent par elle sont mortes pour toi.`
    : `${capital(boardName(pick))} : ${all.length} lignes, ${
        !dead ? "toutes vivantes." : !alive.length ? "toutes mortes." : `dont ${dead} ${dead > 1 ? "mortes" : "morte"} : il en reste ${alive.length}.`
      }${isBest ? " C'est la grille qui en garde le plus : vise-la !" : ""}`;

  return (
    <div className={styles.widget}>
      <p className={styles.prompt}>{prompt}</p>
      <div className={styles.lines}>
        {BOARDS.map((b) => {
          const won = state.winners[b];
          return (
            <button
              key={b}
              type="button"
              className={[
                styles.lineCell,
                b === pick ? styles.picked : "",
                won ? styles[`won${won}`] : "",
              ].join(" ")}
              onClick={() => tap(b)}
              aria-pressed={b === pick}
              aria-label={`${capital(boardName(b))}${won ? ` : gagnée par ${won}` : ""}`}
            >
              {won ? (
                <span className={`${styles.bigMark} ${styles[`mark${won}`]}`} aria-hidden="true">
                  {won}
                </span>
              ) : (
                <span className={styles.boardIcon} aria-hidden="true">
                  {BOARDS.map((k) => (
                    <i key={k} />
                  ))}
                </span>
              )}
              {!won && seen.includes(b) && <span className={styles.lineCount}>{live[b].length}</span>}
            </button>
          );
        })}
        <svg className={styles.lineLayer} viewBox="0 0 300 300" aria-hidden="true">
          {!winner &&
            all.map((line) => {
              const a = at(line[0]);
              const z = at(line[2]);
              const ok = alive.includes(line);
              // Drawn in (green), or faded in to its dim opacity, dashed (red: a dash
              // pattern and a drawn path would fight over the same stroke)
              return (
                <motion.line
                  key={`${pick}-${line.join("")}`}
                  className={ok ? styles.liveLine : styles.deadLine}
                  x1={a.x}
                  y1={a.y}
                  x2={z.x}
                  y2={z.y}
                  initial={ok ? { pathLength: 0, opacity: 0 } : { opacity: 0 }}
                  animate={ok ? { pathLength: 1, opacity: 1 } : { opacity: 0.7 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                />
              );
            })}
        </svg>
      </div>
      <p className={`${styles.caption} ${isBest ? styles.success : ""}`} role="status" aria-live="polite">
        {caption}
      </p>
    </div>
  );
};

export default LiveLines;
