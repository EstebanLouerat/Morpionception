// AI for ultimate tic-tac-toe: Monte Carlo Tree Search on a compact copy of the game.
// Pure functions and typed arrays only, so it runs in a Web Worker (see ai.worker.ts)
// and in Node for tests.
import type { GameState } from "../game/rules";

// --- Compact state ---
// Each small board is two 9-bit masks (cells of X, cells of O), bit i = cell i,
// read row by row. Boards won by each side and closed boards (won or full) are 9-bit
// masks too. A move is board * 9 + cell.

const FULL = 0x1ff;
const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
].map(([a, b, c]) => (1 << a) | (1 << b) | (1 << c));

/** WINS[mask] = 1 when the mask holds three in a row */
const WINS = new Uint8Array(512);
for (let mask = 0; mask < 512; mask++) {
  WINS[mask] = LINES.some((line) => (mask & line) === line) ? 1 : 0;
}

export const X = 0;
export const O = 1;
type Player = typeof X | typeof O;
/** Result of a finished game: the winner, or DRAW */
export const DRAW = 2;
const ONGOING = -1;

export type EngineState = {
  cells: [Uint16Array, Uint16Array];
  /** Small boards won, per player */
  won: [number, number];
  /** Small boards won or full */
  closed: number;
  turn: Player;
  /** Board to play in, -1 for any open board */
  forced: number;
};

export const copyState = (s: EngineState): EngineState => ({
  cells: [s.cells[0].slice(), s.cells[1].slice()],
  won: [s.won[0], s.won[1]],
  closed: s.closed,
  turn: s.turn,
  forced: s.forced,
});

const copyInto = (from: EngineState, to: EngineState) => {
  to.cells[0].set(from.cells[0]);
  to.cells[1].set(from.cells[1]);
  to.won[0] = from.won[0];
  to.won[1] = from.won[1];
  to.closed = from.closed;
  to.turn = from.turn;
  to.forced = from.forced;
};

/** The game as the engine sees it */
export const fromGameState = (game: GameState): EngineState => {
  const state: EngineState = {
    cells: [new Uint16Array(9), new Uint16Array(9)],
    won: [0, 0],
    closed: 0,
    turn: game.currentPlayer === "X" ? X : O,
    forced: -1,
  };
  game.superBoard.forEach((board, b) => {
    board.flat().forEach((cell, c) => {
      if (cell) state.cells[cell === "X" ? X : O][b] |= 1 << c;
    });
    if (game.winners[b]) state.won[game.winners[b] === "X" ? X : O] |= 1 << b;
    if (game.winners[b] || (state.cells[X][b] | state.cells[O][b]) === FULL) state.closed |= 1 << b;
  });
  // Same rule as the game: a forced board that is closed means free choice
  if (game.activeBoard !== null && !((state.closed >> game.activeBoard) & 1))
    state.forced = game.activeBoard;
  return state;
};

/** Winner (X or O), DRAW, or ONGOING */
export const result = (s: EngineState) => {
  if (WINS[s.won[X]]) return X;
  if (WINS[s.won[O]]) return O;
  return s.closed === FULL ? DRAW : ONGOING;
};

/** Writes the legal moves into `out`, returns how many there are */
export const legalMoves = (s: EngineState, out: Uint8Array) => {
  let n = 0;
  const add = (b: number) => {
    let empty = ~(s.cells[X][b] | s.cells[O][b]) & FULL;
    while (empty) {
      const bit = empty & -empty;
      out[n++] = b * 9 + 31 - Math.clz32(bit);
      empty ^= bit;
    }
  };
  if (s.forced >= 0) add(s.forced);
  else for (let b = 0; b < 9; b++) if (!((s.closed >> b) & 1)) add(b);
  return n;
};

export const play = (s: EngineState, move: number) => {
  const b = (move / 9) | 0;
  const c = move - b * 9;
  const mine = (s.cells[s.turn][b] |= 1 << c);
  if (WINS[mine]) {
    s.won[s.turn] |= 1 << b;
    s.closed |= 1 << b;
  } else if ((mine | s.cells[1 - s.turn][b]) === FULL) {
    s.closed |= 1 << b;
  }
  // The cell played picks the next board, free choice if it is closed
  s.forced = (s.closed >> c) & 1 ? -1 : c;
  s.turn = (1 - s.turn) as Player;
};

/** A move that ends the game with a win for the player to move, or -1 */
const winningMove = (s: EngineState, moves: Uint8Array, n: number) => {
  const me = s.turn;
  for (let i = 0; i < n; i++) {
    const b = (moves[i] / 9) | 0;
    const c = moves[i] - b * 9;
    // Wins the small board, and that board completes a line of boards
    if (WINS[s.cells[me][b] | (1 << c)] && WINS[s.won[me] | (1 << b)]) return moves[i];
  }
  return -1;
};

// --- Monte Carlo Tree Search ---

type Rng = () => number;

class Node {
  visits = 0;
  /** Score for the player who made the move into this node (win 1, draw 0.5) */
  score = 0;
  children: Node[] = [];
  untried: number[];
  constructor(
    public move: number,
    public parent: Node | null,
    /** Who played `move` */
    public mover: Player,
    moves: number[]
  ) {
    this.untried = moves;
  }
}

const movesOf = (s: EngineState, buffer: Uint8Array) => {
  // A game already decided has no moves
  if (result(s) !== ONGOING) return [];
  return Array.from(buffer.subarray(0, legalMoves(s, buffer)));
};

/** Plays random moves to the end of the game, taking a winning move when there is one */
const playout = (s: EngineState, buffer: Uint8Array, rng: Rng) => {
  for (;;) {
    const r = result(s);
    if (r !== ONGOING) return r;
    const n = legalMoves(s, buffer);
    const win = winningMove(s, buffer, n);
    play(s, win >= 0 ? win : buffer[(rng() * n) | 0]);
  }
};

export type SearchLimits = {
  /** Playouts to run (at least) */
  iterations?: number;
  /** Time to think, in milliseconds */
  timeMs?: number;
  /** Exploration constant of UCT */
  exploration?: number;
  rng?: Rng;
};

export type SearchResult = { move: number; iterations: number; ms: number; winRate: number };

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Best move for the player to move, by UCT search */
export const search = (root: EngineState, limits: SearchLimits): SearchResult => {
  const started = now();
  const rng = limits.rng ?? Math.random;
  const exploration = limits.exploration ?? 1.0;
  const buffer = new Uint8Array(81);
  const rootMoves = movesOf(root, buffer);
  if (!rootMoves.length) throw new Error("No move: the game is over");

  // Obvious cases need no search
  const n = legalMoves(root, buffer);
  const win = winningMove(root, buffer, n);
  if (win >= 0 || rootMoves.length === 1)
    return { move: win >= 0 ? win : rootMoves[0], iterations: 0, ms: now() - started, winRate: 1 };

  const tree = new Node(-1, null, (1 - root.turn) as Player, rootMoves);
  const state = copyState(root);
  const maxIterations = limits.iterations ?? Infinity;
  const deadline = limits.timeMs !== undefined ? started + limits.timeMs : Infinity;
  let iterations = 0;

  while (iterations < maxIterations && (iterations & 63 || now() < deadline)) {
    copyInto(root, state);
    let node = tree;
    // Selection: best UCT child while the node is fully expanded
    while (!node.untried.length && node.children.length) {
      const logN = Math.log(node.visits);
      let best = node.children[0];
      let bestValue = -Infinity;
      for (const child of node.children) {
        const value = child.score / child.visits + exploration * Math.sqrt(logN / child.visits);
        if (value > bestValue) {
          bestValue = value;
          best = child;
        }
      }
      node = best;
      play(state, node.move);
    }
    // Expansion: one untried move
    if (node.untried.length) {
      const i = (rng() * node.untried.length) | 0;
      const move = node.untried[i];
      node.untried[i] = node.untried[node.untried.length - 1];
      node.untried.pop();
      const mover = state.turn;
      play(state, move);
      const child = new Node(move, node, mover, movesOf(state, buffer));
      node.children.push(child);
      node = child;
    }
    // Simulation and backpropagation
    const winner = playout(state, buffer, rng);
    for (let n: Node | null = node; n; n = n.parent) {
      n.visits++;
      n.score += winner === DRAW ? 0.5 : winner === n.mover ? 1 : 0;
    }
    iterations++;
  }

  // The most visited move is the most reliable one
  let best = tree.children[0];
  for (const child of tree.children) if (child.visits > best.visits) best = child;
  return { move: best.move, iterations, ms: now() - started, winRate: best.score / best.visits };
};

// --- Levels ---

export type Level = "debutant" | "intermediaire" | "difficile" | "expert";

export type LevelSettings = SearchLimits & {
  /** Chance to play a random move instead of the searched one */
  blunder?: number;
};

/** How each level plays (checked against each other in the strength tests) */
export const LEVEL_SETTINGS: Record<Level, LevelSettings> = {
  debutant: { iterations: 60, blunder: 0.35 },
  intermediaire: { iterations: 600, blunder: 0.08 },
  difficile: { iterations: 6000 },
  expert: { timeMs: 2000, iterations: 1_000_000 },
};

export type AiMove = { board: number; cell: number; iterations: number; ms: number };

/** The move of the AI at this level for this game */
export const chooseMove = (game: GameState, level: Level, rng: Rng = Math.random): AiMove => {
  const settings = LEVEL_SETTINGS[level];
  const state = fromGameState(game);
  const { iterations, ms, ...searched } = search(state, { ...settings, rng });
  let move = searched.move;
  if (settings.blunder && rng() < settings.blunder) {
    const buffer = new Uint8Array(81);
    const n = legalMoves(state, buffer);
    // Even a beginner sees a move that wins the game
    if (winningMove(state, buffer, n) < 0) move = buffer[(rng() * n) | 0];
  }
  return { board: (move / 9) | 0, cell: move % 9, iterations, ms };
};
