// The latest games finished on this device, of every mode, kept to be analysed later
import { createPersistedStore } from "../lib/persistedStore";
import type { Move, OutcomeReason, Side } from "../game/rules";
import { decodeMoves, encodeMoves } from "./notation";

export type RecentMode = "ia" | "local" | "ami" | "classe";

export type RecentGame = {
  at: number;
  mode: RecentMode;
  /** Encoded moves (see encodeMoves) */
  moves: string;
  /** The side played on this device (null: both, a game on one screen) */
  you: Side | null;
  /** Who played the other side: "IA Expert", a pseudo… */
  opponent: string;
  winner: Side | null;
  reason: OutcomeReason;
};

const KEEP = 12;
const MODES: RecentMode[] = ["ia", "local", "ami", "classe"];
const REASONS: OutcomeReason[] = ["line", "draw", "timeout", "resign", "claim"];

const valid = (g: Partial<RecentGame>): g is RecentGame =>
  typeof g.at === "number" &&
  MODES.includes(g.mode as RecentMode) &&
  typeof g.moves === "string" &&
  decodeMoves(g.moves).length * 2 === g.moves.length &&
  (g.you === null || g.you === "X" || g.you === "O") &&
  typeof g.opponent === "string" &&
  (g.winner === null || g.winner === "X" || g.winner === "O") &&
  REASONS.includes(g.reason as OutcomeReason);

const store = createPersistedStore<{ games: RecentGame[] }>("morpionception_recent_games", { games: [] }, (raw) => ({
  games: Array.isArray(raw.games) ? raw.games.filter(valid).slice(0, KEEP) : [],
}));

export const useRecentGames = () => store.use().games;

/** A game just finished: kept first (once: the same game shown again is not added) */
export const addRecentGame = (game: Omit<RecentGame, "at" | "moves"> & { moves: Move[] }) => {
  const moves = encodeMoves(game.moves);
  if (game.moves.length < 2) return;
  const { games } = store.get();
  if (games.some((g) => g.moves === moves && g.mode === game.mode)) return;
  store.set({ games: [{ ...game, moves, at: Date.now() }, ...games].slice(0, KEEP) });
};

/** The link to the analysis of a game */
export const analysisHref = (moves: string | Move[], you: Side | null = null) =>
  `/analyse?coups=${typeof moves === "string" ? moves : encodeMoves(moves)}${you ? `&toi=${you}` : ""}`;
