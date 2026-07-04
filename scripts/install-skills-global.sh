#!/usr/bin/env bash
# Copy this repo's vendored Claude Code skills into ~/.claude/skills so they
# are available in every Claude Code session, not just inside this project.
# Re-run after pulling skill updates; existing copies are replaced.
set -euo pipefail

REPO_SKILLS="$(cd "$(dirname "$0")/.." && pwd)/.claude/skills"
DEST="${HOME}/.claude/skills"

mkdir -p "$DEST"

for dir in "$REPO_SKILLS"/*/; do
  name="$(basename "$dir")"
  rm -rf "${DEST:?}/${name}"
  cp -R "$dir" "$DEST/$name"
  echo "Installed $name -> $DEST/$name"
done

echo
echo "Done. New Claude Code sessions anywhere will pick these up."
echo "Note: the threads-carousel skill needs a one-time 'bun install'"
echo "(or npm/pnpm) inside $DEST/threads-carousel/template/."
