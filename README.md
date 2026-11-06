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
- Animations and confetti on victory; the last move played is ringed on the board.
- Every screen fits without scrolling, from small phones (portrait or landscape)
  to desktops: long pages use tabs, lists are shown page by page, and wide screens
  get columns (`app/ui/FitToScreen.tsx` zooms out the last few lines if needed).
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
- Take-backs (misclicks): in an online game, ask the opponent to take back your
  last move (and their reply, if they already played); they accept or refuse. In a
  local game, "Annuler" takes back the last move.
- Accounts (`/compte`): sign up with a pseudo and a password (no e-mail), or
  with Google; log in, log out, change the password, link or unlink Google,
  delete the account. Playing never requires an account.
- Profile (`/compte/profil`): pseudo, emoji avatar and color, shown in the home
  top bar and to the opponent in online games.
- Stats for online games of logged-in players: games, wins, win rate, best
  series, wins / draws / losses, results as X and as O, small boards won, and
  the last 20 games with the opponent, how it ended and the boards score.
- Game against the AI (`/jouer/partie?mode=ai`): four levels from Débutant to
  Expert, side choice, "Annuler" to take back a move, and a record of wins,
  draws and losses per level on this device. The AI runs in the browser.
- Ranked mode (`/jouer/classe`, account needed): matchmaking by rating, a
  rating like chess.com's (big jumps for new players that shrink game after game),
  ranks with divisions like Valorant from Bois to Morpion Mastermind, 5 placement
  games, and animations when you move up or down. The search runs in the
  background while you browse the site (an indicator shows it on every page), a
  fullscreen animation opens the game once an opponent is found, and a ranked game
  still going on brings you back to it.
- Leaderboard (`/classement`): the top 50 ranked players. The top 3 wear a gold,
  silver or bronze crown on their avatar: on the home page, the account page and
  next to their symbol in every online game.
- Learning (`/apprendre`, opened only from the home page or the Jouer menu, never
  by itself): an interactive tutorial that teaches the rules by playing on a live
  board, and a strategy book of 9 lessons from beginner to advanced, with demos,
  puzzles (a wrong move is answered by the reply that punishes it), a commented
  game and a checklist. Progress is kept on the device.
- Light / dark theme and three player color palettes.
- Accessibility (Paramètres > Accessibilité): bigger cells (Normale, Grande, or
  Maximale: the grid takes the whole screen), big X and O, high contrast (visible
  borders, the board to play strongly marked, nothing faded) and fewer animations.
  Applied before the first paint, like the theme.

## Roadmap

These are in the menus as "Bientôt" (coming soon) placeholders:

- Game modes: local 2v2, fun variants (`app/game/modes.ts`).
- Friends (`/amis`), custom pieces.

## Project structure

| Path               | Content                                                     |
| ------------------ | ----------------------------------------------------------- |
| `app/game/`        | Game rules, game screen (local, AI, online), mode registry  |
| `app/ai/`          | AI: search engine, Web Worker, levels and record            |
| `scripts/`         | AI tools, ranked ladder simulator                           |
| `training/`        | Python side of AI training (OpenSpiel game export)          |
| `docs/`            | Guides (training a stronger AI)                             |
| `app/jouer/`       | Mode selection, play-with-a-friend and ranked pages         |
| `app/online/`      | Online rooms: MongoDB store, API client, live room hook, QR |
| `app/api/rooms/`   | Rooms API (create, join, play, live updates)                |
| `app/account/`     | Accounts: MongoDB store, auth, stats, API client, avatar    |
| `app/api/account/` | Accounts API (sign up, log in, profile, password, delete)   |
| `app/ranked/`      | Ranked: settings, rating, queue, leaderboard, emblems       |
| `app/api/ranked/`  | Ranked API (search for a game, leaderboard)                 |
| `app/classement/`  | Leaderboard page                                            |
| `app/compte/`      | Account, stats and profile pages                            |
| `app/parametres/`  | Settings (audio, appearance)                                |
| `app/learn/`       | Tutorial and strategy book: positions, lessons, widgets     |
| `app/apprendre/`   | Learning pages (hub, tutorial, strategy book)               |
| `app/ui/`          | Shared components: buttons, icons, loader, page layout      |
| `app/audio/`       | Web Audio sound effects and music                           |
| `app/theme/`       | Theme and palette settings, applied before the first paint  |
| `app/lib/`         | Helpers (MongoDB connection, API, `localStorage` settings)  |

## AI

The AI (`app/ai/engine.ts`) uses Monte Carlo Tree Search: from the current
position it plays thousands of random games to the end and picks the move that
wins most often, spending its time on the most promising moves (UCT). The board
is kept as bit masks (9 bits per small board and per player), which runs about
65,000 random games per second. It runs in a Web Worker (`app/ai/ai.worker.ts`),
so the page stays smooth while it thinks, and needs no server.

| Level         | How it plays                                   |
| ------------- | ---------------------------------------------- |
| Débutant      | 60 random games per move, 35 % of moves random |
| Intermédiaire | 600 random games per move, 8 % of moves random |
| Difficile     | 6,000 random games per move                    |
| Expert        | 2 seconds per move (over 100,000 random games) |

Each level wins more than 90 % of its games against the level below it
(measured with games between levels). Every level takes a move that wins the
game at once, and Difficile and Expert never hand over a win in one move when
another move avoids it.

`npm run ai:arena -- expert difficile 20` plays games between two levels (or
`it:<random games per move>`, `ms:<thinking time>`, `random`), to measure a change
to the AI. [docs/ai-training.md](docs/ai-training.md) explains how to train a
stronger AI for free (OpenSpiel self-play on Kaggle's free GPUs), and
`npm run ai:check-openspiel` checks OpenSpiel's rules against the game's.

## Online play

The server keeps each room and its game, and checks every move with the same
rules as the game screen (`app/game/rules.ts`). The chrono also runs on the
server, so a player who runs out of time loses even if nobody plays.

| Route                         | Description                                             |
| ----------------------------- | ------------------------------------------------------- |
| `POST /api/rooms`             | Create a room (`{ side, clock }`), get a seat token     |
| `POST /api/rooms/:code`       | `join`, `move`, `resign`, `claim`, `rematch` or `leave` |
|                               | `takeback`, `takeback-cancel`, `takeback-answer`        |
| `GET /api/rooms/:code/events` | Live room updates (server-sent events)                  |

Each player's seat token is saved in `localStorage`, so a refresh gets the same
seat back. Leaving a game in progress gives it up. Once the other player has
been offline for 2 minutes, `claim` ends the game as a win.

A take-back request (`takeback`) undoes the asker's last move, and the reply played
since if any, once the other player accepts (`takeback-answer`, `{ accept }`). Any
move cancels a request; after a refusal the same position cannot be asked about
again. The time spent stays spent.

Rooms are saved in MongoDB (`rooms` collection), so the app works with several
server instances at once, as on Vercel. A change is saved only if the room has not
changed since it was read, otherwise it is made again on the fresh room. Each open
page reads its room again every 600 ms (right away when the change was made by the
same instance), says every 5 seconds that it is still open (online status), and
reconnects by itself every 4.5 minutes (functions have a maximum duration). MongoDB
drops a room 15 minutes after its last activity, and 12 hours after it was created.

## Accounts

Accounts, sessions and password attempts are saved in MongoDB (`users`,
`sessions` and `attempts` collections; indexes are created at the first
connection). There is no e-mail, so a forgotten password cannot be recovered.
Passwords are hashed with scrypt; the session is an HTTP-only cookie valid 30 days
after the last visit.

Stats count online games between the accounts that were logged in when they
created or joined the room (or logged in before the first move of a round). A game
is not counted when fewer than 2 moves were played, when both sides are the same
account, or when a player resigns or leaves while the other one is offline. A win
claimed after 2 minutes of absence counts as a forfeit.

| Route                        | Description                                     |
| ---------------------------- | ----------------------------------------------- |
| `GET /api/account`           | Logged-in account, with stats and recent games  |
| `POST /api/account/signup`   | `{ pseudo, password }`, logs in                 |
| `POST /api/account/login`    | `{ pseudo, password }`                          |
| `POST /api/account/logout`   | Ends the session                                |
| `PATCH /api/account`         | `{ pseudo?, avatar?, color? }`                  |
| `POST /api/account/password` | `{ current, next }`, logs out the other devices |
| `POST /api/account/delete`   | `{ password }` (`{ pseudo }` without password)  |
| `GET /api/account/providers` | `{ google }`: whether Google log-in is offered  |
| `GET /api/account/google`    | Starts a Google log-in (`?mode=link&retour=…`)  |
| `GET …/google/callback`      | Google sends the player back here               |
| `POST …/google/unlink`       | Unlinks Google (only with a password)           |

Settings (environment variables):

| Variable                 | Effect                                                                   |
| ------------------------ | ------------------------------------------------------------------------ |
| `MONGODB_URI`            | MongoDB connection string (required for accounts and online play)        |
| `MONGODB_DB`             | Database name (default `morpionception`)                                 |
| `MORPION_MAX_ACCOUNTS`   | Accounts the server accepts (default 5000)                               |
| `MORPION_SECURE_COOKIES` | `1` forces Secure cookies (HTTPS proxy that does not say so)             |
| `MORPION_IP_HEADER`      | Header with the client address for rate limits (e.g. `cf-connecting-ip`) |
| `GOOGLE_CLIENT_ID`       | Google OAuth client ID: with the secret, offers "Continuer avec Google"  |
| `GOOGLE_CLIENT_SECRET`   | Google OAuth client secret (keep it in a sensitive variable)             |
| `MORPION_PUBLIC_URL`     | Site address for Google's redirect, if the proxy hides it                |

The limits on wrong passwords per address only work behind a proxy that sets
`X-Forwarded-For` (Vercel does, or use `MORPION_IP_HEADER`): without one, a client
can claim any address. The limits per account and for the whole server work in
every case.

### Log-in with Google

Google asks only for the account's id and name (scope `openid profile`): no e-mail
is read or kept. The first log-in makes an account with a pseudo taken from the name
(changed in the profile); a Google account can also be linked to an existing account
in Profil > Sécurité. An account made with Google can set a password later, and is
deleted by typing its pseudo.

To turn it on:

1. In the [Google Cloud console](https://console.cloud.google.com/), create a
   project, then under *APIs & Services > OAuth consent screen* set it up as
   *External* (app name, support e-mail; the `openid` and `profile` scopes need no
   review) and publish it.
2. Under *Credentials*, create an *OAuth client ID* of type *Web application*, with
   the authorized redirect URI `https://<your domain>/api/account/google/callback`
   (add `http://localhost:3000/api/account/google/callback` for development).
3. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (on Vercel: Project Settings >
   Environment Variables, the secret as sensitive), then redeploy.

Google only sends players back to the redirect URIs listed there: Vercel preview
deployments, whose address changes, cannot use it unless you add their address.

If you host the server yourself and it is reachable beyond your local network, serve it over HTTPS
(passwords cross the network in clear on plain HTTP). Caddy needs no extra
setup; with nginx, forward the host and protocol:

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

## Ranked

Every setting is in [`app/ranked/config.ts`](app/ranked/config.ts), with a comment
on what it does: starting rating, size of the jumps at the start and at the end,
placement games, the ladder (names, starting ratings, divisions, colors), the
matchmaking range, the chrono, and the leaderboard. After a change,
`npm run ranked:simulate` prints how many points a game is worth over time and
where a population of players ends up on the ladder.

**Rating.** The rating is computed with Glicko, as on chess.com. Each player has a
rating (1000 to start) and an uncertainty. A new player is very uncertain, so a
game moves their rating a lot; each game makes it more certain, so the jumps
shrink. A player back after a long break moves faster again. Points won or lost
also depend on the opponent: beating a stronger player is worth more.

| Game          | 1    | 2    | 3    | 5   | 10  | 20  | 30 and later |
| ------------- | ---- | ---- | ---- | --- | --- | --- | ------------ |
| Win (or loss) | ±162 | ±142 | ±102 | ±65 | ±34 | ±17 | ±13          |

(Against an opponent of the same rating. A draw between equals changes nothing.)

**Ranks.** The rank is hidden during the first 5 games (placement). Then each tier
has three divisions (I, II, III), 50 points each:

| Tier    | From | Tier                   | From |
| ------- | ---- | ---------------------- | ---- |
| Bois    | 550  | Platine                | 1150 |
| Bronze  | 700  | Diamant                | 1300 |
| Argent  | 850  | Maître                 | 1450 |
| Or      | 1000 | **Morpion Mastermind** | 1600 |

Ratings below 550 count as Bois I. Morpion Mastermind has no divisions.

**Matchmaking.** A searching player is paired with the closest rating within
±100 points, a range that grows by 15 points per second of waiting. Two players
cannot play more than 10 rated games together in 24 hours. Sides are drawn at
random, and the 5-minute chrono starts at once. There is no rematch: "Rejouer"
starts a new search. Resigning, leaving or running out of time is a loss. An
opponent who has not opened the game after 20 seconds can be left: the game is
cancelled with no points lost (any game with fewer than 2 moves is not rated).

**Leaderboard.** The top 50 placed players who played a ranked game in the last
30 days, refreshed after each rated game (and at most every 15 seconds on each
server instance). The top 3 get the crowns.

| Route                         | Description                                                |
| ----------------------------- | ---------------------------------------------------------- |
| `POST /api/ranked/queue`      | `{ action: "join" \| "poll" \| "leave" }` (logged in only) |
| `GET /api/ranked/leaderboard` | Top players, with their rating and results                 |

A search is kept going by the site asking every 1.5 seconds, from any page
(`app/ranked/RankedSearch.tsx`, mounted in the root layout); closing or reloading
the tab stops it, and a page silent for 10 seconds is not paired anymore. Players are paired under a lock in MongoDB, so two
server instances never pair the same player twice. Ranked games are ordinary rooms
(same API and live updates as friend games) that carry both ratings; when one
ends, the server rates it once and saves the new ratings in the room, so both
pages show the change.

MongoDB collections: `queue` (searching players; dropped 60 seconds after the page
stops asking), `locks` (the pairing lock), `rankedGames` (one entry per rated game,
kept 30 days: rates each game once, and counts games between two players). Ratings
are saved on each account (`users.ranked`).

## Playing from a phone

To play from a phone on the same network during development, open the app with
the computer's local IP address (not `localhost`) before creating the room, so
the invite link and QR code point to it.

## Getting started

Requires Node.js 20 or newer, and a MongoDB database for accounts and online
play (local games work without it).

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

On Vercel, the MongoDB Atlas integration sets `MONGODB_URI` for Preview and
Production. It is a sensitive variable, so `vercel env pull` cannot copy it: for
local development, put a connection string in `.env.local` yourself (the one from
the Atlas dashboard, or a local server such as `mongodb://127.0.0.1:27017/`):

```bash
MONGODB_URI="mongodb+srv://…"
```

## Scripts

| Command                                | Description                                                  |
| -------------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                          | Start the development server                                 |
| `npm run build`                        | Build for production                                         |
| `npm run start`                        | Serve the production build                                   |
| `npm run lint`                         | Run ESLint                                                   |
| `npm run ai:arena -- <a> <b> [games]`  | Games between two AIs (levels, `it:<n>`, `ms:<n>`, `random`) |
| `npm run ai:check-openspiel -- <file>` | Replay OpenSpiel games through the game's rules              |
| `npm run ranked:simulate`              | Points per game and ladder spread for the ranked settings    |
| `npm run learn:check`                  | Checks every puzzle of the strategy book against the rules   |
