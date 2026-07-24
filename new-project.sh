#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "usage: ./new-project.sh <name> <target-dir>" >&2
  exit 1
fi

NAME="$1"
TARGET="$2"
SRC="$(cd "$(dirname "$0")" && pwd)"

case "$NAME" in
  (*[!a-z0-9-]*) echo "error: name must be lowercase letters, digits, hyphens" >&2; exit 1 ;;
esac
if [ -e "$TARGET" ]; then
  echo "error: $TARGET already exists" >&2
  exit 1
fi

mkdir -p "$TARGET"
# Installed skills (.agents/ payload + .claude/skills symlinks) are deliberately
# NOT copied: skills-lock.json carries the pins, and project-init reinstalls them
# fresh in the new project. Copying would freeze a snapshot and expose the skill
# files to the rename pass below. project-init itself is ours, so it comes along.
rsync -a "$SRC"/ "$TARGET"/ \
  --exclude .git --exclude node_modules --exclude .next \
  --exclude .beads --exclude docs/superpowers --exclude .superpowers \
  --exclude new-project.sh --exclude .claude/settings.local.json \
  --include '/.claude/skills/project-init/***' \
  --exclude '/.claude/skills/*' --exclude .agents

# rename: file contents
grep -rlF foundation "$TARGET" 2>/dev/null | while IFS= read -r f; do
  perl -pi -e "s/foundation/$NAME/g" "$f"
done
# rename: any file/dir names carrying the token (depth-first so children first)
find "$TARGET" -depth -name '*foundation*' ! -path "$TARGET" | while IFS= read -r p; do
  mv "$p" "$(dirname "$p")/$(basename "$p" | sed "s/foundation/$NAME/g")"
done

cd "$TARGET"
git init -b main -q
git add -A
if command -v bd >/dev/null 2>&1; then
  bd init --prefix "$NAME" --non-interactive >/dev/null 2>&1 || true
  git add -A
  if ! git diff-index --quiet HEAD --; then
    git commit -qm "chore: bootstrap $NAME from foundation skeleton"
  fi
else
  git commit -qm "chore: bootstrap $NAME from foundation skeleton"
  echo "note: bd not installed; skipped tracker init"
fi
corepack enable >/dev/null 2>&1 || true

echo "created $TARGET"
echo "next: cd $TARGET/web && cp .env.example .env.local && corepack pnpm install && corepack pnpm dev"
