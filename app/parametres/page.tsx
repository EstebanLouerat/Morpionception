"use client";

import { CSSProperties } from "react";
import styles from "./Settings.module.css";
import ui from "../ui/common.module.css";
import PageShell from "../ui/PageShell";
import Badge from "../ui/Badge";
import { playFx } from "../audio/engine";
import { AudioSettings, setAudioSettings, useAudioSettings } from "../audio/settings";
import { PALETTES, THEMES, setAppearance, useAppearance } from "../theme/appearance";

const SLIDERS: { key: keyof AudioSettings; label: string }[] = [
  { key: "fx", label: "Effets sonores" },
  { key: "music", label: "Musique" },
];

// Opened from the game (?from=game&mode=… or &room=…): the back button returns to it
const getBackHref = () => {
  if (typeof window === "undefined") return "/";
  const params = new URLSearchParams(window.location.search);
  if (params.get("from") !== "game") return "/";
  const room = params.get("room");
  if (room) return `/game?room=${encodeURIComponent(room)}`;
  const mode = params.get("mode");
  return mode ? `/game?mode=${encodeURIComponent(mode)}` : "/game";
};

export default function Settings() {
  const audio = useAudioSettings();
  const appearance = useAppearance();

  return (
    <PageShell title="Paramètres" backHref={getBackHref()}>
      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>Audio</h2>
        <div className={ui.card}>
          {SLIDERS.map(({ key, label }) => {
            const percent = Math.round(audio[key] * 100);
            return (
              <div key={key} className={styles.row}>
                <div className={styles.rowHeader}>
                  <label htmlFor={`volume-${key}`}>{label}</label>
                  <span className={styles.value}>
                    {percent === 0 ? "Muet" : `${percent}%`}
                  </span>
                </div>
                <input
                  id={`volume-${key}`}
                  className={styles.slider}
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={percent}
                  style={{ "--fill": `${percent}%` } as CSSProperties}
                  onChange={(e) =>
                    setAudioSettings({ [key]: Number(e.target.value) / 100 })
                  }
                  // Preview the effects volume once the slider is released
                  onPointerUp={() => key === "fx" && playFx("placeX")}
                  onKeyUp={() => key === "fx" && playFx("placeX")}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>Apparence</h2>
        <div className={ui.card}>
          <fieldset className={styles.fieldset}>
            <legend className={styles.rowHeader}>Thème</legend>
            <div className={styles.segmented}>
              {THEMES.map((t) => (
                <label key={t.id} className={styles.segment}>
                  <input
                    type="radio"
                    name="theme"
                    value={t.id}
                    checked={appearance.theme === t.id}
                    onChange={() => {
                      playFx("select");
                      setAppearance({ theme: t.id });
                    }}
                  />
                  <span>{t.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend className={styles.rowHeader}>Couleurs des joueurs</legend>
            <div className={styles.palettes}>
              {PALETTES.map((p) => (
                <label key={p.id} className={styles.palette} data-palette={p.id}>
                  <input
                    type="radio"
                    name="palette"
                    value={p.id}
                    checked={appearance.palette === p.id}
                    onChange={() => {
                      playFx("select");
                      setAppearance({ palette: p.id });
                    }}
                  />
                  <span className={styles.paletteBody}>
                    <span className={styles.paletteSymbols} aria-hidden="true">
                      <span className={styles.x}>X</span>
                      <span className={styles.o}>O</span>
                    </span>
                    <span>{p.label}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.soon}>
            <span>Plateaux, pions et animations personnalisés</span>
            <Badge />
          </div>
        </div>
      </section>
    </PageShell>
  );
}
