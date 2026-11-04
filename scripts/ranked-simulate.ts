// Shows what the ranked settings in app/ranked/config.ts give.
//   npm run ranked:simulate -- [players] [games per player]
// 1. Points won or lost per game while the funnel narrows.
// 2. A simulated population: players of various strengths play ranked games against
//    opponents of similar rating; where they end up on the ladder.
import { PLACEMENT_GAMES, RATING, TIERS } from "../app/ranked/config";
import { newRating, rankOf, rateGame, type Rating } from "../app/ranked/rating";

const players = Number(process.argv[2] ?? 300);
const gamesEach = Number(process.argv[3] ?? 60);
const now = Date.now();

// --- 1. The funnel ---
console.log("Points per game for a new player, against an opponent of the same rating:");
console.log("  game   win    loss   (uncertainty)");
let me: Rating = newRating();
for (let game = 1; game <= 30; game++) {
  // The opponent: a settled player, or another newcomer for the very first game
  const opponent: Rating =
    game === 1
      ? newRating()
      : { rating: me.rating, deviation: RATING.settledDeviation, games: 50, lastPlayedAt: now };
  const win = rateGame(me, opponent, 1, now).a;
  const loss = rateGame(me, opponent, 0, now).a;
  if (game <= 10 || game % 5 === 0)
    console.log(
      `  ${String(game).padStart(4)}   +${Math.round(win.rating - me.rating)}`.padEnd(15) +
        `${Math.round(loss.rating - me.rating)}`.padEnd(7) +
        `(${Math.round(me.deviation)})`
    );
  // Alternate wins and losses so the rating stays put while the funnel narrows
  me = { ...(game % 2 ? win : loss), rating: me.rating };
}

// --- 2. A population ---
// Strength on the rating scale: a player 200 points stronger wins 3 games in 4
const randomNormal = () => {
  const u = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
};
const DRAW_RATE = 0.1;
type Player = { strength: number; rating: Rating };
const population: Player[] = Array.from({ length: players }, () => ({
  strength: RATING.start + 220 * randomNormal(),
  rating: newRating(),
}));

for (let round = 0; round < gamesEach; round++) {
  // Matchmaking: players of close ratings meet (with some randomness, like a queue)
  const order = [...population].sort(
    (a, b) => a.rating.rating + 60 * randomNormal() - (b.rating.rating + 60 * randomNormal())
  );
  for (let i = 0; i + 1 < order.length; i += 2) {
    const [a, b] = [order[i], order[i + 1]];
    const chanceA = 1 / (1 + Math.pow(10, (b.strength - a.strength) / 400));
    const r = Math.random();
    const scoreA = r < DRAW_RATE ? 0.5 : r < DRAW_RATE + (1 - DRAW_RATE) * chanceA ? 1 : 0;
    const rated = rateGame(a.rating, b.rating, scoreA, now);
    a.rating = rated.a;
    b.rating = rated.b;
  }
}

console.log(
  `\n${players} players of various strengths, ${gamesEach} ranked games each ` +
    `(placement: ${PLACEMENT_GAMES} games):`
);
const counts = new Map<string, number>();
for (const p of population) {
  const tier = rankOf(p.rating.rating, p.rating.games).tier.name;
  counts.set(tier, (counts.get(tier) ?? 0) + 1);
}
for (const tier of TIERS) {
  const n = counts.get(tier.name) ?? 0;
  const share = (n / players) * 100;
  console.log(
    `  ${tier.name.padEnd(20)} from ${String(tier.from).padStart(4)}  ` +
      `${share.toFixed(1).padStart(5)} %  ${"█".repeat(Math.round(share / 2))}`
  );
}
const sorted = population.map((p) => p.rating.rating).sort((a, b) => b - a);
console.log(
  `  best ${Math.round(sorted[0])}, 10th ${Math.round(sorted[Math.min(9, sorted.length - 1)])}, ` +
    `median ${Math.round(sorted[Math.floor(sorted.length / 2)])}, worst ${Math.round(sorted[sorted.length - 1])}`
);
const error =
  population.reduce((sum, p) => sum + Math.abs(p.rating.rating - p.strength), 0) / players;
console.log(`  average gap between rating and real strength: ${Math.round(error)} points`);
