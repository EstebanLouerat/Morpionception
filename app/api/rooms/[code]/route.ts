import type { NextRequest } from "next/server";
import { isCrossSite, userIdOf } from "../../../account/auth";
import { readJson, respond } from "../../../lib/api";
import { performAction } from "../../../online/rooms";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

/** Room action: { type, token, … } (see RoomAction in app/online/protocol.ts) */
export async function POST(req: NextRequest, { params }: Params) {
  const { code } = await params;
  // Rooms read the session cookie too: refuse requests sent by other sites
  if (isCrossSite(req)) return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await readJson(req);
  return respond(() => {
    // Only a join takes the account: moves never depend on the account store
    const joining = (body as { type?: unknown } | null)?.type === "join";
    return performAction(code, body, joining ? userIdOf(req) : null);
  });
}
