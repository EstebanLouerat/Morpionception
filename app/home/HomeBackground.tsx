"use client";

import { useEffect, useState } from "react";
import styles from "./HomeBackground.module.css";
import { useAppearance } from "../theme/appearance";
import {
  applyMove,
  getBoardOutcome,
  isValidMove,
  newGameState,
  type GameState,
  type Side,
} from "../game/rules";

// The grid is drawn on a 900 × 900 square: 9 boards of 300, each with 3 × 3 cells
const BOARD = 300;
const INSET = 24;
const CELL = (BOARD - 2 * INSET) / 3;
// A ghost move every so often; the finished game stays a moment, then fades
const MOVE_MS = 1400;
const REST_MS = 3200;
const FADE_MS = 1200;

type Mark = { board: number; cell: number; side: Side; at: number };

/** Center of a cell of a small board */
const cellCenter = (board: number, cell: number) => ({
  x: (board % 3) * BOARD + INSET + (cell % 3) * CELL + CELL / 2,
  y: Math.floor(board / 3) * BOARD + INSET + Math.floor(cell / 3) * CELL + CELL / 2,
});

/** A random legal move (the ghost players are not good, just lawful) */
const randomMove = (game: GameState) => {
  const moves: [number, number][] = [];
  for (let b = 0; b < 9; b++) for (let c = 0; c < 9; c++) if (isValidMove(game, b, c)) moves.push([b, c]);
  return moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
};

/** X as two strokes, O as a circle, drawn in (stroke animation) where they land */
const Glyph = ({ side, x, y, size, className }: { side: Side; x: number; y: number; size: number; className: string }) => {
  const r = size / 2;
  return side === "X" ? (
    <g className={className}>
      <path d={`M${x - r} ${y - r}L${x + r} ${y + r}`} pathLength={1} />
      <path d={`M${x + r} ${y - r}L${x - r} ${y + r}`} pathLength={1} style={{ animationDelay: "0.18s" }} />
    </g>
  ) : (
    <g className={className}>
      <circle cx={x} cy={y} r={r} pathLength={1} transform={`rotate(-90 ${x} ${y})`} />
    </g>
  );
};

// A position for the still picture (animations reduced): a few moves of a real game
const stillGame = () => {
  let game = newGameState();
  const marks: Mark[] = [];
  const moves: [number, number][] = [[4, 0], [0, 4], [4, 4], [4, 2], [2, 6], [6, 4], [4, 8], [8, 1], [1, 3]];
  for (const [b, c] of moves) {
    if (!isValidMove(game, b, c)) continue;
    marks.push({ board: b, cell: c, side: game.currentPlayer, at: 0 });
    game = applyMove(game, b, c);
  }
  return { game, marks };
};

/** Home page background: soft glows in the players' colors, the game's grid lying in
 * perspective, and a ghost game playing itself on it, slowly and faintly */
const HomeBackground = () => {
  const { reduceMotion } = useAppearance();
  const [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const still = reduceMotion || systemReduced;

  const [play, setPlay] = useState(() => ({ game: newGameState(), marks: [] as Mark[], fading: false }));

  useEffect(() => {
    if (still) {
      setPlay({ ...stillGame(), fading: false });
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let current = { game: newGameState(), marks: [] as Mark[], fading: false };
    setPlay(current);
    const step = () => {
      // Hidden tab: nothing to see, nothing to compute
      if (document.hidden) {
        timer = setTimeout(step, MOVE_MS);
        return;
      }
      const over = !!getBoardOutcome(current.game);
      const move = over ? null : randomMove(current.game);
      if (!move) {
        // Game over: it fades, then a new one starts
        current = { ...current, fading: true };
        setPlay(current);
        timer = setTimeout(() => {
          current = { game: newGameState(), marks: [], fading: false };
          setPlay(current);
          timer = setTimeout(step, MOVE_MS);
        }, REST_MS + FADE_MS);
        return;
      }
      const [board, cell] = move;
      current = {
        game: applyMove(current.game, board, cell),
        marks: [...current.marks, { board, cell, side: current.game.currentPlayer, at: Date.now() }],
        fading: false,
      };
      setPlay(current);
      timer = setTimeout(step, MOVE_MS);
    };
    timer = setTimeout(step, 600);
    return () => clearTimeout(timer);
  }, [still]);

  const { game, marks, fading } = play;
  const forced = game.activeBoard;

  return (
    <div className={`${styles.scene} ${still ? styles.still : ""}`} aria-hidden="true">
      <div className={`${styles.glow} ${styles.glowX}`} />
      <div className={`${styles.glow} ${styles.glowO}`} />
      <div className={styles.floor}>
        <svg className={styles.grid} viewBox="-30 -30 960 960">
          {/* The board to play next, softly lit */}
          {forced !== null && !fading && (
            <rect
              key={`forced-${marks.length}`}
              className={`${styles.forced} ${game.currentPlayer === "X" ? styles.x : styles.o}`}
              x={(forced % 3) * BOARD + 8}
              y={Math.floor(forced / 3) * BOARD + 8}
              width={BOARD - 16}
              height={BOARD - 16}
              rx={22}
            />
          )}
          {/* Small boards */}
          {Array.from({ length: 9 }, (_, b) => {
            const x0 = (b % 3) * BOARD + INSET;
            const y0 = Math.floor(b / 3) * BOARD + INSET;
            return (
              <g key={b} className={styles.thin}>
                {[1, 2].map((i) => (
                  <g key={i}>
                    <line x1={x0 + i * CELL} y1={y0} x2={x0 + i * CELL} y2={y0 + 3 * CELL} />
                    <line x1={x0} y1={y0 + i * CELL} x2={x0 + 3 * CELL} y2={y0 + i * CELL} />
                  </g>
                ))}
              </g>
            );
          })}
          {/* The big board */}
          <g className={styles.thick}>
            {[1, 2].map((i) => (
              <g key={i}>
                <line x1={i * BOARD} y1={0} x2={i * BOARD} y2={3 * BOARD} />
                <line x1={0} y1={i * BOARD} x2={3 * BOARD} y2={i * BOARD} />
              </g>
            ))}
          </g>
          <g className={`${styles.marks} ${fading ? styles.fading : ""}`}>
            {marks.map((m) => {
              const { x, y } = cellCenter(m.board, m.cell);
              return (
                <Glyph
                  key={`${m.board}-${m.cell}`}
                  side={m.side}
                  x={x}
                  y={y}
                  size={CELL * 0.46}
                  className={`${styles.mark} ${m.side === "X" ? styles.x : styles.o}`}
                />
              );
            })}
            {/* Boards won: a big faint mark over them */}
            {game.winners.map((w, b) =>
              w ? (
                <Glyph
                  key={`won-${b}`}
                  side={w}
                  x={(b % 3) * BOARD + BOARD / 2}
                  y={Math.floor(b / 3) * BOARD + BOARD / 2}
                  size={BOARD * 0.58}
                  className={`${styles.mark} ${styles.won} ${w === "X" ? styles.x : styles.o}`}
                />
              ) : null
            )}
          </g>
        </svg>
      </div>
      <div className={styles.veil} />
    </div>
  );
};

export default HomeBackground;
