import { userMutation } from "../../../account/routes";
import { queueAction } from "../../../ranked/queue";

export const dynamic = "force-dynamic";

/** Ranked search: { action: "join" | "poll" | "leave" } → QueueStatus */
export const POST = userMutation((user, _req, body) => queueAction(user, body));
