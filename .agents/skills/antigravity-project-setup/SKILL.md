---
name: antigravity-project-setup
description: >-
  Scaffold, initialize, and bootstrap development projects in ~/Desktop/Progetti using
  the Antigravity CLI (agy). Use this skill whenever the user asks to create a new project,
  setup a repository in ~/Desktop/Progetti, register an Antigravity project workspace,
  or run initial project scaffolding commands via agy.
---

# Antigravity Project Setup (`antigravity-project-setup`)

This skill standardizes and automates scaffolding new software projects inside `~/Desktop/Progetti` using the Google Antigravity CLI (`agy`) and Antigravity workspace conventions.

## Paths & Locations
- **Projects Base Directory**: `/Users/francescostabilito/Desktop/Progetti/`
- **CLI Executable**: `/Users/francescostabilito/.local/bin/agy`
- **Global Project Registry**: `~/.gemini/config/projects/<uuid>.json`
- **Workspace Customizations Root**: `<project-dir>/.agents/`
- **Workspace Rules File**: `<project-dir>/GEMINI.md`

---

## Scaffolding Procedure

When instructed to set up a new project named `<project-name>`:

### 1. Collision & Safety Check
Before creating any files, verify whether the project directory already exists:
```bash
ls -d ~/Desktop/Progetti/<project-name>
```
If the directory exists and has existing code, confirm before modifying or use non-destructive updates.

### 2. Directory & Git Initialization
Create the project folder and initialize Git:
```bash
mkdir -p ~/Desktop/Progetti/<project-name>
cd ~/Desktop/Progetti/<project-name>
git init
```

### 3. Antigravity Project Registration
Generate a project configuration file in `~/.gemini/config/projects/<project-id>.json` where `<project-id>` is a UUIDv4:
```json
{
  "id": "<uuid-v4>",
  "name": "<project-name>",
  "projectResources": {
    "resources": [
      {
        "folderUri": "file:///Users/francescostabilito/Desktop/Progetti/<project-name>"
      }
    ]
  },
  "settings": {
    "fileAccessPolicy": "AGENT_SETTING_POLICY_ALLOW",
    "internetPolicy": "AGENT_SETTING_POLICY_ASK",
    "autoExecutionPolicy": "CASCADE_COMMANDS_AUTO_EXECUTION_OFF",
    "artifactReviewMode": "ARTIFACT_REVIEW_MODE_ALWAYS"
  },
  "updatedAt": "<iso-timestamp>"
}
```

### 4. Standard Project Assets
In `<project-dir>/`, seed:
1. **`.gitignore`**:
   Standard excludes: `node_modules/`, `venv/`, `.env`, `.DS_Store`, `dist/`, `build/`, `.gemini/`.
2. **`GEMINI.md`**:
   Project overview, architecture notes, persona instructions, and command shortcuts.
3. **`.agents/rules/`** (optional):
   Coding guidelines and standards specific to this project stack.

### 5. Headless Bootstrapping with `agy`
To scaffold frameworks (e.g. Vite, Next.js, FastAPI, Express) or implement initial features non-interactively, use **headless print mode** with the auto-approval flag:
```bash
cd ~/Desktop/Progetti/<project-name>
/Users/francescostabilito/.local/bin/agy -p "<initial setup prompt>" --dangerously-skip-permissions
```

> [!IMPORTANT]
> Always pass `--dangerously-skip-permissions` during automated / non-interactive `agy -p` executions, otherwise command execution tools will be auto-denied because headless mode cannot render interactive confirmation prompts.

---

## One-Shot Helper Script
For instant execution, use the bundled helper script:
```bash
bash .agents/skills/antigravity-project-setup/scripts/setup_project.sh "<project-name>" "[stack-or-prompt]"
```
Or when using the global skill:
```bash
bash ~/.gemini/config/skills/antigravity-project-setup/scripts/setup_project.sh "<project-name>" "[stack-or-prompt]"
```
