---
description: Complete a design review of the pending changes on the current branch
---

Gate G8's UI review. Dispatch the **`design-review`** subagent
([.claude/agents/design-review-agent.md](../agents/design-review-agent.md)) — it owns the
methodology, the review phases, and the Playwright tool set. This command only gathers the
change context and hands it over, so the two never drift apart.

BRANCH:

```
!`git branch --show-current`
```

BASE (falls back to the root commit when there is no remote):

```
!`git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || git rev-parse --verify -q origin/HEAD || git rev-list --max-parents=0 HEAD | tail -1`
```

GIT STATUS:

```
!`git status --short`
```

FILES MODIFIED:

```
!`BASE=$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || git rev-parse --verify -q origin/HEAD || git rev-list --max-parents=0 HEAD | tail -1); git diff --name-only "$BASE"...HEAD`
```

COMMITS:

```
!`BASE=$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || git rev-parse --verify -q origin/HEAD || git rev-list --max-parents=0 HEAD | tail -1); git log --no-decorate "$BASE"..HEAD`
```

DIFF CONTENT:

```
!`BASE=$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || git rev-parse --verify -q origin/HEAD || git rev-list --max-parents=0 HEAD | tail -1); git diff "$BASE"...HEAD`
```

OBJECTIVE:

Dispatch the `design-review` subagent against the diff above. Your final reply must contain
its markdown report and nothing else.

The review is bound by [DESIGN_PRINCIPLES.md](../../DESIGN_PRINCIPLES.md) and
[LANGUAGE_PATTERNS.md](../../LANGUAGE_PATTERNS.md), which override any skill's page-level
defaults — see CLAUDE.md § When skills disagree.

PREREQUISITES — check these before dispatching, and say so plainly if one is missing rather
than reviewing statically and calling it a design review:

- **A running dev server.** `corepack pnpm -C web dev` (port 3000). This review's whole value
  is the live environment; static-only is what `/audit` is for.
- **The Playwright MCP server**, declared in [.mcp.json](../../.mcp.json) at the repo root.
  It exposes `browser_*` tools. If the available tools are named `playwright_*` instead, a
  different Playwright MCP is connected and the agent's tool list will not resolve.
- **Auth env for any signed-in surface**, loaded from `web/.env.local`: `TEST_USER_EMAIL`,
  `TEST_USER_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.