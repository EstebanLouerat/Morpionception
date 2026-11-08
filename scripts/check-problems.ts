// Checks the problems against the game's rules: npm run problems:check
// Each problem starts from a real, unfinished game; every step lists exactly the legal
// moves, with legal answers; the solution line replays; a forced win's steps have a
// single winning move until the last, whose accepted moves win the game; a best-move
// problem's accepted moves are the top ones, well ahead of the rest.
import data from "../app/problems/problems.json";
import { applyMove, getBoardOutcome, type GameState } from "../app/game/rules";
import { decodeMoves, positionsOf } from "../app/analysis/notation";
import { legalMoves, winsGame } from "../app/learn/positions";
import { keyOf, moveOf, type Problem } from "../app/problems/types";

const problems = data as Problem[];
let failures = 0;
const fail = (id: string, message: string) => {
  failures++;
  console.error(`FAIL ${id}: ${message}`);
};
const play = (s: GameState, key: string) => {
  const m = moveOf(key);
  return applyMove(s, m.board, m.cell);
};
const legal = (s: GameState) => legalMoves(s).map(keyOf);

const ids = new Set<string>();
for (const p of problems) {
  if (ids.has(p.id)) fail(p.id, "duplicate id");
  ids.add(p.id);
  const moves = decodeMoves(p.moves);
  if (moves.length * 2 !== p.moves.length) fail(p.id, "the game does not replay");
  let s = positionsOf(moves).at(-1)!;
  if (getBoardOutcome(s)) fail(p.id, "the game is already over");
  if (p.kind === "best" && p.steps.length !== 1) fail(p.id, "a best-move problem has one step");
  const expected = { 1: "facile", 2: "moyen", 3: "difficile" }[p.steps.length] ?? "expert";
  if (p.kind === "win" && p.level !== expected) fail(p.id, `level ${p.level} for a win in ${p.steps.length}`);
  p.steps.forEach((step, i) => {
    const last = i === p.steps.length - 1;
    const keys = legal(s);
    if (keys.slice().sort().join() !== Object.keys(step.options).sort().join()) fail(p.id, `step ${i + 1}: options are not the legal moves`);
    if (!step.ok.includes(step.best) || step.ok.some((k) => !keys.includes(k))) fail(p.id, `step ${i + 1}: accepted moves`);
    for (const [k, o] of Object.entries(step.options)) {
      if (!keys.includes(k)) continue;
      const after = play(s, k);
      if (o.r && !legal(after).includes(o.r)) fail(p.id, `step ${i + 1}: answer to ${k} is not legal`);
      if (!o.r && !getBoardOutcome(after)) fail(p.id, `step ${i + 1}: no answer to ${k}`);
    }
    if (p.kind === "win") {
      if (!last && (step.ok.length !== 1 || !step.options[step.best].w)) fail(p.id, `step ${i + 1}: a single winning move`);
      if (last && step.ok.some((k) => !winsGame(s, moveOf(k)))) fail(p.id, "the last step must win the game");
    } else {
      const top = Math.max(...Object.values(step.options).map((o) => o.v));
      const rest = Object.entries(step.options).filter(([k]) => !step.ok.includes(k));
      if (step.ok.some((k) => step.options[k].v < top - 0.03)) fail(p.id, "an accepted move is not a top one");
      if (rest.some(([, o]) => o.v > top - 0.15)) fail(p.id, "another move is too close to the best");
    }
    if (last !== (step.reply === null)) fail(p.id, `step ${i + 1}: a reply on every step but the last`);
    if (step.reply) {
      const after = play(s, step.best);
      if (!legal(after).includes(step.reply)) fail(p.id, `step ${i + 1}: the reply is not legal`);
      s = play(after, step.reply);
    }
  });
}
const count = (f: (p: Problem) => boolean) => problems.filter(f).length;
for (const level of ["facile", "moyen", "difficile", "expert"])
  console.log(`${level}: ${count((p) => p.level === level && p.kind === "win")} win, ${count((p) => p.level === level && p.kind === "best")} best`);
console.log(failures ? `${failures} problem(s)` : `${problems.length} problems check out`);
process.exit(failures ? 1 : 0);
