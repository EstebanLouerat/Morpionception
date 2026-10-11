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
- Online play with a friend (`/jouer/ami`): create a room, then invite with a
  link, a 6-character room code or a QR code. Side choice (X, O or random) and
  optional chrono, real-time moves, opponent online status, resign, rematch
  (sides swap) and reconnection after a refresh.
- Light / dark theme and three player color palettes.

## Roadmap

These are in the menus as "Bientôt" (coming soon) placeholders:

- Game modes: vs AI, ranked, local 2v2, fun variants (`app/game/modes.ts`).
- Accounts (`/compte`), friends (`/amis`).

## Project structure

| Path                 | Content                                                     |
| -------------------- | ----------------------------------------------------------- |
| `app/game/`          | Game rules, game screen (local and online), mode registry   |
| `app/jouer/`         | Mode selection and play-with-a-friend pages                 |
| `app/online/`        | Online rooms: server store, API client, live room hook, QR  |
| `app/api/rooms/`     | Rooms API (create, join, play, live updates)                |
| `app/parametres/`    | Settings (audio, appearance)                                |
| `app/ui/`            | Shared components: buttons, icons, loader, page layout      |
| `app/audio/`         | Web Audio sound effects and music                           |
| `app/theme/`         | Theme and palette settings, applied before the first paint  |
| `app/lib/`           | Helpers (settings stores saved in `localStorage`)           |

## Online play

The server keeps each room and its game, and checks every move with the same
rules as the game screen (`app/game/rules.ts`). The chrono also runs on the
server, so a player who runs out of time loses even if nobody plays.

| Route                         | Description                                         |
| ----------------------------- | --------------------------------------------------- |
| `POST /api/rooms`             | Create a room (`{ side, clock }`), get a seat token |
| `POST /api/rooms/:code`       | `join`, `move`, `resign`, `rematch` or `leave`      |
| `GET /api/rooms/:code/events` | Live room updates (server-sent events)              |

Each player's seat token is saved in `localStorage`, so a refresh gets the same
seat back. Leaving a game in progress gives it up.

Rooms are kept in the memory of the Node.js server: no database to set up, but
the app must run as a single long-lived server (`npm run dev`, or
`npm run build` then `npm run start`, on any Node host). Rooms are lost when the
server restarts and dropped after 15 minutes without players. Serverless hosting
(e.g. Vercel) runs several instances that do not share memory, so online play
would need a shared store (e.g. Redis) there.

To play from a phone on the same network during development, open the app with
the computer's local IP address (not `localhost`) before creating the room, so
the invite link and QR code point to it.

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
