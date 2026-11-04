import { useId } from "react";
import styles from "./Crown.module.css";
import type { Crown as CrownPlace } from "../account/protocol";

const METALS: Record<CrownPlace, { light: string; mid: string; dark: string; label: string }> = {
  1: { light: "#fff3b0", mid: "#f7c948", dark: "#a8740c", label: "Couronne d'or : 1er du classement" },
  2: { light: "#ffffff", mid: "#c9d3dd", dark: "#6b7a89", label: "Couronne d'argent : 2e du classement" },
  3: { light: "#ffd9b3", mid: "#d08a4c", dark: "#7a4419", label: "Couronne de bronze : 3e du classement" },
};

type CrownProps = { place: CrownPlace; size?: number; className?: string };

/** Crown of the 3 best ranked players: gold, silver, bronze */
const Crown = ({ place, size = 24, className }: CrownProps) => {
  const id = useId().replace(/:/g, "");
  const metal = METALS[place];
  return (
    <svg
      viewBox="0 0 32 24"
      width={size}
      height={(size * 24) / 32}
      className={`${styles.crown} ${className ?? ""}`}
      role="img"
      aria-label={metal.label}
    >
      <title>{metal.label}</title>
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={metal.light} />
          <stop offset="0.45" stopColor={metal.mid} />
          <stop offset="1" stopColor={metal.dark} />
        </linearGradient>
      </defs>
      <path
        d="M3 8 L9.5 13 L16 3 L22.5 13 L29 8 L26.5 21 H5.5 Z"
        fill={`url(#${id}-metal)`}
        stroke={metal.dark}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="3" cy="7.5" r="2" fill={metal.mid} stroke={metal.dark} strokeWidth="1" />
      <circle cx="16" cy="2.6" r="2.2" fill={metal.mid} stroke={metal.dark} strokeWidth="1" />
      <circle cx="29" cy="7.5" r="2" fill={metal.mid} stroke={metal.dark} strokeWidth="1" />
      <circle cx="16" cy="16" r="2" fill="#ff5a7a" stroke={metal.dark} strokeWidth="0.8" />
      {/* A glint crosses the crown now and then */}
      <path className={styles.glint} d="M8 21 L12 9 H15 L11 21 Z" fill="#fff" fillOpacity="0.6" />
    </svg>
  );
};

export default Crown;
