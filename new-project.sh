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
DO_BRAND=1

# Brand profile. Empty means "ask if we have a TTY, otherwise leave a TODO in
# the brief for project-init Step 10 to fill in."
BRAND_DESC=""
BRAND_AUDIENCE=""
BRAND_VIBE=""
ACCENT_HUE=""

# design-taste-frontend's dials for website/. Its § 0 re-infers these on every
# invocation unless they are written down, so two pages built a week apart
# don't match. Defaults are lower than the skill's own baseline (8/6/4) because
# DESIGN_PRINCIPLES.md's reference apps are Linear and Raycast, not an agency
# portfolio. Override in the brief, not here.
DIAL_VARIANCE=6
DIAL_MOTION=4
DIAL_DENSITY=4

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
  --no-brand    skip the brand profile phase entirely
  --minimal     copy and rename only (implies all of the above)
  -h, --help    show this

brand profile (optional — writes docs/brand/BRIEF.md for project-init Step 10):
  --desc <text>       one line on what the product does
  --audience <text>   who it is for
  --vibe <text>       three adjectives, comma-separated
  --accent-hue <deg>  0-360. Rotates website/'s accent off the shipped hue 260,
                      preserving the tuned lightness/chroma in both themes.
                      260 is the AI-purple that design-taste-frontend bans as
                      the top generated-design tell, so anything else is an
                      improvement. 25 warm red, 145 green, 200 cyan, 60 amber.

Unset brand fields are prompted for when stdin is a terminal, and left as TODO
in the brief otherwise. Nothing here generates images — that needs Recraft and
a Claude session, so it belongs to project-init Step 10.
USAGE
  exit 1
}

# Defined before the parse loop so option handlers can call die().
bold() { printf '\033[1m%s\033[0m\n' "$1"; }
step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
warn() { printf '  \033[33m○\033[0m %s\n' "$1"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$1" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --no-install) DO_INSTALL=0 ;;
    --no-skills)  DO_SKILLS=0 ;;
    --no-git)     DO_GIT=0 ;;
    --no-env)     DO_ENV=0 ;;
    --no-doctor)  DO_DOCTOR=0 ;;
    --no-brand)   DO_BRAND=0 ;;
    --minimal)    DO_INSTALL=0; DO_SKILLS=0; DO_GIT=0; DO_ENV=0; DO_DOCTOR=0; DO_BRAND=0 ;;
    --desc)        [ $# -ge 2 ] || die "--desc needs a value";        BRAND_DESC="$2";     shift ;;
    --audience)    [ $# -ge 2 ] || die "--audience needs a value";    BRAND_AUDIENCE="$2"; shift ;;
    --vibe)        [ $# -ge 2 ] || die "--vibe needs a value";        BRAND_VIBE="$2";     shift ;;
    --accent-hue)  [ $# -ge 2 ] || die "--accent-hue needs a value";  ACCENT_HUE="$2";     shift ;;
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

# Validated here rather than at use, so a typo fails before anything is copied.
if [ -n "$ACCENT_HUE" ]; then
  case "$ACCENT_HUE" in
    (*[!0-9]*|"") die "--accent-hue must be a whole number 0-360, got '$ACCENT_HUE'" ;;
  esac
  [ "$ACCENT_HUE" -le 360 ] || die "--accent-hue must be 0-360, got '$ACCENT_HUE'"
  # An `a && b && warn` chain would return non-zero when the guard is false,
  # which `set -e` turns into an exit. Keep it an if.
  if [ "$ACCENT_HUE" -ge 250 ] && [ "$ACCENT_HUE" -le 275 ]; then
    warn "hue $ACCENT_HUE is in the blue-violet band the skeleton already ships — that is the AI-purple tell"
  fi
  ok "accent hue $ACCENT_HUE"
fi

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
# Phase 2.5 — brand profile
#
# The skeleton ships oklch(... 260) as website/'s accent, which is exactly the
# AI-purple design-taste-frontend § 9 names as the top generated-design tell.
# Shipping it unchanged is the default nobody chooses, so this phase makes
# choosing cheap: rotate the hue, and write down the brief that project-init
# Step 10 and the design skills would otherwise each re-infer.
#
# This phase generates nothing. Images need Recraft and a Claude session.
# ---------------------------------------------------------------------------
if [ "$DO_BRAND" -eq 1 ]; then
  step "Brand profile"

  # Prompt only on a terminal, so CI and `--minimal` runs stay non-interactive.
  # `|| true` keeps `set -e` from killing us when read hits EOF.
  if [ -t 0 ]; then
    [ -n "$BRAND_DESC" ]     || { printf '  what does %s do, in one line? ' "$NAME"; read -r BRAND_DESC || true; }
    [ -n "$BRAND_AUDIENCE" ] || { printf '  who is it for? '; read -r BRAND_AUDIENCE || true; }
    [ -n "$BRAND_VIBE" ]     || { printf '  three adjectives for the vibe? '; read -r BRAND_VIBE || true; }
    if [ -z "$ACCENT_HUE" ]; then
      printf '  accent hue 0-360 (blank keeps the shipped AI-purple 260)? '
      read -r ACCENT_HUE || true
      if [ -n "$ACCENT_HUE" ]; then
        case "$ACCENT_HUE" in
          (*[!0-9]*) warn "'$ACCENT_HUE' is not a whole number — ignoring"; ACCENT_HUE="" ;;
        esac
      fi
      if [ -n "$ACCENT_HUE" ] && [ "$ACCENT_HUE" -gt 360 ]; then
        warn "$ACCENT_HUE is out of range 0-360 — ignoring"
        ACCENT_HUE=""
      fi
    fi
  fi

  # Rotate the accent hue, preserving each theme's tuned lightness and chroma.
  # Only `--accent:` and `--ring:` — `--accent-foreground:` is the near-white /
  # near-black text that sits on the accent and must stay neutral.
  if [ -n "$ACCENT_HUE" ] && [ -f website/app/globals.css ]; then
    perl -pi -e "s/(--(?:accent|ring): oklch\([0-9.]+ [0-9.]+ )260\)/\${1}${ACCENT_HUE})/g" \
      website/app/globals.css
    ROTATED="$(grep -cE -- "--(accent|ring): oklch\([0-9.]+ [0-9.]+ ${ACCENT_HUE}\)" website/app/globals.css || true)"
    if [ "$ROTATED" -eq 4 ]; then
      ok "website/ accent rotated to hue $ACCENT_HUE (light + dark)"
    else
      warn "expected 4 token rewrites, made $ROTATED — check website/app/globals.css by hand"
    fi
  else
    warn "website/ accent left at the shipped hue 260 — the AI-purple default"
  fi

  mkdir -p docs/brand
  cat > docs/brand/BRIEF.md <<BRIEF
# $NAME — brand brief

Written by new-project.sh at bootstrap. This is the input to
\`project-init\` Step 10 (brand kit) and the design read that
\`design-taste-frontend\` § 0 would otherwise re-infer on every invocation.

Fill in any TODO before running Step 10.

## What it is

- **Does:** ${BRAND_DESC:-TODO}
- **For:** ${BRAND_AUDIENCE:-TODO}
- **Vibe:** ${BRAND_VIBE:-TODO}

## Tokens

- **Accent hue:** ${ACCENT_HUE:-260 — UNCHANGED, this is the AI-purple default. Rotate it.}
- **Type:** the shipped Geist pairing. Changing it is a Step 10 decision, wired
  through \`next/font\` — never a \`<link>\` to Google Fonts.
- **Do the product apps carry the brand?** TODO — \`website/\` always takes the
  palette; \`web/\` and \`admin/\` are a separate decision. A neutral product UI
  behind a branded marketing site is what this project's reference apps
  (Linear, Raycast) do. Decide explicitly, do not drift into it.

## Dials for \`website/\`

\`design-taste-frontend\` § 1. Written down so two pages built a week apart
match; its § 0 re-infers them per invocation otherwise.

- **DESIGN_VARIANCE:** $DIAL_VARIANCE
- **MOTION_INTENSITY:** $DIAL_MOTION
- **VISUAL_DENSITY:** $DIAL_DENSITY

Lower than the skill's own 8/6/4 baseline on purpose — DESIGN_PRINCIPLES.md's
reference apps are Linear and Raycast, not an agency portfolio. Raise them if
this product's marketing genuinely wants more.

## Not decided here

Logo, identity board, mockups. Those need Recraft and a Claude session — see
CLAUDE.md § Recraft for the SVG path, and run \`project-init\` Step 10.
BRIEF
  ok "docs/brand/BRIEF.md"
fi

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
     if the project has no brand yet — generating a brand kit from
     docs/brand/BRIEF.md and writing it into the design tokens. That last step
     spends Recraft credits and asks first.

     Fill in any TODO left in docs/brand/BRIEF.md before running Step 10.

  2. corepack pnpm -C web db:migrate     # once DATABASE_URL is set
  3. corepack pnpm -C web dev            # http://localhost:3000

Read CLAUDE.md first for the conventions and the work loop. \`corepack pnpm -C
web doctor\` reports which slices are configured and which loop gates are live.
NEXT
