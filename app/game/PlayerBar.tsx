import styles from "./PlayerBar.module.css";
import Icon from "../ui/Icon";
import Avatar from "../account/Avatar";
import type { PublicProfile } from "../account/protocol";
import type { GameMode } from "./modes";
import { formatClock } from "./clock";

type Side = "X" | "O";

// Below this, the running clock turns red
const LOW_TIME_MS = 10_000;

type ChipProps = {
  side: Side;
  name: string;
  active: boolean;
  won: boolean;
  lost: boolean;
  timedOut: boolean;
  /** Remaining milliseconds, when the chrono option is on */
  clock?: number;
  /** Replaces "À jouer" (e.g. "Hors ligne") */
  status?: string;
  /** Avatar of a logged-in player, as a badge on the symbol */
  profile?: PublicProfile | null;
};

const PlayerChip = ({
  side,
  name,
  active,
  won,
  lost,
  timedOut,
  clock,
  status,
  profile,
}: ChipProps) => (
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
    <span className={styles.symbol}>
      {side}
      {profile && (
        <Avatar
          avatar={profile.avatar}
          color={profile.color}
          size={20}
          className={styles.avatarBadge}
        />
      )}
    </span>
    <span className={styles.info}>
      <span className={styles.name}>{name}</span>
      <span className={styles.status}>
        {won
          ? "Victoire !"
          : timedOut
          ? "Temps écoulé"
          : status ?? (active ? "À jouer" : " ")}
      </span>
    </span>
    {won && <Icon name="trophy" size={20} className={styles.trophy} />}
    {clock !== undefined && (
      <span
        className={`${styles.clock} ${
          (active || timedOut) && clock < LOW_TIME_MS ? styles.lowTime : ""
        }`}
      >
        {formatClock(clock)}
      </span>
    )}
  </div>
);

type PlayerBarProps = {
  mode: GameMode;
  current: Side | null;
  winner: Side | null;
  isDraw: boolean;
  /** Time left per player, null without chrono */
  clocks: { X: number; O: number } | null;
  timedOut: Side | null;
  /** Status of a player, instead of "À jouer" (e.g. offline) */
  status?: Partial<Record<Side, string>>;
  /** Screen reader announcement, instead of the one built from the names */
  announcement?: string;
  /** Profiles of logged-in players (online) */
  profiles?: Partial<Record<Side, PublicProfile | null>>;
};

/** Both players, whose turn it is, their clocks, and later their avatars */
const PlayerBar = ({
  mode,
  current,
  winner,
  isDraw,
  clocks,
  timedOut,
  status,
  announcement,
  profiles,
}: PlayerBarProps) => {
  const over = !!winner || isDraw;
  const chip = (side: Side) => (
    <PlayerChip
      side={side}
      name={mode.players[side]}
      active={!over && current === side}
      won={winner === side}
      lost={!!winner && winner !== side}
      timedOut={timedOut === side}
      clock={clocks?.[side]}
      status={status?.[side]}
      profile={profiles?.[side]}
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
        {announcement ??
          (winner
            ? `${mode.players[winner]} a gagné${timedOut ? " au temps" : ""}`
            : isDraw
            ? "Égalité"
            : current && `Au tour de ${mode.players[current]} (${current})`)}
      </span>
    </div>
  );
};

export default PlayerBar;
