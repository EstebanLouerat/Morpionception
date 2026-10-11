import type { IconName } from "../ui/Icon";

export type ModeId = "local" | "ai" | "timed" | "ranked" | "local2v2" | "fun";

export type GameMode = {
  id: ModeId;
  name: string;
  tagline: string;
  icon: IconName;
  /** false = shown in the menu as "Bientôt" */
  available: boolean;
  /** Display names of the two sides */
  players: { X: string; O: string };
  /** Seconds per player for timed modes (shown in the player bar) */
  clock?: number;
  requiresAccount?: boolean;
};

export const MODES: GameMode[] = [
  {
    id: "local",
    name: "Local 1v1",
    tagline: "Deux joueurs, un seul écran.",
    icon: "device",
    available: true,
    players: { X: "Joueur 1", O: "Joueur 2" },
  },
  {
    id: "ai",
    name: "Contre l'IA",
    tagline: "Affronte l'ordinateur, du débutant à l'expert.",
    icon: "bot",
    available: false,
    players: { X: "Toi", O: "IA" },
  },
  {
    id: "timed",
    name: "Chrono",
    tagline: "Temps limité pour toute la partie : réfléchis vite.",
    icon: "clock",
    available: false,
    players: { X: "Joueur 1", O: "Joueur 2" },
    clock: 180,
  },
  {
    id: "ranked",
    name: "Classé",
    tagline: "Affronte des joueurs en ligne et grimpe au classement.",
    icon: "trophy",
    available: false,
    players: { X: "Toi", O: "Adversaire" },
    requiresAccount: true,
  },
  {
    id: "local2v2",
    name: "Local 2v2",
    tagline: "Deux équipes de deux, chacun joue à son tour.",
    icon: "users",
    available: false,
    players: { X: "Équipe X", O: "Équipe O" },
  },
  {
    id: "fun",
    name: "Modes fun",
    tagline: "Variantes de règles délirantes pour changer.",
    icon: "sparkles",
    available: false,
    players: { X: "Joueur 1", O: "Joueur 2" },
  },
];

export const DEFAULT_MODE = MODES[0];

/** Mode from an id (e.g. the ?mode= URL param), falling back to a playable one */
export const getMode = (id: string | null | undefined): GameMode => {
  const mode = MODES.find((m) => m.id === id);
  return mode?.available ? mode : DEFAULT_MODE;
};
