// Explanations of the problems' moves, in the words of the strategy book: what a move
// does (wins a board, blocks a line, sends the opponent where he has nothing…) and what
// the opponent's answer does. Built from the rules, so they never contradict the board.
import { otherSide, type GameState, type Move } from "../game/rules";
import { squareName } from "../analysis/notation";
import {
  bigThreats,
  boardName,
  boardWinGiven,
  givesFreeChoice,
  legalMoves,
  play,
  threats,
  winsBoard,
  winsGame,
} from "../learn/positions";

/** What a move does, good and bad, a few words each ("gagne la grille au centre") */
export const featuresOf = (s: GameState, m: Move) => {
  const side = s.currentPlayer;
  const other = otherSide(side);
  const after = play(s, m);
  const good: string[] = [];
  const bad: string[] = [];
  if (winsGame(s, m)) return { good: ["gagne la partie : trois grilles alignées"], bad };
  if (winsBoard(s, m)) {
    const lines = bigThreats(after, side).filter((l) => l.includes(m.board));
    const missing = lines.map((l) => l.find((b) => after.winners[b] !== side)!);
    good.push(
      `gagne ${boardName(m.board)}` +
        (missing.length >= 2
          ? " et crée deux menaces au grand plateau"
          : missing.length
            ? ` et te met à une grille de la victoire (${boardName(missing[0])})`
            : "")
    );
  }
  if (threats(s, other, m.board).includes(m.cell)) {
    const decisive = bigThreats(s, other).some((l) => l.includes(m.board));
    good.push(
      `bloque la ligne de ${other} dans ${boardName(m.board)}` + (decisive ? ", la grille qui lui manquait pour gagner" : "")
    );
  }
  if (givesFreeChoice(s, m)) bad.push(`ferme ${boardName(m.cell)} : ${other} jouera où il veut`);
  else {
    const gift = boardWinGiven(s, m);
    if (gift) bad.push(`envoie ${other} dans ${boardName(gift.board)}, qu'il peut gagner tout de suite`);
    else if (legalMoves(after).length === 1) good.push(`ne laisse qu'un coup à ${other}`);
    else if (!threats(after, other, m.cell).length) good.push(`envoie ${other} dans ${boardName(m.cell)}, où il n'a rien à gagner`);
  }
  return { good, bad };
};

/** "e5 gagne la grille au centre et …, envoie O …" (at most two things said) */
export const describe = (s: GameState, m: Move, which: "good" | "bad" | "all" = "all") => {
  const { good, bad } = featuresOf(s, m);
  const said = (which === "good" ? good : which === "bad" ? bad : [...bad, ...good]).slice(0, 2);
  return said.length ? `${squareName(m)} ${said.join(", et ")}.` : null;
};

/** What the opponent's answer does: "O répond d4 et gagne la grille au milieu à gauche." */
export const describeReply = (after: GameState, r: Move) => {
  const who = after.currentPlayer;
  const sq = squareName(r);
  if (winsGame(after, r)) return `${who} répond ${sq} et gagne la partie.`;
  if (winsBoard(after, r)) return `${who} répond ${sq} et gagne ${boardName(r.board)}.`;
  if (threats(after, otherSide(who), r.board).includes(r.cell))
    return `${who} répond ${sq} et bloque ta ligne dans ${boardName(r.board)}.`;
  if (givesFreeChoice(after, r)) return `${who} répond ${sq} : ${boardName(r.cell)} est fermée, tu joueras où tu veux.`;
  return `${who} répond ${sq}, dans ${boardName(r.board)}.`;
};

/** A nudge toward the solution, without giving the cell */
export const hintOf = (s: GameState, m: Move) => {
  const { good } = featuresOf(s, m);
  const first = good[0] ?? "";
  if (first.startsWith("gagne la partie")) return "Une grille te donnerait trois grilles alignées : laquelle ?";
  if (first.startsWith("gagne")) return "Une grille est à prendre… mais regarde aussi où ton coup l'envoie.";
  if (first.startsWith("bloque")) return `${otherSide(s.currentPlayer)} menace quelque chose : regarde ses lignes.`;
  if (first.startsWith("ne laisse")) return "Cherche le coup qui ne lui laisse qu'une réponse.";
  return "Regarde où chaque coup l'envoie : cherche la grille où il n'a rien.";
};

/** Why a forced win's move works: the opponent's answers all lose */
export const repliesText = (s: GameState, m: Move) => {
  const after = play(s, m);
  const other = after.currentPlayer;
  const count = legalMoves(after).length;
  return count === 1 ? `${other} n'a qu'un coup possible, et il perd.` : `Chacune des ${count} réponses de ${other} perd.`;
};

/** What the other moves do wrong, counted: "Des 7 autres coups, 3 laissent le choix
 * libre et 2 offrent une grille tout de suite." */
export const othersText = (s: GameState, others: Move[]) => {
  if (!others.length) return null;
  let free = 0;
  let gift = 0;
  for (const m of others) {
    if (givesFreeChoice(s, m)) free++;
    else if (boardWinGiven(s, m)) gift++;
  }
  const parts = [
    ...(free ? [`${free} ${free > 1 ? "laissent" : "laisse"} le choix libre`] : []),
    ...(gift ? [`${gift} ${gift > 1 ? "offrent" : "offre"} une grille tout de suite`] : []),
  ];
  const n = others.length;
  return parts.length
    ? `De${n > 1 ? `s ${n}` : " l'"} autre${n > 1 ? "s" : ""} coup${n > 1 ? "s" : ""}, ${parts.join(" et ")}.`
    : `${n > 1 ? `Les ${n} autres coups lui laissent` : "L'autre coup lui laisse"} une meilleure réponse.`;
};
