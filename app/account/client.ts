// The logged-in account in the browser: loaded once, shared by every page.
import { useEffect, useSyncExternalStore } from "react";
import { request } from "../lib/request";
import type { AvatarId, ColorId } from "./profile";
import type { AccountError, AccountView } from "./protocol";

export type AccountState =
  | { status: "loading"; account: null }
  /** The server could not be reached to know who is logged in */
  | { status: "error"; account: null }
  | { status: "guest"; account: null }
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

const setAccount = (account: AccountView | null) => {
  state = account ? { status: "user", account } : { status: "guest", account: null };
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
      if (res.ok) setAccount(res.data.account);
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
  else if (res.error === "unauthorized") setAccount(null);
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
  call<{ ok: true }>("POST", "/api/account/password", { current, next });

export const deleteAccount = (password: string) =>
  call<{ ok: true }>("POST", "/api/account/delete", { password }, () => setAccount(null));

/** Where to go back after logging in (?retour=…): only a path of this site */
export const safeReturnPath = (raw: string | null) =>
  raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : null;
