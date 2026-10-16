import styles from "../game/Options.module.css";
import { LEVELS, setAiSettings, useAiSettings } from "./settings";
import { playFx } from "../audio/engine";

/** Difficulty of the AI, with a word on how it plays */
const LevelPicker = () => {
  const { level } = useAiSettings();
  return (
    <fieldset className={styles.fieldset}>
      <legend className={styles.legend}>Niveau de l&apos;IA</legend>
      <div className={`${styles.segmented} ${styles.four}`}>
        {LEVELS.map((l) => (
          <label key={l.id} className={styles.segment}>
            <input
              type="radio"
              name="ai-level"
              value={l.id}
              checked={level === l.id}
              onChange={() => {
                playFx("select");
                setAiSettings({ level: l.id });
              }}
            />
            <span>{l.label}</span>
          </label>
        ))}
      </div>
      <p className={styles.hint}>{LEVELS.find((l) => l.id === level)?.hint}</p>
    </fieldset>
  );
};

export default LevelPicker;
