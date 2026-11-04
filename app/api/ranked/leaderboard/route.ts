import { respond } from "../../../lib/api";
import { leaderboard } from "../../../ranked/leaderboard";

export const dynamic = "force-dynamic";

/** The best ranked players: { players, activeDays } */
export const GET = () => respond(() => leaderboard());
