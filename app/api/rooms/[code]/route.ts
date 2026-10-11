import { performAction, readJson, respond } from "../../../online/rooms";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

/** Room action: { type, token, … } (see RoomAction in app/online/protocol.ts) */
export async function POST(req: Request, { params }: Params) {
  const { code } = await params;
  const body = await readJson(req);
  return respond(() => performAction(code, body));
}
