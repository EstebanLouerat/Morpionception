import styles from "./Options.module.css";
import { CLOCK_CHOICES, setClockSettings, useClockSettings } from "./clock";
import { playFx } from "../audio/engine";

/** Chrono option (time per player) for the modes that support it */
const ClockPicker = ({ disabled = false }: { disabled?: boolean }) => {
  const { seconds } = useClockSettings();
  return (
    <fieldset className={styles.fieldset} disabled={disabled}>
      <legend className={styles.legend}>Chrono par joueur</legend>
      <div className={styles.segmented}>
        {CLOCK_CHOICES.map((c) => (
          <label key={c.seconds} className={styles.segment}>
            <input
              type="radio"
              name="clock"
              value={c.seconds}
              checked={seconds === c.seconds}
              onChange={() => {
                playFx("select");
                setClockSettings({ seconds: c.seconds });
              }}
            />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
};

export default ClockPicker;
