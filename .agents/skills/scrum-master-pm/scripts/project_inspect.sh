#!/usr/bin/env bash
# project_inspect.sh - Fast project deep-dive inspector for Scrum Master / PM
# Usage: ./project_inspect.sh [project-name-or-path]

set -euo pipefail

TARGET="${1:-.}"

# If argument is just a name, look in ~/Desktop/Progetti/
if [[ ! -d "$TARGET" && -d "$HOME/Desktop/Progetti/$TARGET" ]]; then
  TARGET="$HOME/Desktop/Progetti/$TARGET"
fi

if [[ ! -d "$TARGET" ]]; then
  echo "Error: Directory '$TARGET' does not exist." >&2
  exit 1
fi

PROJECT_NAME="$(basename "$TARGET")"
echo "========================================================"
echo " 🔍 PROJECT INSPECTION: $PROJECT_NAME"
echo " Location: $TARGET"
echo "========================================================"

echo ""
echo "--- 1. GIT STATUS ---"
if [[ -d "$TARGET/.git" ]]; then
  echo "Branch: $(git -C "$TARGET" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'none')"
  echo "Recent Commits:"
  git -C "$TARGET" log -3 --oneline 2>/dev/null || echo "No commits yet"
  echo "Uncommitted changes:"
  git -C "$TARGET" status --short 2>/dev/null | head -n 10 || echo "Clean"
else
  echo "No Git repository found."
fi

echo ""
echo "--- 2. RULES & GUIDELINES ---"
for rule in "$TARGET/GEMINI.md" "$TARGET/AGENTS.md" "$TARGET/CLAUDE.md"; do
  if [[ -f "$rule" ]]; then
    echo "Found $(basename "$rule") (First 15 lines):"
    head -n 15 "$rule" | sed 's/^/  /'
    echo ""
  fi
done

if [[ -d "$TARGET/.agents/rules" ]]; then
  echo "Found .agents/rules/:"
  ls -la "$TARGET/.agents/rules" | sed 's/^/  /'
fi

echo ""
echo "--- 3. CONFIG & SCRIPTS ---"
if [[ -f "$TARGET/package.json" ]]; then
  echo "package.json scripts:"
  node -e "
    const p = require('$TARGET/package.json');
    if (p.scripts) {
      Object.entries(p.scripts).forEach(([k, v]) => console.log('  ' + k + ': ' + v));
    } else {
      console.log('  No scripts defined');
    }
  " 2>/dev/null || echo "Failed to parse package.json"
elif [[ -f "$TARGET/pyproject.toml" || -f "$TARGET/requirements.txt" ]]; then
  echo "Python dependencies detected."
  if [[ -f "$TARGET/requirements.txt" ]]; then
    head -n 10 "$TARGET/requirements.txt" | sed 's/^/  /'
  fi
fi

echo ""
echo "--- 4. DIRECTORY TOPOLOGY ---"
ls -F "$TARGET" | head -n 25 | sed 's/^/  /'

echo ""
echo "========================================================"
echo " Inspection complete for $PROJECT_NAME"
echo "========================================================"
