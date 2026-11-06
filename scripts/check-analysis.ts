// Checks the engine and the game review: npm run analysis:check
// - the solver proves a forced win (and its length) and finds the move;
// - games survive being written as text, and rebuilt from saved positions;
// - a reviewed game: evaluations stay in range, a move giving away a forced win is a
//   blunder, the engine's own moves are never errors.
import { fromGameState, search, seededRng } from "../app/ai/engine";
import { applyMove, getBoardOutcome, newGameState, type Move } from "../app/game/rules";
import { position } from "../app/learn/positions";
import {
  decodeMoves,
  encodeMoves,
  evaluate,
  movesFromStates,
  positionsOf,
  reviewMove,
  ERRORS,
} from "../app/analysis/review";

let failures = 0;
const check = (ok: boolean, message: string) => {
  if (!ok) failures++;
  console.log(`${ok ? "ok" : "FAIL"}: ${message}`);
};

// The forced send of the strategy book: X wins in 3 moves (his, O's only reply, his)
const FORCE = position(
  ["XXX OO. ...", "... .O. ...", "... .O. ...", "O.. ... ...", "X.O .X. ...", "XOX O.X OXO", "... .O. ...", "... ... ...", "X.. .X. O.X"],
  "X",
  3
);
const solved = search(fromGameState(FORCE), { iterations: 50_000, analysis: true, rng: seededRng(1) });
check(solved.move === 3 * 9 + 5, `solver: the forcing move (${solved.move})`);
check(solved.proven?.result === "win" && solved.proven.plies === 3, `solver: proven win in 3 (${JSON.stringify(solved.proven)})`);
check(solved.iterations < 50_000, `solver: stops once solved (${solved.iterations} random games)`);
const evalForce = evaluate(FORCE);
check(evalForce.x === 1 && evalForce.proven?.winner === "X", "evaluation: a forced win counts 100 % for X");

// Games as text, and from saved positions (two moves apart, as against the AI)
const rng = seededRng(7);
let game = newGameState();
const moves: Move[] = [];
const states = [game];
while (!getBoardOutcome(game)) {
  const { move } = search(fromGameState(game), { iterations: 300, rng });
  const m = { board: Math.floor(move / 9), cell: move % 9 };
  moves.push(m);
  game = applyMove(game, m.board, m.cell);
  states.push(game);
}
check(encodeMoves(decodeMoves(encodeMoves(moves))) === encodeMoves(moves), `notation: ${moves.length} moves written and read back`);
check(decodeMoves(encodeMoves(moves) + "11").length === moves.length, "notation: nothing read past the end of the game");
check(decodeMoves("5555").length === 1, "notation: stops at an illegal move");
// The position after each of X's moves, and the current one (the game's end)
const everyOther = states.filter((_, i) => i % 2 === 1);
if (everyOther[everyOther.length - 1] !== game) everyOther.push(game);
check(encodeMoves(movesFromStates(everyOther) ?? []) === encodeMoves(moves), "saved positions two moves apart give the moves back");
check(movesFromStates([states[3]]) === null, "positions three moves apart cannot be told apart");

// A short review: evaluations in range, the engine's moves never errors
const positions = positionsOf(moves.slice(0, 12));
const evals = positions.map((p) => evaluate(p, 4000));
check(evals.every((e) => e.x >= 0 && e.x <= 1), "evaluations between 0 and 1");
for (let i = 0; i < 11; i++) {
  const best = evals[i].best!;
  const r = reviewMove(positions[i], best, evals[i], evaluate(applyMove(positions[i], best.board, best.cell), 4000));
  if (r.grade !== "best") check(false, `the engine's move ${i + 1} is graded ${r.grade}`);
}
check(true, "the engine's own moves are graded best");

// Giving away a forced win: from FORCE, a move that lets O block
const block = { board: 3, cell: 4 };
const after = applyMove(FORCE, block.board, block.cell);
const r = reviewMove(FORCE, block, evalForce, evaluate(after));
check(ERRORS.includes(r.grade) && r.reason !== null, `missing the forced win: ${r.grade}, "${r.reason}"`);

console.log(failures ? `${failures} problem(s)` : "engine and review check out");
process.exit(failures ? 1 : 0);
