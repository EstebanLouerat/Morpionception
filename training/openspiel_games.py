"""Random games of OpenSpiel's ultimate tic-tac-toe, to check that its rules are the
game's rules before training on it (see docs/ai-training.md).

    pip install "open_spiel>=2.0.2"
    python training/openspiel_games.py 2000 openspiel-games.json
    npm run ai:check-openspiel -- openspiel-games.json

Each game is saved as its moves (board, cell, and the legal moves before it, as
board * 9 + cell) and its winner ("X", "O" or null for a draw).
"""

import json
import random
import sys
from importlib.metadata import version

import pyspiel


def main(count: int, path: str, seed: int = 1) -> None:
    # Versions before 2.0.2 put the wrong player's mark on some free-choice moves
    major, minor, patch = (int(part) for part in version("open_spiel").split(".")[:3])
    if (major, minor, patch) < (2, 0, 2):
        sys.exit(f"open_spiel {version('open_spiel')} has a rules bug: install open_spiel>=2.0.2")

    random.seed(seed)
    game = pyspiel.load_game("ultimate_tic_tac_toe")
    games = []
    for _ in range(count):
        state = game.new_initial_state()
        moves = []
        while not state.is_terminal():
            # A free choice takes two actions in OpenSpiel: the board, then the cell.
            # The state's text says which board is forced ("any" for a free choice).
            forced = str(state).split("Forced board: ")[1].split()[0]
            if forced == "any":
                legal = []
                for board in state.legal_actions():
                    after = state.clone()
                    after.apply_action(board)
                    legal += [board * 9 + cell for cell in after.legal_actions()]
                board = random.choice(state.legal_actions())
                state.apply_action(board)
            else:
                board = int(forced)
                legal = [board * 9 + cell for cell in state.legal_actions()]
            cell = random.choice(state.legal_actions())
            state.apply_action(cell)
            moves.append([board, cell, sorted(legal)])
        returns = state.returns()
        winner = "X" if returns[0] > 0 else "O" if returns[1] > 0 else None
        games.append({"moves": moves, "winner": winner})
    with open(path, "w") as file:
        json.dump(games, file)
    print(f"{count} games saved to {path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: python training/openspiel_games.py <games> <output.json>")
    main(int(sys.argv[1]), sys.argv[2])
