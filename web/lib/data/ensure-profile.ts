import "server-only";
import { ensureUserProfile } from "@/db/repositories/userProfiles";
import { inngest } from "@/lib/inngest/client";

/**
 * Called from `(main)/layout.tsx` right after `requireUser()`. Creates the
 * user's profile row on first sight (`ensureUserProfile` is primary-keyed
 * on `userId`, so this insert is idempotent — see db/repositories/
 * userProfiles.ts) and, only when that insert actually landed a new row,
 * fires `user/signed-up` exactly once: every later call for the same user
 * (every subsequent sign-in) sees `created: false` and no-ops. The welcome
 * function (lib/inngest/functions/welcome.ts) is the event's only consumer
 * today.
 */
export async function ensureProfile(userId: string, email: string): Promise<void> {
  const { created } = await ensureUserProfile(userId, email);
  if (!created) return;
  try {
    await inngest.send({ name: "user/signed-up", data: { userId, email } });
  } catch (err) {
    // Inngest defaults to `mode:"cloud"` and throws synchronously when
    // neither INNGEST_DEV=1 nor a real event key is configured — the
    // repo's out-of-the-box state. This is a brand-new user's first
    // post-signup load; a failed send loses one welcome email, which is
    // acceptable. Crashing the (main) route group (no error boundary
    // exists) on every new signup is not. Mirrors the "a ledger hiccup
    // must never fail the function" philosophy in lib/inngest/run-ledger.ts.
    console.error("[ensure-profile] failed to send user/signed-up event", err);
  }
}
