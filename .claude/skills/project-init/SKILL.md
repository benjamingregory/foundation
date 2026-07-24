---
name: project-init
description: "Provisions the external service accounts a fresh copy of the foundation skeleton needs to boot — Supabase (required), plus optional Vercel, Stripe, GitHub, Resend, Anthropic, Inngest, and PostHog — and writes the resulting keys into web/.env.local and the sibling apps' .env.local files. Run once, right after new-project.sh, to take a project from cloned to running. Fires on requests to set up services/accounts, provision integrations, initialize env vars, or configure Supabase/Vercel/Stripe/etc for a new copy of this skeleton."
version: 1.0.0
---

# project-init

Takes a freshly-copied foundation project (post `new-project.sh`) from "no external services connected" to "boots locally, `corepack pnpm dev` works, `corepack pnpm doctor` is green on everything the user chose to configure." Runs once per new project. Safe to re-run — every step detects what's already configured and skips it.

## Hard safety rules

These are not suggestions. Violating any of them is a stop-the-task bug, not a style nit.

1. **Secrets go only into `.env.local` files** — `web/.env.local`, `website/.env.local`, `admin/.env.local`. Never into `.env.example` (that file stays a template with empty values, committed to git), never into any other tracked file, never into a commit. All three `.env.local` filenames are already gitignored at the repo root — verify with `git check-ignore web/.env.local` before writing if unsure.
2. **Never echo a secret value in a chat message, a log line, or a file the user didn't ask for.** A CLI subcommand's own stdout printing a freshly-created secret (e.g. `stripe webhook_endpoints create` printing its one-time `secret` field) is unavoidable and fine — that output goes straight into the target `.env.local`. What's not fine: repeating that value back in your response to the user, writing it into `.superpowers/sdd/` notes, or including it in a commit message. When confirming a var was written, mask it (`STRIPE_WEBHOOK_SECRET written (whsec_...ab12)`), never show it in full.
3. **Confirm before creating any cloud resource.** A Supabase project, a Vercel project, a GitHub repo, a Stripe product/price/webhook endpoint — each is outward-facing and has real cost or quota implications (a Supabase org has a project-count limit on the free tier; a GitHub repo is publicly creatable under the user's account). Before running the creating command, state exactly what will be created (resource type, name, org/team/scope it lands in) and wait for an explicit go-ahead. If an existing resource already looks like a fit (matching project name, one Supabase org, one Vercel team), offer to select it instead of creating a new one — creating a duplicate by default is the wrong failure mode.
4. **Idempotent and resumable.** Before touching a service, check whether it's already configured: read the target `.env.local` for a non-empty value on the relevant var(s), check for `.vercel/project.json` inside an app dir (created by `vercel link`), run the read-only list/status command for that service. Skip anything already configured — re-running this skill after a partial run (or after the user filled in one var by hand) should only do the remaining work, not redo it or prompt to overwrite silently.
5. **No invented commands.** Every command in this skill and in `references/services.md` was verified against that CLI's own `--help` output on 2026-07-24 (Supabase CLI 2.65.5, Vercel CLI 56.1.0, Stripe CLI 1.33.0, gh 2.83.1). CLI versions drift; if a command in `references/services.md` errors with "unknown flag" or "unknown command," re-run `<cli> <subcommand> --help` yourself before guessing a replacement flag — do not silently substitute an unverified one.

## Order of operations

Supabase gates everything else — `DATABASE_URL` and the Supabase URL/keys are the only vars the app needs to boot at all (see CLAUDE.md's env-gated degradation table). Do Supabase first, confirm the app actually starts, then work through the optional integrations in whatever order the user cares about. Don't block optional steps on each other.

1. **Preflight** — report CLI availability, don't provision anything yet.
2. **Supabase** (required) — project, keys, `DATABASE_URL`, then `corepack pnpm db:migrate` from `web/`.
3. **Vercel** (optional, but do it early if the user wants deploys) — three projects, Root Directory, env push.
4. **Stripe / GitHub / Resend / Anthropic / Inngest / PostHog** (all optional) — in whatever order the user wants, or skip any of them entirely.
5. **Workflow toolchain** (one-time) — confirm superpowers and bd are live, install the pinned design skills, name the boundary on anything installed user-level, then run the four once-per-project setup steps.
6. **Finish** — `corepack pnpm doctor` in `web/`, report what's configured vs. still missing and which slices degrade as a result.
7. **Hand off into the loop** — file the first issues in bd and state which gate the project enters at.

Full per-service command reference, including which pieces are dashboard-only and how each was verified, lives in [references/services.md](references/services.md). Read it before executing that service's step — don't reconstruct commands from memory.

## Step 0 — Preflight

Check what's installed. Don't install anything without asking — just report.

```bash
for c in supabase vercel stripe gh; do
  if command -v "$c" >/dev/null 2>&1; then
    echo "$c: $("$c" --version 2>&1 | head -1)"
  else
    echo "$c: not installed"
  fi
done
```

If missing, the install commands (see `references/services.md` for how each was confirmed on this machine):

| CLI | Install |
|---|---|
| `supabase` | `brew install supabase/tap/supabase` (macOS/Linuxbrew) — see https://supabase.com/docs/guides/cli/getting-started for other platforms |
| `vercel` | `npm install -g vercel` |
| `stripe` | `brew install stripe/stripe-cli/stripe` — see https://docs.stripe.com/stripe-cli for other platforms |
| `gh` | `brew install gh` — see https://cli.github.com for other platforms |

Resend and Anthropic have no CLI at all (dashboard-only, see below) — don't look for one. Inngest needs no CLI for local dev (`INNGEST_DEV=1` is enough); its `inngest dev` server already runs as part of `corepack pnpm dev` in `web/` (see `web/package.json`'s `dev` script).

Ask the user which optional services they actually want configured now versus later — don't assume "all of them."

## Step 1 — Supabase (required)

See `references/services.md#supabase` for the verified command sequence. Summary: `supabase login` → select-or-create an org → select-or-create a project (confirm first) → `supabase projects api-keys --project-ref <ref>` for the publishable/secret keys → project URL is `https://<ref>.supabase.co` → `DATABASE_URL` comes from the dashboard's Connection string page (no CLI command prints it — see the reference doc for why). Write all four vars into `web/.env.local`; also write `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `DATABASE_URL` into `admin/.env.local` (same Supabase project, per `admin/.env.example`'s comment that it shares the product app's project).

Then, from `web/`:

```bash
corepack pnpm db:migrate
```

Confirm it applies cleanly before moving on — everything downstream assumes a migrated database.

Note a Supabase MCP server also exists as an alternative to the CLI path (`mcp__supabase__*` tools) when the user has that connector authorized instead of the CLI — it can list tables, get the project URL, and read publishable keys directly. Use whichever the user already has available; don't require both.

## Step 2 — Vercel (optional)

Three separate Vercel projects, one per app, each linked from inside that app's directory so the CLI's local `.vercel/project.json` points at the right one. See `references/services.md#vercel` for the exact link/env commands and — importantly — the Root Directory caveat: it is **not** settable via any `vercel project update` flag (verified against that command's `--help`, which lists only `--framework`/`--build-command`/`--dev-command`/`--install-command`/`--output-directory`/`--auto-detect`). Root Directory has to be set by hand per project in the dashboard: **Project Settings → General → Root Directory** → `web`, `website`, or `admin` respectively. Flag this to the user explicitly; don't skip it silently.

## Step 3 — Stripe (optional)

See `references/services.md#stripe`. Summary: `stripe login` (browser OAuth) → confirm, then `stripe products create` + `stripe prices create --recurring.interval month` → the created price id is `STRIPE_PRICE_PRO_MONTHLY`. `STRIPE_SECRET_KEY` is **not** the CLI's own login credential (that's a CLI-restricted key for `stripe` commands only) — it comes from the dashboard's Developers → API keys page. The local webhook signing secret comes from running `stripe listen --forward-to localhost:3000/api/webhooks/stripe --print-secret`, which differs from the deployed secret (created separately via `stripe webhook_endpoints create --url <deployed-url>/api/webhooks/stripe ...`, whose one-time `secret` field in the response is the deployed `STRIPE_WEBHOOK_SECRET`). `BILLING_ENFORCED=false` is the safe default — leave it off (or false) until the user deliberately turns billing enforcement on.

## Step 4 — GitHub (optional)

`gh repo create <name> --private --source=. --push` (confirm the name and visibility first; `--public` if the user wants that instead). See `references/services.md#github`.

## Step 5 — Resend (optional)

No provisioning CLI exists for Resend — confirmed by `command -v resend` finding nothing and Resend shipping no official CLI. Dashboard only:

- API key: https://resend.com/api-keys → `RESEND_API_KEY`
- Domain verification (for sending from a real domain instead of Resend's sandbox address): https://resend.com/domains → once verified, set `EMAIL_FROM` to an address at that domain (`web/.env.local`) and `CONTACT_FROM_EMAIL` / `CONTACT_TO_EMAIL` (`website/.env.local`, per `website/.env.example`'s comments).

## Step 6 — Anthropic (optional, needed for the chat/agent slice)

No CLI. Dashboard: https://console.anthropic.com/settings/keys → `ANTHROPIC_API_KEY` in `web/.env.local`.

## Step 7 — Inngest (optional)

Local dev needs nothing beyond `INNGEST_DEV=1` in `web/.env.local` (already the default in `.env.example`) — the dev server runs via `corepack pnpm dev`, which starts `next dev` and `inngest dev` together (see `web/package.json`). Cloud deploy keys come from https://app.inngest.com → `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`.

## Step 8 — PostHog (optional)

A PostHog MCP server may be available (`mcp__plugin_posthog_posthog__*` tools) that can list or create a project and read its token directly — prefer that when connected. Otherwise, dashboard: https://us.posthog.com (or the relevant region) → Project Settings → `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, and the ingest host (`https://us.i.posthog.com` by default, see `web/scripts/doctor.mts`'s note) → `NEXT_PUBLIC_POSTHOG_HOST`.

## Step 9 — Workflow toolchain (one-time)

Services make the app boot. This step makes the *project* work the way CLAUDE.md § How work gets done describes — every gate in that loop is owned by one of the tools below, and a gate whose tool isn't installed silently stops firing.

Ask before installing anything; skip silently if the user declines, but say which gate goes dark as a result.

### 9a. Confirm the process layer

These come with the skeleton or the user's Claude Code setup rather than an install here — verify, don't provision.

| Tool | Owns | Verify |
|---|---|---|
| **superpowers** | Gates G2 (brainstorming), G3 (writing-plans), G5 (subagent-driven-development, TDD), G8 (code review), G9 (verification-before-completion) | A user-level plugin. If `superpowers:brainstorming` isn't available, say so — without it the project has no design or planning gate and work defaults to ad-hoc. |
| **bd** (beads) | Gate G0 (intake) and the close | `bd ready` should run clean. `new-project.sh` already ran `bd init --prefix <name>`; if it didn't, run it now. |

### 9b. Install the design skills

Installed, not vendored — the skeleton ships the pin, not the payload. `skills-lock.json` records hallmark by source and hash.

**The skeleton pins a curated set, not whole repos.** `skills-lock.json` lists exactly which skills are installed — 4 of emil's 7, 9 of intent's 17, hallmark, and one skill from tasteskill. Restore them with:

```bash
npx skills experimental_install
```

This is what `new-project.sh` runs, and it is the **only** correct command here. Do **not** reach for `npx skills add <source>`: that installs every skill in the repo and silently undoes the curation, putting back the ones CLAUDE.md § Design & Copy explains were deliberately excluded (duplicates of `brainstorming` and `writing-plans`, a fourth review pass, an i18n skill for a project with no i18n).

If the lockfile is missing or you are adding a skill deliberately, install one at a time:

```bash
npx skills add nutlope/hallmark
npx skills add ghaida/intent --skill <name>
npx skills add emilkowalski/skills --skill <name>
npx skills add https://github.com/Leonxlnx/taste-skill --skill design-taste-frontend
```

Gates by owner: **hallmark** G4 (required for UI work), **emil-design-eng** + **find-animation-opportunities** G6, **review-animations** G8, **pick-ui-library** G5, **intent** and its siblings G1/G2, **design-taste-frontend** G4 in `website/` only.

Everything installs to `.agents/skills/` and symlinks into `.claude/skills/`; a second copy also lands in `agent/skills/`. All three are gitignored — `skills-lock.json` is the source of truth, so commit it after any install or removal.

**impeccable** (gate G6 — the `frontend-design` vocabulary plus `/critique`, `/polish`, `/animate`, `/audit`) and **superpowers** (G2/G3/G5/G8/G9) are user-level plugins, not project installs — see [impeccable.style](https://impeccable.style).

**Then check what's already installed user-level.** Anything in `~/.claude/skills/` is reachable here regardless of this project's lockfile, and three of tasteskill's siblings commonly are: `brandkit`, `imagegen-frontend-web`, and `redesign-existing-projects`. Don't uninstall the user's skills — just name the boundary out loud, because the lockfile can't enforce it (CLAUDE.md § The tasteskill family):

- `redesign-existing-projects` — **never invoke.** Its audit opens by replacing the font and collapsing to a single accent color, which is hard stop #4 in `web/`/`admin/`; in `website/`, `design-taste-frontend` § 11 is the better redesign path.
- `brandkit` — only relevant *before* this step, when the brand doesn't exist yet and `website/`'s tokens are still to be written from its output.
- `imagegen-frontend-web` — optional reference comps for a `website/` page whose direction is unsettled. Needs an image-generation tool; without one it produces nothing.

### 9c. Run the once-per-project setup

Four steps carry project state. Each one silently reverts to a stock default if skipped, so run them here rather than discovering the gap at G4. See CLAUDE.md § Once per project.

| Step | Establishes | Notes |
|---|---|---|
| `npx skills experimental_install` | The pinned set | Already covered in 9b. This is the step that must not be `npx skills add <repo>`. |
| `/teach-impeccable` | impeccable knows the token lock and the density rules | Skip silently if impeccable isn't installed, but say that G6 will run on stock defaults. |
| `intent` in `context` mode | The project context document `journey`, `organize`, and `articulate` all read | Needs the user in the loop — it asks what's being designed and for whom. If they'd rather do it with the first real feature, file a bd issue rather than dropping it. |
| A written dial baseline for `website/` | `design-taste-frontend`'s `DESIGN_VARIANCE` / `MOTION_INTENSITY` / `VISUAL_DENSITY` | Only once `website/` has a direction. Record it in the project's own notes and hand it to the skill; otherwise its § 0 re-infers all three per invocation and two pages built a week apart won't match. |

Hallmark and emil's four skills need nothing — hallmark re-reads the tokens on every run, and emil's carry no project state.

### 9d. State the token lock

Once the design skills are in, say plainly that in `web/` and `admin/` the design tokens are already locked (CLAUDE.md § Design & Copy): these skills contribute structure and specifics, never a new palette or font. Hallmark's theme catalog and impeccable's color guidance are reference-only there. Full theme selection applies **only** to `website/`. This is a hard stop in CLAUDE.md rather than a preference, and it's the rule a design skill running its own default flow is most likely to break.

## Step 10 — Finish

From `web/`:

```bash
corepack pnpm doctor
```

Report its output back to the user as-is — it already groups vars by slice (required / auth / ai / jobs / billing / email / analytics) and states in each row what happens when that var is missing. Cross-reference against CLAUDE.md's env-gated degradation table for the one-line consequence of anything still unset (e.g. unset `STRIPE_SECRET_KEY` → billing routes 503; unset `RESEND_API_KEY` → `sendEmail()` no-ops; unset `ANTHROPIC_API_KEY` → chat/agent routes fail at request time, no fallback). Close with an explicit list: what's configured, what's still open, and which product slices are consequently degraded — don't just say "doctor passed" and stop.

## Step 11 — Hand off into the loop

Init is the only work in this project that runs outside the loop in CLAUDE.md § How work gets done. Everything after it runs inside, so finish by putting the project on a gate instead of leaving it at a prompt.

1. **File what's still open as bd issues.** One per skipped service (`bd create --title="Configure Stripe" --type=task --priority=2`), one per dashboard-only step the user must do by hand (Vercel Root Directory, Resend domain verification), and one for the first product surface if the user has already named it. That becomes the project's first `bd ready` list.
2. **Record the init outcome with `bd remember`** — which services are live, which were deliberately skipped, and anything about this setup a later session would otherwise rediscover the hard way (a non-default region, the org the project landed in, a key on a rotation schedule). Never put a secret value in a memory.
3. **Name the entry gate.** A fresh project's first real task is almost always creative, so it enters at **G1/G2**: `intent` if the surface is new and its value isn't yet evidenced, then `superpowers:brainstorming`. Say that explicitly rather than starting to write code. The skeleton's `items` slice is the worked reference for a full vertical — route → `withAuth` → repository → tenancy gate — and the first feature should follow it rather than replace it.
4. **Commit and push.** The `.env.local` files stay gitignored, so what lands is `skills-lock.json`, the bd issues, and any config the setup changed. Work is not done until push succeeds.