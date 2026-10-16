// Games between two AI players, to compare levels or a new AI with the current one.
//   npm run ai:arena -- <playerA> <playerB> [games]
// A player is a level (debutant, intermediaire, difficile, expert), "random",
// "it:<playouts>" (search with that many random games per move) or "ms:<millis>".
// Sides alternate; the result is given for player A.
import { chooseMove, fromGameState, legalMoves, search, type Level } from "../app/ai/engine";
import { applyMove, getBoardOutcome, newGameState, type GameState } from "../app/game/rules";

type Player = (game: GameState) => { board: number; cell: number };

const LEVELS = ["debutant", "intermediaire", "difficile", "expert"];

const playerFrom = (spec: string): Player => {
  if (spec === "random")
    return (game) => {
      const moves = new Uint8Array(81);
      const move = moves[Math.floor(Math.random() * legalMoves(fromGameState(game), moves))];
      return { board: Math.floor(move / 9), cell: move % 9 };
    };
  const limit = /^(it|ms):(\d+)$/.exec(spec);
  if (limit)
    return (game) => {
      const value = Number(limit[2]);
      const { move } = search(fromGameState(game), limit[1] === "it" ? { iterations: value } : { timeMs: value });
      return { board: Math.floor(move / 9), cell: move % 9 };
    };
  if (LEVELS.includes(spec)) return (game) => chooseMove(game, spec as Level);
  throw new Error(`Unknown player "${spec}" (${LEVELS.join(", ")}, random, it:<n>, ms:<n>)`);
};

const [specA = "expert", specB = "difficile", gamesArg = "20"] = process.argv.slice(2);
const players = { A: playerFrom(specA), B: playerFrom(specB) };
const games = Number(gamesArg);
const score = { wins: 0, draws: 0, losses: 0 };
const started = Date.now();

for (let i = 0; i < games; i++) {
  const aPlaysX = i % 2 === 0;
  let game = newGameState();
  let outcome = getBoardOutcome(game);
  while (!outcome) {
    const aToPlay = (game.currentPlayer === "X") === aPlaysX;
    const { board, cell } = (aToPlay ? players.A : players.B)(game);
    game = applyMove(game, board, cell);
    outcome = getBoardOutcome(game);
  }
  if (!outcome.winner) score.draws++;
  else if ((outcome.winner === "X") === aPlaysX) score.wins++;
  else score.losses++;
  process.stdout.write(`\r${i + 1}/${games} games`);
}

const points = ((score.wins + score.draws / 2) / games) * 100;
console.log(
  `\n${specA} vs ${specB}: ${score.wins} wins, ${score.draws} draws, ${score.losses} losses ` +
    `(${points.toFixed(1)} % for ${specA}) in ${Math.round((Date.now() - started) / 1000)} s`
);
