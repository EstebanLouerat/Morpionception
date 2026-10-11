// Online rooms, server side only (used by the app/api/rooms route handlers).
// Rooms live in the memory of the Node.js process: the app must run as one
// long-lived server (next dev / next start), not as serverless functions.
import { randomInt, randomUUID } from "node:crypto";
import {
  applyMove,
  fullClocks,
  getBoardOutcome,
  isValidMove,
  newGameState,
  otherSide,
  type Clocks,
  type GameState,
  type Outcome,
  type Side,
} from "../game/rules";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  MAX_CLOCK_SECONDS,
  type JoinResponse,
  type PlayerInfo,
  type RoomError,
  type RoomView,
} from "./protocol";

const MAX_ROOMS = 1000;
// Open pages per player (tabs), the oldest is closed beyond that
const MAX_STREAMS_PER_PLAYER = 4;
// Rooms nobody has open are dropped after this long without activity
const IDLE_TTL_MS = 15 * 60_000;
const MAX_AGE_MS = 12 * 60 * 60_000;
// A player who closes the page shows as offline only after this delay,
// so a refresh does not flash "Hors ligne" on the other side
const OFFLINE_GRACE_MS = 3000;

type Seat = {
  token: string;
  left: boolean;
  rematch: boolean;
  /** When the player's last page closed */
  lastSeen: number;
};

type Stream = { token: string; send: (view: RoomView) => void; close: () => void };

type Room = {
  code: string;
  createdAt: number;
  lastActivity: number;
  clockLimit: number;
  seats: Record<Side, Seat | null>;
  round: number;
  game: GameState;
  /** Time left, as of turnStartedAt for the player to move */
  clocks: Clocks;
  /** Start of the current turn while the chrono runs (it starts after the first move) */
  turnStartedAt: number | null;
  timer: ReturnType<typeof setTimeout> | null;
  outcome: Outcome;
  moves: number;
  streams: Set<Stream>;
};

export class RoomFailure extends Error {
  constructor(public reason: RoomError) {
    super(reason);
  }
}

const fail = (reason: RoomError): never => {
  throw new RoomFailure(reason);
};

// Kept on globalThis so the rooms survive hot reloads and are shared by every route
const store = globalThis as typeof globalThis & {
  morpionRooms?: Map<string, Room>;
  morpionSweep?: ReturnType<typeof setInterval>;
};
const rooms = (store.morpionRooms ??= new Map<string, Room>());

const SIDES: Side[] = ["X", "O"];

const sideOf = (room: Room, token: unknown): Side | null =>
  (typeof token === "string" && SIDES.find((s) => room.seats[s]?.token === token)) || null;

const isOnline = (room: Room, seat: Seat | null, now: number) =>
  !!seat &&
  ([...room.streams].some((s) => s.token === seat.token) ||
    now - seat.lastSeen < OFFLINE_GRACE_MS);

const viewFor = (room: Room, you: Side): RoomView => {
  const now = Date.now();
  const player = (side: Side): PlayerInfo => {
    const seat = room.seats[side];
    return {
      joined: !!seat,
      online: isOnline(room, seat, now),
      left: !!seat?.left,
      rematch: !!seat?.rematch,
    };
  };
  const clocks = { ...room.clocks };
  if (room.turnStartedAt !== null) {
    const side = room.game.currentPlayer;
    clocks[side] = Math.max(0, clocks[side] - (now - room.turnStartedAt));
  }
  return {
    code: room.code,
    you,
    round: room.round,
    clockLimit: room.clockLimit,
    players: { X: player("X"), O: player("O") },
    game: room.game,
    clocks,
    clockRunning: room.turnStartedAt !== null,
    outcome: room.outcome,
    moves: room.moves,
  };
};

const broadcast = (room: Room) => {
  for (const stream of room.streams) {
    const side = sideOf(room, stream.token);
    if (side) stream.send(viewFor(room, side));
  }
};

const deleteRoom = (room: Room) => {
  stopClock(room);
  rooms.delete(room.code);
  for (const stream of room.streams) stream.close();
  room.streams.clear();
};

const sweep = () => {
  const now = Date.now();
  for (const room of rooms.values()) {
    const idle = room.streams.size === 0 && now - room.lastActivity > IDLE_TTL_MS;
    if (idle || now - room.createdAt > MAX_AGE_MS) deleteRoom(room);
  }
};
if (!store.morpionSweep) {
  store.morpionSweep = setInterval(sweep, 60_000);
  store.morpionSweep.unref?.();
}

// --- Chrono ---

const stopClock = (room: Room) => {
  room.turnStartedAt = null;
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
};

/** Charge the player to move for their time, ends the game if it ran out */
const settleClock = (room: Room, now: number) => {
  if (room.turnStartedAt === null) return;
  const side = room.game.currentPlayer;
  room.clocks[side] = Math.max(0, room.clocks[side] - (now - room.turnStartedAt));
  room.turnStartedAt = now;
  if (room.clocks[side] <= 0) {
    room.outcome = { winner: otherSide(side), reason: "timeout" };
    stopClock(room);
  }
};

/** Ends the game when the player to move runs out of time, even if nobody acts */
const scheduleTimeout = (room: Room) => {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
  if (room.turnStartedAt === null) return;
  room.timer = setTimeout(() => {
    settleClock(room, Date.now());
    if (room.outcome) broadcast(room);
    else scheduleTimeout(room);
  }, room.clocks[room.game.currentPlayer] + 20);
};

// --- Public API ---

const newSeat = (): Seat => ({ token: randomUUID(), left: false, rematch: false, lastSeen: 0 });

const newCode = () => {
  let code: string;
  do {
    code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  } while (rooms.has(code));
  return code;
};

export const createRoom = (body: unknown): JoinResponse => {
  const { side, clock } = (body ?? {}) as { side?: unknown; clock?: unknown };
  if (side !== "X" && side !== "O" && side !== "random") fail("bad-request");
  if (typeof clock !== "number" || !Number.isInteger(clock) || clock < 0 || clock > MAX_CLOCK_SECONDS)
    fail("bad-request");
  if (rooms.size >= MAX_ROOMS) sweep();
  if (rooms.size >= MAX_ROOMS) fail("too-many-rooms");

  const you: Side = side === "X" || side === "O" ? side : randomInt(2) ? "X" : "O";
  const seat = newSeat();
  const now = Date.now();
  const room: Room = {
    code: newCode(),
    createdAt: now,
    lastActivity: now,
    clockLimit: clock as number,
    seats: { X: null, O: null },
    round: 1,
    game: newGameState(),
    clocks: fullClocks(clock as number),
    turnStartedAt: null,
    timer: null,
    outcome: null,
    moves: 0,
    streams: new Set(),
  };
  room.seats[you] = seat;
  rooms.set(room.code, room);
  return { code: room.code, token: seat.token, you };
};

const getRoom = (code: string) => rooms.get(code) ?? fail("not-found");

const isIndex = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n < 9;

/** Join the room (or come back to it), play, ask for a rematch, resign or leave */
export const performAction = (code: string, body: unknown): JoinResponse | null => {
  const { type, token, board, cell } = (body ?? {}) as Record<string, unknown>;
  const room = getRoom(code);
  const now = Date.now();
  room.lastActivity = now;
  const side = sideOf(room, token);

  if (type === "join") {
    if (side) {
      if (room.seats[side]!.left) fail("not-found");
      return { code, token: token as string, you: side };
    }
    const free = SIDES.find((s) => !room.seats[s]) ?? fail("full");
    const seat = newSeat();
    room.seats[free] = seat;
    broadcast(room);
    return { code, token: seat.token, you: free };
  }

  if (!side || room.seats[side]!.left) return fail("forbidden");
  const opponent = room.seats[otherSide(side)];

  switch (type) {
    case "move": {
      if (!isIndex(board) || !isIndex(cell)) fail("bad-request");
      if (!opponent) fail("waiting");
      settleClock(room, now);
      if (room.outcome) {
        broadcast(room); // the chrono may have just run out
        fail("game-over");
      }
      if (room.game.currentPlayer !== side) fail("not-your-turn");
      if (!isValidMove(room.game, board as number, cell as number)) fail("invalid-move");
      room.game = applyMove(room.game, board as number, cell as number);
      room.moves++;
      room.outcome = getBoardOutcome(room.game);
      if (room.outcome) stopClock(room);
      else if (room.clockLimit > 0) {
        room.turnStartedAt = now;
        scheduleTimeout(room);
      }
      break;
    }
    case "resign": {
      if (!opponent) fail("waiting");
      settleClock(room, now);
      if (!room.outcome) room.outcome = { winner: otherSide(side), reason: "resign" };
      stopClock(room);
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
        stopClock(room);
      }
      break;
    }
    case "leave": {
      // Nobody left to play with: the room is closed
      if (!opponent || opponent.left) {
        deleteRoom(room);
        return null;
      }
      const seat = room.seats[side]!;
      seat.left = true;
      seat.rematch = false;
      // Leaving a game in progress gives it up
      settleClock(room, now);
      if (!room.outcome) room.outcome = { winner: otherSide(side), reason: "resign" };
      stopClock(room);
      break;
    }
    default:
      fail("bad-request");
  }
  broadcast(room);
  return null;
};

/** Live room updates for one player's page; returns the function closing it */
export const openStream = (
  code: string,
  token: unknown,
  send: (view: RoomView) => void,
  close: () => void
) => {
  const room = getRoom(code);
  const side = sideOf(room, token);
  if (!side || room.seats[side]!.left) return fail("forbidden");

  const own = [...room.streams].filter((s) => s.token === token);
  if (own.length >= MAX_STREAMS_PER_PLAYER) {
    room.streams.delete(own[0]);
    own[0].close();
  }
  const stream: Stream = { token: token as string, send, close };
  room.streams.add(stream);
  room.lastActivity = Date.now();
  broadcast(room); // first view for this page, "online" for the other player

  return () => {
    if (!room.streams.delete(stream)) return;
    const now = Date.now();
    room.lastActivity = now;
    const seat = SIDES.map((s) => room.seats[s]).find((s) => s?.token === stream.token);
    if (seat) seat.lastSeen = now;
    // Tell the other player once the grace delay is over
    setTimeout(() => rooms.get(room.code) === room && broadcast(room), OFFLINE_GRACE_MS + 50);
  };
};

const STATUS: Partial<Record<RoomError, number>> = {
  "bad-request": 400,
  forbidden: 403,
  "not-found": 404,
  "too-many-rooms": 503,
};

/** Response of a route handler: JSON (or a ready Response), errors as { error } */
export const respond = async (run: () => unknown) => {
  try {
    const value = await run();
    return value instanceof Response ? value : Response.json(value ?? { ok: true });
  } catch (e) {
    if (!(e instanceof RoomFailure)) throw e;
    return Response.json({ error: e.reason }, { status: STATUS[e.reason] ?? 409 });
  }
};

export const readJson = (req: Request): Promise<unknown> => req.json().catch(() => null);
