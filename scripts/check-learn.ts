// Checks the puzzles of the strategy book against the game's rules:
//   npm run learn:check
// Every puzzle must have at least one right answer and one wrong one; a wrong answer
// that comes with a punishing reply must be a legal reply; a two-move puzzle must be
// finishable after the right answer, whatever the opponent replies.
import { LESSONS } from "../app/learn/book";
import { legalMoves, play, winsGame } from "../app/learn/positions";

let failures = 0;
const fail = (message: string) => {
  failures++;
  console.error("  FAIL:", message);
};

for (const lesson of LESSONS) {
  const widget = lesson.widget;
  if (widget.kind === "replay") {
    let state = widget.start;
    for (const [i, move] of widget.moves.entries()) {
      if (!legalMoves(state).some((m) => m.board === move.board && m.cell === move.cell))
        fail(`${lesson.id}: replay move ${i + 1} is not legal`);
      state = play(state, move);
    }
    console.log(`${lesson.id}: replay of ${widget.moves.length} legal moves`);
    continue;
  }
  if (widget.kind !== "puzzle") continue;
  const { state, judge, finish } = widget.puzzle;
  const moves = legalMoves(state);
  const verdicts = moves.map((move) => ({ move, verdict: judge(state, move) }));
  const right = verdicts.filter((v) => v.verdict.ok);
  const wrong = verdicts.filter((v) => !v.verdict.ok);
  console.log(
    `${lesson.id}: ${moves.length} moves, right: ${right.map((v) => `${v.move.board}/${v.move.cell}`).join(" ")}`
  );
  for (const v of wrong) console.log(`    ${v.move.board}/${v.move.cell}: ${v.verdict.text}`);
  if (!right.length) fail(`${lesson.id}: no right answer`);
  if (!wrong.length) fail(`${lesson.id}: no wrong answer`);
  for (const { move, verdict } of wrong) {
    if (!verdict.punish) continue;
    const after = play(state, move);
    if (!legalMoves(after).some((m) => m.board === verdict.punish!.board && m.cell === verdict.punish!.cell))
      fail(`${lesson.id}: punishing reply after ${move.board}/${move.cell} is not legal`);
  }
  if (finish)
    for (const { move } of right) {
      const after = play(state, move);
      for (const reply of legalMoves(after)) {
        const next = play(after, reply);
        if (!legalMoves(next).some((m) => winsGame(next, m)))
          fail(`${lesson.id}: after ${move.board}/${move.cell} and ${reply.board}/${reply.cell}, no win`);
      }
    }
}
console.log(failures ? `${failures} problem(s)` : "every lesson checks out");
process.exit(failures ? 1 : 0);
