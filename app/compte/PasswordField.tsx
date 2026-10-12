import { InputHTMLAttributes, useState } from "react";
import styles from "./Compte.module.css";
import ui from "../ui/common.module.css";
import Icon from "../ui/Icon";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** current-password to log in, new-password for a new one (lets password managers help) */
  autoComplete: "current-password" | "new-password";
};

/** Password input with a button to show what was typed */
const PasswordField = ({ className, ...rest }: PasswordFieldProps) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className={styles.password}>
      <input
        {...rest}
        type={visible ? "text" : "password"}
        className={`${ui.input} ${styles.passwordInput} ${className ?? ""}`}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button
        type="button"
        className={styles.reveal}
        onClick={() => setVisible(!visible)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={20} />
      </button>
    </div>
  );
};

export default PasswordField;
