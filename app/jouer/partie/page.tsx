"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ui from "../../ui/common.module.css";
import PageShell from "../../ui/PageShell";
import { Button, ButtonLink } from "../../ui/Button";
import ClockPicker from "../../game/ClockPicker";
import { getMode } from "../../game/modes";
import { clearSavedGame, hasGameInProgress } from "../../game/savedGame";

// Options of a game, picked after the mode and before the game starts
export default function Partie() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode] = useState(() => getMode(params.get("mode")));
  const [canResume] = useState(() => hasGameInProgress(mode.id));
  const gameHref = `/game?mode=${mode.id}`;

  return (
    <PageShell title={mode.name} backHref="/jouer">
      <p className={ui.muted}>{mode.tagline}</p>

      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>Options</h2>
        <div className={ui.card}>
          {mode.clockOption ? (
            <ClockPicker />
          ) : (
            <p className={ui.muted}>Aucune option pour ce mode.</p>
          )}
        </div>
      </section>

      <Button
        icon="play"
        size="lg"
        fullWidth
        onClick={() => {
          clearSavedGame();
          router.push(gameHref);
        }}
      >
        Lancer la partie
      </Button>
      {canResume && (
        <ButtonLink variant="secondary" fullWidth href={gameHref}>
          Reprendre la partie en cours
        </ButtonLink>
      )}
    </PageShell>
  );
}
