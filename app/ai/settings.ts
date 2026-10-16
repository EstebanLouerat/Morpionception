import { createPersistedStore } from "../lib/persistedStore";
import type { Level } from "./engine";

export const LEVELS: { id: Level; label: string; hint: string }[] = [
  { id: "debutant", label: "Débutant", hint: "Joue vite et fait des erreurs : idéal pour apprendre." },
  { id: "intermediaire", label: "Intermédiaire", hint: "Voit les coups simples, se trompe parfois." },
  { id: "difficile", label: "Difficile", hint: "Calcule beaucoup de suites avant de jouer." },
  { id: "expert", label: "Expert", hint: "Réfléchit 2 secondes par coup. Bonne chance !" },
];

export const levelLabel = (level: Level) => LEVELS.find((l) => l.id === level)?.label ?? level;

export const isLevel = (value: unknown): value is Level => LEVELS.some((l) => l.id === value);

// Level picked in the menu, used when a new game starts
const settings = createPersistedStore<{ level: Level }>(
  "morpionception_ai",
  { level: "debutant" },
  (raw) => ({ level: isLevel(raw.level) ? raw.level : "debutant" })
);

export const getAiSettings = settings.get;
export const setAiSettings = settings.set;
export const useAiSettings = settings.use;

// Results against the AI on this device, per level
export type AiRecord = { wins: number; draws: number; losses: number };
type Records = { [level in Level]: AiRecord };

const emptyRecord = (): AiRecord => ({ wins: 0, draws: 0, losses: 0 });
const count = (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;

const records = createPersistedStore<Records>(
  "morpionception_ai_record",
  Object.fromEntries(LEVELS.map((l) => [l.id, emptyRecord()])) as Records,
  (raw) =>
    Object.fromEntries(
      LEVELS.map((l) => {
        const r = (raw[l.id] ?? {}) as Partial<AiRecord>;
        return [l.id, { wins: count(r.wins), draws: count(r.draws), losses: count(r.losses) }];
      })
    ) as Records
);

export const useAiRecords = records.use;

export const addAiResult = (level: Level, result: keyof AiRecord) => {
  const current = records.get()[level];
  records.set({ [level]: { ...current, [result]: current[result] + 1 } } as Partial<Records>);
};
