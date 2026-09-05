#!/usr/bin/env python3
"""
Multi-Project Indexer for ~/Desktop/Progetti
Crawls all repositories and generates a comprehensive registry of:
- Tech stacks (Next.js, Vite/React, Node/Express, Python, etc.)
- Database & BaaS (Supabase, Firebase, Postgres, etc.)
- Styling & UI frameworks (Tailwind, CSS modules, etc.)
- Rule files (AGENTS.md, GEMINI.md, CLAUDE.md)
- Available test, dev, and build scripts
Outputs both PROJECTS_REGISTRY.md and projects.json.
"""

import os
import json
import subprocess
from datetime import datetime

BASE_DIR = os.path.expanduser("~/Desktop/Progetti")
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SKILL_DIR = os.path.dirname(SCRIPT_DIR)
OUTPUT_MD = os.path.join(SKILL_DIR, "PROJECTS_REGISTRY.md")
OUTPUT_JSON = os.path.join(SKILL_DIR, "projects.json")

def get_git_info(project_path):
    git_dir = os.path.join(project_path, ".git")
    if not os.path.exists(git_dir):
        return {"has_git": False, "branch": None, "last_commit": None, "clean": True}
    
    try:
        branch = subprocess.check_output(
            ["git", "-C", project_path, "rev-parse", "--abbrev-ref", "HEAD"],
            stderr=subprocess.DEVNULL,
            text=True
        ).strip()
        last_commit = subprocess.check_output(
            ["git", "-C", project_path, "log", "-1", "--format=%s (%cr)"],
            stderr=subprocess.DEVNULL,
            text=True
        ).strip()
        status = subprocess.check_output(
            ["git", "-C", project_path, "status", "--porcelain"],
            stderr=subprocess.DEVNULL,
            text=True
        ).strip()
        clean = len(status) == 0
        return {
            "has_git": True,
            "branch": branch,
            "last_commit": last_commit,
            "clean": clean
        }
    except Exception:
        return {"has_git": True, "branch": "unknown", "last_commit": None, "clean": True}

def inspect_project(name, path):
    pkg_file = os.path.join(path, "package.json")
    req_file = os.path.join(path, "requirements.txt")
    pyproject_file = os.path.join(path, "pyproject.toml")
    gemini_file = os.path.join(path, "GEMINI.md")
    agents_file = os.path.join(path, "AGENTS.md")
    claude_file = os.path.join(path, "CLAUDE.md")
    readme_file = os.path.join(path, "README.md")
    
    stack = []
    framework = "Unknown"
    ui = []
    database = []
    services = []
    scripts = {}
    lang = []
    
    # Check for TypeScript
    if (os.path.exists(os.path.join(path, "tsconfig.json")) or 
        any(fname.endswith(".ts") or fname.endswith(".tsx") for fname in os.listdir(path) if os.path.isfile(os.path.join(path, fname)))):
        lang.append("TypeScript")
    elif any(fname.endswith(".js") or fname.endswith(".jsx") or fname.endswith(".mjs") for fname in os.listdir(path) if os.path.isfile(os.path.join(path, fname))):
        lang.append("JavaScript")
        
    if os.path.exists(req_file) or os.path.exists(pyproject_file) or any(fname.endswith(".py") for fname in os.listdir(path) if os.path.isfile(os.path.join(path, fname))):
        lang.append("Python")

    # Parse package.json
    if os.path.exists(pkg_file):
        try:
            with open(pkg_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                scripts = data.get("scripts", {})
                deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
                
                # Framework detection
                if "next" in deps:
                    framework = f"Next.js ({deps.get('next', 'latest')})"
                elif "vite" in deps:
                    framework = "Vite + React" if "react" in deps else ("Vite + Vue" if "vue" in deps else "Vite")
                elif "react" in deps:
                    framework = "React (CRA/Custom)"
                elif "vue" in deps:
                    framework = "Vue"
                elif "astro" in deps:
                    framework = "Astro"
                elif "express" in deps:
                    framework = "Node.js / Express"
                else:
                    framework = "Node.js"
                
                # UI / Styling
                if "tailwindcss" in deps or os.path.exists(os.path.join(path, "tailwind.config.js")) or os.path.exists(os.path.join(path, "tailwind.config.ts")):
                    ui.append("TailwindCSS")
                if "lucide-react" in deps or "@heroicons/react" in deps:
                    ui.append("Lucide/Heroicons")
                if "framer-motion" in deps or "motion" in deps:
                    ui.append("Framer Motion")
                if "@radix-ui/react-slot" in deps or os.path.exists(os.path.join(path, "components/ui")):
                    ui.append("shadcn/ui (Radix)")
                    
                # Database / BaaS
                if "@supabase/supabase-js" in deps or "@supabase/ssr" in deps:
                    database.append("Supabase")
                if "firebase" in deps:
                    database.append("Firebase")
                if "prisma" in deps or "@prisma/client" in deps:
                    database.append("Prisma")
                if "drizzle-orm" in deps:
                    database.append("Drizzle")
                if "pg" in deps or "postgres" in deps:
                    database.append("PostgreSQL")
                    
                # Third-party integrations
                if "resend" in deps:
                    services.append("Resend")
                if "@stripe/stripe-js" in deps or "stripe" in deps:
                    services.append("Stripe")
                if "openai" in deps:
                    services.append("OpenAI API")
                if "@google/genai" in deps or "@google/generative-ai" in deps:
                    services.append("Gemini API")
        except Exception as e:
            framework = f"Node.js (Parse error: {e})"
    elif "Python" in lang:
        framework = "Python"
        content = ""
        if os.path.exists(req_file):
            try:
                with open(req_file, "r") as f:
                    content += f.read().lower()
            except Exception:
                pass
        if os.path.exists(pyproject_file):
            try:
                with open(pyproject_file, "r") as f:
                    content += f.read().lower()
            except Exception:
                pass
                
        if "fastapi" in content:
            framework = "Python (FastAPI)"
        elif "flask" in content:
            framework = "Python (Flask)"
        elif "django" in content:
            framework = "Python (Django)"
        elif "streamlit" in content:
            framework = "Python (Streamlit)"
            
        if "supabase" in content:
            database.append("Supabase")
        if "psycopg" in content or "asyncpg" in content:
            database.append("PostgreSQL")
        if "openai" in content:
            services.append("OpenAI API")
            
    # Check for Supabase directory
    if os.path.exists(os.path.join(path, "supabase")) and "Supabase" not in database:
        database.append("Supabase (Local config)")

    readme_snippet = ""
    if os.path.exists(readme_file):
        try:
            with open(readme_file, "r", encoding="utf-8") as f:
                lines = [l.strip() for l in f.readlines() if l.strip() and not l.startswith("#")]
                if lines:
                    readme_snippet = lines[0][:120]
        except Exception:
            pass

    rule_files = []
    if os.path.exists(gemini_file): rule_files.append("GEMINI.md")
    if os.path.exists(agents_file): rule_files.append("AGENTS.md")
    if os.path.exists(claude_file): rule_files.append("CLAUDE.md")
    if os.path.exists(os.path.join(path, ".agents")): rule_files.append(".agents/")

    git_info = get_git_info(path)

    return {
        "name": name,
        "path": path,
        "framework": framework,
        "languages": lang or ["Unknown"],
        "ui": ui,
        "database": database,
        "services": services,
        "scripts": scripts,
        "rule_files": rule_files,
        "description": readme_snippet,
        "git": git_info
    }

def main():
    if not os.path.exists(BASE_DIR):
        print(f"Error: Base directory {BASE_DIR} does not exist.")
        return

    projects = []
    for item in sorted(os.listdir(BASE_DIR)):
        full_path = os.path.join(BASE_DIR, item)
        if os.path.isdir(full_path) and not item.startswith(".") and not item.endswith(".worktrees"):
            projects.append(inspect_project(item, full_path))

    # Save JSON
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(projects, f, indent=2)

    # Generate Markdown Registry
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    
    md_lines = [
        "# Projects Registry (`~/Desktop/Progetti`)",
        "",
        f"> **Last Generated**: {now}  ",
        f"> **Total Monitored Projects**: {len(projects)}  ",
        "> This registry is automatically maintained by the `scrum-master-pm` indexing engine.",
        "",
        "---",
        "",
        "## Key Active Flagship Projects",
        "",
    ]

    flagships = ["host-new", "rallynyc", "FrAssist", "open-ai-supply-chain", "scalea-slow-living-website", "trusthost"]
    flagship_data = [p for p in projects if p["name"] in flagships]

    for p in flagship_data:
        langs = ", ".join(p["languages"])
        db = ", ".join(p["database"]) if p["database"] else "None detected"
        ui = ", ".join(p["ui"]) if p["ui"] else "Standard"
        svc = ", ".join(p["services"]) if p["services"] else "None"
        rules = ", ".join(p["rule_files"]) if p["rule_files"] else "None"
        test_script = p["scripts"].get("test", "No test script")
        dev_script = p["scripts"].get("dev", p["scripts"].get("start", "No dev script"))
        
        md_lines.extend([
            f"### `{p['name']}`",
            f"- **Path**: `{p['path']}`",
            f"- **Framework**: **{p['framework']}** ({langs})",
            f"- **UI & Styling**: {ui}",
            f"- **Data / Backend**: {db}",
            f"- **Third-Party Services**: {svc}",
            f"- **Rules & Instructions**: {rules}",
            f"- **Key Commands**:",
            f"  - Dev: `{dev_script}`",
            f"  - Test: `{test_script}`",
            f"- **Git Status**: branch `{p['git']['branch']}`, clean: `{p['git']['clean']}`",
            f"- **Summary**: {p['description'] or 'No description'}",
            "",
        ])

    md_lines.extend([
        "---",
        "",
        "## Complete Portfolio Directory",
        "",
        "| Project | Framework | Language | Database | UI | Rules | Git Branch |",
        "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
    ])

    for p in projects:
        name_cell = f"**`{p['name']}`**"
        fw_cell = p["framework"].split(" ")[0]
        lang_cell = p["languages"][0] if p["languages"] else "-"
        db_cell = p["database"][0] if p["database"] else "-"
        ui_cell = p["ui"][0] if p["ui"] else "-"
        rules_cell = "✓ (" + ", ".join(p["rule_files"]) + ")" if p["rule_files"] else "-"
        git_cell = p["git"]["branch"] or "-"
        md_lines.append(f"| {name_cell} | {fw_cell} | {lang_cell} | {db_cell} | {ui_cell} | {rules_cell} | {git_cell} |")

    md_lines.extend([
        "",
        "---",
        "",
        "## Multi-Project Task Creation Rubric for AI Coding Agents",
        "",
        "When authoring coding tasks targeting any of the above projects:",
        "1. **Never guess the framework:** Check this registry or run `bash scripts/project_inspect.sh <project-name>` to get exact dependencies.",
        "2. **Check Rules files:** If the project has `AGENTS.md` or `GEMINI.md`, the coding agent **MUST** read and adhere to project-specific rules.",
        "3. **Target Specific Directories:**",
        "   - In Next.js App Router (`host-new`): components belong in `components/`, routes in `app/`, database client in `utils/supabase/` or `lib/`.",
        "   - In Vite/React (`rallynyc`, `scalea-slow-living-website`): code lives in `src/`, static assets in `public/`.",
        "   - In Full-stack (`FrAssist`): frontend is in `frontend/`, backend is in `backend/`.",
        "4. **Exact Testing Commands:** Always instruct the coding agent with the project's real test command (e.g. `npm test`, `npx vitest run`, `pytest`).",
    ])

    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines))

    print(f"Successfully indexed {len(projects)} projects.")
    print(f"Markdown registry saved to: {OUTPUT_MD}")
    print(f"JSON registry saved to: {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
