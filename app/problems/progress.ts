// The problems tried on this device: the result of the first try of each (solved
// without help, solved with help, or the solution seen) and the run of clean solves
import { createPersistedStore } from "../lib/persistedStore";

export type ProblemResult = "clean" | "helped" | "failed";

type ProblemProgress = {
  results: Record<string, ProblemResult>;
  /** Problems solved in a row without a mistake or a hint, now and at best */
  streak: number;
  bestStreak: number;
};

const RESULTS: ProblemResult[] = ["clean", "helped", "failed"];
const count = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0);

const store = createPersistedStore<ProblemProgress>(
  "morpionception_problemes",
  { results: {}, streak: 0, bestStreak: 0 },
  (raw) => ({
    results: Object.fromEntries(
      Object.entries((raw.results ?? {}) as Record<string, unknown>).filter(([, r]) =>
        RESULTS.includes(r as ProblemResult)
      )
    ) as Record<string, ProblemResult>,
    streak: count(raw.streak),
    bestStreak: count(raw.bestStreak),
  })
);

export const useProblemProgress = store.use;

/** A problem finished: only its first try counts (solving it again is easier) */
export const recordProblem = (id: string, result: ProblemResult) => {
  const { results, streak, bestStreak } = store.get();
  if (results[id]) return;
  const next = result === "clean" ? streak + 1 : 0;
  store.set({ results: { ...results, [id]: result }, streak: next, bestStreak: Math.max(bestStreak, next) });
};
