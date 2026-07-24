# foundation — copyable skeleton project

**Date:** 2026-07-22
**Status:** Approved design, pre-implementation
**Source:** Distilled from a 5-repo audit (jobflow, kasava, sightline, demokit, monroe) — one reader agent per repo plus a commonality synthesis. jobflow (newest) is the taste anchor; divergences resolved by recency unless noted.

## What this is

A plain local folder at `~/repos/foundation` that starts every new product: `cp -R`, rename, add env keys, and Next.js + Supabase + Drizzle + Mastra + Stripe + Resend + Inngest + shadcn are already wired with the conventions and landmine-fixes accumulated across five repos. Not a GitHub template, not a CLI scaffolder — a directory with its own git history.

## Decisions (locked)

| Question | Decision |
|---|---|
| Form | Local folder, `cp -R` via `new-project.sh`; placeholder token `foundation` |
| Shape | Three independent apps: `web/` + `website/` + `admin/`, own lockfiles, separate Vercel projects, no workspace machinery |
| Wiring depth | Working vertical slices — every integration proves itself end-to-end on `pnpm dev`; delete what a project doesn't need |
| Auth + DB | Supabase (auth + Postgres), Drizzle ORM + postgres-js |
| Tenancy | Per-user (`user_id` on every table, repository-layer `eq(userId)` chokepoint); org/RBAC is a documented swap recipe |
| UI primitives | Base UI (`@base-ui/react`) + shadcn CLI style `base-nova` |
| Animation | `motion` package, imports from `motion/react` (kasava's dual-package `AnimatePresence` bug rules out `framer-motion`) |
| Theming | next-themes class-based dark + light. Dark tokens lifted from jobflow's `globals.css`; light built to match, studying monroe/kasava light themes |
| Modules | Mastra + Anthropic, Stripe, Resend, Inngest (run-ledger pattern), PostHog, TanStack Query + IDB persistence. No Playwright/PDF |
| Testing | Both, thin: minimal vitest + one test, `scripts/doctor.mts`, `test:tenancy` script slot |
| React Compiler | Off; documented opt-in |
| Supabase keys | New-style names: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY` |

## Rename story

`new-project.sh <name> <target-dir>`:

1. `cp -R` foundation → target, excluding `.git/`, `node_modules/`, `.next/`
2. Find-replace `foundation` → `<name>` across file contents and file names (token chosen to be greppable and collision-free)
3. `git init -b main`, initial commit
4. `corepack enable` so the pinned pnpm resolves
5. `bd init` so the beads tracker exists from day one

## Repo layout

```
foundation/
  CLAUDE.md  AGENTS.md  DESIGN_PRINCIPLES.md  LANGUAGE_PATTERNS.md  README.md
  skills-lock.json  new-project.sh
  .claude/            # harness layer (see below)
  web/                # product app — everything wired
  website/            # marketing shell
  admin/              # ops shell, port 3002
```

No root `package.json`. Each app: `packageManager: pnpm@11.9.0` corepack pin, own lockfile, `turbopack.root` pinned so sibling lockfiles don't confuse root inference.

## Product app (`web/`)

### Stack core

- Next 16.2.x App Router + React 19.2.x, TypeScript ^6 strict
- Tailwind CSS v4 CSS-first: no `tailwind.config`; `@import "tailwindcss"` + `tw-animate-css` + `@theme inline` token block in `app/globals.css`; `components.json` with `config: ""`
- Base UI + shadcn base-nova; 22-primitive `components/ui/` set (below); `sonner` toasts; `cn()` via cva/clsx/tailwind-merge; CSS-only `skeleton` (keeps motion off the universal critical path)
- `motion` ^12 + `lib/motion.ts` tokens (easing arrays, sub-300ms durations, press scale ~0.97, `useReducedMotion`)
- next-themes, class-based `dark` variant
- zod ^4 at every boundary
- React Compiler off (documented opt-in in CLAUDE.md)

### Directory tree

```
web/
  proxy.ts                  # Supabase session refresh + ?next= redirect (middleware entry — proxy.ts, not middleware.ts)
  instrumentation.ts        # Sentry stub, DSN-gated
  next.config.ts            # turbopack.root, serverExternalPackages (postgres, drizzle-orm, @mastra/*), optimizePackageImports
  components.json  drizzle.config.ts  vercel.json (empty CRON_SECRET-guarded cron slot)  .env.example
  app/
    layout.tsx  globals.css  loading.tsx
    (auth)/sign-in/  (auth)/sign-up/
    (main)/dashboard/       # items list — the TanStack + DB slice surface
    (main)/chat/            # streaming agent page — the Mastra slice surface
    (main)/settings/billing/# checkout + portal buttons — the Stripe slice surface
    api/
      inngest/route.ts
      webhooks/stripe/route.ts
      billing/{checkout,portal}/route.ts
      items/route.ts        # withAuth + zod example CRUD
      chat/route.ts         # agent streaming
  lib/
    auth/{server.ts,api.ts,client.ts}
    api/with-auth.ts        # auth + zod body + typed error envelope (+ thin per-user rate limit)
    data/api-fetch.ts       # apiFetch/apiJson → sonner error toast + typed ApiError
    email/{send.ts,layout.tsx,theme.ts,templates/welcome.tsx}
    inngest/{client.ts,run-ledger.ts,functions/welcome.ts}
    mastra/{config.ts,models.ts,agents/example.ts,tools/_shared/createScopedTool.ts,middleware/tool-input-sanitizer.ts}
    query/{client.ts,persister.ts,keys.ts,prefetch.ts}
    analytics/{posthog-client.tsx,posthog-server.ts}
    motion.ts  utils.ts
  db/
    client.ts               # globalThis-cached postgres-js pool (max 5, prepare: false) — survives next dev HMR
    schema/{index.ts,users.ts,items.ts,billing.ts,inngest-runs.ts}
    repositories/{_shared.ts,users.ts,items.ts}
    migrations/  migrate.mts
  services/{errors.ts,billing.ts,entitlements.ts}
  components/{ui/,providers.tsx,jobs/jobs-dock.tsx,theme-toggle.tsx}
  scripts/doctor.mts
  tests/  (minimal vitest: one example + tenancy-check slot)
```

### Vertical slices

Each slice runs end-to-end on first `pnpm dev` (with stub env where noted). Slices reference each other exactly once: signup → Inngest event → welcome email.

1. **Auth (Supabase).** `proxy.ts` — `getUser()` refresh + `?next=` return-URL redirect. `lib/auth/server.ts` — `React.cache()`d `getOptionalUser()` via `getClaims()` (local ES256 verify, no Auth-server hop) + `requireUser()`. `lib/auth/api.ts` `authenticate()` — Bearer user JWT | timing-safe `AGENT_API_TOKEN` (resolves to a configured user id) | SSR cookie; **service-role key explicitly rejected as a credential**. Sign-in/up pages on the auth layout.
2. **DB (Drizzle, per-user tenancy).** One example `items` table + generated migration + typed repository. Tenancy chokepoint isolated in `db/repositories/_shared.ts`; every repository query carries `eq(table.userId, userId)`. CLAUDE.md states the RLS reality: app connects as `postgres` (BYPASSRLS) — manual predicates are the only enforcement. `test:tenancy` script slot.
3. **Mastra.** `getMastra()` cached singleton over PostgresStore (same Supabase DB, `mastra_*` tables). `models.ts` env-overridable model factories wrapped with tool-input-sanitizer middleware. One example agent with `cacheControl: ephemeral` static prompt, streaming via `/api/chat` to a minimal chat page. `createScopedTool` wrapper: `userId` from trusted RequestContext, never model args. `@kasava/prompt-builder` included.
4. **Stripe.** `services/billing.ts` — Stripe is source of truth, DB `user_billing` a synced projection; Checkout + Customer Portal session routes; webhook idempotent via `stripe_events` ledger + re-fetch-subscription-on-every-event (survives out-of-order delivery). Flat single plan (`STRIPE_PRICE_PRO_MONTHLY`). `BILLING_ENFORCED` kill switch; `billingConfigured()` 503-noop when unkeyed. `services/entitlements.ts` gates features off the **DB plan column**, never live Stripe status (kasava rule).
5. **Resend.** `lib/email/send.ts` env-gated (`{sent: false}` when `RESEND_API_KEY`/`EMAIL_FROM` unset); accepts `idempotencyKey` for Inngest step retries. react-email shared layout/theme + one welcome template.
6. **Inngest.** Typed events via `eventType()` + `staticSchema` in `client.ts`. Example function: welcome email on `user/signed-up`, per-user concurrency. Run-ledger middleware mirrors lifecycle (queued/running/terminal) into `inngest_runs`, powering a minimal jobs dock component. `dev` script: `concurrently -k "next dev" "inngest dev -u http://localhost:3000/api/inngest"`.
7. **TanStack Query + IDB.** Query client + per-query idb-keyval persister (carrying the hydration write-gap fix from jobflow/monroe) + SSR prefetch/hydrate bridge, driving the items page. Background-jobs-style keys excluded from persistence.
8. **PostHog / Sentry.** Env-gated: PostHog client provider + server capture wrapper (no-ops unkeyed; reverse-proxy caveat documented); `instrumentation.ts` Sentry stub, DSN unset.

### Perf defaults (encoded in CLAUDE.md and honored by the skeleton's own code)

No `force-dynamic`; `loading.tsx` for data-fetching routes; `*-lazy.tsx` wrappers for >30KB client deps; `optimizePackageImports` for barrel-index libs; `React.cache()` per-request dedupe; explicit column projection; batch inserts; `unstable_cache` for idempotent external calls.

## Marketing shell (`website/`)

Next 16 + Tailwind v4 + MDX (`@next/mdx`) + `motion`, same token structure with its own theme freedom (hallmark's full flow applies here, not in `web/`). Contact form: next-safe-action + react-hook-form + zod → Resend, with header-injection sanitization (demokit recipe). One landing page + one MDX page as structure proof. Own lockfile, own Vercel project.

## Ops shell (`admin/`)

Next 16 on port 3002. Supabase login with email-domain gate. Reads the product DB directly: own Drizzle client + schema copy + `check:drift` script that diffs against `web/db/schema` (jobflow pattern — the lightweight alternative to a shared package). One users table view on shadcn `table`. Base UI + base-nova like `web/`.

## Harness layer

```
CLAUDE.md            # dense, pre-filled for this stack: commands, layout map, conventions, landmines
AGENTS.md
skills-lock.json
.claude/
  settings.json      # permission baseline merged from jobflow/kasava/monroe allowlists
  skills/            # hallmark + emil-design-eng, with a generalized addendum: product-app tokens are locked
                     # (no theme catalog in web/), full theme flow allowed only in website/
  agents/
    web-research-analyst.md
    nextjs-frontend-expert.md
    mastra-workflow-architect.md
    design-review-agent.md
  commands/          # work, style, issues, think, update, upgrade, visualize, design-review
```

Excluded as repo-specific: `vector-search-architect`, `browser-extension-developer`, `cloudflare-backend-architect`, `mobbin-research`, `audit-public`, `blog`, `docs`.

CLAUDE.md landmine notes carried verbatim: `@mastra/pg` exact-pin rationale (any `pnpm add` can drift it and 500 all Mastra routes), corepack requirement, globalThis pool caching, tenancy/RLS reality, `proxy.ts`-not-`middleware.ts`, motion-not-framer-motion.

## Dependency versions (product app, at authoring time)

Pinned by the audit; refreshed at implementation:

`next 16.2.10` · `react 19.2.x` · `typescript ^6` · `tailwindcss ^4.3` · `zod ^4.4` · `drizzle-orm ^0.45.2` · `drizzle-kit ^0.31.10` · `postgres ^3.4.9` · `@supabase/ssr ^0.12` · `@supabase/supabase-js ^2.110` · `@mastra/core ^1.50` · **`@mastra/pg 1.15.x` EXACT** · `ai ^7` · `@ai-sdk/anthropic ^4` · `@ai-sdk/react ^4` · `@kasava/prompt-builder ^0.2` · `@tanstack/react-query ^5.101` · `idb-keyval ^6.3` · `@base-ui/react ^1.6` · `lucide-react ^1.x` · `sonner ^2` · `motion ^12` · `next-themes ^0.4` · `stripe ^22` · `resend ^6.17` · `react-email ^6.7` · `inngest ^4.3` · `posthog-js ^1.x` · `posthog-node ^5.x` · `tsx ^4` · `vitest ^4` · `concurrently ^9`

## shadcn component set (`web/components/ui/`)

badge, button, card, checkbox, collapsible, context-menu, dialog, dropdown-menu, empty-state, input, label, progress, select, separator, sheet, skeleton (CSS-only), slider, switch, table, tabs, textarea, tooltip. (`scroll-area` deliberately omitted — kasava bans it; add per-project.)

## `.env.example` baseline (names only)

`DATABASE_URL` · `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` · `SUPABASE_SECRET_KEY` · `ANTHROPIC_API_KEY` · `APP_BASE_URL` · `NEXT_PUBLIC_APP_URL` · `AGENT_API_TOKEN` · `CRON_SECRET` · `INNGEST_EVENT_KEY` · `INNGEST_SIGNING_KEY` · `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_PRICE_PRO_MONTHLY` · `BILLING_ENFORCED` · `RESEND_API_KEY` · `EMAIL_FROM` · `NEXT_PUBLIC_POSTHOG_HOST` · `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` · `SENTRY_DSN` · `NEXT_PUBLIC_SENTRY_DSN`

Only Supabase + `DATABASE_URL` are required for first boot; everything else degrades gracefully (documented per-var in the file).

## Deliberately out (add-on recipes in CLAUDE.md, not code)

Firecrawl client (jobflow's `lib/firecrawl/client.ts` named as the source), Playwright/PDF pipeline, Gmail OAuth, TanStack Table/Virtual, recharts, Tiptap, Loops, `@vercel/blob`, org-tenancy/RBAC swap, usage-based billing (demokit's Meters/credits), provider-interface email (monroe's `EMAIL_PROVIDER`), Cloudflare Workers backend split.

## Success criteria

1. `new-project.sh test ~/tmp/test` → `cd ~/tmp/test/web && corepack pnpm install && corepack pnpm dev` boots with only Supabase env set; sign-up → dashboard works.
2. Every slice demonstrably fires: item CRUD persists, chat streams from the example agent, checkout redirects (test mode), welcome email sends (or `{sent:false}` logs cleanly unkeyed), Inngest run appears in the dock, theme toggle flips dark/light with no unstyled flash.
3. `pnpm typecheck`, `pnpm lint`, `pnpm build` pass in all three apps with stub env.
4. Grep for `foundation` finds every site a rename must touch; `new-project.sh` leaves zero occurrences behind.

## Deferred to implementation plan

- Light-mode token derivation: study monroe + kasava light themes, build values comparable to jobflow's dark set
- `.claude/settings.json` permission-baseline merge (union minus repo-specific entries)
- Exact `@mastra/pg` version at build time (pin whatever current is)
- Per-app README stubs and CLAUDE.md final wording
