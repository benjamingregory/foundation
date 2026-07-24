import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseEnvConfigured, supabaseServer } from "./server";

export type AuthOk = { ok: true; userId: string };
export type AuthErr = { ok: false; response: NextResponse };

/**
 * Constant-time compare for the agent token. Length is compared first because
 * timingSafeEqual throws on a length mismatch; length leaks, the bytes do not.
 */
function tokenMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function unauthenticated(message: string): AuthErr {
  return {
    ok: false,
    response: NextResponse.json(
      { error: { code: "UNAUTHORIZED", message } },
      { status: 401 },
    ),
  };
}

/**
 * Authenticate an API request. Three accepted modes:
 *
 * 1. `Authorization: Bearer <AGENT_API_TOKEN>` — the agent/automation token.
 *    Targets the user identified by `AGENT_USER_ID` in env. Used by
 *    background scripts, curl smoke-tests, and the agent.
 * 2. `Authorization: Bearer <jwt>` — a Supabase user-session JWT. The userId
 *    is extracted from the verified token.
 * 3. Cookie session (no `Authorization` header) — set by `@supabase/ssr` on
 *    sign-in. Used by the in-app UI.
 *
 * This deliberately does NOT accept `SUPABASE_SECRET_KEY` as a credential.
 * That key is the Supabase service-role credential: it carries BYPASSRLS and
 * full admin access to auth and storage. Accepting it here would make one
 * leaked value simultaneously a database master key and a logged-in session
 * on every API route, and would give every operator running a curl
 * smoke-test a reason to paste the database master key into a shell.
 * AGENT_API_TOKEN grants exactly one thing — API access as AGENT_USER_ID —
 * and can be rotated without touching the database.
 *
 * Both env vars fail closed: unset AGENT_API_TOKEN means mode 1 is simply
 * unavailable and the request falls through to JWT verification (401), rather
 * than any request being treated as authenticated.
 */
export async function authenticate(
  req: NextRequest,
): Promise<AuthOk | AuthErr> {
  const auth = req.headers.get("authorization");

  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    const agentToken = process.env.AGENT_API_TOKEN;
    if (agentToken && token.length > 0 && tokenMatches(token, agentToken)) {
      const userId = process.env.AGENT_USER_ID;
      if (!userId || userId === "00000000-0000-0000-0000-000000000000") {
        return {
          ok: false,
          response: NextResponse.json(
            {
              error: {
                code: "INTERNAL",
                message: "AGENT_USER_ID not set on the server",
              },
            },
            { status: 500 },
          ),
        };
      }
      return { ok: true, userId };
    }
    // The token wasn't the agent token, so it can only be a Supabase JWT —
    // which needs Supabase configured to verify. Check BEFORE constructing
    // the client: `supabaseServer()` throws on an unset url/key, and an
    // uncaught throw here would 500 the request instead of reporting the
    // (accurate) 401.
    if (!supabaseEnvConfigured()) return unauthenticated("invalid bearer token");
    const supabase = await supabaseServer();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) return unauthenticated("invalid bearer token");
    return { ok: true, userId: user.id };
  }

  // No Authorization header: this is the cookie/session path, which also
  // needs Supabase configured. Same fail-closed-to-401 reasoning as above.
  if (!supabaseEnvConfigured()) return unauthenticated("unauthenticated");
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthenticated("unauthenticated");
  return { ok: true, userId: user.id };
}
