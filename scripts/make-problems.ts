// Builds the problems (app/problems/problems.json) from games the engine plays against
// itself, with mistakes on purpose (some random moves) so that positions with a tactic
// come up. Each position is scanned quickly, then candidates are checked in depth:
//
//   win:  the player to move has a forced win (proven by the solver). At each step a
//         single move keeps it (the last step: any move that wins the game), and the
//         opponent answers with his longest defence. Level: the number of moves.
//   best: no forced win, but the engine's top move (or two) is clearly better than
//         every other one (15 points of chances or more). Level: how much search a
//         weak engine needs to find it.
//
// Every legal move of every step is evaluated (its chances, the opponent's best answer)
// so the game can explain any move at once.
//
//   npm run problems:make -- scan <seed> <games> <out.json>   (one per core, in parallel)
//   npm run problems:make -- long <seed> <games> <out.json>   (forced wins of 3+ moves)
//   npm run problems:make -- merge <out.json> <scan.json>...
import { readFileSync, writeFileSync } from "node:fs";
import { fromGameState, legalMoves as engineMoves, search, seededRng } from "../app/ai/engine";
import { applyMove, getBoardOutcome, type GameState, type Move, type Side } from "../app/game/rules";
import { encodeMoves, positionsOf } from "../app/analysis/notation";
import { evaluate } from "../app/analysis/review";
import { legalMoves, winsGame } from "../app/learn/positions";
import { keyOf, moveOf, type OptionInfo, type Problem, type ProblemLevel, type ProblemStep } from "../app/problems/types";

const toMove = (m: number): Move => ({ board: Math.floor(m / 9), cell: m % 9 });
const play = (s: GameState, m: Move) => applyMove(s, m.board, m.cell);
const scoreOf = (side: Side, x: number) => (side === "X" ? x : 1 - x);
const round = (v: number) => Math.round(v * 1000) / 1000;

// Search budgets (random games)
const SCAN = 15_000;
const DEEP = 300_000;
const CHILD = 120_000;
const CHILD_BEST = 60_000;

/** Every legal move from `s`: its chances for the player to move, the best answer */
const optionsOf = (s: GameState, iterations: number, winner?: Side) => {
  const side = s.currentPlayer;
  const options: Record<string, OptionInfo> = {};
  for (const m of legalMoves(s)) {
    const after = play(s, m);
    const e = evaluate(after, iterations);
    options[keyOf(m)] = {
      v: round(scoreOf(side, e.x)),
      r: e.best ? keyOf(e.best) : null,
      ...(winner && { w: e.proven?.winner === winner }),
    };
  }
  return options;
};

/** A forced win from `start`, every step checked: null if it is not a good problem */
const winProblem = (start: GameState): ProblemStep[] | null => {
  const side = start.currentPlayer;
  const steps: ProblemStep[] = [];
  let s = start;
  for (let guard = 0; guard < 8; guard++) {
    const moves = legalMoves(s);
    const finishing = moves.filter((m) => winsGame(s, m));
    if (finishing.length) {
      // The last step: any move that wins the game (the others may still win, later)
      const options = optionsOf(s, CHILD_BEST, side);
      for (const m of finishing) options[keyOf(m)] = { v: 1, r: null, w: true };
      if (!steps.length) {
        // Won in one move: worth a problem only with moves to look through, and not
        // when nearly any move wins anyway
        const slower = Object.keys(options).filter((k) => options[k].w && !finishing.some((m) => keyOf(m) === k));
        if (moves.length < 4 || slower.length > 1) return null;
      }
      steps.push({ options, ok: finishing.map(keyOf), best: keyOf(finishing[0]), reply: null });
      return steps;
    }
    const root = evaluate(s, DEEP);
    if (root.proven?.winner !== side || !root.best) return null;
    const options = optionsOf(s, CHILD, side);
    const winning = Object.keys(options).filter((k) => options[k].w);
    // A single move keeps the win, and it is the one the solver found
    if (winning.length !== 1 || winning[0] !== keyOf(root.best)) return null;
    const best = moveOf(winning[0]);
    const theirs = play(s, best);
    // The opponent holds out as long as he can
    const defence = evaluate(theirs, DEEP);
    if (defence.proven?.winner !== side || !defence.best) return null;
    const reply = defence.best;
    steps.push({ options, ok: winning, best: winning[0], reply: keyOf(reply) });
    s = play(theirs, reply);
  }
  return null;
};

/** The engine's top move, clearly better than all others: null if not a good problem */
const bestProblem = (s: GameState): ProblemStep[] | null => {
  if (legalMoves(s).length < 3) return null;
  const options = optionsOf(s, CHILD_BEST);
  const sorted = Object.entries(options).sort((a, b) => b[1].v - a[1].v);
  const top = sorted[0][1].v;
  const ok = sorted.filter(([, o]) => o.v >= top - 0.03).map(([k]) => k);
  const next = sorted.find(([k]) => !ok.includes(k))?.[1].v ?? 0;
  if (ok.length > 2 || top - next < 0.15 || top < 0.35) return null;
  // A move that wins the game at once is a "win" problem, not this one
  if (ok.some((k) => winsGame(s, moveOf(k)))) return null;
  return [{ options, ok, best: sorted[0][0], reply: null }];
};

/** How much search a weak engine needs to find an accepted move */
const LADDER: [number, ProblemLevel][] = [
  [50, "facile"],
  [200, "moyen"],
  [800, "difficile"],
];
const levelOfBest = (s: GameState, ok: string[]): ProblemLevel => {
  for (const [iterations, level] of LADDER) {
    let found = 0;
    for (let seed = 1; seed <= 5; seed++) {
      const { move } = search(fromGameState(s), { iterations, rng: seededRng(seed * 7919 + iterations) });
      if (ok.includes(keyOf(toMove(move)))) found++;
    }
    if (found >= 3) return level;
  }
  return "expert";
};
const levelOfWin = (steps: number): ProblemLevel =>
  steps <= 1 ? "facile" : steps === 2 ? "moyen" : steps === 3 ? "difficile" : "expert";

/** A game of the engine against itself, with mistakes: some random moves, some weak
 * searches */
const selfPlay = (rng: () => number): Move[] => {
  let s = positionsOf([])[0];
  const moves: Move[] = [];
  const buffer = new Uint8Array(81);
  while (!getBoardOutcome(s)) {
    let m: Move;
    const state = fromGameState(s);
    if (moves.length < 3 || rng() < 0.15) {
      const n = engineMoves(state, buffer);
      m = toMove(buffer[Math.floor(rng() * n)]);
    } else {
      const iterations = [300, 1000, 3000][Math.floor(rng() * 3)];
      m = toMove(search(state, { iterations, rng }).move);
    }
    moves.push(m);
    s = play(s, m);
  }
  return moves;
};

type Found = Omit<Problem, "id">;

/** long: only forced wins of 3 moves or more (rarer: a single winning move at each
 * step), several per game */
const scan = (seed: number, games: number, out: string, long = false) => {
  const rng = seededRng(seed);
  const found: Found[] = [];
  const started = Date.now();
  for (let g = 0; g < games; g++) {
    const moves = selfPlay(rng);
    const positions = positionsOf(moves);
    // Forced wins of each length found in this game (one each: they look alike)
    const lengths = new Set<number>();
    let bests = 0;
    // From the end: the most decisive positions first
    for (let i = positions.length - 2; i >= 6; i--) {
      const s = positions[i];
      if (getBoardOutcome(s)) continue;
      const quick = search(fromGameState(s), { iterations: SCAN, analysis: true, rng: seededRng(i) });
      const prefix = encodeMoves(moves.slice(0, i));
      if (quick.proven?.result === "win" && quick.proven.plies <= 7) {
        const length = (quick.proven.plies + 1) / 2;
        if (lengths.has(length) || (long && length < 3) || (!long && lengths.size)) continue;
        const steps = winProblem(s);
        if (steps) {
          lengths.add(steps.length);
          found.push({ kind: "win", level: levelOfWin(steps.length), moves: prefix, steps });
        }
      } else if (!long && !quick.proven && bests < 2) {
        const visited = quick.moves.filter((m) => m.visits >= 150);
        if (visited.length < 2 || visited[0].value - visited[1].value < 0.1) continue;
        const steps = bestProblem(s);
        if (steps) {
          bests++;
          found.push({ kind: "best", level: levelOfBest(s, steps[0].ok), moves: prefix, steps });
        }
      }
    }
    const count = (k: string) => found.filter((f) => f.kind === k).length;
    console.log(
      `seed ${seed} game ${g + 1}/${games}: ${count("win")} win, ${count("best")} best, ${Math.round((Date.now() - started) / 1000)} s`
    );
    writeFileSync(out, JSON.stringify(found));
  }
};

/** At most this many problems of each kind per level */
const PER_KIND = 15;

/** A stable order that mixes the games (a hash of the moves) */
const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** Keeps distinct positions, balanced per level and kind, in a stable order */
const merge = (out: string, inputs: string[]) => {
  const all: Found[] = inputs.flatMap((f) => JSON.parse(readFileSync(f, "utf8")));
  // A best-move problem is a single step: nothing is played after it
  for (const p of all) if (p.kind === "best") p.steps[0].reply = null;
  const seen = new Set<string>();
  const unique = all.filter((p) => !seen.has(p.moves) && seen.add(p.moves));
  const levels: ProblemLevel[] = ["facile", "moyen", "difficile", "expert"];
  const problems: Problem[] = [];
  for (const level of levels) {
    const here = unique.filter((p) => p.level === level);
    // Alternate the kinds, the games mixed within each kind
    const byKind = (k: string) =>
      here
        .filter((p) => p.kind === k)
        .sort((a, b) => hash(a.moves) - hash(b.moves))
        .slice(0, PER_KIND);
    const [w, b] = [byKind("win"), byKind("best")];
    for (let i = 0; i < Math.max(w.length, b.length); i++)
      for (const p of [w[i], b[i]]) if (p) problems.push({ id: `${level[0]}${String(problems.filter((q) => q.level === level).length + 1).padStart(2, "0")}`, ...p });
  }
  writeFileSync(out, JSON.stringify(problems));
  for (const level of levels) {
    const here = problems.filter((p) => p.level === level);
    console.log(`${level}: ${here.filter((p) => p.kind === "win").length} win, ${here.filter((p) => p.kind === "best").length} best`);
  }
};

const [mode, ...args] = process.argv.slice(2);
if (mode === "scan" || mode === "long") scan(Number(args[0]), Number(args[1]), args[2], mode === "long");
else if (mode === "merge") merge(args[0], args.slice(1));
else console.log("npm run problems:make -- scan|long <seed> <games> <out.json> | merge <out.json> <scan.json>...");
