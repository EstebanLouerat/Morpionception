// Online rooms, server side only (used by the app/api/rooms route handlers).
// Rooms are saved in MongoDB, so every server instance sees the same ones: on Vercel
// the requests of one room may reach different instances. A change is saved only if
// the room has not changed since it was read (version number v), otherwise it is
// made again on the room as it is now. Open pages follow the room by reading it again
// a few times per second, and say every few seconds that they are still open.
import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { profilesOf, recordGame, type FinishedGame } from "../account/accounts";
import type { PublicProfile } from "../account/protocol";
import { ApiFailure } from "../lib/api";
import { database, isDuplicateKey } from "../lib/mongo";
import {
  applyMove,
  fullClocks,
  getBoardOutcome,
  isValidMove,
  newGameState,
  otherSide,
  type Cell,
  type Clocks,
  type GameState,
  type Outcome,
  type Side,
} from "../game/rules";
import {
  CLAIM_AFTER_MS,
  CODE_ALPHABET,
  CODE_LENGTH,
  MAX_CLOCK_SECONDS,
  type JoinResponse,
  type PlayerInfo,
  type RoomError,
  type RoomView,
} from "./protocol";

const MAX_ROOMS = 1000;
// Rooms nobody has open are dropped after this long without activity
const IDLE_TTL_MS = 15 * 60_000;
const MAX_AGE_MS = 12 * 60 * 60_000;
// A player who closes the page shows as offline only after this delay,
// so a refresh does not flash "Hors ligne" on the other side
const OFFLINE_GRACE_MS = 3000;
// An open page says it is still there this often, and counts as closed after
// PRESENCE_TIMEOUT_MS without saying it (closed without a word, server stopped)
const PRESENCE_BEAT_MS = 5000;
const PRESENCE_TIMEOUT_MS = 15_000;
// How often an open page reads the room again
const POLL_MS = 600;
// Live connections end after this long and the page opens a new one by itself:
// a function can only run for so long (300 s by default on Vercel)
const STREAM_MAX_MS = 270_000;
// Changes made again when other requests keep saving the room first
const MAX_WRITE_TRIES = 10;

type Seat = {
  token: string;
  /** Account of the player when they joined, null for a guest */
  userId: string | null;
  left: boolean;
  rematch: boolean;
};

type Room = {
  /** The room code */
  _id: string;
  /** Version, +1 at every change of the game or the seats */
  v: number;
  createdAt: number;
  lastActivity: number;
  /** When MongoDB drops the room (TTL index) */
  expireAt: Date;
  clockLimit: number;
  seats: Record<Side, Seat | null>;
  round: number;
  game: GameState;
  /** Time left, as of turnStartedAt for the player to move */
  clocks: Clocks;
  /** Start of the current turn while the chrono runs (it starts after the first move) */
  turnStartedAt: number | null;
  outcome: Outcome;
  moves: number;
  /** The result of this round went into the stats */
  recorded: boolean;
  /** Open pages per seat token: page id → when it last said it was open */
  presence: Record<string, Record<string, number>>;
  /** Per seat token: when its last page closed (or when it took the seat) */
  lastSeen: Record<string, number>;
};

/** Saved by every change (presence and lastSeen are saved by the pages) */
const CHANGED_FIELDS = [
  "seats",
  "round",
  "game",
  "clocks",
  "turnStartedAt",
  "outcome",
  "moves",
  "recorded",
  "lastActivity",
  "expireAt",
] as const;

const STATUS: Partial<Record<RoomError, number>> = {
  "bad-request": 400,
  forbidden: 403,
  "not-found": 404,
  "too-many-rooms": 503,
  "storage-unavailable": 503,
};

const fail = (reason: RoomError): never => {
  throw new ApiFailure(reason, STATUS[reason] ?? 409);
};

const roomsCollection = async () => (await database()).collection<Room>("rooms");

const SIDES: Side[] = ["X", "O"];

const sideOf = (room: Room, token: unknown): Side | null =>
  (typeof token === "string" && SIDES.find((s) => room.seats[s]?.token === token)) || null;

const expiry = (createdAt: number, lastActivity: number) =>
  new Date(Math.min(createdAt + MAX_AGE_MS, lastActivity + IDLE_TTL_MS));

/** The room, null when unknown or expired (MongoDB drops expired rooms within a minute) */
const readRoom = async (code: string) => {
  const room = await (await roomsCollection()).findOne({ _id: code });
  return room && room.expireAt.getTime() > Date.now() ? room : null;
};

/** How long the player has been away, null while they have the room open */
const offlineFor = (room: Room, seat: Seat, now: number) => {
  const beats = Object.values(room.presence?.[seat.token] ?? {});
  if (beats.some((t) => now - t < PRESENCE_TIMEOUT_MS)) return null;
  const last = Math.max(room.lastSeen?.[seat.token] ?? 0, ...beats);
  return now - last < OFFLINE_GRACE_MS ? null : now - last;
};

const viewFor = (room: Room, you: Side, profiles: Map<string, PublicProfile>): RoomView => {
  const now = Date.now();
  const player = (side: Side): PlayerInfo => {
    const seat = room.seats[side];
    const away = seat ? offlineFor(room, seat, now) : null;
    return {
      joined: !!seat,
      online: !!seat && away === null,
      offlineFor: away,
      left: !!seat?.left,
      rematch: !!seat?.rematch,
      profile: (seat?.userId && profiles.get(seat.userId)) || null,
    };
  };
  const clocks = { ...room.clocks };
  if (room.turnStartedAt !== null) {
    const side = room.game.currentPlayer;
    clocks[side] = Math.max(0, clocks[side] - (now - room.turnStartedAt));
  }
  return {
    code: room._id,
    you,
    round: room.round,
    clockLimit: room.clockLimit,
    players: { X: player("X"), O: player("O") },
    game: room.game,
    clocks,
    clockRunning: room.turnStartedAt !== null,
    outcome: room.outcome,
    moves: room.moves,
    recorded: room.recorded,
  };
};

// --- Pages of this server instance waiting for a room to change ---

// A change saved by this instance wakes them right away; changes saved by other
// instances are seen at their next read
const local = globalThis as typeof globalThis & { morpionRoomWaiters?: Map<string, Set<() => void>> };
const waiters = (local.morpionRoomWaiters ??= new Map<string, Set<() => void>>());

const wakeUp = (code: string) => waiters.get(code)?.forEach((wake) => wake());

/** Waits ms, or less if the room changes; returns the function that ends the wait */
const nap = (code: string, ms: number) => {
  let wake = () => {};
  const done = new Promise<void>((resolve) => {
    const set = waiters.get(code) ?? new Set<() => void>();
    waiters.set(code, set);
    const timer = setTimeout(() => wake(), ms);
    wake = () => {
      clearTimeout(timer);
      set.delete(wake);
      if (!set.size && waiters.get(code) === set) waiters.delete(code);
      resolve();
    };
    set.add(wake);
  });
  return { done, wake: () => wake() };
};

// --- Changes ---

/** What a change does besides the game and the seats */
type Effects = {
  /** Seat tokens that count as just seen */
  seen: string[];
  /** The round ended and counts for the stats */
  finished: FinishedGame | null;
  /** The room is closed */
  deleted: boolean;
  /** Nothing changed: nothing to save */
  unchanged: boolean;
  /** Error answered once the change is saved */
  error: RoomError | null;
};

/** Makes the change on the room as it is now and saves it, again on a fresh read when
 * another request saved the room meanwhile. Stats are saved once the room is. */
const changeRoom = async <T>(
  code: string,
  change: (room: Room, now: number, effects: Effects) => T
): Promise<T> => {
  const rooms = await roomsCollection();
  for (let i = 0; i < MAX_WRITE_TRIES; i++) {
    const room = (await readRoom(code)) ?? fail("not-found");
    const now = Date.now();
    const effects: Effects = { seen: [], finished: null, deleted: false, unchanged: false, error: null };
    const result = change(room, now, effects);
    if (effects.unchanged) return result;

    if (effects.deleted) {
      const res = await rooms.deleteOne({ _id: code, v: room.v });
      if (res.deletedCount === 0) continue;
    } else {
      room.lastActivity = now;
      room.expireAt = expiry(room.createdAt, now);
      const $set: Record<string, unknown> = {};
      for (const field of CHANGED_FIELDS) $set[field] = room[field];
      for (const token of effects.seen) $set[`lastSeen.${token}`] = now;
      const res = await rooms.updateOne({ _id: code, v: room.v }, { $set, $inc: { v: 1 } });
      if (res.matchedCount === 0) continue;
    }
    wakeUp(code);
    if (effects.finished) {
      try {
        await recordGame(effects.finished);
      } catch (e) {
        // The game goes on without stats rather than failing on an account error
        console.error("Statistiques non enregistrées", e);
      }
    }
    if (effects.error) fail(effects.error);
    return result;
  }
  return fail("storage-unavailable");
};

// --- Chrono ---

const stopClock = (room: Room) => {
  room.turnStartedAt = null;
};

/** Time left to the player to move, as of now */
const timeLeft = (room: Room, now: number) =>
  room.turnStartedAt === null
    ? Infinity
    : room.clocks[room.game.currentPlayer] - (now - room.turnStartedAt);

/** Charge the player to move for their time, ends the game if it ran out */
const settleClock = (room: Room, now: number, effects: Effects) => {
  if (room.turnStartedAt === null) return;
  const side = room.game.currentPlayer;
  room.clocks[side] = Math.max(0, room.clocks[side] - (now - room.turnStartedAt));
  room.turnStartedAt = now;
  if (room.clocks[side] <= 0) endGame(room, effects, { winner: otherSide(side), reason: "timeout" });
};

const countBoards = (winners: Cell[], side: Side) => winners.filter((w) => w === side).length;

/** Every way a round ends goes through here: the clock stops and the stats are saved.
 * record: false for a result that should not count (leaving a player who is away) */
const endGame = (room: Room, effects: Effects, outcome: NonNullable<Outcome>, record = true) => {
  if (room.outcome) return;
  room.outcome = outcome;
  stopClock(room);
  // A game left before each player has moved does not count either
  if (!record || room.moves < 2) return;
  const players = { X: room.seats.X?.userId ?? null, O: room.seats.O?.userId ?? null };
  // A player against their own account (two devices) does not count
  room.recorded = !(players.X && players.X === players.O);
  effects.finished = {
    reason: outcome.reason,
    winner: outcome.winner,
    players,
    boards: { X: countBoards(room.game.winners, "X"), O: countBoards(room.game.winners, "O") },
  };
};

// --- Public API ---

const newSeat = (userId: string | null): Seat => ({
  token: randomUUID(),
  userId,
  left: false,
  rematch: false,
});

const newCode = () =>
  Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

/** New room with the creator seated; userId is their account, if logged in */
export const createRoom = async (body: unknown, userId: string | null): Promise<JoinResponse> => {
  const { side, clock } = (body ?? {}) as { side?: unknown; clock?: unknown };
  if (side !== "X" && side !== "O" && side !== "random") fail("bad-request");
  if (typeof clock !== "number" || !Number.isInteger(clock) || clock < 0 || clock > MAX_CLOCK_SECONDS)
    fail("bad-request");
  const rooms = await roomsCollection();
  if ((await rooms.countDocuments({ expireAt: { $gt: new Date() } }, { limit: MAX_ROOMS })) >= MAX_ROOMS)
    fail("too-many-rooms");

  const you: Side = side === "X" || side === "O" ? side : randomInt(2) ? "X" : "O";
  const seat = newSeat(userId);
  for (;;) {
    const now = Date.now();
    const room: Room = {
      _id: newCode(),
      v: 0,
      createdAt: now,
      lastActivity: now,
      expireAt: expiry(now, now),
      clockLimit: clock as number,
      seats: { X: null, O: null },
      round: 1,
      game: newGameState(),
      clocks: fullClocks(clock as number),
      turnStartedAt: null,
      outcome: null,
      moves: 0,
      recorded: false,
      presence: {},
      // Counts as just seen until the player's page opens
      lastSeen: { [seat.token]: now },
    };
    room.seats[you] = seat;
    try {
      await rooms.insertOne(room);
      return { code: room._id, token: seat.token, you };
    } catch (e) {
      // Code already used by another room: pick another one
      if (!isDuplicateKey(e)) throw e;
    }
  }
};

const isIndex = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n < 9;

/** Join the room (or come back to it), play, ask for a rematch, resign or leave.
 * userId is the account of the player, if logged in, kept from their first join. */
export const performAction = (code: string, body: unknown, userId: string | null) => {
  const { type, token, board, cell } = (body ?? {}) as Record<string, unknown>;

  return changeRoom(code, (room, now, effects): JoinResponse | null => {
    const side = sideOf(room, token);

    if (type === "join") {
      if (side) {
        const seat = room.seats[side]!;
        if (seat.left) fail("not-found");
        // Logged in since taking the seat: the account plays from the next move on,
        // as long as this round has not started (an account never changes mid-game)
        if (!seat.userId && userId && room.moves === 0) seat.userId = userId;
        return { code, token: token as string, you: side };
      }
      const free = SIDES.find((s) => !room.seats[s]) ?? fail("full");
      const seat = newSeat(userId);
      room.seats[free] = seat;
      // Counts as just seen until the player's page opens
      effects.seen.push(seat.token);
      return { code, token: seat.token, you: free };
    }

    if (!side || room.seats[side]!.left) return fail("forbidden");
    const opponent = room.seats[otherSide(side)];

    switch (type) {
      case "move": {
        if (!isIndex(board) || !isIndex(cell)) fail("bad-request");
        if (!opponent) fail("waiting");
        settleClock(room, now, effects);
        if (room.outcome) {
          // The chrono may have just run out: saved, then refused
          effects.error = "game-over";
          break;
        }
        if (room.game.currentPlayer !== side) fail("not-your-turn");
        if (!isValidMove(room.game, board as number, cell as number)) fail("invalid-move");
        room.game = applyMove(room.game, board as number, cell as number);
        room.moves++;
        const outcome = getBoardOutcome(room.game);
        if (outcome) endGame(room, effects, outcome);
        else if (room.clockLimit > 0) room.turnStartedAt = now;
        break;
      }
      case "resign": {
        if (!opponent) fail("waiting");
        settleClock(room, now, effects);
        // Giving up while the other player is away is not a loss
        const opponentHere = offlineFor(room, opponent!, now) === null;
        endGame(room, effects, { winner: otherSide(side), reason: "resign" }, opponentHere);
        break;
      }
      case "claim": {
        // The other player has been away for long: they lose by giving up
        if (!opponent) fail("waiting");
        if (room.outcome) fail("game-over");
        if ((offlineFor(room, opponent!, now) ?? 0) < CLAIM_AFTER_MS) fail("not-claimable");
        settleClock(room, now, effects);
        endGame(room, effects, { winner: side, reason: "claim" });
        break;
      }
      case "rematch": {
        if (!room.outcome) fail("not-over");
        if (!opponent || opponent.left) fail("opponent-left");
        room.seats[side]!.rematch = true;
        if (opponent!.rematch) {
          // New game, sides swapped so each player starts in turn
          room.seats = { X: room.seats.O, O: room.seats.X };
          SIDES.forEach((s) => (room.seats[s]!.rematch = false));
          room.round++;
          room.game = newGameState();
          room.clocks = fullClocks(room.clockLimit);
          room.outcome = null;
          room.moves = 0;
          room.recorded = false;
          stopClock(room);
        }
        break;
      }
      case "leave": {
        // Nobody left to play with: the room is closed
        if (!opponent || opponent.left) {
          effects.deleted = true;
          return null;
        }
        const seat = room.seats[side]!;
        seat.left = true;
        seat.rematch = false;
        // Leaving a game in progress gives it up, without a loss if the other player is away
        settleClock(room, now, effects);
        const opponentHere = offlineFor(room, opponent, now) === null;
        endGame(room, effects, { winner: otherSide(side), reason: "resign" }, opponentHere);
        break;
      }
      default:
        fail("bad-request");
    }
    return null;
  });
};

/** Ends the round when the player to move has run out of time, even if nobody acts */
const settleTimeout = (code: string) =>
  changeRoom(code, (room, now, effects) => {
    if (room.outcome || timeLeft(room, now) > 0) effects.unchanged = true;
    else settleClock(room, now, effects);
  });

/** Live room updates for one player's page: checks the seat (failing like the other
 * calls), then sends the view at every change until the returned function is called.
 * close is called when the room is gone, the seat is lost or the connection is old. */
export const openStream = async (
  code: string,
  token: unknown,
  send: (view: RoomView) => void,
  close: () => void
) => {
  const first = (await readRoom(code)) ?? fail("not-found");
  const firstSide = sideOf(first, token);
  if (!firstSide || first.seats[firstSide]!.left) return fail("forbidden");
  const seatToken = token as string;
  const rooms = await roomsCollection();
  const streamId = randomUUID();
  const startedAt = Date.now();
  let stopped = false;
  // Ended to be opened again: the page stays "online" meanwhile
  let renewing = false;
  let wait = { done: Promise.resolve(), wake: () => {} };

  /** Tells the other player this page is open (and keeps the room alive) */
  const beat = async (room: Room, now: number) => {
    const $set: Record<string, unknown> = {
      [`presence.${seatToken}.${streamId}`]: now,
      lastActivity: now,
      expireAt: expiry(room.createdAt, now),
    };
    // Pages of this seat closed without a word long ago
    const $unset: Record<string, ""> = {};
    for (const [id, at] of Object.entries(room.presence?.[seatToken] ?? {})) {
      if (now - at > 2 * PRESENCE_TIMEOUT_MS) $unset[`presence.${seatToken}.${id}`] = "";
    }
    await rooms.updateOne({ _id: code }, Object.keys($unset).length ? { $set, $unset } : { $set });
    wakeUp(code);
  };

  const run = async () => {
    let lastKey = "";
    let lastVersion = -1;
    let lastBeat = 0;
    let profiles = new Map<string, PublicProfile>();
    let room: Room | null = first;
    while (!stopped) {
      try {
        const now = Date.now();
        if (now - startedAt > STREAM_MAX_MS) {
          renewing = true;
          break;
        }
        room ??= await readRoom(code);
        const side = room && sideOf(room, seatToken);
        // Room closed or seat given up: the page asks why when it reconnects
        if (!room || !side || room.seats[side]!.left) break;
        if (now - lastBeat >= PRESENCE_BEAT_MS) {
          await beat(room, now);
          lastBeat = now;
          room = await readRoom(code);
          continue;
        }
        if (timeLeft(room, now) <= 0 && !room.outcome) {
          await settleTimeout(code);
          room = null;
          continue;
        }
        // Sent again when the room changes or a player comes or goes
        const key = `${room.v}|${SIDES.map((s) => {
          const seat = room!.seats[s];
          return seat ? offlineFor(room!, seat, now) === null : "-";
        }).join()}`;
        if (key !== lastKey) {
          if (room.v !== lastVersion) {
            profiles = await profilesOf([room.seats.X?.userId, room.seats.O?.userId]);
            lastVersion = room.v;
          }
          send(viewFor(room, side, profiles));
          lastKey = key;
        }
      } catch (e) {
        console.error("Salon : lecture impossible", e);
      }
      room = null;
      if (stopped) break;
      wait = nap(code, POLL_MS);
      await wait.done;
    }
    if (!stopped) close();
  };

  /** The page is closed: the other player sees it offline after the grace delay */
  const leave = async () => {
    try {
      const now = Date.now();
      await rooms.updateOne(
        { _id: code },
        {
          $unset: { [`presence.${seatToken}.${streamId}`]: "" },
          $set: {
            [`lastSeen.${seatToken}`]: now,
            lastActivity: now,
            expireAt: expiry(first.createdAt, now),
          },
        }
      );
      wakeUp(code);
    } catch (e) {
      console.error("Salon : départ non enregistré", e);
    }
  };

  void run();

  return () => {
    if (stopped) return;
    stopped = true;
    wait.wake();
    if (!renewing) void leave();
  };
};
