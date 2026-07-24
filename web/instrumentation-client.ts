/**
 * Sentry stub — `@sentry/nextjs` is NOT a dependency of this app (see
 * package.json). This gates entirely on `NEXT_PUBLIC_SENTRY_DSN`; when
 * unset (the default), nothing below ever touches Sentry.
 *
 * To enable Sentry: `corepack pnpm add @sentry/nextjs`, then this init
 * activates.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  // A variable specifier, not a string literal, so TypeScript's module
  // resolution never tries to resolve "@sentry/nextjs" at build time — the
  // package isn't installed, and a literal `import("@sentry/nextjs")` would
  // fail typecheck. The `webpackIgnore` magic comment (Turbopack honors it
  // too) stops the bundler from constant-folding the variable back to a
  // literal and failing the build the same way; without it, Turbopack still
  // resolves `sentryModule` at build time despite it being a variable.
  // `.catch(() => null)` covers the runtime case: DSN set but the package
  // still not installed (fails gracefully instead of throwing in the
  // browser).
  const sentryModule = "@sentry/nextjs";
  void import(/* webpackIgnore: true */ sentryModule)
    .then((Sentry) => {
      Sentry.init({ dsn, tracesSampleRate: 0.1 });
    })
    .catch(() => null);
}

// Next.js invokes this on every client-side route transition (App Router
// soft navigation) when it's exported from this file. Sentry's real
// implementation (`Sentry.captureRouterTransitionStart`) records it as a
// span; this stays a no-op until `@sentry/nextjs` is installed and the
// block above actually initializes a client.
export function onRouterTransitionStart() {}
