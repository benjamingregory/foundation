import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api/with-auth";
import { billingConfigured, createPortalSession } from "@/services/billing";
import type { ServiceErrorCode } from "@/services/errors";

/** Opens the hosted Stripe Customer Portal (cancel, update card, invoices). */
export const POST = withAuth(
  { name: "billing#portal", limit: "write" },
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
    return createPortalSession(userId);
  },
);
