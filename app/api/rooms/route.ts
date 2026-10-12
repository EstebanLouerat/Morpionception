import type { NextRequest } from "next/server";
import { isCrossSite, userIdOf } from "../../account/auth";
import { readJson, respond } from "../../lib/api";
import { createRoom } from "../../online/rooms";

export const dynamic = "force-dynamic";

/** Create a room: { side, clock } → { code, token, you } */
export async function POST(req: NextRequest) {
  // Rooms read the session cookie too: refuse requests sent by other sites
  if (isCrossSite(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await readJson(req);
  return respond(async () => createRoom(body, await userIdOf(req)));
}
