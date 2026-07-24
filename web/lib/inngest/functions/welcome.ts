import { inngest, userSignedUp } from "../client";
import { sendEmail } from "@/lib/email/send";
import { WelcomeEmail } from "@/lib/email/templates/welcome";

/**
 * Sends the first email a new account gets (Task 9's `WelcomeEmail`) once
 * `ensureProfile()` (lib/data/ensure-profile.ts) confirms a profile row was
 * just created. Per-user concurrency 1 — nothing else needs the throttle
 * yet, but it demonstrates the fan-out pattern every later per-user
 * function in this app would follow.
 *
 * `idempotencyKey: event.id` means an Inngest step retry (the send
 * succeeded but the step crashed before returning) re-sends the *same*
 * Resend request id instead of a duplicate email.
 */
export const welcome = inngest.createFunction(
  {
    id: "welcome",
    triggers: [{ event: userSignedUp }],
    concurrency: { key: "event.data.userId", limit: 1 },
  },
  async ({ event, step }) => {
    return step.run("send-welcome", async () =>
      sendEmail({
        to: event.data.email,
        subject: "welcome to foundation",
        react: WelcomeEmail(),
        idempotencyKey: event.id,
      }),
    );
  },
);
