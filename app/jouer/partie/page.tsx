"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ui from "../../ui/common.module.css";
import PageShell from "../../ui/PageShell";
import { Button, ButtonLink } from "../../ui/Button";
import ClockPicker from "../../game/ClockPicker";
import SidePicker from "../../game/SidePicker";
import LevelPicker from "../../ai/LevelPicker";
import { useAiRecords, useAiSettings } from "../../ai/settings";
import { getMode, hasOptions } from "../../game/modes";
import { clearSavedGame, hasGameInProgress } from "../../game/savedGame";

// Options of a game, picked after the mode and before the game starts
export default function Partie() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode] = useState(() => getMode(params.get("mode")));
  const [canResume] = useState(() => hasGameInProgress(mode.id));
  const gameHref = `/game?mode=${mode.id}`;
  const { level } = useAiSettings();
  const record = useAiRecords()[level];
  const played = record.wins + record.draws + record.losses;

  return (
    <PageShell title={mode.name} backHref="/jouer">
      <p className={ui.muted}>{mode.tagline}</p>

      <section className={ui.section}>
        <h2 className={ui.sectionTitle}>Options</h2>
        <div className={ui.card}>
          {mode.levelOption && <LevelPicker />}
          {mode.sideOption && <SidePicker />}
          {mode.clockOption && <ClockPicker />}
          {!hasOptions(mode) && <p className={ui.muted}>Aucune option pour ce mode.</p>}
          {mode.levelOption && (
            <p className={ui.muted}>
              {played
                ? `Ton bilan à ce niveau : ${record.wins} victoire${record.wins > 1 ? "s" : ""} · ${
                    record.draws
                  } nul${record.draws > 1 ? "s" : ""} · ${record.losses} défaite${
                    record.losses > 1 ? "s" : ""
                  }`
                : "Pas encore de partie à ce niveau sur cet appareil."}
            </p>
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
