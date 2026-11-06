// What the player has done in the tutorial and the strategy book, on this device.
import { createPersistedStore } from "../lib/persistedStore";

export type LearnProgress = {
  tutorialDone: boolean;
  /** Lessons opened */
  read: string[];
  /** Puzzles solved */
  solved: string[];
};

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);

const store = createPersistedStore<LearnProgress>(
  "morpionception_learn",
  { tutorialDone: false, read: [], solved: [] },
  (raw) => ({ tutorialDone: raw.tutorialDone === true, read: strings(raw.read), solved: strings(raw.solved) })
);

export const useLearnProgress = store.use;

// Written only when something changes (no new state for the readers otherwise)
export const markRead = (id: string) => {
  const { read } = store.get();
  if (!read.includes(id)) store.set({ read: [...read, id] });
};
export const markSolved = (id: string) => {
  const { solved } = store.get();
  if (!solved.includes(id)) store.set({ solved: [...solved, id] });
};
export const markTutorialDone = () => {
  if (!store.get().tutorialDone) store.set({ tutorialDone: true });
};
