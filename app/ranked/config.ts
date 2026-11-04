// Ranked play: everything you may want to tune, in one place.
// After a change, run `npm run ranked:simulate`: it prints how many points a game is
// worth over time, and where a population of players ends up on the ladder.

/** Rating, computed with Glicko like chess.com: each player has a rating and an
 * uncertainty ("deviation"). A new player is very uncertain, so a game moves their
 * rating a lot; every game makes it more certain, so the jumps shrink (the funnel). */
export const RATING = {
  /** Rating of a new player */
  start: 1000,
  /** No rating goes below this */
  floor: 100,
  /** Uncertainty of a new player: the size of the first jumps.
   * 350 ≈ ±160 points for a first game, 250 ≈ ±110, 200 ≈ ±80. */
  startDeviation: 350,
  /** Uncertainty once settled: the size of the jumps at the end of the funnel.
   * 50 ≈ ±7 points per game against an equal opponent, 70 ≈ ±13, 90 ≈ ±20. */
  settledDeviation: 70,
  /** Days without a ranked game for the uncertainty to grow back to startDeviation:
   * a player back from a break moves faster again (chess.com does the same) */
  daysToForget: 365,
};

/** Games played before the rank is shown (Valorant's placement matches). The rating
 * changes during these games too, by large jumps. */
export const PLACEMENT_GAMES = 5;

export type TierId =
  | "bois"
  | "bronze"
  | "argent"
  | "or"
  | "platine"
  | "diamant"
  | "maitre"
  | "mastermind";

export type Tier = {
  id: TierId;
  name: string;
  /** Shorter name for tight spots (the players' chips in a game), if the name is long */
  short?: string;
  /** Rating where the tier starts (the lowest tier also takes every rating below) */
  from: number;
  /** Divisions in the tier, I to III like Valorant: the tier is split into equal steps */
  divisions: number;
  /** Colors of the emblem: main and dark */
  color: string;
  dark: string;
};

/** The ladder, from the bottom. Divisions split each tier into equal steps up to the
 * next tier (the last tier has no top). */
export const TIERS: Tier[] = [
  { id: "bois", name: "Bois", from: 550, divisions: 3, color: "#a47551", dark: "#5d3a1f" },
  { id: "bronze", name: "Bronze", from: 700, divisions: 3, color: "#d08a4c", dark: "#7a4419" },
  { id: "argent", name: "Argent", from: 850, divisions: 3, color: "#c9d3dd", dark: "#6b7a89" },
  { id: "or", name: "Or", from: 1000, divisions: 3, color: "#f7c948", dark: "#a8740c" },
  { id: "platine", name: "Platine", from: 1150, divisions: 3, color: "#4fd6c4", dark: "#11756c" },
  { id: "diamant", name: "Diamant", from: 1300, divisions: 3, color: "#9b8cff", dark: "#4b38c7" },
  { id: "maitre", name: "Maître", from: 1450, divisions: 3, color: "#ff5a7a", dark: "#a3123a" },
  {
    id: "mastermind",
    name: "Morpion Mastermind",
    short: "Mastermind",
    from: 1600,
    divisions: 1,
    color: "#ffe066",
    dark: "#7b2ff7",
  },
];

/** Finding an opponent */
export const MATCHMAKING = {
  /** Chrono per player in ranked games (it starts with the game: no stalling) */
  clockSeconds: 300,
  /** Rating difference accepted at the start of the search */
  rangeStart: 100,
  /** The accepted difference grows by this much per second of waiting, so nobody
   * waits forever when few players are online */
  rangeGrowthPerSecond: 15,
  /** Rated games allowed between the same two players in 24 hours (against farming
   * points with a second account) */
  sameOpponentPerDay: 10,
  /** An opponent who has not opened the game after this many seconds can be left:
   * the game is cancelled, no points lost */
  noShowSeconds: 20,
};

/** The top players page */
export const LEADERBOARD = {
  /** Players shown */
  size: 50,
  /** Only players with a ranked game in the last days (0: everyone). The crowns of
   * the top 3 go to active players too. */
  activeDays: 30,
};
