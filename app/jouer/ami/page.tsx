"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./Ami.module.css";
import ui from "../../ui/common.module.css";
import PageShell from "../../ui/PageShell";
import Icon from "../../ui/Icon";
import { Button } from "../../ui/Button";
import ClockPicker from "../../game/ClockPicker";
import SidePicker from "../../game/SidePicker";
import { CLOCK_CHOICES, getClockSettings } from "../../game/clock";
import { getSideSettings } from "../../game/side";
import { otherSide, type Side } from "../../game/rules";
import { playFx } from "../../audio/engine";
import QrCode from "../../online/QrCode";
import { createRoom, getRoomToken, joinRoom, leaveRoom } from "../../online/client";
import { CODE_LENGTH, ERROR_MESSAGES, cleanCode } from "../../online/protocol";
import { useRoom } from "../../online/useRoom";

const setUrlCode = (code: string | null) =>
  window.history.replaceState(null, "", code ? `/jouer/ami?code=${code}` : "/jouer/ami");

/** Copy text, also where the Clipboard API is missing (pages not served over HTTPS) */
const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    return copied;
  }
};

const clockLabel = (seconds: number) =>
  seconds ? CLOCK_CHOICES.find((c) => c.seconds === seconds)?.label ?? `${seconds / 60} min` : null;

// Invite links look like /jouer/ami?code=ABC123: the code is prefilled to join,
// or, for the player who created the room, the waiting room is shown again.
export default function JouerAmi() {
  const router = useRouter();
  const [urlCode] = useState(() =>
    cleanCode(new URLSearchParams(window.location.search).get("code") ?? "")
  );

  // Our seat in a room whose game has not started yet
  const [seat, setSeat] = useState<{ code: string; you: Side } | null>(null);
  // Getting our seat back after a refresh
  const [restoring, setRestoring] = useState(() => !!urlCode && !!getRoomToken(urlCode));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [code, setCode] = useState(urlCode);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const { view, error: roomError } = useRoom(seat?.code ?? null);
  const started = useRef(false);

  useEffect(() => {
    if (!restoring) return;
    joinRoom(urlCode).then((res) => {
      setRestoring(false);
      if (res.ok) setSeat({ code: urlCode, you: res.data.you });
      else setJoinError(ERROR_MESSAGES[res.error]);
    });
  }, [restoring, urlCode]);

  // Both players are in: the game starts
  const friendJoined = !!view && view.players[otherSide(view.you)].joined;
  useEffect(() => {
    if (!friendJoined || !seat) return;
    started.current = true;
    playFx("boardWon");
    router.push(`/game?room=${seat.code}`);
  }, [friendJoined, seat, router]);

  // The room expired or was closed while waiting
  useEffect(() => {
    if (!roomError) return;
    setSeat(null);
    setUrlCode(null);
    setCreateError(ERROR_MESSAGES[roomError]);
  }, [roomError]);

  // Leaving this page while waiting cancels the invitation (a refresh keeps it)
  const seatRef = useRef(seat);
  seatRef.current = seat;
  useEffect(
    () => () => {
      if (seatRef.current && !started.current) leaveRoom(seatRef.current.code);
    },
    []
  );

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const create = async () => {
    setCreating(true);
    setCreateError(null);
    const res = await createRoom(getSideSettings().side, getClockSettings().seconds);
    setCreating(false);
    if (!res.ok) {
      setCreateError(ERROR_MESSAGES[res.error]);
      return;
    }
    setSeat({ code: res.data.code, you: res.data.you });
    setUrlCode(res.data.code);
  };

  const cancel = () => {
    if (seat) leaveRoom(seat.code);
    setSeat(null);
    setUrlCode(null);
  };

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length < CODE_LENGTH) {
      setJoinError(`Le code du salon fait ${CODE_LENGTH} caractères.`);
      return;
    }
    setJoining(true);
    setJoinError(null);
    const res = await joinRoom(code);
    if (!res.ok) {
      setJoining(false);
      setJoinError(ERROR_MESSAGES[res.error]);
      return;
    }
    started.current = true;
    router.push(`/game?room=${code}`);
  };

  const inviteUrl = seat ? `${window.location.origin}/jouer/ami?code=${seat.code}` : "";
  const canShare = typeof navigator.share === "function";
  const share = () =>
    navigator
      .share({
        title: "Morpionception",
        text: `Viens jouer au Morpionception avec moi ! Code du salon : ${seat?.code}`,
        url: inviteUrl,
      })
      .catch(() => {
        // Share sheet closed
      });
  const copy = async (what: "link" | "code") => {
    if (seat && (await copyText(what === "link" ? inviteUrl : seat.code))) setCopied(what);
  };

  const hosting = !!seat || restoring;
  // Opened from an invite link: joining comes first
  const invited = !!urlCode && !hosting;
  const roomClock = view ? clockLabel(view.clockLimit) : null;

  const inviteSection = (
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>Inviter un ami</h2>
      <div className={ui.card}>
        <div className={styles.invite}>
          {seat ? (
            <QrCode
              className={styles.qrCode}
              value={inviteUrl}
              label={`QR code du salon ${seat.code}`}
            />
          ) : (
            <div className={styles.qr} aria-hidden="true">
              <Icon name="qr" size={56} />
              <span>QR code</span>
            </div>
          )}
          <div className={styles.roomInfo}>
            <span className={styles.label}>Code du salon</span>
            {seat ? (
              <span className={`${styles.roomCode} ${styles.ready}`}>{seat.code}</span>
            ) : (
              <span className={styles.roomCode} aria-label="Pas encore de salon">
                {"—".repeat(CODE_LENGTH)}
              </span>
            )}
            <span className={ui.muted}>
              {seat
                ? "Ton ami scanne le QR code, ouvre le lien ou entre ce code."
                : "Crée un salon pour obtenir un lien, un code et un QR code à partager."}
            </span>
          </div>
        </div>

        <div className={ui.row}>
          <Button
            variant="secondary"
            size="sm"
            icon="copy"
            disabled={!seat}
            onClick={() => copy("link")}
          >
            {copied === "link" ? "Lien copié !" : "Copier le lien"}
          </Button>
          {canShare ? (
            <Button variant="secondary" size="sm" icon="share" disabled={!seat} onClick={share}>
              Partager
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              icon="copy"
              disabled={!seat}
              onClick={() => copy("code")}
            >
              {copied === "code" ? "Code copié !" : "Copier le code"}
            </Button>
          )}
        </div>
        <SidePicker disabled={hosting} />
        <ClockPicker disabled={hosting} />

        {hosting ? (
          <>
            <div className={styles.waiting} role="status">
              <span className={styles.pulse} aria-hidden="true" />
              <span>
                <strong>{restoring || !view ? "Connexion au salon…" : "En attente de ton ami…"}</strong>
                {view && (
                  <small className={ui.muted}>
                    Tu joues{" "}
                    <span className={styles[view.you.toLowerCase()]}>{view.you}</span>
                    {view.you === "X" ? " et tu commences" : ", ton ami commence"}
                    {roomClock ? ` · Chrono ${roomClock}` : ""}
                  </small>
                )}
              </span>
            </div>
            <Button variant="secondary" fullWidth onClick={cancel} disabled={restoring}>
              Annuler le salon
            </Button>
          </>
        ) : (
          <Button icon="play" fullWidth onClick={create} disabled={creating}>
            {creating ? "Création du salon…" : "Créer un salon"}
          </Button>
        )}
        {createError && (
          <p className={styles.error} role="alert">
            {createError}
          </p>
        )}
      </div>
    </section>
  );

  const joinSection = !hosting && (
    <section className={ui.section}>
      <h2 className={ui.sectionTitle}>Rejoindre une partie</h2>
      <form className={ui.card} onSubmit={join}>
        <label className={styles.label} htmlFor="room-code">
          Code du salon
        </label>
        <input
          id="room-code"
          className={`${ui.input} ${styles.codeInput}`}
          value={code}
          onChange={(e) => {
            setCode(cleanCode(e.target.value));
            setJoinError(null);
          }}
          placeholder="ABC123"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          maxLength={CODE_LENGTH}
          aria-describedby={joinError ? "join-error" : undefined}
        />
        {joinError && (
          <p id="join-error" className={styles.error} role="alert">
            {joinError}
          </p>
        )}
        <Button type="submit" icon="link" fullWidth disabled={joining} autoFocus={invited}>
          {joining ? "Connexion…" : "Rejoindre"}
        </Button>
      </form>
    </section>
  );

  return (
    <PageShell title="Avec un ami" backHref="/jouer">
      <p className={ui.muted}>
        {invited
          ? "Un ami t'invite à jouer : rejoins son salon !"
          : "Crée un salon et invite un ami à jouer en ligne, où qu'il soit."}
      </p>
      {invited ? (
        <>
          {joinSection}
          {inviteSection}
        </>
      ) : (
        <>
          {inviteSection}
          {joinSection}
        </>
      )}
    </PageShell>
  );
}
