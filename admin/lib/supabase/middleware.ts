import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedAdminEmail } from "@/lib/auth-config";

/** Paths reachable without a session. Everything else is gated. */
const PUBLIC_PATHS = ["/login"];

/**
 * Segment-aware match: `/login` matches `/login` and `/login/anything`, but
 * not `/login-history` or `/loginx`. A plain `startsWith` would treat those
 * as public too.
 */
function isPublicPath(pathname: string, publicPaths: string[]): boolean {
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const { pathname } = request.nextUrl;
  const isPublic = isPublicPath(pathname, PUBLIC_PATHS);

  // Supabase unconfigured: there is no session to check. Let /login through
  // and send everything else there too, rather than 500ing on a missing env
  // var — same fail-closed posture as lib/auth-config.ts.
  if (!url || !key) {
    if (isPublic) return NextResponse.next({ request });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items: Parameters<SetAllCookies>[0]) => {
        for (const { name, value } of items) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of items) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() revalidates the JWT against Supabase — do not swap this for
  // getSession(), which trusts the cookie without verifying it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isPublic) return response;

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (!isAllowedAdminEmail(user.email)) {
    // Authenticated but not an operator — kill the session outright rather
    // than leaving a valid-but-denied cookie sitting on a rejected browser.
    await supabase.auth.signOut();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("error", "not_allowed");
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
