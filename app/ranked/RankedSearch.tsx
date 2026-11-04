"use client";

// The ranked search runs in the background, on every page: started on the ranked page,
// it goes on while the player looks around the site, with a small indicator; once an
// opponent is found, a fullscreen animation opens the game. A ranked game still going
// on brings the player back to it.
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { useAccount } from "../account/client";
import { ACCOUNT_ERROR_MESSAGES } from "../account/protocol";
import { playFx } from "../audio/engine";
import { POLL_MS, queue } from "./client";
import type { QueueStatus } from "./protocol";
import MatchFound, { MATCH_FOUND_MS } from "./MatchFound";
import SearchPill from "./SearchPill";

type Matched = Extract<QueueStatus, { status: "matched" }>;

type RankedSearchState = {
  /** null until known (and for guests) */
  status: QueueStatus | null;
  /** When the search started, on this device */
  startedAt: number;
  error: string | null;
  start: () => Promise<void>;
  cancel: () => Promise<void>;
};

const RankedSearchContext = createContext<RankedSearchState | null>(null);

export const useRankedSearch = () => {
  const value = useContext(RankedSearchContext);
  if (!value) throw new Error("useRankedSearch outside RankedSearchProvider");
  return value;
};

// Pages a ranked game in progress does not pull the player away from: the game itself,
// and the settings opened from it
const STAYS = ["/game", "/parametres"];

export const gameHref = (code: string) => `/game?room=${code}`;

const RankedSearchProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const account = useAccount();
  const userId = account.status === "user" ? account.account.id : null;

  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Found while searching: shown full screen, then the game opens
  const [found, setFound] = useState<Matched | null>(null);
  const searching = status?.status === "searching";
  const searchingRef = useRef(false);
  searchingRef.current = searching;
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  /** Takes in an answer of the queue. fromSearch: this device was searching */
  const apply = useCallback(
    (res: Awaited<ReturnType<typeof queue>>, fromSearch: boolean) => {
      if (!res.ok) {
        // Logged out meanwhile: nothing to search for
        if (res.error === "unauthorized") setStatus(null);
        else setError(ACCOUNT_ERROR_MESSAGES[res.error]);
        return;
      }
      setError(null);
      setStatus(res.data);
      setStartedAt((t) => (res.data.status === "searching" ? t || Date.now() : 0));
      if (res.data.status !== "matched") return;
      const here = pathRef.current;
      const inGame = here === "/game" && new URLSearchParams(location.search).get("room") === res.data.code;
      if (fromSearch && !inGame) {
        playFx("matchFound");
        setFound(res.data);
      } else if (!STAYS.includes(here)) {
        // A game still going on: back to it
        router.replace(gameHref(res.data.code));
      }
    },
    [router]
  );

  // Where things stand, at each page change of a logged-in player (a game going on
  // sends them back to it)
  useEffect(() => {
    if (!userId) {
      setStatus(null);
      return;
    }
    if (searchingRef.current) return;
    let live = true;
    queue("poll").then((res) => live && apply(res, false));
    return () => {
      live = false;
    };
  }, [userId, pathname, apply]);

  // While searching, from any page: still there, and is there an opponent?
  useEffect(() => {
    if (!searching) return;
    const timer = setInterval(() => queue("poll").then((res) => apply(res, true)), POLL_MS);
    return () => clearInterval(timer);
  }, [searching, apply]);

  // Closing the site stops the search (it would go on alone otherwise)
  useEffect(() => {
    const leave = () => {
      if (searchingRef.current) void queue("leave");
    };
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, []);

  // The animation, then the game
  useEffect(() => {
    if (!found) return;
    const timer = setTimeout(() => {
      router.push(gameHref(found.code));
      // Cleared once the game page is there, so the animation covers the change
      setTimeout(() => setFound(null), 400);
    }, MATCH_FOUND_MS);
    return () => clearTimeout(timer);
  }, [found, router]);

  const start = useCallback(async () => {
    setStartedAt(Date.now());
    apply(await queue("join"), true);
  }, [apply]);
  const cancel = useCallback(async () => apply(await queue("leave"), true), [apply]);

  const me = account.status === "user" ? account.account : null;
  const showPill = searching && pathname !== "/jouer/classe" && pathname !== "/game";

  return (
    <RankedSearchContext.Provider value={{ status, startedAt, error, start, cancel }}>
      {children}
      <AnimatePresence>
        {showPill && status?.status === "searching" && (
          <SearchPill key="pill" startedAt={startedAt} onCancel={cancel} />
        )}
      </AnimatePresence>
      <AnimatePresence>{found && me && <MatchFound key="found" me={me} status={found} />}</AnimatePresence>
    </RankedSearchContext.Provider>
  );
};

export default RankedSearchProvider;
