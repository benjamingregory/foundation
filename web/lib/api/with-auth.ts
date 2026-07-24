import "server-only";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";
import { authenticate } from "@/lib/auth/api";
import { isServiceError } from "@/services/errors";
import { checkRateLimit, type RateLimitBucket } from "@/services/rateLimit";

/**
 * The one place a route's cross-cutting concerns live: authentication, body
 * validation, rate limiting, and the error envelope.
 *
 *   export const POST = withAuth(
 *     { body: CreateItemSchema, limit: "write" },
 *     async ({ userId, body }) => { ... },
 *   );
 *
 * A route with no body and no rate limit can skip the config object:
 *
 *   export const GET = withAuth(async ({ userId }) => { ... });
 *
 * Adding a gate to a route is a line of config rather than a line of code in
 * the route — the next route someone adds gets auth + validation + the typed
 * error envelope by default, instead of by remembering to write them.
 */

export type WithAuthConfig<B> = {
  /** Route identifier, used in error logs. Defaults to the request path. */
  name?: string;
  /** Zod schema for the JSON body. Omit for routes that take no body. */
  body?: ZodType<B>;
  /** Rate-limit bucket. Omit for routes with no rate limit. */
  limit?: RateLimitBucket;
};

export type RouteContext<B, P> = {
  req: NextRequest;
  userId: string;
  body: B;
  params: P;
};

type Handler<B, P> = (
  ctx: RouteContext<B, P>,
) => Promise<Response | unknown> | Response | unknown;

/** Next 16 passes dynamic segments as a promise. */
type Segment<P> = { params: Promise<P> };

type RouteHandlerFn<P> = (
  req: NextRequest,
  segment?: Segment<P>,
) => Promise<Response>;

/**
 * Map a thrown value to a response. `ServiceError`s carry a code and a
 * message written for the caller, so they pass straight through as the typed
 * envelope. Everything else is a bug or an infrastructure failure: the
 * client gets a generic message plus a reference it can quote, and the real
 * error goes to the server log under that reference — never straight into a
 * 500 body (which is how a Drizzle failure would otherwise hand a caller a
 * raw SQL fragment).
 */
function toErrorResponse(err: unknown, name: string): NextResponse {
  if (isServiceError(err)) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status },
    );
  }
  const ref = randomUUID().slice(0, 8);
  console.error(`[${name}] unhandled error ref=${ref}:`, err);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL",
        message: `Something went wrong on our end. (ref: ${ref})`,
      },
    },
    { status: 500 },
  );
}

export function withAuth<P = Record<string, never>>(
  handler: Handler<undefined, P>,
): RouteHandlerFn<P>;
export function withAuth<B, P = Record<string, never>>(
  config: WithAuthConfig<B>,
  handler: Handler<B, P>,
): RouteHandlerFn<P>;
export function withAuth<B, P>(
  configOrHandler: WithAuthConfig<B> | Handler<B, P>,
  maybeHandler?: Handler<B, P>,
): RouteHandlerFn<P> {
  const config: WithAuthConfig<B> =
    typeof configOrHandler === "function" ? {} : configOrHandler;
  const handler: Handler<B, P> =
    typeof configOrHandler === "function" ? configOrHandler : maybeHandler!;

  return async function route(
    req: NextRequest,
    segment?: Segment<P>,
  ): Promise<Response> {
    const name = config.name ?? new URL(req.url).pathname;

    const auth = await authenticate(req);
    if (!auth.ok) return auth.response;
    const { userId } = auth;

    // Cheapest check first, so a flood is turned away before any other work.
    if (config.limit) {
      const limit = checkRateLimit(userId, config.limit);
      if (!limit.ok) {
        return NextResponse.json(
          { error: { code: "RATE_LIMITED", message: limit.message } },
          {
            status: 429,
            headers: { "retry-after": String(limit.retryAfterSec) },
          },
        );
      }
    }

    let body: B = undefined as B;
    if (config.body) {
      let raw: unknown;
      try {
        raw = await req.json();
      } catch {
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: "Request body must be valid JSON.",
            },
          },
          { status: 400 },
        );
      }
      const parsed = config.body.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        const path = issue?.path.join(".");
        return NextResponse.json(
          {
            error: {
              code: "BAD_REQUEST",
              message: path
                ? `${path}: ${issue.message}`
                : (issue?.message ?? "Invalid request body."),
            },
          },
          { status: 400 },
        );
      }
      body = parsed.data;
    }

    const params = ((await segment?.params) ?? {}) as P;

    try {
      const result = await handler({ req, userId, body, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return toErrorResponse(err, name);
    }
  };
}
