"use client";

import { ReactNode, useEffect, useState } from "react";
import confetti from "canvas-confetti";
import styles from "../Learn.module.css";
import PageShell from "../../ui/PageShell";
import { Button, ButtonLink } from "../../ui/Button";
import { playFx } from "../../audio/engine";
import { motionReduced } from "../../theme/appearance";
import MiniBoard, { type BoardMark, type CellMark } from "../../learn/MiniBoard";
import {
  boardName,
  cellName,
  legalMoves,
  play,
  position,
  winsBoard,
  winsGame,
} from "../../learn/positions";
import { markTutorialDone } from "../../learn/progress";
import { getClosedBoards, getForcedBoard, isValidMove, newGameState, type GameState, type Move } from "../../game/rules";

type Feedback = { kind: "success" | "error" | "info"; text: string } | null;

/** What a step shows and how it reacts. done: the player did what the step asks. */
type StepView = {
  title: string;
  text: ReactNode;
  state: GameState;
  boards?: Partial<Record<number, BoardMark>>;
  cells?: CellMark[];
  showForced?: boolean;
  onTap?: (move: Move) => void;
  feedback: Feedback;
  done: boolean;
};

// --- Positions of the later steps (the first ones start from the player's own moves) ---

const withLast = (state: GameState, lastMove: Move) => ({ ...state, lastMove });

// O just sent X to the top right board, where X has two in a row
const WIN_BOARD = withLast(
  position(
    ["... .X. ...", "... ... ...", "X.X O.. .O.", "... ... ...", ".O. ... ...", "..O ... ...", "... ... ...", "... ... ...", "X.. ... ..."],
    "X",
    2
  ),
  { board: 5, cell: 2 }
);

// O just sent X to the center board, which O has won: X may play anywhere open
const FREE = withLast(
  position(
    ["... .X. ...", "... ... ...", "X.. ... ...", "... ... ...", "OOO X.X ...", "... ... ...", "... .O. ...", "... ... ...", "... ... ..."],
    "X",
    4
  ),
  { board: 6, cell: 4 }
);

// X has the top left and center boards, and two in a row in the bottom right one
const WIN_GAME = withLast(
  position(
    ["XXX OO. ...", "... .O. ...", "... ... ...", "... ... ..O", "XO. .X. O.X", "... ... ...", "... ... ...", "... .O. ...", "XO. .X. ..."],
    "X",
    8
  ),
  { board: 3, cell: 8 }
);

const STEP_COUNT = 8;

/** One step of the tutorial, with its own board and state */
const useStep = (step: number, history: GameState[], setHistory: (h: GameState[]) => void): StepView => {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [done, setDone] = useState(false);
  const [state, setState] = useState<GameState>(() => {
    if (step === 4) return WIN_BOARD;
    if (step === 5) return FREE;
    if (step === 6) return WIN_GAME;
    // The first move starts from an empty board, even when coming back to it
    if (step <= 1) return newGameState();
    return history[history.length - 1] ?? newGameState();
  });

  // Step 2: O answers in the board the player sent it to
  useEffect(() => {
    if (step !== 2 || state.currentPlayer !== "O") return;
    const timer = setTimeout(() => {
      const replies = legalMoves(state).filter((m) => !winsBoard(state, m));
      const reply = replies[Math.floor(Math.random() * replies.length)];
      const next = play(state, reply);
      setState(next);
      setHistory([...history, next]);
      playFx("placeO");
      setDone(true);
    }, 1600);
    return () => clearTimeout(timer);
  }, [step, state, history, setHistory]);

  const forced = getForcedBoard(state, getClosedBoards(state));
  const tapForced = (move: Move, then: (next: GameState) => void) => {
    if (done) return;
    if (!isValidMove(state, move.board, move.cell)) {
      playFx("invalid");
      setFeedback({
        kind: "error",
        text:
          forced !== null && move.board !== forced
            ? `Pas ici : tu dois jouer dans ${boardName(forced)}, encadrée.`
            : "Cette case est déjà prise.",
      });
      return;
    }
    const next = play(state, move);
    playFx("placeX");
    setState(next);
    then(next);
  };

  switch (step) {
    case 0:
      return {
        title: "Un morpion de morpions",
        text: (
          <>
            Le plateau est fait de <b>9 petites grilles</b>, rangées comme les cases d&apos;un morpion.
            Gagne trois petites grilles alignées pour gagner la partie.
          </>
        ),
        state,
        boards: { 0: "send", 4: "send", 8: "send" },
        showForced: false,
        feedback: { kind: "info", text: "Trois grilles alignées, comme ici en diagonale : c'est gagné." },
        done: true,
      };
    case 1:
      return {
        title: "Ton premier coup",
        text: (
          <>
            Tu joues <b>X</b>. Pour le premier coup, tu peux jouer <b>n&apos;importe où</b> : touche une case.
          </>
        ),
        state,
        onTap: (move) =>
          tapForced(move, (next) => {
            setHistory([next]);
            setDone(true);
            setFeedback({ kind: "success", text: `Tu as joué ${cellName(move.cell)} de ta grille.` });
          }),
        feedback,
        done,
      };
    case 2: {
      const last = history[0]?.lastMove;
      // Coming back to this step: O has already answered
      const answered = done || state.currentPlayer === "X";
      return {
        title: "Ta case choisit sa grille",
        text: (
          <>
            La <b>position</b> de ta case dans sa petite grille désigne la grille où ton adversaire
            doit jouer : {last ? <b>{boardName(last.cell)}</b> : "celle qui correspond"}.
          </>
        ),
        state,
        boards: last && !answered ? { [last.cell]: "send" } : {},
        showForced: answered,
        feedback: answered
          ? { kind: "info", text: "O a joué… et sa case t'envoie à ton tour dans une grille, encadrée." }
          : { kind: "info", text: "O réfléchit…" },
        done: answered,
      };
    }
    case 3:
      return {
        title: "Joue dans la grille encadrée",
        text: (
          <>
            Tu dois jouer dans la grille encadrée{forced !== null ? <> : <b>{boardName(forced)}</b></> : null}.
            Essaie ailleurs pour voir.
          </>
        ),
        state,
        onTap: (move) =>
          tapForced(move, () => {
            setDone(true);
            setFeedback({ kind: "success", text: "C'est ça ! Et ton coup envoie O dans une nouvelle grille." });
          }),
        feedback,
        done,
      };
    case 4:
      return {
        title: "Gagne une petite grille",
        text: (
          <>
            Aligne <b>trois X</b> dans une petite grille pour la gagner. Tu as déjà deux X en haut :
            complète la ligne.
          </>
        ),
        state,
        cells: done || !feedback ? [] : [{ board: 2, cell: 1, kind: "hint" }],
        onTap: (move) => {
          if (done) return;
          if (isValidMove(state, move.board, move.cell) && !winsBoard(state, move)) {
            playFx("invalid");
            setFeedback({ kind: "error", text: "Presque : la case qui complète tes deux X clignote." });
            return;
          }
          tapForced(move, () => {
            playFx("boardWon");
            setDone(true);
            setFeedback({ kind: "success", text: "La grille est à toi : elle compte comme ta case dans le grand morpion." });
          });
        },
        feedback,
        done,
      };
    case 5:
      return {
        title: "Grille fermée : choix libre",
        text: (
          <>
            O t&apos;envoie dans la grille centrale, mais elle est <b>déjà gagnée</b>. Dans ce cas, tu
            peux jouer dans <b>n&apos;importe quelle grille ouverte</b> (en pointillés).
          </>
        ),
        state,
        onTap: (move) =>
          tapForced(move, () => {
            setDone(true);
            setFeedback({
              kind: "success",
              text: "Voilà ! Retiens-le : envoyer l'adversaire dans une grille fermée lui laisse ce choix.",
            });
          }),
        feedback,
        done,
      };
    case 6:
      return {
        title: "Gagne la partie",
        text: (
          <>
            Tu as la grille en haut à gauche et celle du centre. Gagne celle <b>en bas à droite</b> :
            trois grilles en diagonale, c&apos;est la victoire.
          </>
        ),
        state,
        cells: done || !feedback ? [] : [{ board: 8, cell: 8, kind: "hint" }],
        onTap: (move) => {
          if (done) return;
          if (isValidMove(state, move.board, move.cell) && !winsGame(state, move)) {
            playFx("invalid");
            setFeedback({ kind: "error", text: "Pas encore : complète la diagonale de tes X dans cette grille." });
            return;
          }
          tapForced(move, () => {
            playFx("gameWin");
            if (!motionReduced()) confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, zIndex: 3000 });
            setDone(true);
            setFeedback({ kind: "success", text: "Trois grilles alignées : tu as gagné la partie !" });
          });
        },
        feedback,
        done,
      };
    default:
      return {
        title: "Tu connais les règles !",
        text: (
          <ul className={styles.bullets}>
            <li>
              Ta case <b>choisit la grille</b> de ton adversaire.
            </li>
            <li>
              Une grille <b>fermée</b> donne le <b>choix libre</b>.
            </li>
            <li>
              Trois <b>grilles alignées</b> gagnent la partie.
            </li>
          </ul>
        ),
        state: WIN_GAME,
        showForced: false,
        feedback: { kind: "success", text: "Pour aller plus loin : le livre de stratégie, du débutant à l'avancé." },
        done: true,
      };
  }
};

/** The tutorial: opened by the player only (from the home page or the Jouer menu), the
 * rules learnt by playing, one step at a time */
export default function Tutoriel() {
  const [step, setStep] = useState(0);
  // The player's own moves of the first steps
  const [history, setHistory] = useState<GameState[]>([]);
  // The step's task is done: the next step may open
  const [ready, setReady] = useState(true);
  const last = step === STEP_COUNT - 1;
  const go = (to: number) => {
    setReady(false);
    setStep(to);
  };

  useEffect(() => {
    if (last) markTutorialDone();
  }, [last]);

  return (
    <PageShell title="Tutoriel" backHref="/apprendre" wide>
      {/* Each step starts afresh */}
      <Step key={step} step={step} history={history} setHistory={setHistory} onReady={setReady} />
      <div className={styles.nav}>
        <Button variant="secondary" onClick={() => go(step - 1)} disabled={step === 0} icon="chevronLeft">
          Retour
        </Button>
        {last ? (
          <ButtonLink href="/apprendre/strategie" icon="book">
            Le livre de stratégie
          </ButtonLink>
        ) : (
          <Button onClick={() => go(step + 1)} disabled={!ready} icon="chevronRight">
            Suivant
          </Button>
        )}
      </div>
    </PageShell>
  );
}

const Step = ({
  step,
  history,
  setHistory,
  onReady,
}: {
  step: number;
  history: GameState[];
  setHistory: (h: GameState[]) => void;
  onReady: (ready: boolean) => void;
}) => {
  const view = useStep(step, history, setHistory);
  useEffect(() => onReady(view.done), [view.done, onReady]);
  return (
    <div className={styles.stage}>
      <div className={styles.words}>
        <div className={styles.dots} aria-label={`Étape ${step + 1} sur ${STEP_COUNT}`}>
          {Array.from({ length: STEP_COUNT }, (_, i) => (
            <span key={i} className={i < step ? styles.done : i === step ? styles.now : ""} />
          ))}
        </div>
        <h2 className={styles.title}>{view.title}</h2>
        <div className={styles.text}>{view.text}</div>
        <p
          className={`${styles.feedback} ${view.feedback ? styles[view.feedback.kind] : ""}`}
          role="status"
          aria-live="polite"
        >
          {view.feedback?.text ?? ""}
        </p>
      </div>
      <MiniBoard
        state={view.state}
        onTap={view.onTap}
        showForced={view.showForced ?? true}
        boards={view.boards}
        cells={view.cells}
        label="Plateau du tutoriel"
      />
    </div>
  );
};
