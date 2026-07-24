/**
 * checkRateLimit — per-user, per-bucket fixed-window rate limiting.
 *
 * Store: an in-process `Map`. There is no Redis/Postgres-backed limiter in
 * this skeleton, so counters live for the lifetime of one server process and
 * reset on restart. On a single-instance deployment that's the whole story;
 * on a multi-instance serverless deployment each instance keeps its own
 * counters, so the effective limit scales up with instance count. That's an
 * acceptable default for a starter — swap in a shared store (Postgres
 * upsert-and-return-count, Upstash Redis, etc.) once burst traffic across
 * instances actually matters for your deployment.
 *
 * Failure mode: this can't fail the way a DB-backed limiter can (no I/O to
 * fail), so there's no fail-open branch to reason about.
 */

/**
 * Buckets are shaped by cost, not by route: cheap reads share one bucket,
 * writes share a tighter one, so a caller can't dodge the limit by rotating
 * endpoints that do the same kind of work.
 */
export const RATE_LIMITS = {
  /** Reads — GETs. */
  default: { max: 60, windowSec: 60 },
  /** Writes — POST/PATCH/DELETE. */
  write: { max: 30, windowSec: 60 },
} as const;

export type RateLimitBucket = keyof typeof RATE_LIMITS;

export type RateLimitCheck =
  | { ok: true }
  | { ok: false; message: string; retryAfterSec: number };

type Counter = { windowStart: number; count: number };

const counters = new Map<string, Counter>();

/** Bound the map's size without a cron: sweep stale windows opportunistically. */
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweep = Date.now();

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, counter] of counters) {
    if (now - counter.windowStart > SWEEP_INTERVAL_MS) counters.delete(key);
  }
}

/**
 * Count this request against the user's bucket and report whether it may
 * proceed. Call once per request, before doing any expensive work.
 */
export function checkRateLimit(
  userId: string,
  bucket: RateLimitBucket,
): RateLimitCheck {
  const { max, windowSec } = RATE_LIMITS[bucket];
  const windowMs = windowSec * 1000;
  const now = Date.now();
  sweep(now);

  const windowStart = Math.floor(now / windowMs) * windowMs;
  const key = `${userId}:${bucket}`;

  const existing = counters.get(key);
  const count =
    existing && existing.windowStart === windowStart ? existing.count + 1 : 1;
  counters.set(key, { windowStart, count });

  if (count <= max) return { ok: true };

  const retryAfterSec = Math.max(
    1,
    Math.ceil((windowStart + windowMs - now) / 1000),
  );
  return {
    ok: false,
    retryAfterSec,
    message: `Too many requests — the limit is ${max} per ${windowSec}s. Try again in ${retryAfterSec}s.`,
  };
}
