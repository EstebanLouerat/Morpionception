"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./Profil.module.css";
import compte from "../Compte.module.css";
import ui from "../../ui/common.module.css";
import PageShell from "../../ui/PageShell";
import Loader from "../../ui/Loader";
import { Button } from "../../ui/Button";
import { playFx } from "../../audio/engine";
import Avatar from "../../account/Avatar";
import PasswordField from "../PasswordField";
import {
  changePassword,
  deleteAccount,
  updateProfile,
  useAccount,
} from "../../account/client";
import {
  AVATARS,
  AVATAR_COLORS,
  PSEUDO_MAX,
  checkPassword,
  checkPseudo,
  colorValue,
  type AvatarId,
  type ColorId,
} from "../../account/profile";
import { ACCOUNT_ERROR_MESSAGES, type AccountView } from "../../account/protocol";

type Message = { kind: "error" | "success"; text: string } | null;

const Feedback = ({ message, id }: { message: Message; id?: string }) =>
  message && (
    <p
      id={id}
      className={message.kind === "error" ? compte.error : compte.success}
      role={message.kind === "error" ? "alert" : "status"}
    >
      {message.text}
    </p>
  );

/** Profile, password and account deletion, for the logged-in player */
export default function Profil() {
  const router = useRouter();
  const account = useAccount();

  // Guests have nothing to edit (also right after deleting the account)
  useEffect(() => {
    if (account.status === "guest") router.replace("/compte");
  }, [account.status, router]);

  return (
    <PageShell title="Profil" backHref="/compte">
      {account.status === "user" ? (
        <>
          <ProfileForm account={account.account} />
          <PasswordForm pseudo={account.account.pseudo} />
          <DeleteAccount />
        </>
      ) : account.status === "error" ? (
        <p className={ui.muted}>Impossible de joindre le serveur pour charger ton compte.</p>
      ) : (
        <Loader label="Chargement du compte…" />
      )}
    </PageShell>
  );
}

const ProfileForm = ({ account }: { account: AccountView }) => {
  const [pseudo, setPseudo] = useState(account.pseudo);
  const [avatar, setAvatar] = useState<AvatarId>(account.avatar);
  const [color, setColor] = useState<ColorId>(account.color);
  const [message, setMessage] = useState<Message>(null);
  const [saving, setSaving] = useState(false);
  const changed =
    pseudo.trim() !== account.pseudo || avatar !== account.avatar || color !== account.color;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const check = checkPseudo(pseudo);
    if (!check.ok) return setMessage({ kind: "error", text: check.message });
    setSaving(true);
    const res = await updateProfile({
      ...(check.pseudo !== account.pseudo && { pseudo: check.pseudo }),
      avatar,
      color,
    });
    setSaving(false);
    if (res.ok) {
      playFx("boardWon");
      setPseudo(res.data.account.pseudo);
      setMessage({ kind: "success", text: "Profil enregistré." });
    } else {
      playFx("invalid");
      setMessage({ kind: "error", text: ACCOUNT_ERROR_MESSAGES[res.error] });
    }
  };

  return (
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>Profil</h2>
      <form className={ui.card} onSubmit={save}>
        <div className={styles.preview}>
          <Avatar avatar={avatar} color={color} size={72} />
          <strong className={compte.name}>{pseudo.trim() || "…"}</strong>
        </div>

        <div className={compte.field}>
          <label className={compte.fieldLabel} htmlFor="profile-pseudo">
            Pseudo
          </label>
          <input
            id="profile-pseudo"
            className={ui.input}
            value={pseudo}
            onChange={(e) => {
              setPseudo(e.target.value);
              setMessage(null);
            }}
            maxLength={PSEUDO_MAX + 4}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <span className={`${ui.muted} ${compte.hint}`}>
            Visible par tes adversaires. Tes parties restent liées à ton compte si tu le changes.
          </span>
        </div>

        <fieldset className={styles.fieldset}>
          <legend className={compte.fieldLabel}>Avatar</legend>
          <div className={styles.avatars}>
            {AVATARS.map((a) => (
              <label key={a.id} className={styles.choice} title={a.label}>
                <input
                  type="radio"
                  name="avatar"
                  value={a.id}
                  checked={avatar === a.id}
                  onChange={() => {
                    playFx("select");
                    setAvatar(a.id);
                    setMessage(null);
                  }}
                  aria-label={a.label}
                />
                <span className={styles.avatarChoice} aria-hidden="true">
                  {a.emoji}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={compte.fieldLabel}>Couleur</legend>
          <div className={styles.colors}>
            {AVATAR_COLORS.map((c) => (
              <label key={c.id} className={styles.choice} title={c.label}>
                <input
                  type="radio"
                  name="color"
                  value={c.id}
                  checked={color === c.id}
                  onChange={() => {
                    playFx("select");
                    setColor(c.id);
                    setMessage(null);
                  }}
                  aria-label={c.label}
                />
                <span
                  className={styles.swatch}
                  style={{ background: colorValue(c.id) }}
                  aria-hidden="true"
                />
              </label>
            ))}
          </div>
        </fieldset>

        <Feedback message={message} />
        <Button type="submit" fullWidth disabled={!changed || saving}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
    </section>
  );
};

const PasswordForm = ({ pseudo }: { pseudo: string }) => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const error = checkPassword(next);
    if (!current) return setMessage({ kind: "error", text: "Entre ton mot de passe actuel." });
    if (error) return setMessage({ kind: "error", text: error });
    setSaving(true);
    const res = await changePassword(current, next);
    setSaving(false);
    if (res.ok) {
      setCurrent("");
      setNext("");
      setMessage({
        kind: "success",
        text: "Mot de passe changé. Tes autres appareils ont été déconnectés.",
      });
    } else {
      playFx("invalid");
      setMessage({
        kind: "error",
        text:
          res.error === "bad-credentials"
            ? "Mot de passe actuel incorrect."
            : ACCOUNT_ERROR_MESSAGES[res.error],
      });
    }
  };

  return (
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>Mot de passe</h2>
      <form className={ui.card} onSubmit={save} noValidate>
        {/* Lets password managers know which account this is */}
        <input type="text" name="username" autoComplete="username" value={pseudo} hidden readOnly />
        <div className={compte.field}>
          <label className={compte.fieldLabel} htmlFor="password-current">
            Mot de passe actuel
          </label>
          <PasswordField
            id="password-current"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <div className={compte.field}>
          <label className={compte.fieldLabel} htmlFor="password-next">
            Nouveau mot de passe
          </label>
          <PasswordField
            id="password-next"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <Feedback message={message} />
        <Button type="submit" variant="secondary" fullWidth disabled={saving}>
          {saving ? "Un instant…" : "Changer le mot de passe"}
        </Button>
      </form>
    </section>
  );
};

const DeleteAccount = () => {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [deleting, setDeleting] = useState(false);

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return setMessage({ kind: "error", text: "Entre ton mot de passe." });
    setDeleting(true);
    const res = await deleteAccount(password);
    // Success: the account is gone, the page goes back to /compte
    if (res.ok) return;
    setDeleting(false);
    playFx("invalid");
    setMessage({
      kind: "error",
      text:
        res.error === "bad-credentials"
          ? "Mot de passe incorrect."
          : ACCOUNT_ERROR_MESSAGES[res.error],
    });
  };

  return (
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>Supprimer le compte</h2>
      <form className={`${ui.card} ${styles.danger}`} onSubmit={confirm} noValidate>
        <p className={ui.muted}>
          Ton pseudo, ton avatar et tes statistiques seront effacés définitivement.
        </p>
        {open ? (
          <>
            <div className={compte.field}>
              <label className={compte.fieldLabel} htmlFor="delete-password">
                Mot de passe
              </label>
              <PasswordField
                id="delete-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Feedback message={message} />
            <div className={ui.row}>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" icon="trash" className={styles.dangerBtn} disabled={deleting}>
                {deleting ? "Suppression…" : "Supprimer définitivement"}
              </Button>
            </div>
          </>
        ) : (
          <Button type="button" variant="secondary" icon="trash" onClick={() => setOpen(true)}>
            Supprimer mon compte
          </Button>
        )}
      </form>
    </section>
  );
};
