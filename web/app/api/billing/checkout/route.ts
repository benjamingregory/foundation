import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { billingConfigured, createCheckoutSession } from "@/services/billing";
import type { ServiceErrorCode } from "@/services/errors";

/**
 * Starts a hosted Stripe Checkout session for the one subscription plan
 * this skeleton has. No request body — there's nothing to choose between.
 */
export const POST = withAuth(
  { name: "billing#checkout", limit: "write" },
  async ({ userId }) => {
    if (!billingConfigured()) {
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
    return createCheckoutSession(userId);
  },
);
