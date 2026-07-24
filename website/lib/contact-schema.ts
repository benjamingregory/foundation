import * as z from "zod";

// Lives outside actions/contact-action.ts deliberately: that file is
// "use server", and Next.js rewrites every export of a "use server" module
// into an action-reference proxy for client bundles — including non-function
// exports like this schema. Importing the schema itself from a "use server"
// file into a client component (contact-form.tsx's zodResolver) breaks at
// runtime with "not a Zod schema" even though it type-checks fine. Keeping
// the schema in its own plain module sidesteps that and lets both the
// server action and the client form share one source of truth.
export const contactFormSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  email: z.email("Enter a valid email address."),
  message: z.string().trim().min(1, "Enter a message.").max(4000),
});
