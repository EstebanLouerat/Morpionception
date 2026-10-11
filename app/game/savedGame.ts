import type { ModeId } from "./modes";

// The game in progress is saved here, so it resumes after a refresh
export const GAME_STORAGE_KEY = "morpionception_state";

/** A started and unfinished game of this mode is saved */
export const hasGameInProgress = (mode: ModeId) => {
  try {
    const saved = JSON.parse(localStorage.getItem(GAME_STORAGE_KEY) ?? "null");
    const started = saved?.superBoard?.some((board: unknown[][]) =>
      board.some((row) => row.some(Boolean))
    );
    // Games saved before the mode was stored were local ones
    return !!started && !saved.over && (saved.mode ?? "local") === mode;
  } catch {
    return false;
  }
};

export const clearSavedGame = () => {
  try {
    localStorage.removeItem(GAME_STORAGE_KEY);
  } catch {
    // Storage unavailable: nothing saved anyway
  }
};
