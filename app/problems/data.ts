import data from "./problems.json";
import type { Problem, ProblemLevel } from "./types";
import type { ProblemResult } from "./progress";

export const PROBLEMS = data as Problem[];

export const LEVELS: { id: ProblemLevel; label: string; hint: string }[] = [
  { id: "facile", label: "Facile", hint: "Gagner en un coup, voir le coup évident." },
  { id: "moyen", label: "Moyen", hint: "Victoires en deux coups, pièges simples." },
  { id: "difficile", label: "Difficile", hint: "Victoires en trois coups, le coup que l'on rate." },
  { id: "expert", label: "Expert", hint: "Longues victoires forcées, coups que seul le moteur voit." },
];

export const levelLabel = (level: ProblemLevel) => LEVELS.find((l) => l.id === level)!.label;

export const problemById = (id: string | null) => PROBLEMS.find((p) => p.id === id) ?? null;

/** The next problem of a level not tried yet, after `after` if given (null: all done) */
export const nextProblem = (level: ProblemLevel, results: Record<string, ProblemResult>, after?: string) => {
  const here = PROBLEMS.filter((p) => p.level === level);
  const start = after ? here.findIndex((p) => p.id === after) + 1 : 0;
  return [...here.slice(start), ...here.slice(0, start)].find((p) => !results[p.id]) ?? null;
};
