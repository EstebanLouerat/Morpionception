"use client";

import { useEffect, useMemo, useState } from "react";
import learn from "../apprendre/Learn.module.css";
import widgets from "../learn/widgets/Widgets.module.css";
import styles from "./Problemes.module.css";
import MiniBoard, { type BoardMark, type CellMark } from "../learn/MiniBoard";
import { Button, ButtonLink } from "../ui/Button";
import { playFx } from "../audio/engine";
import { celebrate } from "../learn/widgets/celebrate";
import { getBoardOutcome, type GameState } from "../game/rules";
import { decodeMoves, positionsOf, squareName } from "../analysis/notation";
import { analysisHref } from "../analysis/recent";
import { invalidMoveText, play } from "../learn/positions";
import { keyOf, moveOf, type Problem } from "../problems/types";
import { levelLabel } from "../problems/data";
import { describe, describeReply, hintOf, othersText, repliesText } from "../problems/explain";
import { recordProblem } from "../problems/progress";

type Phase = "play" | "wrong" | "reply" | "solved";
type Message = { kind: "success" | "error" | "info"; text: string };

const percent = (v: number) => `${Math.round(v * 100)} %`;

/** A problem being solved: every move answered at once from what the engine found in
 * advance, with why it works or fails; a forced win goes on, move after move, against
 * the opponent's best defence */
const ProblemView = ({ problem, onNext }: { problem: Problem; onNext: (() => void) | null }) => {
  const start = useMemo(() => positionsOf(decodeMoves(problem.moves)).at(-1)!, [problem.moves]);
  const side = start.currentPlayer;
  const [state, setState] = useState<GameState>(start);
  // The step played, and the position at its start (a retry goes back there)
  const [step, setStep] = useState(0);
  const [stepStart, setStepStart] = useState<GameState>(start);
  const [phase, setPhase] = useState<Phase>("play");
  const [message, setMessage] = useState<Message | null>(null);
  // The opponent's answer to come: from which position, what is said, and for a forced
  // win that goes on, the step it opens
  const [pending, setPending] = useState<{
    from: GameState;
    reply: string;
    text: (from: GameState) => Message;
    nextStep?: number;
  } | null>(null);
  const [helped, setHelped] = useState(false);
  const [hint, setHint] = useState(false);
  const [solution, setSolution] = useState(false);
  const [boards, setBoards] = useState<Partial<Record<number, BoardMark>>>({});

  const current = problem.steps[step];
  const total = problem.steps.length;
  const top = Math.max(...Object.values(problem.steps[0].options).map((o) => o.v));
  const goal =
    problem.kind === "win"
      ? `${side} joue et gagne${total > 1 ? ` en ${total} coups` : " en un coup"}.`
      : top < 0.45
        ? `${side} joue : trouve le seul coup qui tient.`
        : `${side} joue : trouve le meilleur coup.`;

  // The opponent's answer, a moment after the move it answers
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => {
      const after = play(pending.from, moveOf(pending.reply));
      setState(after);
      setMessage(pending.text(pending.from));
      playFx(side === "X" ? "placeO" : "placeX");
      if (pending.nextStep !== undefined) {
        setStep(pending.nextStep);
        setStepStart(after);
        setPhase("play");
      }
      setPending(null);
    }, 900);
    return () => clearTimeout(timer);
  }, [pending, side]);

  const finish = (clean: boolean) => {
    setPhase("solved");
    recordProblem(problem.id, solution ? "failed" : clean ? "clean" : "helped");
    if (!solution) celebrate();
  };

  const tap = ({ board, cell }: { board: number; cell: number }) => {
    if (phase !== "play" || pending) return;
    const invalid = invalidMoveText(state, { board, cell });
    if (invalid) {
      playFx("invalid");
      setMessage({ kind: "error", text: invalid });
      return;
    }
    const move = { board, cell };
    const key = keyOf(move);
    const option = current.options[key];
    const after = play(state, move);
    setState(after);
    playFx(side === "X" ? "placeX" : "placeO");
    setHint(false);
    setBoards({});

    if (current.ok.includes(key)) {
      const why = describe(state, move, "good");
      if (step === total - 1 || getBoardOutcome(after)) {
        const rest = Object.entries(current.options).filter(([k]) => !current.ok.includes(k));
        const runnerUp = rest.length ? Math.max(...rest.map(([, o]) => o.v)) : null;
        const others = othersText(state, rest.map(([k]) => moveOf(k)));
        setMessage({
          kind: "success",
          text:
            problem.kind === "win"
              ? `Gagné ! ${why ?? ""}`
              : `Bien vu ! ${why ?? `${squareName(move)} est le coup du moteur.`} ${others ?? ""} Ce coup te donne ${percent(option.v)} de chances${
                  runnerUp !== null ? `, le meilleur des autres ${percent(runnerUp)}` : ""
                }.`,
        });
        setBoards({ [board]: "good" });
        finish(!helped);
        return;
      }
      // A forced win goes on: the opponent's longest defence, then the next move
      setPhase("reply");
      setMessage({ kind: "success", text: `Bien vu ! ${why ?? ""} ${repliesText(state, move)}` });
      const reply = current.reply!;
      setPending({
        from: after,
        reply,
        text: (from) => ({
          kind: "info",
          text: `${describeReply(from, moveOf(reply))} C'était sa meilleure défense : à toi, continue !`,
        }),
        nextStep: step + 1,
      });
      return;
    }

    // Not the answer
    setPhase("wrong");
    if (problem.kind === "win" && option.w && step === total - 1) {
      // Still a win, the long way: no mistake, but there is quicker
      setMessage({ kind: "info", text: "Ce coup gagne aussi, mais plus lentement : il y a une victoire immédiate. Réessaie !" });
      return;
    }
    setHelped(true);
    playFx("invalid");
    const bad = describe(state, move, "bad");
    const verdict =
      problem.kind === "win"
        ? `Tu n'as plus de victoire forcée (tes chances : ${percent(option.v)}).`
        : `Ce coup ne te donne que ${percent(option.v)} de chances, contre ${percent(top)} pour le meilleur.`;
    if (!option.r) {
      setMessage({ kind: "error", text: `${bad ?? ""} ${verdict}`.trim() });
      return;
    }
    const refutation = option.r;
    setMessage({ kind: "error", text: `${bad ?? `${squareName(move)} ne suffit pas.`} Regarde la réponse…` });
    setPending({
      from: after,
      reply: refutation,
      text: (from) => ({ kind: "error", text: `${bad ? `${bad} ` : ""}${describeReply(from, moveOf(refutation))} ${verdict}` }),
    });
    setBoards({ [moveOf(refutation).board]: "danger" });
  };

  const retry = () => {
    setState(stepStart);
    setPhase("play");
    setMessage(null);
    setBoards({});
    setPending(null);
  };

  const restart = () => {
    setState(start);
    setStepStart(start);
    setStep(0);
    setPhase("play");
    setMessage(null);
    setBoards({});
    setPending(null);
    setHint(false);
    // A solution seen stays seen: the first try is recorded as such
  };

  const showHint = () => {
    setHint(true);
    setHelped(true);
    setMessage({ kind: "info", text: `Indice : ${hintOf(stepStart, moveOf(current.best))}` });
  };

  const showSolution = () => {
    retry();
    setSolution(true);
    setHelped(true);
    const best = moveOf(current.best);
    const why =
      problem.kind === "win" && !current.reply
        ? null
        : problem.kind === "win"
          ? repliesText(stepStart, best)
          : othersText(stepStart, Object.keys(current.options).filter((k) => !current.ok.includes(k)).map(moveOf));
    setMessage({
      kind: "info",
      text: `Solution : ${describe(stepStart, best, "good") ?? `${squareName(best)}.`} ${why ?? ""} Joue-le pour continuer.`,
    });
  };

  const cells: CellMark[] = [];
  if (phase === "play" && solution) cells.push({ ...moveOf(current.best), kind: "hint" });
  const marks: Partial<Record<number, BoardMark>> =
    phase === "play" && hint ? { [moveOf(current.best).board]: "send" } : boards;

  return (
    <div className={learn.stage}>
      <div className={learn.words}>
        <span className={learn.kicker}>
          {levelLabel(problem.level)} · {problem.kind === "win" ? "Victoire forcée" : "Meilleur coup"}
        </span>
        <h2 className={learn.title}>{goal}</h2>
        {problem.kind === "win" && total > 1 && (
          <p className={learn.text}>
            Coup {Math.min(step + 1, total)} sur {total} : l&apos;adversaire se défend au mieux.
          </p>
        )}
        <p
          className={`${widgets.caption} ${message ? widgets[message.kind] : ""} ${styles.message}`}
          role="status"
          aria-live="polite"
        >
          {message?.text ?? "À toi de jouer. La dernière case jouée est encadrée."}
        </p>
        <div className={styles.actions}>
          {phase === "solved" ? (
            <>
              {onNext && (
                <Button size="sm" icon="chevronRight" onClick={onNext}>
                  Problème suivant
                </Button>
              )}
              <Button size="sm" variant="secondary" icon="refresh" onClick={restart}>
                Rejouer
              </Button>
              <ButtonLink size="sm" variant="secondary" icon="analysis" href={analysisHref(problem.moves)}>
                Analyser
              </ButtonLink>
            </>
          ) : phase === "wrong" ? (
            <>
              <Button size="sm" icon="refresh" onClick={retry} disabled={!!pending}>
                Réessayer
              </Button>
              <Button size="sm" variant="secondary" icon="eye" onClick={showSolution} disabled={!!pending}>
                Solution
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" icon="bulb" onClick={showHint} disabled={hint || phase !== "play"}>
                Indice
              </Button>
              <Button size="sm" variant="secondary" icon="eye" onClick={showSolution} disabled={phase !== "play"}>
                Solution
              </Button>
            </>
          )}
        </div>
      </div>
      <MiniBoard state={state} onTap={tap} boards={marks} cells={cells} coords label="Problème" />
    </div>
  );
};

export default ProblemView;
