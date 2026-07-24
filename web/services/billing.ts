import "server-only";

/**
 * BillingService — Stripe integration for the single flat "pro" plan.
 *
 * Stripe is the source of truth for subscription state; `userBilling` is a
 * synced projection of it, written here and nowhere else (never through a
 * user-editable path — see db/schema/billing.ts). Three surfaces:
 *
 * - Checkout / Customer Portal session creation, called by
 *   app/api/billing/{checkout,portal}/route.ts
 * - Webhook event handling, called by app/api/webhooks/stripe/route.ts —
 *   idempotent via the `stripeEvents` ledger, and re-fetches the
 *   subscription from Stripe on every event so an out-of-order delivery
 *   can't regress the projection (see syncSubscription)
 * - `billingConfigured()` — the whole surface no-ops to 503 when
 *   STRIPE_SECRET_KEY is unset, so the plumbing ships and boots cleanly on
 *   any deployment that hasn't wired up Stripe yet
 *
 * Entitlement reads (getPlan) live in services/entitlements.ts and read the
 * `userBilling.plan` DB column, never Stripe directly — see that file.
 *
 * DB access placement: this file talks to Postgres directly via `getDb()`
 * rather than through db/repositories/, on purpose. The webhook resolves a
 * user from a Stripe customer id with no request-scoped userId to filter
 * by, which is exactly the shape scripts/test-tenancy.mts flags as unsafe
 * for db/repositories/*.ts. Keeping billing's DB access in services/ keeps
 * that scanner meaningful for the tables it does cover. The one place a
 * specific user's row is read or written (updateSubscription, and
 * entitlements.ts's getPlan), the query carries
 * `eq(userBilling.userId, userId)`.
 */

import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { getUserProfile } from "@/db/repositories/userProfiles";
import type { BillingPlan, UserBilling } from "@/db/schema/billing";

let stripeSingleton: Stripe | null = null;

export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!stripeSingleton) stripeSingleton = new Stripe(key);
  return stripeSingleton;
}

function appBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}

function priceId(): string {
  const id = process.env.STRIPE_PRICE_PRO_MONTHLY;
  if (!id) throw new Error("STRIPE_PRICE_PRO_MONTHLY is not set");
  return id;
}

// ── DB access ────────────────────────────────────────────────────────────

/** Insert the user's `userBilling` row if one doesn't exist yet. Primary-
 * keyed on `userId`, so — like `ensureUserProfile` — there's no separate
 * where-clause to carry a tenancy predicate: the insert can only ever
 * create a row for the caller's own id. */
async function ensureBillingRow(userId: string): Promise<UserBilling> {
  const { db, schema } = getDb();
  const inserted = await db
    .insert(schema.userBilling)
    .values({ userId })
    .onConflictDoNothing({ target: schema.userBilling.userId })
    .returning();
  if (inserted[0]) return inserted[0];

  const [row] = await db
    .select()
    .from(schema.userBilling)
    .where(eq(schema.userBilling.userId, userId))
    .limit(1);
  if (!row) {
    throw new Error(`userBilling row missing after ensure for user ${userId}`);
  }
  return row;
}

/** Reverse lookup used by the webhook, which only ever has a Stripe
 * customer id to go on — never a request-scoped userId. */
async function getBillingByCustomerId(
  customerId: string,
): Promise<UserBilling | null> {
  const { db, schema } = getDb();
  const [row] = await db
    .select()
    .from(schema.userBilling)
    .where(eq(schema.userBilling.stripeCustomerId, customerId))
    .limit(1);
  return row ?? null;
}

async function setStripeCustomerId(
  userId: string,
  customerId: string,
): Promise<void> {
  const { db, schema } = getDb();
  await db
    .update(schema.userBilling)
    .set({ stripeCustomerId: customerId, updatedAt: new Date().toISOString() })
    .where(eq(schema.userBilling.userId, userId));
}

type SubscriptionPatch = {
  stripeSubscriptionId: string;
  plan: BillingPlan;
  status: string;
  currentPeriodEnd: string | null;
};

async function updateSubscription(
  userId: string,
  patch: SubscriptionPatch,
): Promise<void> {
  const { db, schema } = getDb();
  await db
    .update(schema.userBilling)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(schema.userBilling.userId, userId));
}

/** Insert-or-skip into the webhook idempotency ledger. Returns `false` when
 * the row already existed — i.e. this event id was already processed and
 * the caller should stop. */
async function recordStripeEventIfNew(id: string, type: string): Promise<boolean> {
  const { db, schema } = getDb();
  const inserted = await db
    .insert(schema.stripeEvents)
    .values({ id, type })
    .onConflictDoNothing({ target: schema.stripeEvents.id })
    .returning({ id: schema.stripeEvents.id });
  return inserted.length > 0;
}

/** Releases a ledger entry after a failed handler run, so Stripe's retry of
 * that delivery gets reprocessed instead of silently skipped as a
 * duplicate. Called from handleStripeEvent's catch branch only. */
async function deleteStripeEvent(id: string): Promise<void> {
  const { db, schema } = getDb();
  await db.delete(schema.stripeEvents).where(eq(schema.stripeEvents.id, id));
}

// ── Checkout / Portal ────────────────────────────────────────────────────

/**
 * Resolve (or create) the Stripe customer for a user and persist the
 * mapping before returning — the webhook resolves users by customer id, so
 * the row must exist before any Stripe object can reference the customer.
 */
export async function getOrCreateStripeCustomer(userId: string): Promise<string> {
  const row = await ensureBillingRow(userId);
  if (row.stripeCustomerId) return row.stripeCustomerId;

  const profile = await getUserProfile(userId);
  const customer = await getStripe().customers.create({
    email: profile?.email,
    name: profile?.displayName ?? undefined,
    metadata: { userId },
  });
  await setStripeCustomerId(userId, customer.id);
  return customer.id;
}

/** Hosted Checkout for the one subscription plan this skeleton has. */
export async function createCheckoutSession(
  userId: string,
): Promise<{ url: string }> {
  const customerId = await getOrCreateStripeCustomer(userId);
  const base = appBaseUrl();

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId(), quantity: 1 }],
    client_reference_id: userId,
    // Belt-and-suspenders alongside the customer<->user row set above: if a
    // subscription webhook ever arrives for a customer id that hasn't hit
    // the DB yet, syncSubscription can still resolve the user from here.
    subscription_data: { metadata: { userId } },
    allow_promotion_codes: true,
    success_url: `${base}/settings/billing?checkout=success`,
    cancel_url: `${base}/settings/billing?checkout=cancelled`,
  });
  if (!session.url) {
    throw new Error("Stripe returned a checkout session without a URL");
  }
  return { url: session.url };
}

/** Hosted Customer Portal (cancel, update card, view invoices). */
export async function createPortalSession(
  userId: string,
): Promise<{ url: string }> {
  const customerId = await getOrCreateStripeCustomer(userId);
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appBaseUrl()}/settings/billing`,
  });
  return { url: session.url };
}

// ── Webhook ──────────────────────────────────────────────────────────────

/** Stripe subscription statuses that keep pro entitlements. `past_due` is
 * included as the dunning grace period — Smart Retries run for days before
 * a subscription flips to `canceled`/`unpaid`. */
const ENTITLED_STATUSES = new Set<string>(["active", "trialing", "past_due"]);

function patchFromSubscription(sub: Stripe.Subscription): SubscriptionPatch {
  // Stripe API 2025+ moved current_period_end onto the subscription item.
  const item = sub.items.data[0];
  return {
    stripeSubscriptionId: sub.id,
    plan: ENTITLED_STATUSES.has(sub.status) ? "pro" : "free",
    status: sub.status,
    currentPeriodEnd: item?.current_period_end
      ? new Date(item.current_period_end * 1000).toISOString()
      : null,
  };
}

/**
 * Re-fetch a subscription from Stripe and overwrite the user's projection.
 * Fetching fresh (rather than trusting the event payload) makes delivery
 * order irrelevant — whichever event lands last still reads current Stripe
 * state, so an out-of-order redelivery can't regress the row.
 *
 * Accepts either a subscription id (from a subscription event) or a
 * customer id (for event shapes that only carry the customer, like
 * `invoice.payment_failed`) — it looks up the customer's current
 * subscription in that case.
 */
export async function syncSubscription(
  subscriptionOrCustomerId: string,
): Promise<void> {
  const stripe = getStripe();
  const sub = subscriptionOrCustomerId.startsWith("cus_")
    ? (
        await stripe.subscriptions.list({
          customer: subscriptionOrCustomerId,
          limit: 1,
        })
      ).data[0]
    : await stripe.subscriptions.retrieve(subscriptionOrCustomerId);

  if (!sub) return; // Customer has no subscription — nothing to project.

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const row = await getBillingByCustomerId(customerId);
  const userId = row?.userId ?? sub.metadata.userId;
  if (!userId) {
    console.error(
      `[billing] subscription ${sub.id} for unknown customer ${customerId} — no userBilling row and no userId metadata`,
    );
    return;
  }
  if (!row) await setStripeCustomerId(userId, customerId);
  await updateSubscription(userId, patchFromSubscription(sub));
}

/** Verify a webhook delivery's signature and parse the event. Throws on a
 * bad signature — the route maps that to a 400. */
export function verifyWebhook(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return getStripe().webhooks.constructEvent(rawBody, signature, secret);
}

async function processStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        await syncSubscription(subId);
      }
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object.id);
      return;

    case "invoice.payment_failed":
      // Entitlement change (past_due -> grace, then canceled) arrives via
      // customer.subscription.updated; this event is observability only.
      console.warn(
        `[billing] invoice payment failed for customer ${event.data.object.customer}`,
      );
      return;

    default:
      // Ledger already recorded this event id above, so an unrecognized
      // type is acknowledged and won't be redelivered — there's just
      // nothing to project for it.
      return;
  }
}

/**
 * Idempotent webhook entry point. Each Stripe event id is recorded in the
 * `stripeEvents` ledger exactly once; a redelivered event (Stripe retries
 * on anything but a 2xx, and can also send genuine duplicates) is
 * acknowledged and skipped without re-running side effects.
 */
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  const isNew = await recordStripeEventIfNew(event.id, event.type);
  if (!isNew) return; // Already processed.

  try {
    await processStripeEvent(event);
  } catch (err) {
    await deleteStripeEvent(event.id).catch(() => {});
    throw err;
  }
}
