"use client";

import styles from "./Game.module.css";
import { ReactNode, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { playFx } from "../audio/engine";
import { IconLink } from "../ui/Button";
import PlayerBar from "./PlayerBar";
import type { GameMode } from "./modes";
import {
  getClosedBoards,
  getForcedBoard,
  isBoardFull,
  isValidMove,
  otherSide,
  type Clocks,
  type GameState,
  type Outcome,
  type Side,
} from "./rules";

// Numpad layout mirrors the grid: 7 8 9 = top row, 1 2 3 = bottom row.
// Uses event.code so it works whether NumLock is on or off.
const NUMPAD_TO_INDEX: Record<string, number> = {
  Numpad7: 0,
  Numpad8: 1,
  Numpad9: 2,
  Numpad4: 3,
  Numpad5: 4,
  Numpad6: 5,
  Numpad1: 6,
  Numpad2: 7,
  Numpad3: 8,
};
const NUMPAD_CANCEL_CODES = ["Numpad0", "NumpadDecimal", "Escape", "Backspace"];

const cellAt = (state: GameState, board: number, cell: number) =>
  state.superBoard[board][Math.floor(cell / 3)][cell % 3];

/** The one cell filled between two states, null if they are not one move apart */
const findNewMove = (before: GameState, after: GameState) => {
  let move: { board: number; cell: number } | null = null;
  for (let board = 0; board < 9; board++) {
    for (let cell = 0; cell < 9; cell++) {
      const was = cellAt(before, board, cell);
      if (was === cellAt(after, board, cell)) continue;
      if (was || move) return null;
      move = { board, cell };
    }
  }
  return move;
};

type GameScreenProps = {
  /** Player names (mode.players) and the mode name under "VS" */
  mode: GameMode;
  state: GameState;
  outcome: Outcome;
  /** Time left per player, null without chrono */
  clocks: Clocks | null;
  /** Online: the side of this player, who gets the confetti only for a win */
  you?: Side;
  /** Moves are accepted (false while it is the other player's turn online) */
  canPlay: boolean;
  onPlay: (board: number, cell: number) => void;
  settingsHref: string;
  /** Status under a player's name, instead of "À jouer" (e.g. offline) */
  playerStatus?: Partial<Record<Side, string>>;
  /** Screen reader announcement, instead of the one built from the names */
  announcement?: string;
  /** Message under the players (e.g. connection lost) */
  notice?: ReactNode;
  /** Buttons of the control panel, with the ctrlBtn class */
  controls: ReactNode;
  /** Content of the modal shown once the game is over */
  endModal: ReactNode;
};

/** The game screen: players, super board with mouse and numpad controls, end modal */
export default function GameScreen({
  mode,
  state,
  outcome,
  clocks,
  you,
  canPlay,
  onPlay,
  settingsHref,
  playerStatus,
  announcement,
  notice,
  controls,
  endModal,
}: GameScreenProps) {
  const [isSidePanelOpened, setIsSidePanelOpened] = useState(false);
  const [showModal, setShowModal] = useState(false);
  // Board picked with the numpad when the player is free to choose a board
  const [selectedBoard, setSelectedBoard] = useState<number | null>(null);

  const { superBoard, winners, currentPlayer } = state;
  const winner = outcome?.winner ?? null;
  const isDraw = outcome?.reason === "draw";
  const gameOver = !!outcome;
  const timedOut = outcome?.reason === "timeout" && winner ? otherSide(winner) : null;
  const closedBoards = getClosedBoards(state);
  const forcedBoard = getForcedBoard(state, closedBoards);

  const handleCellClick = (board: number, cell: number) => {
    if (gameOver) return;
    if (!canPlay || !isValidMove(state, board, cell)) {
      playFx("invalid");
      return;
    }
    setSelectedBoard(null);
    onPlay(board, cell);
  };

  // Sound of each new move, played here or received from the other player
  const previousState = useRef(state);
  useEffect(() => {
    const before = previousState.current;
    previousState.current = state;
    const move = before === state ? null : findNewMove(before, state);
    if (!move) return;
    playFx(cellAt(state, move.board, move.cell) === "X" ? "placeX" : "placeO");
    if (state.winners[move.board]) playFx("boardWon", 0.12);
    else if (isBoardFull(state.superBoard[move.board])) playFx("boardDraw", 0.12);
  }, [state]);

  const handleNumpadKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || gameOver) return;

    if (NUMPAD_CANCEL_CODES.includes(e.code)) {
      if (selectedBoard !== null) {
        e.preventDefault();
        playFx("click");
        setSelectedBoard(null);
      }
      return;
    }

    const idx = NUMPAD_TO_INDEX[e.code];
    if (idx === undefined) return;
    e.preventDefault();

    if (!canPlay) {
      playFx("invalid");
      return;
    }
    // Forced board: the key picks the cell directly
    if (forcedBoard !== null) {
      handleCellClick(forcedBoard, idx);
      return;
    }
    // Free choice: first key picks the board, second key picks the cell
    if (selectedBoard === null) {
      if (closedBoards[idx]) {
        playFx("invalid");
      } else {
        playFx("select");
        setSelectedBoard(idx);
      }
      return;
    }
    handleCellClick(selectedBoard, idx);
  };

  // Keep the listener stable while always calling the latest handler
  const numpadKeyRef = useRef(handleNumpadKey);
  numpadKeyRef.current = handleNumpadKey;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => numpadKeyRef.current(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Board currently targeted (forced board, or the one picked with the numpad)
  const focusedBoard = forcedBoard ?? selectedBoard;
  const playerClass = currentPlayer.toLowerCase();

  useEffect(() => {
    if (winner) {
      // Online, only the winner gets the celebration
      if (!you || winner === you) {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
        playFx("gameWin", 0.4);
      } else {
        playFx("gameLose", 0.4);
      }
      setShowModal(false);
      const timeout = setTimeout(() => setShowModal(true), 2000);
      return () => clearTimeout(timeout);
    } else if (isDraw) {
      playFx("gameDraw", 0.4);
      setShowModal(false);
      const timeout = setTimeout(() => setShowModal(true), 1000);
      return () => clearTimeout(timeout);
    } else {
      setShowModal(false);
    }
  }, [winner, isDraw, you]);

  return (
    <div className={`${styles.container} ${styles[playerClass]}`}>
      {/* Modal */}
      <AnimatePresence>
        {gameOver && showModal && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.modal}
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
            >
              {endModal}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings (the game is saved, so it resumes on return) */}
      <IconLink
        className={styles.settingsBtn}
        href={settingsHref}
        icon="gear"
        label="Paramètres"
      />

      {/* Title */}
      <motion.h1
        className={styles.title}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        Morpion<span>ception</span>
      </motion.h1>

      {/* Players */}
      <motion.div
        className={styles.players}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <PlayerBar
          mode={mode}
          current={currentPlayer}
          winner={winner}
          isDraw={isDraw}
          clocks={clocks}
          timedOut={timedOut}
          status={playerStatus}
          announcement={announcement}
        />
        {notice && (
          <p className={styles.notice} role="status">
            {notice}
          </p>
        )}
      </motion.div>

      {/* Numpad hint */}
      {!gameOver && canPlay && (
        <div className={styles.numpadHint}>
          Pavé numérique :{" "}
          {focusedBoard === null
            ? "choisis une grille (1-9)"
            : selectedBoard !== null
            ? "choisis une case (1-9) · 0 / Échap pour annuler"
            : "choisis une case (1-9)"}
        </div>
      )}

      {/* Super Board */}
      <div className={styles.superBoard}>
        {superBoard.map((board, idx) => (
          <motion.div
            key={idx}
            className={`
              ${styles.board} ${
              winners[idx] ? styles[winners[idx]!.toLowerCase()] : ""
            }
              ${!winners[idx] && closedBoards[idx] ? styles.draw : ""}
              ${forcedBoard === idx ? styles[`active-${playerClass}`] : ""}
              ${selectedBoard === idx ? styles[`selected-${playerClass}`] : ""}
              `}
            animate={{
              scale: focusedBoard === null || focusedBoard === idx ? 1 : 0.9,
              opacity: focusedBoard === null || focusedBoard === idx ? 1 : 0.4,
            }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            {board.flat().map((cell, subIdx) => (
              <motion.button
                key={subIdx}
                className={`${styles.cell} ${
                  cell ? styles[cell.toLowerCase()] : ""
                }`}
                onClick={() => handleCellClick(idx, subIdx)}
                disabled={!!cell || !!winners[idx]}
                whileTap={{ scale: 0.8 }}
                transition={{ type: "spring", stiffness: 500 }}
              >
                {cell}
              </motion.button>
            ))}

            {winners[idx] && (
              <motion.div
                className={`${styles.boardWinner} ${
                  styles[winners[idx]!.toLowerCase()]
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                {winners[idx]}
              </motion.div>
            )}

            {!winners[idx] && closedBoards[idx] && (
              <motion.div
                className={`${styles.boardWinner} ${styles.draw}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                =
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Controls */}
      <div
        className={`${styles.btnContainer} ${
          !isSidePanelOpened ? styles.closed : ""
        }`}
      >
        <div className={styles.left}>{controls}</div>
        <div className={styles.right}>
          <button
            className={styles.btnToggle}
            onClick={() => setIsSidePanelOpened(!isSidePanelOpened)}
          >
            {">"}
          </button>
        </div>
      </div>
    </div>
  );
}
