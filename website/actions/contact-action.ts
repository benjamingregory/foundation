"use server";

import { Resend } from "resend";
import * as z from "zod";

import { actionClient } from "./safe-action";

import { contactFormSchema } from "@/lib/contact-schema";

const FALLBACK_FROM_EMAIL = "foundation <hello@example.com>";
const FALLBACK_TO_EMAIL = "hello@example.com";
const NOT_CONFIGURED_MESSAGE =
  "The contact form isn't wired to an inbox yet. Set RESEND_API_KEY to enable it.";
const DELIVERY_FAILURE_MESSAGE =
  "Delivery failed. Try again, or reach us another way.";

// Header fields (the subject line) can't safely carry raw user input:
// embedded CR/LF could inject extra headers, and there's no length limit on
// the form field. Body text isn't a header, so it doesn't need this.
function sanitizeForHeader(value: string, maxLength = 100): string {
  return value.replace(/[\r\n]+/g, " ").slice(0, maxLength);
}

export const contactAction = actionClient
  .inputSchema(contactFormSchema)
  .action(async ({ parsedInput }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return {
        success: false as const,
        reason: "not_configured" as const,
        message: NOT_CONFIGURED_MESSAGE,
      };
    }

    // contactFormSchema already validates email format, but replyTo is
    // itself a header value sent straight to Resend — re-check locally so
    // this guard holds even if the schema changes upstream.
    const isValidReplyTo = z.email().safeParse(parsedInput.email).success;

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.CONTACT_FROM_EMAIL ?? FALLBACK_FROM_EMAIL,
      to: process.env.CONTACT_TO_EMAIL ?? FALLBACK_TO_EMAIL,
      ...(isValidReplyTo ? { replyTo: parsedInput.email } : {}),
      subject: `foundation contact: ${sanitizeForHeader(parsedInput.name)}`,
      text: [
        `Name: ${parsedInput.name}`,
        `Email: ${parsedInput.email}`,
        "",
        parsedInput.message,
      ].join("\n"),
    });

    if (error) {
      return {
        success: false as const,
        reason: "delivery_failed" as const,
        message: DELIVERY_FAILURE_MESSAGE,
      };
    }

    return { success: true as const };
  });
