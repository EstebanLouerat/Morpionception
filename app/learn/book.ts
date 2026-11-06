// The strategy book: lessons from simple to advanced. Puzzles are judged with the game's
// rules (see positions.ts); `npm run learn:check` checks every one has a solution and
// that the judge agrees with it.
import type { GameState, Move } from "../game/rules";
import {
  bigThreats,
  boardName,
  boardWinGiven,
  cellName,
  forcesWin,
  givesFreeChoice,
  legalMoves,
  liveLines,
  play,
  position,
  threats,
  winsBoard,
  winsGame,
} from "./positions";

export type Level = "debutant" | "intermediaire" | "avance" | "expert";
export const LEVELS: Record<Level, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
  expert: "Expert",
};

/** The verdict on a move of a puzzle; punish: the opponent's reply that shows why */
export type Verdict = { ok: boolean; text: string; punish?: Move | null };

export type Puzzle = {
  state: GameState;
  prompt: string;
  judge: (state: GameState, move: Move) => Verdict;
  /** Said once solved */
  solution: string;
  /** Solved in two moves: after the right one, the opponent replies and the player
   * finishes with a move that reaches the goal */
  finish?: {
    /** "game": win the game, after the opponent's only reply; "board": win a board,
     * whatever the opponent replied (one of his replies, picked at random) */
    goal: "game" | "board";
    /** Said once the opponent has replied */
    reply: (reply: Move) => string;
    /** Said when the finishing move misses the goal */
    miss: string;
    /** Said once the goal is reached */
    won: string;
  };
};

/** Lessons with something to complete (a puzzle, a search, a checklist): counted as solved */
export const isExercise = (lesson: Lesson) => !["send", "lines", "replay"].includes(lesson.widget.kind);

export type Widget =
  | { kind: "send" }
  | { kind: "lines" }
  | { kind: "puzzle"; puzzle: Puzzle }
  /** Find the board with the most lines of the big board still open to the player */
  | { kind: "live"; state: GameState; prompt: string }
  /** Find every board nobody can win any more */
  | { kind: "dead"; state: GameState; prompt: string }
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
const lower = (text: string) => text[0].toLowerCase() + text.slice(1);

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

/** Two threats in the board played (he can never stop both), without giving anything */
const doubleThreat = (state: GameState, move: Move): Verdict => {
  const count = threats(play(state, move), state.currentPlayer, move.board).length;
  if (count < 2)
    return {
      ok: false,
      text: count
        ? "Une seule menace : le jour où tu l'enverras dans cette grille, il la bouchera."
        : "Aucune menace dans cette grille : cherche une case qui en crée deux.",
    };
  const safe = safety(state, move);
  if (!safe.ok) return { ...safe, text: `Deux menaces… mais ${lower(safe.text)}` };
  return { ok: true, text: "Deux menaces : cette grille est à toi d'avance, et il n'a rien à prendre." };
};

/** Every move gives the opponent a board: the right one gives him a board he cannot use */
const lesserEvil = (state: GameState, move: Move): Verdict => {
  const after = play(state, move);
  // What a board he wins is worth to him: the threats it makes on the big board, then
  // its lines still open
  const worth = (reply: Move) => {
    const next = play(after, reply);
    return bigThreats(next, "O").length * 10 + liveLines(next, "O", reply.board).length;
  };
  const gifts = legalMoves(after).filter((reply) => winsBoard(after, reply));
  const worst = gifts.reduce<Move | null>((best, r) => (!best || worth(r) > worth(best) ? r : best), null);
  if (givesFreeChoice(state, move))
    return {
      ok: false,
      punish: worst,
      text: `${capital(boardName(move.cell))} est fermée : O choisit sa grille… et prend celle qui l'arrange.`,
    };
  if (!worst) return { ok: true, text: `Dans ${boardName(move.cell)}, il n'a rien à gagner.` };
  const next = play(after, worst);
  const made = bigThreats(next, "O").find((line) => line.includes(worst.board));
  if (made)
    return {
      ok: false,
      punish: worst,
      text: `Il gagne ${boardName(worst.board)}, et il ne lui manque plus que ${boardName(
        made.find((b) => next.winners[b] !== "O")!
      )} pour gagner la partie.`,
    };
  const lines = liveLines(next, "O", worst.board).length;
  if (lines)
    return {
      ok: false,
      punish: worst,
      text: `Il gagne ${boardName(worst.board)}, qui lui ouvre ${lines} ${lines > 1 ? "lignes" : "ligne"} au grand plateau.`,
    };
  return {
    ok: true,
    text: `Il gagnera ${boardName(worst.board)}… qui ne lui sert à rien : chacune de ses lignes passe par une de tes grilles.`,
  };
};

/** Wins a board that makes two threats on the big board */
const fork = (state: GameState, move: Move): Verdict => {
  if (!winsBoard(state, move))
    return { ok: false, text: "Ce coup ne gagne pas de grille : cherche une grille où tu as deux pions alignés." };
  const after = play(state, move);
  const missing = bigThreats(after, state.currentPlayer)
    .filter((line) => line.includes(move.board))
    .map((line) => boardName(line.find((b) => after.winners[b] !== state.currentPlayer)!));
  if (missing.length >= 2)
    return {
      ok: true,
      text: `Deux menaces d'un coup : il ne te manque plus que ${missing[0]} ou ${missing[1]}. Il ne pourra pas défendre les deux.`,
    };
  if (missing.length === 1)
    return { ok: false, text: `Une seule menace (il te manque ${missing[0]}) : O n'a qu'une grille à défendre.` };
  return { ok: false, text: "Tu gagnes une grille, mais elle ne crée aucune menace au grand plateau." };
};

/** Sends him to a board where every reply sends the player to a board he can win */
const squeeze = (state: GameState, move: Move): Verdict => {
  const safe = safety(state, move);
  if (!safe.ok) return safe;
  const after = play(state, move);
  const escape = legalMoves(after).find((reply) => {
    const next = play(after, reply);
    return !legalMoves(next).some((m) => winsBoard(next, m));
  });
  if (escape)
    return {
      ok: false,
      punish: escape,
      text: `O peut jouer ${cellName(escape.cell)} : il t'envoie dans ${boardName(escape.cell)}, où tu n'as rien à gagner.`,
    };
  return {
    ok: true,
    text: `Bien vu : dans ${boardName(move.cell)}, chaque case libre t'envoie vers une de tes menaces. À lui de choisir…`,
  };
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

// O holds the top middle and middle left boards, X the top right one: the center keeps
// two lines for X, the bottom right corner three (only the boards won are shown)
const P_LIVE = position(
  [
    "... ... ...",
    "OOO XX. ...",
    "X.. OX. ..X",
    "OX. OX. O..",
    "... ... ...",
    "... ... ...",
    "... ... ...",
    "... ... ...",
    "... ... ...",
  ],
  "X",
  null
);

// X plays in the center board (X in two corners, O in the middle): two cells make two
// threats, and one of them sends O to a board he wins
const P_DOUBLE = position(
  [
    "X.. .O. ...",
    ".O. ... X..",
    "O.O ... .X.",
    "... XO. ...",
    "X.. .O. ..X",
    "..X ... O..",
    "... .X. ..O",
    ".X. ... .O.",
    "O.. ... ..X",
  ],
  "X",
  4
);

// X holds the top right and center boards, O the middle left one. Every cell of the
// bottom right board gives O a board (or a free choice); only the top middle board is
// no use to him: X's boards cut both its lines
const P_LESSER = position(
  [
    "OO. .X. ...",
    "... OO. X..",
    "XXX O.. .O.",
    "O.X O.. OX.",
    "X.. OX. O.X",
    "... .X. ...",
    "O.. O.. .X.",
    ".X. ... ...",
    "... X.O .OX",
  ],
  "X",
  8
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

// Three dead boards (top left, middle right, bottom middle: one cell left, which wins
// nothing), two that look dead (top right: O wins with the last cell; bottom left: X
// can still take the middle row), two won
const P_DEAD = position(
  [
    "XOX XOO OX.",
    "XXX .O. O..",
    "XOX OO. XXO",
    ".O. .X. ..O",
    "OOO X.X ..X",
    "XOX O.X OXO",
    "XOX .X. OXO",
    "O.X XXO OOX",
    ".O. ... X.O",
  ],
  "X",
  null
);

// X holds the top left and bottom right boards, O the middle left one, the center is
// dead; X is free to play and can win three boards: the top right one makes two threats
const P_FORK = position(
  [
    "XXX .O. O..",
    "... .O. ..O",
    ".X. .XO O..",
    "O.. XO. X.O",
    "XOX XOO OX.",
    ".O. ... X..",
    "XX. O.. ..O",
    "X.. .X. O..",
    "X.. OX. O.X",
  ],
  "X",
  null
);

// X has two in a row in the top left, top right and bottom left boards; the free cells
// of the middle right board lead to exactly those three
const P_SQUEEZE = position(
  [
    "XX. .O. ...",
    ".OX .X. O.O",
    "X.. X.. .O.",
    "O.. .X. ...",
    "... .O. X..",
    ".X. OXO .OX",
    "... .XX O..",
    "O.O ... .X.",
    "... ... ..O",
  ],
  "X",
  1
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
      "Une case est d'autant plus forte qu'elle sert à plus de lignes : le centre en ouvre 4, chaque coin 3, chaque bord seulement 2. Au grand plateau, c'est pareil pour les grilles.",
      "Touche une case pour voir ses lignes.",
    ],
    widget: { kind: "lines" },
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
          if (!safe.ok) return { ...safe, text: `Tu gagnes la grille… mais ${lower(safe.text)}` };
          return { ok: true, text: "Parfait : la grille est à toi, et O n'a rien à prendre en bas au milieu." };
        },
        solution: "La case du bas au milieu gagne la grille (la colonne) et l'envoie dans une grille où il n'a qu'un pion.",
      },
    },
  },
  {
    id: "lignes-vivantes",
    level: "intermediaire",
    title: "Les lignes encore vivantes",
    text: [
      "Le centre vaut 4 lignes… sur un plateau vide. Dès qu'une grille est gagnée, toutes les lignes qui passent par elle sont mortes pour l'autre joueur.",
      "Ici, O a gagné deux grilles. Touche une grille : ses lignes vivantes s'allument en vert, les mortes en rouge.",
    ],
    widget: { kind: "live", state: P_LIVE, prompt: "Trouve la grille qui te garde le plus de lignes." },
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
    id: "deux-menaces",
    level: "avance",
    title: "Deux menaces dans une grille",
    text: [
      "Deux lignes à qui il ne manque qu'une case, dans la même grille : ton adversaire ne pourra jamais boucher les deux.",
      "La grille est à toi d'avance : il ne peut plus t'y envoyer, et toi, tu peux l'y envoyer sans crainte. Crée deux menaces dans la grille centrale, sans rien lui offrir.",
    ],
    widget: {
      kind: "puzzle",
      puzzle: {
        state: P_DOUBLE,
        prompt: "Joue dans la grille centrale : crée deux menaces.",
        judge: doubleThreat,
        solution:
          "La case en bas à gauche menace la colonne de gauche et la ligne du bas. Celle en haut à droite aussi… mais elle lui offre une grille.",
      },
    },
  },
  {
    id: "moindre-mal",
    level: "avance",
    title: "Le moindre mal",
    text: [
      "Parfois, chaque coup offre quelque chose. Ne cherche plus le coup parfait : cherche le moins grave.",
      "Une grille ne sert à rien à ton adversaire quand chacune de ses lignes au grand plateau passe par une de tes grilles. Tu joues dans la grille en bas à droite : choisis ce que tu lui donnes.",
    ],
    widget: {
      kind: "puzzle",
      puzzle: {
        state: P_LESSER,
        prompt: "Chaque case offre une grille à O : donne-lui la moins utile.",
        judge: lesserEvil,
        solution:
          "La case en haut au milieu : il gagnera la grille en haut au milieu, mais tes grilles au centre et en haut à droite coupent ses deux lignes.",
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
        finish: {
          goal: "game",
          reply: () => "O n'avait que ce coup : il t'envoie au centre. À toi : gagne la partie !",
          miss: "Pas celui-là : la grille centrale complète ta diagonale.",
          won: "Gagné ! Tu as forcé ton adversaire à t'ouvrir la porte.",
        },
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
    id: "grilles-mortes",
    level: "expert",
    title: "Les grilles mortes",
    text: [
      "Quand chaque ligne d'une grille contient déjà un X et un O, plus personne ne peut la gagner : elle est morte, même s'il lui reste une case.",
      "Au grand plateau, elle ne comptera pour personne : elle coupe toutes les lignes qui passent par elle, et il est inutile de te battre pour elle.",
    ],
    widget: { kind: "dead", state: P_DEAD, prompt: "Touche les trois grilles que plus personne ne peut gagner." },
  },
  {
    id: "fourchette",
    level: "expert",
    title: "La fourchette",
    text: [
      "Au grand plateau aussi, deux menaces valent mieux qu'une : la grille qui complète deux de tes lignes d'un coup lui en laisse deux à défendre, et, envoyé de grille en grille, il ne peut pas être partout.",
      "O t'a laissé le choix libre et tu peux gagner trois grilles. Laquelle crée deux menaces ? (La grille centrale est morte.)",
    ],
    widget: {
      kind: "puzzle",
      puzzle: {
        state: P_FORK,
        prompt: "Gagne la grille qui crée deux menaces au grand plateau.",
        judge: fork,
        solution:
          "La grille en haut à droite : avec tes grilles en haut à gauche et en bas à droite, elle te met à une grille de gagner, deux fois.",
      },
    },
  },
  {
    id: "mauvais-choix",
    level: "expert",
    title: "Que des mauvais choix",
    text: [
      "C'est ton adversaire qui choisit sa case, donc ta prochaine grille. Mais c'est toi qui choisis la grille où il joue.",
      "Envoie-le dans une grille dont chaque case libre te renvoie vers une de tes menaces : il n'aura que des mauvais choix. Compte ses cases avant de jouer !",
    ],
    widget: {
      kind: "puzzle",
      puzzle: {
        state: P_SQUEEZE,
        prompt: "Joue dans la grille en haut au milieu : quoi qu'il réponde, gagne une grille.",
        finish: {
          goal: "board",
          reply: (reply) => `O a choisi ${cellName(reply.cell)} : il t'envoie dans ${boardName(reply.cell)}. Gagne-la !`,
          miss: "Pas celui-là : dans cette grille, tu as deux pions alignés.",
          won: "Une grille de plus : quoi qu'il choisisse, il devait te l'offrir.",
        },
        judge: squeeze,
        solution: "La case au milieu à droite : dans cette grille, ses trois cases libres mènent à tes trois menaces.",
      },
    },
  },
  {
    id: "avant-chaque-coup",
    level: "expert",
    title: "Avant chaque coup",
    text: [
      "Les bons joueurs se posent les mêmes questions à chaque coup, dans cet ordre. Coche-les en lisant : avec l'habitude, elles deviennent automatiques.",
    ],
    widget: {
      kind: "checklist",
      items: [
        { title: "Puis-je gagner la partie ?", text: "Trois grilles alignées : regarde d'abord le grand plateau." },
        { title: "Puis-je gagner une grille ?", text: "Seulement si le coup gagnant ne lui rend rien." },
        { title: "Où est-ce que je l'envoie ?", text: "Deux pions alignés pour lui ? Une grille fermée, donc le choix libre ?" },
        { title: "Que pourra-t-il me répondre ?", text: "Chacune de ses cases t'envoie quelque part : compte les bonnes et les mauvaises." },
        { title: "Quelle grille compte le plus ?", text: "Celle qui garde le plus de lignes vivantes, ou qui en crée deux d'un coup." },
        { title: "Et si tout coûte quelque chose ?", text: "Donne-lui la grille qui ne lui sert à rien." },
      ],
    },
  },
];

export const lessonById = (id: string | null) => LESSONS.find((l) => l.id === id) ?? null;
