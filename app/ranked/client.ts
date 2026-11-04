// Ranked play from the browser: the search queue and the leaderboard.
import type { AccountError } from "../account/protocol";
import { request } from "../lib/request";
import { saveRoomToken } from "../online/client";
import type { Leaderboard, QueueAction, QueueStatus } from "./protocol";

/** Starts, keeps going (poll every 1.5 s) or stops the search for a ranked game.
 * Once matched, the seat of the game is kept like any room's. */
export const queue = async (action: QueueAction) => {
  // Leaving still reaches the server while the page closes
  const res = await request<QueueStatus, AccountError>(
    "POST",
    "/api/ranked/queue",
    { action },
    action === "leave"
  );
  if (res.ok && res.data.status === "matched") saveRoomToken(res.data.code, res.data.token);
  return res;
};

export const fetchLeaderboard = () =>
  request<Leaderboard, AccountError>("GET", "/api/ranked/leaderboard");

/** How often a searching page says it is still there */
export const POLL_MS = 1500;
