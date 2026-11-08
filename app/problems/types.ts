// Problems (puzzles): positions from games played by the engine, checked in advance
// with deep searches (scripts/make-problems.ts), so every answer is known before it is
// played: no engine runs while solving.
import type { Move } from "../game/rules";

export type ProblemKind = "win" | "best";
export type ProblemLevel = "facile" | "moyen" | "difficile" | "expert";

/** A move as two digits, the board then the cell, 1 to 9 each (as in game links) */
export type MoveKey = string;
export const keyOf = (m: Move): MoveKey => `${m.board + 1}${m.cell + 1}`;
export const moveOf = (key: MoveKey): Move => ({ board: Number(key[0]) - 1, cell: Number(key[1]) - 1 });

/** What the search found about one possible move of a step */
export type OptionInfo = {
  /** Chances of the player to move after it (expected score, 0 to 1) */
  v: number;
  /** The opponent's best answer to it (null when it ends the game) */
  r: MoveKey | null;
  /** Keeps a forced win (problems of kind "win") */
  w?: boolean;
};

/** One move to find */
export type ProblemStep = {
  /** Every legal move */
  options: Record<MoveKey, OptionInfo>;
  /** The moves accepted (a forced win's only move, or the engine's top moves) */
  ok: MoveKey[];
  /** The move of the solution line */
  best: MoveKey;
  /** The opponent's answer on the solution line, null at the last step */
  reply: MoveKey | null;
};

export type Problem = {
  id: string;
  /** win: win by force, every move found in turn; best: find the engine's top move */
  kind: ProblemKind;
  level: ProblemLevel;
  /** The game up to the position (encoded, see app/analysis/notation.ts) */
  moves: string;
  steps: ProblemStep[];
};
