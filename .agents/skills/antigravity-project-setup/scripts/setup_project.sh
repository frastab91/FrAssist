#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${1:-}"
INITIAL_PROMPT="${2:-}"

if [ -z "$PROJECT_NAME" ]; then
  echo "Usage: $0 <project-name> [initial-prompt-or-stack]"
  exit 1
fi

BASE_DIR="$HOME/Desktop/Progetti"
PROJECT_DIR="$BASE_DIR/$PROJECT_NAME"
AGY_BIN="$HOME/.local/bin/agy"
CONFIG_PROJECTS_DIR="$HOME/.gemini/config/projects"

echo "==> Initializing Antigravity project: $PROJECT_NAME"

# 1. Create project directory
if [ -d "$PROJECT_DIR" ]; then
  echo "[-] Directory already exists: $PROJECT_DIR"
else
  mkdir -p "$PROJECT_DIR"
  echo "[+] Created directory: $PROJECT_DIR"
fi

# 2. Initialize Git if not present
if [ ! -d "$PROJECT_DIR/.git" ]; then
  git -C "$PROJECT_DIR" init -b main >/dev/null 2>&1 || git -C "$PROJECT_DIR" init >/dev/null 2>&1
  echo "[+] Initialized git repository"
fi

# 3. Create .gitignore if not present
if [ ! -f "$PROJECT_DIR/.gitignore" ]; then
  cat <<'EOF' > "$PROJECT_DIR/.gitignore"
node_modules/
dist/
build/
.env
.env.local
.DS_Store
*.log
venv/
__pycache__/
.gemini/
EOF
  echo "[+] Created .gitignore"
fi

# 4. Create GEMINI.md if not present
if [ ! -f "$PROJECT_DIR/GEMINI.md" ]; then
  cat <<EOF > "$PROJECT_DIR/GEMINI.md"
# $PROJECT_NAME

## Project Overview
This project was scaffolded using the Antigravity CLI and setup skill.

## Stack & Architecture
- Workspace Path: \`$PROJECT_DIR\`
- Created: $(date -u +"%Y-%m-%d")

## Workflow & Guidelines
- Maintain clean, modular code with surgical changes.
- Test thoroughly before deploying.
EOF
  echo "[+] Created GEMINI.md"
fi

# 5. Register in Antigravity Projects config if not already registered
mkdir -p "$CONFIG_PROJECTS_DIR"
PROJECT_ID=""

# Check if already registered
for conf in "$CONFIG_PROJECTS_DIR"/*.json; do
  if [ -f "$conf" ]; then
    if grep -q "file://$PROJECT_DIR" "$conf" 2>/dev/null; then
      PROJECT_ID=$(basename "$conf" .json)
      echo "[-] Project already registered with ID: $PROJECT_ID"
      break
    fi
  fi
done

if [ -z "$PROJECT_ID" ]; then
  PROJECT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000000Z")
  cat <<EOF > "$CONFIG_PROJECTS_DIR/$PROJECT_ID.json"
{
  "id": "$PROJECT_ID",
  "name": "$PROJECT_NAME",
  "projectResources": {
    "resources": [
      {
        "folderUri": "file://$PROJECT_DIR"
      }
    ]
  },
  "settings": {
    "fileAccessPolicy": "AGENT_SETTING_POLICY_ALLOW",
    "internetPolicy": "AGENT_SETTING_POLICY_ASK",
    "autoExecutionPolicy": "CASCADE_COMMANDS_AUTO_EXECUTION_OFF",
    "artifactReviewMode": "ARTIFACT_REVIEW_MODE_ALWAYS"
  },
  "updatedAt": "$TIMESTAMP"
}
EOF
  echo "[+] Registered Antigravity project config ($PROJECT_ID.json)"
fi

# 6. Run initial prompt if requested and agy is installed
if [ -n "$INITIAL_PROMPT" ]; then
  if [ -x "$AGY_BIN" ]; then
    echo "==> Running bootstrap prompt with Antigravity CLI..."
    cd "$PROJECT_DIR"
    "$AGY_BIN" -p "$INITIAL_PROMPT" --dangerously-skip-permissions
  else
    echo "[!] agy binary not found at $AGY_BIN. Skipping headless bootstrap prompt."
  fi
fi

echo "==> Setup complete!"
echo "    Project Path: $PROJECT_DIR"
echo "    Project ID:   $PROJECT_ID"
echo "    To launch CLI inside project:"
echo "      cd $PROJECT_DIR && agy"
