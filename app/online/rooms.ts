// Online rooms, server side only (used by the app/api/rooms route handlers).
// Rooms live in the memory of the Node.js process: the app must run as one
// long-lived server (next dev / next start), not as serverless functions.
import { randomInt, randomUUID } from "node:crypto";
import { profileOf, recordGame } from "../account/accounts";
import { ApiFailure } from "../lib/api";
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
  /** Account of the player when they joined, null for a guest */
  userId: string | null;
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
  /** The result of this round went into the stats */
  recorded: boolean;
  streams: Set<Stream>;
};

const STATUS: Partial<Record<RoomError, number>> = {
  "bad-request": 400,
  forbidden: 403,
  "not-found": 404,
  "too-many-rooms": 503,
};

const fail = (reason: RoomError): never => {
  throw new ApiFailure(reason, STATUS[reason] ?? 409);
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

/** How long the player has been away, null while they have the room open */
const offlineFor = (room: Room, seat: Seat, now: number) =>
  [...room.streams].some((s) => s.token === seat.token) || now - seat.lastSeen < OFFLINE_GRACE_MS
    ? null
    : now - seat.lastSeen;

const viewFor = (room: Room, you: Side): RoomView => {
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
      profile: profileOf(seat?.userId ?? null),
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
    recorded: room.recorded,
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
  if (room.clocks[side] <= 0) endGame(room, { winner: otherSide(side), reason: "timeout" });
};

const countBoards = (winners: Cell[], side: Side) => winners.filter((w) => w === side).length;

/** Every way a round ends goes through here: the clock stops and the stats are saved.
 * record: false for a result that should not count (leaving a player who is away) */
const endGame = (room: Room, outcome: NonNullable<Outcome>, record = true) => {
  if (room.outcome) return;
  room.outcome = outcome;
  stopClock(room);
  // A game left before each player has moved does not count either
  if (!record || room.moves < 2) return;
  try {
    room.recorded = recordGame({
      reason: outcome.reason,
      winner: outcome.winner,
      players: { X: room.seats.X?.userId ?? null, O: room.seats.O?.userId ?? null },
      boards: { X: countBoards(room.game.winners, "X"), O: countBoards(room.game.winners, "O") },
    });
  } catch (e) {
    // The game goes on without stats rather than freezing on an account error
    console.error("Statistiques non enregistrées", e);
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

const newSeat = (userId: string | null): Seat => ({
  token: randomUUID(),
  userId,
  left: false,
  rematch: false,
  // Counts as just seen until the player's page opens
  lastSeen: Date.now(),
});

const newCode = () => {
  let code: string;
  do {
    code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  } while (rooms.has(code));
  return code;
};

/** New room with the creator seated; userId is their account, if logged in */
export const createRoom = (body: unknown, userId: string | null): JoinResponse => {
  const { side, clock } = (body ?? {}) as { side?: unknown; clock?: unknown };
  if (side !== "X" && side !== "O" && side !== "random") fail("bad-request");
  if (typeof clock !== "number" || !Number.isInteger(clock) || clock < 0 || clock > MAX_CLOCK_SECONDS)
    fail("bad-request");
  if (rooms.size >= MAX_ROOMS) sweep();
  if (rooms.size >= MAX_ROOMS) fail("too-many-rooms");

  const you: Side = side === "X" || side === "O" ? side : randomInt(2) ? "X" : "O";
  const seat = newSeat(userId);
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
    recorded: false,
    streams: new Set(),
  };
  room.seats[you] = seat;
  rooms.set(room.code, room);
  return { code: room.code, token: seat.token, you };
};

const getRoom = (code: string) => rooms.get(code) ?? fail("not-found");

const isIndex = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n < 9;

/** Join the room (or come back to it), play, ask for a rematch, resign or leave.
 * userId is the account of the player, if logged in, kept from their first join. */
export const performAction = (
  code: string,
  body: unknown,
  userId: string | null
): JoinResponse | null => {
  const { type, token, board, cell } = (body ?? {}) as Record<string, unknown>;
  const room = getRoom(code);
  const now = Date.now();
  room.lastActivity = now;
  const side = sideOf(room, token);

  if (type === "join") {
    if (side) {
      const seat = room.seats[side]!;
      if (seat.left) fail("not-found");
      // Logged in since taking the seat: the account plays from the next move on,
      // as long as this round has not started (an account never changes mid-game)
      if (!seat.userId && userId && room.moves === 0) {
        seat.userId = userId;
        broadcast(room);
      }
      return { code, token: token as string, you: side };
    }
    const free = SIDES.find((s) => !room.seats[s]) ?? fail("full");
    const seat = newSeat(userId);
    room.seats[free] = seat;
    broadcast(room);
    // If their page never opens, the other player sees them offline after the grace delay
    setTimeout(() => rooms.get(room.code) === room && broadcast(room), OFFLINE_GRACE_MS + 50);
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
      const outcome = getBoardOutcome(room.game);
      if (outcome) endGame(room, outcome);
      else if (room.clockLimit > 0) {
        room.turnStartedAt = now;
        scheduleTimeout(room);
      }
      break;
    }
    case "resign": {
      if (!opponent) fail("waiting");
      settleClock(room, now);
      // Giving up while the other player is away is not a loss
      const opponentHere = offlineFor(room, opponent!, now) === null;
      endGame(room, { winner: otherSide(side), reason: "resign" }, opponentHere);
      break;
    }
    case "claim": {
      // The other player has been away for long: they lose by giving up
      if (!opponent) fail("waiting");
      if (room.outcome) fail("game-over");
      if ((offlineFor(room, opponent!, now) ?? 0) < CLAIM_AFTER_MS) fail("not-claimable");
      settleClock(room, now);
      endGame(room, { winner: side, reason: "claim" });
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
        deleteRoom(room);
        return null;
      }
      const seat = room.seats[side]!;
      seat.left = true;
      seat.rematch = false;
      // Leaving a game in progress gives it up, without a loss if the other player is away
      settleClock(room, now);
      const opponentHere = offlineFor(room, opponent, now) === null;
      endGame(room, { winner: otherSide(side), reason: "resign" }, opponentHere);
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
