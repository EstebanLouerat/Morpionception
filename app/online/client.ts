// Calls to the rooms API from the browser, and the seat tokens of the rooms joined.
import type { SideChoice } from "../game/side";
import type { JoinResponse, RoomAction, RoomError } from "./protocol";

// Seat token per room code, so a refresh or a new tab gets the same seat back
const TOKENS_KEY = "morpionception_rooms";
const MAX_TOKENS = 20;

type StoredTokens = Record<string, { token: string; at: number }>;

const readTokens = (): StoredTokens => {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
};

const writeTokens = (tokens: StoredTokens) => {
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // Storage unavailable: the seat is only kept until the page closes
  }
};

export const getRoomToken = (code: string): string | null => readTokens()[code]?.token ?? null;

const saveRoomToken = (code: string, token: string) => {
  const tokens = { ...readTokens(), [code]: { token, at: Date.now() } };
  // Keep only the most recent rooms
  const recent = Object.entries(tokens)
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, MAX_TOKENS);
  writeTokens(Object.fromEntries(recent));
};

export const forgetRoomToken = (code: string) => {
  const tokens = readTokens();
  delete tokens[code];
  writeTokens(tokens);
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: RoomError };

const post = async <T>(path: string, body: unknown, keepalive = false): Promise<ApiResult<T>> => {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive,
    });
    const json = await res.json();
    return res.ok ? { ok: true, data: json } : { ok: false, error: json.error ?? "network" };
  } catch {
    return { ok: false, error: "network" };
  }
};

export const createRoom = async (side: SideChoice, clock: number) => {
  const res = await post<JoinResponse>("/api/rooms", { side, clock });
  if (res.ok) saveRoomToken(res.data.code, res.data.token);
  return res;
};

/** Take a seat in the room, or get ours back if we already have one */
export const joinRoom = async (code: string) => {
  const res = await post<JoinResponse>(`/api/rooms/${code}`, {
    type: "join",
    token: getRoomToken(code),
  });
  if (res.ok) saveRoomToken(code, res.data.token);
  else if (res.error !== "network") forgetRoomToken(code);
  return res;
};

export const sendAction = (code: string, action: Exclude<RoomAction, { type: "join" }>) =>
  post<{ ok: true }>(
    `/api/rooms/${code}`,
    { ...action, token: getRoomToken(code) },
    // A leave sent while the page closes still reaches the server
    action.type === "leave"
  );

export const leaveRoom = (code: string) => {
  const sent = sendAction(code, { type: "leave" });
  forgetRoomToken(code);
  return sent;
};
