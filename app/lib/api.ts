// Helpers for the API route handlers (server side).
import { MongoError } from "mongodb";

/** Expected failure of an API call, answered as { error: reason } with this status */
export class ApiFailure extends Error {
  constructor(
    public reason: string,
    public status: number
  ) {
    super(reason);
  }
}

/** Response of a route handler: JSON (or a ready Response), ApiFailure as { error },
 * a database error as storage-unavailable */
export const respond = async (run: () => unknown) => {
  try {
    const value = await run();
    return value instanceof Response ? value : Response.json(value ?? { ok: true });
  } catch (e) {
    if (e instanceof MongoError) {
      console.error("MongoDB : requête impossible", e);
      return Response.json({ error: "storage-unavailable" }, { status: 503 });
    }
    if (!(e instanceof ApiFailure)) throw e;
    return Response.json({ error: e.reason }, { status: e.status });
  }
};

const MAX_BODY_BYTES = 10_000;

/** JSON body of the request, null when missing, invalid, too big or not sent as
 * JSON (a form of another site can only send text/plain or form data) */
export const readJson = async (req: Request): Promise<unknown> => {
  const type = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!req.body || type !== "application/json") return null;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
};
