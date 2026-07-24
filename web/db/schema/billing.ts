/**
 * Stripe billing state and the processed-event ledger.
 *
 * One row per user in `userBilling`. Written only by the Task 11 billing
 * service (checkout-session creation + webhook sync) — never through a
 * user-editable path, so `plan`/`status` can't be set from the client.
 * Stripe is the source of truth; this row is a synced projection of it.
 *
 * `stripeEvents` is a webhook idempotency ledger, not user-scoped: Stripe
 * retries deliveries, and a second delivery of an already-recorded event id
 * is acknowledged and skipped.
 *
 * Part of the schema barrel — see ./index.ts.
 */
import { sql } from "drizzle-orm";
import { pgTable, uuid, text, timestamp, check } from "drizzle-orm/pg-core";

export const BILLING_PLANS = ["free", "pro"] as const;
export type BillingPlan = (typeof BILLING_PLANS)[number];

export const userBilling = pgTable(
  "user_billing",
  {
    userId: uuid("user_id").primaryKey(),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    plan: text("plan").notNull().default("free"),
    // Stripe subscription status verbatim (active | trialing | past_due |
    // canceled | …). `plan` is derived from it on every webhook sync.
    status: text("status"),
    currentPeriodEnd: timestamp("current_period_end", {
      withTimezone: true,
      mode: "string",
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("user_billing_plan_check", sql`${t.plan} IN ('free','pro')`)],
);

export type UserBilling = typeof userBilling.$inferSelect;
export type NewUserBilling = typeof userBilling.$inferInsert;

export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export type StripeEvent = typeof stripeEvents.$inferSelect;
export type NewStripeEvent = typeof stripeEvents.$inferInsert;
