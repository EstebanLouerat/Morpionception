// Connection to the MongoDB database (MONGODB_URI), shared by every route. Server side only.
import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { MongoClient, MongoServerError, type Db } from "mongodb";
import { ApiFailure } from "./api";

// Kept on globalThis so every route and hot reload share one connection pool
const cache = globalThis as typeof globalThis & { morpionDb?: Promise<Db> };

/** Indexes the app relies on: unique pseudos, and documents MongoDB drops by itself
 * once expired (sessions, password attempts, rooms) */
const createIndexes = (db: Db) =>
  Promise.all([
    db.collection("users").createIndex({ id: 1 }, { unique: true }),
    db.collection("users").createIndex({ pseudoKey: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ userId: 1 }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("attempts").createIndex({ key: 1, at: 1 }),
    db.collection("attempts").createIndex({ at: 1 }, { expireAfterSeconds: 60 * 60 }),
    db.collection("rooms").createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
  ]);

const connect = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI n'est pas défini");
  // Idle connections are closed quickly, so a function that is suspended does not keep them
  const client = new MongoClient(uri, { appName: "morpionception", maxIdleTimeMS: 5000 });
  // On Vercel, closes the idle connections before the function instance is suspended
  attachDatabasePool(client);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "morpionception");
  await createIndexes(db);
  return db;
};

/** The database; throws storage-unavailable (503) when it cannot be reached */
export const database = async () => {
  cache.morpionDb ??= connect().catch((e) => {
    // Tried again at the next request
    cache.morpionDb = undefined;
    throw e;
  });
  try {
    return await cache.morpionDb;
  } catch (e) {
    console.error("MongoDB : connexion impossible", e);
    throw new ApiFailure("storage-unavailable", 503);
  }
};

/** A write refused because a unique index already has this value */
export const isDuplicateKey = (e: unknown) => e instanceof MongoServerError && e.code === 11000;
