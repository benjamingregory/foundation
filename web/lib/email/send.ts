import { Resend } from "resend";
import type { ReactNode } from "react";

/**
 * Env-gated email sending. Without both RESEND_API_KEY and EMAIL_FROM the
 * app runs normally and `sendEmail` reports itself unconfigured — callers
 * skip instead of failing. The Resend client is built lazily, and only once
 * both env vars are present, so an unconfigured environment never touches
 * the network or constructs the SDK client.
 */

let client: Resend | null | undefined;

function resend(): Resend | null {
  if (client !== undefined) return client;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  client = key && from ? new Resend(key) : null;
  return client;
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  react: ReactNode;
  /**
   * Dedupe key for retried sends (Inngest step retries can re-run a send
   * whose first attempt succeeded but crashed before returning). Resend
   * drops duplicates with the same key for 24h.
   */
  idempotencyKey?: string;
}): Promise<{ sent: boolean; id?: string; reason?: string }> {
  const c = resend();
  const from = process.env.EMAIL_FROM;
  if (!c || !from) return { sent: false, reason: "not-configured" };
  const { data, error } = await c.emails.send(
    {
      from,
      to: input.to,
      subject: input.subject,
      react: input.react,
    },
    input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
  );
  if (error) return { sent: false, reason: error.message };
  return { sent: true, id: data?.id };
}
