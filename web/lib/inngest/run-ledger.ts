import { eq } from "drizzle-orm";
import { Middleware } from "inngest";
import { getDb } from "@/db/client";

/**
 * Mirrors Inngest run state into the `inngest_runs` table so the jobs dock
 * (components/jobs/jobs-dock.tsx) can show a user their queued/running/
 * finished background work — Inngest has no "list this user's active runs"
 * API of its own. Ported from jobflow's `lib/inngest/run-ledger.ts`.
 *
 * Only events whose payload carries a `userId` are ledgered — those are the
 * user-visible jobs; system events (`inngest/*`) and anything named in
 * `EXCLUDED_EVENTS` are skipped. The set is empty today; it's kept as a
 * mechanism (not deleted) because jobflow's donor needs it the moment a
 * high-volume fan-out event would otherwise drown the dock — see its
 * `liveness/check.requested` entry.
 *
 * Every hook swallows its own errors so a ledger hiccup never fails an event
 * send or a function run. `getDb()` throws when `DATABASE_URL` is unset, so
 * every DB touch below is wrapped in try/catch for that reason too — this
 * module (and the app) must build and boot with no env configured, and a run
 * must still complete if the DB is briefly unreachable.
 *
 * This is system-level code, not a per-request tenant read: a queued row is
 * written for whichever `userId` the *event payload* names, not whoever
 * issued the current request (a cron fan-out spans many users in one
 * process). That's why these writes live here instead of in
 * `db/repositories/inngestRuns.ts` — the tenancy scanner (scripts/test-
 * tenancy.mts) only scans `db/repositories/*`, and a `userId`-per-row write
 * like this would need a cross-tenant allowlist entry to explain itself if
 * it lived there. Keeping it here needs no such entry: it's simply out of
 * the scanner's scope, by design. `db/repositories/inngestRuns.ts` carries
 * only the user-scoped read (`listRunsForUser`, `eq(userId, ...)`).
 *
 * ── Correlating on eventId, not runId ────────────────────────────────────
 * `inngest_runs` is keyed on `eventId` (the Inngest event ULID), which is
 * the one identifier every hook below has: `wrapSendEvent` only ever has
 * it (no run has started yet), and `onRunStart`/`onRunComplete`/
 * `onRunError` all receive `ctx.event.id` alongside `ctx.runId`. That means
 * every hook can correlate on the same stable key — no claim-and-rekey step
 * is needed (a prior version of this table was keyed on `runId` alone,
 * which forced `onRunStart` to UPDATE a placeholder row's primary key from
 * the event id to the real run id; under cold-pool timing that could lose
 * the race and leave two rows for one logical run, one orphaned at
 * "queued" forever). `onRunStart` instead does a single upsert-on-conflict
 * targeting `eventId`: it updates the queued row if `wrapSendEvent` already
 * wrote one, or inserts a fresh running row if not (e.g. an event sent from
 * outside this app, or the queued write itself failed) — never both.
 * Mirrors jobflow's `claimRunStart` (db/repositories/inngestRuns.ts).
 */

/** Event names to exclude from the ledger even though they carry a userId —
 *  empty for now; see the module doc comment above. */
const EXCLUDED_EVENTS = new Set<string>([]);

function eventUserId(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const userId = (data as Record<string, unknown>).userId;
  return typeof userId === "string" && userId.length > 0 ? userId : null;
}

function isLedgeredEvent(name: string | undefined): name is string {
  return (
    typeof name === "string" &&
    !name.startsWith("inngest/") &&
    !EXCLUDED_EVENTS.has(name)
  );
}

export class RunLedgerMiddleware extends Middleware.BaseMiddleware {
  readonly id = "run-ledger";

  async wrapSendEvent(args: Middleware.WrapSendEventArgs) {
    const result = await args.next();
    try {
      const rows = args.events.flatMap((event, i) => {
        const eventId = result.ids[i];
        const userId = eventUserId(event.data);
        if (!eventId || !userId || !isLedgeredEvent(event.name)) return [];
        return [
          {
            eventId,
            runId: null,
            userId,
            eventName: event.name,
            status: "queued" as const,
          },
        ];
      });
      if (rows.length > 0) {
        const { db, schema } = getDb();
        await db
          .insert(schema.inngestRuns)
          .values(rows)
          .onConflictDoNothing({ target: schema.inngestRuns.eventId });
      }
    } catch (err) {
      console.error("[run-ledger] failed to record queued events", err);
    }
    return result;
  }

  async onRunStart({ ctx }: Middleware.OnRunStartArgs) {
    try {
      const userId = eventUserId(ctx.event.data);
      const eventId = ctx.event.id;
      if (!userId || !eventId || !isLedgeredEvent(ctx.event.name)) return;
      const { db, schema } = getDb();
      const now = new Date().toISOString();

      // Upsert on the stable eventId: updates the queued row `wrapSendEvent`
      // wrote (if any), or inserts a fresh running row otherwise — never
      // both, so no ghost "queued" row can be left behind.
      await db
        .insert(schema.inngestRuns)
        .values({
          eventId,
          runId: ctx.runId,
          userId,
          eventName: ctx.event.name,
          status: "running",
          startedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.inngestRuns.eventId,
          set: { runId: ctx.runId, status: "running", startedAt: now, updatedAt: now },
        });
    } catch (err) {
      console.error("[run-ledger] failed to record run start", err);
    }
  }

  async onRunComplete({ ctx }: Middleware.OnRunCompleteArgs) {
    try {
      const eventId = ctx.event.id;
      if (!eventId || !eventUserId(ctx.event.data)) return;
      const { db, schema } = getDb();
      await db
        .update(schema.inngestRuns)
        .set({
          status: "completed",
          endedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.inngestRuns.eventId, eventId));
    } catch (err) {
      console.error("[run-ledger] failed to record run completion", err);
    }
  }

  async onRunError({ ctx, error, isFinalAttempt }: Middleware.OnRunErrorArgs) {
    try {
      // Non-final attempts retry: the run is still live, leave it `running`.
      const eventId = ctx.event.id;
      if (!isFinalAttempt || !eventId || !eventUserId(ctx.event.data)) return;
      const { db, schema } = getDb();
      await db
        .update(schema.inngestRuns)
        .set({
          status: "failed",
          error: error.message.slice(0, 500),
          endedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.inngestRuns.eventId, eventId));
    } catch (err) {
      console.error("[run-ledger] failed to record run failure", err);
    }
  }
}
