# Agent Instructions

This is `foundation` — a copyable Next.js starter (`web/` product app, `website/` marketing site, `admin/` ops shell) on Supabase, Drizzle, Mastra, Stripe, Resend, and Inngest. Full stack details, per-app commands, the layout map, and every project convention (tenancy, auth, Mastra tooling, motion, perf defaults) live in [CLAUDE.md](CLAUDE.md) — read that first for anything beyond issue tracking. `web/`, `website/`, and `admin/` are independent apps, each with its own `package.json`/lockfile; there is no root `package.json`.

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

> **Architecture in one line:** Issues live in a local Dolt database
> (`.beads/dolt/`); cross-machine sync uses `bd dolt push/pull` (a
> git-compatible protocol), stored under `refs/dolt/data` on your git
> remote — separate from `refs/heads/*` where your code lives.
> `.beads/issues.jsonl` is a passive export, not the wire protocol.
>
> See [SYNC_CONCEPTS.md](https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md)
> for the one-screen overview and anti-patterns (don't treat JSONL as the
> source of truth; don't `bd import` during normal operation; don't
> reach for third-party Dolt hosting before trying the default).

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd dolt push          # Push beads data to remote
```

## Development workflow

Every unit of work runs the same loop. The canonical version, with the reasoning behind each gate, is [CLAUDE.md § How work gets done](CLAUDE.md) — this is the short form.

| Gate | Fires when | What runs |
|---|---|---|
| **G0 · Intake** | Any request | `bd create` / `bd show`, `bd update <id> --claim`. Classify: creative / bug / UI / mechanical. |
| **G1 · Intent** | New surface or flow, or assumed-value feature | `intent` (Design with Intent) — problem framing, user, evidence, measurement. |
| **G2 · Design** | Creative track | `superpowers:brainstorming` → spec in `docs/superpowers/specs/`. **Human approves before any code.** |
| **G3 · Plan** | Spec approved | `superpowers:writing-plans` → plan in `docs/superpowers/plans/`. **Human approves.** |
| **G4 · Structure** | Any UI work | `hallmark`, before layout code. Required, not optional. |
| **G5 · Build** | Plan approved | `superpowers:subagent-driven-development` or `executing-plans`, `test-driven-development` inside each task. Bug track: `systematic-debugging` replaces G1–G4. A task wanting a new UI dependency stops and runs `pick-ui-library`. |
| **G6 · Polish** | UI functional | impeccable `/critique` → fix → `/polish`, then `find-animation-opportunities` → `emil-design-eng` for motion. |
| **G7 · Gates** | Before review and before done | typecheck, lint, test, `test:tenancy`, build; `check:drift` in `admin/` if schema moved; the LANGUAGE_PATTERNS greps if copy moved. |
| **G8 · Review** | Branch ready | `superpowers:requesting-code-review`; for UI, `/design-review` against a running dev server, plus `review-animations` if motion changed. Then `receiving-code-review`. |
| **G9 · Verify & close** | All green | `superpowers:verification-before-completion` → `bd close` → commit → **push** → `bd remember`. |

Tracks skip differently: **bug** is G0 → systematic-debugging → G5 → G7 → G9; **mechanical** (rename, dep bump, config, docs) is G0 → G5 → G7 → G9. If a mechanical task grows a design question, stop and re-enter at G2.

**Hard stops.** No code before an approved spec on the creative track. No UI surface without hallmark. No repository query without `eq(table.userId, userId)`. No new palette or font in `web/`/`admin/` (tokens in `web/app/globals.css` are the theme; `website/` is the exception). No secret outside a gitignored `.env.local`. No outward or hard-to-reverse action without confirmation. No "done" without verification, green gates, and a successful push. No TodoWrite — bd is the tracker.

**Precedence.** Process skills set the approach; design and domain tools (`hallmark`, four of the seven `emilkowalski/skills`, the `nextjs-frontend-expert` / `mastra-workflow-architect` subagents) execute inside the plan those skills produce. `/issues` and `/work` are GitHub-Issues commands kept for projects that track work there instead — this project uses bd.

**Skills are installed, not vendored.** [skills-lock.json](skills-lock.json) pins each by source and content hash; `npx skills add` writes to `.agents/skills/` and symlinks into `.claude/skills/`, both gitignored. `project-init` runs the installs and is itself the only vendored skill. See [CLAUDE.md § Design & Copy](CLAUDE.md) for what each one owns. The lockfile pins a curated subset of each repo, so `npx skills add <repo>` without `--skill` undoes the curation. It also can't constrain what's installed at the **user** level: of tasteskill's 14 skills only `design-taste-frontend` is pinned, but `brandkit`, `imagegen-frontend-web`, and `redesign-existing-projects` are commonly reachable anyway — CLAUDE.md § The tasteskill family states when each may fire.

**Recraft** is declared as an MCP server in [.mcp.json](.mcp.json). Its main use is generating **SVG** — a logo, a domain-specific mark, an illustration — which works in any app because a normalized SVG inherits `currentColor` and survives the token lock. Never generate a generic UI icon; the icon library owns those. Strip baked hex fills before the file lands in `web/`/`admin/`. It's also the tool `brandkit` and `imagegen-frontend-web` depend on, the only two skills that produce nothing at all without it. OAuth, so no secret in the file; optional; bills against a different balance than its REST API does. Nothing in `web/` calls it at runtime. See CLAUDE.md § Recraft.

**When design skills disagree**, CLAUDE.md § When skills disagree is the tiebreaker — it audits the installed skill text against this project's constraints. The five that bite most often: emil's motion sequence beats impeccable's `/animate`; any `framer-motion` import in a skill example gets rewritten to `motion/react`; CSS is for state changes only, Motion owns entry/exit/morph/gesture; `/colorize`, `/bolder`, `/delight` are `website/`-only because `web/` and `admin/` are token-locked and deliberately quiet; and `redesign-existing-projects` is never invoked anywhere — `design-taste-frontend` § 11 owns `website/` redesigns, and in `web/`/`admin/` that skill's first two fixes are "replace the font" and "collapse to one accent color".

Specs: `docs/superpowers/specs/`. Plans: `docs/superpowers/plans/`. Worked example: this skeleton's own [design spec](docs/superpowers/specs/2026-07-22-foundation-skeleton-design.md) and [implementation plan](docs/superpowers/plans/2026-07-22-foundation-skeleton.md). The subagent-driven-development execution ledger lives in `.superpowers/sdd/` — gitignored scratch, not a deliverable.

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

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
