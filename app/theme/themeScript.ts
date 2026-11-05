import { APPEARANCE_KEY, BOARD_SIZES, DEFAULT_APPEARANCE, PALETTE_IDS } from "./constants";

// Runs in <head> before the first paint so the page never flashes the wrong theme
export const themeScript = `(function () {
  var d = document.documentElement;
  try {
    var s = JSON.parse(localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)}) || "{}") || {};
    var t = s.theme;
    if (t !== "light" && t !== "dark") {
      t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    d.dataset.theme = t;
    d.dataset.palette = ${JSON.stringify(PALETTE_IDS)}.indexOf(s.palette) >= 0
      ? s.palette
      : ${JSON.stringify(DEFAULT_APPEARANCE.palette)};
    d.dataset.board = ${JSON.stringify(BOARD_SIZES)}.indexOf(s.boardSize) >= 0 ? s.boardSize : "normal";
    d.dataset.symbols = s.bigSymbols === true ? "big" : "normal";
    d.dataset.contrast = s.highContrast === true ? "high" : "normal";
    d.dataset.motion = s.reduceMotion === true ? "reduced" : "normal";
  } catch (e) {
    d.dataset.theme = "light";
  }
})();`;
