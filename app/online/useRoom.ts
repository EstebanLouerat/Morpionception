import { useEffect, useState } from "react";
import { getRoomToken, joinRoom } from "./client";
import type { RoomError, RoomView } from "./protocol";

export type RoomConnection = {
  view: RoomView | null;
  /** Date.now() when the view arrived, to run the clocks from it */
  receivedAt: number;
  /** The live connection is up (it reconnects by itself when it drops) */
  connected: boolean;
  /** The room cannot be followed any more (gone, or not ours) */
  error: RoomError | null;
};

/** Live view of a room we have a seat in, pushed by the server */
export const useRoom = (code: string | null): RoomConnection => {
  const [state, setState] = useState<RoomConnection>({
    view: null,
    receivedAt: 0,
    connected: false,
    error: null,
  });

  useEffect(() => {
    const token = code && getRoomToken(code);
    if (!code || !token) return;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const open = () => {
      source = new EventSource(`/api/rooms/${code}/events?token=${encodeURIComponent(token)}`);
      source.onmessage = (e) =>
        setState({ view: JSON.parse(e.data), receivedAt: Date.now(), connected: true, error: null });
      source.onerror = () => {
        setState((s) => ({ ...s, connected: false }));
        // CONNECTING: the browser retries by itself. CLOSED: the server answered
        // with an error, ask it why and only retry if the seat is still ours.
        if (source?.readyState !== EventSource.CLOSED) return;
        source.close();
        joinRoom(code).then((res) => {
          if (stopped) return;
          if (res.ok || res.error === "network") retry = setTimeout(open, 2000);
          else setState((s) => ({ ...s, error: res.error }));
        });
      };
    };
    open();

    return () => {
      stopped = true;
      source?.close();
      clearTimeout(retry);
    };
  }, [code]);

  return state;
};
