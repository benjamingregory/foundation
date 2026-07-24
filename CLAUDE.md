# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

foundation is a copyable starter for Next.js SaaS products: Next 16 + Supabase + Drizzle + Mastra + Stripe + Resend + Inngest, with shadcn (Base UI) components on Tailwind v4. Three sibling apps — `web/` (product), `website/` (marketing), `admin/` (ops shell) — each independently deployable.

## Getting started

After copying the skeleton with `./new-project.sh <name> <target>`, run the `project-init` skill once from inside the new project. It provisions the external services — Supabase is required to boot; Vercel, Stripe, GitHub, Resend, Anthropic, Inngest, and PostHog are optional — and writes the resulting keys into each app's `.env.local`. See [.claude/skills/project-init/SKILL.md](.claude/skills/project-init/SKILL.md).

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind CSS v4**
- **Mastra** for agent/workflow orchestration; **Anthropic Claude** via the AI SDK
- **Supabase Postgres** + **Drizzle ORM**
- **Base UI (`@base-ui/react`)** + **shadcn** for component primitives
- **Motion** (`motion/react`) for animation
- **Stripe** for billing, **Resend** for transactional email, **Inngest** for background jobs
- Package manager: **pnpm**, invoked via **corepack** (see § corepack below)

## Commands

There is **no root `package.json`** — three independent apps, each with its own `package.json`, lockfile, and Vercel project. `cd` into the app before running its scripts, or use `corepack pnpm -C <app> <script>`.

### `web/` (product app, port 3000)

```bash
corepack pnpm dev             # Next dev server + Inngest dev server together
corepack pnpm build           # Production build
corepack pnpm lint            # ESLint
corepack pnpm typecheck       # tsc --noEmit
corepack pnpm doctor          # Environment/config health check
corepack pnpm db:generate     # Generate a Drizzle migration from schema changes
corepack pnpm db:migrate      # Apply migrations
corepack pnpm test            # Vitest
corepack pnpm test:tenancy    # Structural tenancy guard (see Conventions below) — no DB needed
```

### `website/` (marketing site, port 3001)

```bash
corepack pnpm dev             # next dev -p 3001
corepack pnpm build
corepack pnpm lint
corepack pnpm typecheck
```

### `admin/` (ops shell, port 3002)

```bash
corepack pnpm dev             # next dev -p 3002
corepack pnpm build
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm check:drift     # Static diff of admin/db/schema.ts against web/db/schema — no DB needed
```

## Layout

```
web/
  app/                  # Next App Router: (auth)/, (main)/, api/
  lib/
    auth/                # session helpers, authenticate()
    api/                 # withAuth wrapper
    data/                # client-side data helpers (api-fetch, ensure-profile)
    email/               # sendEmail, templates, theme
    inngest/              # client + functions/
    mastra/               # agents/, prompts/, tools/, models
    query/                # TanStack Query client, keys, persister, prefetch
  db/
    client.ts            # getDb() — globalThis-cached
    schema/
    repositories/         # userId-scoped query helpers
    migrations/
  services/               # business logic shared across routes/agents/workflows
  components/
    ui/                   # Base UI + shadcn primitives
    items/ chat/ jobs/ billing/
  scripts/                # doctor, test-tenancy, db:migrate, etc.
website/                  # standalone marketing app, own tokens
admin/                    # standalone ops shell, own tokens, own DB client
```

## Conventions

- **Tenancy** — every user-scoped query needs `eq(table.userId, userId)`. RLS is **not** in the request path: the app connects to Postgres as the `postgres` role, which has `BYPASSRLS`, so RLS policies never evaluate at request time. `pnpm test:tenancy` enforces this statically — it scans `db/repositories/*.ts` for exported functions (both `export function` and `export const ... = (...) => ...` shapes) that run a Drizzle query (`.select`/`.insert`/`.update`/`.delete`/`.from`) and fails loud if none of `eq(table.userId, userId)` (or, for insert-only functions, `userId` in the first `.values()`) is present. Repository files whose name starts with `_` are skipped by the scanner (e.g. `_shared.ts`) — don't put a real query-running repository in a `_`-prefixed file expecting it to be checked. System-level writes that are legitimately cross-tenant (Inngest's run-ledger, Stripe webhook projection keyed by customer id) live in `lib/` or `services/`, not `db/repositories/`, so they sit outside the scanner's scope entirely. A genuinely cross-tenant function that must live in `db/repositories/` uses the greppable allowlist: either a `CROSS_TENANT_OK["file.ts#functionName"] = "reason"` entry in the script, or an inline `// tenancy-check: cross-tenant-ok <reason>` comment — both require a stated reason, so a review can ask whether it's still true.
- **API routes** — use `withAuth` (`lib/api/with-auth.ts`): authentication, zod body validation, a rate-limit bucket, and the `{ error: { code, message } }` envelope, all from one config object instead of hand-rolled per route. `userId` comes only from the trusted session `withAuth` resolves — never trust a `userId` in the request body.
- **Mastra tools** — use `createScopedTool` (`lib/mastra/tools/_shared/createScopedTool.ts`), never raw `createTool`. `userId` is pulled from the trusted Mastra `RequestContext`, never accepted as a model-supplied argument — the confused-deputy prevention that keeps a prompt injection from making a tool call read or write another user's data. Prompts are assembled with `@kasava/prompt-builder`. Static system prompt segments get `cacheControl: { type: "ephemeral" }` so Anthropic's prompt cache covers them across requests.
- **`@mastra/pg` is pinned EXACT** (no caret) in `web/package.json` — a caret-range bump has previously 500'd every Mastra route because `@mastra/pg`'s dist couples tightly to `@mastra/core`'s exports. Bumping `@mastra/core` *within its own caret range* may be **required** to satisfy `@mastra/pg`'s peer expectations after a Mastra-adjacent change — after touching anything in `lib/mastra/`, verify `getMastra()` still loads before calling the change done. Both pinned Mastra packages are listed in `web/pnpm-workspace.yaml`'s `minimumReleaseAgeExclude` so a fresh install doesn't silently drift them forward.
- **corepack** — always run pnpm as `corepack pnpm ...`, not a bare `pnpm ...`. The repo's `packageManager` field pins pnpm 11; a shell-installed pnpm 9 fails to parse the workspace files (`packages field missing`) and produces confusing, unrelated-looking errors.
- **Motion, never `framer-motion`** — import from `motion/react`. The two packages instantiate separate React contexts; if both end up in the dependency tree, you get two independent `AnimatePresence` trees that can't coordinate exit animations. `components/ui/skeleton.tsx` is a deliberate exception — CSS-only, so motion stays off the universal loading-state critical path.
- **`proxy.ts`, not `middleware.ts`** — Next 16 renamed the middleware entry file. `web/proxy.ts` and `admin/proxy.ts` are where session refresh and route gating live for those two apps.
- **`getDb()` is globalThis-cached** (`db/client.ts`) — under `next dev`, HMR re-evaluates modules on every invalidation; a module-scope cache would leak a fresh connection pool per reload until the Postgres pooler hits its connection cap. Only the underlying pool is cached unconditionally; the drizzle wrapper is rebuilt (cheap, allocation-only) whenever the schema module identity changes, so a repository added after the dev server started doesn't throw on a stale schema reference.
- **Env-gated degradation** — only Supabase auth and `DATABASE_URL` are required to boot. Everything else degrades instead of crashing:

  | Missing env | Behavior |
  |---|---|
  | `RESEND_API_KEY` / `EMAIL_FROM` | `sendEmail()` returns `{ sent: false, reason: "not-configured" }` instead of throwing |
  | `STRIPE_SECRET_KEY` | Billing routes (`/api/billing/checkout`, `/api/billing/portal`) return `503` |
  | `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | PostHog client never calls `init()` — every `posthog.*` call downstream is a no-op |
  | `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Sentry no-ops |
  | `ANTHROPIC_API_KEY` | Chat and Mastra agent routes need this — no fallback |
  | `INNGEST_DEV` | Local Inngest dev mode is off; without it (and without real Inngest keys) `inngest.send()` runs in cloud mode against nothing |

  Supabase env vars use the **new-style key names** — `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`, not the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`. `corepack pnpm doctor` reports which optional integrations are configured.
- **Next.js perf defaults** — no `export const dynamic = "force-dynamic"` (routes that read cookies/auth are already dynamic; the export is redundant and blocks future caching opt-ins); a sibling `loading.tsx` with `Skeleton` for any route doing meaningful server-side data fetching; a `*-lazy.tsx` `dynamic(() => import(...), { ssr: false })` wrapper for client components pulling in >30KB of deps; `React.cache()` for per-request dedupe of user-scoped loaders called from multiple components in one render; explicit column projection (`db.select({ id: ..., ... })`, never a bare `db.select()`) on tables with large/binary columns; batched Drizzle writes (`.values([row1, row2])`) instead of looping single-row inserts inside a transaction.
- **Migrations** — `corepack pnpm db:generate` to produce migration SQL from a schema change, `corepack pnpm db:migrate` to apply it. Never hand-edit a generated migration file.

## How work gets done

This project is wired for a specific operating loop. The skills, plugins, subagents, and slash commands below are not a menu to browse when something feels hard — each one owns a named point in the loop, and the loop is the default procedure for every unit of work.

### The toolchain

| Layer | Tool | Owns | Availability |
|---|---|---|---|
| Tracking | **bd** (beads) | Every unit of work, from intake to close. The only tracker — never TodoWrite, never a markdown checklist. | Vendored (`.beads/`) |
| Process | **superpowers** | How work is framed, planned, executed, debugged, reviewed, and verified. Sets the approach that everything else executes inside. | Plugin |
| UX strategy | **intent** | *What should exist and for whom.* Problem framing, research, user autonomy, evidence, measurement, anti-patterns. | `npx skills add ghaida/intent --all` |
| Structure | **hallmark** | *What goes where.* Layout, hierarchy, section rhythm, slop/honesty/a11y/responsive gates. Required for UI work. | `npx skills add nutlope/hallmark` — pinned in [skills-lock.json](skills-lock.json) |
| Specifics + passes | **impeccable** | The design vocabulary (`frontend-design`), plus `/audit`, `/critique`, `/polish`, `/animate` as focused passes over a surface that already exists. | User-level plugin, [impeccable.style](https://impeccable.style) |
| Motion + taste | **emilkowalski/skills** (7) | *How it moves,* and which library it's built on. `emil-design-eng` is the main one; the other six are listed under § Design & Copy. | `npx skills add emilkowalski/skills` |
| Bootstrap | **project-init** | One-time external-service provisioning for a fresh copy of the skeleton. | Vendored (`.claude/skills/`) — the only vendored skill |
| Domain depth | **subagents** | `nextjs-frontend-expert` (App Router / Tailwind / Base UI / Drizzle / Supabase), `mastra-workflow-architect` (agents, workflows, scoped tools), `web-research-analyst` (external research), `design-review` (live-environment UI review via Playwright). | Vendored (`.claude/agents/`) |
| Local commands | **slash commands** | `/design-review`, `/think`, `/visualize`, `/style`, `/update`, `/upgrade`, `/issues`, `/work`. | Vendored (`.claude/commands/`) |

Two notes on precedence. **Process skills come first** — they decide the approach, and the design and domain tools execute inside the plan those skills produce; don't jump to `hallmark` or `nextjs-frontend-expert` without the process gate that precedes it. And **bd outranks the GitHub-issue commands**: `/issues` and `/work` are carried over for projects that track work in GitHub Issues instead, so use them only if this project has actually switched.

### The loop

| Gate | Fires when | What runs | Exit criterion |
|---|---|---|---|
| **G0 · Intake** | Any request arrives | `bd create` (or `bd show` an existing one), then `bd update <id> --claim`. Classify the track: **creative** / **bug** / **UI** / **mechanical**. | An issue exists and is claimed, and you know which track you're on. |
| **G1 · Intent** | New surface, new flow, or a feature whose value is assumed rather than evidenced | `intent` — frame the problem, name the user, state the evidence, decide how it will be measured. | The purpose is written down and agreed. Skip for a visual change to something already settled. |
| **G2 · Design** | Creative track | `superpowers:brainstorming` → a spec in `docs/superpowers/specs/`. | **Breakpoint: a human approves the spec.** No implementation code before this. |
| **G3 · Plan** | Creative track, spec approved | `superpowers:writing-plans` → a plan in `docs/superpowers/plans/`. | **Breakpoint: a human approves the plan.** Tasks are small enough to review one at a time. |
| **G4 · Structure** | Any UI work — new surface, redesign, or an audit of UI you didn't write | `hallmark`, before any layout code. Cross-check against [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md). | Structure decided, tokens confirmed locked, no new palette or font proposed. |
| **G5 · Build** | Plan approved | `superpowers:subagent-driven-development` (fresh subagent per task) or `executing-plans`, with `superpowers:test-driven-development` inside each task. On the **bug** track, `superpowers:systematic-debugging` replaces G1–G4 entirely — reproduce first, fix second. Reach for `nextjs-frontend-expert` / `mastra-workflow-architect` where the task is squarely in their domain. **A task that wants a new UI dependency stops here** and runs `pick-ui-library` — check `components/ui/` first, and never hand-roll a primitive that already exists. | Each task ends green on its own gates and gets a review before the next one starts. |
| **G6 · Polish** | A UI surface is functional but not finished | impeccable `/critique` (hierarchy, clarity) → fix → `/polish` (pre-ship detail). Then the motion pass: `find-animation-opportunities` to decide *where* motion earns its place (and what to leave still), `emil-design-eng` to implement it, `animation-vocabulary` when you need to say precisely what you want. | The surface survives a critique pass without a structural rewrite, and every animation on it was a decision rather than a default. |
| **G7 · Machine gates** | Before any review, and before any claim of done | The command block below. | All green. A red gate is a stop, not a note for later. |
| **G8 · Review** | Branch ready | `superpowers:requesting-code-review`; for UI, `/design-review` or the `design-review` subagent against a running dev server (both need a live preview + Playwright, so start the server first), plus `review-animations` if the change touched motion. Then `superpowers:receiving-code-review`. | Findings are triaged: fixed, or filed with `bd create` and linked. |
| **G9 · Verify & close** | Everything above is green | `superpowers:verification-before-completion`, then `bd close`, commit, **`git push`**, and `bd remember` for anything a future session would otherwise have to rediscover. | `git status` shows up to date with origin. Work is not done until push succeeds. |

### Tracks — what each one skips

- **Creative** (new feature, surface, behavior) — the full loop, G0 through G9.
- **UI** — the full loop, with G1 and G4 mandatory and G6 non-negotiable before review.
- **Bug** — G0 → `systematic-debugging` → G5 → G7 → G9. No brainstorm, no plan document; a reproduction case is the spec.
- **Mechanical** (rename, dependency bump, config edit, doc fix) — G0 → G5 → G7 → G9. Don't spend a spec on it. If it grows a design question mid-flight, stop and re-enter at G2.

### Hard stops

Each of these is a breakpoint, not a preference. Hitting one means stop and resolve it, not note it and continue.

1. **No implementation code before an approved spec and plan** on the creative track.
2. **No new UI surface without `hallmark` first.** Auditing UI you didn't write counts.
3. **No repository query without `eq(table.userId, userId)`.** `test:tenancy` catches it, but don't outsource the thought to the scanner.
4. **No new palette, `font-family`, or inline hex/OKLCH in `web/` or `admin/`** — the tokens in [web/app/globals.css](web/app/globals.css) are the theme. `website/` is the one exception.
5. **No secret outside a gitignored `.env.local`**, and never echoed back in a message, a log, a commit, or a `.superpowers/sdd/` note.
6. **No outward-facing or hard-to-reverse action without confirmation** — creating a cloud resource, force-pushing, sending an email, running a migration against a live database.
7. **No claim of done** without `verification-before-completion`, green gates, and a successful `git push`.
8. **No TodoWrite, no markdown TODO list.** bd is the tracker.

### Rhythms

| Cadence | Trigger | What runs |
|---|---|---|
| Per task | A task inside a plan finishes | Machine gates for the touched app, then a fresh-subagent review before the next task starts |
| Per surface | A UI surface becomes functional | G6: `/critique` → fix → `/polish` → `find-animation-opportunities` → `emil-design-eng` |
| Motion sweep | Occasionally, or when the UI feels inert or twitchy | `improve-animations` — audits every animation in the codebase and returns prioritized, self-contained plans; feed each one in as a bd issue rather than executing them all in one pass |
| Session open | Starting work | `bd ready`, `bd show <id>`, `bd update <id> --claim` |
| Session close | Ending work | The Session Completion protocol above — gates, `bd close`, commit, push, `bd remember` |
| Per branch | Before requesting review | G7 + G8, in that order |
| After a dependency bump | `corepack pnpm update`, or a bot PR | `/upgrade` to surface what the new versions make possible; re-verify `getMastra()` loads if anything Mastra-adjacent moved |
| Drift check | Roughly monthly, or when the docs start lying | `/update` (CLAUDE.md drift), `/style` (convention drift), `bd doctor --check=conventions`, `bd stale`, `bd orphans` |

### Machine gates

Ordered so the cheapest failure comes first.

```bash
corepack pnpm -C web typecheck
corepack pnpm -C web lint
corepack pnpm -C web test
corepack pnpm -C web test:tenancy     # cross-tenant leak guard — see § Conventions
corepack pnpm -C web build

# only if you touched web/db/schema/ or admin/
corepack pnpm -C admin typecheck && corepack pnpm -C admin check:drift

# only if you touched website/
corepack pnpm -C website typecheck && corepack pnpm -C website build

# after any env or service change
corepack pnpm -C web doctor
```

Plus the copy gate whenever user-facing text changed — the two `grep` commands at the bottom of [LANGUAGE_PATTERNS.md](LANGUAGE_PATTERNS.md), aiming for zero hits.

### Where the artifacts live

Specs in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/`. This skeleton's own build is the worked example: [the design spec](docs/superpowers/specs/2026-07-22-foundation-skeleton-design.md) → [the implementation plan](docs/superpowers/plans/2026-07-22-foundation-skeleton.md). The subagent-driven-development execution ledger lives in `.superpowers/sdd/` — gitignored scratch, not a deliverable. Durable findings go to `bd remember`, not to a new markdown file.

## Design & Copy

Four altitudes of design skill — this is the depth behind gates **G1**, **G4**, and **G6** above.

**Every design skill here is installed, not vendored.** [skills-lock.json](skills-lock.json) pins each one by source and content hash; `npx skills add` writes the payload to `.agents/skills/` and symlinks it into `.claude/skills/`, both gitignored. The lockfile is the source of truth, so the skeleton ships a pin rather than a copy and an install picks up upstream fixes instead of freezing a snapshot. The `project-init` skill runs the installs. `project-init` itself is the only skill vendored in this repo. `intent` and `impeccable` are user-level plugins. Anything not installed is simply unavailable, not required — but hallmark is expected, so install it.

**Design with Intent (`intent`) comes first, before any pixel** — gate G1. It's a UX strategy system — problem framing, research, user-autonomy protection, evidence-based decisions, accessibility, measurement, and handoff, plus a catalogue of anti-patterns. Reach for it when the question is *what should exist and for whom*, not *what should it look like*: a new product surface, a flow that isn't converting, a feature whose value is assumed rather than evidenced. It sits upstream of hallmark — settle the intent, then the structure. Install: `npx skills add ghaida/intent --all` or `/plugin marketplace add ghaida/intent` ([ghaida/intent](https://github.com/ghaida/intent), CC0).

**Hallmark is required for UI work, not a nicety** — gate G4. Invoke the `hallmark` skill before building a new surface, redesigning an existing one, or auditing UI you didn't write — it enforces structural variety, honest copy (no fabricated metrics or testimonials), locked design tokens, no re-drawn browser/phone chrome, and mobile verification at 320/375/414/768px. It is the structural gate: what goes where, and whether the result reads as generic.

**Impeccable is the design vocabulary and the targeted-pass toolkit** — gate G6. Its `frontend-design` skill carries seven reference domains — typography, color-and-contrast (OKLCH, tinted neutrals, dark mode), spatial design, motion, interaction, responsive, and UX writing — and is where to look for the *why* behind a specific decision. Its commands drive focused passes once a surface exists, and they are not interchangeable:

| Command | Asks | Run it when |
|---|---|---|
| `/critique` | Is the hierarchy right? Is the clearest thing the most important thing? | First, as soon as the surface is functional — before any detail work, since a critique finding can invalidate it |
| `/polish` | Is the detail right? Spacing, alignment, states, edge cases | After critique findings are fixed, before review |
| `/animate` | Does it move well? | Last, on a settled surface |
| `/audit` | Does it hold up technically? a11y, performance, responsive | Before review, and any time you inherit UI you didn't write |

Run `/teach-impeccable` once per project to record its design context.

**Emil Kowalski's skills own motion and UI taste** — seven of them, installed together with `npx skills add emilkowalski/skills` ([emilkowalski/skills](https://github.com/emilkowalski/skills), MIT). They exist because agents reliably pick the wrong easing and hand-roll primitives that already exist; each one names the specific mistakes and the fix.

| Skill | Gate | Use it for |
|---|---|---|
| `emil-design-eng` | G6 | The main one. Implements motion once structure is settled — easing curves, durations, gesture handling, `prefers-reduced-motion`. Plus general design advice. |
| `find-animation-opportunities` | G6, first | Where motion would genuinely help — and, as importantly, what to leave still. Run before animating, not after. |
| `animation-vocabulary` | G6, as needed | Naming what you want precisely enough to get it. Reach for this when a motion note keeps coming back wrong. |
| `review-animations` | G8 | A strict review pass over the motion you shipped. Pairs with `/design-review`. |
| `improve-animations` | Rhythm | A codebase-wide animation audit returning prioritized, self-contained plans. File each plan as a bd issue; don't execute the whole set in one pass. |
| `pick-ui-library` | G5 | Before adding any UI dependency. Check `components/ui/` first — this project already has Base UI + shadcn — then use this rather than hand-rolling a toast or installing an abandoned package. |
| `apple-design` | G4/G6 reference | Apple's interface and fluid-motion principles, translated for the web. Reference material, like impeccable's `frontend-design`. |

Note the overlap with impeccable's `/animate`: `/animate` proposes motion, `emil-design-eng` implements it against this project's Motion conventions (`motion/react`, never `framer-motion`). Running both is fine; running neither is not.

Order: intent settles what the surface is for → hallmark decides its structure → impeccable's references inform the specifics and its commands critique/polish/audit the result → emil's skills decide and implement the motion. Skip intent for a purely visual change to something whose purpose is already settled; don't skip it when the thing itself is new.

**Design review is a separate, later gate** (G8) and needs a live environment: start the dev server, then run `/design-review` or dispatch the `design-review` subagent. It drives a real browser through the change at 320/375/414/768px and reports what it saw — it is not a substitute for G4 or G6, which happen before the code is written and before it's finished, respectively.

**The token lock binds every one of them.** In `web/` and `admin/` the palette and type are already chosen ([app/globals.css](web/app/globals.css) defines every color token in both `:root` and `.dark`): hallmark's 22-theme catalog and custom-palette flow are **off**, and impeccable's color and typography guidance is reference material only — neither may emit a new palette, a new `font-family`, or an inline hex/OKLCH value. Lift a new token into globals.css deliberately or reference an existing one. Full theme-selection flow, palette included, applies **only** in `website/`, the standalone marketing app with its own tokens. Consult [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md) for where this document overrides a skill's page-level defaults.

Consult [LANGUAGE_PATTERNS.md](LANGUAGE_PATTERNS.md) before writing or editing user-facing copy — banned words, banned filler openers, voice rules. Never use a Sparkles/Wand icon or any "✨" glyph to signal "AI" — use a concrete, domain-specific icon instead.

## Add-on recipes

These are **not shipped** in this skeleton — they're conventions from sibling projects worth reaching for by name when a project actually needs the capability, rather than reinventing it:

- **Firecrawl (web scraping)** → jobflow `web/lib/firecrawl/client.ts`
- **PDF rendering** → jobflow `web/services/pdf.ts`
- **Org-tenancy / RBAC** (swap in for single-user `userId` scoping) → kasava `backend/src/middleware/orgScope.ts`
- **Usage-based billing** (beyond Stripe's flat subscription flow already in this skeleton) → demokit `apps/cloud/src/lib/billing/`
- **Provider-interface email** (swap Resend for another provider behind one interface) → monroe `api/src/mail/email/`
- **Token encryption** (encrypting OAuth tokens or other secrets at rest) → jobflow `web/lib/crypto/token-encryption.ts`
- **Sentry** → `corepack pnpm add @sentry/nextjs`, then wire both `register()` **and** an `onRequestError` export — the stub in most Sentry quick-starts omits the request-error hook, which is the one that actually reports server-side errors from route handlers.
