import { createRoom, readJson, respond } from "../../online/rooms";

export const dynamic = "force-dynamic";

/** Create a room: { side, clock } → { code, token, you } */
export async function POST(req: Request) {
  const body = await readJson(req);
  return respond(() => createRoom(body));
}
