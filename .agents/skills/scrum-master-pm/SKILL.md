---
name: scrum-master-pm
description: Review user feedback, triage feature requests and bugs, inspect projects in ~/Desktop/Progetti (e.g., host-new, rallynyc, FrAssist, open-ai-supply-chain), and author structured coding agent tasks with acceptance criteria and verification commands.
---

# Scrum Master & Product Manager Skill (`scrum-master-pm`)

This skill provides operational workflows, project discovery runbooks, and task specification templates for triaging user feedback and orchestrating AI coding agents across all repositories in `~/Desktop/Progetti/`.

## When to Activate
Activate this skill whenever:
- The user provides user feedback, customer bug reports, or feature ideas.
- You need to plan, size, or break down work for coding agents.
- You need to determine which project in `~/Desktop/Progetti/` should receive a change.
- You need to author unambiguous task specifications with acceptance criteria and verification commands.
- You need to maintain a sprint backlog or track tasks across multiple projects.

---

## 1. Project Directory & Tools

- **Base Directory**: `/Users/francescostabilito/Desktop/Progetti/`
- **Portfolio Registry**: [PROJECTS_REGISTRY.md](./PROJECTS_REGISTRY.md) (50+ projects indexed)
- **Machine Registry Data**: [projects.json](./projects.json)
- **Automated Index Refresh**: `python3 .agents/skills/scrum-master-pm/scripts/index_all_projects.py`
- **Target Project Inspector**: `bash .agents/skills/scrum-master-pm/scripts/project_inspect.sh <project-name>`
- **Backlog File**: `.agents/tasks/backlog.md`

---

## 2. Standard Triage & Specification Workflow

Follow this 4-step runbook for every feedback item or feature request:

### Step 1: Ingest & Categorize Feedback
Identify:
1. **Source / Intent**: What is the user actually trying to accomplish?
2. **Category**: `Bug Fix` | `Feature` | `UX/UI Polish` | `Refactor/Debt` | `Performance` | `Security`
3. **Priority**:
   - **P0**: System unusable, build broken, critical data issue.
   - **P1**: Essential core feature or blocking user workflow.
   - **P2**: Quality-of-life improvement, secondary flow.
   - **P3**: Cosmetic enhancement, exploratory.
4. **Target Project**: Identify which project in `~/Desktop/Progetti/` owns this domain:
   - Real estate / Hospitality / Rentals: `host-new`, `trusthost`, `unical-housing`
   - Sports / Tennis & Pickleball / NYC: `rallynyc`, `rallynyc-native`
   - Local AI Assistant / Automation: `FrAssist`, `agents-polisher`
   - Supply Chain & Optimization: `open-ai-supply-chain`
   - Scalea Tourism & Community: `scalea-slow-living-website`
   - Financial / Investment: `burst-invest`

### Step 2: Target Project Technical Discovery
Run the inspector on the chosen project:
```bash
bash .agents/skills/scrum-master-pm/scripts/project_inspect.sh <project-name>
```
Extract:
- **Framework & Language**: Next.js, Vite/React, Node/Express, Python, TypeScript.
- **Rule Files**: Does it have `AGENTS.md` or `GEMINI.md`? (e.g. `rallynyc` requires restating the task in one sentence before coding).
- **Test / Build Commands**: Exact scripts from `package.json` (e.g. `npm run build`, `tsc && vite build`).
- **File Structure**: Where do components, routes, database clients, and tests reside?

### Step 3: Author the Coding Agent Task Specification
Write the task using the standard schema:

```markdown
### [TASK-XXX] [P1] <Title>
- **Target Project**: `<project-name>` (`/Users/francescostabilito/Desktop/Progetti/<project-name>`)
- **Type**: Feature | Bug Fix | Enhancement | Refactor
- **Complexity**: S / M / L
- **Status**: Ready for Dev

#### Context & User Story
> *As a [user persona], I want [capability] so that [benefit].*
[Context and explanation of the user feedback.]

#### Scope Boundaries
- **IN SCOPE**:
  - [Exact deliverable 1]
  - [Exact deliverable 2]
- **OUT OF SCOPE** (Do NOT touch):
  - [Explicit boundary to prevent regression or bloat]

#### Target Files
- **[MODIFY]** `path/to/file.tsx`: [Description]
- **[NEW]** `path/to/new_file.tsx`: [Description]
- **[REFERENCE]** `path/to/pattern.ts`: [Follow style/types]

#### Technical Requirements
- Follow existing patterns in [reference file].
- Follow project rules in `AGENTS.md` or `GEMINI.md`.

#### Acceptance Criteria (Definition of Done)
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Build & tests pass without error (`<test-or-build-cmd>`).

#### Verification Commands
```bash
cd /Users/francescostabilito/Desktop/Progetti/<project-name>
<exact test/build command>
```

#### Ready-to-Use Coding Agent Prompt
```text
You are assigned to complete [TASK-XXX] in project <project-name> (/Users/francescostabilito/Desktop/Progetti/<project-name>).
Task: <One sentence clear objective>.
Requirements:
1. Target files: [list files]
2. Boundaries: Do not touch [out of scope items]
3. Follow guidelines in [AGENTS.md / GEMINI.md]
4. Acceptance criteria:
   - [criterion 1]
   - [criterion 2]
5. Verify your work by running: `<test-or-build-cmd>`
Provide a concise summary of changes once verified.
```
```

### Step 4: Record in Backlog
Add the task to `.agents/tasks/backlog.md` under the appropriate section (`Active Sprint`, `Ready for Dev`, or `Backlog`).

---

## 3. Dispatching Tasks to Coding Agents

**CRITICAL RULE**: As the Scrum Master/PM, you MUST NOT change project codebase files directly. You are strictly forbidden from using file writing tools (`write_to_file`, `replace_file_content`, etc.) to modify project source code. 

Once a task is authored, you can execute or delegate it in two ways:

### Method A: Headless Terminal Execution via `agy` (Mandatory for automated updates)
If the user prompts you to implement the changes or apply the updates, you must execute non-interactively using the Antigravity CLI via the `run_command` tool. You orchestrate the workflow, but the CLI does the coding:
```bash
cd /Users/francescostabilito/Desktop/Progetti/<project-name>
agy -p "<paste ready-to-use prompt here>" --dangerously-skip-permissions
```

### Method B: Interactive Chat Handoff
Present the copy-pasteable prompt block directly to the user so they can paste it into the chat panel of the target project workspace themselves.
