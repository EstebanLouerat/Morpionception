// French labels for the stats and the game history.
import type { OutcomeReason } from "../game/rules";

export const REASON_LABELS: Record<OutcomeReason, string> = {
  line: "alignement",
  draw: "égalité",
  timeout: "au temps",
  resign: "abandon",
};

/** "42 %", or "—" when there is nothing to divide */
export const percent = (part: number, total: number) =>
  total > 0 ? `${Math.round((part / total) * 100)} %` : "—";

export const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

/** "il y a 5 minutes", "hier", then the date for older games */
export const relativeTime = (at: number, now = Date.now()) => {
  const seconds = Math.round((now - at) / 1000);
  if (seconds < 60) return "à l'instant";
  if (seconds < 3600) return relative.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86_400) return relative.format(-Math.floor(seconds / 3600), "hour");
  if (seconds < 30 * 86_400) return relative.format(-Math.floor(seconds / 86_400), "day");
  return new Date(at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
};

/** "octobre 2026" */
export const monthYear = (at: number) =>
  new Date(at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
