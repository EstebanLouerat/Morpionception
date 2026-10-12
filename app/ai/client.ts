// The AI opponent in the browser: asks the worker for a move.
import { chooseMove, type Level } from "./engine";
import type { GameState } from "../game/rules";
import type { AiRequest, AiResponse } from "./ai.worker";

export type AiPlayer = {
  /** Move of the AI for this game (rejected when cancelled by a newer request) */
  think: (game: GameState, level: Level) => Promise<{ board: number; cell: number }>;
  dispose: () => void;
};

/** One AI per game screen. Falls back to thinking on the page if workers are unavailable. */
export const createAiPlayer = (): AiPlayer => {
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL("./ai.worker.ts", import.meta.url));
  } catch {
    worker = null;
  }
  let nextId = 0;
  const pending = new Map<number, (move: AiResponse) => void>();
  if (worker) {
    worker.onmessage = (e: MessageEvent<AiResponse>) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
  }

  return {
    think: (game, level) => {
      const id = ++nextId;
      if (!worker) {
        // Let the page paint "L'IA réfléchit…" before blocking it
        return new Promise((resolve) => setTimeout(() => resolve(chooseMove(game, level)), 50));
      }
      return new Promise((resolve) => {
        pending.set(id, resolve);
        worker!.postMessage({ id, game, level } satisfies AiRequest);
      });
    },
    dispose: () => {
      worker?.terminate();
      pending.clear();
    },
  };
};
