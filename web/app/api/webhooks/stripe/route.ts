import { NextRequest, NextResponse } from "next/server";
import {
  billingConfigured,
  handleStripeEvent,
  verifyWebhook,
} from "@/services/billing";
import type { ServiceErrorCode } from "@/services/errors";

/**
 * Stripe webhook receiver. Deliberately not behind `withAuth` — Stripe's
 * signature (verified against STRIPE_WEBHOOK_SECRET) is the authentication
 * here, not a user session. The raw body must be read before any JSON
 * parsing, or the signature check never matches what Stripe actually
 * signed over the wire.
 *
 * Register in Stripe as `<deployment>/api/webhooks/stripe` with events:
 * checkout.session.completed, customer.subscription.created/updated/deleted,
 * invoice.payment_failed.
 *
 * No `force-dynamic` — a POST handler is already dynamic; the export would
 * be redundant (see CLAUDE.md's Next.js performance conventions).
 */
export async function POST(req: NextRequest) {
  if (!billingConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE" satisfies ServiceErrorCode,
          message: "Billing is not configured on this deployment.",
        },
      },
      { status: 503 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      {
        error: {
          code: "BAD_REQUEST",
          message: "Missing stripe-signature header.",
        },
      },
      { status: 400 },
    );
  }

  const rawBody = await req.text();
  let event;
  try {
    event = verifyWebhook(rawBody, signature);
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid webhook signature." } },
      { status: 400 },
    );
  }

  try {
    await handleStripeEvent(event);
    return NextResponse.json({ received: true });
  } catch (err) {
    // A 5xx makes Stripe retry the delivery. handleStripeEvent releases the
    // ledger entry on failure (services/billing.ts), so the retry gets
    // reprocessed instead of being skipped as an already-seen duplicate.
    console.error(`[stripe-webhook] ${event.type} failed:`, err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Webhook handler failed." } },
      { status: 500 },
    );
  }
}
