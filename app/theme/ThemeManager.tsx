"use client";
import { useEffect } from "react";
import { getAppearance, subscribeAppearance } from "./appearance";

// Keeps <html data-theme / data-palette> in sync with the saved appearance
const ThemeManager = () => {
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const { theme, palette } = getAppearance();
      const root = document.documentElement;
      root.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      root.dataset.palette = palette;
    };
    apply();
    const unsubscribe = subscribeAppearance(apply);
    media.addEventListener("change", apply);
    return () => {
      unsubscribe();
      media.removeEventListener("change", apply);
    };
  }, []);
  return null;
};

export default ThemeManager;
