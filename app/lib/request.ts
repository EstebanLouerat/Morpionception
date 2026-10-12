// JSON calls to the app's API from the browser.

export type ApiResult<T, E extends string> =
  | { ok: true; data: T }
  | { ok: false; error: E | "network" };

/** Calls an API route; errors come back as { ok: false, error } instead of throwing */
export const request = async <T, E extends string>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
  keepalive = false
): Promise<ApiResult<T, E>> => {
  try {
    const res = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      keepalive,
    });
    const json = await res.json();
    return res.ok ? { ok: true, data: json } : { ok: false, error: json.error ?? "network" };
  } catch {
    return { ok: false, error: "network" };
  }
};
