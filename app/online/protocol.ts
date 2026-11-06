// Messages exchanged between the online game pages and the rooms API (app/api/rooms).
import type { Clocks, GameState, Move, Outcome, Side } from "../game/rules";
import type { PublicProfile } from "../account/protocol";
import type { RankedRating, RatingChange } from "../ranked/protocol";
import type { SideChoice } from "../game/side";

export const CODE_LENGTH = 6;
// No 0/O or 1/I/L, so a code read aloud or copied by hand is not ambiguous
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const cleanCode = (raw: string) =>
  raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, CODE_LENGTH);

export const isRoomCode = (code: string) =>
  code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));

/** Longest chrono a room accepts, in seconds per player */
export const MAX_CLOCK_SECONDS = 3600;

/** After this long offline, the other player may claim the win */
export const CLAIM_AFTER_MS = 2 * 60_000;

export type CreateRoomRequest = { side: SideChoice; clock: number };
export type JoinResponse = { code: string; token: string; you: Side };

export type RoomAction =
  | { type: "join" }
  | { type: "move"; board: number; cell: number }
  | { type: "rematch" }
  | { type: "resign" }
  | { type: "claim" }
  | { type: "leave" }
  /** Asks the opponent to take back your last move (and their reply, if any) */
  | { type: "takeback" }
  /** Withdraws your request */
  | { type: "takeback-cancel" }
  /** Answers the opponent's request */
  | { type: "takeback-answer"; accept: boolean }
  /** An open page of the player says it is still there, or (gone) that it closes */
  | { type: "presence"; page: string; gone?: boolean };

/** How often an open room page says it is still there */
export const PRESENCE_BEAT_MS = 5000;

export type RoomError =
  | "bad-request"
  | "not-found"
  | "full"
  | "forbidden"
  | "waiting"
  | "not-your-turn"
  | "invalid-move"
  | "game-over"
  | "not-over"
  | "opponent-left"
  | "not-claimable"
  | "no-takeback"
  | "too-many-rooms"
  | "storage-unavailable"
  | "network";

export const ERROR_MESSAGES: Record<RoomError, string> = {
  "bad-request": "Requête invalide.",
  "not-found": "Ce salon n'existe pas ou a expiré.",
  full: "Ce salon est déjà complet.",
  forbidden: "Tu ne fais pas partie de ce salon.",
  waiting: "Ton ami n'a pas encore rejoint le salon.",
  "not-your-turn": "Ce n'est pas ton tour.",
  "invalid-move": "Coup impossible.",
  "game-over": "La partie est terminée.",
  "not-over": "La partie n'est pas terminée.",
  "opponent-left": "Ton ami a quitté le salon.",
  "not-claimable": "Ton ami n'est pas absent depuis assez longtemps.",
  "no-takeback": "Il n'y a pas de coup à reprendre.",
  "too-many-rooms": "Trop de salons ouverts, réessaie dans quelques minutes.",
  "storage-unavailable": "Le serveur est indisponible pour l'instant, réessaie plus tard.",
  network: "Impossible de joindre le serveur. Vérifie ta connexion.",
};

/** by: who asks; moves: how many moves would be taken back (theirs, and the reply) */
export type TakebackRequest = { by: Side; moves: number };

export type PlayerInfo = {
  /** Took a seat in the room */
  joined: boolean;
  /** Has the room open right now */
  online: boolean;
  /** Milliseconds offline when the view was sent, null while online */
  offlineFor: number | null;
  /** Left the room for good */
  left: boolean;
  /** Asked for a rematch after the game */
  rematch: boolean;
  /** Pseudo and avatar of a logged-in player, null for a guest */
  profile: PublicProfile | null;
};

/** The room as seen by one of its players, pushed on every change */
export type RoomView = {
  code: string;
  you: Side;
  /** Game number in this room, sides swap at each rematch */
  round: number;
  /** Seconds per player, 0 = no chrono */
  clockLimit: number;
  players: Record<Side, PlayerInfo>;
  game: GameState;
  /** Time left when the view was sent */
  clocks: Clocks;
  clockRunning: boolean;
  outcome: Outcome;
  /** Moves played this round */
  moves: number;
  /** Those moves in order, once the round is over (null before, and for a round begun
   * before they were kept) */
  history: Move[] | null;
  /** The result of this round went into the players' stats */
  recorded: boolean;
  /** A ranked game: each player's rating before it (null for a game with a friend) */
  ranked: Record<Side, RankedRating> | null;
  /** The ranked game is rated: ratings before and after (arrives just after the result) */
  ratings: Record<Side, RatingChange> | null;
  /** A request to take back moves, waiting for the other player's answer */
  takeback: TakebackRequest | null;
  /** You may ask to take back your last move now */
  canTakeback: boolean;
  /** Your request was just refused (until the position changes) */
  takebackRefused: boolean;
  /** The ranked game could not be rated (an account was deleted): no points */
  unrated: boolean;
  /** How long the other player must have been away before the win can be claimed */
  claimAfter: number;
};
