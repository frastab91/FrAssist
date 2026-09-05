#!/usr/bin/env bash
# install_global.sh - Installs or syncs scrum-master-pm agent and skill across projects
# Usage:
#   ./install_global.sh global            (installs to ~/.gemini/config/ if writable)
#   ./install_global.sh sync <proj-name>  (syncs to ~/Desktop/Progetti/<proj-name>/.agents)
#   ./install_global.sh sync-all          (syncs to all projects in ~/Desktop/Progetti/)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPT_DIR")"
AGENTS_DIR="$(dirname "$(dirname "$SKILL_DIR")")"
WORKSPACE_DIR="$(dirname "$AGENTS_DIR")"

MODE="${1:-help}"

case "$MODE" in
  global)
    GLOBAL_CONFIG="$HOME/.gemini/config"
    echo "Attempting to install to global config: $GLOBAL_CONFIG"
    if [[ -d "$GLOBAL_CONFIG" ]]; then
      mkdir -p "$GLOBAL_CONFIG/agents" "$GLOBAL_CONFIG/skills"
      cp -r "$AGENTS_DIR/agents/scrum-master-pm" "$GLOBAL_CONFIG/agents/" || true
      cp -r "$SKILL_DIR" "$GLOBAL_CONFIG/skills/" || true
      echo "Installed to $GLOBAL_CONFIG!"
    else
      echo "Notice: Global config directory $GLOBAL_CONFIG not found or not writable."
      echo "Use 'sync <project-name>' to install to a specific project."
    fi
    ;;

  sync)
    TARGET="${2:-}"
    if [[ -z "$TARGET" ]]; then
      echo "Error: Must specify project name. Example: ./install_global.sh sync host-new" >&2
      exit 1
    fi
    TARGET_DIR="$HOME/Desktop/Progetti/$TARGET"
    if [[ ! -d "$TARGET_DIR" ]]; then
      echo "Error: Directory $TARGET_DIR does not exist." >&2
      exit 1
    fi
    echo "Syncing scrum-master-pm to $TARGET_DIR/.agents/ ..."
    mkdir -p "$TARGET_DIR/.agents/agents" "$TARGET_DIR/.agents/skills" "$TARGET_DIR/.agents/tasks"
    cp -r "$AGENTS_DIR/agents/scrum-master-pm" "$TARGET_DIR/.agents/agents/"
    cp "$AGENTS_DIR/agents/scrum-master-pm.md" "$TARGET_DIR/.agents/agents/"
    cp -r "$SKILL_DIR" "$TARGET_DIR/.agents/skills/"
    if [[ ! -f "$TARGET_DIR/.agents/tasks/backlog.md" ]]; then
      cp "$AGENTS_DIR/tasks/backlog.md" "$TARGET_DIR/.agents/tasks/backlog.md"
    fi
    echo "Synced successfully to $TARGET_DIR!"
    ;;

  sync-all)
    echo "Syncing scrum-master-pm to active flagships (host-new, rallynyc, open-ai-supply-chain)..."
    for proj in host-new rallynyc open-ai-supply-chain; do
      if [[ -d "$HOME/Desktop/Progetti/$proj" ]]; then
        bash "$0" sync "$proj"
      fi
    done
    echo "Flagships synced!"
    ;;

  *)
    echo "Usage:"
    echo "  $0 global            - Install globally to ~/.gemini/config/"
    echo "  $0 sync <project>    - Sync to ~/Desktop/Progetti/<project>/.agents/"
    echo "  $0 sync-all          - Sync to host-new, rallynyc, and open-ai-supply-chain"
    ;;
esac
