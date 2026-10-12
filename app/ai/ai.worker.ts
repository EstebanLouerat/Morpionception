// Runs the AI search away from the page, so the board stays responsive while it thinks
import { chooseMove, type Level } from "./engine";
import type { GameState } from "../game/rules";

export type AiRequest = { id: number; game: GameState; level: Level };
export type AiResponse = { id: number; board: number; cell: number };

const worker = self as unknown as {
  onmessage: (e: MessageEvent<AiRequest>) => void;
  postMessage: (message: AiResponse) => void;
};

worker.onmessage = ({ data: { id, game, level } }) => {
  const { board, cell } = chooseMove(game, level);
  worker.postMessage({ id, board, cell });
};
