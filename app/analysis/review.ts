// Reviewing a finished game with the engine: every position is evaluated, then each move
// is graded by what it cost its player (the expected score lost), like a chess engine's
// analysis. Pure functions: they run in the analysis workers, the page and Node tests.
import { fromGameState, search, seededRng } from "../ai/engine";
import {
  applyMove,
  getBoardOutcome,
  isValidMove,
  newGameState,
  otherSide,
  type GameState,
  type Move,
  type Side,
} from "../game/rules";
import {
  boardName,
  boardWinGiven,
  capital,
  cellName,
  givesFreeChoice,
  legalMoves,
  play,
  winsBoard,
  winsGame,
} from "../learn/positions";

export { decodeMoves, encodeMoves, positionsOf } from "./notation";

/** A move from its number in the engine (board * 9 + cell), or a cell of the flat board */
export const toMove = (m: number): Move => ({ board: Math.floor(m / 9), cell: m % 9 });

export const same = (a: Move | null | undefined, b: Move | null | undefined) =>
  !!a && !!b && a.board === b.board && a.cell === b.cell;

/** The moves of a game from positions it went through, in order (as saved for the undo
 * button: a position before each of your moves, so two moves apart against the AI),
 * the current one last. Null if they cannot be told apart, or if a saved position is
 * not one (a damaged save). */
export const movesFromStates = (states: GameState[]): Move[] | null => {
  try {
    const moves: Move[] = [];
    let game = newGameState();
    for (const next of states) {
      const after = next.superBoard.flat(2);
      if (after.length !== 81) return null;
      // The new marks, the player to move first, then (two moves apart) the other one
      const added = game.superBoard
        .flat(2)
        .flatMap((cell, i) => (cell === after[i] ? [] : cell ? [-1] : [i]))
        .sort((a, b) => (after[a] === game.currentPlayer ? -1 : 0) - (after[b] === game.currentPlayer ? -1 : 0));
      if (added.includes(-1) || added.length > 2) return null;
      for (const i of added) {
        const move = toMove(i);
        // Each new mark must be the one of the player whose move it is
        if (after[i] !== game.currentPlayer) return null;
        if (getBoardOutcome(game) || !isValidMove(game, move.board, move.cell)) return null;
        moves.push(move);
        game = applyMove(game, move.board, move.cell);
      }
    }
    return moves;
  } catch {
    return null;
  }
};

// --- Evaluating a position ---

/** What the engine thinks of a position */
export type PositionEval = {
  /** Expected score of X (a win counts 1, a draw 0.5): X's chances, 0 to 1 */
  x: number;
  /** The best move for the player to move (null once the game is over) */
  best: Move | null;
  /** The line the engine expects, from the best move */
  pv: Move[];
  /** Solved: the result with best play (winner null: a draw), in how many moves */
  proven: { winner: Side | null; plies: number } | null;
};

/** The same position always gets the same seed, so the same evaluation */
const seedOf = (game: GameState) => {
  let h = 2166136261;
  const text = `${game.superBoard.flat(2).map((c) => c ?? ".").join("")}${game.currentPlayer}${game.activeBoard}`;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Random games per position: about 0.2 s each on a computer, evaluations within about
 * half a point of each other from one run to the next */
export const ITERATIONS = 25_000;

export const evaluate = (game: GameState, iterations = ITERATIONS): PositionEval => {
  const outcome = getBoardOutcome(game);
  if (outcome)
    return {
      x: outcome.winner === "X" ? 1 : outcome.winner === "O" ? 0 : 0.5,
      best: null,
      pv: [],
      proven: { winner: outcome.winner, plies: 0 },
    };
  const side = game.currentPlayer;
  const r = search(fromGameState(game), { iterations, rng: seededRng(seedOf(game)), analysis: true });
  return {
    x: side === "X" ? r.winRate : 1 - r.winRate,
    best: toMove(r.move),
    pv: r.pv.map(toMove),
    proven: r.proven && {
      winner: r.proven.result === "draw" ? null : r.proven.result === "win" ? side : otherSide(side),
      plies: r.proven.plies,
    },
  };
};

// --- Grading the moves ---

export type Grade = "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "blunder" | "forced";

/** How each grade is shown, the best first */
export const GRADES: Record<Grade, { label: string; symbol: string }> = {
  best: { label: "Meilleur coup", symbol: "★" },
  excellent: { label: "Excellent", symbol: "!" },
  good: { label: "Bon coup", symbol: "✓" },
  forced: { label: "Coup forcé", symbol: "→" },
  inaccuracy: { label: "Imprécision", symbol: "?!" },
  mistake: { label: "Erreur", symbol: "?" },
  blunder: { label: "Gaffe", symbol: "??" },
};

/** The grades that count as errors, the worst last */
export const ERRORS: Grade[] = ["inaccuracy", "mistake", "blunder"];

/** Expected score lost (0 to 1) from which a move gets each grade. Two evaluations of
 * the same position differ by about 0.01: a few points are needed to call it an error. */
const LIMITS: [number, Grade][] = [
  [0.18, "blunder"],
  [0.1, "mistake"],
  [0.05, "inaccuracy"],
  [0.02, "good"],
];

export type MoveReview = {
  side: Side;
  move: Move;
  grade: Grade;
  /** Expected score the move lost its player (0 to 1) */
  loss: number;
  /** 0 to 100, as chess sites count it (100: nothing lost) */
  accuracy: number;
  /** Why it was an error, in words (null for a good move, or nothing simple to say) */
  reason: string | null;
};

/** The expected score of a side in an evaluated position */
export const scoreOf = (side: Side, e: PositionEval) => (side === "X" ? e.x : 1 - e.x);


/** The accuracy of a move from the points of winning chances it lost (lichess' curve) */
const accuracyOf = (loss: number) =>
  Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss * 100) - 3.1669));

/** Grades the move played from `game`, given the evaluations before and after it */
export const reviewMove = (game: GameState, move: Move, before: PositionEval, after: PositionEval): MoveReview => {
  const side = game.currentPlayer;
  const forced = legalMoves(game).length === 1;
  let loss = forced || same(before.best, move) ? 0 : Math.max(0, scoreOf(side, before) - scoreOf(side, after));
  // A proven win is exact (100 %), the next position's chances only estimated: unless
  // that one is proven too, the win may still be there, the engine just cannot be sure
  if (before.proven?.winner === side && !after.proven) loss = Math.min(loss, LIMITS[2][0]);
  const grade: Grade = forced
    ? "forced"
    : same(before.best, move) || loss < 0.005
      ? "best"
      : (LIMITS.find(([limit]) => loss >= limit)?.[1] ?? "excellent");
  return {
    side,
    move,
    grade,
    loss,
    accuracy: accuracyOf(loss),
    reason: ERRORS.includes(grade) ? reasonOf(game, move, before, after) : null,
  };
};

/** "la case au centre de la grille en haut à gauche" */
export const moveName = (m: Move) => `${cellName(m.cell)} de ${boardName(m.board)}`;

/** What went wrong, in the words of the strategy book */
const reasonOf = (game: GameState, move: Move, before: PositionEval, after: PositionEval): string | null => {
  const side = game.currentPlayer;
  const other = otherSide(side);
  const best = before.best;
  if (best && winsGame(game, best)) return `${side} pouvait gagner la partie : ${moveName(best)}.`;
  if (after.proven?.winner === other && before.proven?.winner !== other) {
    const moves = Math.ceil(after.proven.plies / 2);
    return `${other} a maintenant une victoire forcée, en ${moves} ${moves > 1 ? "coups" : "coup"} au plus.`;
  }
  if (before.proven?.winner === side)
    return after.proven
      ? `${side} avait une victoire forcée et la laisse passer.`
      : `${side} avait une victoire forcée : après ce coup, le moteur n'en trouve plus de sûre.`;
  if (givesFreeChoice(game, move)) return `${capital(boardName(move.cell))} est fermée : ${other} peut jouer où il veut.`;
  const gift = boardWinGiven(game, move);
  if (gift) return `Ce coup envoie ${other} dans ${boardName(gift.board)}, qu'il peut gagner tout de suite.`;
  if (best && winsBoard(game, best) && !winsBoard(game, move))
    return `${side} pouvait gagner ${boardName(best.board)}.`;
  const reply = after.best;
  if (reply && winsBoard(play(game, move), reply)) return `${other} peut répondre en gagnant ${boardName(reply.board)}.`;
  // Nothing simple to say: the points lost and the better move speak for it
  return null;
};

// --- The whole game ---

export type PlayerSummary = {
  /** Mean accuracy of the player's moves, 0 to 100 */
  accuracy: number;
  counts: Record<Grade, number>;
};

export const summarize = (reviews: MoveReview[], side: Side): PlayerSummary => {
  const own = reviews.filter((r) => r.side === side);
  const counts = Object.fromEntries(Object.keys(GRADES).map((g) => [g, 0])) as Record<Grade, number>;
  for (const r of own) counts[r.grade]++;
  const accuracy = own.length ? own.reduce((sum, r) => sum + r.accuracy, 0) / own.length : 100;
  return { accuracy, counts };
};
