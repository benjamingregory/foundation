import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

/**
 * A deliberately partial mirror of the product app's db/schema/{users,
 * billing,inngest-runs}.ts.
 *
 * admin is a separate pnpm root with its own lockfile — it cannot import
 * web/db/schema at runtime, so it re-declares ONLY the tables and columns
 * the admin surfaces actually read.
 *
 * The tradeoff, stated plainly: this is READ-ONLY (nothing in admin/ ever
 * writes) and it can DRIFT — a column renamed in web/db/schema compiles fine
 * here and fails at runtime. `pnpm check:drift` (scripts/check-drift.mts)
 * diffs this file's column set against web/db/schema/*.ts's actual source
 * and fails loudly on a mismatch. It only checks that every column admin
 * declares still exists in web — web columns admin doesn't mirror are fine,
 * admin only ever reads what it declares here.
 */

export const userProfiles = pgTable("user_profiles", {
  userId: uuid("user_id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export const userBilling = pgTable("user_billing", {
  userId: uuid("user_id").primaryKey(),
  plan: text("plan").notNull().default("free"),
});

/** Not yet read by any admin page — mirrored ahead of an ops/jobs view. */
export const inngestRuns = pgTable("inngest_runs", {
  eventId: text("event_id").primaryKey(),
  userId: uuid("user_id").notNull(),
  eventName: text("event_name").notNull(),
  status: text("status").notNull().default("queued"),
  queuedAt: timestamp("queued_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});
