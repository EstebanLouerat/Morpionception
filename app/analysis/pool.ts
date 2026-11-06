// The engine in the browser: a few Web Workers evaluate positions side by side (one
// per spare core), so a whole game is analysed in seconds.
import { evaluate, type PositionEval } from "./review";
import type { GameState } from "../game/rules";
import type { EvalRequest, EvalResponse } from "./analysis.worker";

type Task = { game: GameState; iterations?: number; resolve: (e: PositionEval) => void };

export type Evaluator = {
  /** The engine's view of the position. Never settles once disposed. */
  evaluate: (game: GameState, iterations?: number) => Promise<PositionEval>;
  /** Drops what is waiting (not what a worker is already on) */
  clear: () => void;
  dispose: () => void;
};

/** Workers to start: the cores the device has, one left for the page, at most 4 */
export const poolSize = () =>
  Math.max(1, Math.min(4, (typeof navigator !== "undefined" ? navigator.hardwareConcurrency || 2 : 2) - 1));

/** Without workers (they could not start), each position is evaluated on the page,
 * after a pause that lets it draw what changed */
const evaluateHere = (task: Task) =>
  setTimeout(() => task.resolve(evaluate(task.game, task.iterations)), 30);

export const createEvaluator = (size = poolSize()): Evaluator => {
  const queue: Task[] = [];
  const idle: Worker[] = [];
  const busy = new Map<Worker, Task>();
  let started = 0;
  let broken = false;
  let disposed = false;

  const fail = (worker: Worker) => {
    // Its task (if any) goes on without workers, and so does everything after it
    broken = true;
    const task = busy.get(worker);
    busy.delete(worker);
    worker.terminate();
    if (task) evaluateHere(task);
    while (queue.length) evaluateHere(queue.shift()!);
  };

  const spawn = (): Worker | null => {
    try {
      const worker = new Worker(new URL("./analysis.worker.ts", import.meta.url));
      worker.onmessage = (e: MessageEvent<EvalResponse>) => {
        const task = busy.get(worker);
        busy.delete(worker);
        if (task) {
          if ("error" in e.data) evaluateHere(task);
          else task.resolve(e.data.eval);
        }
        idle.push(worker);
        pump();
      };
      worker.onerror = () => fail(worker);
      worker.onmessageerror = () => fail(worker);
      started++;
      return worker;
    } catch {
      broken = true;
      return null;
    }
  };

  const pump = () => {
    while (queue.length && !disposed) {
      if (broken) {
        evaluateHere(queue.shift()!);
        continue;
      }
      const worker = idle.pop() ?? (started < size ? spawn() : null);
      if (!worker) return;
      const task = queue.shift()!;
      busy.set(worker, task);
      worker.postMessage({ id: 0, game: task.game, iterations: task.iterations } satisfies EvalRequest);
    }
  };

  return {
    evaluate: (game, iterations) =>
      new Promise((resolve) => {
        if (disposed) return;
        queue.push({ game, iterations, resolve });
        pump();
      }),
    clear: () => {
      queue.length = 0;
    },
    dispose: () => {
      disposed = true;
      queue.length = 0;
      for (const worker of [...idle, ...busy.keys()]) worker.terminate();
      idle.length = 0;
      busy.clear();
    },
  };
};
