import { useSyncExternalStore } from "react";

/**
 * Small settings store saved in localStorage and shared by every component
 * that reads it. `sanitize` turns whatever is stored into a valid value.
 */
export const createPersistedStore = <T extends object>(
  key: string,
  defaults: T,
  sanitize: (raw: Record<string, unknown>) => T
) => {
  let current: T | null = null;
  const listeners = new Set<(value: T) => void>();

  const get = (): T => {
    if (typeof window === "undefined") return defaults;
    if (!current) {
      try {
        current = sanitize(JSON.parse(localStorage.getItem(key) ?? "{}") ?? {});
      } catch {
        current = defaults;
      }
    }
    return current;
  };

  const set = (patch: Partial<T>) => {
    current = sanitize({ ...get(), ...patch });
    try {
      localStorage.setItem(key, JSON.stringify(current));
    } catch {
      // Storage can be unavailable (private mode): keep the value in memory only
    }
    listeners.forEach((l) => l(current!));
  };

  const subscribe = (listener: (value: T) => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const use = () => useSyncExternalStore(subscribe, get, () => defaults);

  return { get, set, subscribe, use };
};
