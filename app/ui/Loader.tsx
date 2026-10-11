import { CSSProperties } from "react";
import styles from "./Loader.module.css";

// Cells fill in this order, alternating X and O (ends on a draw),
// then the grid clears and loops
const FILL_ORDER = [0, 4, 8, 1, 7, 6, 2, 5, 3];

type LoaderProps = { fullscreen?: boolean; label?: string };

const Loader = ({ fullscreen, label = "Chargement…" }: LoaderProps) => (
  <div
    className={`${styles.wrap} ${fullscreen ? styles.fullscreen : ""}`}
    role="status"
    aria-live="polite"
  >
    <div className={styles.grid} aria-hidden="true">
      {Array.from({ length: 9 }, (_, cell) => {
        const turn = FILL_ORDER.indexOf(cell);
        const symbol = turn % 2 === 0 ? "X" : "O";
        return (
          <span
            key={cell}
            className={`${styles.cell} ${styles[symbol.toLowerCase()]}`}
            data-symbol={symbol}
            style={{ "--i": turn } as CSSProperties}
          />
        );
      })}
    </div>
    <span className={styles.label}>{label}</span>
  </div>
);

export default Loader;
