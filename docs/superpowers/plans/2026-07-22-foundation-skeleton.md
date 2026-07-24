# foundation Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `~/repos/foundation` — a copyable three-app starter (web/ + website/ + admin/) with Supabase auth, Drizzle, Mastra, Stripe, Resend, Inngest, TanStack Query + IDB, PostHog wired as working vertical slices.

**Architecture:** Most files are **ports** from the five source repos (jobflow is the primary donor; monroe donates the TanStack kit; kasava donates motion tokens + harness agents; demokit donates the contact-form recipe). Each port task cites the exact source path and an adaptation checklist. New glue (schema, example routes, scripts) has complete code inline.

**Tech Stack:** Next 16.2.x / React 19.2.x / TS ^6 strict / Tailwind v4 CSS-first / Base UI + shadcn base-nova / motion ^12 / Drizzle + postgres-js / Supabase / Mastra + AI SDK v7 / Stripe / Resend + react-email / Inngest v4 / TanStack Query v5 + idb-keyval / PostHog.

**Spec:** `docs/superpowers/specs/2026-07-22-foundation-skeleton-design.md` (approved). The spec's decisions table is binding.

## Global Constraints

- Placeholder token is `foundation`, always lowercase (brand style follows jobflow's lowercase "inrole"). Never write `Foundation` in user-visible copy or identifiers.
- `packageManager: "pnpm@11.9.0"` in every app; all installs/commands via `corepack pnpm` (shell pnpm 9 fails on v11 workspace files).
- `@mastra/pg` pinned EXACT (no `^`) — resolve the current version at install time and pin it; any caret drift 500s all Mastra routes.
- Animation imports from `motion/react` ONLY. Never `framer-motion` (dual-package = two AnimatePresence contexts — kasava bug). When porting jobflow components, rewrite `from "framer-motion"` → `from "motion/react"`.
- Every repository query on a user-scoped table carries `eq(table.userId, userId)`. RLS is not in the request path (app connects as `postgres`, BYPASSRLS).
- Every integration degrades gracefully unkeyed: `sendEmail` → `{sent:false}`, billing routes → 503, PostHog/Sentry → no-op. Only Supabase env + `DATABASE_URL` are required to boot.
- Supabase env uses new-style names: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`.
- No `export const dynamic = "force-dynamic"` anywhere. Data-fetching routes get `loading.tsx`.
- User-facing copy follows root `LANGUAGE_PATTERNS.md` (banned words list). No sparkle/wand icons ever.
- Static agent prompts get `cacheControl: { type: "ephemeral" }`.
- No new markdown docs beyond the ones this plan names.
- Commits: one per task minimum, message style `feat(scope): ...` / `chore(scope): ...`, explicit `git add <paths>`, ending with the Co-Authored-By trailer used in this repo's first commit.
- Verification environment: full auth/chat/billing smoke tests need real keys (Supabase project, ANTHROPIC_API_KEY, Stripe test keys). Tasks note which checks are **structural** (typecheck/build/unkeyed behavior — always run) vs **keyed** (run if `web/.env.local` has the key; otherwise record as deferred to Task 17).
- All commands run from the app dir stated in the task (`cd` with absolute paths — shell cwd resets between turns).

## File Structure (target)

See spec §Repo layout and §Directory tree — the plan follows it exactly. Donor map:

| Area | Donor |
|---|---|
| Auth, db client, with-auth, api-fetch, email, inngest, mastra wiring, billing, ui/, doctor, migrate | jobflow `web/` |
| TanStack Query + IDB kit | monroe `app/src/lib/react-query/` |
| motion.ts tokens | kasava `frontend/src/lib/motion.ts` |
| Contact form (website) | demokit `demokit-website/src/actions/` |
| Harness agents/commands | kasava + monroe `.claude/` |
| Light-theme reference | monroe `app/src/app/globals.css` + kasava `frontend/src/app/globals.css` |

---

### Task 1: Root scaffold + new-project.sh

**Files:**
- Create: `README.md`, `.gitignore`, `new-project.sh`
- Run: `bd init` (foundation's own tracker)

**Interfaces:**
- Produces: `new-project.sh <name> <target-dir>` — the rename contract every later task must respect (all placeholder uses are the literal lowercase string `foundation`).

- [ ] **Step 1: Write `.gitignore` and `README.md`**

`.gitignore`:
```
node_modules/
.next/
.env
.env.local
.env*.local
*.log
.DS_Store
.claude/settings.local.json
```

`README.md`:
```markdown
# foundation

Copyable starter: Next 16 + Supabase + Drizzle + Mastra + Stripe + Resend + Inngest + shadcn (Base UI), three apps (web/ product, website/ marketing, admin/ ops).

## Start a project

    ./new-project.sh myapp ~/repos/myapp
    cd ~/repos/myapp/web
    cp .env.example .env.local   # fill Supabase + DATABASE_URL; everything else optional
    corepack pnpm install && corepack pnpm dev

See CLAUDE.md for conventions and per-app commands.
```

- [ ] **Step 2: Write `new-project.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "usage: ./new-project.sh <name> <target-dir>" >&2
  exit 1
fi

NAME="$1"
TARGET="$2"
SRC="$(cd "$(dirname "$0")" && pwd)"

case "$NAME" in
  (*[!a-z0-9-]*) echo "error: name must be lowercase letters, digits, hyphens" >&2; exit 1 ;;
esac
if [ -e "$TARGET" ]; then
  echo "error: $TARGET already exists" >&2
  exit 1
fi

mkdir -p "$TARGET"
rsync -a "$SRC"/ "$TARGET"/ \
  --exclude .git --exclude node_modules --exclude .next \
  --exclude .beads --exclude docs/superpowers \
  --exclude new-project.sh --exclude .claude/settings.local.json

# rename: file contents
grep -rlF foundation "$TARGET" 2>/dev/null | while IFS= read -r f; do
  perl -pi -e "s/foundation/$NAME/g" "$f"
done
# rename: any file/dir names carrying the token (depth-first so children first)
find "$TARGET" -depth -name '*foundation*' | while IFS= read -r p; do
  mv "$p" "$(dirname "$p")/$(basename "$p" | sed "s/foundation/$NAME/g")"
done

cd "$TARGET"
git init -b main -q
git add -A
git commit -qm "chore: bootstrap $NAME from foundation skeleton"
corepack enable >/dev/null 2>&1 || true
if command -v bd >/dev/null 2>&1; then bd init >/dev/null 2>&1 || true; else echo "note: bd not installed; skipped tracker init"; fi

echo "created $TARGET"
echo "next: cd $TARGET/web && cp .env.example .env.local && corepack pnpm install && corepack pnpm dev"
```

`chmod +x new-project.sh`.

- [ ] **Step 3: Test the rename round-trip**

```bash
cd /Users/tardis7/repos/foundation && ./new-project.sh testapp /tmp/foundation-t1
grep -rF foundation /tmp/foundation-t1 && echo "LEAK" || echo "CLEAN"
cd /tmp/foundation-t1 && git log --oneline | wc -l   # expect 1
rm -rf /tmp/foundation-t1
```
Expected: `CLEAN`, one commit. (README contains `foundation` several times — verify they became `testapp`.)

- [ ] **Step 4: Init tracker + commit**

```bash
cd /Users/tardis7/repos/foundation && bd init
git add .gitignore README.md new-project.sh .beads
git commit -m "feat(root): scaffold + new-project.sh rename script"
```
(Append the Co-Authored-By trailer; same for every commit below — not repeated again.)

---

### Task 2: `web/` boots — package.json, config, globals, layout

**Files:**
- Create: `web/package.json`, `web/tsconfig.json`, `web/next.config.ts`, `web/postcss.config.mjs`, `web/eslint.config.mjs`, `web/.env.example`, `web/app/layout.tsx`, `web/app/globals.css`, `web/app/page.tsx`, `web/app/loading.tsx`
- Port from: jobflow `web/tsconfig.json`, `web/next.config.ts`, `web/postcss.config.mjs`, `web/eslint.config.mjs`, `web/app/globals.css`

**Interfaces:**
- Produces: pnpm scripts `dev`, `build`, `lint`, `typecheck`; CSS custom properties from jobflow's dark token block (later tasks reference semantic tokens, e.g. `bg-background`, `text-muted-foreground`).

- [ ] **Step 1: Write `web/package.json`**

Use the spec's version table. Resolve exact current versions with `corepack pnpm view <pkg> version` for `@mastra/pg` (pin EXACT) — everything else uses the spec's ranges:

```jsonc
{
  "name": "foundation-web",
  "private": true,
  "packageManager": "pnpm@11.9.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "doctor": "tsx scripts/doctor.mts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx db/migrate.mts",
    "test": "vitest run",
    "test:tenancy": "tsx scripts/test-tenancy.mts"
  },
  "dependencies": {
    "next": "16.2.10", "react": "^19.2.0", "react-dom": "^19.2.0", "zod": "^4.4.3", "server-only": "^0.0.1",
    "drizzle-orm": "^0.45.2", "postgres": "^3.4.9",
    "@supabase/ssr": "^0.12.0", "@supabase/supabase-js": "^2.110.0",
    "@mastra/core": "^1.50.0", "@mastra/pg": "<EXACT current 1.x>", "@mastra/memory": "^1.22.2", "@mastra/ai-sdk": "^1.6.1",
    "ai": "^7.0.14", "@ai-sdk/anthropic": "^4.0.7", "@ai-sdk/react": "^4.0.15", "@kasava/prompt-builder": "^0.2.2",
    "@tanstack/react-query": "^5.101.0", "@tanstack/query-persist-client-core": "^5.101.0", "idb-keyval": "^6.3.0",
    "@base-ui/react": "^1.6.0", "lucide-react": "^1.14.0", "sonner": "^2.0.7",
    "class-variance-authority": "^0.7.1", "clsx": "^2.1.1", "tailwind-merge": "^3.5.0", "tw-animate-css": "^1.4.0",
    "next-themes": "^0.4.6", "motion": "^12.38.0",
    "stripe": "^22.3.1", "resend": "^6.17.2", "react-email": "^6.7.0", "@react-email/components": "^0.5.0",
    "inngest": "^4.3.0",
    "posthog-js": "^1.399.2", "posthog-node": "^5.41.0"
  },
  "devDependencies": {
    "typescript": "^6", "@types/node": "^24", "@types/react": "^19", "@types/react-dom": "^19",
    "tailwindcss": "^4", "@tailwindcss/postcss": "^4",
    "drizzle-kit": "^0.31.10", "tsx": "^4.21.0", "inngest-cli": "^1.21.0", "concurrently": "^9.2.1",
    "vitest": "^4", "eslint": "^9", "eslint-config-next": "16.2.10"
  }
}
```

- [ ] **Step 2: Port config files from jobflow**

Read each jobflow source, write the foundation version:
- `web/tsconfig.json` — copy verbatim (strict, `@/*` path alias).
- `web/next.config.ts` — keep: `turbopack.root: __dirname`, `serverExternalPackages` (postgres, drizzle-orm, all present `@mastra/*`), `experimental.optimizePackageImports`. DROP jobflow-specific: Sentry wrapping, `outputFileTracingIncludes` (chromium), image remotePatterns, redirects.
- `web/postcss.config.mjs`, `web/eslint.config.mjs` — copy verbatim.

- [ ] **Step 3: globals.css — port jobflow's dark tokens**

Read jobflow `web/app/globals.css`. Carry: `@import "tailwindcss";`, tw-animate-css import, the `@theme inline` block, the full dark token set, `@custom-variant dark`. DROP jobflow-specific tokens (`--status-*`, `--score-*` and any eval/report-specific vars). Keep the semantic shadcn set (`--background`, `--foreground`, `--card`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, sidebar/chart vars if generic). Leave the dark values as the `:root` defaults for now — Task 3 restructures for light+dark.

- [ ] **Step 4: Minimal layout, page, loading**

`web/app/layout.tsx`: html/body with font vars via `next/font` (port jobflow's font choice), `<body className="min-h-dvh bg-background text-foreground antialiased">`, children only (providers arrive Task 3). `web/app/page.tsx`: a plain server component rendering "foundation" + link to `/dashboard`. `web/app/loading.tsx`: empty-div placeholder until Task 3's Skeleton exists.

- [ ] **Step 5: `web/.env.example` (complete, commented)**

```bash
# --- required to boot ---
DATABASE_URL=            # Supabase Postgres connection string (postgres role)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
APP_BASE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
# --- optional: agent/API auth ---
AGENT_API_TOKEN=         # automation bearer; resolves to AGENT_USER_ID
AGENT_USER_ID=
CRON_SECRET=
# --- optional: AI (chat slice) ---
ANTHROPIC_API_KEY=
# --- optional: background jobs ---
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
# --- optional: billing (503s cleanly unset) ---
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
BILLING_ENFORCED=false
# --- optional: email (no-ops unset) ---
RESEND_API_KEY=
EMAIL_FROM=foundation <hello@example.com>
# --- optional: analytics/errors (no-op unset) ---
NEXT_PUBLIC_POSTHOG_HOST=
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
```

- [ ] **Step 6: Install + verify boot**

```bash
cd /Users/tardis7/repos/foundation/web && corepack pnpm install
corepack pnpm typecheck && corepack pnpm build
corepack pnpm dev &  # curl -sf localhost:3000 | grep foundation; kill it after
```
Expected: build passes; homepage renders "foundation".

- [ ] **Step 7: Commit** — `git add web && git commit -m "feat(web): Next 16 app boots with jobflow config + dark tokens"`

---

### Task 3: UI kit — primitives, themes (dark + light), motion, providers

**Files:**
- Create: `web/components.json`, `web/lib/utils.ts`, `web/components/ui/*` (22 files), `web/components/providers.tsx`, `web/components/theme-toggle.tsx`, `web/lib/motion.ts`
- Modify: `web/app/globals.css` (light scope), `web/app/layout.tsx` (providers), `web/app/loading.tsx` (Skeleton)
- Port from: jobflow `web/components.json`, `web/lib/utils.ts` (or kasava `frontend/src/lib/utils.ts`), jobflow `web/components/ui/{badge,button,card,checkbox,collapsible,context-menu,dialog,dropdown-menu,empty-state,input,label,progress,select,separator,sheet,skeleton,slider,switch,table,tabs,textarea,tooltip}.tsx`, kasava `frontend/src/lib/motion.ts`

**Interfaces:**
- Produces: `cn()` from `@/lib/utils`; the 22 primitives importable as `@/components/ui/<name>`; `Providers` (next-themes `attribute="class"` + sonner `<Toaster/>`; QueryClientProvider added in Task 7); `MOTION` tokens (easing arrays, durations, press scale) from `@/lib/motion`; `ThemeToggle` component.

- [ ] **Step 1: Port `components.json` + `lib/utils.ts`** — jobflow's verbatim (style base-nova, `config: ""`, cssVariables, lucide, aliases `@/components`, `@/lib/utils`).
- [ ] **Step 2: Port the 22 `components/ui` files** — copy from jobflow; rewrite any `framer-motion` import to `motion/react`; `skeleton.tsx` must remain CSS-only (verify no motion import). If a listed file doesn't exist in jobflow (e.g. `empty-state`), generate via `corepack pnpm dlx shadcn@latest add <name>` and adapt to the house style.
- [ ] **Step 3: Light theme.** Read monroe's light-mode token values (`app/src/app/globals.css`, which carries the `:root` light + `.dark` scopes) and kasava's (`frontend/src/app/globals.css`) as references. Restructure globals.css: `:root { <light values> }`, `.dark { <jobflow dark values> }`, `@custom-variant dark (&:is(.dark *))`. Derive light values to mirror the dark set's hue/contrast relationships (same var names, no new vars). Acceptance: every var defined in both scopes — `grep -o '\-\-[a-z-]*' web/app/globals.css | sort | uniq -c` shows each token exactly twice (plus `@theme inline` references).
- [ ] **Step 4: Port kasava `frontend/src/lib/motion.ts`** → `web/lib/motion.ts` (easing/duration/spring/press tokens; type imports from `motion/react`).
- [ ] **Step 5: `providers.tsx` + `theme-toggle.tsx`** — `"use client"`; ThemeProvider (`attribute="class"`, `defaultTheme="dark"`, `enableSystem`) wrapping children + `<Toaster richColors />`; toggle = ui/button + lucide `Sun`/`Moon` using `useTheme()` with mounted-guard. Wire `Providers` into `layout.tsx`; `suppressHydrationWarning` on `<html>`. Replace `loading.tsx` with `<Skeleton className="h-8 w-48 m-8" />`.
- [ ] **Step 6: Verify** — temp demo page (or extend `page.tsx`) rendering button/card/dialog/tabs/skeleton + toggle; check both themes, no flash-of-wrong-theme on reload; `corepack pnpm typecheck && corepack pnpm build`.
- [ ] **Step 7: Commit** — `feat(web): ui kit — 22 base-nova primitives, dark+light tokens, motion tokens`

---

### Task 4: Auth slice (Supabase)

**Files:**
- Create: `web/proxy.ts`, `web/lib/auth/{server.ts,api.ts,client.ts}`, `web/app/(auth)/sign-in/page.tsx`, `web/app/(auth)/sign-up/page.tsx`, `web/app/(auth)/layout.tsx`, `web/app/(main)/layout.tsx`
- Port from: jobflow `web/proxy.ts`, `web/lib/auth/server.ts`, `web/lib/auth/api.ts`, `web/lib/auth/client.ts`, jobflow's `(auth)` pages

**Interfaces:**
- Produces: `getOptionalUser(): Promise<User | null>` and `requireUser(): Promise<User>` (React.cache'd, from `@/lib/auth/server`); `authenticate(req): Promise<{ userId: string } | Response>` from `@/lib/auth/api` (bearer JWT | timing-safe `AGENT_API_TOKEN`→`AGENT_USER_ID` | SSR cookie; service-role key rejected); `supabaseBrowser()` from `@/lib/auth/client`.

- [ ] **Step 1: Port `lib/auth/*`** from jobflow. Adaptations: env names to the new-style keys; `CAREER_OPS_USER_ID` → `AGENT_USER_ID`; strip jobflow-specific claims/onboarding fields. Keep: `React.cache()` + `getClaims()` local verify, fail-closed env handling, the service-role-key rejection comment.
- [ ] **Step 2: Port `proxy.ts`.** Keep session refresh + unauthenticated `/(main)` → `/sign-in?next=` redirect + matcher config. DROP the onboarding cookie gate and analytics-proxy blocks (leave jobflow's PostHog-proxy caveat as a one-line comment).
- [ ] **Step 3: Auth pages.** Port jobflow's sign-in/up forms, trimmed to email+password via `supabaseBrowser()`, ui/ primitives, `apiFetch`-free (direct supabase calls), error → sonner toast, success → `router.push(searchParams.next ?? "/dashboard")`. `(main)/layout.tsx` calls `requireUser()`.
- [ ] **Step 4: Structural verify** — typecheck + build; with stub env, `/` renders and `/dashboard` redirects to `/sign-in` (proxy handles missing session without crashing — guard env reads).
- [ ] **Step 5: Keyed verify (if Supabase env present)** — sign up a throwaway user, land on dashboard. Otherwise record deferred.
- [ ] **Step 6: Commit** — `feat(web): supabase auth slice — proxy, server helpers, three-mode API auth, pages`

---

### Task 5: DB slice (Drizzle + tenancy chokepoint)

**Files:**
- Create: `web/db/client.ts`, `web/db/schema/{index.ts,users.ts,items.ts,billing.ts,inngest-runs.ts}`, `web/db/repositories/{_shared.ts,userProfiles.ts,items.ts}`, `web/db/migrate.mts`, `web/drizzle.config.ts`, `web/scripts/test-tenancy.mts`, `web/vitest.config.ts`, `web/tests/repositories.test.ts`
- Port from: jobflow `web/db/client.ts`, `web/db/migrate.mts`, `web/drizzle.pg.config.ts`, `web/db/repositories/_shared.ts`, `web/scripts/` tenancy-check script

**Interfaces:**
- Produces: `getDb()` from `@/db/client`; tables `userProfiles` (userId PK uuid, email, displayName, timestamps), `items` (id uuid default random, userId, title, notes, status text default `'open'`, timestamps), `userBilling` (userId PK, stripeCustomerId, stripeSubscriptionId, plan text default `'free'`, status, currentPeriodEnd, updatedAt), `stripeEvents` (id text PK, type, receivedAt), `inngestRuns` (runId text PK, userId, eventName, status, error, queuedAt, startedAt, endedAt); repositories `ensureUserProfile(userId, email) → { created: boolean }`, `listItems(userId)`, `createItem(userId, {title, notes?})`, `updateItem(userId, id, patch)`, `deleteItem(userId, id)`.

- [ ] **Step 1: Port `db/client.ts`** (globalThis-cached pool, max 5, `prepare:false`, schema-identity check, Postgres-URL guard) and `migrate.mts`, `drizzle.config.ts` (schema entry `./db/schema/index.ts`, out `./db/migrations`).
- [ ] **Step 2: Write schema files** (complete code in Drizzle pgTable form per the Interfaces block above; `index.ts` re-exports all; every user-scoped table's `userId` is `uuid("user_id").notNull()`).
- [ ] **Step 3: Write repositories.** `_shared.ts`: port jobflow's helpers, and every exported repo function takes `userId` first and filters `eq(table.userId, userId)` (single-object reads use `and(eq(id), eq(userId))`). `ensureUserProfile` = `insert … onConflictDoNothing` + return whether inserted (drives the signup event in Task 9).
- [ ] **Step 4: Generate + apply migration** — `corepack pnpm db:generate`; then `db:migrate` if `DATABASE_URL` set (else defer). Never hand-edit migration output.
- [ ] **Step 5: Tenancy gate.** `scripts/test-tenancy.mts` (port jobflow's approach): parse every file in `db/repositories/` except `_shared.ts`; each exported query function must reference `userId` in its where-clause — fail loudly listing offenders. Minimal `vitest.config.ts` + one real unit test exercising `ensureUserProfile` shape against a mocked db (or skip-if-no-DATABASE_URL integration).
- [ ] **Step 6: Run** — `corepack pnpm test:tenancy && corepack pnpm test && corepack pnpm typecheck`.
- [ ] **Step 7: Commit** — `feat(web): db slice — pooled client, schema, tenancy-enforced repositories, migration flow`

---

### Task 6: API conventions — errors, withAuth, apiFetch, items CRUD

**Files:**
- Create: `web/services/errors.ts`, `web/services/rateLimit.ts`, `web/lib/api/with-auth.ts`, `web/lib/data/api-fetch.ts`, `web/app/api/items/route.ts`, `web/app/api/items/[id]/route.ts`
- Port from: jobflow `web/services/errors.ts`, `web/services/rateLimit.ts`, `web/lib/api/with-auth.ts`, `web/lib/data/api-fetch.ts`

**Interfaces:**
- Consumes: `authenticate` (Task 4), repositories (Task 5).
- Produces: `ServiceError` + typed codes; `withAuth({ body?: zodSchema }, handler({ userId, body, req }))` returning the typed error envelope `{ error: { code, message } }`; client `apiFetch(path, init?)` / `apiJson<T>(path, init?)` that toast non-OK server messages and throw `ApiError`.

- [ ] **Step 1: Port the four files.** with-auth adaptations: keep auth + zod body validation + rate-limit bucket + ServiceError→HTTP mapping; STRIP jobflow's spend/eval metering hooks. api-fetch: keep sonner toast on non-OK with server message.
- [ ] **Step 2: Items routes (complete new code).** `GET /api/items` → `listItems(userId)`; `POST` with `z.object({ title: z.string().min(1), notes: z.string().optional() })` → `createItem`; `PATCH/DELETE /api/items/[id]` with zod patch (`title?/notes?/status?` enum `open|done`) → `updateItem`/`deleteItem`, 404 via ServiceError when the userId-scoped row is missing.
- [ ] **Step 3: Verify** — typecheck; with keys: curl the routes with a session cookie (401 unauthed, CRUD round-trip authed). Structural fallback: unauthed curl → 401 envelope.
- [ ] **Step 4: Commit** — `feat(web): api conventions — withAuth + error envelope + apiFetch, items CRUD`

---

### Task 7: TanStack Query + IDB kit, dashboard page

**Files:**
- Create: `web/lib/query/{client.ts,persister.ts,keys.ts,prefetch.ts,hydration.tsx}`, `web/app/(main)/dashboard/page.tsx`, `web/app/(main)/dashboard/loading.tsx`, `web/components/items/{items-view.tsx,item-row.tsx}`
- Modify: `web/components/providers.tsx` (QueryClientProvider + persistence startup)
- Port from: monroe `app/src/lib/react-query/{queryClient.ts,persister.ts,queryKeys.ts,hydration.tsx,ReactQueryProvider.tsx}` cross-checked against jobflow `web/lib/query/{client.ts,persister.ts,keys.ts,prefetch.ts}` (jobflow naming wins; note jobflow folds the hydration bridge into `prefetch.ts` rather than a separate `hydration.tsx` — keep jobflow's shape, i.e. `hydration.tsx` is optional and its logic may live in `prefetch.ts`)

**Interfaces:**
- Consumes: `apiJson` (Task 6), items API.
- Produces: `queryKeys.items.list()` factory in `keys.ts`; SSR `prefetchQuery`/`HydrationBoundary` bridge in `prefetch.ts`; IDB persistence with `EXCLUDED_KEY_SEGMENTS = ["jobs"]` (Task 10's dock stays un-persisted); the write-gap fix (persistence starts only after hydration) — carry monroe's `startCachePersistence` mechanism and its comment.

- [ ] **Step 1: Port the kit** (client defaults incl. staleTime tiers, idb-keyval persister, keys factory, hydration bridge). Wire into `providers.tsx`.
- [ ] **Step 2: Dashboard.** RSC page: `requireUser()` → prefetch items → HydrationBoundary → `<ItemsView/>` (client): `useQuery` list + add/toggle/delete mutations with invalidation, ui/ primitives, empty-state, motion press feedback (`motion/react`, tokens from `@/lib/motion`, `useReducedMotion` respected). `loading.tsx` with Skeletons.
- [ ] **Step 3: Verify (keyed)** — CRUD in the browser, reload restores from IDB before network. Structural: typecheck/build.
- [ ] **Step 4: Commit** — `feat(web): tanstack query + idb persistence kit, items dashboard`

---

### Task 8: Mastra slice — agent, chat route, chat page

**Files:**
- Create: `web/lib/mastra/{config.ts,models.ts}`, `web/lib/mastra/middleware/tool-input-sanitizer.ts`, `web/lib/mastra/tools/_shared/createScopedTool.ts`, `web/lib/mastra/tools/list-items.ts`, `web/lib/mastra/agents/assistant.ts`, `web/app/api/chat/route.ts`, `web/app/(main)/chat/page.tsx`, `web/components/chat/chat-view.tsx`
- Port from: jobflow `web/lib/mastra/config.ts`, `models.ts`, `middleware/tool-input-sanitizer.ts`, `tools/_shared/createCareerOpsTool.ts`, jobflow's chat agent + chat API route + chat UI

**Interfaces:**
- Consumes: `authenticate` (Task 4), `listItems` (Task 5).
- Produces: `getMastra()` singleton (PostgresStore on `DATABASE_URL`); `chatModel()` env-overridable (`CHAT_MODEL`, default `claude-haiku-4-5`) wrapped with sanitizer; `createScopedTool` (userId from RequestContext — signature mirrors jobflow's `createCareerOpsTool`); agent id `assistant` with one tool (`list-items`) and an ephemeral-cached static prompt; `POST /api/chat` streaming AI SDK UI messages.

- [ ] **Step 1: Port config/models/middleware/tool-wrapper.** Rename `createCareerOpsTool` → `createScopedTool`. Trim registry to one agent, no workflows/scorers. Keep PinoLogger only if ported trivially; else Mastra default logger.
- [ ] **Step 2: Agent + tool (complete new code, modeled on jobflow's).** Static instructions (~10 lines, foundation-generic "workspace assistant", `cacheControl: ephemeral` via the provider options jobflow uses) + `list-items` tool calling `listItems(userId)` from RequestContext.
- [ ] **Step 3: Chat route + page.** Port jobflow's chat route pattern (authenticate → `getMastra().getAgent("assistant")` → stream with RequestContext carrying userId → AI SDK response) and a trimmed chat page on `@ai-sdk/react` `useChat` with ui/ primitives.
- [ ] **Step 4: Verify** — structural: typecheck/build, `/api/chat` unauthed → 401. Keyed (`ANTHROPIC_API_KEY` + Supabase): send "what items do I have?" → streams and calls the tool. Confirm `mastra_*` tables appear after first run.
- [ ] **Step 5: Commit** — `feat(web): mastra slice — singleton, scoped tool wrapper, assistant agent, streaming chat`

---

### Task 10: Inngest slice — events, run ledger, welcome fn, jobs dock

**Files:**
- Create: `web/lib/inngest/{client.ts,run-ledger.ts}`, `web/lib/inngest/functions/{index.ts,welcome.ts}`, `web/app/api/inngest/route.ts`, `web/app/api/jobs/route.ts`, `web/components/jobs/jobs-dock.tsx`, `web/lib/data/ensure-profile.ts`
- Modify: `web/package.json` (`"dev": "concurrently -k -n next,inngest \"next dev\" \"inngest dev -u http://localhost:3000/api/inngest\""`), `web/app/(main)/layout.tsx` (mount dock; call ensure-profile), `web/app/(main)/dashboard/page.tsx` if profile hook belongs there
- Port from: jobflow `web/lib/inngest/client.ts`, `web/lib/inngest/run-ledger.ts`

**Interfaces:**
- Consumes: `ensureUserProfile` (Task 5), `sendEmail` + welcome template (Task 9).
- Produces: typed event `"user/signed-up"` `{ data: { userId: string, email: string } }` via jobflow's `eventType()`+`staticSchema` pattern; `inngest` client with RunLedgerMiddleware writing `inngestRuns` (queued/running/completed/failed); `GET /api/jobs` → current user's recent runs; `ensureProfile()` server helper that fires the event exactly once (when `ensureUserProfile` returns `created: true`).

- [ ] **Step 1: Port client + run-ledger** (trim `EXCLUDED_EVENTS` to empty; only events with `data.userId` are ledgered — keep that guard and its comment).
- [ ] **Step 2: Welcome function (complete).** On `user/signed-up`: step `send-welcome` → `sendEmail({ to, subject: "welcome to foundation", react: <template or plain fallback>, idempotencyKey: event.id })`. Per-user concurrency 1 (demonstrates the fan-out pattern).
- [ ] **Step 3: Serve route + `ensure-profile.ts`** (called from `(main)/layout.tsx` after `requireUser()`).
- [ ] **Step 4: Jobs dock (minimal, complete new code — not jobflow's full bus).** Client component polling `apiJson("/api/jobs")` every 5s while runs are non-terminal (else 60s), collapsed pill → expandable list (ui/collapsible), query key under `["jobs"]` so persistence exclusion applies.
- [ ] **Step 5: Verify (keyed)** — `corepack pnpm dev` boots both processes; new-user sign-in creates profile → event → run appears in dock with terminal status. Structural: typecheck; `/api/inngest` GET returns the introspection payload.
- [ ] **Step 6: Commit** — `feat(web): inngest slice — typed events, run ledger + dock, welcome fn, dual dev server`

---

### Task 9: Resend slice — env-gated email + welcome template

> Ordered before the Inngest task so `sendEmail` exists when the welcome function is written.

**Files:**
- Create: `web/lib/email/{send.ts,layout.tsx,theme.ts}`, `web/lib/email/templates/welcome.tsx`
- Port from: jobflow `web/lib/email/send.ts`, `web/lib/email/layout.tsx`, `web/lib/email/theme.ts`

**Interfaces:**
- Consumes: nothing beyond Task 2 config; consumed by Task 10's welcome fn.
- Produces: `sendEmail({ to, subject, react, idempotencyKey? }): Promise<{ sent: boolean, id?: string, reason?: string }>` — `{sent:false, reason:"not-configured"}` when `RESEND_API_KEY`/`EMAIL_FROM` unset; `emailConfigured()`; `EmailLayout` shell using theme.ts tokens (dark palette mirroring app tokens).

- [ ] **Step 1: Port send.ts** (env-gated, idempotencyKey passthrough). Port layout/theme, retoken to foundation values, strip jobflow branding/unsubscribe (leave a one-line comment pointing at jobflow's `unsubscribe.ts` as the recipe).
- [ ] **Step 2: Welcome template (complete)** — EmailLayout + two sentences of LANGUAGE_PATTERNS-compliant copy.
- [ ] **Step 3: Verify** — unkeyed: calling `sendEmail` returns `{sent:false, reason:"not-configured"}` (exercised end-to-end once Task 10's welcome fn lands). Keyed (`RESEND_API_KEY`): real delivery. `corepack pnpm typecheck`.
- [ ] **Step 4: Commit** — `feat(web): resend slice — env-gated sendEmail, react-email shell, welcome template`

---

### Task 11: Stripe slice — billing, entitlements, webhook, settings page

**Files:**
- Create: `web/services/billing.ts`, `web/services/entitlements.ts`, `web/app/api/billing/{checkout,portal}/route.ts`, `web/app/api/webhooks/stripe/route.ts`, `web/app/(main)/settings/billing/page.tsx`, `web/components/billing/billing-view.tsx`
- Port from: jobflow `web/services/billing.ts`, `web/services/entitlements.ts`, jobflow's billing + webhook routes

**Interfaces:**
- Consumes: `userBilling`/`stripeEvents` tables (Task 5), `withAuth` (Task 6), `apiFetch` (Task 6).
- Produces: `billingConfigured(): boolean`; `createCheckoutSession(userId) → { url }`, `createPortalSession(userId) → { url }`; webhook handler idempotent via `stripeEvents` ledger + re-fetch-subscription-on-every-event, projecting into `userBilling`; `getPlan(userId) → "free" | "pro"` reading the DB column (never live Stripe); `BILLING_ENFORCED=false` default documented as the kill switch.

- [ ] **Step 1: Port billing.ts/entitlements.ts.** Trim to ONE flat plan (`STRIPE_PRICE_PRO_MONTHLY`); DROP eval-packs/usage metering/trial variants. Keep: source-of-truth comment, projection sync, 503-noop, ledger insert-or-skip, kasava's DB-column rule stated in a comment.
- [ ] **Step 2: Routes + page.** checkout/portal via `withAuth` (503 when `!billingConfigured()`); webhook verifies `STRIPE_WEBHOOK_SECRET` signature, ledger-guards, syncs. Settings page shows current plan + Upgrade/Manage buttons via `apiFetch` redirect.
- [ ] **Step 3: Verify** — structural: unkeyed routes → 503 envelope; typecheck/build. Keyed (test keys + `stripe listen`): checkout → webhook → `userBilling.plan="pro"`.
- [ ] **Step 4: Commit** — `feat(web): stripe slice — flat plan, idempotent webhook ledger, db-column entitlements`

---

### Task 12: PostHog + Sentry (env-gated observability)

**Files:**
- Create: `web/lib/analytics/{posthog-client.tsx,posthog-server.ts}`, `web/instrumentation.ts`, `web/instrumentation-client.ts`
- Modify: `web/components/providers.tsx`
- Port from: jobflow `web/lib/analytics/posthog-server.ts`, jobflow client init, jobflow `instrumentation.ts` pair

**Interfaces:**
- Produces: `PostHogProvider` (no-op without `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`); `captureServer(userId, event, props?)` no-op unkeyed; Sentry stubs that only `Sentry.init` when DSN set — but WITHOUT the `@sentry/nextjs` dependency: write the gate so the import is dynamic and the file compiles with a comment naming the package to install. (Spec: Sentry is a stub, not a dep.)

- [ ] **Step 1: Port + gate all four files** per above (reverse-proxy caveat comment carried on the client init).
- [ ] **Step 2: Verify** — unkeyed boot logs nothing, no network calls to PostHog (network tab); typecheck/build pass WITHOUT `@sentry/nextjs` installed.
- [ ] **Step 3: Commit** — `feat(web): env-gated posthog + sentry stubs`

---

### Task 13: web/ polish — doctor, vercel.json, gates

**Files:**
- Create: `web/scripts/doctor.mts`, `web/vercel.json`
- Port from: jobflow `web/scripts/doctor.mts` (pattern), jobflow `web/vercel.json` (cron shape)

**Interfaces:**
- Produces: `corepack pnpm doctor` — prints table: each env group (required/auth/ai/jobs/billing/email/analytics) → configured / missing / degraded-mode note; exits 1 only if a REQUIRED var is absent. `vercel.json`: empty `crons: []` plus a commented example (`CRON_SECRET`-guarded path).

- [ ] **Step 1: Write doctor.mts** (complete — groups mirror `.env.example` sections; checks DB connectivity when `DATABASE_URL` set with a 2s-timeout `select 1`).
- [ ] **Step 2: Gates** — `corepack pnpm lint && corepack pnpm typecheck && corepack pnpm build && corepack pnpm test && corepack pnpm test:tenancy && corepack pnpm doctor` (stub env: doctor exits 1 listing required vars — expected; note in output).
- [ ] **Step 3: Commit** — `feat(web): doctor script + vercel cron slot; all gates green`

---

### Task 14: `website/` marketing shell

**Files:**
- Create: `website/package.json`, `website/tsconfig.json`, `website/next.config.ts` (with `@next/mdx`), `website/postcss.config.mjs`, `website/app/{layout.tsx,globals.css,page.tsx}`, `website/app/about/page.mdx`, `website/lib/motion.ts`, `website/actions/{safe-action.ts,contact-action.ts}`, `website/components/contact-form.tsx`, `website/.env.example` (`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL`)
- Port from: demokit `demokit-website/src/actions/{safe-action.ts,server-action.ts}` (contact + header-injection sanitization), demokit-website `src/lib/motion.ts`; deps modeled on jobflow `website/package.json` + `@next/mdx` + `next-safe-action` + `react-hook-form` + `@hookform/resolvers`

**Interfaces:**
- Produces: independent app, port 3001 (`next dev -p 3001`), own theme freedom (tokens NOT copied from web/ — plain neutral light+dark start; hallmark's full flow applies per-project later). Contact form posts via next-safe-action → Resend, `{sent:false}` unkeyed.

- [ ] **Step 1: Scaffold** (package.json pnpm-pinned, MDX wired per Next 16 docs, minimal landing: one hero section + contact form section — honest placeholder copy, LANGUAGE_PATTERNS-compliant, no invented metrics).
- [ ] **Step 2: Port the contact recipe** (sanitization intact, fallback from/to emails env-driven).
- [ ] **Step 3: Verify** — `corepack pnpm install && corepack pnpm typecheck && corepack pnpm build`; dev boot renders landing + MDX page; unkeyed contact submit toasts the not-configured message.
- [ ] **Step 4: Commit** — `feat(website): marketing shell — MDX, motion, sanitized Resend contact form`

---

### Task 15: `admin/` ops shell

**Files:**
- Create: `admin/package.json` (port 3002), `admin/tsconfig.json`, `admin/next.config.ts`, `admin/postcss.config.mjs`, `admin/app/{layout.tsx,globals.css,page.tsx,sign-in/page.tsx}`, `admin/lib/auth.ts`, `admin/db/{client.ts,schema.ts}`, `admin/app/users/page.tsx`, `admin/scripts/check-drift.mts`, `admin/.env.example` (`DATABASE_URL`, Supabase pair, `ADMIN_EMAIL_DOMAIN`)
- Port from: jobflow `admin/` (login gate, drizzle client, `check:drift` script, users view)

**Interfaces:**
- Consumes: web's schema shape (schema.ts is a COPY of the tables admin reads: userProfiles, userBilling, inngestRuns).
- Produces: email-domain-gated Supabase login (`ADMIN_EMAIL_DOMAIN`); `/users` table (shadcn table, columns: email, displayName, plan, createdAt); `corepack pnpm check:drift` diffs `admin/db/schema.ts` against `web/db/schema/*` and fails on divergence (port jobflow's script, adjust paths).

- [ ] **Step 1: Port the app** (trim jobflow admin to: sign-in, layout with domain gate, users page; drop ops/usage routes).
- [ ] **Step 2: Verify** — install/typecheck/build; `check:drift` passes; keyed: sign-in with wrong-domain email rejected.
- [ ] **Step 3: Commit** — `feat(admin): ops shell — domain-gated login, users view, schema drift guard`

---

### Task 16: Harness layer + root docs

**Files:**
- Create: `.claude/settings.json`, `.claude/agents/{web-research-analyst.md,nextjs-frontend-expert.md,mastra-workflow-architect.md,design-review-agent.md}`, `.claude/commands/{work.md,style.md,issues.md,think.md,update.md,upgrade.md,visualize.md,design-review.md}`, `.claude/skills/hallmark/`, `.claude/skills/emil-design-eng/`, `AGENTS.md`, `skills-lock.json`, `CLAUDE.md`, `DESIGN_PRINCIPLES.md`, `LANGUAGE_PATTERNS.md`
- Port from: kasava `.claude/agents/*` (the four listed), kasava/monroe `.claude/commands/*`, jobflow `.claude/skills/*`, jobflow `.claude/settings.json` ∪ kasava ∪ monroe (allowlist union minus repo-specific entries), jobflow `AGENTS.md` + `skills-lock.json`, jobflow `DESIGN_PRINCIPLES.md`, jobflow `LANGUAGE_PATTERNS.md`

**Interfaces:**
- Produces: a copied project whose first Claude session already knows the stack's conventions.

- [ ] **Step 1: Port agents/commands/skills.** Generalize agent/command text: strip product names and repo-specific paths (kasava's `frontend/src` → `web/`); drop anything Cloudflare/vector/extension-specific inside the four kept agents.
- [ ] **Step 2: settings.json merge** — union the three repos' `permissions.allow` lists; drop entries naming repo-specific scripts/domains; keep generic tool allowances (corepack pnpm runs, drizzle-kit, tsx scripts, git).
- [ ] **Step 3: DESIGN_PRINCIPLES.md** — port jobflow's, amend the Dark-only section to "dark-first with a maintained light theme; both scopes must define every token; no unpaired vars". LANGUAGE_PATTERNS.md copied verbatim. AGENTS.md ported with paths adjusted.
- [ ] **Step 4: Write `CLAUDE.md`** — assemble from the spec, structure mirroring jobflow's: What this is (2 lines) / Stack list / Commands per app (web: dev·build·lint·typecheck·doctor·db:generate·db:migrate·test·test:tenancy; website; admin incl. check:drift) / Layout map (the spec's tree, condensed) / Conventions, each one line with its why: tenancy chokepoint + RLS reality; withAuth for every API route; createScopedTool (userId from RequestContext, never model args); prompt caching ephemeral; `@mastra/pg` EXACT pin rationale; corepack pnpm; motion-not-framer-motion + dual-package reason; proxy.ts-not-middleware.ts; env-gated degradation table; perf defaults (no force-dynamic, loading.tsx, *-lazy.tsx, explicit column projection, batch inserts, React.cache); Supabase new-style key names / Add-on recipes section naming donor paths (Firecrawl → jobflow `web/lib/firecrawl/client.ts`; PDF → jobflow `web/services/pdf.ts`; org-tenancy swap → kasava `backend/src/middleware/orgScope.ts`; usage-billing → demokit `apps/cloud/src/lib/billing/`; provider-email → monroe `api/src/mail/email/`; token encryption → jobflow `web/lib/crypto/token-encryption.ts`) / Design & copy skills wiring (hallmark structure + emil motion; product-app tokens locked, full theme flow only in website/).
- [ ] **Step 5: Verify** — rename-safety: `grep -rF foundation .claude CLAUDE.md AGENTS.md` hits are all intentional token uses; no jobflow/kasava/monroe/demokit product names remain (`grep -riE 'inrole|kasava|monroe|demokit' CLAUDE.md .claude/ AGENTS.md DESIGN_PRINCIPLES.md` — only the Add-on recipes donor paths section may name them).
- [ ] **Step 6: Commit** — `feat(harness): claude config, agents, commands, skills, CLAUDE.md + governance docs`

---

### Task 17: Success-criteria run + fix-forward

**Files:** none new (fixes only).

- [ ] **Step 1: Full-gate sweep** — in each of web/, website/, admin/: `corepack pnpm lint && corepack pnpm typecheck && corepack pnpm build`. Plus web: `test`, `test:tenancy`.
- [ ] **Step 2: Copy test** — `./new-project.sh smoketest /tmp/foundation-smoke`; `grep -rF foundation /tmp/foundation-smoke` → zero hits; `cd /tmp/foundation-smoke/web && corepack pnpm install && corepack pnpm typecheck && corepack pnpm build` → green. Delete the copy.
- [ ] **Step 3: Keyed slice checklist (needs `web/.env.local` with real keys — Supabase, `DATABASE_URL`, `ANTHROPIC_API_KEY`; Stripe/Resend optional):** sign-up → dashboard; item CRUD persists + IDB restore; chat streams + tool call; welcome run in dock (email real or `{sent:false}` logged); billing 503 (unkeyed) or checkout round-trip (keyed); theme toggle both ways without flash. Record any deferred-for-missing-key items explicitly in the final report — never claim them verified.
- [ ] **Step 4: Spec conformance read-back** — reread the spec top to bottom; list any drift; fix or flag.
- [ ] **Step 5: Final commit** — `chore: success-criteria sweep` + update bd issues (close per-task issues).
