import { createPersistedStore } from "../lib/persistedStore";

/** Seconds per player for the whole game, 0 = no clock */
export const CLOCK_CHOICES: { seconds: number; label: string }[] = [
  { seconds: 0, label: "Sans" },
  { seconds: 60, label: "1 min" },
  { seconds: 180, label: "3 min" },
  { seconds: 300, label: "5 min" },
  { seconds: 600, label: "10 min" },
];

export type ClockSettings = { seconds: number };

const DEFAULTS: ClockSettings = { seconds: 0 };

// Chrono picked in the menu, used when a new game starts
const store = createPersistedStore<ClockSettings>(
  "morpionception_clock",
  DEFAULTS,
  (raw) => ({
    seconds: CLOCK_CHOICES.some((c) => c.seconds === raw.seconds)
      ? (raw.seconds as number)
      : DEFAULTS.seconds,
  })
);

export const getClockSettings = store.get;
export const setClockSettings = store.set;
export const useClockSettings = store.use;

export const formatClock = (ms: number) => {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};
