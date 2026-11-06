"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./Analyse.module.css";
import MiniBoard, { type CellMark } from "../learn/MiniBoard";
import { Button, IconButton } from "../ui/Button";
import Dialog from "../ui/Dialog";
import { playFx } from "../audio/engine";
import { applyMove, getBoardOutcome, isValidMove, type GameState, type Move, type Side } from "../game/rules";
import { useGameReview, useLiveEval } from "../analysis/useReview";
import {
  annotationOf,
  ERRORS,
  GRADES,
  moveName,
  same,
  scoreSheet,
  squareName,
  scoreOf,
  summarize,
  type Grade,
  type MoveReview,
  type PositionEval,
} from "../analysis/review";
import EvalGraph from "./EvalGraph";

type ReviewProps = {
  moves: Move[];
  /** The side played on this device, if known: its errors come first */
  you: Side | null;
  names: Record<Side, string>;
};

/** A game reviewed by the engine, move by move, with the board open to try other moves
 * (a variation, evaluated live) */
const Review = ({ moves, you, names }: ReviewProps) => {
  const { positions, evals, reviews, done, total } = useGameReview(moves);
  const n = moves.length;
  // Moves of the game shown, and moves tried from there (a variation)
  const [ply, setPly] = useState(n);
  const [variation, setVariation] = useState<Move[]>([]);
  const [showBest, setShowBest] = useState(false);
  const [sheet, setSheet] = useState(false);

  const base = positions[ply];
  const shown = useMemo(
    () => variation.reduce<GameState>((g, m) => applyMove(g, m.board, m.cell), base),
    [base, variation]
  );
  const exploring = variation.length > 0;
  const live = useLiveEval(exploring ? shown : null);
  const evaluation = exploring ? live : evals[ply];
  const review = !exploring && ply > 0 ? reviews[ply - 1] : null;

  const go = useCallback(
    (to: number) => {
      setVariation([]);
      setPly(Math.max(0, Math.min(n, to)));
    },
    [n]
  );
  const back = useCallback(() => {
    if (variation.length) setVariation((v) => v.slice(0, -1));
    else go(ply - 1);
  }, [variation.length, go, ply]);
  const forward = useCallback(() => {
    if (!variation.length) go(ply + 1);
  }, [variation.length, go, ply]);

  // The next error (only yours when the side played here is known)
  const errorAfter = (from: number) => {
    const isError = (r: MoveReview | null) => !!r && ERRORS.includes(r.grade) && (!you || r.side === you);
    const i = reviews.findIndex((r, k) => k + 1 > from && isError(r));
    return i < 0 ? null : i + 1;
  };
  // After the last one, back to the first
  const nextError = errorAfter(ply) ?? errorAfter(0);

  // Arrows to move through the game, Escape back to it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") back();
      else if (e.key === "ArrowRight") forward();
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(n);
      else if (e.key === "Escape") setVariation([]);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back, forward, go, n]);

  /** A move on the board: the game's next move goes on with the game, any other one
   * starts (or goes on with) a variation */
  const tap = ({ board, cell }: Move) => {
    if (getBoardOutcome(shown) || !isValidMove(shown, board, cell)) {
      playFx("invalid");
      return;
    }
    playFx(shown.currentPlayer === "X" ? "placeX" : "placeO");
    if (!exploring && ply < n && same(moves[ply], { board, cell })) setPly(ply + 1);
    else setVariation((v) => [...v, { board, cell }]);
  };

  /** The engine's move, played as a variation */
  const playBest = () => {
    if (!evaluation?.best) return;
    tap(evaluation.best);
  };

  // On the board: the move played, colored by its grade, and the engine's choice in its
  // place when it was an error (or its next move, on demand)
  const cells: CellMark[] = [];
  if (review) {
    const error = ERRORS.includes(review.grade);
    cells.push({ ...review.move, kind: error ? "bad" : "good" });
    const best = evals[ply - 1]?.best;
    if (error && best && !same(best, review.move)) cells.push({ ...best, kind: "ghost", side: review.side });
  }
  if (showBest && evaluation?.best && !(review && ERRORS.includes(review.grade)))
    cells.push({ ...evaluation.best, kind: "ghost" });

  const summaries = useMemo(
    () => ({ X: summarize(reviews.filter(Boolean) as MoveReview[], "X"), O: summarize(reviews.filter(Boolean) as MoveReview[], "O") }),
    [reviews]
  );
  const analysing = done < total;

  return (
    <div className={styles.review}>
      <div className={styles.boardSide}>
        <EvalBar evaluation={evaluation} game={shown} />
        <MiniBoard
          state={shown}
          onTap={tap}
          cells={cells}
          coords
          label={exploring ? "Variante" : `Position après ${ply} coup${ply > 1 ? "s" : ""}`}
        />
      </div>
      <div className={styles.panel}>
        <div className={styles.players}>
          {(["X", "O"] as Side[]).map((side) => (
            <PlayerCard
              key={side}
              side={side}
              name={names[side]}
              you={you === side}
              summary={done ? summaries[side] : null}
              complete={!analysing}
            />
          ))}
        </div>
        <MoveCard
          ply={ply}
          moves={moves}
          review={review}
          before={ply > 0 ? evals[ply - 1] : null}
          exploring={exploring}
          variation={variation}
          live={live}
          game={shown}
          onBack={() => setVariation([])}
        />
        {n > 0 && (
          <div className={styles.graphBox}>
            <EvalGraph evals={evals} reviews={reviews} ply={ply} onPick={go} />
            {analysing && (
              <div className={styles.progress} role="status" aria-live="polite">
                <span style={{ width: `${(done / total) * 100}%` }} />
                <small>
                  Analyse… {done}/{total}
                </small>
              </div>
            )}
          </div>
        )}
        <div className={styles.controls}>
          <IconButton icon="skipBack" label="Début de la partie" onClick={() => go(0)} disabled={ply === 0 && !exploring} />
          <IconButton icon="chevronLeft" label="Coup précédent" onClick={back} disabled={ply === 0 && !exploring} />
          <span className={styles.counter}>
            {exploring ? `+${variation.length}` : `${ply}/${n}`}
          </span>
          <IconButton icon="chevronRight" label="Coup suivant" onClick={forward} disabled={exploring || ply === n} />
          <IconButton icon="skipForward" label="Fin de la partie" onClick={() => go(n)} disabled={ply === n && !exploring} />
          {n > 0 && <IconButton icon="list" label="Feuille de partie" onClick={() => setSheet(true)} />}
        </div>
        <ScoreSheet
          open={sheet}
          onClose={() => setSheet(false)}
          moves={moves}
          reviews={reviews}
          ply={exploring ? -1 : ply}
          onPick={(to) => {
            go(to);
            setSheet(false);
          }}
        />
        <div className={styles.actions}>
          {n > 0 && (
            <Button size="sm" variant="secondary" icon="flag" onClick={() => nextError !== null && go(nextError)} disabled={nextError === null}>
              {you ? "Ton erreur suivante" : "Erreur suivante"}
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            icon="bulb"
            onClick={() => setShowBest((s) => !s)}
            aria-pressed={showBest}
            disabled={!!getBoardOutcome(shown)}
          >
            {showBest ? "Masquer le coup du moteur" : "Coup du moteur"}
          </Button>
          <Button size="sm" variant="secondary" icon="play" onClick={playBest} disabled={!evaluation?.best}>
            Jouer son coup
          </Button>
        </div>
      </div>
    </div>
  );
};

/** The number of a move as in chess: "12." for X's 12th move, "12…" for O's answer */
const numberOf = (ply: number) => `${Math.ceil(ply / 2)}${ply % 2 ? "." : "…"}`;

type ScoreSheetProps = {
  open: boolean;
  onClose: () => void;
  moves: Move[];
  reviews: (MoveReview | null)[];
  /** The move shown (-1: none, a variation) */
  ply: number;
  onPick: (ply: number) => void;
};

/** Every move of the game in chess notation, with its annotation; a tap goes there,
 * and the whole sheet can be copied ("1. e5 d6?! 2. …") */
const ScoreSheet = ({ open, onClose, moves, reviews, ply, onPick }: ScoreSheetProps) => {
  const [copied, setCopied] = useState(false);
  const pairs = Array.from({ length: Math.ceil(moves.length / 2) }, (_, i) => i);
  const text = scoreSheet(moves, reviews.map((r) => annotationOf(r?.grade) || null));
  const copy = () =>
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  const entry = (i: number) => {
    const r = reviews[i];
    return (
      <button
        type="button"
        className={`${styles.sheetMove} ${r && ERRORS.includes(r.grade) ? styles[r.grade] : ""} ${ply === i + 1 ? styles.sheetNow : ""}`}
        onClick={() => onPick(i + 1)}
        title={r ? GRADES[r.grade].label : undefined}
      >
        {squareName(moves[i])}
        {annotationOf(r?.grade)}
      </button>
    );
  };
  return (
    <Dialog open={open} title="Feuille de partie" onClose={onClose} wide>
      <p className={styles.sheetHelp}>
        Colonnes a à i de gauche à droite, rangées 1 à 9 de bas en haut : e5 est le centre du plateau.
      </p>
      <ol className={styles.sheet}>
        {pairs.map((p) => (
          <li key={p}>
            <span className={styles.sheetNumber}>{p + 1}.</span>
            {entry(2 * p)}
            {2 * p + 1 < moves.length && entry(2 * p + 1)}
          </li>
        ))}
      </ol>
      <Button size="sm" variant="secondary" icon="copy" onClick={copy}>
        {copied ? "Copiée !" : "Copier la feuille"}
      </Button>
    </Dialog>
  );
};

/** X's chances (X's share of the bar) or the forced result */
const EvalBar = ({ evaluation, game }: { evaluation: PositionEval | null | undefined; game: GameState }) => {
  const outcome = getBoardOutcome(game);
  const x = evaluation?.x ?? 0.5;
  const percent = Math.round(x * 100);
  const text = outcome
    ? outcome.winner
      ? `${outcome.winner} a gagné`
      : "Égalité"
    : !evaluation
      ? "Le moteur réfléchit…"
      : evaluation.proven
        ? evaluation.proven.winner
          ? `${evaluation.proven.winner} gagne de force, en ${Math.ceil(evaluation.proven.plies / 2)} coup${evaluation.proven.plies > 2 ? "s" : ""} au plus`
          : "Égalité forcée"
        : `X ${percent} % · O ${100 - percent} %`;
  return (
    <div className={styles.evalBar}>
      <div className={styles.bar} aria-hidden="true">
        <span className={styles.barX} style={{ width: `${x * 100}%` }} />
      </div>
      <span className={`${styles.evalText} ${!evaluation && !outcome ? styles.thinking : ""}`} role="status">
        {text}
      </span>
    </div>
  );
};

type PlayerCardProps = {
  side: Side;
  name: string;
  you: boolean;
  summary: ReturnType<typeof summarize> | null;
  complete: boolean;
};

/** A player's accuracy and errors */
const PlayerCard = ({ side, name, you, summary, complete }: PlayerCardProps) => (
  <div className={`${styles.player} ${you ? styles.you : ""}`}>
    <span className={styles.who}>
      <b className={styles[side.toLowerCase()]}>{side}</b> {name}
    </span>
    <span className={styles.accuracy} title="Précision : 100 % si chaque coup est celui du moteur">
      {summary ? `${Math.round(summary.accuracy)} %` : "–"}
      {summary && !complete && <small>…</small>}
    </span>
    <span className={styles.counts}>
      {(["blunder", "mistake", "inaccuracy"] as Grade[]).map((g) => (
        <span key={g} className={styles[g]} title={GRADES[g].label}>
          {GRADES[g].symbol} {summary?.counts[g] ?? 0}
        </span>
      ))}
    </span>
  </div>
);

type MoveCardProps = {
  ply: number;
  moves: Move[];
  review: MoveReview | null | undefined;
  before: PositionEval | null | undefined;
  exploring: boolean;
  variation: Move[];
  live: PositionEval | null;
  game: GameState;
  onBack: () => void;
};

/** What the engine says about the move shown, or the variation being tried */
const MoveCard = ({ ply, moves, review, before, exploring, variation, live, game, onBack }: MoveCardProps) => {
  if (exploring)
    return (
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <b>Variante</b>
          <span className={styles.notation}>
            {numberOf(ply + 1)} {variation.map(squareName).join(" ")}
          </span>
        </div>
        <p className={styles.cardText}>
          {getBoardOutcome(game) ? (
            "Partie terminée dans cette variante."
          ) : live?.best ? (
            <>
              Le moteur jouerait <b>{squareName(live.best)}</b> ({moveName(live.best)}).
            </>
          ) : (
            "Le moteur réfléchit…"
          )}
        </p>
        <Button size="sm" variant="secondary" icon="arrowLeft" onClick={onBack}>
          Retour à la partie
        </Button>
      </div>
    );
  if (ply === 0)
    return (
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <b>{moves.length ? "Début de la partie" : "Plateau libre"}</b>
        </div>
        <p className={styles.cardText}>
          {moves.length
            ? "Avance coup par coup, ou touche une case pour essayer un autre coup : le moteur l'évalue."
            : "Joue les coups que tu veux, pour les deux camps : le moteur évalue chaque position."}
        </p>
      </div>
    );
  const move = moves[ply - 1];
  const side: Side = ply % 2 === 1 ? "X" : "O";
  const grade = review ? GRADES[review.grade] : null;
  const best = before?.best;
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <b className={styles.notation}>
          {numberOf(ply)} <span className={styles[side.toLowerCase()]}>{squareName(move)}</span>
          {annotationOf(review?.grade)}
        </b>
        {review && grade ? (
          <span className={`${styles.grade} ${styles[review.grade]}`}>
            {grade.symbol} {grade.label}
          </span>
        ) : (
          <span className={styles.muted}>Analyse en cours…</span>
        )}
      </div>
      <p className={styles.cardText}>
        {side} joue {moveName(move)}.
        {review?.reason && <> {review.reason}</>}
        {review && best && !same(best, move) && review.grade !== "forced" && review.grade !== "best" && (
          <>
            {" "}
            <b>Meilleur : {squareName(best)}</b>, {moveName(best)}
            {before && review.loss >= 0.005 && ` (${Math.round(review.loss * 100)} pt${review.loss >= 0.015 ? "s" : ""} perdus)`}.
          </>
        )}
      </p>
      {review && before && <small className={styles.muted}>Chances de {side} : {Math.round(scoreOf(side, before) * 100)} % avant ce coup</small>}
    </div>
  );
};

export default Review;
