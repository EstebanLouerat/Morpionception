"use client";

import { useRouter } from "next/navigation";
import { CSSProperties } from "react";
import styles from "./Settings.module.css";
import { playFx } from "../audio/engine";
import { AudioSettings, setAudioSettings, useAudioSettings } from "../audio/settings";

const SLIDERS: { key: keyof AudioSettings; label: string }[] = [
  { key: "fx", label: "Effets sonores" },
  { key: "music", label: "Musique" },
];

export default function Settings() {
  const router = useRouter();
  const settings = useAudioSettings();

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>
        Paramètres
      </h1>

      <section className={styles.card}>
        {SLIDERS.map(({ key, label }) => {
          const percent = Math.round(settings[key] * 100);
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
      </section>

      <button
        className={styles.btn}
        onClick={() => {
          playFx("click");
          router.push("/");
        }}
      >
        <span className={styles.btnTop}>Retour</span>
      </button>
    </main>
  );
}
