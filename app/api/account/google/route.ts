import { NextResponse, type NextRequest } from "next/server";
import { googleEnabled, publicOrigin, setFlowCookie, startGoogle } from "../../../account/google";
import { sameSitePath } from "../../../account/returnPath";

export const dynamic = "force-dynamic";

/** Starts a log-in with Google (?mode=link adds Google to the logged-in account;
 * ?retour=/page comes back there): sends the browser to Google */
export function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const origin = publicOrigin(req);
  if (!googleEnabled()) return NextResponse.redirect(`${origin}/compte?google=indisponible`);
  const mode = params.get("mode") === "link" ? "link" : "login";
  const { url, flow } = startGoogle(req, mode, sameSitePath(params.get("retour"), origin));
  const res = NextResponse.redirect(url);
  setFlowCookie(res, req, flow);
  return res;
}
