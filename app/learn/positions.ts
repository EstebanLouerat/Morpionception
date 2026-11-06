// Positions and move analysis for the tutorial and the strategy book, built on the
// game's own rules (app/game/rules.ts), so a lesson can never contradict the game.
import {
  applyMove,
  checkWin,
  getBoardOutcome,
  getClosedBoards,
  getForcedBoard,
  isValidMove,
  type GameState,
  type Move,
  type Side,
} from "../game/rules";

/** A position written by hand: 9 small boards of 9 cells each ("X", "O", or "." for an
 * empty cell; spaces are ignored), whose turn it is, and the board to play in */
export const position = (boards: string[], turn: Side, active: number | null): GameState => {
  const superBoard = boards.map((raw) => {
    const cells = raw.replace(/\s/g, "");
    if (cells.length !== 9) throw new Error(`A board needs 9 cells: "${raw}"`);
    return [0, 1, 2].map((r) =>
      [0, 1, 2].map((c) => {
        const ch = cells[r * 3 + c];
        return ch === "X" || ch === "O" ? ch : null;
      })
    );
  });
  if (superBoard.length !== 9) throw new Error("A position needs 9 boards");
  return {
    superBoard,
    winners: superBoard.map((b) => checkWin(b)),
    currentPlayer: turn,
    activeBoard: active,
    lastMove: null,
  };
};

/** Every move the player to move may make (the open boards allowed, their empty cells) */
export const legalMoves = (state: GameState): Move[] => {
  if (getBoardOutcome(state)) return [];
  const closed = getClosedBoards(state);
  const forced = getForcedBoard(state, closed);
  const moves: Move[] = [];
  for (let board = 0; board < 9; board++) {
    if (closed[board] || (forced !== null && forced !== board)) continue;
    for (let cell = 0; cell < 9; cell++)
      if (!state.superBoard[board][Math.floor(cell / 3)][cell % 3]) moves.push({ board, cell });
  }
  return moves;
};

/** Why this move cannot be played (null when it can) */
export const invalidMoveText = (state: GameState, move: Move): string | null => {
  if (isValidMove(state, move.board, move.cell)) return null;
  const closed = getClosedBoards(state);
  const forced = getForcedBoard(state, closed);
  if (forced !== null && move.board !== forced) return `Pas ici : tu dois jouer dans ${boardName(forced)}, encadrée.`;
  if (closed[move.board]) return "Cette grille est fermée : choisis une grille ouverte.";
  return "Cette case est déjà prise.";
};

export const play = (state: GameState, move: Move) => applyMove(state, move.board, move.cell);

/** The move takes a small board */
export const winsBoard = (state: GameState, move: Move) =>
  !state.winners[move.board] && !!play(state, move).winners[move.board];

/** The move wins the game */
export const winsGame = (state: GameState, move: Move) => {
  const outcome = getBoardOutcome(play(state, move));
  return !!outcome?.winner && outcome.winner === state.currentPlayer;
};

/** After the move, a reply of the opponent that takes a small board (the first one) */
export const boardWinGiven = (state: GameState, move: Move): Move | null => {
  const after = play(state, move);
  if (getBoardOutcome(after)) return null;
  return legalMoves(after).find((reply) => winsBoard(after, reply)) ?? null;
};

/** After the move, the opponent may play in any open board */
export const givesFreeChoice = (state: GameState, move: Move) => {
  const after = play(state, move);
  return !getBoardOutcome(after) && getForcedBoard(after, getClosedBoards(after)) === null;
};

/** After the move, whatever the opponent answers, the player can win the game at once */
export const forcesWin = (state: GameState, move: Move) => {
  const after = play(state, move);
  if (getBoardOutcome(after)) return winsGame(state, move);
  const replies = legalMoves(after);
  return replies.length > 0 && replies.every((reply) => {
    const next = play(after, reply);
    return legalMoves(next).some((m) => winsGame(next, m));
  });
};

// --- Words for the lessons ---

const BOARD_NAMES = [
  "en haut à gauche",
  "en haut au milieu",
  "en haut à droite",
  "au milieu à gauche",
  "au centre",
  "au milieu à droite",
  "en bas à gauche",
  "en bas au milieu",
  "en bas à droite",
];

/** "la grille en haut à droite" */
export const boardName = (board: number) => `la grille ${BOARD_NAMES[board]}`;
/** "la case en haut à droite" */
export const cellName = (cell: number) => `la case ${BOARD_NAMES[cell]}`;
