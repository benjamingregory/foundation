import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { isAllowedAdminEmail } from "@/lib/auth-config";

/**
 * True when the two env vars `supabaseServer()` needs are both present.
 * Request-path callers should check this BEFORE calling `supabaseServer()`,
 * which otherwise throws on an unset url/key — the right behavior for a
 * caller with no fallback, wrong for a page guard that should read as "no
 * session" (redirect to /login) instead of a 500 when Supabase simply hasn't
 * been configured on this deploy yet.
 */
export function supabaseEnvConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export async function supabaseServer() {
  // cookies() first: it's what marks a route dynamic. Calling it before the
  // env check means `next build`'s page-data-collection bails out of static
  // rendering right here, before ever reaching a throw on a missing env var
  // — same ordering as the product app's lib/auth/server.ts, and why
  // `pnpm build` doesn't need DATABASE_URL or Supabase configured.
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
      getAll: () => cookieStore.getAll(),
      setAll: (items: Parameters<SetAllCookies>[0]) => {
        try {
          for (const { name, value, options } of items) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — proxy.ts refreshes the session
          // on every request, so this is safe to swallow.
        }
      },
    },
  });
}

export type Admin = { id: string; email: string };

/**
 * The signed-in, domain-allowed operator, or null. Deduped per request.
 * Combines the Supabase session check with the ADMIN_EMAIL_DOMAIN gate in
 * one place so every caller (layout display, page guards) applies the same
 * rule.
 */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  if (!supabaseEnvConfigured()) return null;
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email || !isAllowedAdminEmail(user.email)) return null;
  return { id: user.id, email: user.email };
});
