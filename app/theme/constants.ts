// Shared by the React store and the inline script (no React import here)
export const APPEARANCE_KEY = "morpionception_appearance";

export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

// Colors of each palette live in globals.css ([data-palette="…"])
export const PALETTE_IDS = ["classic", "ocean", "forest"] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

export type Appearance = { theme: ThemeChoice; palette: PaletteId };
export const DEFAULT_APPEARANCE: Appearance = { theme: "system", palette: "classic" };
