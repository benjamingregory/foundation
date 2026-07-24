import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";

const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/auth/callback", "/api"];

export async function proxy(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next();

  const response = NextResponse.next({ request: req });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(items: Parameters<SetAllCookies>[0]) {
        for (const { name, value, options } of items) {
          req.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const isPublic =
    path === "/" ||
    PUBLIC_PREFIXES.some((p) => path.startsWith(p)) ||
    path.startsWith("/_next") ||
    path.includes(".");

  if (!user && !isPublic) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("next", path);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  // If you add a path-based analytics proxy (e.g. an /ingest rewrite in
  // next.config), you MUST exclude that path here — capture paths have no
  // dot and aren't in PUBLIC_PREFIXES, so auth would redirect anonymous
  // events to /sign-in, silently dropping them.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
