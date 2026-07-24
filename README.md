<p align="center">
  <img src="./public/foundation_light.png#gh-light-mode-only" alt="foundation" width="400">
  <img src="./public/foundation_dark.png#gh-dark-mode-only" alt="foundation" width="400">
</p>

<p align="center">
  <strong>A Next.js starter with auth, tenancy-safe data, an agent endpoint, and billing already wired</strong>
</p>

<p align="center">
  <a href="#why-foundation">Why foundation?</a> |
  <a href="#what-you-get">What You Get</a> |
  <a href="#quick-start">Quick Start</a> |
  <a href="#how-it-works">How It Works</a> |
  <a href="#how-work-gets-done">How Work Gets Done</a>
</p>

---

## Why foundation?

### The Problem: Every Project Rewires the Same Five Things

Start a new product and the first two weeks go to the same checklist, every time: wire Supabase auth, remember to scope every query by `userId` (or ship a cross-tenant leak), stand up one agent endpoint that streams, get a billing webhook to not double-charge on retry, and make transactional email fail without crashing the signup flow. None of that is the product. All of it has to exist before the product can.

| Approach | Auth wired? | Tenancy enforced? | Billing idempotent? | Degrades without keys? |
|---|---|---|---|---|
| **Blank `create-next-app`** | No — build it | No — remember it every time | No — build it | No — crashes on a missing env var |
| **Copy from the last project** | Partial — copies whatever bugs shipped with it | Partial — copies whatever gaps shipped with it | Partial | Rarely — nobody re-audits a copy-paste |
| **foundation** | Yes — Supabase SSR, cookie + bearer + agent-token paths | Yes — `eq(table.userId, userId)` on every repository query, enforced by a static scanner | Yes — Stripe events land in an idempotency ledger before they're applied | Yes — only Supabase + `DATABASE_URL` are required; everything else no-ops or 503s cleanly |

foundation is that checklist, done once, distilled from five sibling codebases (jobflow, kasava, monroe, demokit, sightline) that each rebuilt it separately. Copy it, rename the placeholder, add your own keys.

### What You Get

Working vertical slices, not stubs — each one runs end-to-end on `corepack pnpm dev` once you add the relevant keys, and degrades cleanly when you don't.

| Slice | Wired with | What proves it |
|---|---|---|
| **Auth** | Supabase SSR | [`web/lib/auth/server.ts`](web/lib/auth/server.ts), [`web/lib/api/with-auth.ts`](web/lib/api/with-auth.ts) — cookie session, `Authorization: Bearer`, or an agent token, resolved to one `userId` |
| **Data** | Drizzle + tenancy gate | [`web/db/repositories/items.ts`](web/db/repositories/items.ts) — every query carries `eq(table.userId, userId)`; `corepack pnpm test:tenancy` fails the build if one doesn't |
| **Agent** | Mastra + streaming chat | [`web/app/api/chat/route.ts`](web/app/api/chat/route.ts) — `@mastra/ai-sdk` streams tool calls and text over the AI SDK UI-message protocol |
| **Billing** | Stripe, idempotent webhook | [`web/app/api/webhooks/stripe/route.ts`](web/app/api/webhooks/stripe/route.ts), [`web/services/billing.ts`](web/services/billing.ts) — events land in a `stripeEvents` ledger before they're applied, so a Stripe retry can't double-charge |
| **Email** | Resend, env-gated | [`web/lib/email/send.ts`](web/lib/email/send.ts) — returns `{ sent: false, reason: "not-configured" }` instead of throwing when `RESEND_API_KEY` is unset |
| **Jobs** | Inngest + run ledger | [`web/lib/inngest/run-ledger.ts`](web/lib/inngest/run-ledger.ts) — mirrors run state into Postgres so the UI can show a user their queued/running work; Inngest has no such query of its own |
| **Client cache** | TanStack Query + IndexedDB | [`web/lib/query/persister.ts`](web/lib/query/persister.ts) — per-query IDB persistence, so a reload paints from disk before revalidating |
| **Analytics** | PostHog, Sentry stub | [`web/lib/analytics/posthog-server.ts`](web/lib/analytics/posthog-server.ts), [`web/instrumentation.ts`](web/instrumentation.ts) — PostHog no-ops without a token; the Sentry stub activates only after `corepack pnpm add @sentry/nextjs` and a DSN |

This is structurally verified — typecheck, build, and the tenancy/idempotency gates all pass — but not exercised end-to-end against live Supabase, Stripe, or Resend credentials. Add your keys and it runs; `corepack pnpm doctor` (in `web/`) reports which slices are configured.

---

## Quick Start

```bash
./new-project.sh myapp ~/repos/myapp
cd ~/repos/myapp
```

Then, from a Claude Code session in the new project, run the `project-init` skill ([.claude/skills/project-init/SKILL.md](.claude/skills/project-init/SKILL.md)) to provision Supabase (required) and the optional services (Vercel, Stripe, GitHub, Resend, Anthropic, Inngest, PostHog), and write the resulting keys into each app's `.env.local`. Or do it by hand:

```bash
cd web
cp .env.example .env.local   # fill Supabase + DATABASE_URL; everything else optional
corepack pnpm install && corepack pnpm dev
```

---

## How It Works

Three independent Next.js apps, each with its own `package.json`, lockfile, and Vercel project. No workspace tooling, no root `package.json` — `cd` into an app before running its scripts.

```text
foundation/
├── web/       product app        :3000   Supabase · Drizzle · Mastra · Stripe · Resend · Inngest
├── website/   marketing site     :3001   MDX, its own theme + fonts
└── admin/     ops shell          :3002   domain-gated login, schema-drift guard against web/
```

`admin/` reads the same Supabase project and Postgres database as `web/` but ships its own Drizzle client and schema copy; `corepack pnpm check:drift` (in `admin/`) diffs the two schemas statically, no DB connection needed. `website/` shares nothing but the placeholder token — separate tokens, separate deploy.

---

## How Work Gets Done

The skeleton ships an operating loop, not just a stack. Each skill and command owns a named point in that loop, so an agent working in the repo has one procedure to follow rather than a menu to browse.

### The gates

| Gate | Fires when | What runs |
|---|---|---|
| **G0 · Intake** | Any request | `bd create`, `bd update <id> --claim`. Classify: creative / bug / UI / mechanical |
| **G1 · Intent** | New surface, or a feature whose value is assumed | [`intent`](https://github.com/ghaida/intent) — who it's for, what evidence says, how it gets measured |
| **G2 · Design** | Creative track | `brainstorming` → a spec. **A human approves it before any code** |
| **G3 · Plan** | Spec approved | `writing-plans` → a task-by-task plan. **A human approves it** |
| **G4 · Structure** | Any UI work | `hallmark`, before layout code — required, not optional |
| **G5 · Build** | Plan approved | `subagent-driven-development` (fresh subagent per task, review between) with `test-driven-development` inside each task; `pick-ui-library` before any new UI dependency |
| **G6 · Polish** | Surface is functional | `/critique` → fix → `/polish`, then `find-animation-opportunities` → `emil-design-eng` |
| **G7 · Machine gates** | Before review, before done | typecheck · lint · test · `test:tenancy` · build, plus `check:drift` and the copy greps when relevant |
| **G8 · Review** | Branch ready | `requesting-code-review`; for UI, `/design-review` drives a real browser at four viewports, and `review-animations` checks the motion |
| **G9 · Verify & close** | All green | `verification-before-completion` → `bd close` → commit → push → `bd remember` |

A bug skips G1–G4 — `systematic-debugging` runs instead, and a reproduction case is the spec. A rename or dependency bump skips to G5. If a mechanical task grows a design question mid-flight, it stops and re-enters at G2.

### The layers

**Process** — the [superpowers](https://github.com/obra/superpowers) plugin owns G2, G3, G5, G8, and G9. It decides the approach; everything else executes inside the plan it produces.

**Tracking** — [bd (beads)](https://github.com/gastownhall/beads) owns G0 and the close. Issues live in a local Dolt database and sync over your git remote. No TodoWrite, no markdown checklists.

**Design** — four skills at four altitudes, and the order matters more than any one of them:

- **`intent`** ([Design with Intent](https://github.com/ghaida/intent), CC0) settles what should exist and for whom — problem framing, research, user autonomy, evidence over assumption, accessibility, measurement, and a catalogue of anti-patterns. Install with `npx skills add ghaida/intent --all`.
- **`hallmark`** settles what goes where: structural variety, honest copy with no fabricated numbers, locked design tokens, no re-drawn browser chrome, mobile verified at 320/375/414/768px, and all 8 interactive states on every component. Pinned by source and hash in [skills-lock.json](skills-lock.json) and installed rather than vendored — `npx skills add nutlope/hallmark`, which `project-init` runs for you.
- **`impeccable`** supplies the vocabulary and the targeted passes. Its `frontend-design` skill is the reference for typography, OKLCH color, spacing, motion curves, interaction, responsive behavior, and UX writing; its 17 other skills are ordered, not interchangeable — `/critique` first (a hierarchy finding can invalidate detail work), `/polish` once those are fixed, `/audit` before review. `/colorize`, `/bolder`, and `/delight` are scoped to `website/`: they exist to add color and amplify, and the product apps are token-locked and deliberately quiet.
- **[emilkowalski/skills](https://github.com/emilkowalski/skills)** (MIT) settles the motion — seven skills installed together. `emil-design-eng` implements against this project's Motion conventions; `find-animation-opportunities` decides where motion earns its place and what to leave still; `review-animations` reviews what shipped; `improve-animations` audits the whole codebase into prioritized plans; `animation-vocabulary` and `apple-design` are reference; `pick-ui-library` runs before any new UI dependency, so nobody hand-rolls a toast that `components/ui/` already has.

Every one of them is **installed, not vendored** — [skills-lock.json](skills-lock.json) pins each by source and content hash, `npx skills add` writes the payload to gitignored directories, and `project-init` runs the installs. The skeleton ships pins, not copies, so an install picks up upstream fixes instead of freezing a snapshot.

In `web/` and `admin/` the token set in [`web/app/globals.css`](web/app/globals.css) is already locked, and that binds all of them: they contribute structure and specifics, never a new palette or font. Full theme selection applies only to `website/`.

**Depth on demand** — four subagents in [.claude/agents/](.claude/agents/) (`nextjs-frontend-expert`, `mastra-workflow-architect`, `web-research-analyst`, `design-review`) and eight commands in [.claude/commands/](.claude/commands/). `/upgrade` runs after a dependency bump; `/update` and `/style` catch documentation and convention drift.

Specs live in `docs/superpowers/specs/`, plans in `docs/superpowers/plans/` — this skeleton's own build is the worked example: [the design spec](docs/superpowers/specs/2026-07-22-foundation-skeleton-design.md) and [the implementation plan](docs/superpowers/plans/2026-07-22-foundation-skeleton.md) that produced it. The full loop, with the reasoning behind each gate and the hard stops that override it, is in [CLAUDE.md](CLAUDE.md).

---

## Conventions

Tenancy, auth, Mastra tooling, Next.js perf defaults, and per-app commands are documented once, in [CLAUDE.md](CLAUDE.md) — read that before making a structural change. Design and layout rules (including the hallmark/DESIGN_PRINCIPLES.md precedence for conflicts) are in [DESIGN_PRINCIPLES.md](DESIGN_PRINCIPLES.md). Copy rules — banned words, banned filler openers, voice — are in [LANGUAGE_PATTERNS.md](LANGUAGE_PATTERNS.md).

---

## Origin

Distilled from five sibling codebases — jobflow, kasava, monroe, demokit, sightline — by auditing what they had in common and where each one had independently fixed the same landmine (a tenancy leak, a non-idempotent webhook, a dual-package animation bug). The conventions in this repo are the ones that survived all five audits, not a single project's preferences generalized outward.

---

<p align="center">
  <sub>A copyable skeleton, not a package — clone it, rename it, ship your product.</sub>
</p>
