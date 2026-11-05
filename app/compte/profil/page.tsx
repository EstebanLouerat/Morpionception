"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./Profil.module.css";
import compte from "../Compte.module.css";
import ui from "../../ui/common.module.css";
import PageShell from "../../ui/PageShell";
import Tabs from "../../ui/Tabs";
import Loader from "../../ui/Loader";
import { Button } from "../../ui/Button";
import { playFx } from "../../audio/engine";
import Avatar from "../../account/Avatar";
import PasswordField from "../PasswordField";
import GoogleButton from "../GoogleButton";
import {
  GOOGLE_NOTES,
  changePassword,
  deleteAccount,
  googleHref,
  refreshAccount,
  unlinkGoogle,
  updateProfile,
  useAccount,
  useProviders,
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
  const params = useSearchParams();
  // Back from Google (?onglet=security&google=…): that tab, and what happened
  const [tab] = useState(() => params.get("onglet"));
  const [googleNote] = useState(() => GOOGLE_NOTES[params.get("google") ?? ""] ?? null);
  useEffect(() => {
    if (params.get("google")) router.replace("/compte/profil");
  }, [params, router]);

  useEffect(() => {
    refreshAccount();
  }, []);
  // Guests have nothing to edit (also right after deleting the account). When the
  // session expired here, logging in again comes back to this page.
  const expired = account.status === "guest" && account.expired;
  useEffect(() => {
    if (account.status === "guest")
      router.replace(expired ? `/compte?retour=${encodeURIComponent("/compte/profil")}` : "/compte");
  }, [account.status, expired, router]);

  return (
    <PageShell title="Profil" backHref="/compte" wide={account.status === "user"}>
      {account.status === "user" ? (
        <Tabs
          label="Réglages du compte"
          allOnWide
          initial={tab ?? undefined}
          tabs={[
            { id: "profile", label: "Profil", content: <ProfileForm account={account.account} /> },
            {
              id: "security",
              label: "Sécurité",
              content: (
                <>
                  <GoogleSection account={account.account} note={googleNote} />
                  <PasswordForm account={account.account} />
                  <DeleteAccount account={account.account} />
                </>
              ),
            },
          ]}
        />
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
      <form className={`${ui.card} ${styles.profileForm}`} onSubmit={save}>
        <div className={styles.preview}>
          <Avatar avatar={avatar} color={color} size={64} />
          <div className={`${compte.field} ${styles.pseudoField}`}>
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
          </div>
        </div>
        <span className={`${ui.muted} ${compte.hint}`}>
          Visible par tes adversaires. Tes parties restent liées à ton compte si tu le changes.
        </span>

        <fieldset className={`${styles.fieldset} ${styles.avatarField}`}>
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

        <fieldset className={`${styles.fieldset} ${styles.colorField}`}>
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

/** Google: linked (log-in with it) or not (link it) */
const GoogleSection = ({ account, note }: { account: AccountView; note: Message }) => {
  const providers = useProviders();
  const [message, setMessage] = useState<Message>(note);
  const [sending, setSending] = useState(false);
  if (!account.google && !providers?.google) return null;
  const unlink = async () => {
    setSending(true);
    const res = await unlinkGoogle();
    setSending(false);
    setMessage(
      res.ok
        ? { kind: "success", text: "Google dissocié : connecte-toi avec ton pseudo et ton mot de passe." }
        : { kind: "error", text: ACCOUNT_ERROR_MESSAGES[res.error] }
    );
  };
  return (
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>Google</h2>
      <div className={ui.card}>
        {account.google ? (
          <>
            <p className={ui.muted}>Ton compte est associé à Google : tu peux te connecter avec.</p>
            {account.hasPassword ? (
              <Button variant="secondary" onClick={unlink} disabled={sending}>
                Dissocier Google
              </Button>
            ) : (
              <p className={`${ui.muted} ${compte.hint}`}>
                Définis un mot de passe ci-dessous pour pouvoir dissocier Google.
              </p>
            )}
          </>
        ) : (
          <>
            <p className={ui.muted}>Associe ton compte Google pour te connecter en un clic.</p>
            <GoogleButton href={googleHref({ link: true })} label="Associer mon compte Google" />
          </>
        )}
        <Feedback message={message} />
      </div>
    </section>
  );
};

const PasswordForm = ({ account }: { account: AccountView }) => {
  const { pseudo, hasPassword } = account;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [saving, setSaving] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const error = checkPassword(next);
    if (hasPassword && !current)
      return setMessage({ kind: "error", text: "Entre ton mot de passe actuel." });
    if (error) return setMessage({ kind: "error", text: error });
    setSaving(true);
    const res = await changePassword(current, next);
    setSaving(false);
    if (res.ok) {
      setCurrent("");
      setNext("");
      setMessage({
        kind: "success",
        text: hasPassword
          ? "Mot de passe changé. Tes autres appareils ont été déconnectés."
          : "Mot de passe défini : tu peux aussi te connecter avec ton pseudo.",
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
        {hasPassword ? (
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
        ) : (
          <p className={`${ui.muted} ${compte.hint}`}>
            Ton compte a été créé avec Google. Définis un mot de passe pour te connecter aussi
            avec ton pseudo.
          </p>
        )}
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
          {saving ? "Un instant…" : hasPassword ? "Changer le mot de passe" : "Définir le mot de passe"}
        </Button>
      </form>
    </section>
  );
};

const DeleteAccount = ({ account }: { account: AccountView }) => {
  const { hasPassword } = account;
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<Message>(null);
  const [deleting, setDeleting] = useState(false);

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!password)
      return setMessage({
        kind: "error",
        text: hasPassword ? "Entre ton mot de passe." : "Tape ton pseudo pour confirmer.",
      });
    setDeleting(true);
    const res = await deleteAccount(hasPassword ? { password } : { pseudo: password });
    // Success: the account is gone, the page goes back to /compte
    if (res.ok) return;
    setDeleting(false);
    playFx("invalid");
    setMessage({
      kind: "error",
      text:
        res.error === "bad-credentials"
          ? hasPassword
            ? "Mot de passe incorrect."
            : "Ce n'est pas ton pseudo."
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
                {hasPassword ? "Mot de passe" : `Tape ton pseudo (${account.pseudo}) pour confirmer`}
              </label>
              {hasPassword ? (
                <PasswordField
                  id="delete-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              ) : (
                <input
                  id="delete-password"
                  className={ui.input}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              )}
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
