/**
 * Sentry stub — `@sentry/nextjs` is NOT a dependency of this app (see
 * package.json). This gates entirely on `SENTRY_DSN`; when unset (the
 * default), `register()` returns before touching Sentry at all.
 *
 * To enable Sentry: `corepack pnpm add @sentry/nextjs`, then this init
 * activates.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  // A variable specifier, not a string literal, so TypeScript's module
  // resolution never tries to resolve "@sentry/nextjs" at build time — the
  // package isn't installed, and a literal `import("@sentry/nextjs")` would
  // fail typecheck. The `webpackIgnore` magic comment (Turbopack honors it
  // too) stops the bundler from constant-folding the variable back to a
  // literal and failing the build the same way; without it, Turbopack still
  // resolves `sentryModule` at build time despite it being a variable.
  // `.catch(() => null)` covers the runtime case: DSN set but the package
  // still not installed (fails gracefully instead of crashing on boot).
  const sentryModule = "@sentry/nextjs";
  const Sentry = await import(/* webpackIgnore: true */ sentryModule).catch(
    () => null,
  );
  if (!Sentry) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
  });
}
