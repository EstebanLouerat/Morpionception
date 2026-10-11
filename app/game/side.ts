import { createPersistedStore } from "../lib/persistedStore";

/** Side wanted in an online game, X always plays first */
export type SideChoice = "X" | "O" | "random";

export const SIDE_CHOICES: { id: SideChoice; label: string; hint: string }[] = [
  { id: "X", label: "X", hint: "Commence" },
  { id: "O", label: "O", hint: "Joue en 2e" },
  { id: "random", label: "?", hint: "Aléatoire" },
];

const store = createPersistedStore<{ side: SideChoice }>(
  "morpionception_side",
  { side: "random" },
  (raw) => ({
    side: SIDE_CHOICES.some((c) => c.id === raw.side) ? (raw.side as SideChoice) : "random",
  })
);

export const getSideSettings = store.get;
export const setSideSettings = store.set;
export const useSideSettings = store.use;
