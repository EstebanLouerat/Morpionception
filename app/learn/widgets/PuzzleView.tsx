"use client";

import { useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import styles from "./Widgets.module.css";
import MiniBoard, { type BoardMark, type CellMark } from "../MiniBoard";
import { Button } from "../../ui/Button";
import { playFx } from "../../audio/engine";
import { motionReduced } from "../../theme/appearance";
import type { Puzzle, Verdict } from "../book";
import { invalidMoveText, legalMoves, play, winsGame } from "../positions";
import { markSolved } from "../progress";
import type { GameState, Move } from "../../game/rules";

type Phase = "play" | "wrong" | "finish" | "won";

/** A position to solve: a wrong move is answered by the reply that punishes it, a right
 * one is celebrated (or, in two moves, followed by the forced reply and the finish) */
const PuzzleView = ({ id, puzzle }: { id: string; puzzle: Puzzle }) => {
  const [state, setState] = useState<GameState>(puzzle.state);
  const [phase, setPhase] = useState<Phase>("play");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [boards, setBoards] = useState<Partial<Record<number, BoardMark>>>({});
  const [showSolution, setShowSolution] = useState(false);
  // The right first moves, shown on demand
  const right = useMemo(
    () => legalMoves(puzzle.state).filter((m) => puzzle.judge(puzzle.state, m).ok),
    [puzzle]
  );

  const reset = () => {
    setState(puzzle.state);
    setPhase("play");
    setVerdict(null);
    setMessage(null);
    setBoards({});
  };

  // After a wrong move: the reply that shows why, a moment later
  useEffect(() => {
    if (phase !== "wrong" || !verdict?.punish) return;
    const punish = verdict.punish;
    const timer = setTimeout(() => {
      setState((s) => play(s, punish));
      setBoards({ [punish.board]: "danger" });
      playFx("placeO");
    }, 900);
    return () => clearTimeout(timer);
  }, [phase, verdict]);

  // After the right first move of a two-move puzzle: the opponent's forced reply
  useEffect(() => {
    if (phase !== "finish" || state.currentPlayer === puzzle.state.currentPlayer) return;
    const timer = setTimeout(() => {
      const reply = legalMoves(state)[0];
      setState((s) => play(s, reply));
      playFx("placeO");
      setMessage({ kind: "info", text: puzzle.finish!.reply });
    }, 1000);
    return () => clearTimeout(timer);
  }, [phase, state, puzzle.state.currentPlayer, puzzle.finish]);

  const solved = () => {
    markSolved(id);
    playFx("gameWin");
    if (!motionReduced()) confetti({ particleCount: 90, spread: 70, origin: { y: 0.65 }, zIndex: 3000 });
  };

  const tap = (move: Move) => {
    if (phase === "wrong" || phase === "won") return;
    // The opponent's reply is coming: the board waits for it
    if (state.currentPlayer !== puzzle.state.currentPlayer) return;
    const invalid = invalidMoveText(state, move);
    if (invalid) {
      playFx("invalid");
      setMessage({ kind: "error", text: invalid });
      return;
    }
    const next = play(state, move);
    setState(next);
    playFx("placeX");
    if (phase === "finish") {
      if (winsGame(state, move)) {
        setPhase("won");
        setMessage({ kind: "success", text: puzzle.finish!.won });
        solved();
      } else {
        setPhase("wrong");
        setVerdict(null);
        setMessage({ kind: "error", text: puzzle.finish!.miss });
      }
      return;
    }
    const v = puzzle.judge(puzzle.state, move);
    setVerdict(v);
    setMessage({ kind: v.ok ? "success" : "error", text: v.text });
    if (!v.ok) {
      setPhase("wrong");
      playFx("invalid");
    } else if (puzzle.finish) {
      setPhase("finish");
    } else {
      setPhase("won");
      setBoards({ [move.cell]: "good" });
      solved();
    }
  };

  const cells: CellMark[] = showSolution && phase === "play" ? right.map((m) => ({ ...m, kind: "hint" })) : [];

  return (
    <div className={styles.widget}>
      <p className={styles.prompt}>{puzzle.prompt}</p>
      <MiniBoard state={state} onTap={tap} boards={boards} cells={cells} label="Énigme" />
      <p
        className={`${styles.caption} ${message ? styles[message.kind] : ""}`}
        role="status"
        aria-live="polite"
      >
        {message?.text ?? (showSolution ? puzzle.solution : "À toi de jouer.")}
      </p>
      <div className={styles.actions}>
        {phase === "wrong" || phase === "won" ? (
          <Button size="sm" variant="secondary" icon="refresh" onClick={reset}>
            {phase === "won" ? "Rejouer l'énigme" : "Réessayer"}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" icon="bulb" onClick={() => setShowSolution(true)} disabled={showSolution}>
            Solution
          </Button>
        )}
      </div>
    </div>
  );
};

export default PuzzleView;
