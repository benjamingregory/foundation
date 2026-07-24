#!/usr/bin/env tsx
/**
 * doctor.mts — environment health check for foundation.
 *
 * Prints every env var this app reads, grouped exactly like .env.example's
 * sections (required / auth / ai / jobs / billing / email / analytics), each
 * marked configured or missing with a note on what happens when it's left
 * unset. Only the `required` group gates the exit code — every other group
 * documents a slice that's designed to degrade cleanly (a 503, a no-op, a
 * skipped init) rather than crash, so a var missing there is informational,
 * not a failure.
 *
 * When DATABASE_URL is set, also runs a `select 1` against it (a fresh,
 * short-lived postgres-js connection — not the app's pooled getDb() — with
 * a ~2s timeout) to catch "the string parses but nothing's listening"
 * separately from "the var isn't set at all". That check is informational
 * too: a var can be present and still point at an unreachable database, and
 * that shouldn't be conflated with the var being absent.
 *
 * No repo-module imports (db/client.ts, etc.) on purpose — this is a
 * standalone tsx script and the `postgres` package alone is enough for the
 * connectivity probe, so there's nothing here that needs the dynamic-import
 * workaround other .mts scripts in this repo use for server-only modules.
 *
 *   corepack pnpm doctor
 */

import "dotenv/config";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const isTTY = process.stdout.isTTY;
const green = (s: string): string => (isTTY ? `\x1b[32m${s}\x1b[0m` : s);
const red = (s: string): string => (isTTY ? `\x1b[31m${s}\x1b[0m` : s);
const yellow = (s: string): string => (isTTY ? `\x1b[33m${s}\x1b[0m` : s);
const dim = (s: string): string => (isTTY ? `\x1b[2m${s}\x1b[0m` : s);
const bold = (s: string): string => (isTTY ? `\x1b[1m${s}\x1b[0m` : s);

type VarSpec = {
  /** Display name — "A / B" for a pair where either satisfies the check. */
  name: string;
  configured: () => boolean;
  /** Shown (dimmed) under the row only when the var is missing. */
  note: string;
};

type Group = {
  title: string;
  /** Whether a missing var in this group counts toward exit 1. */
  required: boolean;
  vars: VarSpec[];
};

const has = (name: string): boolean => Boolean(process.env[name]?.trim());

const GROUPS: Group[] = [
  {
    title: "required to boot",
    required: true,
    vars: [
      {
        name: "DATABASE_URL",
        configured: () => has("DATABASE_URL"),
        note: "Supabase Postgres connection string — nothing in db/ works without it.",
      },
      {
        name: "NEXT_PUBLIC_SUPABASE_URL",
        configured: () => has("NEXT_PUBLIC_SUPABASE_URL"),
        note: "Supabase project URL, paired with the publishable key below for the SSR auth client (lib/auth/server.ts).",
      },
      {
        name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        configured: () => has("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
        note: "Supabase publishable (anon) key. Unset, auth degrades cleanly — 401 on API routes, redirect to /sign-in on pages — it does not 500 (lib/auth/{api,server}.ts).",
      },
      {
        name: "SUPABASE_SECRET_KEY",
        configured: () => has("SUPABASE_SECRET_KEY"),
        note: "Supabase service-role key. Reserved for a future admin client — no request path reads it today; it's deliberately excluded from bearer auth (see the comment in lib/auth/api.ts).",
      },
      {
        name: "APP_BASE_URL / NEXT_PUBLIC_APP_URL",
        configured: () => has("APP_BASE_URL") || has("NEXT_PUBLIC_APP_URL"),
        note: "Canonical deployment URL for Stripe checkout/portal return links (services/billing.ts) and email link generation (lib/email/theme.ts). Code falls back to http://localhost:3000, but set one explicitly outside local dev.",
      },
    ],
  },
  {
    title: "auth (agent/API + cron)",
    required: false,
    vars: [
      {
        name: "AGENT_API_TOKEN",
        configured: () => has("AGENT_API_TOKEN"),
        note: "Optional automation bearer token. Unset, mode 1 in lib/auth/api.ts's authenticate() is simply unavailable — JWT/cookie auth still works.",
      },
      {
        name: "AGENT_USER_ID",
        configured: () => has("AGENT_USER_ID"),
        note: "The user id AGENT_API_TOKEN resolves to. Must be set alongside AGENT_API_TOKEN — a request presenting a matching token with this unset (or the all-zero UUID) gets a 500, not a 401 (lib/auth/api.ts).",
      },
      {
        name: "CRON_SECRET",
        configured: () => has("CRON_SECRET"),
        note: "Not wired to any route in this skeleton yet — reserved for guarding a future Vercel Cron endpoint (see the commented example in vercel.json).",
      },
    ],
  },
  {
    title: "ai (chat slice)",
    required: false,
    vars: [
      {
        name: "ANTHROPIC_API_KEY",
        configured: () => has("ANTHROPIC_API_KEY"),
        note: "Read automatically by @ai-sdk/anthropic (lib/mastra/models.ts). Unset, chat model calls fail at request time — nothing checks for it up front.",
      },
    ],
  },
  {
    title: "jobs (Inngest)",
    required: false,
    vars: [
      {
        name: "INNGEST_DEV",
        configured: () => has("INNGEST_DEV"),
        note: "Enables Inngest local dev mode. Without it — and without a real event/signing key pair below — inngest.send() throws synchronously in cloud mode (lib/data/ensure-profile.ts already catches that for the welcome-email send).",
      },
      {
        name: "INNGEST_EVENT_KEY",
        configured: () => has("INNGEST_EVENT_KEY"),
        note: "Production Inngest event key — the non-local alternative to INNGEST_DEV=1.",
      },
      {
        name: "INNGEST_SIGNING_KEY",
        configured: () => has("INNGEST_SIGNING_KEY"),
        note: "Verifies inbound Inngest requests in production. Needed alongside INNGEST_EVENT_KEY outside dev mode.",
      },
    ],
  },
  {
    title: "billing (Stripe)",
    required: false,
    vars: [
      {
        name: "STRIPE_SECRET_KEY",
        configured: () => has("STRIPE_SECRET_KEY"),
        note: "Gates services/billing.ts's billingConfigured(). Unset, /api/billing/{checkout,portal} and the Stripe webhook all 503 cleanly (code: SERVICE_UNAVAILABLE).",
      },
      {
        name: "STRIPE_WEBHOOK_SECRET",
        configured: () => has("STRIPE_WEBHOOK_SECRET"),
        note: "Verifies inbound Stripe webhook signatures. Unset, the webhook route also 503s.",
      },
      {
        name: "STRIPE_PRICE_PRO_MONTHLY",
        configured: () => has("STRIPE_PRICE_PRO_MONTHLY"),
        note: "The Stripe Price id checkout sessions are created against. createCheckoutSession() throws without it once billing is otherwise configured.",
      },
      {
        name: "BILLING_ENFORCED",
        configured: () => has("BILLING_ENFORCED"),
        note: "Kill switch read by services/entitlements.ts's billingEnforced(). Defaults to off — no route in this skeleton limits free-plan users until it's set to true.",
      },
    ],
  },
  {
    title: "email (Resend)",
    required: false,
    vars: [
      {
        name: "RESEND_API_KEY",
        configured: () => has("RESEND_API_KEY"),
        note: "With EMAIL_FROM, gates lib/email/send.ts. Unset, sendEmail() no-ops ({ sent: false, reason: \"not-configured\" }) instead of sending.",
      },
      {
        name: "EMAIL_FROM",
        configured: () => has("EMAIL_FROM"),
        note: "Paired with RESEND_API_KEY — see above.",
      },
    ],
  },
  {
    title: "analytics / errors",
    required: false,
    vars: [
      {
        name: "NEXT_PUBLIC_POSTHOG_HOST",
        configured: () => has("NEXT_PUBLIC_POSTHOG_HOST"),
        note: "PostHog ingest host. Falls back to https://us.i.posthog.com when unset (lib/analytics/posthog-{client,server}).",
      },
      {
        name: "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN",
        configured: () => has("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"),
        note: "Gates PostHog entirely. Unset, posthog-js never calls init() client-side and captureServer() no-ops server-side.",
      },
      {
        name: "SENTRY_DSN",
        configured: () => has("SENTRY_DSN"),
        note: "Gates the server Sentry stub (instrumentation.ts). @sentry/nextjs isn't even a dependency yet — see that file's comment for how to enable it.",
      },
      {
        name: "NEXT_PUBLIC_SENTRY_DSN",
        configured: () => has("NEXT_PUBLIC_SENTRY_DSN"),
        note: "Same, for the client stub (instrumentation-client.ts).",
      },
    ],
  },
  {
    title: "images (Recraft)",
    required: false,
    vars: [
      {
        name: "RECRAFT_API_TOKEN",
        configured: () => has("RECRAFT_API_TOKEN"),
        note: "Only for runtime image generation, which this skeleton does not ship — see CLAUDE.md § Add-on recipes. Design-time image generation goes through the Recraft MCP server instead, which uses OAuth and needs no var. Note the two balances are separate: the MCP server spends subscription credits, this token spends pre-purchased API units, and Recraft only offers the token once that unit balance is above zero.",
      },
    ],
  },
];

/** `select 1` against DATABASE_URL with a ~2s timeout, using a fresh,
 *  short-lived connection (max: 1) that's always closed — never the app's
 *  pooled getDb() singleton, which is cached on globalThis for the life of
 *  the dev server and has no place to be torn down from a one-shot script. */
async function checkDbConnectivity(url: string): Promise<{ ok: boolean; detail: string }> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    prepare: false,
    max: 1,
    connect_timeout: 2,
    idle_timeout: 1,
  });
  try {
    await Promise.race([
      sql`select 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timed out after 2s")), 2000),
      ),
    ]);
    return { ok: true, detail: "select 1 succeeded" };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) };
  } finally {
    await sql.end({ timeout: 1 }).catch(() => {});
  }
}

/* ---------------------------------------------------------------------------
 * Gate readiness
 *
 * CLAUDE.md § How work gets done defines a ten-gate loop and asserts that some
 * of its tools are required — hallmark at G4, most of all. An assertion in a
 * markdown file cannot notice its own tool is absent, so a project can run for
 * weeks with a gate silently dark. This section reports which gates actually
 * have a tool behind them.
 *
 * Informational only, like the optional env groups: a dark gate is a fact
 * about the workspace, not a broken build. Only the required env group gates
 * the exit code.
 * ------------------------------------------------------------------------- */

/** Repo root, resolved from this script's own location (web/scripts/doctor.mts)
 *  rather than cwd, so the check works whether doctor is invoked from web/ or
 *  through `corepack pnpm -C web doctor` from the repo root. */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** A skill installed by `npx skills add` lands in .agents/skills/<name>/ and is
 *  symlinked into .claude/skills/<name>/. existsSync follows symlinks, so
 *  either path answers the question. project-init is vendored and lives only
 *  under .claude/skills/. */
const skillInstalled = (name: string): boolean =>
  existsSync(join(REPO_ROOT, ".agents", "skills", name, "SKILL.md")) ||
  existsSync(join(REPO_ROOT, ".claude", "skills", name, "SKILL.md"));

/** User-level Claude Code plugins (superpowers, impeccable) install outside the
 *  repo, so this is a filesystem probe of the plugin cache rather than an
 *  authoritative check.
 *
 *  Plugins nest under their marketplace — superpowers is at
 *  cache/claude-plugins-official/superpowers, not cache/superpowers — so a
 *  top-level-only probe reports a live plugin as dark. Check both levels plus
 *  the data dir, whose entries are named "<plugin>-<marketplace>". */
const pluginInstalled = (name: string): boolean => {
  const base = join(homedir(), ".claude", "plugins");
  const direct = ["cache", "marketplaces", "repos"].some((d) =>
    existsSync(join(base, d, name)),
  );
  if (direct) return true;

  const cache = join(base, "cache");
  if (existsSync(cache)) {
    try {
      for (const marketplace of readdirSync(cache)) {
        if (existsSync(join(cache, marketplace, name))) return true;
      }
    } catch {
      /* unreadable cache dir — fall through to the data-dir probe */
    }
  }

  const data = join(base, "data");
  if (existsSync(data)) {
    try {
      return readdirSync(data).some((entry) => entry.startsWith(`${name}-`));
    } catch {
      return false;
    }
  }
  return false;
};

/** Does .mcp.json declare a server whose key contains `name`?
 *
 *  Declaring a server is not the same as it being reachable: the Recraft
 *  server authenticates over OAuth, so a declared-but-unauthorized server
 *  reports ready here and still fails on first use. Run /mcp to authenticate.
 *  This is a config probe, like the plugin one above, not a health check. */
const mcpDeclared = (name: string): boolean => {
  const p = join(REPO_ROOT, ".mcp.json");
  if (!existsSync(p)) return false;
  try {
    const cfg = JSON.parse(readFileSync(p, "utf8")) as {
      mcpServers?: Record<string, unknown>;
    };
    return Object.keys(cfg.mcpServers ?? {}).some((k) => k.includes(name));
  } catch {
    return false;
  }
};

type GateSpec = {
  gate: string;
  owner: string;
  ready: () => boolean;
  /** Shown (dimmed) only when the gate is dark: what to run, and what is lost. */
  fix: string;
};

const GATES: GateSpec[] = [
  {
    gate: "G0/G9 tracking",
    owner: "bd (beads)",
    ready: () => existsSync(join(REPO_ROOT, ".beads")),
    fix: "bd init --prefix <name> — without it there is no intake or close, and work tracking falls back to chat",
  },
  {
    gate: "G1 intent",
    owner: "intent",
    ready: () => skillInstalled("intent") || pluginInstalled("intent"),
    fix: "npx skills add ghaida/intent --all — new surfaces ship without their purpose written down",
  },
  {
    gate: "G2/G3/G5/G8/G9 process",
    owner: "superpowers",
    ready: () => pluginInstalled("superpowers"),
    fix: "install the superpowers plugin — without it there is no design, planning, or verification gate and work defaults to ad-hoc",
  },
  {
    gate: "G4 structure",
    owner: "hallmark",
    ready: () => skillInstalled("hallmark"),
    fix: "npx skills add nutlope/hallmark — REQUIRED for UI work per CLAUDE.md; without it nothing enforces structural variety or the token lock",
  },
  {
    gate: "G5 dependencies",
    owner: "pick-ui-library",
    ready: () => skillInstalled("pick-ui-library"),
    fix: "npx skills add emilkowalski/skills — hand-rolled primitives and abandoned packages go unchallenged",
  },
  {
    gate: "G6 passes",
    owner: "impeccable",
    ready: () => pluginInstalled("impeccable"),
    fix: "install the impeccable plugin (impeccable.style), then /teach-impeccable — no /critique, /polish, or /audit pass",
  },
  {
    gate: "G6 motion",
    owner: "emil-design-eng",
    ready: () => skillInstalled("emil-design-eng") && skillInstalled("find-animation-opportunities"),
    fix: "npx skills add emilkowalski/skills — motion gets defaults instead of decisions",
  },
  {
    gate: "G8 motion review",
    owner: "review-animations",
    ready: () => skillInstalled("review-animations"),
    fix: "npx skills add emilkowalski/skills — shipped animations get no review pass",
  },
  {
    // The design-review agent's tool list is written against @playwright/mcp's
    // browser_* names — a different Playwright MCP exposes playwright_* and
    // won't resolve, so the key match is necessary but not sufficient.
    gate: "G8 browser review",
    owner: "playwright MCP",
    ready: () => mcpDeclared("playwright"),
    fix: "declare a Playwright server in .mcp.json — /design-review cannot see what actually renders, leaving only static analysis",
  },
  {
    // Not a gate in the ten-gate loop: brandkit and imagegen-frontend-web are
    // both optional and both website/-scoped. But they are the only two skills
    // here that cannot degrade — with no image tool they produce nothing at
    // all, which is worth reporting rather than discovering mid-task.
    gate: "image generation (optional)",
    owner: "recraft MCP",
    ready: () => mcpDeclared("recraft"),
    fix: "claude mcp add --transport http recraft https://mcp.recraft.ai/mcp, then /mcp to authorize — brandkit and imagegen-frontend-web have no image tool and produce nothing",
  },
];

function reportGates(nameWidth: number): number {
  console.log(bold("loop gates"));
  let dark = 0;
  for (const g of GATES) {
    const ok = g.ready();
    if (!ok) dark++;
    const icon = ok ? green("✓") : yellow("○");
    const label = `${g.gate} — ${g.owner}`;
    console.log(`  ${icon} ${label.padEnd(nameWidth)}  ${ok ? "ready" : "dark"}`);
    if (!ok) console.log(`      ${dim(g.fix)}`);
  }
  console.log("");
  return dark;
}

async function main() {
  console.log(`\n${bold("foundation doctor")}`);
  console.log("===================\n");

  let requiredMissing = 0;
  const nameWidth = Math.max(
    ...GROUPS.flatMap((g) => g.vars.map((v) => v.name.length)),
    ...GATES.map((g) => `${g.gate} — ${g.owner}`.length),
  );

  for (const group of GROUPS) {
    console.log(bold(group.title));
    for (const v of group.vars) {
      const pass = v.configured();
      if (!pass && group.required) requiredMissing++;
      const icon = pass ? green("✓") : group.required ? red("✗") : yellow("○");
      const status = pass ? "configured" : "missing";
      console.log(`  ${icon} ${v.name.padEnd(nameWidth)}  ${status}`);
      if (!pass) console.log(`      ${dim(v.note)}`);
    }

    if (group.title === "required to boot") {
      const url = process.env.DATABASE_URL?.trim();
      if (url) {
        const { ok, detail } = await checkDbConnectivity(url);
        const icon = ok ? green("✓") : yellow("○");
        console.log(
          `  ${icon} ${"DATABASE_URL connectivity".padEnd(nameWidth)}  ${ok ? "reachable" : "unreachable"} ${dim(`(informational — ${detail})`)}`,
        );
      }
    }
    console.log("");
  }

  const darkGates = reportGates(nameWidth);

  const gateLine =
    darkGates === 0
      ? "Every loop gate has a tool behind it."
      : `${darkGates} loop gate${darkGates === 1 ? "" : "s"} dark — the checkpoint exists in CLAUDE.md but nothing enforces it.`;

  if (requiredMissing > 0) {
    console.log(
      `Result: ${requiredMissing} required var${requiredMissing === 1 ? "" : "s"} missing. Set ${requiredMissing === 1 ? "it" : "them"} in web/.env.local (see .env.example), then re-run \`corepack pnpm doctor\`. ${gateLine}`,
    );
    process.exit(1);
  }

  console.log(
    `Result: all required vars are set. Optional groups above show what's configured vs. degraded. ${gateLine}`,
  );
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error("doctor failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
