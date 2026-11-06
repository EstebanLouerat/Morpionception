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

export const createEvaluator = (size = poolSize()): Evaluator => {
  const queue: Task[] = [];
  const idle: Worker[] = [];
  const busy = new Map<Worker, Task>();
  let started = 0;
  let broken = false;
  let disposed = false;
  // Without workers (they could not start), the positions are evaluated on the page,
  // one at a time with a pause between them so it can draw what changed; what is still
  // waiting can be dropped (clear, dispose) like with workers
  let here: ReturnType<typeof setTimeout> | null = null;
  const runHere = () => {
    if (here || disposed || !queue.length) return;
    here = setTimeout(() => {
      here = null;
      const task = queue.shift();
      if (task && !disposed) task.resolve(evaluate(task.game, task.iterations));
      runHere();
    }, 30);
  };

  const fail = (worker: Worker) => {
    // Its task (if any) goes on without workers, and so does everything after it
    broken = true;
    const task = busy.get(worker);
    busy.delete(worker);
    worker.terminate();
    if (task) queue.unshift(task);
    runHere();
  };

  const spawn = (): Worker | null => {
    try {
      const worker = new Worker(new URL("./analysis.worker.ts", import.meta.url));
      worker.onmessage = (e: MessageEvent<EvalResponse>) => {
        const task = busy.get(worker);
        busy.delete(worker);
        idle.push(worker);
        if (task) {
          // The worker could not evaluate it: next in line, on the page
          if ("error" in e.data) {
            queue.unshift(task);
            broken = true;
          } else task.resolve(e.data.eval);
        }
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
      if (broken) return runHere();
      const worker = idle.pop() ?? (started < size ? spawn() : null);
      // None free; or none could start, and the next turn of the loop goes on without
      if (!worker) {
        if (broken) continue;
        return;
      }
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
      if (here) clearTimeout(here);
      for (const worker of [...idle, ...busy.keys()]) worker.terminate();
      idle.length = 0;
      busy.clear();
    },
  };
};
