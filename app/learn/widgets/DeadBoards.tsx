"use client";

import { useMemo, useState } from "react";
import styles from "./Widgets.module.css";
import MiniBoard, { type BoardMark, type CellMark } from "../MiniBoard";
import { Button } from "../../ui/Button";
import { playFx } from "../../audio/engine";
import { isBoardFull, type GameState, type Move } from "../../game/rules";
import { isDead, lineName, openLine } from "../positions";
import { celebrate } from "./celebrate";

const BOARDS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

type Message = { kind: "success" | "error"; text: string };

/** Find every board that nobody can win any more: a wrong one shows the line still open */
const DeadBoards = ({ id, state, prompt }: { id: string; state: GameState; prompt: string }) => {
  const dead = useMemo(() => BOARDS.filter((b) => isDead(state, b)), [state]);
  const [found, setFound] = useState<number[]>([]);
  // The last board tapped that is not dead, and the line someone can still complete there
  const [miss, setMiss] = useState<{ board: number; line: number[] | null } | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const done = found.length === dead.length;

  const tap = ({ board }: Move) => {
    if (done || found.includes(board)) return;
    if (isDead(state, board)) {
      const next = [...found, board];
      setFound(next);
      setMiss(null);
      if (next.length === dead.length) {
        setMessage({
          kind: "success",
          text: "Toutes trouvées ! Elles ne compteront pour personne : au grand plateau, chaque ligne qui passe par elles est morte.",
        });
        celebrate(id);
      } else {
        setMessage({
          kind: "success",
          text: `Morte : chaque ligne y a déjà un X et un O. Encore ${dead.length - next.length}.`,
        });
        playFx("select");
      }
      return;
    }
    playFx("invalid");
    const winner = state.winners[board];
    if (winner || isBoardFull(state.superBoard[board])) {
      setMiss({ board, line: null });
      setMessage({
        kind: "error",
        text: winner ? `Gagnée par ${winner} : elle est fermée, pas morte.` : "Elle est pleine : fermée, pas morte.",
      });
      return;
    }
    const side = openLine(state, "X", board) ? "X" : "O";
    const line = openLine(state, side, board)!;
    setMiss({ board, line });
    setMessage({ kind: "error", text: `Pas morte : ${side} peut encore aligner ${lineName(line)}.` });
  };

  const reset = () => {
    setFound([]);
    setMiss(null);
    setMessage(null);
  };

  const boards: Partial<Record<number, BoardMark>> = Object.fromEntries(found.map((b) => [b, "good"]));
  if (miss) boards[miss.board] = "danger";
  const cells: CellMark[] = miss?.line?.map((cell) => ({ board: miss.board, cell, kind: "hint" })) ?? [];

  return (
    <div className={styles.widget}>
      <p className={styles.prompt}>{prompt}</p>
      <MiniBoard state={state} onTap={tap} showForced={false} boards={boards} cells={cells} label="Énigme" />
      <p className={`${styles.caption} ${message ? styles[message.kind] : ""}`} role="status" aria-live="polite">
        {message?.text ?? `${found.length} / ${dead.length} trouvées.`}
      </p>
      <div className={styles.actions}>
        <Button size="sm" variant="secondary" icon="refresh" onClick={reset} disabled={!found.length && !miss}>
          Recommencer
        </Button>
      </div>
    </div>
  );
};

export default DeadBoards;
