"use client";

import { AnimatePresence, motion } from "framer-motion";
import styles from "./MiniBoard.module.css";
import { getBoardOutcome, getClosedBoards, getForcedBoard, type GameState, type Move } from "../game/rules";

export type BoardMark = "send" | "danger" | "good" | "free";
export type CellMark = { board: number; cell: number; kind: "hint" | "good" | "bad" | "ghost" };

type MiniBoardProps = {
  state: GameState;
  /** A cell was tapped (any cell: the caller decides what it means) */
  onTap?: (move: Move) => void;
  /** Mark the board to play (or every open board when the choice is free) */
  showForced?: boolean;
  /** Boards colored by role: where a move sends, a danger, a good one */
  boards?: Partial<Record<number, BoardMark>>;
  cells?: CellMark[];
  /** Read out with the board (what the board shows) */
  label: string;
};

const sym = (c: string | null) => (c === "X" ? styles.x : c === "O" ? styles.o : "");

/** A small, self-contained ultimate board for the lessons: the real position, its
 * marks popping in, the board to play outlined, and highlights a lesson asks for */
const MiniBoard = ({ state, onTap, showForced = true, boards = {}, cells = [], label }: MiniBoardProps) => {
  const closed = getClosedBoards(state);
  const forced = getForcedBoard(state, closed);
  const free = forced === null;
  // A finished game has no board to play
  const over = !!getBoardOutcome(state);
  const markOf = (board: number, cell: number) => cells.find((c) => c.board === board && c.cell === cell);

  return (
    <div className={styles.wrap} role="group" aria-label={label}>
      <div className={styles.big}>
        {state.superBoard.map((board, b) => {
          const playable = showForced && !over && !closed[b] && (free || forced === b);
          const role = boards[b];
          return (
            <div
              key={b}
              className={[
                styles.board,
                playable ? styles[`play${state.currentPlayer}`] : "",
                playable && free ? styles.freeBoard : "",
                role ? styles[role] : "",
                state.winners[b] ? styles[`won${state.winners[b]}`] : "",
              ].join(" ")}
            >
              {board.flat().map((value, c) => {
                const mark = markOf(b, c);
                const last = state.lastMove?.board === b && state.lastMove.cell === c;
                const shown = value ?? (mark?.kind === "ghost" ? state.currentPlayer : null);
                return (
                  <button
                    key={c}
                    type="button"
                    className={[
                      styles.cell,
                      sym(shown),
                      last ? styles.last : "",
                      mark ? styles[mark.kind] : "",
                    ].join(" ")}
                    onClick={() => onTap?.({ board: b, cell: c })}
                    disabled={!onTap}
                    aria-label={`Grille ${b + 1}, case ${c + 1}${value ? ` : ${value}` : ""}`}
                  >
                    <AnimatePresence>
                      {shown && (
                        <motion.span
                          key={`${shown}-${mark?.kind ?? ""}`}
                          initial={{ scale: 0.2, opacity: 0 }}
                          animate={{ scale: 1, opacity: mark?.kind === "ghost" ? 0.45 : 1 }}
                          exit={{ scale: 0.2, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 24 }}
                        >
                          {shown}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })}
              <AnimatePresence>
                {state.winners[b] && (
                  <motion.span
                    className={`${styles.winner} ${sym(state.winners[b])}`}
                    initial={{ scale: 0, rotate: -20 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 16 }}
                    aria-hidden="true"
                  >
                    {state.winners[b]}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MiniBoard;
