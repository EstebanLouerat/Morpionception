import { useId } from "react";
import styles from "./RankEmblem.module.css";
import type { Rank } from "./rating";

type RankEmblemProps = {
  /** The rank to draw; an unplaced rank is drawn as a mystery emblem */
  rank: Rank;
  size?: number;
  className?: string;
  /** Label for screen readers; without it the emblem is decorative */
  title?: string;
};

// The shield every emblem is built on, in a 100 × 100 box
const SHIELD = "M50 6 L86 19 V50 C86 73 70 88 50 95 C30 88 14 73 14 50 V19 Z";
const INNER = "M50 14 L78 24.5 V50 C78 68 66 80 50 86 C34 80 22 68 22 50 V24.5 Z";

/** Emblem of a tier: a shield in the tier colors with the morpion grid, decorated more
 * and more richly up the ladder, and one pip per division */
const RankEmblem = ({ rank, size = 64, className, title }: RankEmblemProps) => {
  const id = useId().replace(/:/g, "");
  const { tier } = rank;
  const placed = rank.placed;
  const color = placed ? tier.color : "#9aa3ad";
  const dark = placed ? tier.dark : "#4a525c";
  const level = placed ? tier.id : "placement";
  const top = ["platine", "diamant", "maitre", "mastermind"].includes(level);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`${styles.emblem} ${styles[level] ?? ""} ${className ?? ""}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Rays behind the top tiers */}
      {level === "mastermind" && (
        <g className={styles.rays}>
          {Array.from({ length: 12 }, (_, i) => (
            <path
              key={i}
              d="M50 50 L47 2 L53 2 Z"
              fill={i % 2 ? "#ffe066" : "#b388ff"}
              transform={`rotate(${i * 30} 50 50)`}
            />
          ))}
        </g>
      )}
      {/* Wings from Platine up */}
      {top && (
        <g fill={dark} stroke={color} strokeWidth="1.5">
          <path d="M14 30 C2 30 -2 44 4 54 C8 48 12 46 14 46 Z" />
          <path d="M86 30 C98 30 102 44 96 54 C92 48 88 46 86 46 Z" />
        </g>
      )}
      {/* Crown spikes from Maître up */}
      {(level === "maitre" || level === "mastermind") && (
        <path
          d="M30 14 L34 1 L42 10 L50 0 L58 10 L66 1 L70 14 Z"
          fill={color}
          stroke={dark}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )}

      <path d={SHIELD} fill={`url(#${id}-fill)`} stroke={dark} strokeWidth="3" />
      <path d={INNER} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" />

      {/* Wood grain for the lowest tier */}
      {level === "bois" && (
        <g fill="none" stroke={dark} strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round">
          <path d="M28 30 C40 34 34 44 48 46 C60 48 58 60 72 62" />
          <path d="M26 52 C36 54 40 62 52 64 C60 66 62 74 66 78" />
        </g>
      )}
      {/* Facets for Diamant */}
      {level === "diamant" && (
        <g fill="#fff" fillOpacity="0.16">
          <path d="M50 14 L78 24.5 L50 50 Z" />
          <path d="M22 50 L50 50 L50 86 Z" />
        </g>
      )}

      {placed ? (
        // The morpion grid, with an X in the middle
        <g stroke="#fff" strokeOpacity="0.85" strokeWidth="3.2" strokeLinecap="round">
          <path d="M42 32 V64 M58 32 V64 M34 40 H66 M34 56 H66" />
          <path d="M46.5 44.5 L53.5 51.5 M53.5 44.5 L46.5 51.5" strokeWidth="3.6" />
        </g>
      ) : (
        <text
          x="50"
          y="62"
          textAnchor="middle"
          fontSize="40"
          fontWeight="800"
          fill="#fff"
          fillOpacity="0.9"
        >
          ?
        </text>
      )}

      {/* Shine */}
      <path d="M50 14 L78 24.5 V40 C62 34 40 34 22 44 V24.5 Z" fill={`url(#${id}-shine)`} />

      {/* One pip per division, filled up to the current one */}
      {placed && tier.divisions > 1 && (
        <g>
          {Array.from({ length: tier.divisions }, (_, i) => {
            const x = 50 + (i - (tier.divisions - 1) / 2) * 11;
            return (
              <path
                key={i}
                d={`M${x} 69 l4.5 4.5 l-4.5 4.5 l-4.5 -4.5 Z`}
                fill={i < rank.division ? "#fff" : dark}
                stroke="#fff"
                strokeOpacity="0.8"
                strokeWidth="1.2"
              />
            );
          })}
        </g>
      )}
    </svg>
  );
};

export default RankEmblem;
