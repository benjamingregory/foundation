import Link from "next/link";

import type { Metadata } from "next";

import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "foundation",
  description:
    "foundation is a Next.js starter with Supabase auth, Postgres, Mastra agents, Stripe billing, and Resend email already wired together.",
};

export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-24 px-6 py-20 sm:py-28">
      <section className="flex flex-col gap-6">
        <span className="text-sm font-medium text-muted-foreground">
          foundation
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
          A Next.js starter you can read start to finish
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
          foundation wires Supabase auth, Drizzle Postgres, Mastra agents,
          Stripe billing, and Resend email into one skeleton app, so the
          boring parts are done before you write your first feature.
        </p>
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Link
            href="/about"
            className="inline-flex items-center justify-center rounded-full border border-border bg-surface px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            See what&rsquo;s inside
          </Link>
        </div>
      </section>

      <section id="contact" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Questions about the stack
          </h2>
          <p className="text-muted-foreground">
            Send a note and a person will reply, not a bot.
          </p>
        </div>
        <ContactForm />
      </section>
    </main>
  );
}
