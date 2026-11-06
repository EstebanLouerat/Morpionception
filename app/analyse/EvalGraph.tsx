"use client";

import { useRef, type PointerEvent } from "react";
import styles from "./Analyse.module.css";
import { ERRORS, type MoveReview, type PositionEval } from "../analysis/review";

type EvalGraphProps = {
  evals: (PositionEval | null)[];
  reviews: (MoveReview | null)[];
  /** The position shown (moves played) */
  ply: number;
  onPick: (ply: number) => void;
};

const W = 1000;
const H = 100;

/** X's chances over the game (above the middle: X is ahead), errors marked by a dot of
 * their color; a tap or a drag goes to that move */
const EvalGraph = ({ evals, reviews, ply, onPick }: EvalGraphProps) => {
  const box = useRef<HTMLDivElement>(null);
  const last = Math.max(1, evals.length - 1);
  const xOf = (i: number) => (i / last) * W;
  const yOf = (x: number) => (1 - x) * H;
  // The curve as far as the analysis has gone (positions are analysed in order)
  const known: [number, number][] = [];
  for (let i = 0; i < evals.length && evals[i]; i++) known.push([xOf(i), yOf(evals[i]!.x)]);
  const line = known.map(([x, y]) => `${x},${y}`).join(" ");
  const area = known.length ? `${known[0][0]},${H / 2} ${line} ${known[known.length - 1][0]},${H / 2}` : "";

  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const rect = box.current!.getBoundingClientRect();
    const at = Math.round(((e.clientX - rect.left) / rect.width) * last);
    onPick(Math.max(0, Math.min(evals.length - 1, at)));
  };

  return (
    <div
      ref={box}
      className={styles.graph}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pick(e);
      }}
      onPointerMove={(e) => e.buttons && pick(e)}
      role="img"
      aria-label="Chances de X au fil de la partie"
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <clipPath id="graph-top">
            <rect x="0" y="0" width={W} height={H / 2} />
          </clipPath>
          <clipPath id="graph-bottom">
            <rect x="0" y={H / 2} width={W} height={H / 2} />
          </clipPath>
        </defs>
        <polygon points={area} className={styles.areaX} clipPath="url(#graph-top)" />
        <polygon points={area} className={styles.areaO} clipPath="url(#graph-bottom)" />
        <line x1="0" y1={H / 2} x2={W} y2={H / 2} className={styles.midLine} vectorEffect="non-scaling-stroke" />
        <polyline points={line} className={styles.curve} vectorEffect="non-scaling-stroke" />
        <line x1={xOf(ply)} y1="0" x2={xOf(ply)} y2={H} className={styles.cursor} vectorEffect="non-scaling-stroke" />
      </svg>
      {/* Dots as elements: round whatever the graph's proportions */}
      {reviews.map((r, i) =>
        r && ERRORS.includes(r.grade) && evals[i + 1] ? (
          <span
            key={i}
            className={`${styles.dot} ${styles[r.grade]}`}
            style={{ left: `${((i + 1) / last) * 100}%`, top: `${(1 - evals[i + 1]!.x) * 100}%` }}
          />
        ) : null
      )}
    </div>
  );
};

export default EvalGraph;
