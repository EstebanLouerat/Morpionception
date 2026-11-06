import confetti from "canvas-confetti";
import { playFx } from "../../audio/engine";
import { motionReduced } from "../../theme/appearance";
import { markSolved } from "../progress";

/** An exercise solved: remembered and cheered (confetti, unless motion is reduced) */
export const celebrate = (id: string) => {
  markSolved(id);
  playFx("gameWin");
  if (!motionReduced()) confetti({ particleCount: 90, spread: 70, origin: { y: 0.65 }, zIndex: 3000 });
};
