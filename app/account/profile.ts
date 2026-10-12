// Profile options and checks, shared by the account pages and the server.

export const AVATARS = [
  { id: "fox", emoji: "🦊", label: "Renard" },
  { id: "panda", emoji: "🐼", label: "Panda" },
  { id: "frog", emoji: "🐸", label: "Grenouille" },
  { id: "tiger", emoji: "🐯", label: "Tigre" },
  { id: "octopus", emoji: "🐙", label: "Pieuvre" },
  { id: "owl", emoji: "🦉", label: "Hibou" },
  { id: "penguin", emoji: "🐧", label: "Manchot" },
  { id: "koala", emoji: "🐨", label: "Koala" },
  { id: "lion", emoji: "🦁", label: "Lion" },
  { id: "monkey", emoji: "🐵", label: "Singe" },
  { id: "dragon", emoji: "🐲", label: "Dragon" },
  { id: "unicorn", emoji: "🦄", label: "Licorne" },
  { id: "bear", emoji: "🐻", label: "Ours" },
  { id: "rabbit", emoji: "🐰", label: "Lapin" },
  { id: "cat", emoji: "🐱", label: "Chat" },
  { id: "dog", emoji: "🐶", label: "Chien" },
] as const;

export const AVATAR_COLORS = [
  { id: "violet", value: "#6c5ce7", label: "Violet" },
  { id: "pink", value: "#e84393", label: "Rose" },
  { id: "blue", value: "#2f80ed", label: "Bleu" },
  { id: "orange", value: "#f2994a", label: "Orange" },
  { id: "teal", value: "#16a085", label: "Vert d'eau" },
  { id: "purple", value: "#8e44ad", label: "Pourpre" },
  { id: "coral", value: "#e17055", label: "Corail" },
  { id: "green", value: "#00b894", label: "Vert" },
] as const;

export type AvatarId = (typeof AVATARS)[number]["id"];
export type ColorId = (typeof AVATAR_COLORS)[number]["id"];

export const isAvatarId = (id: unknown): id is AvatarId => AVATARS.some((a) => a.id === id);
export const isColorId = (id: unknown): id is ColorId => AVATAR_COLORS.some((c) => c.id === id);

export const avatarEmoji = (id: AvatarId) => AVATARS.find((a) => a.id === id)?.emoji ?? "🙂";
export const colorValue = (id: ColorId) =>
  AVATAR_COLORS.find((c) => c.id === id)?.value ?? AVATAR_COLORS[0].value;

export const PSEUDO_MIN = 3;
export const PSEUDO_MAX = 16;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

// Latin letters (accents included) and digits, with _ . - inside the name. Other
// alphabets are left out: a Cyrillic "е" looks like a Latin "e" and could imitate a pseudo.
const PSEUDO_PATTERN = /^[\p{Script=Latin}0-9][\p{Script=Latin}0-9_.-]*[\p{Script=Latin}0-9]$/u;
// Names the game itself uses for players (compared as keys, without _ . -)
const RESERVED = ["invite", "toi", "moi", "tonami", "admin", "morpionception"];

/** Key under which a pseudo is unique and found at log-in: case and accents
 * do not count, so "Léa" logs in as "lea" and "Lea" cannot be created next to it */
export const pseudoKey = (pseudo: string) =>
  pseudo.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

/** Could be the pseudo of an account (length and characters), as typed at log-in */
export const isPlausiblePseudo = (raw: string) => {
  const pseudo = raw.normalize("NFC").trim();
  const length = [...pseudo].length;
  return length >= PSEUDO_MIN && length <= PSEUDO_MAX && PSEUDO_PATTERN.test(pseudo);
};

export type PseudoCheck = { ok: true; pseudo: string } | { ok: false; message: string };

export const checkPseudo = (raw: unknown): PseudoCheck => {
  if (typeof raw !== "string") return { ok: false, message: "Choisis un pseudo." };
  const pseudo = raw.normalize("NFC").trim();
  const length = [...pseudo].length;
  if (length < PSEUDO_MIN || length > PSEUDO_MAX)
    return {
      ok: false,
      message: `Le pseudo fait entre ${PSEUDO_MIN} et ${PSEUDO_MAX} caractères.`,
    };
  if (!PSEUDO_PATTERN.test(pseudo))
    return {
      ok: false,
      message: "Lettres et chiffres uniquement, avec _ . ou - au milieu.",
    };
  if (RESERVED.includes(pseudoKey(pseudo).replace(/[_.-]/g, "")))
    return { ok: false, message: "Ce pseudo est réservé, choisis-en un autre." };
  return { ok: true, pseudo };
};

export const checkPassword = (raw: unknown): string | null => {
  const length = typeof raw === "string" ? [...raw.normalize("NFC")].length : 0;
  if (length < PASSWORD_MIN) return `Le mot de passe fait au moins ${PASSWORD_MIN} caractères.`;
  if (length > PASSWORD_MAX)
    return `Le mot de passe fait au plus ${PASSWORD_MAX} caractères.`;
  return null;
};
