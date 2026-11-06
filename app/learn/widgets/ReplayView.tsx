"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Widgets.module.css";
import MiniBoard from "../MiniBoard";
import { IconButton } from "../../ui/Button";
import { play } from "../positions";
import type { GameState, Move } from "../../game/rules";

type ReplayProps = { start: GameState; moves: Move[]; captions: Record<number, string> };

const STEP_MS = 1700;

/** A game played move by move, with a word on the key moves: play, pause, step */
const ReplayView = ({ start, moves, captions }: ReplayProps) => {
  const positions = useMemo(() => {
    const list = [start];
    for (const move of moves) list.push(play(list[list.length - 1], move));
    return list;
  }, [start, moves]);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(true);
  const end = positions.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (at >= end) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setAt((i) => i + 1), at === 0 ? 700 : STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, at, end]);

  // The latest word at or before this move
  let caption = "Le plateau est vide : X commence.";
  for (let i = at; i >= 0; i--)
    if (captions[i]) {
      caption = captions[i];
      break;
    }

  return (
    <div className={styles.widget}>
      <MiniBoard state={positions[at]} label={`Partie commentée, coup ${at} sur ${end}`} />
      <p className={styles.caption} role="status" aria-live="polite">
        {caption}
      </p>
      <div className={styles.player}>
        <IconButton icon="skipBack" label="Au début" onClick={() => { setPlaying(false); setAt(0); }} />
        <IconButton icon="chevronLeft" label="Coup précédent" onClick={() => { setPlaying(false); setAt((i) => Math.max(0, i - 1)); }} disabled={at === 0} />
        <IconButton
          icon={playing ? "pause" : "play"}
          label={playing ? "Pause" : "Lecture"}
          onClick={() => {
            if (!playing && at >= end) setAt(0);
            setPlaying((p) => !p);
          }}
        />
        <IconButton icon="chevronRight" label="Coup suivant" onClick={() => { setPlaying(false); setAt((i) => Math.min(end, i + 1)); }} disabled={at === end} />
        <IconButton icon="skipForward" label="À la fin" onClick={() => { setPlaying(false); setAt(end); }} />
        <span className={styles.counter}>
          {at} / {end}
        </span>
      </div>
    </div>
  );
};

export default ReplayView;
