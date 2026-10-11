import styles from "./PlayerBar.module.css";
import Icon from "../ui/Icon";
import type { GameMode } from "./modes";

type Side = "X" | "O";

const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

type ChipProps = {
  side: Side;
  name: string;
  active: boolean;
  won: boolean;
  lost: boolean;
  /** Remaining seconds, for timed modes */
  clock?: number;
};

const PlayerChip = ({ side, name, active, won, lost, clock }: ChipProps) => (
  <div
    className={[
      styles.chip,
      styles[side.toLowerCase()],
      active && styles.active,
      won && styles.won,
      lost && styles.lost,
    ]
      .filter(Boolean)
      .join(" ")}
  >
    <span className={styles.symbol}>{side}</span>
    <span className={styles.info}>
      <span className={styles.name}>{name}</span>
      <span className={styles.status}>
        {won ? "Victoire !" : active ? "À jouer" : " "}
      </span>
    </span>
    {won && <Icon name="trophy" size={20} className={styles.trophy} />}
    {clock !== undefined && <span className={styles.clock}>{formatClock(clock)}</span>}
  </div>
);

type PlayerBarProps = {
  mode: GameMode;
  current: Side | null;
  winner: Side | null;
  isDraw: boolean;
};

/** Both players, whose turn it is, and later their clocks / avatars */
const PlayerBar = ({ mode, current, winner, isDraw }: PlayerBarProps) => {
  const over = !!winner || isDraw;
  const chip = (side: Side) => (
    <PlayerChip
      side={side}
      name={mode.players[side]}
      active={!over && current === side}
      won={winner === side}
      lost={!!winner && winner !== side}
      clock={mode.clock}
    />
  );

  return (
    <div className={styles.bar}>
      {chip("X")}
      <div className={styles.vs}>
        <span>{isDraw ? "=" : "VS"}</span>
        <small>{mode.name}</small>
      </div>
      {chip("O")}
      <span className={styles.srOnly} aria-live="polite">
        {winner
          ? `${mode.players[winner]} a gagné`
          : isDraw
          ? "Égalité"
          : current && `Au tour de ${mode.players[current]} (${current})`}
      </span>
    </div>
  );
};

export default PlayerBar;
