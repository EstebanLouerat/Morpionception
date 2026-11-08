import confetti from "canvas-confetti";
import { playFx } from "../../audio/engine";
import { motionReduced } from "../../theme/appearance";
import { markSolved } from "../progress";

/** An exercise solved: cheered (confetti, unless motion is reduced), and remembered in
 * the strategy book's progress when it is one of its lessons (`id`) */
export const celebrate = (id?: string) => {
  if (id) markSolved(id);
  playFx("gameWin");
  if (!motionReduced()) confetti({ particleCount: 90, spread: 70, origin: { y: 0.65 }, zIndex: 3000 });
};
