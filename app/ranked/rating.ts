// Ranked rating: Glicko updates (chess.com's system) and the ladder of tiers and
// divisions (Valorant's steps). Pure functions, shared by the server and the pages.
import { PLACEMENT_GAMES, RATING, TIERS, type Tier } from "./config";

/** A player's rating as stored */
export type Rating = {
  rating: number;
  /** Glicko rating deviation: how uncertain the rating is */
  deviation: number;
  /** Rated games played */
  games: number;
  /** Last rated game, for the uncertainty that grows back with time */
  lastPlayedAt: number | null;
};

export const newRating = (): Rating => ({
  rating: RATING.start,
  deviation: RATING.startDeviation,
  games: 0,
  lastPlayedAt: null,
});

const DAY_MS = 24 * 60 * 60_000;
const Q = Math.LN10 / 400;

/** Uncertainty as of now: it grows back while the player does not play */
export const currentDeviation = (r: Rating, now: number) => {
  if (r.lastPlayedAt === null) return Math.min(r.deviation, RATING.startDeviation);
  const { startDeviation: start, settledDeviation: settled, daysToForget } = RATING;
  // Grows as the square root of time: from settled to start in daysToForget days
  const perDay = (start * start - settled * settled) / Math.max(1, daysToForget);
  const days = Math.max(0, now - r.lastPlayedAt) / DAY_MS;
  return Math.min(start, Math.sqrt(r.deviation * r.deviation + perDay * days));
};

/** How much a result against this opponent says, smaller when their rating is uncertain */
const weight = (deviation: number) =>
  1 / Math.sqrt(1 + (3 * Q * Q * deviation * deviation) / (Math.PI * Math.PI));

/** Chance of winning (a draw counts half) against this opponent */
export const expectedScore = (rating: number, opponent: number, opponentDeviation: number) =>
  1 / (1 + Math.pow(10, (-weight(opponentDeviation) * (rating - opponent)) / 400));

/** Glicko update of one player after one game: score 1 win, 0.5 draw, 0 loss */
const update = (me: Rating, opponent: Rating, score: number, now: number): Rating => {
  const deviation = currentDeviation(me, now);
  const opponentDeviation = currentDeviation(opponent, now);
  const g = weight(opponentDeviation);
  const expected = expectedScore(me.rating, opponent.rating, opponentDeviation);
  const information = Q * Q * g * g * expected * (1 - expected);
  const precision = 1 / (deviation * deviation) + information;
  const rating = me.rating + (Q / precision) * g * (score - expected);
  return {
    rating: Math.max(RATING.floor, rating),
    // Every game makes the rating more certain, down to the settled uncertainty
    deviation: Math.max(RATING.settledDeviation, Math.sqrt(1 / precision)),
    games: me.games + 1,
    lastPlayedAt: now,
  };
};

/** Both players' ratings after a game; scoreA is A's result (1, 0.5 or 0) */
export const rateGame = (a: Rating, b: Rating, scoreA: number, now: number) => ({
  a: update(a, b, scoreA, now),
  b: update(b, a, 1 - scoreA, now),
});

// --- Ladder ---

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export type Rank = {
  /** Placement games done: until then the rank is hidden */
  placed: boolean;
  /** Placement games left */
  placementLeft: number;
  tier: Tier;
  /** Division in the tier, from 1 (lowest) */
  division: number;
  /** "Or II", or the tier name alone when it has one division */
  label: string;
  /** The same with the short tier name, for tight spots */
  shortLabel: string;
  /** Position on the ladder, to compare two ranks (bigger is higher) */
  step: number;
  /** Rating where this division starts and the next one starts (null at the top) */
  from: number;
  to: number | null;
  /** Way through the division, from 0 to 1 */
  progress: number;
};

const labelOf = (name: string, tier: Tier, division: number) =>
  tier.divisions > 1 ? `${name} ${ROMAN[division - 1] ?? division}` : name;

/** Rank of a rating, after `games` rated games */
export const rankOf = (rating: number, games: number): Rank => {
  const shown = Math.round(rating);
  let tierIndex = 0;
  while (tierIndex + 1 < TIERS.length && shown >= TIERS[tierIndex + 1].from) tierIndex++;
  const tier = TIERS[tierIndex];
  const next = TIERS[tierIndex + 1];
  const steps = TIERS.slice(0, tierIndex).reduce((n, t) => n + t.divisions, 0);
  let division = 1;
  let from = tier.from;
  let to: number | null = next ? next.from : null;
  if (next) {
    const width = (next.from - tier.from) / tier.divisions;
    division = Math.min(tier.divisions, Math.max(1, Math.floor((shown - tier.from) / width) + 1));
    from = tier.from + (division - 1) * width;
    to = from + width;
  }
  const progress = to === null ? 1 : Math.min(1, Math.max(0, (shown - from) / (to - from)));
  return {
    placed: games >= PLACEMENT_GAMES,
    placementLeft: Math.max(0, PLACEMENT_GAMES - games),
    tier,
    division,
    label: labelOf(tier.name, tier, division),
    shortLabel: labelOf(tier.short ?? tier.name, tier, division),
    step: steps + division - 1,
    from: Math.round(from),
    to: to === null ? null : Math.round(to),
    progress,
  };
};

export type RankChangeKind =
  /** Placement games just finished: the rank is revealed */
  | "placement"
  /** Up a tier (e.g. Argent III → Or I) */
  | "promotion"
  /** Up a division in the same tier */
  | "up"
  | "down"
  /** Down a tier */
  | "demotion"
  | "same";

/** How the rank moved with a game */
export const rankChange = (before: Rank, after: Rank): RankChangeKind => {
  if (!after.placed) return "same";
  if (!before.placed) return "placement";
  if (after.step > before.step) return after.tier.id !== before.tier.id ? "promotion" : "up";
  if (after.step < before.step) return after.tier.id !== before.tier.id ? "demotion" : "down";
  return "same";
};
