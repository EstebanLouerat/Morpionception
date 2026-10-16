import type { IconName } from "../ui/Icon";

export type ModeId = "local" | "ai" | "ranked" | "local2v2" | "fun" | "online";

export type GameMode = {
  id: ModeId;
  name: string;
  tagline: string;
  icon: IconName;
  /** false = shown in the menu as "Bientôt" */
  available: boolean;
  /** Display names of the two sides */
  players: { X: string; O: string };
  /** The chrono option (see clock.ts) applies to this mode */
  clockOption?: boolean;
  /** The player picks a side (see side.ts) */
  sideOption?: boolean;
  /** The player picks the AI level (see app/ai/settings.ts) */
  levelOption?: boolean;
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
    clockOption: true,
  },
  {
    id: "ai",
    name: "Contre l'IA",
    tagline: "Affronte l'ordinateur, du débutant à l'expert.",
    icon: "bot",
    available: true,
    // The game screen names the sides from the side picked
    players: { X: "Toi", O: "IA" },
    sideOption: true,
    levelOption: true,
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
    clockOption: true,
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

/** Game against a friend on another device (/jouer/ami), not listed with the modes */
export const ONLINE_MODE: GameMode = {
  id: "online",
  name: "En ligne",
  tagline: "Invite un ami avec un lien, un code de salon ou un QR code.",
  icon: "userPlus",
  available: true,
  // The game screen shows "Toi" and "Ton ami" instead
  players: { X: "Joueur X", O: "Joueur O" },
  clockOption: true,
};

/** The mode has an options screen (/jouer/partie) before the game */
export const hasOptions = (mode: GameMode) =>
  !!(mode.clockOption || mode.sideOption || mode.levelOption);

/** Mode from an id (e.g. the ?mode= URL param), falling back to a playable one */
export const getMode = (id: string | null | undefined): GameMode => {
  const mode = MODES.find((m) => m.id === id);
  return mode?.available ? mode : DEFAULT_MODE;
};
