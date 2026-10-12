import { respond } from "../../../../lib/api";
import { openStream } from "../../../../online/rooms";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ code: string }> };

// Keeps the connection open through proxies that drop idle ones
const HEARTBEAT_MS = 20_000;

/** Server-sent events: this player's view of the room, sent again on every change */
export async function GET(req: Request, { params }: Params) {
  const { code } = await params;
  const token = new URL(req.url).searchParams.get("token");
  const encoder = new TextEncoder();

  let controller!: ReadableStreamDefaultController<Uint8Array>;
  let closed = false;
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    try {
      controller.close();
    } catch {
      // Already closed by the client
    }
  };
  const write = (chunk: string) => {
    if (closed) return;
    try {
      controller.enqueue(encoder.encode(chunk));
    } catch {
      close();
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start: (c) => {
      controller = c;
    },
    cancel: close,
  });

  // An unknown room or player is answered with a JSON error instead
  return respond(() => {
    write("retry: 2000\n\n"); // reconnect quickly if the connection drops
    unsubscribe = openStream(code, token, (view) => write(`data: ${JSON.stringify(view)}\n\n`), close);
    heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
    req.signal.addEventListener("abort", close);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        // no-transform also keeps the response from being compressed (and buffered)
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  });
}
