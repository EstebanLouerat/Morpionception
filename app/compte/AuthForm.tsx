import { FormEvent, useState } from "react";
import styles from "./Compte.module.css";
import ui from "../ui/common.module.css";
import { Button } from "../ui/Button";
import { playFx } from "../audio/engine";
import PasswordField from "./PasswordField";
import { login, signup } from "../account/client";
import { PSEUDO_MAX, checkPassword, checkPseudo } from "../account/profile";
import { ACCOUNT_ERROR_MESSAGES } from "../account/protocol";

type Tab = "login" | "signup";

const TABS: { id: Tab; label: string }[] = [
  { id: "login", label: "Se connecter" },
  { id: "signup", label: "Créer un compte" },
];

/** Log-in and sign-up, one tab each */
const AuthForm = ({ onDone }: { onDone: () => void }) => {
  const [tab, setTab] = useState<Tab>("login");
  const [pseudo, setPseudo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ field: "pseudo" | "password" | "form"; message: string } | null>(
    null
  );
  const [sending, setSending] = useState(false);
  const isSignup = tab === "signup";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSignup) {
      const pseudoCheck = checkPseudo(pseudo);
      if (!pseudoCheck.ok) return setError({ field: "pseudo", message: pseudoCheck.message });
      const passwordError = checkPassword(password);
      if (passwordError) return setError({ field: "password", message: passwordError });
    } else if (!pseudo.trim() || !password) {
      return setError({ field: "form", message: "Entre ton pseudo et ton mot de passe." });
    }
    setSending(true);
    setError(null);
    const res = await (isSignup ? signup(pseudo, password) : login(pseudo, password));
    setSending(false);
    if (res.ok) {
      playFx("boardWon");
      onDone();
      return;
    }
    playFx("invalid");
    const message = ACCOUNT_ERROR_MESSAGES[res.error];
    if (res.error === "pseudo-taken" || res.error === "invalid-pseudo")
      setError({ field: "pseudo", message });
    else if (res.error === "invalid-password") setError({ field: "password", message });
    else setError({ field: "form", message });
  };

  const errorFor = (field: "pseudo" | "password" | "form") =>
    error?.field === field ? (
      <p id={`auth-${field}-error`} className={styles.error} role="alert">
        {error.message}
      </p>
    ) : null;

  return (
    <form className={ui.card} onSubmit={submit} noValidate>
      <div className={styles.tabs} role="tablist" aria-label="Compte">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={styles.tab}
            onClick={() => {
              playFx("select");
              setTab(t.id);
              setError(null);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="auth-pseudo">
          Pseudo
        </label>
        <input
          id="auth-pseudo"
          className={ui.input}
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          maxLength={PSEUDO_MAX + 4}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error?.field === "pseudo"}
          aria-describedby={error?.field === "pseudo" ? "auth-pseudo-error" : undefined}
        />
        {errorFor("pseudo")}
      </div>

      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor="auth-password">
          Mot de passe
        </label>
        <PasswordField
          id="auth-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={isSignup ? "new-password" : "current-password"}
          aria-invalid={error?.field === "password"}
          aria-describedby={error?.field === "password" ? "auth-password-error" : undefined}
        />
        {errorFor("password")}
      </div>

      {isSignup && (
        <p className={`${ui.muted} ${styles.hint}`}>
          Pas d&apos;e-mail : si tu oublies ton mot de passe, ton compte ne pourra pas être
          récupéré.
        </p>
      )}
      {errorFor("form")}
      <Button type="submit" icon={isSignup ? "userPlus" : "user"} fullWidth disabled={sending}>
        {sending ? "Un instant…" : isSignup ? "Créer mon compte" : "Se connecter"}
      </Button>
    </form>
  );
};

export default AuthForm;
