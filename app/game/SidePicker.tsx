import styles from "./Options.module.css";
import { SIDE_CHOICES, setSideSettings, useSideSettings } from "./side";
import { playFx } from "../audio/engine";

/** Side choice for online games, drawn with the current player colors */
const SidePicker = ({ disabled = false }: { disabled?: boolean }) => {
  const { side } = useSideSettings();
  return (
    <fieldset className={styles.fieldset} disabled={disabled}>
      <legend className={styles.legend}>Ton camp</legend>
      <div className={styles.sides}>
        {SIDE_CHOICES.map((c) => (
          <label key={c.id} className={styles.side}>
            <input
              type="radio"
              name="side"
              value={c.id}
              checked={side === c.id}
              onChange={() => {
                playFx("select");
                setSideSettings({ side: c.id });
              }}
            />
            <span className={styles.sideBody}>
              <span
                className={`${styles.symbol} ${
                  c.id === "random" ? styles.random : styles[c.id.toLowerCase()]
                }`}
                aria-hidden="true"
              >
                {c.label}
              </span>
              <span>{c.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export default SidePicker;
