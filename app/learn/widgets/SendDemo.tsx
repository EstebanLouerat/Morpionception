"use client";

import { useState } from "react";
import styles from "./Widgets.module.css";
import MiniBoard from "../MiniBoard";
import { boardName, position } from "../positions";
import { isValidMove, type Move } from "../../game/rules";

const START = position(Array(9).fill("... ... ..."), "X", 4);

/** Tap a cell of the center board: the board it would send the opponent to lights up */
const SendDemo = () => {
  const [pick, setPick] = useState<Move | null>({ board: 4, cell: 2 });
  const [outside, setOutside] = useState(false);
  return (
    <div className={styles.widget}>
      <MiniBoard
        state={START}
        onTap={(move) => {
          if (!isValidMove(START, move.board, move.cell)) {
            setOutside(true);
            return;
          }
          setOutside(false);
          setPick(move);
        }}
        boards={pick ? { [pick.cell]: "send" } : {}}
        cells={pick ? [{ ...pick, kind: "ghost" }] : []}
        label="Démonstration : où ta case envoie l'adversaire"
      />
      <p className={styles.caption} role="status" aria-live="polite">
        {outside
          ? "Joue dans la grille centrale, encadrée."
          : pick
          ? pick.cell === 4
            ? "Au centre : O devra jouer… dans cette même grille centrale."
            : `→ O devra jouer dans ${boardName(pick.cell)}, en bleu.`
          : ""}
      </p>
    </div>
  );
};

export default SendDemo;
