// The AI opponent in the browser: asks the worker for a move.
import { chooseMove, type Level } from "./engine";
import type { GameState } from "../game/rules";
import type { AiRequest, AiResponse } from "./ai.worker";

type Move = { board: number; cell: number };

export type AiPlayer = {
  /** Move of the AI for this game. Never settles if cancelled meanwhile. */
  think: (game: GameState, level: Level) => Promise<Move>;
  /** Drops the search in progress (undo, new game): the next one starts at once */
  cancel: () => void;
  dispose: () => void;
};

type Pending = { game: GameState; level: Level; resolve: (move: Move) => void };

/** On the page, when there is no worker: a short pause first so the page can show
 * "Réfléchit…" before the search blocks it */
const thinkHere = (game: GameState, level: Level) =>
  new Promise<Move>((resolve) => setTimeout(() => resolve(chooseMove(game, level)), 50));

/** One AI per game screen */
export const createAiPlayer = (): AiPlayer => {
  let worker: Worker | null = null;
  let workerBroken = false;
  let nextId = 0;
  const pending = new Map<number, Pending>();

  // Searches waiting for the worker go on without it (e.g. its file could not load
  // after a new version was deployed): thinking on the page beats waiting forever
  const giveUpWorker = () => {
    worker?.terminate();
    worker = null;
    workerBroken = true;
    for (const { game, level, resolve } of pending.values()) thinkHere(game, level).then(resolve);
    pending.clear();
  };

  const getWorker = () => {
    if (worker || workerBroken) return worker;
    try {
      worker = new Worker(new URL("./ai.worker.ts", import.meta.url));
    } catch {
      workerBroken = true;
      return null;
    }
    worker.onmessage = (e: MessageEvent<AiResponse>) => {
      const request = pending.get(e.data.id);
      if (!request) return;
      pending.delete(e.data.id);
      if ("error" in e.data) thinkHere(request.game, request.level).then(request.resolve);
      else request.resolve(e.data);
    };
    worker.onerror = giveUpWorker;
    worker.onmessageerror = giveUpWorker;
    return worker;
  };

  return {
    think: (game, level) => {
      const target = getWorker();
      if (!target) return thinkHere(game, level);
      const id = ++nextId;
      return new Promise((resolve) => {
        pending.set(id, { game, level, resolve });
        target.postMessage({ id, game, level } satisfies AiRequest);
      });
    },
    cancel: () => {
      // The worker cannot be interrupted mid-search: replace it (its file is cached)
      if (!pending.size) return;
      pending.clear();
      worker?.terminate();
      worker = null;
    },
    dispose: () => {
      pending.clear();
      worker?.terminate();
      worker = null;
    },
  };
};
