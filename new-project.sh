#!/usr/bin/env bash
#
# new-project.sh — copy the foundation skeleton into a new project and make it
# runnable in one command.
#
# Phases: preflight → copy → rename → git init → deps → env → skills → tracker
#         → doctor. Every phase is skippable, and anything that touches the
#         network or the filesystem outside $TARGET says so before it runs.
#
# Deliberately NOT done here: provisioning external services. That needs
# judgment and confirmation per resource, so it lives in the project-init
# skill, which this script points you at when it finishes.
#
#   ./new-project.sh myapp ~/repos/myapp
#   ./new-project.sh myapp ~/repos/myapp --no-install --no-skills
#
set -euo pipefail

NAME=""
TARGET=""
DO_INSTALL=1
DO_SKILLS=1
DO_GIT=1
DO_ENV=1
DO_DOCTOR=1

usage() {
  cat >&2 <<'USAGE'
usage: ./new-project.sh <name> <target-dir> [options]

  <name>        lowercase letters, digits, hyphens — replaces the `foundation`
                token in file contents and filenames
  <target-dir>  must not already exist

options:
  --no-install  skip `pnpm install` in the three apps
  --no-skills   skip installing the pinned design skills
  --no-git      skip git init and the bootstrap commit
  --no-env      skip seeding .env.local from .env.example
  --no-doctor   skip the closing health check
  --minimal     copy and rename only (implies all of the above)
  -h, --help    show this
USAGE
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --no-install) DO_INSTALL=0 ;;
    --no-skills)  DO_SKILLS=0 ;;
    --no-git)     DO_GIT=0 ;;
    --no-env)     DO_ENV=0 ;;
    --no-doctor)  DO_DOCTOR=0 ;;
    --minimal)    DO_INSTALL=0; DO_SKILLS=0; DO_GIT=0; DO_ENV=0; DO_DOCTOR=0 ;;
    -h|--help)    usage ;;
    -*)           echo "error: unknown option $1" >&2; usage ;;
    *)
      if [ -z "$NAME" ]; then NAME="$1"
      elif [ -z "$TARGET" ]; then TARGET="$1"
      else echo "error: unexpected argument $1" >&2; usage
      fi
      ;;
  esac
  shift
done

[ -n "$NAME" ] && [ -n "$TARGET" ] || usage

SRC="$(cd "$(dirname "$0")" && pwd)"
APPS=(web website admin)

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m○\033[0m %s\n' "$1"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Phase 0 — preflight
#
# Validate before copying anything: a failure after the copy leaves a
# half-built project that the `$TARGET already exists` guard then blocks you
# from retrying.
# ---------------------------------------------------------------------------
step "Preflight"

case "$NAME" in
  (*[!a-z0-9-]*) die "name must be lowercase letters, digits, hyphens" ;;
  (foundation)   die "name 'foundation' would make the rename pass a no-op" ;;
esac
[ -e "$TARGET" ] && die "$TARGET already exists"
ok "name and target look good"

command -v git >/dev/null 2>&1 || die "git not found"
command -v rsync >/dev/null 2>&1 || die "rsync not found"

# corepack ships with Node but is opt-in; the apps pin pnpm 11 via
# packageManager, and a shell-installed pnpm 9 fails to parse the workspace
# files with an unrelated-looking error. Enable it now rather than letting the
# install phase fail confusingly.
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$NODE_MAJOR" -lt 20 ]; then
    die "node $(node --version) is too old — Next 16 needs >= 20"
  fi
  ok "node $(node --version)"
else
  die "node not found"
fi

if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || warn "corepack enable failed (may need sudo) — install phase may fall back to your shell pnpm"
  ok "corepack available"
else
  warn "corepack not found — skipping dependency install"
  DO_INSTALL=0
fi

if [ "$DO_SKILLS" -eq 1 ] && ! command -v npx >/dev/null 2>&1; then
  warn "npx not found — skipping skill install"
  DO_SKILLS=0
fi

HAVE_BD=0
if command -v bd >/dev/null 2>&1; then HAVE_BD=1; ok "bd (beads) available"
else warn "bd not found — issue tracker will not be initialized"; fi

# ---------------------------------------------------------------------------
# Phase 1 — copy
#
# Installed skills (.agents/ payload + .claude/skills symlinks) are excluded on
# purpose: skills-lock.json carries the pins and phase 5 reinstalls them fresh.
# Copying would freeze a snapshot and expose skill files to the rename pass.
# project-init is vendored and ours, so it comes along.
# ---------------------------------------------------------------------------
step "Copying skeleton"
mkdir -p "$TARGET"
rsync -a "$SRC"/ "$TARGET"/ \
  --exclude .git --exclude node_modules --exclude .next \
  --exclude .beads --exclude docs/superpowers --exclude .superpowers \
  --exclude new-project.sh --exclude .claude/settings.local.json \
  --include '/.claude/skills/project-init/***' \
  --exclude '/.claude/skills/*' --exclude .agents
ok "copied to $TARGET"

# ---------------------------------------------------------------------------
# Phase 2 — rename
# ---------------------------------------------------------------------------
step "Renaming foundation -> $NAME"
RENAMED=0
while IFS= read -r f; do
  perl -pi -e "s/foundation/$NAME/g" "$f"
  RENAMED=$((RENAMED + 1))
done < <(grep -rlF foundation "$TARGET" 2>/dev/null || true)
ok "rewrote $RENAMED file(s)"

# depth-first so children are renamed before their parents
while IFS= read -r p; do
  mv "$p" "$(dirname "$p")/$(basename "$p" | sed "s/foundation/$NAME/g")"
done < <(find "$TARGET" -depth -name '*foundation*' ! -path "$TARGET" || true)

if grep -rlF foundation "$TARGET" >/dev/null 2>&1; then
  warn "some files still contain 'foundation' — check them by hand"
else
  ok "no 'foundation' token remains"
fi

cd "$TARGET"

# ---------------------------------------------------------------------------
# Phase 3 — env
#
# Seed .env.local from .env.example so the app has a file to fill in. These are
# gitignored and contain no secrets — every value is empty. Never write a real
# credential here; that is project-init's job, and it writes only to .env.local.
# ---------------------------------------------------------------------------
if [ "$DO_ENV" -eq 1 ]; then
  step "Seeding .env.local files"
  for app in "${APPS[@]}"; do
    if [ -f "$app/.env.example" ] && [ ! -f "$app/.env.local" ]; then
      cp "$app/.env.example" "$app/.env.local"
      ok "$app/.env.local (from .env.example, all values empty)"
    else
      warn "$app/.env.local skipped (no example, or it already exists)"
    fi
  done
fi

# ---------------------------------------------------------------------------
# Phase 4 — dependencies
# ---------------------------------------------------------------------------
if [ "$DO_INSTALL" -eq 1 ]; then
  step "Installing dependencies (three apps, this takes a few minutes)"
  for app in "${APPS[@]}"; do
    if [ -f "$app/package.json" ]; then
      printf '  installing %s ... ' "$app"
      if corepack pnpm -C "$app" install --silent >/dev/null 2>&1; then
        printf '\033[32mdone\033[0m\n'
      else
        printf '\033[33mfailed\033[0m\n'
        warn "retry with: corepack pnpm -C $app install"
      fi
    fi
  done
fi

# ---------------------------------------------------------------------------
# Phase 5 — design skills
#
# Reinstalled from the pins in skills-lock.json rather than copied, so a new
# project picks up upstream fixes instead of inheriting a frozen snapshot.
# These land in .agents/skills/ and are symlinked into .claude/skills/, both
# gitignored. Fetches from GitHub over the network.
# ---------------------------------------------------------------------------
if [ "$DO_SKILLS" -eq 1 ] && [ -f skills-lock.json ]; then
  PINNED="$(node -p 'Object.keys(require("./skills-lock.json").skills || {}).length' 2>/dev/null || echo "?")"
  step "Installing $PINNED pinned design skills (fetches from GitHub)"

  # Restore from the lockfile, NOT by re-adding each source. `skills add <source>`
  # installs every skill in that repo, which would undo the curation: this project
  # deliberately keeps 8 of intent's 17 and 4 of emil's 7. experimental_install
  # reads skills-lock.json and restores exactly what is pinned.
  #
  # `< /dev/null` is load-bearing on every npx call here — without it the CLI can
  # consume the surrounding script's stdin.
  if npx -y skills@latest experimental_install </dev/null >/dev/null 2>&1; then
    INSTALLED="$(ls .agents/skills 2>/dev/null | wc -l | tr -d ' ')"
    ok "restored $INSTALLED skill(s) from skills-lock.json"
  else
    warn "lockfile restore failed — retry with: npx skills experimental_install"
    warn "do NOT fall back to \`skills add <source>\`; it installs whole repos and undoes the curation"
  fi
  warn "impeccable and superpowers are user-level plugins — install them separately"
fi

# ---------------------------------------------------------------------------
# Phase 6 — git + tracker
#
# bd init writes its own commit, so it runs before the bootstrap commit and the
# fallback below only fires when there is still something uncommitted.
# ---------------------------------------------------------------------------
if [ "$DO_GIT" -eq 1 ]; then
  step "Initializing git and the issue tracker"
  git init -b main -q
  git add -A
  if [ "$HAVE_BD" -eq 1 ]; then
    bd init --prefix "$NAME" --non-interactive >/dev/null 2>&1 || warn "bd init failed"
    git add -A
  fi
  if ! git diff --cached --quiet 2>/dev/null || ! git rev-parse HEAD >/dev/null 2>&1; then
    git commit -qm "chore: bootstrap $NAME from the foundation skeleton" || true
  fi
  ok "$(git rev-list --count HEAD 2>/dev/null || echo 0) commit(s) on main, no remote yet"
fi

# ---------------------------------------------------------------------------
# Phase 7 — health check
# ---------------------------------------------------------------------------
if [ "$DO_DOCTOR" -eq 1 ] && [ "$DO_INSTALL" -eq 1 ] && [ -f web/package.json ]; then
  step "Health check"
  # doctor exits 1 while required vars are unset, which is expected here — the
  # point is the report, not the status.
  corepack pnpm -C web doctor 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
step "Ready"
bold "$NAME is at $TARGET"
cat <<NEXT

Next, in a Claude Code session opened at $TARGET:

  1. Run the project-init skill. It provisions the external services —
     Supabase is required to boot; Vercel, Stripe, GitHub, Resend, Anthropic,
     Inngest, PostHog, and Recraft are optional — and writes the keys into each
     app's .env.local. It confirms before creating any cloud resource.

     It also finishes the setup this script cannot: authorizing the Recraft MCP
     server over OAuth, /teach-impeccable, intent's project-context pass, and —
     if the project has no brand yet — generating a brand kit and writing it
     into the design tokens. That last step spends Recraft credits and asks
     first. Skipping it ships the placeholder AI-purple accent.

  2. corepack pnpm -C web db:migrate     # once DATABASE_URL is set
  3. corepack pnpm -C web dev            # http://localhost:3000

Read CLAUDE.md first for the conventions and the work loop. \`corepack pnpm -C
web doctor\` reports which slices are configured and which loop gates are live.
NEXT
