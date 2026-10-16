import type { ModeId } from "./modes";

// The game in progress of each mode is saved here, so it resumes after a refresh.
// Local games keep the key used before other modes could be saved.
const GAME_STORAGE_KEY = "morpionception_state";

/** Where the game in progress of this mode is saved */
export const gameStorageKey = (mode: ModeId) =>
  mode === "local" ? GAME_STORAGE_KEY : `${GAME_STORAGE_KEY}_${mode}`;

/** A started and unfinished game of this mode is saved */
export const hasGameInProgress = (mode: ModeId) => {
  try {
    const saved = JSON.parse(localStorage.getItem(gameStorageKey(mode)) ?? "null");
    const started = saved?.superBoard?.some((board: unknown[][]) =>
      board.some((row) => row.some(Boolean))
    );
    // Games saved before the mode was stored were local ones
    return !!started && !saved.over && (saved.mode ?? "local") === mode;
  } catch {
    return false;
  }
};

export const clearSavedGame = (mode: ModeId) => {
  try {
    localStorage.removeItem(gameStorageKey(mode));
  } catch {
    // Storage unavailable: nothing saved anyway
  }
};
