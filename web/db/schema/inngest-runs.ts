/**
 * Inngest run ledger — one row per background-job event, written by the
 * Task 10 RunLedgerMiddleware and read by the jobs dock.
 *
 * Keyed on `eventId` (the Inngest event ULID), not `runId`. `wrapSendEvent`
 * fires before any function has picked the event up, so only the event id
 * is known at that point; a `runId`-keyed row would need a later
 * claim-and-rekey UPDATE once `onRunStart` learns the real run id, and
 * under cold-pool timing that race can insert two rows for one logical run
 * (one orphaned at "queued" forever). Keying on the stable `eventId`
 * instead lets `onRunStart` do a single upsert-on-conflict: it updates the
 * queued row if one exists, or inserts a fresh running row if not (e.g. an
 * event sent from outside this app) — never both. `runId` is filled in
 * once the run actually starts. Mirrors jobflow's `db/schema/system.ts`
 * (`inngestRuns`).
 *
 * Part of the schema barrel — see ./index.ts.
 */
import { pgTable, text, uuid, timestamp, index } from "drizzle-orm/pg-core";

export const INNGEST_RUN_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type InngestRunStatus = (typeof INNGEST_RUN_STATUSES)[number];

export const inngestRuns = pgTable(
  "inngest_runs",
  {
    /** Inngest event ULID — one ledger row per event, the stable key. */
    eventId: text("event_id").primaryKey(),
    /** Filled by onRunStart once a run claims the event; null while queued. */
    runId: text("run_id"),
    userId: uuid("user_id").notNull(),
    eventName: text("event_name").notNull(),
    status: text("status").notNull().default("queued"),
    error: text("error"),
    queuedAt: timestamp("queued_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("inngest_runs_user_status_idx").on(t.userId, t.status),
    index("inngest_runs_run_id_idx").on(t.runId),
    index("inngest_runs_updated_at_idx").on(t.updatedAt),
  ],
);

export type InngestRun = typeof inngestRuns.$inferSelect;
export type NewInngestRun = typeof inngestRuns.$inferInsert;
