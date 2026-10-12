import { useEffect, useState } from "react";
import { getRoomToken, joinRoom, sendPresence } from "./client";
import { PRESENCE_BEAT_MS, type RoomError, type RoomView } from "./protocol";

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

    // The other player sees us online while this page says so. Not crypto.randomUUID:
    // it is missing on plain HTTP (a phone on the local network)
    const page = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    const here = () =>
      void sendPresence(code, page).then((res) => {
        // Room gone or seat lost: nothing to tell any more
        if (!res.ok && res.error !== "network") clearInterval(beat);
      });
    const gone = () => void sendPresence(code, page, true);
    const beat = setInterval(here, PRESENCE_BEAT_MS);
    here();
    // pagehide: closed, refreshed or put in the back/forward cache; pageshow: back from it
    window.addEventListener("pagehide", gone);
    window.addEventListener("pageshow", here);

    return () => {
      stopped = true;
      source?.close();
      clearTimeout(retry);
      clearInterval(beat);
      window.removeEventListener("pagehide", gone);
      window.removeEventListener("pageshow", here);
      gone();
    };
  }, [code]);

  return state;
};
