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

// --- Monte Carlo Tree Search, with a solver ---
// Plain UCT on random games, plus MCTS-Solver: a position whose result is certain
// (the game is over, or every move is known to win or lose) is marked proven, and the
// proof climbs the tree. Proven results are exact: "X wins in 5" like a chess engine's
// mate in N, and the search stops once the position itself is solved.

type Rng = () => number;

/** A seeded random generator (mulberry32): the same seed, the same search */
export const seededRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** What is proven about a node, for the player who made its move */
const UNKNOWN = 0;
const WIN = 1;
const LOSS = 2;
const PROVEN_DRAW = 3;
type Proof = typeof UNKNOWN | typeof WIN | typeof LOSS | typeof PROVEN_DRAW;

class Node {
  visits = 0;
  /** Score for the player who made the move into this node (win 1, draw 0.5) */
  score = 0;
  children: Node[] = [];
  untried: number[];
  proof: Proof = UNKNOWN;
  /** Once proven: moves to the end of the game with best play, this node's move
   * included (the winner hurries, the loser holds out) */
  depth = 0;
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

/** Moves searched from a position: a move that wins the game is the only one worth
 * trying (as in the random games), so a move allowing it is known to lose at once */
const movesOf = (s: EngineState, buffer: Uint8Array) => {
  // A game already decided has no moves
  if (result(s) !== ONGOING) return [];
  const n = legalMoves(s, buffer);
  const win = winningMove(s, buffer, n);
  return win >= 0 ? [win] : Array.from(buffer.subarray(0, n));
};

/** The opponent could win the game right after this move */
const givesWin = (s: EngineState, move: number, scratch: EngineState, buffer: Uint8Array) => {
  copyInto(s, scratch);
  play(scratch, move);
  if (result(scratch) !== ONGOING) return false;
  return winningMove(scratch, buffer, legalMoves(scratch, buffer)) >= 0;
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

/** The winner (or DRAW) a proven node stands for */
const provenWinner = (node: Node) =>
  node.proof === PROVEN_DRAW ? DRAW : node.proof === WIN ? node.mover : 1 - node.mover;

/** A child of `node` changed: what can now be proven about `node`, and above it.
 * Its children were played by the player to move at `node`. */
const settle = (node: Node | null) => {
  for (; node && node.proof === UNKNOWN; node = node.parent) {
    let won = Infinity;
    let open = node.untried.length > 0;
    let drawn = false;
    let longest = 0;
    for (const child of node.children) {
      if (child.proof === WIN) won = Math.min(won, child.depth);
      else if (child.proof === UNKNOWN) open = true;
      else {
        if (child.proof === PROVEN_DRAW) drawn = true;
        longest = Math.max(longest, child.depth);
      }
    }
    // One winning move: the player to move wins, the mover of `node` loses
    if (won !== Infinity) {
      node.proof = LOSS;
      node.depth = won + 1;
    } else if (open) return;
    else {
      // Every move proven: all lose (the mover of `node` wins), or the best draws
      node.proof = drawn ? PROVEN_DRAW : WIN;
      node.depth = longest + 1;
    }
  }
};

/** The child to play from a searched node: a proven win (the quickest), else the most
 * visited move not proven lost, else (everything loses) the longest defence */
const bestChild = (node: Node): Node | null => {
  let best: Node | null = null;
  for (const child of node.children) {
    if (!best) best = child;
    else if (child.proof === WIN) {
      if (best.proof !== WIN || child.depth < best.depth) best = child;
    } else if (best.proof === WIN) continue;
    else if (child.proof === LOSS) {
      if (best.proof === LOSS && child.depth > best.depth) best = child;
    } else if (best.proof === LOSS || child.visits > best.visits) best = child;
  }
  return best;
};

/** Expected score of a child for its mover: exact once proven */
const valueOf = (child: Node) =>
  child.proof === WIN ? 1 : child.proof === LOSS ? 0 : child.proof === PROVEN_DRAW ? 0.5 : child.visits ? child.score / child.visits : 0.5;

export type SearchLimits = {
  /** Playouts to run (at least) */
  iterations?: number;
  /** Time to think, in milliseconds */
  timeMs?: number;
  /** Exploration constant of UCT. In games between versions, 0.5 beat 1.0 (67 %)
   * at 6,000 random games per move and played even at 60,000 (docs/ai-training.md) */
  exploration?: number;
  rng?: Rng;
  /** For analysis: every legal move is searched at the root, even one that hands over
   * a win at once (analysis wants to know how bad it is, play only needs to avoid it),
   * and a position with a single move is searched too (for its evaluation) */
  analysis?: boolean;
};

/** What the search found about one move of the root */
export type MoveInfo = {
  move: number;
  visits: number;
  /** Expected score for the player to move (win 1, draw 0.5) */
  value: number;
  /** Proven result for the player to move, with the moves left to the end */
  proven: { result: "win" | "loss" | "draw"; plies: number } | null;
};

export type SearchResult = {
  move: number;
  iterations: number;
  ms: number;
  /** Expected score of the move chosen, for the player to move */
  winRate: number;
  /** The root's moves, best first */
  moves: MoveInfo[];
  /** The line the search expects, the chosen move first */
  pv: number[];
  /** The position is solved: its result with best play, for the player to move */
  proven: MoveInfo["proven"];
};

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

const proofOf = (child: Node): MoveInfo["proven"] =>
  child.proof === UNKNOWN
    ? null
    : { result: child.proof === WIN ? "win" : child.proof === LOSS ? "loss" : "draw", plies: child.depth };

/** Best move for the player to move, by UCT search with a solver */
export const search = (root: EngineState, limits: SearchLimits): SearchResult => {
  const started = now();
  const rng = limits.rng ?? Math.random;
  const exploration = limits.exploration ?? 0.5;
  const buffer = new Uint8Array(81);
  const state = copyState(root);
  let rootMoves = movesOf(root, buffer);
  if (!rootMoves.length) throw new Error("No move: the game is over");
  // Never hand over a win in one move when another move avoids it, even in a lost
  // position: the player should have to find the longer win
  if (!limits.analysis) {
    const safe = rootMoves.filter((m) => !givesWin(root, m, state, buffer));
    if (safe.length) rootMoves = safe;
  }

  // A single move that wins the game, or (in play) a single move: nothing to search
  if (rootMoves.length === 1) {
    copyInto(root, state);
    play(state, rootMoves[0]);
    const wins = result(state) === root.turn;
    if (wins || !limits.analysis) {
      const proven = wins ? ({ result: "win", plies: 1 } as const) : null;
      const info = { move: rootMoves[0], visits: 0, value: wins ? 1 : 0.5, proven };
      return { move: rootMoves[0], iterations: 0, ms: now() - started, winRate: info.value, moves: [info], pv: [rootMoves[0]], proven };
    }
  }

  const tree = new Node(-1, null, (1 - root.turn) as Player, rootMoves);
  const maxIterations = limits.iterations ?? Infinity;
  const deadline = limits.timeMs !== undefined ? started + limits.timeMs : Infinity;
  let iterations = 0;

  // A solved root needs no more search
  while (
    tree.proof === UNKNOWN &&
    iterations < maxIterations &&
    (iterations & 63 || now() < deadline)
  ) {
    copyInto(root, state);
    let node = tree;
    // Selection: best UCT child while the node is fully expanded and not proven. A
    // move proven to lose is never chosen (the node would be proven if all were).
    while (node.proof === UNKNOWN && !node.untried.length && node.children.length) {
      const logN = Math.log(node.visits);
      let best: Node | null = null;
      let bestValue = -Infinity;
      for (const child of node.children) {
        if (child.proof === LOSS) continue;
        const value = valueOf(child) + exploration * Math.sqrt(logN / (child.visits || 1));
        if (value > bestValue) {
          bestValue = value;
          best = child;
        }
      }
      node = best!;
      play(state, node.move);
    }
    let winner: number;
    if (node.proof !== UNKNOWN) winner = provenWinner(node);
    else {
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
        const over = result(state);
        if (over !== ONGOING) {
          // The game ends with this move: a certain result, which may prove the nodes
          // above (depth: the moves to the end, this one included)
          child.proof = over === DRAW ? PROVEN_DRAW : WIN;
          child.depth = 1;
          settle(node);
        }
        node = child;
      }
      // Simulation (a proven node's result is known)
      winner = node.proof !== UNKNOWN ? provenWinner(node) : playout(state, buffer, rng);
    }
    // Backpropagation
    for (let n: Node | null = node; n; n = n.parent) {
      n.visits++;
      n.score += winner === DRAW ? 0.5 : winner === n.mover ? 1 : 0;
    }
    iterations++;
  }

  const ms = now() - started;
  const best = bestChild(tree)!;
  // The expected line: the best child at each step, while the search went there
  const pv: number[] = [];
  for (let n: Node | null = best; n && pv.length < 12; n = bestChild(n)) {
    if (n.proof === UNKNOWN && n.visits < 20 && pv.length) break;
    pv.push(n.move);
  }
  const moves = tree.children
    .map((child) => ({ move: child.move, visits: child.visits, value: valueOf(child), proven: proofOf(child) }))
    .sort((a, b) => (a.move === best.move ? -1 : b.move === best.move ? 1 : b.visits - a.visits));
  const proven = tree.proof === UNKNOWN ? null : proofOf(best);
  return { move: best.move, iterations, ms, winRate: valueOf(best), moves, pv, proven };
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
