"use client";

import styles from "./Game.module.css";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { playFx } from "../audio/engine";
import { Button, ButtonLink, IconLink } from "../ui/Button";
import PlayerBar from "./PlayerBar";
import { getMode } from "./modes";
import { getClockSettings } from "./clock";

type Player = "X" | "O" | null;
type Board = Player[][];
type SuperBoard = Board[];
type Clocks = { X: number; O: number };

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
  // Mode from /game?mode=… (only playable modes, see modes.ts)
  const [mode] = useState(() =>
    getMode(
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("mode")
    )
  );

  // Chrono of a new game: the option picked in the menu, if the mode supports it
  const newClockLimit = () => (mode.clockOption ? getClockSettings().seconds : 0);
  const fullClocks = (limit: number): Clocks => ({ X: limit * 1000, O: limit * 1000 });

  const getInitialState = (): {
    superBoard: SuperBoard;
    activeBoard: number | null;
    currentPlayer: Player;
    winners: Player[];
    clockLimit: number;
    clocks: Clocks;
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
            clockLimit: parsed.clockLimit ?? 0,
            clocks: parsed.clocks ?? fullClocks(parsed.clockLimit ?? 0),
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
      clockLimit: newClockLimit(),
      clocks: fullClocks(newClockLimit()),
    };
  };

  const {
    superBoard: initSB,
    activeBoard: initAB,
    currentPlayer: initCP,
    winners: initW,
    clockLimit: initCL,
    clocks: initC,
  } = getInitialState();

  const [superBoard, setSuperBoard] = useState<SuperBoard>(initSB);
  const [activeBoard, setActiveBoard] = useState<number | null>(initAB);
  const [currentPlayer, setCurrentPlayer] = useState<Player>(initCP);
  const [winners, setWinners] = useState<Player[]>(initW);
  // Seconds per player for the whole game (0 = no chrono) and the time left in ms
  const [clockLimit, setClockLimit] = useState(initCL);
  const [clocks, setClocks] = useState<Clocks>(initC);
  const [isSidePanelOpened, setIsSidePanelOpened] = useState(false);
  const [showModal, setShowModal] = useState(false);
  // Board picked with the numpad when the player is free to choose a board
  const [selectedBoard, setSelectedBoard] = useState<number | null>(null);

  useEffect(() => {
    const gameState = {
      superBoard,
      winners,
      currentPlayer,
      activeBoard,
      clockLimit,
      clocks,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
  }, [superBoard, winners, currentPlayer, activeBoard, clockLimit, clocks]);

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
  // The player whose clock reaches 0 loses
  const timedOut: Player =
    !globalWinner && clockLimit > 0 && currentPlayer && clocks[currentPlayer] <= 0
      ? currentPlayer
      : null;
  const winner: Player = globalWinner ?? (timedOut && (timedOut === "X" ? "O" : "X"));
  const isDraw = !winner && closedBoards.every(Boolean);
  const gameOver = !!winner || isDraw;
  // The chrono starts after the first move
  const hasStarted = superBoard.some((board) => board.some((row) => row.some(Boolean)));
  const clockRunning = clockLimit > 0 && hasStarted && !gameOver;
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
    setSuperBoard(JSON.parse(JSON.stringify(initialSuperBoard)));
    setWinners(Array(9).fill(null));
    setCurrentPlayer("X");
    setActiveBoard(null);
    setSelectedBoard(null);
    const limit = newClockLimit();
    setClockLimit(limit);
    setClocks(fullClocks(limit));
    localStorage.removeItem(STORAGE_KEY);
  };

  // Count down the clock of the player to move
  useEffect(() => {
    if (!clockRunning || !currentPlayer) return;
    let last = Date.now();
    const spend = () => {
      const now = Date.now();
      const elapsed = now - last;
      last = now;
      setClocks((c) => ({
        ...c,
        [currentPlayer]: Math.max(0, c[currentPlayer] - elapsed),
      }));
    };
    const interval = setInterval(spend, 250);
    return () => {
      clearInterval(interval);
      spend(); // charge the time since the last tick before switching player
    };
  }, [clockRunning, currentPlayer]);

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
    if (winner) {
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
  }, [winner, isDraw]);

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
              {winner ? (
                <h2>
                  <span className={styles[winner.toLowerCase()]}>
                    {mode.players[winner]}
                  </span>{" "}
                  a gagné{timedOut ? " au temps" : ""} !
                </h2>
              ) : (
                <h2>Égalité !</h2>
              )}
              <div className={styles.modalBtns}>
                <Button onClick={resetGame}>Rejouer</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    resetGame();
                    router.push("/jouer");
                  }}
                >
                  Quitter
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Settings (the game is saved in localStorage, so it resumes on return) */}
      <IconLink
        className={styles.settingsBtn}
        href={`/parametres?from=game&mode=${mode.id}`}
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
          clocks={clockLimit > 0 ? clocks : null}
          timedOut={timedOut}
        />
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
          <Button className={styles.ctrlBtn} onClick={resetGame}>
            Recommencer
          </Button>
          <ButtonLink className={styles.ctrlBtn} variant="secondary" href="/jouer">
            Quitter
          </ButtonLink>
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
