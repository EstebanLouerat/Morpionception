import { createPersistedStore } from "../lib/persistedStore";
import {
  APPEARANCE_KEY,
  Appearance,
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
}));

export const getAppearance = store.get;
export const setAppearance = store.set;
export const subscribeAppearance = store.subscribe;
export const useAppearance = store.use;
