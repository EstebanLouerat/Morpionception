// Accounts and sessions, server side only, saved in one JSON file.
// Like the online rooms, this needs the app to run as one long-lived Node.js server.
// Node runs one request at a time between two awaits: code that reads and changes the
// data without awaiting in between is atomic. Never keep a StoredUser across an await
// without looking it up again (it may have been deleted or changed meanwhile).
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { ApiFailure } from "../lib/api";
import { emptyStats, type GameRecord, type Stats } from "./protocol";
import type { AvatarId, ColorId } from "./profile";

/** scrypt hash, with the settings it was made with */
export type StoredPassword = { N: number; r: number; p: number; salt: string; hash: string };

/** A game in a player's history; the opponent is looked up when shown, so a
 * renamed or deleted account is shown as it is now */
export type StoredGameRecord = Omit<GameRecord, "opponent"> & {
  /** Account of the opponent, null for a guest */
  opponentId: string | null;
};

export type StoredUser = {
  id: string;
  pseudo: string;
  /** Pseudo without case and accents, unique */
  pseudoKey: string;
  password: StoredPassword;
  avatar: AvatarId;
  color: ColorId;
  createdAt: number;
  stats: Stats;
  /** Latest games first */
  recent: StoredGameRecord[];
};

export type StoredSession = {
  /** sha256 of the cookie token: the file alone does not give access to accounts */
  tokenHash: string;
  userId: string;
  createdAt: number;
  lastUsed: number;
};

type Data = { version: 1; users: StoredUser[]; sessions: StoredSession[] };

const dataDir = () => process.env.MORPION_DATA_DIR || path.join(process.cwd(), "data");
const dataFile = () => path.join(dataDir(), "accounts.json");

// Kept on globalThis so every route and hot reload share the same data
const cache = globalThis as typeof globalThis & {
  morpionAccounts?: Data;
  /** A corrupt file could not be moved aside: nothing is written, so it is not lost */
  morpionAccountsReadOnly?: boolean;
};

const unavailable = () => new ApiFailure("storage-unavailable", 503);

/** Fills what an older file may lack (counters added later would be undefined) */
const normalize = (data: Data): Data => {
  for (const user of data.users) {
    const stats = emptyStats();
    user.stats = {
      ...stats,
      ...user.stats,
      asX: { ...stats.asX, ...user.stats?.asX },
      asO: { ...stats.asO, ...user.stats?.asO },
    };
    user.recent = Array.isArray(user.recent) ? user.recent : [];
  }
  return data;
};

const load = (): Data => {
  const file = dataFile();
  let text: string;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, users: [], sessions: [] };
    // Permissions, too many open files…: try again at the next request
    console.error(`Comptes : impossible de lire ${file}`, e);
    throw unavailable();
  }
  try {
    const parsed = JSON.parse(text);
    if (parsed?.version === 1 && Array.isArray(parsed.users) && Array.isArray(parsed.sessions))
      return normalize(parsed);
    throw new Error("contenu inattendu");
  } catch (e) {
    // Corrupt file: never overwrite it, move it aside and start over
    const aside = `${file}.corrupt-${Date.now()}`;
    console.error(`Comptes : ${file} illisible, déplacé vers ${aside}`, e);
    try {
      fs.renameSync(file, aside);
    } catch (moveError) {
      console.error("Comptes : impossible de déplacer le fichier, comptes en lecture seule", moveError);
      cache.morpionAccountsReadOnly = true;
    }
    return { version: 1, users: [], sessions: [] };
  }
};

export const db = (): Data => (cache.morpionAccounts ??= load());

/** Writes the data to disk (temporary file + rename: never half a file). If that
 * fails, the changes in memory are dropped so memory never says more than the disk. */
export const save = () => {
  if (cache.morpionAccountsReadOnly) {
    cache.morpionAccounts = undefined;
    throw unavailable();
  }
  const file = dataFile();
  const tmp = `${file}.tmp`;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(db()), { mode: 0o600 });
    fs.renameSync(tmp, file);
  } catch (e) {
    console.error(`Comptes : impossible d'écrire ${file}`, e);
    cache.morpionAccounts = undefined;
    throw unavailable();
  }
};

export const findUser = (id: string) => db().users.find((u) => u.id === id) ?? null;
export const findUserByKey = (key: string) => db().users.find((u) => u.pseudoKey === key) ?? null;
