"use client";

import styles from "./Game.module.css";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "../ui/Button";
import GameScreen from "./GameScreen";
import { getMode } from "./modes";
import { getSideSettings } from "./side";
import { GAME_STORAGE_KEY } from "./savedGame";
import {
  applyMove,
  getBoardOutcome,
  isValidMove,
  newGameState,
  otherSide,
  type GameState,
  type Side,
} from "./rules";
import type { Level } from "../ai/engine";
import { createAiPlayer, type AiPlayer } from "../ai/client";
import { addAiResult, getAiSettings, isLevel, levelLabel } from "../ai/settings";

// The AI answers no faster than this, so its move can be followed
const MIN_THINK_MS = 500;

type AiGameSave = {
  game: GameState;
  you: Side;
  level: Level;
  /** Positions before each of your moves, for "Annuler" */
  history: GameState[];
  /** The result went into the record (once per game, even after "Annuler") */
  counted: boolean;
};

const pickSide = (): Side => {
  const { side } = getSideSettings();
  return side === "random" ? (Math.random() < 0.5 ? "X" : "O") : side;
};

const newGameSave = (level: Level = getAiSettings().level): AiGameSave => ({
  game: newGameState(),
  you: pickSide(),
  level,
  history: [],
  counted: false,
});

const loadSave = (): AiGameSave | null => {
  try {
    const saved = JSON.parse(localStorage.getItem(GAME_STORAGE_KEY) ?? "null");
    if (saved?.mode !== "ai" || !Array.isArray(saved.superBoard)) return null;
    const fresh = newGameState();
    return {
      game: {
        superBoard: saved.superBoard,
        winners: saved.winners ?? fresh.winners,
        currentPlayer: saved.currentPlayer === "O" ? "O" : "X",
        activeBoard: saved.activeBoard ?? null,
      },
      you: saved.you === "O" ? "O" : "X",
      level: isLevel(saved.level) ? saved.level : getAiSettings().level,
      history: Array.isArray(saved.history) ? saved.history : [],
      counted: !!saved.counted,
    };
  } catch {
    return null;
  }
};

/** Game against the AI, which thinks in a Web Worker */
export default function AiGame() {
  const router = useRouter();
  const [save, setSave] = useState(() => loadSave() ?? newGameSave());
  const { game, you, level, history, counted } = save;
  const ai = otherSide(you);
  const outcome = getBoardOutcome(game);
  const result = outcome ? (outcome.winner ?? "draw") : null;
  const aiTurn = !outcome && game.currentPlayer === ai;

  // Saved like the local games (board fields at the top, see savedGame.ts)
  useEffect(() => {
    const { game: board, ...rest } = save;
    localStorage.setItem(
      GAME_STORAGE_KEY,
      JSON.stringify({ mode: "ai", over: !!result, ...board, ...rest })
    );
  }, [save, result]);

  const aiPlayer = useRef<AiPlayer | null>(null);
  useEffect(() => {
    const player = createAiPlayer();
    aiPlayer.current = player;
    return () => {
      player.dispose();
      aiPlayer.current = null;
    };
  }, []);

  // The AI plays when it is its turn; a newer position (undo, new game) cancels it
  useEffect(() => {
    if (!aiTurn || !aiPlayer.current) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    aiPlayer.current.think(game, level).then(({ board, cell }) => {
      if (cancelled) return;
      timer = setTimeout(() => {
        setSave((s) =>
          s.game === game && isValidMove(game, board, cell)
            ? { ...s, game: applyMove(game, board, cell) }
            : s
        );
      }, Math.max(0, MIN_THINK_MS - (Date.now() - started)));
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [aiTurn, game, level]);

  // Count the result once, for the record shown before a game
  useEffect(() => {
    if (!result || counted) return;
    addAiResult(level, result === "draw" ? "draws" : result === you ? "wins" : "losses");
    setSave((s) => ({ ...s, counted: true }));
  }, [result, counted, level, you]);

  const play = (board: number, cell: number) =>
    setSave((s) => ({ ...s, game: applyMove(s.game, board, cell), history: [...s.history, s.game] }));
  // Back to before your last move (and the answer of the AI)
  const undo = () =>
    setSave((s) =>
      s.history.length
        ? { ...s, game: s.history[s.history.length - 1], history: s.history.slice(0, -1) }
        : s
    );
  const restart = () => setSave(newGameSave(level));

  const mode = {
    ...getMode("ai"),
    name: `IA ${levelLabel(level)}`,
    players:
      you === "X"
        ? { X: "Toi", O: `IA ${levelLabel(level)}` }
        : { X: `IA ${levelLabel(level)}`, O: "Toi" },
  };
  const endTitle = !outcome?.winner
    ? "Égalité !"
    : outcome.winner === you
    ? "Tu as gagné !"
    : "L'IA a gagné !";

  return (
    <GameScreen
      mode={mode}
      state={game}
      outcome={outcome}
      clocks={null}
      you={you}
      canPlay={!outcome && game.currentPlayer === you}
      onPlay={play}
      settingsHref="/parametres?from=game&mode=ai"
      playerStatus={aiTurn ? { [ai]: "Réfléchit…" } : {}}
      announcement={outcome ? endTitle : aiTurn ? "L'IA réfléchit" : "À toi de jouer"}
      controls={
        <>
          <Button className={styles.ctrlBtn} onClick={restart}>
            Recommencer
          </Button>
          <Button
            className={styles.ctrlBtn}
            variant="secondary"
            onClick={undo}
            disabled={!history.length}
            aria-label="Annuler le coup"
            title="Annuler ton dernier coup"
          >
            Annuler
          </Button>
          <ButtonLink className={styles.ctrlBtn} variant="secondary" href="/jouer">
            Quitter
          </ButtonLink>
        </>
      }
      endModal={
        <>
          <h2>
            <span className={outcome?.winner === you ? styles[you.toLowerCase()] : ""}>
              {endTitle}
            </span>
          </h2>
          <p className={styles.modalNote}>Niveau {levelLabel(level)}</p>
          <div className={styles.modalBtns}>
            <Button onClick={restart}>Rejouer</Button>
            <Button
              variant="secondary"
              onClick={() => {
                restart();
                router.push("/jouer");
              }}
            >
              Quitter
            </Button>
          </div>
          {outcome?.winner && outcome.winner !== you && history.length > 0 && (
            <Button variant="secondary" size="sm" className={styles.modalUndo} onClick={undo}>
              Annuler mon dernier coup
            </Button>
          )}
        </>
      }
    />
  );
}
