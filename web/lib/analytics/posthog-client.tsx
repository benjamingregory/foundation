"use client";

import type { ReactNode } from "react";
import posthog from "posthog-js";

// No token (local dev, CI, most self-hosted deploys) → posthog-js is
// imported but `posthog.init()` never runs, so every `posthog.*` call
// downstream is a no-op and nothing touches the network. Init happens once,
// at module scope — guarded against SSR (posthog-js expects `window`) and
// against Fast Refresh re-evaluating this module and calling init() twice.
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (typeof window !== "undefined" && token && !posthog.__loaded) {
  posthog.init(token, {
    // A same-site managed reverse-proxy host (PostHog's own, on a subdomain
    // of this app), so capture isn't blocked by ad blockers that blocklist
    // *.i.posthog.com by hostname. Falls back to PostHog's direct ingest
    // host when unset — events still land, they're just more blockable.
    //
    // Do NOT swap this for a path-based Next.js rewrite (e.g. an `/ingest`
    // rewrite in next.config) while proxy.ts gates routes behind auth:
    // capture paths like `/ingest/e/` have no dot and aren't a public
    // prefix, so the auth check would redirect anonymous events to
    // `/sign-in` (and drop pre-auth events) instead of letting them through.
    // A managed proxy subdomain sits outside this app's routing entirely, so
    // it never reaches that middleware — see the matcher comment in
    // proxy.ts.
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    // Always the real domain, never the proxy — the toolbar and
    // session-replay links point here.
    ui_host: "https://us.posthog.com",
    // Pins the behavior bundle (autocapture, history-change pageviews,
    // pageleave, web vitals). Bumping this date changes defaults; do it
    // deliberately. App Router navigations are captured off history
    // changes, so no manual pageview component is needed.
    defaults: "2026-05-30",
  });
}

/**
 * Gates posthog-js initialization (module scope, above) behind
 * `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`. No context, no hook surface — just
 * the init gate. Renders children unchanged whether or not PostHog is
 * configured, so it's safe to always mount.
 */
export function PostHogProvider({ children }: { children: ReactNode }) {
  return children;
}
