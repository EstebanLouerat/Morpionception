// Checks the puzzles of the strategy book against the game's rules:
//   npm run learn:check
// Every puzzle must have at least one right answer and one wrong one; a wrong answer
// that comes with a punishing reply must be a legal reply; a two-move puzzle must be
// finishable after the right answer, whatever the opponent replies (and when the goal is
// the game, he has a single reply). A search has an answer and something else to tap.
import { LESSONS } from "../app/learn/book";
import { isDead, legalMoves, liveLines, play, winsBoard, winsGame } from "../app/learn/positions";

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
  if (widget.kind === "live") {
    const { state } = widget;
    const open = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((b) => !state.winners[b]);
    const count = (b: number) => liveLines(state, state.currentPlayer, b).length;
    const most = Math.max(...open.map(count));
    const best = open.filter((b) => count(b) === most);
    console.log(`${lesson.id}: live lines ${open.map((b) => `${b}:${count(b)}`).join(" ")}`);
    if (best.length !== 1) fail(`${lesson.id}: ${best.length} boards keep the most lines, one expected`);
    // The widget starts on the center: finding the answer must take a tap
    if (best.includes(4)) fail(`${lesson.id}: the center is the answer`);
    continue;
  }
  if (widget.kind === "dead") {
    const { state } = widget;
    const boards = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const dead = boards.filter((b) => isDead(state, b));
    console.log(`${lesson.id}: dead boards ${dead.join(" ")}`);
    if (!dead.length) fail(`${lesson.id}: no dead board`);
    if (dead.length === boards.length) fail(`${lesson.id}: every board is dead`);
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
      const replies = legalMoves(after);
      if (!replies.length) fail(`${lesson.id}: after ${move.board}/${move.cell}, the opponent has no reply`);
      if (finish.goal === "game" && replies.length !== 1)
        fail(`${lesson.id}: after ${move.board}/${move.cell}, the opponent should have exactly one reply`);
      for (const reply of replies) {
        const next = play(after, reply);
        const reached = finish.goal === "game" ? winsGame : winsBoard;
        if (!legalMoves(next).some((m) => reached(next, m)))
          fail(`${lesson.id}: after ${move.board}/${move.cell} and ${reply.board}/${reply.cell}, the goal is out of reach`);
      }
    }
}
console.log(failures ? `${failures} problem(s)` : "every lesson checks out");
process.exit(failures ? 1 : 0);
