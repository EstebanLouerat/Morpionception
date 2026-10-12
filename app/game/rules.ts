// Game rules, shared by the game screen and the online rooms server.

export type Side = "X" | "O";
export type Cell = Side | null;
export type Board = Cell[][];
export type SuperBoard = Board[];
/** Milliseconds left per player */
export type Clocks = { X: number; O: number };

export type GameState = {
  superBoard: SuperBoard;
  /** Winner of each small board */
  winners: Cell[];
  currentPlayer: Side;
  /** Board the current player must play in (null = free choice) */
  activeBoard: number | null;
};

/** claim: online, the other player stayed offline too long and the win was claimed */
export type OutcomeReason = "line" | "draw" | "timeout" | "resign" | "claim";
/** How a game ended, null while it goes on (winner is null for a draw) */
export type Outcome = { winner: Side | null; reason: OutcomeReason } | null;

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const otherSide = (side: Side): Side => (side === "X" ? "O" : "X");

export const emptySuperBoard = (): SuperBoard =>
  Array.from({ length: 9 }, () =>
    Array.from({ length: 3 }, () => Array<Cell>(3).fill(null))
  );

export const newGameState = (): GameState => ({
  superBoard: emptySuperBoard(),
  winners: Array(9).fill(null),
  currentPlayer: "X",
  activeBoard: null,
});

export const fullClocks = (limitSeconds: number): Clocks => ({
  X: limitSeconds * 1000,
  O: limitSeconds * 1000,
});

/** Side with three in a row on a 3×3 board, read row by row */
const lineWinner = (cells: Cell[]): Cell => {
  for (const [a, b, c] of LINES) {
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) return cells[a];
  }
  return null;
};

export const checkWin = (board: Board): Cell => lineWinner(board.flat());

export const isBoardFull = (board: Board) => board.every((row) => row.every(Boolean));

/** Side that claimed three boards in a row */
export const getGlobalWinner = (winners: Cell[]): Cell => lineWinner(winners);

/** A board is closed once won or full (a full board without winner is a tie) */
export const getClosedBoards = ({ superBoard, winners }: GameState) =>
  superBoard.map((board, i) => !!winners[i] || isBoardFull(board));

/** Ignore a forced board that can no longer be played (also fixes stuck saved games) */
export const getForcedBoard = (state: GameState, closedBoards = getClosedBoards(state)) =>
  state.activeBoard !== null && !closedBoards[state.activeBoard] ? state.activeBoard : null;

export const hasStarted = (superBoard: SuperBoard) =>
  superBoard.some((board) => board.some((row) => row.some(Boolean)));

export const countMoves = (superBoard: SuperBoard) =>
  superBoard.reduce(
    (n, board) => n + board.reduce((m, row) => m + row.filter(Boolean).length, 0),
    0
  );

/** Line win or draw once the move is played (time and resignation aside) */
export const getBoardOutcome = (state: GameState): Outcome => {
  const winner = getGlobalWinner(state.winners);
  if (winner) return { winner, reason: "line" };
  if (getClosedBoards(state).every(Boolean)) return { winner: null, reason: "draw" };
  return null;
};

const isIndex = (n: unknown): n is number =>
  typeof n === "number" && Number.isInteger(n) && n >= 0 && n < 9;

/** The current player may play this cell (does not check whether the game is over) */
export const isValidMove = (state: GameState, boardIdx: number, cellIdx: number) => {
  if (!isIndex(boardIdx) || !isIndex(cellIdx)) return false;
  const closedBoards = getClosedBoards(state);
  const forcedBoard = getForcedBoard(state, closedBoards);
  return (
    !closedBoards[boardIdx] &&
    (forcedBoard === null || forcedBoard === boardIdx) &&
    !state.superBoard[boardIdx][Math.floor(cellIdx / 3)][cellIdx % 3]
  );
};

/** State after the current player plays this cell (the move must be valid) */
export const applyMove = (state: GameState, boardIdx: number, cellIdx: number): GameState => {
  const superBoard = state.superBoard.map((board, i) =>
    i === boardIdx
      ? board.map((row, r) =>
          row.map((cell, c) => (r * 3 + c === cellIdx ? state.currentPlayer : cell))
        )
      : board
  );
  const winners = [...state.winners];
  winners[boardIdx] = checkWin(superBoard[boardIdx]);
  // The cell played picks the next board, free choice if that board is closed
  const nextBoard = cellIdx;
  const nextBoardClosed = !!winners[nextBoard] || isBoardFull(superBoard[nextBoard]);
  return {
    superBoard,
    winners,
    currentPlayer: otherSide(state.currentPlayer),
    activeBoard: nextBoardClosed ? null : nextBoard,
  };
};
