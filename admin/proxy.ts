import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16 renamed middleware.ts -> proxy.ts. Runs at the edge on every
// non-static request — this is the FIRST of the two gate layers (the second
// is lib/require-admin.ts, called from every page for defense in depth).
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
