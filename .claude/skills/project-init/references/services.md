# Per-service command reference

Every command below was checked against the installed CLI's own `--help` output on 2026-07-24, on the machine this skill was authored on: `supabase` 2.65.5, `vercel` 56.1.0, `stripe` 1.33.0, `gh` 2.83.1. Anything not directly confirmed against a `--help` listing is marked **verify before running**. Nothing here is a guessed flag.

## Supabase

Required — nothing in `web/`, `website/`'s Resend action, or `admin/` boots without `DATABASE_URL` and the Supabase auth vars.

**Login.** Confirmed via `supabase login --help` (flags: `--token`, `--no-browser`, `--name`).

```bash
supabase login          # opens a browser; --no-browser for a manual-paste flow
# non-interactive, if the user already has a personal access token:
supabase login --token "$SUPABASE_ACCESS_TOKEN"
```

**Detect existing state (idempotency).** Confirmed via `supabase orgs list --help` / `supabase projects list --help`, both support `-o json`.

```bash
supabase orgs list -o json
supabase projects list -o json
```

If a project already exists whose name matches the target project, offer to select it (its `id` field is the project ref) instead of creating a new one.

**Create a project.** Confirmed via `supabase projects create --help` (flags: `--org-id`, `--db-password`, `--region`, `--size`). Confirm with the user first — state the org, region, and that this consumes a project slot on that org's plan.

```bash
supabase projects create "<name>" --org-id "<org-id>" --db-password "<generated-password>" --region "<region>"
```

Generate the db password yourself (e.g. `openssl rand -base64 24`) rather than asking the user to type one in chat — it needs to end up in `DATABASE_URL` either way, and typing it in plaintext in the conversation is no safer than generating it. Never echo it back after use.

**API keys.** Confirmed via `supabase projects api-keys --help` (flag: `--project-ref`).

```bash
supabase projects api-keys --project-ref "<ref>" -o json
```

This CLI version returns the legacy key names (`anon`, `service_role`) in its JSON — map `anon` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `service_role` → `SUPABASE_SECRET_KEY`. CLAUDE.md's convention is the new-style key **names** in the env file (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`), not the legacy env var names — the app's own code reads those new names (`lib/auth/{api,server}.ts`). If a newer CLI on the user's machine already returns `publishable`/`secret` key names in this command's JSON, use those directly; either way the *env var names* you write stay `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SECRET_KEY`.

**Project URL.** Not printed by any CLI subcommand checked (`projects list`, `projects create`, `projects api-keys` — none include it in this version's output). It's the standard Supabase URL pattern:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
```

**`DATABASE_URL`.** No CLI subcommand in this version prints the Postgres connection string — checked `projects create`, `projects api-keys`, `projects list`, `db --help`, `config --help`, `link --help`. None return it. Get it from the dashboard: **Project Settings → Database → Connection string** (the URI form; use "Transaction" pooler mode for a serverless/Vercel deployment, matching how `db/client.ts`'s globalThis-cached pool is described in CLAUDE.md). The password segment is the one supplied to `--db-password` at creation — if it wasn't captured, reset it from that same dashboard page (**Reset database password**) rather than guessing.

`supabase link --project-ref <ref> --password <db-password>` (confirmed via `supabase link --help`) associates the local Supabase CLI with this project for the CLI's *own* migration/db tooling (`supabase db diff`, `supabase db pull`, etc.). **This skeleton doesn't use that tooling** — schema changes go through Drizzle (`corepack pnpm db:generate` / `corepack pnpm db:migrate`, both tsx scripts in `web/`), not `supabase db push` or `supabase migration`. Running `supabase link` is optional and only useful if the user separately wants Supabase CLI database inspection tools; don't present it as a required step.

**Apply the schema.** From `web/`, after `DATABASE_URL` is written to `web/.env.local`:

```bash
corepack pnpm db:migrate
```

**Alternative: Supabase MCP server.** If the user has the Supabase MCP connector authorized instead of (or alongside) the CLI, `mcp__supabase__get_project_url`, `mcp__supabase__get_publishable_keys`, and `mcp__supabase__list_tables` cover the read side of this without shelling out. It does not remove the need for the dashboard step for `DATABASE_URL` or the initial `db:migrate` run.

## Vercel

Optional — only needed once the user wants preview/production deploys. Three separate projects, one per app.

**Login / identity.** `vercel login` is a documented top-level command (listed in `vercel --help`'s command table). Check current identity first — no need to log in again if already authenticated:

```bash
vercel whoami        # confirmed via --help; prints the logged-in username or errors if not logged in
vercel teams list     # confirmed via `vercel teams --help`; shows every team/scope available
```

**Detect existing projects.** Confirmed via `vercel project list --help` (flag: `--format json`, plus `--filter <name>`).

```bash
vercel project list --filter "<name>" --format json
```

**Link each app.** Run from inside the app directory so the CLI's local `.vercel/project.json` binds to it. Confirmed via `vercel link --help` (flags: `--project`, `--team`, `--yes`).

```bash
cd web && vercel link --yes --project "<name>-web" --team "<team-id-or-slug>"
cd ../website && vercel link --yes --project "<name>-website" --team "<team-id-or-slug>"
cd ../admin && vercel link --yes --project "<name>-admin" --team "<team-id-or-slug>"
```

Interactive `vercel link` (no flags) works too and will offer to create the project if it doesn't exist — confirm with the user before accepting that prompt. Idempotency check: a `<app>/.vercel/project.json` already present means that app is already linked — skip re-linking it.

**Root Directory — dashboard only.** Checked `vercel project update --help` for a settable field: it exposes `--framework`, `--build-command`, `--dev-command`, `--install-command`, `--output-directory`, and `--auto-detect`, and nothing else. There is no `--root-directory` flag in this CLI version. Set it by hand, once per project, in the dashboard: **Project Settings → General → Root Directory** → `web`, `website`, or `admin` respectively. This matters specifically for git-triggered builds (a push to the connected GitHub repo) — CLI-triggered deploys run from whatever directory `vercel deploy` was invoked in and aren't affected by this setting, but a production setup relying on git-push deploys needs it set correctly or the build will look for `package.json` at the repo root and fail (there is none — see CLAUDE.md).

**Push env vars.** Confirmed via `vercel env add --help` (flags: `--value`, `--yes`, `--sensitive`/`--no-sensitive`, `--force`).

```bash
vercel env add DATABASE_URL production --value "<value>" --yes
vercel env add NEXT_PUBLIC_SUPABASE_URL production --value "<value>" --yes
# repeat per var, per environment (production / preview / development), per app — run inside that app's directory
```

`vercel env list [environment]` shows configured var *names* per environment (confirmed via `vercel env --help`'s command table) — use it for idempotency checks. Don't use `vercel env pull` for that purpose: it writes encrypted/sensitive vars back as empty strings, which looks indistinguishable from "unset" and will cause a false "still missing" read.

## Stripe

Optional. Confirmed via `stripe products create --help`, `stripe prices create --help`, `stripe webhook_endpoints create --help`, `stripe listen --help`.

**Login.**

```bash
stripe login    # browser-based; issues a CLI-restricted key stored in $HOME/.config/stripe/config.toml
```

That restricted key is for the `stripe` CLI's own commands (`stripe products create`, `stripe listen`, etc.) — it is **not** the app's `STRIPE_SECRET_KEY`. The app needs the standard secret key from the dashboard: **Developers → API keys** → `STRIPE_SECRET_KEY` (use the test-mode key while developing; swap to the live key only for the production Vercel env).

**Product + recurring price.** Confirm with the user first (name, price, interval) — this creates a real Product/Price object in the Stripe account, test mode by default.

```bash
stripe products create --name "Pro"
# → note the returned id, e.g. prod_ABC123

stripe prices create --product prod_ABC123 --currency usd --unit-amount 3900 --recurring.interval month
# → note the returned id, e.g. price_XYZ789 — this is STRIPE_PRICE_PRO_MONTHLY
```

(`--unit-amount` is in the smallest currency unit — cents for USD, so `3900` = $39.00.)

**Local webhook secret.** `web/app/api/webhooks/stripe/route.ts` documents the events it expects: `checkout.session.completed`, `customer.subscription.created`/`updated`/`deleted`, `invoice.payment_failed`.

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe --print-secret
```

`--print-secret` (confirmed in `stripe listen --help`: "Only print the webhook signing secret and exit") prints the local signing secret and exits instead of blocking the terminal forwarding events — use that for provisioning, not a long-running `stripe listen` session. Copy the printed `whsec_...` into `web/.env.local` as `STRIPE_WEBHOOK_SECRET`. **This local secret is different from the deployed one** — running `stripe listen` again for local dev is fine and doesn't need re-provisioning through this skill, but it does mean the value in `web/.env.local` and the value on the deployed Vercel project are two different secrets from two different sources (see below).

**Deployed webhook endpoint.** Only once there's a real deployed URL (after the Vercel step).

```bash
stripe webhook_endpoints create \
  --url "https://<deployed-domain>/api/webhooks/stripe" \
  --enabled-events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.payment_failed
```

The response includes a `secret` field — shown **only at creation time**, never retrievable again via `retrieve`/`list`. Capture it immediately and push it as the deployed `STRIPE_WEBHOOK_SECRET` (`vercel env add STRIPE_WEBHOOK_SECRET production --value "<value>" --yes`).

**`BILLING_ENFORCED`.** Leave at `false` (the `.env.example` default) unless the user explicitly wants billing enforcement live — `services/entitlements.ts`'s `billingEnforced()` is the kill switch CLAUDE.md documents.

## GitHub

Optional. Confirmed via `gh repo create --help`.

```bash
gh auth status                         # check login state first
gh repo create "<owner>/<name>" --private --source=. --push   # confirm name + visibility with the user first
```

Use `--public` instead of `--private` only if the user asks for a public repo. `--source=. --push` creates the remote from the current local repo and pushes the existing history — don't run this from inside `web/`/`website/`/`admin/`, run it from the repo root (the three-app skeleton root, matching `new-project.sh`'s layout).

## Resend

Optional. No provisioning CLI exists — confirmed by `command -v resend` finding nothing on this machine and Resend not shipping an official CLI at all (their docs cover the dashboard and language SDKs only). Dashboard-only:

- **API key** → https://resend.com/api-keys → `RESEND_API_KEY` (`web/.env.local`)
- **Domain verification** (needed to send from a real address instead of Resend's sandbox sender) → https://resend.com/domains → once verified, `EMAIL_FROM` (`web/.env.local`, format `Name <address@yourdomain>` per `.env.example`'s placeholder) and, for the marketing site's contact form, `CONTACT_TO_EMAIL` / `CONTACT_FROM_EMAIL` (`website/.env.local`, per that app's `.env.example` comment — both fall back to a placeholder if left unset, so this app degrades cleanly without them)

## Anthropic

Optional, but required for the chat/agent slice (`lib/mastra/`) to do anything. No CLI. Dashboard: https://console.anthropic.com/settings/keys → `ANTHROPIC_API_KEY` (`web/.env.local`). Read automatically by `@ai-sdk/anthropic` — nothing checks for it up front, so an unset key fails at the first request rather than at boot (see `web/scripts/doctor.mts`'s note on this var).

## Inngest

Optional for local dev, needed for background jobs to run anywhere beyond local. No provisioning CLI action needed locally:

```
INNGEST_DEV=1
```

in `web/.env.local` (already the `.env.example` default). The dev server itself is already wired into `corepack pnpm dev` (`concurrently ... "next dev" "inngest dev -u http://localhost:3000/api/inngest"`, per `web/package.json`) — nothing further to provision for local use. Cloud keys, needed once jobs run against a real deployment: https://app.inngest.com → `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` (push to the deployed Vercel project's env, not `.env.local`).

## PostHog

Optional. A PostHog MCP server may already be connected (tools prefixed `mcp__plugin_posthog_posthog__`) — when it is, prefer it: it can list or create a project and read a project's token without leaving the CLI-less dashboard flow below. Otherwise, dashboard:

- https://us.posthog.com (or the account's actual region) → Project Settings → project API key → `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`
- Ingest host → `NEXT_PUBLIC_POSTHOG_HOST` (defaults to `https://us.i.posthog.com` if left unset — see `web/scripts/doctor.mts` — so this var only needs setting for a non-US region or a reverse-proxied ingest endpoint)