"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import styles from "./Widgets.module.css";
import { LINES } from "../../game/rules";

const NAMES = ["Le coin", "Le bord", "Le coin", "Le bord", "Le centre", "Le bord", "Le coin", "Le bord", "Le coin"];

/** Tap a cell (or a board of the big grid): the lines it belongs to are drawn */
const LinesDemo = ({ scale }: { scale: "cases" | "grilles" }) => {
  const [pick, setPick] = useState(4);
  const lines = LINES.filter((line) => line.includes(pick));
  const at = (i: number) => ({ x: 50 + (i % 3) * 100, y: 50 + Math.floor(i / 3) * 100 });
  const what = scale === "cases" ? "case" : "grille";
  return (
    <div className={styles.widget}>
      <div className={`${styles.lines} ${scale === "grilles" ? styles.linesBig : ""}`}>
        {Array.from({ length: 9 }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`${styles.lineCell} ${i === pick ? styles.picked : ""}`}
            onClick={() => setPick(i)}
            aria-pressed={i === pick}
            aria-label={`${NAMES[i]} : ${LINES.filter((l) => l.includes(i)).length} lignes`}
          >
            {scale === "grilles" && (
              <span className={styles.boardIcon} aria-hidden="true">
                {Array.from({ length: 9 }, (_, k) => (
                  <i key={k} />
                ))}
              </span>
            )}
            <span className={styles.lineCount}>{LINES.filter((l) => l.includes(i)).length}</span>
          </button>
        ))}
        <svg className={styles.lineLayer} viewBox="0 0 300 300" aria-hidden="true">
          {lines.map((line) => {
            const a = at(line[0]);
            const b = at(line[2]);
            return (
              <motion.line
                key={`${pick}-${line.join("")}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
              />
            );
          })}
        </svg>
      </div>
      <p className={styles.caption} role="status" aria-live="polite">
        {NAMES[pick]} : {scale === "cases" ? "cette case" : "cette grille"} sert à <b>{lines.length} lignes</b>
        {lines.length === 4 ? `, plus que toute autre ${what}.` : lines.length === 2 ? `, le moins possible.` : "."}
      </p>
    </div>
  );
};

export default LinesDemo;
