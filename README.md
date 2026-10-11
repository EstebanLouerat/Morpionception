# Morpionception

Ultimate tic-tac-toe ("morpion" in French) built with Next.js, React and Framer Motion.

## Rules

- The board is a 3×3 grid of 3×3 tic-tac-toe boards.
- The cell you play in decides which small board your opponent must play in next.
- If that board is already won or full, your opponent may play in any open board.
- Win a small board to claim it. Claim three boards in a row to win the game.
- If every board is closed and nobody has three in a row, the game is a draw.

## Features

- Game state saved in `localStorage`, so a refresh does not lose the game.
- Numpad controls (layout mirrors the grid: `7 8 9` is the top row):
  - forced board: one key picks the cell;
  - free choice: first key picks the board, second key picks the cell;
  - `0`, `.`, `Esc` or `Backspace` cancels the board selection.
- Animations and confetti on victory.
- Synthesized sound effects and background music, with volume sliders.
- Options screen between the mode choice and the game (`/jouer/partie`), which
  can also resume the game in progress.
- Optional chrono (time per player for the whole game) for local and friend
  games. It starts after the first move; the player whose clock runs out loses.
- Side choice for online games (X, O or random), drawn with the player colors.
- Light / dark theme and three player color palettes.

## Roadmap

These are in the menus as "Bientôt" (coming soon) placeholders:

- Game modes: vs AI, ranked, local 2v2, fun variants (`app/game/modes.ts`).
- Accounts (`/compte`), friends (`/amis`).
- Online play with a friend through a link, a room code or a QR code (`/jouer/ami`).

## Project structure

| Path                 | Content                                                     |
| -------------------- | ----------------------------------------------------------- |
| `app/game/`          | Game screen, player bar and the game mode registry          |
| `app/jouer/`         | Mode selection and play-with-a-friend pages                 |
| `app/parametres/`    | Settings (audio, appearance)                                |
| `app/ui/`            | Shared components: buttons, icons, loader, page layout      |
| `app/audio/`         | Web Audio sound effects and music                           |
| `app/theme/`         | Theme and palette settings, applied before the first paint  |
| `app/lib/`           | Helpers (settings stores saved in `localStorage`)           |

## Getting started

Requires Node.js 18.18 or newer.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command         | Description                  |
| --------------- | ---------------------------- |
| `npm run dev`   | Start the development server |
| `npm run build` | Build for production         |
| `npm run start` | Serve the production build   |
| `npm run lint`  | Run ESLint                   |
