"use client";

import { CSSProperties, useEffect, useId, useState } from "react";
import styles from "./HomeBackground.module.css";
import { useAppearance } from "../theme/appearance";
import {
  applyMove,
  getBoardOutcome,
  getWinningLine,
  isValidMove,
  newGameState,
  type GameState,
  type Side,
} from "../game/rules";

// The grid is drawn on a 900 × 900 square: 9 boards of 300, each with 3 × 3 cells
const BOARD = 300;
const INSET = 24;
const CELL = (BOARD - 2 * INSET) / 3;
// A ghost move every so often; a finished game stays a moment, then dissolves
const MOVE_MS = 1500;
const REST_MS = 3600;
const DISSOLVE_MS = 2200;
// Specks of light drifting up: [left %, size px, duration s, delay s]
const SPECKS: [number, number, number, number][] = [
  [8, 4, 26, 0], [19, 3, 31, 9], [27, 5, 24, 4], [38, 3, 34, 15], [46, 4, 28, 21],
  [57, 3, 30, 2], [64, 5, 25, 12], [73, 3, 33, 7], [82, 4, 27, 18], [91, 3, 29, 5],
];

type Mark = { board: number; cell: number; side: Side };
type Play = { game: GameState; marks: Mark[]; ending: boolean };

const center = (board: number, cell: number) => ({
  x: (board % 3) * BOARD + INSET + (cell % 3) * CELL + CELL / 2,
  y: Math.floor(board / 3) * BOARD + INSET + Math.floor(cell / 3) * CELL + CELL / 2,
});
const boardCenter = (board: number) => ({
  x: (board % 3) * BOARD + BOARD / 2,
  y: Math.floor(board / 3) * BOARD + BOARD / 2,
});

/** A random legal move: the ghost players are not good, just lawful */
const randomMove = (game: GameState) => {
  const moves: [number, number][] = [];
  for (let b = 0; b < 9; b++) for (let c = 0; c < 9; c++) if (isValidMove(game, b, c)) moves.push([b, c]);
  return moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
};

type GlyphProps = { side: Side; x: number; y: number; size: number; className: string; style?: CSSProperties };

/** X as two strokes, O as a circle, drawn in where they land */
const Glyph = ({ side, x, y, size, className, style }: GlyphProps) => {
  const r = size / 2;
  return side === "X" ? (
    <g className={className} style={style}>
      <path d={`M${x - r} ${y - r}L${x + r} ${y + r}`} pathLength={1} />
      <path d={`M${x + r} ${y - r}L${x - r} ${y + r}`} pathLength={1} style={{ animationDelay: "0.16s" }} />
    </g>
  ) : (
    <g className={className} style={style}>
      <circle cx={x} cy={y} r={r} pathLength={1} transform={`rotate(-90 ${x} ${y})`} />
    </g>
  );
};

/** The grid lines: 9 small boards, then the big one */
const GridLines = () => (
  <>
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
    <g className={styles.thick}>
      {[1, 2].map((i) => (
        <g key={i}>
          <line x1={i * BOARD} y1={0} x2={i * BOARD} y2={3 * BOARD} />
          <line x1={0} y1={i * BOARD} x2={3 * BOARD} y2={i * BOARD} />
        </g>
      ))}
    </g>
  </>
);

// For the still picture (animations reduced): a few moves of a real game
const stillPlay = (): Play => {
  let game = newGameState();
  const marks: Mark[] = [];
  const moves = [[4, 0], [0, 4], [4, 4], [4, 2], [2, 6], [6, 4], [4, 8], [8, 1], [1, 3]];
  for (const [b, c] of moves) {
    if (!isValidMove(game, b, c)) continue;
    marks.push({ board: b, cell: c, side: game.currentPlayer });
    game = applyMove(game, b, c);
  }
  return { game, marks, ending: false };
};

const fresh = (): Play => ({ game: newGameState(), marks: [], ending: false });

/** Home page background: soft glows in the players' colors, the game's grid lying in
 * perspective under a slowly drifting camera, and a ghost game playing itself on it.
 * A pool of light follows each move and lights the grid around it in the color of
 * the player; a won game is crossed out by a glowing line, then dissolves. */
const HomeBackground = () => {
  const ids = useId().replace(/:/g, "");
  const { reduceMotion } = useAppearance();
  // Known from the first render (pages render in the browser only): no animated frame
  // before the still picture
  const [systemReduced, setSystemReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setSystemReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const still = reduceMotion || systemReduced;

  const [play, setPlay] = useState<Play>(() => (still ? stillPlay() : fresh()));

  useEffect(() => {
    if (still) {
      setPlay(stillPlay());
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let current = fresh();
    setPlay(current);
    const step = () => {
      // Hidden tab: nothing to see, nothing to compute
      if (document.hidden) {
        timer = setTimeout(step, MOVE_MS);
        return;
      }
      const move = getBoardOutcome(current.game) ? null : randomMove(current.game);
      if (!move) {
        // Over: the result stays a moment, the marks dissolve, a new game starts
        timer = setTimeout(() => {
          current = { ...current, ending: true };
          setPlay(current);
          timer = setTimeout(() => {
            current = fresh();
            setPlay(current);
            timer = setTimeout(step, MOVE_MS);
          }, DISSOLVE_MS);
        }, REST_MS);
        return;
      }
      const [board, cell] = move;
      current = {
        game: applyMove(current.game, board, cell),
        marks: [...current.marks, { board, cell, side: current.game.currentPlayer }],
        ending: false,
      };
      setPlay(current);
      timer = setTimeout(step, MOVE_MS);
    };
    timer = setTimeout(step, 700);
    return () => clearTimeout(timer);
  }, [still]);

  const { game, marks, ending } = play;
  const last = marks[marks.length - 1] ?? null;
  // The light rests where the last move landed (the middle before the first one)
  const light = last ? center(last.board, last.cell) : { x: 450, y: 450 };
  const lightSide: Side = last ? last.side : "X";
  const line = getWinningLine(game.winners);
  const over = !!getBoardOutcome(game);
  // The board to play next, while the game goes on
  const forced = over || ending ? null : game.activeBoard;
  const color = (side: Side) => (side === "X" ? styles.x : styles.o);
  const at = { transform: `translate(${light.x}px, ${light.y}px)` };

  return (
    <div className={`${styles.scene} ${still ? styles.still : ""}`} aria-hidden="true">
      <div className={`${styles.glow} ${styles.glowX}`} />
      <div className={`${styles.glow} ${styles.glowO}`} />

      <div className={styles.camera}>
        <div className={styles.orbit}>
          <svg className={styles.grid} viewBox="-40 -40 980 980">
            <defs>
              <radialGradient id={`${ids}-pool`}>
                <stop offset="0" stopColor="#fff" stopOpacity="1" />
                <stop offset="0.45" stopColor="#fff" stopOpacity="0.45" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
              {/* One per player: a gradient takes its colors where it is defined */}
              {(["X", "O"] as const).map((side) => (
                <radialGradient key={side} id={`${ids}-floor${side}`}>
                  <stop offset="0" style={{ stopColor: `var(--primary-${side.toLowerCase()})`, stopOpacity: 0.3 }} />
                  <stop offset="1" style={{ stopColor: `var(--primary-${side.toLowerCase()})`, stopOpacity: 0 }} />
                </radialGradient>
              ))}
              <mask id={`${ids}-light`} maskUnits="userSpaceOnUse" x="-40" y="-40" width="980" height="980">
                <circle className={styles.follow} r={250} fill={`url(#${ids}-pool)`} style={at} />
              </mask>
            </defs>

            {/* The floor's own light, under the grid */}
            <circle className={styles.follow} r={240} fill={`url(#${ids}-floor${lightSide})`} style={at} />

            {/* The board to play next */}
            {forced !== null && (
              <rect
                key={`forced-${marks.length}`}
                className={`${styles.forced} ${color(game.currentPlayer)}`}
                x={(forced % 3) * BOARD + 10}
                y={Math.floor(forced / 3) * BOARD + 10}
                width={BOARD - 20}
                height={BOARD - 20}
                rx={24}
              />
            )}

            <g className={styles.dim}>
              <GridLines />
            </g>
            {/* The same lines lit around the last move, in its player's color */}
            <g className={`${styles.lit} ${color(lightSide)}`} mask={`url(#${ids}-light)`}>
              <GridLines />
            </g>

            {/* Boards won: tinted, and a big mark over them */}
            {game.winners.map((w, b) =>
              w ? (
                <g key={`won-${b}`} className={`${styles.fadeable} ${ending ? styles.dissolve : ""}`}>
                  <rect
                    className={`${styles.wonBoard} ${color(w)}`}
                    x={(b % 3) * BOARD + 14}
                    y={Math.floor(b / 3) * BOARD + 14}
                    width={BOARD - 28}
                    height={BOARD - 28}
                    rx={22}
                  />
                  <Glyph side={w} {...boardCenter(b)} size={BOARD * 0.56} className={`${styles.mark} ${styles.won} ${color(w)}`} />
                </g>
              ) : null
            )}

            {/* The moves, the newest glowing, each with a ripple where it lands */}
            {marks.map((m, i) => {
              const { x, y } = center(m.board, m.cell);
              // The still picture has no newest move to animate
              const newest = i === marks.length - 1 && !ending && !still;
              return (
                <g
                  key={`${m.board}-${m.cell}`}
                  className={`${styles.fadeable} ${ending ? styles.dissolve : ""}`}
                  // Dissolves from the last move back to the first
                  style={{ transitionDelay: ending ? `${(marks.length - i) * 16}ms` : "0ms" }}
                >
                  {newest && <circle className={`${styles.ripple} ${color(m.side)}`} cx={x} cy={y} r={CELL * 0.42} />}
                  <Glyph
                    side={m.side}
                    x={x}
                    y={y}
                    size={CELL * 0.46}
                    className={`${styles.mark} ${newest ? styles.newest : ""} ${color(m.side)}`}
                  />
                </g>
              );
            })}

            {/* A won game: a glowing line through the three boards */}
            {line && (
              <g className={`${styles.fadeable} ${ending ? styles.dissolve : ""}`}>
                <path
                  className={`${styles.winLine} ${color(game.winners[line[0]]!)}`}
                  d={`M${boardCenter(line[0]).x} ${boardCenter(line[0]).y}L${boardCenter(line[2]).x} ${boardCenter(line[2]).y}`}
                  pathLength={1}
                />
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Specks of light drifting up, for depth */}
      {!still && (
        <div className={styles.specks}>
          {SPECKS.map(([left, size, duration, delay], i) => (
            <span
              key={i}
              className={i % 2 ? styles.o : styles.x}
              style={{
                left: `${left}%`,
                width: size,
                height: size,
                animationDuration: `${duration}s`,
                animationDelay: `-${delay}s`,
              }}
            />
          ))}
        </div>
      )}

      <div className={styles.veil} />
    </div>
  );
};

export default HomeBackground;
