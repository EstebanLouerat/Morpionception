"use client";

import styles from "./Game.module.css";
import ui from "../ui/common.module.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { playFx } from "../audio/engine";
import { Button, ButtonLink } from "../ui/Button";
import Loader from "../ui/Loader";
import PageShell from "../ui/PageShell";
import GameScreen from "./GameScreen";
import { ONLINE_MODE } from "./modes";
import { applyMove, otherSide, type Clocks, type GameState } from "./rules";
import { getRoomToken, joinRoom, leaveRoom, sendAction } from "../online/client";
import { ERROR_MESSAGES, type RoomView } from "../online/protocol";
import { useRoom } from "../online/useRoom";
import { useAccount } from "../account/client";
import RankChange from "../ranked/RankChange";
import { useRankedSearch } from "../ranked/RankedSearch";
import rankedStyles from "../ranked/Ranked.module.css";

// A confirmation button goes back to normal after this delay
const CONFIRM_MS = 3000;

/** Game against a friend on another device, in the room with this code */
export default function OnlineGame({ code }: { code: string }) {
  const router = useRouter();
  const [hasSeat] = useState(() => !!getRoomToken(code));
  const room = useRoom(hasSeat ? code : null);
  const { view } = room;
  // Until the friend has joined, the invite page is where to wait
  const waiting = !!view && !view.players[otherSide(view.you)].joined;

  useEffect(() => {
    // No seat in this room: the invite page joins it first
    if (!hasSeat || waiting) router.replace(`/jouer/ami?code=${code}`);
  }, [hasSeat, waiting, code, router]);

  // Taking the seat again lets an account logged in since then play this room, if
  // the round has not started (OnlineBoard tries again when a new round starts)
  useEffect(() => {
    if (hasSeat) joinRoom(code);
  }, [hasSeat, code]);

  if (room.error) {
    return (
      <PageShell title="Avec un ami" backHref="/jouer">
        <div className={ui.card}>
          <p>{ERROR_MESSAGES[room.error]}</p>
          <ButtonLink href="/jouer/ami" icon="userPlus" fullWidth>
            Nouvelle partie avec un ami
          </ButtonLink>
        </div>
      </PageShell>
    );
  }
  if (!view || waiting) return <Loader fullscreen label="Connexion au salon…" />;
  return (
    <OnlineBoard
      code={code}
      view={view}
      receivedAt={room.receivedAt}
      connected={room.connected}
    />
  );
}

type OnlineBoardProps = {
  code: string;
  view: RoomView;
  receivedAt: number;
  connected: boolean;
};

const OnlineBoard = ({ code, view, receivedAt, connected }: OnlineBoardProps) => {
  const router = useRouter();
  const { start: startSearch } = useRankedSearch();
  const { you, outcome, players } = view;
  // A ranked game: one game, rated, no rematch (the next one is found by the search)
  const ranked = !!view.ranked;
  // Ended before both players moved (a no-show): cancelled, not rated
  const cancelled = !!outcome && !view.recorded && view.moves < 2;
  const friend = otherSide(you);
  const me = players[you];
  const them = players[friend];
  // Their pseudo when logged in. Sentences are worded so a name needs no elision
  // or agreement ("À Léa de jouer", "Léa est hors ligne").
  const friendName = them.profile?.pseudo ?? "Ton ami";
  const friendInSentence = them.profile?.pseudo ?? "ton ami";
  const account = useAccount();
  const loggedInAsGuest = account.status === "user" && !me.profile;

  // Logged in since joining: a new round lets the account play (the server only
  // takes it before the first move of a round)
  useEffect(() => {
    if (loggedInAsGuest && view.moves === 0) joinRoom(code);
  }, [loggedInAsGuest, view.round, view.moves, code]);

  // Our move is shown at once, until the server sends it back (or refuses it)
  const [pending, setPending] = useState<{ round: number; moves: number; state: GameState } | null>(
    null
  );
  const game =
    pending && pending.round === view.round && pending.moves === view.moves
      ? pending.state
      : view.game;
  const canPlay = !outcome && connected && game.currentPlayer === you;

  const play = (board: number, cell: number) => {
    setPending({ round: view.round, moves: view.moves, state: applyMove(view.game, board, cell) });
    sendAction(code, { type: "move", board, cell }).then((res) => {
      if (res.ok) return;
      setPending(null);
      playFx("invalid");
    });
  };

  // The server sends times (clocks, time offline) as of the view: they run from there
  const clockRunning = view.clockRunning && !outcome;
  const friendAway = them.offlineFor !== null && !them.left && !outcome;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!clockRunning && !friendAway) return;
    const interval = setInterval(() => setNow(Date.now()), clockRunning ? 250 : 1000);
    return () => clearInterval(interval);
  }, [clockRunning, friendAway]);
  const elapsed = Math.max(0, now - receivedAt);
  let clocks: Clocks | null = null;
  if (view.clockLimit > 0) {
    clocks = { ...view.clocks };
    if (clockRunning) {
      const side = view.game.currentPlayer;
      clocks[side] = Math.max(0, clocks[side] - elapsed);
    }
  }
  // Away long enough: the win can be claimed (or, in a ranked game nobody has started,
  // the game cancelled)
  const canClaim = friendAway && (them.offlineFor ?? 0) + elapsed >= view.claimAfter;
  const noShow = ranked && view.moves < 2;

  // Abandoning (or quitting during the game) asks for a second click
  const [confirming, setConfirming] = useState<"resign" | "leave" | null>(null);
  useEffect(() => {
    if (!confirming) return;
    const timeout = setTimeout(() => setConfirming(null), CONFIRM_MS);
    return () => clearTimeout(timeout);
  }, [confirming]);
  const gameOver = !!outcome;
  useEffect(() => setConfirming(null), [gameOver]);

  const resign = () => {
    setConfirming(null);
    sendAction(code, { type: "resign" });
  };
  const claim = () => sendAction(code, { type: "claim" });
  // The server hears it before the next page (which would bring a ranked player back
  // to a game still on)
  const quit = async () => {
    await leaveRoom(code);
    router.push(ranked ? "/jouer/classe" : "/jouer");
  };
  // Ranked: straight back to the search, which goes on in the background
  const playAgain = async () => {
    await leaveRoom(code);
    void startSearch();
    router.push("/jouer/classe");
  };
  const rematch = () => sendAction(code, { type: "rematch" });

  const mode = {
    ...ONLINE_MODE,
    name: ranked ? "Classé" : ONLINE_MODE.name,
    players: you === "X" ? { X: "Toi", O: friendName } : { X: friendName, O: "Toi" },
  };

  let endTitle = "Égalité !";
  if (ranked && cancelled) {
    endTitle = "Partie annulée";
  } else if (outcome?.winner) {
    const won = outcome.winner === you;
    if (outcome.reason === "timeout") {
      endTitle = won ? "Tu as gagné au temps !" : `${friendName} a gagné au temps !`;
    } else if (outcome.reason === "claim") {
      endTitle = won
        ? "Victoire par forfait !"
        : "Défaite par forfait : plus de 2 minutes hors ligne.";
    } else if (outcome.reason === "resign") {
      endTitle = !won
        ? "Tu as abandonné."
        : them.left
        ? `${friendName} a quitté la partie, tu as gagné !`
        : `${friendName} a abandonné, tu as gagné !`;
    } else {
      endTitle = won ? "Tu as gagné !" : `${friendName} a gagné !`;
    }
  }

  let notice: string | null = null;
  if (!connected) notice = "Connexion perdue, reconnexion…";
  else if (them.left) notice = `${friendName} a quitté la partie.`;
  else if (noShow && canClaim) notice = `${friendName} ne s'est pas présenté : tu peux annuler la partie.`;
  else if (noShow && friendAway) notice = `En attente de ${friendInSentence}…`;
  else if (canClaim) notice = `${friendName} est hors ligne depuis plus de 2 minutes.`;
  else if (friendAway) notice = `${friendName} est hors ligne, attends son retour…`;

  // Whether this game went into the stats, said once it is over
  const statsNote = loggedInAsGuest
    ? "Tu as rejoint ce salon en invité : partie non comptée."
    : !me.profile
    ? "Crée un compte pour garder tes statistiques."
    : view.recorded
    ? "Partie comptée dans tes statistiques."
    : "Partie non comptée dans tes statistiques.";

  // In the modal, the note above the buttons says who asked for it
  const rematchButton = (inModal: boolean) =>
    them.left ? null : me.rematch ? (
      <Button className={inModal ? undefined : styles.ctrlBtn} disabled>
        Revanche demandée
      </Button>
    ) : (
      <Button className={inModal ? undefined : styles.ctrlBtn} onClick={rematch}>
        {!them.rematch ? "Revanche" : inModal ? "Accepter" : "Accepter la revanche"}
      </Button>
    );

  return (
    <GameScreen
      mode={mode}
      state={game}
      outcome={outcome}
      clocks={clocks}
      you={you}
      canPlay={canPlay}
      onPlay={play}
      settingsHref={`/parametres?from=game&room=${code}`}
      playerStatus={
        them.left ? { [friend]: "A quitté" } : !them.online ? { [friend]: "Hors ligne" } : {}
      }
      announcement={
        outcome
          ? endTitle
          : game.currentPlayer === you
          ? "À toi de jouer"
          : `À ${friendInSentence} de jouer`
      }
      profiles={{ X: players.X.profile, O: players.O.profile }}
      ranks={view.ranked}
      notice={notice}
      controls={
        gameOver ? (
          <>
            {ranked ? (
              <Button className={styles.ctrlBtn} onClick={playAgain}>
                Rejouer
              </Button>
            ) : (
              rematchButton(false)
            )}
            <Button className={styles.ctrlBtn} variant="secondary" onClick={quit}>
              Quitter
            </Button>
          </>
        ) : (
          <>
            {canClaim && (
              <Button className={styles.ctrlBtn} onClick={claim}>
                {noShow ? "Annuler la partie" : "Réclamer la victoire"}
              </Button>
            )}
            <Button
              className={styles.ctrlBtn}
              variant={confirming === "resign" ? "primary" : "secondary"}
              onClick={() => (confirming === "resign" ? resign() : setConfirming("resign"))}
            >
              {confirming === "resign" ? "Confirmer l'abandon" : "Abandonner"}
            </Button>
            <Button
              className={styles.ctrlBtn}
              variant={confirming === "leave" ? "primary" : "secondary"}
              onClick={() => (confirming === "leave" ? quit() : setConfirming("leave"))}
            >
              {confirming !== "leave"
                ? "Quitter"
                : friendAway
                ? "Quitter (partie non comptée)"
                : "Quitter et abandonner"}
            </Button>
          </>
        )
      }
      endModal={
        <>
          <h2>
            <span className={outcome?.winner === you ? styles[you.toLowerCase()] : ""}>
              {endTitle}
            </span>
          </h2>
          {ranked ? (
            view.ratings?.[you] ? (
              <RankChange change={view.ratings[you]} />
            ) : cancelled || (outcome && !view.recorded) || view.unrated ? (
              <p className={styles.modalNote}>
                {cancelled
                  ? "Moins de 2 coups joués : pas de points gagnés ni perdus."
                  : view.unrated
                  ? "Partie non classée : pas de points gagnés ni perdus."
                  : "Partie non comptée : pas de points gagnés ni perdus."}
              </p>
            ) : (
              <p className={rankedStyles.waitingRating} role="status">
                Calcul du classement…
              </p>
            )
          ) : (
            <>
              <p className={styles.modalNote}>
                {them.left
                  ? `${friendName} a quitté le salon.`
                  : me.rematch
                  ? `En attente de ${friendInSentence}…`
                  : them.rematch
                  ? `${friendName} veut une revanche ! Les camps seront inversés.`
                  : "En cas de revanche, les camps sont inversés."}
              </p>
              <p className={styles.modalNote}>{statsNote}</p>
            </>
          )}
          <div className={styles.modalBtns}>
            {ranked ? <Button onClick={playAgain}>Rejouer</Button> : rematchButton(true)}
            <Button variant="secondary" onClick={quit}>
              Quitter
            </Button>
          </div>
        </>
      }
    />
  );
};
