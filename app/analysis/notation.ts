// Games as text: compact for links and records (light enough for the server: no engine),
// and readable like a chess score sheet
import { applyMove, getBoardOutcome, isValidMove, newGameState, type GameState, type Move } from "../game/rules";

/** A game as a string: two digits per move, the board then the cell, 1 to 9 each
 * (read row by row), e.g. "5519" (center of the center, then top left of the bottom
 * right board). Short enough for a link. */
export const encodeMoves = (moves: Move[]) => moves.map((m) => `${m.board + 1}${m.cell + 1}`).join("");

/** The moves of an encoded game, up to the first one that is not legal */
export const decodeMoves = (text: string | null): Move[] => {
  const moves: Move[] = [];
  let game = newGameState();
  for (let i = 0; text && i + 1 < text.length; i += 2) {
    const board = Number(text[i]) - 1;
    const cell = Number(text[i + 1]) - 1;
    if (getBoardOutcome(game) || !isValidMove(game, board, cell)) break;
    moves.push({ board, cell });
    game = applyMove(game, board, cell);
  }
  return moves;
};

/** Every position of the game, the start included (positions[i] is before move i) */
export const positionsOf = (moves: Move[]) =>
  moves.reduce<GameState[]>((all, m) => [...all, applyMove(all[all.length - 1], m.board, m.cell)], [newGameState()]);


// --- Square names, as on a chess board ---
// The 81 cells are one 9 × 9 board: files a to i from left to right, ranks 1 to 9 from
// the bottom up. "e5" is the center of the center board, "i9" the top right cell of
// the top right board, "a1" the bottom left one of the bottom left board.

const FILES = "abcdefghi";

export const squareName = (m: Move) => {
  const file = (m.board % 3) * 3 + (m.cell % 3);
  const fromTop = Math.floor(m.board / 3) * 3 + Math.floor(m.cell / 3);
  return `${FILES[file]}${9 - fromTop}`;
};

/** Files and ranks along the board's edges, in the order they are drawn */
export const FILE_LABELS = FILES.split("");
export const RANK_LABELS = ["9", "8", "7", "6", "5", "4", "3", "2", "1"];

/** The game written like a chess score sheet, "1. e5 d6?! 2. f4 …", each move followed
 * by its annotation if any (?!, ?, ??), then the result when the board decided it */
export const scoreSheet = (moves: Move[], annotations: (string | null)[] = []) => {
  const parts: string[] = [];
  moves.forEach((m, i) => {
    if (i % 2 === 0) parts.push(`${i / 2 + 1}.`);
    parts.push(`${squareName(m)}${annotations[i] ?? ""}`);
  });
  const outcome = getBoardOutcome(positionsOf(moves)[moves.length]);
  if (outcome) parts.push(outcome.winner === "X" ? "1-0" : outcome.winner === "O" ? "0-1" : "½-½");
  return parts.join(" ");
};
