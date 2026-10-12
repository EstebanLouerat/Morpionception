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
  (sides swap) and reconnection after a refresh. A player who stays offline for
  2 minutes lets the other one claim the win.
- Accounts (`/compte`): sign up with a pseudo and a password (no e-mail), log
  in, log out, change the password, delete the account. Playing never requires
  an account.
- Profile (`/compte/profil`): pseudo, emoji avatar and color, shown in the home
  top bar and to the opponent in online games.
- Stats for online games of logged-in players: games, wins, win rate, best
  series, wins / draws / losses, results as X and as O, small boards won, and
  the last 20 games with the opponent, how it ended and the boards score.
- Light / dark theme and three player color palettes.

## Roadmap

These are in the menus as "Bientôt" (coming soon) placeholders:

- Game modes: vs AI, ranked, local 2v2, fun variants (`app/game/modes.ts`).
- Friends (`/amis`), leaderboard, custom pieces.

## Project structure

| Path               | Content                                                    |
| ------------------ | ---------------------------------------------------------- |
| `app/game/`        | Game rules, game screen (local and online), mode registry  |
| `app/jouer/`       | Mode selection and play-with-a-friend pages                |
| `app/online/`      | Online rooms: server store, API client, live room hook, QR |
| `app/api/rooms/`   | Rooms API (create, join, play, live updates)               |
| `app/account/`     | Accounts: file store, auth, stats, API client, avatar      |
| `app/api/account/` | Accounts API (sign up, log in, profile, password, delete)  |
| `app/compte/`      | Account, stats and profile pages                           |
| `app/parametres/`  | Settings (audio, appearance)                               |
| `app/ui/`          | Shared components: buttons, icons, loader, page layout     |
| `app/audio/`       | Web Audio sound effects and music                          |
| `app/theme/`       | Theme and palette settings, applied before the first paint |
| `app/lib/`         | Helpers (settings stores saved in `localStorage`)          |

## Online play

The server keeps each room and its game, and checks every move with the same
rules as the game screen (`app/game/rules.ts`). The chrono also runs on the
server, so a player who runs out of time loses even if nobody plays.

| Route                         | Description                                             |
| ----------------------------- | ------------------------------------------------------- |
| `POST /api/rooms`             | Create a room (`{ side, clock }`), get a seat token     |
| `POST /api/rooms/:code`       | `join`, `move`, `resign`, `claim`, `rematch` or `leave` |
| `GET /api/rooms/:code/events` | Live room updates (server-sent events)                  |

Each player's seat token is saved in `localStorage`, so a refresh gets the same
seat back. Leaving a game in progress gives it up. Once the other player has
been offline for 2 minutes, `claim` ends the game as a win.

Rooms are kept in the memory of the Node.js server: no database to set up, but
the app must run as a single long-lived server (`npm run dev`, or
`npm run build` then `npm run start`, on any Node host). Rooms are lost when the
server restarts and dropped after 15 minutes without players. Serverless hosting
(e.g. Vercel) runs several instances that do not share memory, so online play
would need a shared store (e.g. Redis) there.

## Accounts

Accounts are saved by the server in `data/accounts.json` (set `MORPION_DATA_DIR`
to keep them elsewhere, e.g. on a persistent volume). Back that file up: there is
no e-mail, so a forgotten password cannot be recovered. Passwords are hashed with
scrypt; the session is an HTTP-only cookie valid 30 days after the last visit.

Stats count online games between the accounts that were logged in when they
created or joined the room. A game is not counted when fewer than 2 moves were
played, when both sides are the same account, or when a player leaves while the
other one is offline.

| Route                        | Description                                     |
| ---------------------------- | ----------------------------------------------- |
| `GET /api/account`           | Logged-in account, with stats and recent games  |
| `POST /api/account/signup`   | `{ pseudo, password }`, logs in                 |
| `POST /api/account/login`    | `{ pseudo, password }`                          |
| `POST /api/account/logout`   | Ends the session                                |
| `PATCH /api/account`         | `{ pseudo?, avatar?, color? }`                  |
| `POST /api/account/password` | `{ current, next }`, logs out the other devices |
| `POST /api/account/delete`   | `{ password }`                                  |

Settings (environment variables, all optional):

| Variable                 | Effect                                                                   |
| ------------------------ | ------------------------------------------------------------------------ |
| `MORPION_DATA_DIR`       | Folder of `accounts.json` (default `./data`)                             |
| `MORPION_MAX_ACCOUNTS`   | Accounts the server accepts (default 5000)                               |
| `MORPION_SECURE_COOKIES` | `1` forces Secure cookies (HTTPS proxy that does not say so)             |
| `MORPION_IP_HEADER`      | Header with the client address for rate limits (e.g. `cf-connecting-ip`) |

If the server is reachable beyond your local network, serve it over HTTPS
(passwords cross the network in clear on plain HTTP). Caddy needs no extra
setup; with nginx, forward the host and protocol:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

## Playing from a phone

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
