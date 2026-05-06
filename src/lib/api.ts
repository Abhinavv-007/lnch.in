/**
 * Tiny fetch wrapper used by the LaunchOps client.
 *
 * - All ops/admin calls go through Cloudflare Pages Functions under /api/*.
 * - 401 responses redirect to /ops/login (the session cookie is HttpOnly so we
 *   can't introspect it client-side; fail-on-401 is the cleanest signal).
 */
export class ApiError extends Error {
  constructor(public status: number, public payload: unknown, message: string) {
    super(message);
  }
}

async function request<T>(
  method: "GET" | "POST" | "DELETE" | "PATCH",
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...init,
  });

  let payload: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!res.ok) {
    const message =
      (payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: string }).error
        : null) || `Request failed with ${res.status}`;
    if (res.status === 401 && !path.startsWith("/api/auth/")) {
      // The cookie is invalid or missing — bounce to login but don't loop.
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/ops/login")) {
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.assign(`/ops/login?next=${next}`);
      }
    }
    throw new ApiError(res.status, payload, message);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) => request<T>("GET", path, undefined, init),
  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>("POST", path, body, init),
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>("PATCH", path, body, init),
  del: <T>(path: string, init?: RequestInit) => request<T>("DELETE", path, undefined, init),
};
