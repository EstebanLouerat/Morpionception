import { googleEnabled } from "../../../account/google";
import type { Providers } from "../../../account/protocol";

export const dynamic = "force-dynamic";

/** Ways to log in besides pseudo and password: { google } */
export const GET = () => Response.json({ google: googleEnabled() } satisfies Providers);
