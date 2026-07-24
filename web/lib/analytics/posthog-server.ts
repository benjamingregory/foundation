import "server-only";
import { after } from "next/server";
import { PostHog } from "posthog-node";

/**
 * Server-side PostHog capture, for events the browser can't see or shouldn't
 * be trusted to report: workflow completions, background job outcomes, cron
 * results, billing changes.
 *
 * `userId` should be the same id passed to `posthog.identify()` on the
 * client — otherwise server and client events fork onto separate persons.
 */

// Cache on globalThis, not module scope: under `next dev`, HMR re-instantiates
// this module on every invalidation, which would leak a client (and its flush
// timer) per reload. Same reasoning as db/client.ts.
const globalForPostHog = globalThis as unknown as {
  __foundationPostHog?: PostHog | null;
};

function getClient(): PostHog | null {
  if (globalForPostHog.__foundationPostHog !== undefined) {
    return globalForPostHog.__foundationPostHog;
  }
  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  globalForPostHog.__foundationPostHog = token
    ? new PostHog(token, {
        host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        // Serverless: no long-lived process to drain a batch queue, so send
        // each event on capture rather than waiting for a flush interval.
        flushAt: 1,
        flushInterval: 0,
      })
    : null;
  return globalForPostHog.__foundationPostHog;
}

/**
 * Capture a server-side event. No-ops when NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
 * is unset, and never throws — analytics must not be able to fail a request.
 */
export function captureServer(
  userId: string,
  event: string,
  props?: Record<string, unknown>,
): void {
  const posthog = getClient();
  if (!posthog) return;

  try {
    posthog.capture({ distinctId: userId, event, properties: props });
    // flush(), not shutdown(): the client is cached across requests, and on a
    // reused serverless instance shutdown() would leave it dead for the next
    // one. after() runs the flush once the response is sent, so capture never
    // sits in the user's latency path.
    after(async () => {
      await posthog.flush().catch(() => {});
    });
  } catch {
    // after() throws outside a request scope (scripts, module init). Fall
    // back to a detached flush.
    void posthog.flush().catch(() => {});
  }
}

/**
 * Drain pending events and stop the client's timers. For long-running
 * processes that exit on their own (scripts, workers) — request paths use
 * captureServer, which flushes via after().
 */
export async function shutdownPostHogServer(): Promise<void> {
  const posthog = globalForPostHog.__foundationPostHog;
  if (!posthog) return;
  await posthog.shutdown();
  globalForPostHog.__foundationPostHog = undefined;
}
