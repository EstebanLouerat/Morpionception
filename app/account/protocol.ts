// Messages exchanged between the account pages and the account API (app/api/account).
import type { OutcomeReason, Side } from "../game/rules";
import type { AvatarId, ColorId } from "./profile";

/** What everybody can see of a player (e.g. the opponent in an online game) */
export type PublicProfile = { pseudo: string; avatar: AvatarId; color: ColorId };

/** Online games of a player, counted when each game ends */
export type Stats = {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  /** Wins in a row, now and at best (a loss or a draw ends the series) */
  streak: number;
  bestStreak: number;
  /** Small boards claimed */
  boardsWon: number;
  asX: { played: number; wins: number };
  asO: { played: number; wins: number };
};

export type GameResult = "win" | "loss" | "draw";

export type GameRecord = {
  at: number;
  result: GameResult;
  reason: OutcomeReason;
  side: Side;
  opponent: ({ kind: "player" } & PublicProfile) | { kind: "guest" } | { kind: "deleted" };
  /** Small boards won by each player */
  boards: { mine: number; theirs: number };
};

export type AccountView = PublicProfile & {
  id: string;
  createdAt: number;
  stats: Stats;
  /** Latest games first */
  recent: GameRecord[];
};

export type AccountError =
  | "bad-request"
  | "unauthorized"
  | "bad-credentials"
  | "invalid-pseudo"
  | "invalid-password"
  | "pseudo-taken"
  | "too-many-attempts"
  | "accounts-full"
  | "storage-unavailable"
  | "forbidden-origin"
  | "network";

export const ACCOUNT_ERROR_MESSAGES: Record<AccountError, string> = {
  "bad-request": "Requête invalide.",
  unauthorized: "Ta session a expiré, reconnecte-toi.",
  "bad-credentials": "Pseudo ou mot de passe incorrect.",
  "invalid-pseudo": "Ce pseudo n'est pas valide.",
  "invalid-password": "Ce mot de passe n'est pas valide.",
  "pseudo-taken": "Ce pseudo est déjà pris.",
  "too-many-attempts": "Trop de tentatives, réessaie dans 15 minutes.",
  "accounts-full": "Le serveur n'accepte plus de nouveaux comptes pour l'instant.",
  "storage-unavailable": "Les comptes sont indisponibles pour l'instant, réessaie plus tard.",
  "forbidden-origin": "Requête refusée.",
  network: "Impossible de joindre le serveur. Vérifie ta connexion.",
};

export const emptyStats = (): Stats => ({
  played: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  streak: 0,
  bestStreak: 0,
  boardsWon: 0,
  asX: { played: 0, wins: 0 },
  asO: { played: 0, wins: 0 },
});
