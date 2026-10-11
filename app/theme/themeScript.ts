import { APPEARANCE_KEY, DEFAULT_APPEARANCE, PALETTE_IDS } from "./constants";

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
  } catch (e) {
    d.dataset.theme = "light";
  }
})();`;
