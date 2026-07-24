import "server-only";

/**
 * EntitlementsService — what a user's plan lets them do.
 *
 * Reads the `userBilling.plan` DB column directly — never a live Stripe
 * call. Stripe is the source of truth, but that projection is kept in sync
 * by services/billing.ts on every webhook event; reading the column here
 * keeps entitlement checks cheap and available even when Stripe itself is
 * unreachable, and means every route pays a single indexed lookup instead
 * of a network round trip to Stripe on every gated action.
 *
 * `billingEnforced()` is the kill switch: default off, so the Stripe
 * plumbing (this file, services/billing.ts, the checkout/portal/webhook
 * routes) can ship and bake in production before any route actually starts
 * limiting free-plan users. No caller in this skeleton branches on it yet —
 * it's here for the first gate a consuming app adds.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { BillingPlan } from "@/db/schema/billing";

export function billingEnforced(): boolean {
  const v = process.env.BILLING_ENFORCED;
  return v === "1" || v === "true";
}

/** Reads the stored `userBilling.plan` column, scoped to this user. Returns
 * "free" when the user has no billing row yet (never subscribed). */
export async function getPlan(userId: string): Promise<BillingPlan> {
  const { db, schema } = getDb();
  const [row] = await db
    .select({ plan: schema.userBilling.plan })
    .from(schema.userBilling)
    .where(eq(schema.userBilling.userId, userId))
    .limit(1);
  return row?.plan === "pro" ? "pro" : "free";
}
