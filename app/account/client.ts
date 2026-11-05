// The logged-in account in the browser: loaded once, shared by every page.
import { useEffect, useState, useSyncExternalStore } from "react";
import { request } from "../lib/request";
import { sameSitePath } from "./returnPath";
import type { AvatarId, ColorId } from "./profile";
import type { AccountError, AccountView, Providers } from "./protocol";

export type AccountState =
  | { status: "loading"; account: null }
  /** The server could not be reached to know who is logged in */
  | { status: "error"; account: null }
  /** expired: the session ended while using the site (logged out elsewhere) */
  | { status: "guest"; account: null; expired?: boolean }
  | { status: "user"; account: AccountView };

const LOADING: AccountState = { status: "loading", account: null };
// Coming back to the page reloads the account at most this often
const REFRESH_MS = 30_000;

let state: AccountState = LOADING;
let loadedAt = 0;
let pending: Promise<void> | null = null;
// Bumped by every change: a reload that started before it is outdated when it ends
let version = 0;
const listeners = new Set<() => void>();

const setAccount = (account: AccountView | null, expired = false) => {
  state = account ? { status: "user", account } : { status: "guest", account: null, expired };
  loadedAt = Date.now();
  version++;
  listeners.forEach((l) => l());
};

/** Asks the server who is logged in (one request at a time) */
export const refreshAccount = () => {
  const startedAt = version;
  return (pending ??= request<{ account: AccountView | null }, AccountError>("GET", "/api/account")
    .then((res) => {
      // A log-in or log-out answered meanwhile knows better
      if (version !== startedAt) return;
      // Still logged out after an expired session: keep saying why
      const stillExpired = state.status === "guest" && !!state.expired;
      if (res.ok) setAccount(res.data.account, !res.data.account && stillExpired);
      else if (state.status === "loading") {
        // Nothing known yet (a failed reload later on keeps what was known)
        state = { status: "error", account: null };
        listeners.forEach((l) => l());
      }
    })
    .finally(() => {
      pending = null;
    }));
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (state.status === "loading" || state.status === "error") refreshAccount();
  return () => {
    listeners.delete(listener);
  };
};

/** The account state, kept up to date (also when the page becomes visible again) */
export const useAccount = () => {
  const account = useSyncExternalStore(subscribe, () => state, () => LOADING);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - loadedAt > REFRESH_MS)
        refreshAccount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  return account;
};

type AccountResult = { account: AccountView };

/** Runs an account call; the result updates the shared state */
const call = async <T>(
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
  apply?: (data: T) => void
) => {
  const res = await request<T, AccountError>(method, path, body);
  if (res.ok) apply?.(res.data);
  // The session ended meanwhile (logged out elsewhere, password changed)
  else if (res.error === "unauthorized") setAccount(null, true);
  return res;
};

export const signup = (pseudo: string, password: string) =>
  call<AccountResult>("POST", "/api/account/signup", { pseudo, password }, (d) =>
    setAccount(d.account)
  );

export const login = (pseudo: string, password: string) =>
  call<AccountResult>("POST", "/api/account/login", { pseudo, password }, (d) =>
    setAccount(d.account)
  );

export const logout = () =>
  call<{ ok: true }>("POST", "/api/account/logout", {}, () => setAccount(null));

export const updateProfile = (changes: { pseudo?: string; avatar?: AvatarId; color?: ColorId }) =>
  call<AccountResult>("PATCH", "/api/account", changes, (d) => setAccount(d.account));

export const changePassword = (current: string, next: string) =>
  // A first password changes what the account pages offer (hasPassword)
  call<{ ok: true }>("POST", "/api/account/password", { current, next }, () => void refreshAccount());

/** Deletion, confirmed with the password (or the pseudo, for an account without one) */
export const deleteAccount = (confirm: { password?: string; pseudo?: string }) =>
  call<{ ok: true }>("POST", "/api/account/delete", confirm, () => setAccount(null));

/** Unlinks Google from the account */
export const unlinkGoogle = () =>
  call<AccountResult>("POST", "/api/account/google/unlink", {}, (d) => setAccount(d.account));

// --- Log-in with Google ---

let providers: Promise<Providers> | null = null;

/** Ways to log in the server offers (asked once) */
const fetchProviders = () =>
  (providers ??= request<Providers, AccountError>("GET", "/api/account/providers").then((res) =>
    res.ok ? res.data : { google: false }
  ));

/** null until known */
export const useProviders = () => {
  const [value, setValue] = useState<Providers | null>(null);
  useEffect(() => {
    let live = true;
    fetchProviders().then((p) => live && setValue(p));
    return () => {
      live = false;
    };
  }, []);
  return value;
};

/** The address that starts a log-in with Google (a full page change: Google's page) */
export const googleHref = (opts: { link?: boolean; back?: string | null } = {}) => {
  const params = new URLSearchParams();
  if (opts.link) params.set("mode", "link");
  if (opts.back) params.set("retour", opts.back);
  const query = params.toString();
  return `/api/account/google${query ? `?${query}` : ""}`;
};

/** What the account pages say after coming back from Google (?google=…) */
export const GOOGLE_NOTES: Record<string, { kind: "error" | "success"; text: string }> = {
  bienvenue: {
    kind: "success",
    text: "Compte créé avec Google ! Ton pseudo vient de ton nom : tu peux le changer dans ton profil.",
  },
  lie: { kind: "success", text: "Compte Google associé : tu peux maintenant te connecter avec." },
  annule: { kind: "error", text: "Connexion avec Google annulée." },
  echec: { kind: "error", text: "La connexion avec Google n'a pas abouti, réessaie." },
  "deja-lie": { kind: "error", text: "Ce compte Google est déjà associé à un autre compte." },
  trop: { kind: "error", text: "Trop de comptes créés récemment, réessaie dans une heure." },
  plein: { kind: "error", text: "Le serveur n'accepte plus de nouveaux comptes pour l'instant." },
  indisponible: { kind: "error", text: "La connexion avec Google n'est pas disponible sur ce serveur." },
};

/** Where to go back after logging in (?retour=…): only a page of this site */
export const safeReturnPath = (raw: string | null) => sameSitePath(raw, window.location.origin);
