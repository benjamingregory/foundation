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
  | `RECRAFT_API_TOKEN` | Nothing — no request path reads it. Reserved for the runtime-image-generation recipe in § Add-on recipes. Design-time image generation uses the Recraft MCP server, which authenticates over OAuth and needs no env var. |

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
| Motion + taste | **emilkowalski/skills** (4 of 7) | *How it moves,* and which library it's built on. `emil-design-eng` is the main one; see § Design & Copy. | `npx skills add emilkowalski/skills` |
| Marketing pages | **design-taste-frontend** | Page-level work in `website/` **only** — its own scope excludes product UI. One of tasteskill's 14 skills; the other 13 are out, and three of them are commonly installed user-level anyway. See § The tasteskill family. | `npx skills add https://github.com/Leonxlnx/taste-skill --skill design-taste-frontend` |
| Image generation | **Recraft** | The image tool `brandkit` and `imagegen-frontend-web` call. Raster and production-grade **vector/SVG** output — logos, icons, marketing comps. Optional, `website/`-scoped. See § Recraft. | MCP server, declared in [.mcp.json](.mcp.json) |
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
| **G6 · Polish** | A UI surface is functional but not finished | impeccable `/critique` (hierarchy, clarity) → fix → `/polish` (pre-ship detail). Then the motion pass: `find-animation-opportunities` to decide *where* motion earns its place (and what to leave still), then `emil-design-eng` to implement it. | The surface survives a critique pass without a structural rewrite, and every animation on it was a decision rather than a default. |
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

**Design with Intent (`intent`) comes first, before any pixel** — gate G1. It installs **17 skills**, not one. `intent` itself is the entry point and router; the rest are reachable directly once you know what you need:

| Skill | Owns | Gate |
|---|---|---|
| `investigate` | User research — planning through synthesis | G1 |
| `journey` | End-to-end flows, multi-step workflows, navigation structure | G1/G2 |
| `organize` | Information architecture — findability, wayfinding, taxonomy | G2 |
| `wireframe` | Screen anatomy at pre-visual fidelity — what goes where and why | G2, before hallmark |
| `articulate` | Product words — labels, errors, confirmations, empty states, onboarding | G5/G6 |
| `include` | Accessibility as a design discipline, not a compliance pass | G1/G6 |
| `measure` | Success metrics, measurement frameworks, experimentation | G9/post-ship |

Eight of intent's 17 are deliberately not installed. `fortify` duplicates impeccable's `/harden` outright — both are "design for every condition outside the happy path" — and impeccable is already installed at zero marginal cost. `strategize` and `philosopher` duplicate `superpowers:brainstorming`; `specify` duplicates `writing-plans` in a loop where one agent both designs and implements; `evaluate` is a fourth review pass behind `/design-review`, `/audit`, and `review-animations`; `blueprint` overlaps `journey` and `organize` with nothing yet to map. `localize`, `transpose`, and `storytelling` are absent because this project has no i18n surface, no non-web platform, and no design-presentation step. Add any of them back with `npx skills add ghaida/intent --skill <name>` if the project grows into it.

**Hallmark is required for UI work, not a nicety** — gate G4. Invoke the `hallmark` skill before building a new surface, redesigning an existing one, or auditing UI you didn't write — it enforces structural variety, honest copy (no fabricated metrics or testimonials), locked design tokens, no re-drawn browser/phone chrome, and mobile verification at 320/375/414/768px. It is the structural gate: what goes where, and whether the result reads as generic.

**Impeccable is the design vocabulary and the targeted-pass toolkit** — gate G6. Its `frontend-design` skill carries seven reference domains — typography, color-and-contrast (OKLCH, tinted neutrals, dark mode), spatial design, motion, interaction, responsive, and UX writing — and is where to look for the *why* behind a specific decision. It ships 17 more user-invokable skills; they are **not** interchangeable, and three of them actively fight this project's constraints.

| Skill | Use at | Notes |
|---|---|---|
| `/critique` | G6, first | Hierarchy, information architecture, clarity. Run before detail work — a critique finding can invalidate it. |
| `/polish` | G6, after critique fixes | Alignment, spacing, consistency, the pre-ship detail pass. |
| `/audit` | G7/G8 | a11y, performance, theming, responsive, with severity ratings. Also whenever you inherit UI you didn't write. |
| `/distill`, `/quieter`, `/normalize` | G6, as needed | Removing complexity, toning down, making things consistent. These pull the same direction as [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md) — reach for them freely. |
| `/adapt`, `/clarify`, `/harden`, `/optimize` | G6/G7 | Responsive, copy clarity, edge cases, performance. |
| `/animate` | **Don't** — use emil's sequence | Overlaps `find-animation-opportunities` + `emil-design-eng`, which are the motion authority here. See § When skills disagree. |
| `/colorize` | **`website/` only** | Its purpose is adding new color. In `web/`/`admin/` that breaks the token lock. |
| `/bolder`, `/delight` | **`website/` only** | They amplify visual interest. This is a dense productivity tool — `/distill` and `/quieter` are the right direction here. |

Run `/teach-impeccable` once per project so its passes know the token lock and the density rules; without it, the defaults above bite harder. See § Once per project for the rest of the one-time setup.

**The tasteskill family — one of fourteen is pinned, and three more are probably already on your machine.** [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill), MIT, ships 14 entries under `skills/` — 13 skills and an `llms.txt`. [skills-lock.json](skills-lock.json) pins exactly one of them, `design-taste-frontend` (upstream `taste-skill`). The install command is per-skill for a reason: `npx skills add https://github.com/Leonxlnx/taste-skill` with no `--skill` pulls in all of them and silently undoes the curation. But `brandkit`, `imagegen-frontend-web`, and `redesign-existing-projects` are commonly installed at the **user** level, where they're reachable in every project regardless of this lockfile — so their boundary has to be stated rather than assumed.

| Skill | Verdict | Fires when |
|---|---|---|
| **`design-taste-frontend`** | **Pinned.** G4, `website/` only | Page-level work on a marketing page — a new page or a redesign of one. Its own § 11 carries the redesign protocol (preserve-vs-overhaul mode detection, brand-token extraction, SEO baseline, a never-change-silently list covering slugs, nav labels, and form field names), so `website/` redesigns stay here too. Never in `web/` or `admin/`. |
| **`brandkit`** | **Pre-project only** | The brand doesn't exist yet — logo system, identity board, visual world. That's a decision made *before* `website/`'s tokens are written, not a step inside the loop; once tokens exist its output competes with them. Generates images, so it needs Recraft (§ Recraft) — with no image tool it produces nothing. |
| **`imagegen-frontend-web`** | **`website/` only, optional, before G4** | Per-section reference comps for a marketing page whose direction is genuinely unsettled — one horizontal image per section, deliberately not one tall board. The output is a reference for the build, never the spec; tokens still come from `website/`'s own CSS. Also needs Recraft. Never for `web/`/`admin/` — its entire vocabulary is hero, CTA, and landing section. |
| **`redesign-existing-projects`** | **Don't** | Cut on both sides. In `web/`/`admin/` its audit opens with "replace the font" and "pick one accent color, remove the rest" — hard stop #4, stated as a fix rather than a suggestion. In `website/`, `design-taste-frontend` § 11 is the better redesign path: it detects the mode, extracts existing brand tokens before recoloring, and treats SEO migration as the top risk, none of which this one does. To audit UI you inherited, use `/audit` (technical) or hallmark's audit mode (structural). |
| The other ten | **Not installed, don't add** | `brutalist-skill` / `minimalist-skill` / `soft-skill` are theme presets — exactly the theme-selection category this project disables. `taste-skill-v1` is the superseded version of the pinned skill. `gpt-tasteskill` and `image-to-code-skill` retarget the same material at other harnesses (GPT, Codex) and mandate GSAP-heavy and image-first workflows this project doesn't run. `stitch-skill` emits a `DESIGN.md` for Google Stitch; `imagegen-frontend-mobile` targets native app screens; `output-skill` is a generic anti-truncation prompt override; `llms.txt` isn't a skill. |

**Recraft is the image tool behind the two that generate images.** [recraft.ai](https://www.recraft.ai/docs), declared as an MCP server in [.mcp.json](.mcp.json) alongside Playwright. `brandkit` and `imagegen-frontend-web` are the only two skills here that can't degrade — every other skill still produces *something* when a dependency is missing, but an image skill with no image tool produces nothing at all. `corepack pnpm doctor` reports it in the loop-gates block for that reason.

- **Authorize before first use.** The server is Streamable HTTP over OAuth, so `.mcp.json` holds a URL and no secret — which is why it's committed. Declaring it isn't the same as being able to call it: run `/mcp` once to complete the OAuth flow. Doctor probes the config, not the token, so it reports ready either way.
- **Two balances, not one.** The MCP server spends **subscription credits** (the same balance as the Recraft app). The REST API spends **pre-purchased API units** ($1 = 1,000 units), and Recraft only offers you an API token once that unit balance is above zero. Topping up one does nothing for the other. This catches people out.
- **Vector is the differentiator.** The `*-vector` models emit real SVG, which is what makes it worth having for logos and icons rather than another raster generator. Roughly: V4.1 raster $0.035/image, V4.1 Vector $0.08, the Pro (4MP) tiers $0.21–$0.30, vectorizing an existing raster $0.01. A per-section comp pass over an 8-section page is well under a dollar — but it's real money, so it's an opt-in step, not a default.
- **Design-time only, here.** Nothing in `web/` calls Recraft at runtime. The `RECRAFT_API_TOKEN` row in doctor and `.env.example` is reserved for the add-on recipe below, not read by any request path.
- **The token lock still binds it.** Generated imagery for `website/` is an asset, not a license to introduce a palette; in `web/`/`admin/` there's no reason to call it at all. Never ship a generated image as a fake product screenshot — `design-taste-frontend` § 9.F bans div-based fake UI, and a generated one is the same lie with better rendering.

`design-taste-frontend`'s edge over hallmark on marketing pages is the front half: a stated one-line "design read" before generating (*page kind, audience, vibe, leaning*), one clarifying question rather than a dump, and an explicit anti-default list (AI-purple gradients, centered hero over dark mesh, three equal feature cards, glassmorphism-on-everything, Inter + slate-900). Its § 14 pre-flight is a ~60-box gate covering theme lock, accent consistency, eyebrow count, and the em-dash ban. Note it *does* name typefaces and map briefs to design systems — fine in `website/`, which owns its tokens; fatal in the product apps.

**Splitting `website/` between the two, since both do structure:** page-level work there goes to `design-taste-frontend`; component-level work anywhere, including `website/`, goes to hallmark's Component-scope flow. tasteskill has no component path at all, and hallmark's pre-flight adopts existing tokens instead of inventing them. `web/` and `admin/` remain hallmark's entirely, at every scope.

**Emil Kowalski's skills own motion and UI taste** — four of the seven, installed with `npx skills add emilkowalski/skills` ([emilkowalski/skills](https://github.com/emilkowalski/skills), MIT). They exist because agents reliably pick the wrong easing and hand-roll primitives that already exist; each one names the specific mistakes and the fix.

| Skill | Gate | Use it for |
|---|---|---|
| `emil-design-eng` | G6 | The main one. Implements motion once structure is settled — easing curves, durations, gesture handling, `prefers-reduced-motion`. Plus general design advice. |
| `find-animation-opportunities` | G6, first | Where motion would genuinely help — and, as importantly, what to leave still. Run before animating, not after. |
| `review-animations` | G8 | A strict review pass over the motion you shipped. Pairs with `/design-review`. |
| `pick-ui-library` | G5 | Before adding any UI dependency. Check `components/ui/` first — this project already has Base UI + shadcn — then use this rather than hand-rolling a toast or installing an abandoned package. |

Note the overlap with impeccable's `/animate`: `/animate` proposes motion, `emil-design-eng` implements it against this project's Motion conventions (`motion/react`, never `framer-motion`). Running both is fine; running neither is not.

Order: intent settles what the surface is for → hallmark decides its structure → impeccable's references inform the specifics and its commands critique/polish/audit the result → emil's skills decide and implement the motion. Skip intent for a purely visual change to something whose purpose is already settled; don't skip it when the thing itself is new.

### Once per project

Four of these carry project state, and each one silently reverts to its stock defaults if the setup step is skipped. [`project-init`](.claude/skills/project-init/SKILL.md) runs them on a fresh copy; on an inherited project, check them before trusting a design gate.

| Step | Establishes | Cost of skipping |
|---|---|---|
| `npx skills experimental_install` | Exactly the pinned set in [skills-lock.json](skills-lock.json) | `npx skills add <repo>` instead installs whole repos, re-adding every skill this document explains was cut — including tasteskill's theme presets and intent's duplicate planners. |
| `/teach-impeccable` | impeccable knows the token lock and the density rules | Its passes run stock, which lean louder and more colorful than a dense productivity tool wants. |
| `intent` in `context` mode | The project context document every other intent skill reads | `journey`, `organize`, and `articulate` each re-derive the audience and the stakes independently, and disagree. |
| A written dial baseline for `website/` | `design-taste-frontend`'s `DESIGN_VARIANCE` / `MOTION_INTENSITY` / `VISUAL_DENSITY`, plus the accent and type family it may assume | Its § 0 re-infers all three from the brief on every invocation, so two marketing pages built a week apart don't match. Record them in `website/`'s own notes and hand them to the skill instead of letting it guess. |

Nothing else needs initializing. Hallmark's pre-flight re-reads whatever tokens it finds on every run, and emil's four skills carry no project state at all. `brandkit` is the one skill whose natural slot is *before* project init — it decides a brand that doesn't exist yet, and `website/`'s tokens should be written from its output rather than the reverse.

### When skills disagree

Fourteen pinned skills plus two plugins, from five authors, will contradict each other. These are the conflicts that actually come up, audited against the installed skill text, with the resolution for this project. When a skill says something not covered here, this repo's docs win.

| Conflict | Resolution |
|---|---|
| **Motion authority.** Impeccable's `/animate` and emil's motion skills both want to add animation. | **Emil wins.** Run `find-animation-opportunities` → `emil-design-eng` → `review-animations`. Skip `/animate`. Emil's sequence is the only one that starts by deciding what to *leave still*, which is what keeps animation creep out of a dense tool. |
| **`framer-motion` in skill examples.** `emil-design-eng` imports `useSpring` from `'framer-motion'`, and `pick-ui-library` calls the library "motion (Framer Motion)". | **Always rewrite the import to `motion/react`.** The package was renamed; the old name still resolves and installing it alongside `motion` gives you two `AnimatePresence` contexts that can't coordinate exits. This is a hard stop, and skill examples are the most likely way to trip it. |
| **CSS vs Motion.** `pick-ui-library` says a simple hover or fade doesn't need a library and plain CSS is right. [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md) says use Motion for new interactive animation. | **Split by kind, not by size.** Tailwind state utilities (`hover:bg-muted/50`, `:active` color changes) stay CSS — they're state changes. Anything with entry, exit, morph, or gesture goes through Motion, however simple, because exit animations need `AnimatePresence` and mixing systems on the same element is what produces jank. `components/ui/skeleton.tsx` is the deliberate CSS-only exception. |
| **Spring config shape.** `emil-design-eng` recommends `{ duration, bounce }`; `web/lib/motion.ts` uses `{ stiffness, damping }`. | **Use the project's named springs** (`spring.snap`, `spring.smooth`, `spring.panel`, …). Both forms are valid; a codebase with both is not. |
| **Color and type.** `/colorize` exists to add color; hallmark's default flow picks a palette and font pairing; `design-taste-frontend` names typefaces and maps briefs to design systems. | **The token lock overrides all of them in `web/` and `admin/`.** Structure, spacing, hierarchy, and motion are theirs to contribute; palette, `font-family`, and inline color values are not. `website/` owns its own tokens and runs the full flow there. |
| **Loud vs quiet.** `/bolder` and `/delight` amplify; DESIGN_PRINCIPLES.md's core philosophy is focus and restraint, with Linear and Raycast as reference apps. | **Quiet wins in `web/` and `admin/`** — `/distill`, `/quieter`, and `/normalize` are the aligned passes. `/bolder` and `/delight` belong to `website/`. |
| **Three review passes.** `/audit`, `review-animations`, and `/design-review` all review a finished surface. | **Different eyes; pick by question.** `/audit` is technical static analysis (a11y, performance, theming). `review-animations` reads motion code against emil's standards. `/design-review` drives a real browser at four viewports and is the only one that sees what actually renders. Run `/design-review` always; the other two when the change touches their subject. Intent's `evaluate` would have been a fourth and was cut for that reason. |
| **Structure, twice.** `wireframe` designs screen anatomy "before styling"; `hallmark` decides structure too. | **`wireframe` → `hallmark`, in that order.** Wireframe works at pre-visual fidelity and answers *what goes where and why* for a surface that doesn't exist yet. Hallmark decides the rendered structure and owns the slop, honesty, token, mobile, and 8-state gates. Skip wireframe for anything already shaped; never skip hallmark. |
| **Copy, twice.** `articulate` designs product words; [LANGUAGE_PATTERNS.md](LANGUAGE_PATTERNS.md) constrains voice. | **They stack.** `articulate` decides what a label, error, or empty state needs to *do*; LANGUAGE_PATTERNS decides how it's allowed to *sound*. The banned words and filler openers win over any phrasing `articulate` proposes. |
| **Accessibility, three times.** `include` (design discipline), hallmark's a11y gate (structural), `/audit` (technical). | **Sequential, not redundant** — `include` before the design exists, hallmark's gate while it's built, `/audit` after. If you only get one, `/audit` catches the most regressions. |
| **IA, twice.** `organize` and `/critique` both examine hierarchy. | **`organize` is system-level** (navigation, taxonomy, findability across surfaces); **`/critique` is surface-level** (is the clearest thing on this screen the most important thing). |
| **Redesign, twice.** `redesign-existing-projects` and `design-taste-frontend` § 11 both audit an existing site and upgrade it. Both are tasteskill's; only the second is pinned. | **`design-taste-frontend` § 11 wins, and only in `website/`.** It detects preserve-vs-overhaul mode, extracts brand tokens before recoloring, treats SEO migration as the top risk, and names what never changes silently (slugs, nav labels, form field names). `redesign-existing-projects` opens by replacing the font and collapsing to one accent color, which is hard stop #4 in `web/`/`admin/` and needless risk in `website/`. Don't invoke it anywhere. |

### The set is not MECE, deliberately

Skills are selected by description match, not navigated as a taxonomy, so some redundancy is harmless and occasionally useful — two framings of the same surface surface different findings. What is not harmless is an unstated boundary, where two skills both fire and pull in different directions. The boundaries that need stating:

| Pair | Boundary |
|---|---|
| `journey` / `organize` | **Temporal vs spatial.** `journey` owns the sequence a user moves through — steps, states, what happens next. `organize` owns where things live — navigation, taxonomy, findability. Both say "navigation"; only `organize` means the map. |
| `articulate` / `/clarify` | **Author vs edit.** `articulate` decides what a label, error, or empty state should say when it doesn't exist yet. `/clarify` fixes copy that exists and reads badly. |
| `wireframe` / `hallmark` | **Fidelity.** `wireframe` is pre-visual anatomy for a surface that doesn't exist; `hallmark` is the rendered structure and owns every gate. This ordering is imposed here — neither skill states it. |
| `find-animation-opportunities` / `emil-design-eng` | **Sweep vs element.** FAO scans a whole surface for where motion would earn its place; emil decides and implements per element. Emil carries its own "should this animate?" framework, so for a single element it is enough on its own. |
| `include` / hallmark / `/audit` | **Design-time, build-time, check-time** accessibility, in that order. If you only run one, `/audit` catches the most regressions. |
| `imagegen-frontend-web` / `design-taste-frontend` | **Comp vs code.** imagegen produces reference images and writes no code; tasteskill writes the page. If the direction for a `website/` page is unsettled, comps first, then build. If it's settled, skip straight to tasteskill — a comp pass on a decided page is just latency. |
| `brandkit` / everything else | **Outside the loop.** brandkit designs a brand that doesn't exist yet; every other design skill here assumes tokens already exist. If it fires after `website/`'s tokens are written, that's a misfire. |

And the gaps, so "no skill owns this" is a known fact rather than a surprise. Nothing in the skill layer covers **data and schema design, API design, backend or query performance** (impeccable's `/optimize` is explicitly frontend — loading, rendering, images, bundle size), **security review beyond `test:tenancy`**, **agent and prompt design**, or **observability**. Those are owned by the conventions above and by the subagents in `.claude/agents/` — reach for `nextjs-frontend-expert` and `mastra-workflow-architect` there, not for a design skill.

Two clean results worth recording. Emil's seven skills make **zero** palette, font, or type-scale claims, so they cannot break the token lock. And their motion numbers are already this project's numbers: `ease.out = [0.23, 1, 0.32, 1]`, `ease.inOut = [0.77, 0, 0.175, 1]`, `ease.drawer = [0.32, 0.72, 0, 1]` in [web/lib/motion.ts](web/lib/motion.ts) are emil's `--ease-out` / `--ease-in-out` / `--ease-drawer` exactly; `tap = { scale: 0.97 }` is his press-feedback rule; every duration token is under his 300ms ceiling; `stagger` at 40ms sits inside his 30–80ms band. Following emil verbatim produces token-consistent code here. (`globals.css` carries the first two as `--ease-out-strong` / `--ease-in-out-strong` for CSS consumers; the drawer curve is Motion-only.)

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
- **Runtime image generation** (the product generates images for users, rather than you generating design assets) → the Recraft REST API, not the MCP server. Base URL `https://external.api.recraft.ai/v1`, bearer `RECRAFT_API_TOKEN`, and it's close enough to OpenAI's shape that the `openai` package works pointed at that `baseURL` — with the caveat that unsupported params are quietly ignored rather than rejected. Put the call in `services/`, not a route handler: generation takes seconds, so it wants Inngest behind it, and image URLs come back on `img.recraft.ai` and need persisting to your own storage rather than hotlinking. See § Recraft for the two-balance gotcha.
- **Sentry** → `corepack pnpm add @sentry/nextjs`, then wire both `register()` **and** an `onRequestError` export — the stub in most Sentry quick-starts omits the request-error hook, which is the one that actually reports server-side errors from route handlers.
