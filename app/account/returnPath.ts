// Where to go back after logging in (?retour=…), shared by the pages and the server.

/** A path of this site, null otherwise. The value is resolved like the browser would
 * ("/\t/evil.example" is another site once the tab is dropped), and refused if it
 * lands anywhere else. */
export const sameSitePath = (raw: string | null, origin: string) => {
  if (!raw || !raw.startsWith("/") || /[\u0000-\u001F\u007F\\]/.test(raw)) return null;
  try {
    const url = new URL(raw, origin);
    return url.origin === origin ? url.pathname + url.search + url.hash : null;
  } catch {
    return null;
  }
};
