import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { redirect } from "next/navigation";

/**
 * True when the two env vars `supabaseServer()` needs are both present.
 * Callers that can degrade gracefully (an unauthenticated response, a
 * `null` user) should check this BEFORE calling `supabaseServer()`, which
 * throws on an unset url/key — appropriate for callers with no fallback,
 * wrong for request-path code that should read as "no session" instead of
 * a 500 when Supabase simply hasn't been configured yet.
 */
export function supabaseEnvConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export async function supabaseServer() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(items: Parameters<SetAllCookies>[0]) {
        try {
          for (const { name, value, options } of items) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — safe to ignore in middleware refresh.
        }
      },
    },
  });
}

export const getOptionalUser = cache(
  async (): Promise<{ id: string; email?: string } | null> => {
    // Supabase entirely unconfigured (e.g. a skeleton checkout before env is
    // filled in): there is no session to read, full stop. Fail to "logged
    // out", not to a 500 — `supabaseServer()` would throw on the missing
    // url/key otherwise, and every page calling `requireUser()` would 500
    // instead of redirecting to /sign-in.
    if (!supabaseEnvConfigured()) return null;

    try {
      const supabase = await supabaseServer();
      // `getClaims()` verifies the JWT locally against the cached JWKS (no round
      // trip to the Auth server) when the project uses asymmetric signing keys —
      // vs. `getUser()`, which always hits `/auth/v1/user` over the network. This
      // runs on every navigation (root layout + page loaders), so the hop would
      // be pure per-request latency. Safe because `proxy.ts` still calls
      // `getUser()` on every request — that's the authoritative server check and
      // the token refresh, so revocation is caught and the cookie we read here is
      // already fresh. This is the Supabase-recommended SSR split.
      const { data } = await supabase.auth.getClaims();
      const claims = data?.claims;
      if (!claims?.sub) return null;
      return {
        id: claims.sub,
        email: typeof claims.email === "string" ? claims.email : undefined,
      };
    } catch (err) {
      // A malformed/tampered cookie can have JWT segments that are valid
      // base64url but decode to non-JSON — getClaims() throws a SyntaxError
      // in that case rather than returning an auth error in `data`/`error`.
      // Treat any failure here the same as "no session": redirect to
      // /sign-in, don't 500 the page.
      console.debug(
        "[auth] getOptionalUser: getClaims() failed, treating as unauthenticated:",
        err,
      );
      return null;
    }
  },
);

export const requireUser = cache(
  async (): Promise<{ id: string; email?: string }> => {
    const user = await getOptionalUser();
    if (!user) redirect("/sign-in");
    return user;
  },
);
