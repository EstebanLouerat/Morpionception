// Shared by the React store and the inline script (no React import here)
export const APPEARANCE_KEY = "morpionception_appearance";

export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

// Colors of each palette live in globals.css ([data-palette="…"])
export const PALETTE_IDS = ["classic", "ocean", "forest"] as const;
export type PaletteId = (typeof PALETTE_IDS)[number];

// Accessibility of the game screen (applied in Game.module.css and globals.css)
/** Size of the grid's cells: normal, large (less room around), max (the whole screen) */
export const BOARD_SIZES = ["normal", "large", "max"] as const;
export type BoardSize = (typeof BOARD_SIZES)[number];

export type Appearance = {
  theme: ThemeChoice;
  palette: PaletteId;
  boardSize: BoardSize;
  /** Bigger, bolder X and O */
  bigSymbols: boolean;
  /** Visible borders, no faded cells, a stronger mark on the board to play */
  highContrast: boolean;
  /** Animations cut down to a minimum (the system setting also counts) */
  reduceMotion: boolean;
};
export const DEFAULT_APPEARANCE: Appearance = {
  theme: "system",
  palette: "classic",
  boardSize: "normal",
  bigSymbols: false,
  highContrast: false,
  reduceMotion: false,
};

/** The attributes on <html> that carry the accessibility settings */
export const accessibilityAttributes = (a: Appearance) => ({
  board: a.boardSize,
  symbols: a.bigSymbols ? "big" : "normal",
  contrast: a.highContrast ? "high" : "normal",
  motion: a.reduceMotion ? "reduced" : "normal",
});
