"use client";

import styles from "./Game.module.css";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { playFx } from "../audio/engine";

type Player = "X" | "O" | null;
type Board = Player[][];
type SuperBoard = Board[];

const initialBoard = Array(3)
  .fill(null)
  .map(() => Array(3).fill(null));
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

const initialSuperBoard: SuperBoard = Array(9)
  .fill(null)
  .map(() => JSON.parse(JSON.stringify(initialBoard)));

export default function Game() {
  const STORAGE_KEY = "morpionception_state";
  const router = useRouter();

  const getInitialState = (): {
    superBoard: SuperBoard;
    activeBoard: number | null;
    currentPlayer: Player;
    winners: Player[];
  } => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          return {
            superBoard: parsed.superBoard ?? initialSuperBoard,
            activeBoard: parsed.activeBoard ?? null,
            currentPlayer: parsed.currentPlayer ?? "X",
            winners: parsed.winners ?? Array(9).fill(null),
          };
        } catch (e) {
          console.error("Échec du parsing localStorage", e);
        }
      }
    }
    return {
      superBoard: initialSuperBoard,
      activeBoard: null,
      currentPlayer: "X",
      winners: Array(9).fill(null),
    };
  };

  const {
    superBoard: initSB,
    activeBoard: initAB,
    currentPlayer: initCP,
    winners: initW,
  } = getInitialState();

  const [superBoard, setSuperBoard] = useState<SuperBoard>(initSB);
  const [activeBoard, setActiveBoard] = useState<number | null>(initAB);
  const [currentPlayer, setCurrentPlayer] = useState<Player>(initCP);
  const [winners, setWinners] = useState<Player[]>(initW);
  const [isSidePanelOpened, setIsSidePanelOpened] = useState(false);
  const [showModal, setShowModal] = useState(false);
  // Board picked with the numpad when the player is free to choose a board
  const [selectedBoard, setSelectedBoard] = useState<number | null>(null);

  useEffect(() => {
    const gameState = { superBoard, winners, currentPlayer, activeBoard };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
  }, [superBoard, winners, currentPlayer, activeBoard]);

  const checkWin = (board: Board): Player | null => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (const [a, b, c] of lines) {
      const [rA, cA] = [Math.floor(a / 3), a % 3];
      const [rB, cB] = [Math.floor(b / 3), b % 3];
      const [rC, cC] = [Math.floor(c / 3), c % 3];
      if (
        board[rA][cA] &&
        board[rA][cA] === board[rB][cB] &&
        board[rA][cA] === board[rC][cC]
      ) {
        return board[rA][cA];
      }
    }
    return null;
  };

  const isBoardFull = (board: Board) => board.every((row) => row.every(Boolean));

  const globalWinner = checkWin([
    winners.slice(0, 3),
    winners.slice(3, 6),
    winners.slice(6, 9),
  ]);
  // A board is closed once won or full (a full board without winner is a tie for nobody)
  const closedBoards = superBoard.map(
    (board, i) => !!winners[i] || isBoardFull(board)
  );
  const isDraw = !globalWinner && closedBoards.every(Boolean);
  const gameOver = !!globalWinner || isDraw;
  // Ignore a forced board that can no longer be played (also fixes stuck saved games)
  const forcedBoard =
    activeBoard !== null && !closedBoards[activeBoard] ? activeBoard : null;

  const handleCellClick = (superIdx: number, subIdx: number) => {
    if (gameOver) return;
    if (
      closedBoards[superIdx] ||
      (forcedBoard !== null && forcedBoard !== superIdx) ||
      superBoard[superIdx][Math.floor(subIdx / 3)][subIdx % 3]
    ) {
      playFx("invalid");
      return;
    }
    const newBoard = superBoard.map((grid, i) =>
      i === superIdx
        ? grid.map((row, r) =>
            row.map((c, col) => (r * 3 + col === subIdx ? currentPlayer : c))
          )
        : grid
    );
    // const flat = newBoard[superIdx].flat();
    const newWinners = [...winners];
    newWinners[superIdx] = checkWin(newBoard[superIdx]);
    playFx(currentPlayer === "X" ? "placeX" : "placeO");
    if (newWinners[superIdx]) playFx("boardWon", 0.12);
    else if (isBoardFull(newBoard[superIdx])) playFx("boardDraw", 0.12);
    setSuperBoard(newBoard);
    setWinners(newWinners);
    setCurrentPlayer(currentPlayer === "X" ? "O" : "X");

    const nextBoard = subIdx;
    const nextBoardClosed =
      !!newWinners[nextBoard] || isBoardFull(newBoard[nextBoard]);
    setActiveBoard(nextBoardClosed ? null : nextBoard);
    setSelectedBoard(null);
  };

  const resetGame = () => {
    playFx("click");
    setSuperBoard(JSON.parse(JSON.stringify(initialSuperBoard)));
    setWinners(Array(9).fill(null));
    setCurrentPlayer("X");
    setActiveBoard(null);
    setSelectedBoard(null);
    localStorage.removeItem(STORAGE_KEY);
  };

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
  const playerClass = currentPlayer?.toLowerCase() || "";

  useEffect(() => {
    if (globalWinner) {
      confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      playFx("gameWin", 0.4);
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
  }, [globalWinner, isDraw]);

  return (
    <div
      className={`${styles.container} ${
        styles[currentPlayer?.toLowerCase() || ""]
      }`}
    >
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
              {globalWinner ? (
                <h2>
                  <span className={styles[globalWinner.toLowerCase()]}>
                    {" "}
                    {globalWinner}{" "}
                  </span>{" "}
                  a gagné !
                </h2>
              ) : (
                <h2>Égalité !</h2>
              )}
              <div className={styles.modalBtns}>
                <button className={styles.btn} onClick={resetGame}>
                  <span className={styles.btnTop}>Rejouer</span>
                </button>
                <button
                  className={styles.btn}
                  onClick={() => {
                    resetGame();
                    router.push("/");
                  }}
                >
                  <span className={styles.btnTop}>Quitter</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings (the game is saved in localStorage, so it resumes on return) */}
      <button
        className={styles.settingsBtn}
        aria-label="Paramètres"
        title="Paramètres"
        onClick={() => {
          playFx("click");
          router.push("/parametres?from=game");
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {/* Title */}
      <motion.h1
        className={styles.title}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        Morpion<span>ception</span>
      </motion.h1>

      {/* Status */}
      <motion.div
        className={`${styles.status} ${globalWinner ? styles.winner : ""}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {globalWinner ? (
          <>{globalWinner} wins!</>
        ) : isDraw ? (
          <>Draw!</>
        ) : (
          <>
            Current Player:{" "}
            <span
              className={`${styles.currPlayer} ${
                styles[currentPlayer?.toLowerCase() || ""]
              }`}
            >
              {currentPlayer}
            </span>
          </>
        )}
      </motion.div>

      {/* Numpad hint */}
      {!gameOver && (
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
        <div className={styles.left}>
          {/* <button className={styles.btn} onClick={autoPlayTest}>
            <span className={styles.btnTop}>Auto play</span>
          </button> */}
          <button className={styles.btn} onClick={resetGame}>
            <span className={styles.btnTop}>Reset Game</span>
          </button>
          <button
            className={styles.btn}
            onClick={() => {
              playFx("click");
              router.push("/");
            }}
          >
            <span className={styles.btnTop}>Quitter</span>
          </button>
        </div>
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
