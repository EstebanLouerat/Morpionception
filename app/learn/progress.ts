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

const add = (list: string[], id: string) => (list.includes(id) ? list : [...list, id]);

export const markRead = (id: string) => store.set({ read: add(store.get().read, id) });
export const markSolved = (id: string) => store.set({ solved: add(store.get().solved, id) });
export const markTutorialDone = () => store.set({ tutorialDone: true });
