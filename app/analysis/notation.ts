// Games as text, for links and records: light enough for the server (no engine)
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

