"use client";

import { CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./Settings.module.css";
import ui from "../ui/common.module.css";
import PageShell from "../ui/PageShell";
import Tabs from "../ui/Tabs";
import Badge from "../ui/Badge";
import { playFx } from "../audio/engine";
import { AudioSettings, setAudioSettings, useAudioSettings } from "../audio/settings";
import {
  BOARD_SIZE_CHOICES,
  PALETTES,
  THEMES,
  setAppearance,
  useAppearance,
} from "../theme/appearance";
import type { Appearance } from "../theme/constants";

/** The on/off accessibility settings */
const SWITCHES: { key: "bigSymbols" | "highContrast" | "reduceMotion"; label: string; hint: string }[] = [
  { key: "bigSymbols", label: "Grands symboles", hint: "X et O plus grands et plus épais" },
  { key: "highContrast", label: "Contraste élevé", hint: "Bords visibles, grille imposée bien marquée" },
  { key: "reduceMotion", label: "Réduire les animations", hint: "Moins de mouvements et pas de confettis" },
];

/** One small grid with the settings applied (the same attributes as the game) */
const Preview = ({ appearance }: { appearance: Appearance }) => {
  const cells = ["X", "", "O", "", "X", "", "O", "", ""];
  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.previewBoard}>
        {cells.map((c, i) => (
          <span
            key={i}
            className={`${styles.previewCell} ${c === "X" ? styles.x : c === "O" ? styles.o : ""} ${
              i === 4 ? styles.previewLast : ""
            }`}
          >
            {c}
          </span>
        ))}
      </div>
      <span className={styles.previewLabel}>
        Aperçu · cases{" "}
        {BOARD_SIZE_CHOICES.find((b) => b.id === appearance.boardSize)?.label.toLowerCase()}
      </span>
    </div>
  );
};

const SLIDERS: { key: keyof AudioSettings; label: string }[] = [
  { key: "fx", label: "Effets sonores" },
  { key: "music", label: "Musique" },
];

// Opened from the game (?from=game&mode=… or &room=…): the back button returns to it
const getBackHref = (params: URLSearchParams) => {
  if (params.get("from") !== "game") return "/";
  const room = params.get("room");
  if (room) return `/game?room=${encodeURIComponent(room)}`;
  const mode = params.get("mode");
  return mode ? `/game?mode=${encodeURIComponent(mode)}` : "/game";
};

export default function Settings() {
  const params = useSearchParams();
  const audio = useAudioSettings();
  const appearance = useAppearance();

  return (
    <PageShell title="Paramètres" backHref={getBackHref(params)} wide>
      <Tabs
        label="Paramètres"
        allOnWide
        initial={params.get("onglet") ?? undefined}
        tabs={[
          {
            id: "audio",
            label: "Audio",
            content: (
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

            ),
          },
          {
            id: "apparence",
            label: "Apparence",
            content: (
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
            ),
          },
          {
            id: "accessibilite",
            label: "Accessibilité",
            content: (
      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>Accessibilité</h2>
        <div className={ui.card}>
          <div className={styles.accessTop}>
            <fieldset className={styles.fieldset}>
              <legend className={styles.rowHeader}>Taille des cases en jeu</legend>
              <div className={styles.segmented}>
                {BOARD_SIZE_CHOICES.map((b) => (
                  <label key={b.id} className={styles.segment}>
                    <input
                      type="radio"
                      name="board-size"
                      value={b.id}
                      checked={appearance.boardSize === b.id}
                      onChange={() => {
                        playFx("select");
                        setAppearance({ boardSize: b.id });
                      }}
                    />
                    <span>{b.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Preview appearance={appearance} />
          </div>
          {SWITCHES.map((s) => (
            <label key={s.key} className={styles.switchRow}>
              <span className={styles.switchText}>
                <strong>{s.label}</strong>
                <small>{s.hint}</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                className={styles.switch}
                checked={appearance[s.key]}
                onChange={(e) => {
                  playFx("select");
                  setAppearance({ [s.key]: e.target.checked });
                }}
              />
            </label>
          ))}
        </div>
      </section>
            ),
          },
        ]}
      />
    </PageShell>
  );
}
