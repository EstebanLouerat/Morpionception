"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GameState, Move } from "../game/rules";
import { createEvaluator, type Evaluator } from "./pool";
import { encodeMoves, positionsOf, reviewMove, type PositionEval } from "./review";

// Finished analyses are kept on the device (the latest few), so a game opened again
// shows at once. The engine's version is in the key: a new engine analyses again.
const CACHE_KEY = "morpionception_analyses";
const VERSION = 1;
const KEEP = 6;

type Cached = { v: number; moves: string; evals: PositionEval[] };

const readCache = (moves: string): PositionEval[] | null => {
  try {
    const all: Cached[] = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]");
    return all.find((c) => c.v === VERSION && c.moves === moves)?.evals ?? null;
  } catch {
    return null;
  }
};

const writeCache = (moves: string, evals: PositionEval[]) => {
  try {
    const all: Cached[] = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "[]");
    const kept = all.filter((c) => c.v === VERSION && c.moves !== moves).slice(0, KEEP - 1);
    localStorage.setItem(CACHE_KEY, JSON.stringify([{ v: VERSION, moves, evals }, ...kept]));
  } catch {
    // Storage full or unavailable: analysed again next time
  }
};

/** The engine's review of a game: every position evaluated (in order, several at a
 * time), each move graded as soon as the positions around it are */
export const useGameReview = (moves: Move[]) => {
  const key = encodeMoves(moves);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the key stands for the moves
  const positions = useMemo(() => positionsOf(moves), [key]);
  const [evals, setEvals] = useState<(PositionEval | null)[]>(() => positions.map(() => null));

  useEffect(() => {
    const cached = readCache(key);
    if (cached && cached.length === positions.length) {
      setEvals(cached);
      return;
    }
    const evaluator = createEvaluator();
    const results: (PositionEval | null)[] = positions.map(() => null);
    let alive = true;
    setEvals([...results]);
    positions.forEach((position, i) =>
      evaluator.evaluate(position).then((e) => {
        if (!alive) return;
        results[i] = e;
        setEvals([...results]);
        if (results.every(Boolean)) writeCache(key, results as PositionEval[]);
      })
    );
    return () => {
      alive = false;
      evaluator.dispose();
    };
  }, [key, positions]);

  const reviews = useMemo(
    () =>
      moves.map((move, i) => {
        const before = evals[i];
        const after = evals[i + 1];
        return before && after ? reviewMove(positions[i], move, before, after) : null;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key stands for the moves
    [evals, positions]
  );
  const done = evals.filter(Boolean).length;
  return { positions, evals, reviews, done, total: positions.length };
};

/** Random games for a position looked at on its own (a variation): deeper than in a
 * full review, about half a second on a computer */
const LIVE_ITERATIONS = 60_000;

/** The engine's view of one position, refreshed when it changes (null meanwhile) */
export const useLiveEval = (game: GameState | null) => {
  const evaluator = useRef<Evaluator | null>(null);
  const [result, setResult] = useState<{ game: GameState; eval: PositionEval } | null>(null);

  useEffect(() => {
    evaluator.current = createEvaluator(1);
    return () => evaluator.current?.dispose();
  }, []);

  useEffect(() => {
    if (!game || !evaluator.current) return;
    let current = true;
    // Only the latest position matters: what is waiting goes
    evaluator.current.clear();
    evaluator.current.evaluate(game, LIVE_ITERATIONS).then((e) => {
      if (current) setResult({ game, eval: e });
    });
    return () => {
      current = false;
    };
  }, [game]);

  return result && result.game === game ? result.eval : null;
};
