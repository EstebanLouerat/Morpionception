// Replays games of OpenSpiel's ultimate tic-tac-toe (training/openspiel_games.py)
// through the game's rules: same legal moves at every turn, same winner.
//   npm run ai:check-openspiel -- openspiel-games.json
import { readFileSync } from "node:fs";
import { applyMove, getBoardOutcome, isValidMove, newGameState } from "../app/game/rules";

type OpenSpielGame = { moves: [number, number, number[]][]; winner: "X" | "O" | null };

const path = process.argv[2];
if (!path) throw new Error("usage: npm run ai:check-openspiel -- <games.json>");
const games: OpenSpielGame[] = JSON.parse(readFileSync(path, "utf8"));
const problems: string[] = [];

games.forEach((recorded, index) => {
  let game = newGameState();
  for (const [turn, [board, cell, legal]] of recorded.moves.entries()) {
    const ours: number[] = [];
    for (let b = 0; b < 9; b++)
      for (let c = 0; c < 9; c++) if (isValidMove(game, b, c)) ours.push(b * 9 + c);
    if (getBoardOutcome(game) || ours.join() !== legal.join()) {
      problems.push(`game ${index}, turn ${turn}: legal moves differ`);
      return;
    }
    game = applyMove(game, board, cell);
  }
  const outcome = getBoardOutcome(game);
  if (!outcome) problems.push(`game ${index}: over for OpenSpiel, not for the game`);
  else if (outcome.winner !== recorded.winner)
    problems.push(`game ${index}: winner ${outcome.winner} instead of ${recorded.winner}`);
});

console.log(`${games.length} games replayed, ${problems.length} differences`);
problems.slice(0, 10).forEach((p) => console.log(`  ${p}`));
process.exitCode = problems.length ? 1 : 0;
