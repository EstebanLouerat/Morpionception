# Training a stronger AI for free

The AI that ships (`app/ai/engine.ts`) needs no training: it is Monte Carlo Tree
Search (MCTS) with random playouts, 2 seconds per move at the Expert level. This
guide is about going further without paying anything. It was researched in
October 2026; quotas and versions change, so check what is marked _(unverified)_.

**Recommended path:** train an AlphaZero-style network by self-play with
**OpenSpiel 2.0.2**, on your own computer or **Kaggle's free GPUs**, then use it
in the existing Web Worker to guide the search. OpenSpiel already has ultimate
tic-tac-toe with exactly Morpionception's rules, so you write no game code for
training. Before that, two free tweaks of the search are worth trying (step 0),
and a value network trained on public data is a quicker alternative (step 3).

Whatever you try, **measure it against the current AI** before shipping it:

```bash
npm run ai:arena -- expert difficile 20      # levels: debutant, intermediaire, difficile, expert
npm run ai:arena -- it:20000 it:5000 40      # it:<random games per move>, ms:<thinking time>
```

Sides alternate and the score is given for the first player. A new AI is worth
shipping when it beats `expert` clearly over 100+ games, with the same thinking
time, also on a phone.

## Step 0: tune the search (free, no training, minutes)

Measured with Morpionception's rules, against the search as it was:

| Change                                         | Score against the old search                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------ |
| Exploration constant 0.5 instead of 1.0        | 67 % at 6,000 random games per move, even (50 %, mostly draws) at 60,000 |
| MCTS-Solver (propagates proven wins / losses)  | 62 %; about +5 points on top of 0.5                                      |
| Doubling the random games per move, as a scale | 65.5 %                                                                   |
| Heuristic playouts, RAVE                       | little or nothing for this game                                          |

The exploration constant is already 0.5 in `engine.ts`: it helps the lower levels
and costs Expert nothing. Gains measured with few random games per move can shrink
at Expert's budget, so check there too. Next free gains: an
MCTS-Solver (about 40 lines), reusing the tree between moves, nodes in typed
arrays (no allocation during the search), one search per Web Worker on several
cores.

## Step 1: check the rules (5 minutes)

```bash
pip install "open_spiel>=2.0.2"
python training/openspiel_games.py 2000 openspiel-games.json
npm run ai:check-openspiel -- openspiel-games.json   # 2000 games replayed, 0 differences
```

The script replays random OpenSpiel games through `app/game/rules.ts`. **Pin
`open_spiel>=2.0.2`:** versions before July 2026 put the wrong player's mark on
some free-choice moves (407 of 500 games differ with 1.6.15, and the script
refuses to run with it).

## Step 2: AlphaZero by self-play (recommended)

1. **Install** (Python 3.11+): `pip install "open_spiel>=2.0.2" jax flax optax orbax-checkpoint chex`
   (JAX is not installed by OpenSpiel).
2. **Train:**
   `python -m open_spiel.python.examples.alpha_zero --game=ultimate_tic_tac_toe --nn_model=mlp`.
   Use `mlp`: the observation is a flat vector of 254 values, which the conv and
   resnet models do not handle well. Start on your computer to check it runs.
3. **Free GPU: Kaggle Notebooks.** 2×T4 GPU, 12 hours per session, a weekly quota
   (`kaggle quota` shows yours; about 30 GPU hours _(unverified)_). In
   `kernel-metadata.json`, set `enable_gpu` and `enable_internet` to true (both
   default to false). Start runs from your computer with
   `kaggle kernels push --accelerator NvidiaTeslaT4`, save checkpoints in
   `/kaggle/working` and fetch them with `kaggle kernels output`, to chain sessions.
   With a small network the GPU waits on the CPU searching: a multi-core home PC
   is just as good.
4. **How long.** For Connect Four,
   [AlphaZero.jl](https://github.com/jonathan-laurent/AlphaZero.jl) beat MCTS with
   1,000 random games per move after 15,000 to 25,000 self-play games, about 3-5
   hours on one consumer GPU. This game is bigger: count 30,000 to 100,000 self-play
   games, 5 to 30 GPU hours, one or two weeks of Kaggle quota _(unverified
   estimate)_.
5. **Evaluate** each checkpoint with `npm run ai:arena` once it is in the engine
   (step 4), 200 games per match (about ±7 points).

## Step 3: alternative, a value network from public data

Random playouts are the weak part of MCTS: a network that estimates who is winning
can replace them or cut them short. [utttai](https://github.com/ar-nowaczynski/utttai)
(Apache-2.0) published 8 million positions labelled by MCTS with about 1.36 million
random games each, with exactly Morpionception's rules. Its own network, trained
only on that data, beats MCTS with random playouts while searching a thousand
times less (192 wins, 176 draws, 32 losses). That network has 5 million parameters,
though, and tiny networks are much weaker (a 66,000-weight one only reached the top
11 % on CodinGame). The datasets' licence is not stated: ask the author before
shipping a model trained on them.

## Step 4: use the network in the game

- **Export.** OpenSpiel saves Orbax checkpoints, with no ONNX export: dump the
  weights to raw `Float32` or safetensors (a JSON header plus raw floats), or use
  [jax2onnx](https://github.com/enpasos/jax2onnx). From PyTorch:
  `torch.onnx.export(..., dynamo=True)`.
- **Input.** Rebuild OpenSpiel's 254 values exactly: 3 planes of 81 cells (empty,
  O, X), the player to move, then the forced board as 10 values (the 10th means a
  free choice).
- **Moves.** OpenSpiel plays a free choice as two actions, the board then the cell:
  the search must do the same, or combine the two policies.
- **Search.** In `search()`, replace UCT by PUCT: the network's move probabilities
  guide the exploration and its value replaces the random games.
- **Runtime:**

  | Network                         | Run it with                                                                 | Per evaluation (Chromium) |
  | ------------------------------- | --------------------------------------------------------------------------- | ------------------------- |
  | Small MLP (≤ 200-300k weights)  | Plain TypeScript in `app/ai/ai.worker.ts`, nothing to download              | 0.2 ms (170k weights)     |
  | Bigger MLP, convolutional net   | [onnxruntime-web](https://www.npmjs.com/package/onnxruntime-web) 1.30, `onnxruntime-web/wasm`, one thread, in the same worker | 0.3 ms (734k-weight MLP) |

  onnxruntime-web adds a 14 MB `.wasm` (2.4 MB brotli) and 0.3-1.3 s to start: load
  it only when a game against the AI starts. With today's build (webpack) the plain
  import works; Next.js 16 builds with Turbopack, where it fails at runtime. Copy
  `ort-wasm-simd-threaded.wasm` to `public/` and pass it with
  `ort.env.wasm.wasmBinary` instead: that works with both. Skip WebGPU, multiple
  threads (they need cross-origin isolation headers on the whole site) and
  TensorFlow.js (no release since October 2024).
- **Cost.** At about 400 evaluations per move, an MLP takes 40-120 ms per move. On
  a 9×9 board convolutions cost far more than their size suggests: a
  198,000-parameter convolutional net took 2.9 ms per evaluation. Phones are
  several times slower.

## Free computers

| Where                | What you get                                                                          |
| -------------------- | ------------------------------------------------------------------------------------- |
| Your own PC          | Unlimited: step 0, step 1, a small network, self-play on every core                   |
| Kaggle Notebooks     | 2×T4 GPU (or TPU v5e-8), 12 h per session, weekly quota, unattended runs from the CLI |
| Google Colab (free)  | T4 when available, at most 12 h, stops when idle: short interactive runs only         |
| SageMaker Studio Lab | Closed to new users since July 2026 _(unverified)_                                    |

## Pitfalls

- **Rules.** A training environment with slightly different rules teaches the
  wrong game: run step 1 after every upgrade. CodinGame also differs: a game with
  no line of three goes to whoever won more small boards (a draw here), so bots
  tuned there optimise another ending.
- **Skip** alpha-zero-general and its ultimate tic-tac-toe forks (2022-era
  dependencies; forks abandoned, one ignores the forced board), OpenSpiel's C++
  LibTorch AlphaZero (source build, unmaintained) and LightZero (no ultimate
  tic-tac-toe, heavy stack). OpenSpiel's own docs lag behind its code (they still
  describe a TensorFlow AlphaZero).
- **Weaker, not stronger.** A badly trained network can make MCTS worse (one that
  pruned moves won only 30-35 % against plain MCTS). Keep MCTS as the base and let
  `npm run ai:arena` decide.

## Sources

- OpenSpiel: [repository](https://github.com/google-deepmind/open_spiel),
  [ultimate tic-tac-toe](https://github.com/google-deepmind/open_spiel/blob/master/open_spiel/games/ultimate_tic_tac_toe/ultimate_tic_tac_toe.cc),
  [rules fix f7fa522](https://github.com/google-deepmind/open_spiel/commit/f7fa522),
  [releases](https://github.com/google-deepmind/open_spiel/releases)
- Kaggle API: [kernels](https://github.com/Kaggle/kaggle-api/blob/main/docs/kernels.md),
  [kernel metadata](https://github.com/Kaggle/kaggle-api/blob/main/docs/kernels_metadata.md),
  [quota](https://github.com/Kaggle/kaggle-api/blob/main/skills/references/quota.md)
- AlphaZero.jl Connect Four:
  [tutorial](https://github.com/jonathan-laurent/AlphaZero.jl/blob/master/docs/src/tutorial/connect_four.md)
- utttai: [repository and datasets](https://github.com/ar-nowaczynski/utttai)
- onnxruntime-web: [npm](https://www.npmjs.com/package/onnxruntime-web),
  [Turbopack issue #25096](https://github.com/microsoft/onnxruntime/issues/25096),
  [wasmBinary fix #27411](https://github.com/microsoft/onnxruntime/pull/27411)
- [jax2onnx](https://github.com/enpasos/jax2onnx)
- MCTS-Solver and RAVE on this game: [lapraskwan/Ultimate-Tic-Tac-Toe](https://github.com/lapraskwan/Ultimate-Tic-Tac-Toe)
- Small self-play network on CodinGame: [arose26/napkin-100k-tictac](https://github.com/arose26/napkin-100k-tictac)
- Measurements without a link (exploration constant, solver, inference times,
  OpenSpiel rules check) were made for this guide.
