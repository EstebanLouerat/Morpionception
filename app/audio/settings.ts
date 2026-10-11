import { createPersistedStore } from "../lib/persistedStore";

// Volumes go from 0 (muted) to 1 (full)
export type AudioSettings = { fx: number; music: number };

const DEFAULTS: AudioSettings = { fx: 0.8, music: 0.5 };

const clamp = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

const store = createPersistedStore<AudioSettings>(
  "morpionception_audio",
  DEFAULTS,
  (raw) => ({ fx: clamp(raw.fx, DEFAULTS.fx), music: clamp(raw.music, DEFAULTS.music) })
);

export const getAudioSettings = store.get;
export const setAudioSettings = store.set;
export const subscribeAudioSettings = store.subscribe;
export const useAudioSettings = store.use;
