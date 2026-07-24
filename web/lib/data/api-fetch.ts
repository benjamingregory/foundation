"use client";

import { toast } from "sonner";

/**
 * Error thrown by {@link apiFetch} when the API responds with a non-OK
 * status (or the request never reached the server). The failure has
 * already been surfaced to the user as a toast by the time this is thrown;
 * callers typically just need to stop their happy path (`catch { return }`).
 */
export class ApiError extends Error {
  /** HTTP status code, or 0 for a network-level failure. */
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/**
 * Pull a human-readable message out of a failed response body.
 *
 * Matches the `{ error: { code, message } }` envelope `withAuth` returns
 * (see lib/api/with-auth.ts), with a bare `{ error: string }` fallback for
 * any route that hasn't been wired through that wrapper.
 */
async function extractMessage(res: Response): Promise<string> {
  try {
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const data = (await res.json()) as
        | { error?: { message?: unknown } | string }
        | null;
      const err = data?.error;
      const candidate =
        typeof err === "string"
          ? err
          : typeof err?.message === "string"
            ? err.message
            : undefined;
      if (candidate && candidate.trim()) return candidate.trim();
    } else {
      const text = (await res.text()).trim();
      if (text) return text.slice(0, 300);
    }
  } catch {
    // Unparseable body — fall through to the status line.
  }
  return res.statusText
    ? `${res.status} ${res.statusText}`
    : `Request failed (${res.status})`;
}

type ApiFetchOptions = {
  /** Toast title shown on failure. Defaults to "Something went wrong". */
  errorTitle?: string;
};

/**
 * `fetch` wrapper for calls to our own API. Any non-OK response (4xx/5xx)
 * is surfaced as a `toast.error` carrying the server's error message, then
 * thrown as an {@link ApiError}. Network-level failures are toasted too.
 *
 * On success the raw `Response` is returned so callers can read JSON, text,
 * a stream, or a blob as they need. For the common JSON case use
 * {@link apiJson}.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: ApiFetchOptions,
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Network request failed";
    // Errors stay until dismissed — a 3.5s default can vanish before the
    // user looks at the corner (the global Toaster renders a close button).
    toast.error(opts?.errorTitle ?? "Something went wrong", {
      description: message,
      duration: Infinity,
    });
    throw new ApiError(message, 0);
  }

  if (!res.ok) {
    const message = await extractMessage(res);
    toast.error(opts?.errorTitle ?? "Something went wrong", {
      description: message,
      duration: Infinity,
    });
    throw new ApiError(message, res.status);
  }

  return res;
}

/** {@link apiFetch} that parses and returns the JSON body on success. */
export async function apiJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
  opts?: ApiFetchOptions,
): Promise<T> {
  const res = await apiFetch(input, init, opts);
  return (await res.json()) as T;
}
