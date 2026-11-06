// The strategy book: lessons from simple to advanced. Puzzles are judged with the game's
// rules (see positions.ts); `npm run learn:check` checks every one has a solution and
// that the judge agrees with it.
import type { GameState, Move } from "../game/rules";
import {
  boardName,
  boardWinGiven,
  cellName,
  forcesWin,
  givesFreeChoice,
  legalMoves,
  play,
  position,
  winsBoard,
  winsGame,
} from "./positions";

export type Level = "debutant" | "intermediaire" | "avance";
export const LEVELS: Record<Level, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

/** The verdict on a move of a puzzle; punish: the opponent's reply that shows why */
export type Verdict = { ok: boolean; text: string; punish?: Move | null };

export type Puzzle = {
  state: GameState;
  prompt: string;
  judge: (state: GameState, move: Move) => Verdict;
  /** Said once solved */
  solution: string;
  /** Solved in two moves: after the right one, the opponent's forced reply is played
   * and the player finishes (a move that wins the game) */
  finish?: boolean;
};

export type Widget =
  | { kind: "send" }
  | { kind: "lines"; scale: "cases" | "grilles" }
  | { kind: "puzzle"; puzzle: Puzzle }
  | { kind: "replay"; start: GameState; moves: Move[]; captions: Record<number, string> }
  | { kind: "checklist"; items: { title: string; text: string }[] };

export type Lesson = {
  id: string;
  level: Level;
  title: string;
  /** Short paragraphs */
  text: string[];
  widget: Widget;
};

// --- Judges ---

const capital = (text: string) => text[0].toUpperCase() + text.slice(1);

/** A safe move: gives the opponent neither a free choice nor a board */
const safety = (state: GameState, move: Move): Verdict => {
  if (givesFreeChoice(state, move)) {
    const after = play(state, move);
    const punish = legalMoves(after).find((r) => winsBoard(after, r)) ?? null;
    return {
      ok: false,
      punish,
      text: punish
        ? `${capital(boardName(move.cell))} est fermée : O peut jouer où il veut… et va gagner ${boardName(punish.board)}.`
        : `${capital(boardName(move.cell))} est fermée : O pourra jouer où il veut.`,
    };
  }
  const punish = boardWinGiven(state, move);
  if (punish)
    return {
      ok: false,
      punish,
      text: `Ce coup l'envoie dans ${boardName(punish.board)} : il la gagne en jouant ${cellName(punish.cell)}.`,
    };
  return { ok: true, text: `Bien vu : dans ${boardName(move.cell)}, il n'a rien à gagner.` };
};

// --- Positions ---

// O threatens the top left board (top right cell) and the top right one (top left cell)
const P_GIFT = position(
  [
    "OO. X.. ...",
    "... .X. ...",
    "... .O. ..O",
    "... ... ...",
    ".O. .X. ...",
    "... ... ...",
    "... .X. ...",
    "... ... ...",
    "X.. ... ...",
  ],
  "X",
  4
);

// X must play in the top middle board; the bottom middle board is closed (won), and O
// threatens two boards
const P_FREE = position(
  [
    "... .X. ...",
    "X.O ... ...",
    "... ... ...",
    ".X. O.O ...",
    "... ... ...",
    "OO. ... X..",
    "... ... ...",
    "XXX O.. .O.",
    "... ... ...",
  ],
  "X",
  1
);

// X can take the bottom left board three ways; only one sends O somewhere harmless
const P_TIMING = position(
  [
    "... .X. ...",
    "... ... ...",
    "O.O ... X..",
    "... ... ...",
    "X.. ... ...",
    "... ... ...",
    "XXO .XO ...",
    "... .O. ...",
    "OOO X.X ...",
  ],
  "X",
  6
);

// X has the top left and bottom right boards and two in a row in the center one; O has
// just one cell left in the middle right board: the center
const P_FORCE = position(
  [
    "XXX OO. ...",
    "... .O. ...",
    "... .O. ...",
    "O.. ... ...",
    "X.O .X. ...",
    "XOX O.X OXO",
    "... .O. ...",
    "... ... ...",
    "X.. .X. O.X",
  ],
  "X",
  3
);

const centerTrap = (): Move[] => {
  // X takes the center of every board by sending O back to the center board each time
  const moves: Move[] = [{ board: 4, cell: 4 }];
  for (const cell of [0, 1, 2]) {
    moves.push({ board: 4, cell }, { board: cell, cell: 4 });
  }
  return moves;
};

export const LESSONS: Lesson[] = [
  {
    id: "deux-coups",
    level: "debutant",
    title: "Chaque coup compte deux fois",
    text: [
      "Une case jouée, c'est un pion posé… et l'adresse où ton adversaire jouera ensuite : la position de ta case dans sa petite grille choisit sa grille dans le grand plateau.",
      "Touche une case de la grille centrale pour voir où tu l'enverrais.",
    ],
    widget: { kind: "send" },
  },
  {
    id: "centre-coins",
    level: "debutant",
    title: "Le centre et les coins",
    text: [
      "Une case est d'autant plus forte qu'elle sert à plus de lignes : le centre en ouvre 4, chaque coin 3, chaque bord seulement 2.",
      "Touche une case pour voir ses lignes.",
    ],
    widget: { kind: "lines", scale: "cases" },
  },
  {
    id: "ne-pas-offrir",
    level: "debutant",
    title: "N'offre pas une grille",
    text: [
      "Avant de jouer, regarde la grille où tu envoies ton adversaire : s'il y a deux pions alignés, il la gagne.",
      "Tu joues X dans la grille centrale. O menace deux grilles : trouve un coup qui ne lui en donne aucune.",
    ],
    widget: {
      kind: "puzzle",
      puzzle: {
        state: P_GIFT,
        prompt: "Joue dans la grille centrale sans offrir de grille à O.",
        judge: safety,
        solution: "Les cases à gauche, à droite et en bas l'envoient dans des grilles où il n'a rien.",
      },
    },
  },
  {
    id: "choix-libre",
    level: "intermediaire",
    title: "Le choix libre est un cadeau",
    text: [
      "Envoyer ton adversaire dans une grille déjà gagnée (ou pleine), c'est le laisser jouer où il veut : il ira gagner là où il est le plus fort.",
      "La grille en bas au milieu est fermée. Trouve un coup qui ne laisse ni grille ni choix libre à O.",
    ],
    widget: {
      kind: "puzzle",
      puzzle: {
        state: P_FREE,
        prompt: "Joue dans la grille en haut au milieu.",
        judge: safety,
        solution: "Restent sûres les cases qui l'envoient dans une grille ouverte où il n'a pas deux pions alignés.",
      },
    },
  },
  {
    id: "bon-moment",
    level: "intermediaire",
    title: "Gagner une grille au bon moment",
    text: [
      "Gagner une petite grille, c'est bien ; mais le coup qui la gagne envoie aussi ton adversaire quelque part.",
      "Tu peux prendre la grille en bas à gauche de deux façons. Une seule ne lui rend rien.",
    ],
    widget: {
      kind: "puzzle",
      puzzle: {
        state: P_TIMING,
        prompt: "Gagne la grille en bas à gauche sans rien rendre.",
        judge: (state, move) => {
          const safe = safety(state, move);
          if (!winsBoard(state, move))
            return safe.ok
              ? { ok: false, text: "Sûr, mais tu peux gagner la grille tout de suite. Cherche encore !" }
              : safe;
          if (!safe.ok) return { ...safe, text: `Tu gagnes la grille… mais ${safe.text[0].toLowerCase()}${safe.text.slice(1)}` };
          return { ok: true, text: "Parfait : la grille est à toi, et O n'a rien à prendre en bas au milieu." };
        },
        solution: "La case du bas au milieu gagne la grille (la colonne) et l'envoie dans une grille où il n'a qu'un pion.",
      },
    },
  },
  {
    id: "grilles-qui-comptent",
    level: "intermediaire",
    title: "Les grilles qui comptent",
    text: [
      "Au grand plateau, c'est pareil : la grille centrale sert à 4 lignes, les coins à 3, les bords à 2.",
      "Une grille vaut aussi par celles que tu as déjà : celle qui complète deux de tes lignes vaut plus que toutes les autres. Touche une grille pour voir ses lignes.",
    ],
    widget: { kind: "lines", scale: "grilles" },
  },
  {
    id: "piege-du-centre",
    level: "avance",
    title: "L'échange du centre",
    text: [
      "Un plan connu : X joue au centre, puis répond toujours au centre de la grille où il est envoyé. O est renvoyé chaque fois dans la grille centrale.",
      "X prend tous les centres… mais O finit par gagner la grille centrale, la plus précieuse. Un échange à double tranchant : regarde.",
    ],
    widget: {
      kind: "replay",
      start: position(Array(9).fill("... ... ..."), "X", null),
      moves: centerTrap(),
      captions: {
        1: "X joue au centre du centre : O devra jouer dans la grille centrale.",
        2: "O joue en haut à gauche : il envoie X dans la grille en haut à gauche.",
        3: "X joue au centre de cette grille… et renvoie O au centre.",
        5: "Encore : X prend un deuxième centre, O revient au centre.",
        6: "O aligne trois cases : la grille centrale est à lui !",
        7: "X a trois centres, O la grille centrale. À qui l'avantage ? Au joueur qui saura utiliser ses envois.",
      },
    },
  },
  {
    id: "envoi-force",
    level: "avance",
    title: "L'envoi forcé",
    text: [
      "Quand une grille n'a plus qu'une case libre, celui qui y est envoyé n'a qu'un coup… et ce coup envoie l'autre où la case l'indique.",
      "X a les grilles en haut à gauche et en bas à droite : il lui manque le centre. Trouve le coup qui oblige O à t'y envoyer, puis gagne.",
    ],
    widget: {
      kind: "puzzle",
      puzzle: {
        state: P_FORCE,
        prompt: "Joue dans la grille au milieu à gauche : gagne en deux coups.",
        finish: true,
        judge: (state, move) => {
          if (forcesWin(state, move))
            return { ok: true, text: "O n'a qu'une case : le centre de sa grille, qui t'envoie au centre. À toi de finir !" };
          const after = play(state, move);
          const block =
            legalMoves(after).find((r) => {
              const next = play(after, r);
              return !legalMoves(next).some((m) => winsGame(next, m));
            }) ?? null;
          return {
            ok: false,
            punish: block,
            text: givesFreeChoice(state, move)
              ? "O peut jouer où il veut : il bloque la grille centrale."
              : move.cell === 4
              ? "Tu l'envoies dans la grille centrale : il y bloque ta ligne."
              : `O n'est pas obligé de t'envoyer au centre : il peut jouer ailleurs dans ${boardName(move.cell)}.`,
          };
        },
        solution: "La case au milieu à droite l'envoie dans la grille où seul le centre est libre.",
      },
    },
  },
  {
    id: "avant-chaque-coup",
    level: "avance",
    title: "Avant chaque coup",
    text: [
      "Les bons joueurs se posent les mêmes questions à chaque coup, dans cet ordre. Coche-les en lisant : avec l'habitude, elles deviennent automatiques.",
    ],
    widget: {
      kind: "checklist",
      items: [
        { title: "Puis-je gagner la partie ?", text: "Trois grilles alignées : regarde d'abord le grand plateau." },
        { title: "Puis-je gagner une grille ?", text: "Seulement si le coup gagnant ne lui rend rien." },
        { title: "Où est-ce que je l'envoie ?", text: "A-t-il deux pions alignés dans cette grille ?" },
        { title: "Est-ce que je lui laisse le choix libre ?", text: "Une grille fermée, c'est un cadeau." },
        { title: "Quelle grille compte le plus ?", text: "Celle qui complète tes lignes, ou casse les siennes." },
      ],
    },
  },
];

export const lessonById = (id: string | null) => LESSONS.find((l) => l.id === id) ?? null;
