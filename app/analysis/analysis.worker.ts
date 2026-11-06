// Evaluates positions away from the page, so the analysis never blocks it
import { evaluate, type PositionEval } from "./review";
import type { GameState } from "../game/rules";

export type EvalRequest = { id: number; game: GameState; iterations?: number };
export type EvalResponse = { id: number; eval: PositionEval } | { id: number; error: string };

const worker = self as unknown as {
  onmessage: (e: MessageEvent<EvalRequest>) => void;
  postMessage: (message: EvalResponse) => void;
};

worker.onmessage = ({ data: { id, game, iterations } }) => {
  try {
    worker.postMessage({ id, eval: evaluate(game, iterations) });
  } catch (e) {
    worker.postMessage({ id, error: String(e) });
  }
};
