"use client";

import styles from "./Game.module.css";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, ButtonLink } from "../ui/Button";
import GameScreen from "./GameScreen";
import { getMode } from "./modes";
import { getClockSettings } from "./clock";
import { GAME_STORAGE_KEY } from "./savedGame";
import {
  applyMove,
  fullClocks,
  getBoardOutcome,
  hasStarted,
  newGameState,
  otherSide,
  type Clocks,
  type GameState,
  type Outcome,
} from "./rules";

type SavedGame = { game: GameState; clockLimit: number; clocks: Clocks };

const loadSavedGame = (): SavedGame | null => {
  const saved = localStorage.getItem(GAME_STORAGE_KEY);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved);
    const fresh = newGameState();
    const clockLimit = parsed.clockLimit ?? 0;
    return {
      game: {
        superBoard: parsed.superBoard ?? fresh.superBoard,
        winners: parsed.winners ?? fresh.winners,
        currentPlayer: parsed.currentPlayer ?? fresh.currentPlayer,
        activeBoard: parsed.activeBoard ?? fresh.activeBoard,
      },
      clockLimit,
      clocks: parsed.clocks ?? fullClocks(clockLimit),
    };
  } catch (e) {
    console.error("Échec du parsing localStorage", e);
    return null;
  }
};

/** Game on this device: both players share the screen */
export default function LocalGame() {
  const router = useRouter();
  const params = useSearchParams();
  // Mode from /game?mode=… (only playable modes, see modes.ts)
  const [mode] = useState(() => getMode(params.get("mode")));

  const [initial] = useState((): SavedGame => {
    const saved = loadSavedGame();
    if (saved) return saved;
    // Chrono of a new game: the option picked before the game, if the mode supports it
    const clockLimit = mode.clockOption ? getClockSettings().seconds : 0;
    return { game: newGameState(), clockLimit, clocks: fullClocks(clockLimit) };
  });
  const [game, setGame] = useState(initial.game);
  // Seconds per player for the whole game (0 = no chrono) and the time left in ms
  const [clockLimit] = useState(initial.clockLimit);
  const [clocks, setClocks] = useState(initial.clocks);

  const { currentPlayer } = game;
  // The player whose clock reaches 0 loses
  const boardOutcome = getBoardOutcome(game);
  const timedOut =
    !boardOutcome && clockLimit > 0 && clocks[currentPlayer] <= 0 ? currentPlayer : null;
  const outcome: Outcome =
    boardOutcome ?? (timedOut && { winner: otherSide(timedOut), reason: "timeout" });
  const gameOver = !!outcome;
  // The chrono starts after the first move
  const clockRunning = clockLimit > 0 && hasStarted(game.superBoard) && !gameOver;

  useEffect(() => {
    const gameState = { mode: mode.id, over: gameOver, ...game, clockLimit, clocks };
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(gameState));
  }, [mode.id, gameOver, game, clockLimit, clocks]);

  const resetGame = () => {
    setGame(newGameState());
    // Same chrono as the game that ends
    setClocks(fullClocks(clockLimit));
    localStorage.removeItem(GAME_STORAGE_KEY);
  };

  // Count down the clock of the player to move
  useEffect(() => {
    if (!clockRunning) return;
    let last = Date.now();
    const spend = () => {
      const now = Date.now();
      const elapsed = now - last;
      last = now;
      setClocks((c) => ({
        ...c,
        [currentPlayer]: Math.max(0, c[currentPlayer] - elapsed),
      }));
    };
    const interval = setInterval(spend, 250);
    return () => {
      clearInterval(interval);
      spend(); // charge the time since the last tick before switching player
    };
  }, [clockRunning, currentPlayer]);

  const winner = outcome?.winner;

  return (
    <GameScreen
      mode={mode}
      state={game}
      outcome={outcome}
      clocks={clockLimit > 0 ? clocks : null}
      canPlay={!gameOver}
      onPlay={(board, cell) => setGame(applyMove(game, board, cell))}
      settingsHref={`/parametres?from=game&mode=${mode.id}`}
      controls={
        <>
          <Button className={styles.ctrlBtn} onClick={resetGame}>
            Recommencer
          </Button>
          <ButtonLink className={styles.ctrlBtn} variant="secondary" href="/jouer">
            Quitter
          </ButtonLink>
        </>
      }
      endModal={
        <>
          {winner ? (
            <h2>
              <span className={styles[winner.toLowerCase()]}>{mode.players[winner]}</span> a
              gagné{timedOut ? " au temps" : ""} !
            </h2>
          ) : (
            <h2>Égalité !</h2>
          )}
          <div className={styles.modalBtns}>
            <Button onClick={resetGame}>Rejouer</Button>
            <Button
              variant="secondary"
              onClick={() => {
                resetGame();
                router.push("/jouer");
              }}
            >
              Quitter
            </Button>
          </div>
        </>
      }
    />
  );
}
