import { useSyncExternalStore } from "react";

// Volumes go from 0 (muted) to 1 (full)
export type AudioSettings = { fx: number; music: number };

const STORAGE_KEY = "morpionception_audio";
const DEFAULTS: AudioSettings = { fx: 0.8, music: 0.5 };

const clamp = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;

let current: AudioSettings | null = null;
const listeners = new Set<(s: AudioSettings) => void>();

const load = (): AudioSettings => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return { fx: clamp(saved.fx, DEFAULTS.fx), music: clamp(saved.music, DEFAULTS.music) };
  } catch {
    return DEFAULTS;
  }
};

export const getAudioSettings = (): AudioSettings => {
  if (typeof window === "undefined") return DEFAULTS;
  if (!current) current = load();
  return current;
};

export const setAudioSettings = (patch: Partial<AudioSettings>) => {
  const next = { ...getAudioSettings(), ...patch };
  current = { fx: clamp(next.fx, DEFAULTS.fx), music: clamp(next.music, DEFAULTS.music) };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage can be unavailable (private mode): keep the value in memory only
  }
  listeners.forEach((l) => l(current!));
};

export const subscribeAudioSettings = (listener: (s: AudioSettings) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useAudioSettings = () =>
  useSyncExternalStore(subscribeAudioSettings, getAudioSettings, () => DEFAULTS);
