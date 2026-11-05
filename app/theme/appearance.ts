import { createPersistedStore } from "../lib/persistedStore";
import {
  APPEARANCE_KEY,
  Appearance,
  BOARD_SIZES,
  BoardSize,
  DEFAULT_APPEARANCE,
  PALETTE_IDS,
  PaletteId,
  THEME_CHOICES,
  ThemeChoice,
} from "./constants";

export const THEMES: { id: ThemeChoice; label: string }[] = [
  { id: "system", label: "Système" },
  { id: "light", label: "Clair" },
  { id: "dark", label: "Sombre" },
];

export const PALETTES: { id: PaletteId; label: string }[] = [
  { id: "classic", label: "Classique" },
  { id: "ocean", label: "Océan" },
  { id: "forest", label: "Forêt" },
];

const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  list.includes(v as T) ? (v as T) : fallback;

const store = createPersistedStore<Appearance>(APPEARANCE_KEY, DEFAULT_APPEARANCE, (raw) => ({
  theme: oneOf(THEME_CHOICES, raw.theme, DEFAULT_APPEARANCE.theme),
  palette: oneOf(PALETTE_IDS, raw.palette, DEFAULT_APPEARANCE.palette),
  boardSize: oneOf(BOARD_SIZES, raw.boardSize, DEFAULT_APPEARANCE.boardSize),
  bigSymbols: raw.bigSymbols === true,
  highContrast: raw.highContrast === true,
  reduceMotion: raw.reduceMotion === true,
}));

export const BOARD_SIZE_CHOICES: { id: BoardSize; label: string }[] = [
  { id: "normal", label: "Normale" },
  { id: "large", label: "Grande" },
  { id: "max", label: "Maximale" },
];

/** Animations should be cut down: by the player here, or by the system */
export const motionReduced = () =>
  getAppearance().reduceMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;

export const getAppearance = store.get;
export const setAppearance = store.set;
export const subscribeAppearance = store.subscribe;
export const useAppearance = store.use;
