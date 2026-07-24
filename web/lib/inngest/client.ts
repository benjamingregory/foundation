import { Inngest, eventType, staticSchema } from "inngest";
import { RunLedgerMiddleware } from "./run-ledger";

/**
 * Fired exactly once per user by `ensureProfile()` (lib/data/ensure-
 * profile.ts) when `ensureUserProfile` (Task 5) actually creates a new
 * profile row. Consumed by the welcome function (lib/inngest/functions/
 * welcome.ts), which sends the Task 9 welcome email.
 *
 * Ported from jobflow's `lib/inngest/client.ts` — same `eventType()` +
 * `staticSchema()` pattern, trimmed to the one event this skeleton needs.
 */
export const userSignedUp = eventType("user/signed-up", {
  schema: staticSchema<{ userId: string; email: string }>(),
});

export const inngest = new Inngest({
  id: "foundation",
  // Mirrors sends + run lifecycle into the inngest_runs table so the
  // background-jobs dock (components/jobs/jobs-dock.tsx) can show a user
  // their queued/running/finished work — see run-ledger.ts.
  //
  // `middleware` takes classes, not instances (`Middleware.Class = new
  // (args: { client }) => BaseMiddleware`) — Inngest instantiates a fresh
  // one per request itself. Pass `RunLedgerMiddleware` here, never `new
  // RunLedgerMiddleware()`.
  middleware: [RunLedgerMiddleware],
});
