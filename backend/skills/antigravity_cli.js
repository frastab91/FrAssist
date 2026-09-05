/**
 * Antigravity CLI Skill (antigravity_cli)
 * 
 * Provides programmatic integration with the Google Antigravity CLI (agy)
 * to inspect, scaffold, register, and automate software projects inside ~/Desktop/Progetti.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export const declaration = {
  name: 'antigravity_cli',
  description: 'Interface with the Google Antigravity CLI (agy) to list, scaffold, configure, and execute tasks across software projects in ~/Desktop/Progetti.',
  parameters: {
    type: 'OBJECT',
    properties: {
      action: {
        type: 'STRING',
        enum: ['list_projects', 'create_project', 'run_task', 'get_status'],
        description: 'The action to perform: "list_projects" (inventory all projects in ~/Desktop/Progetti), "create_project" (scaffold a new repository and register it in Antigravity), "run_task" (execute a prompt using headless agy -p inside a project), or "get_status" (check agy CLI version and system readiness).'
      },
      projectName: {
        type: 'STRING',
        description: 'The target project folder name inside ~/Desktop/Progetti (e.g. "my-new-app", "portfolio-v2"). Required for "create_project" and "run_task".'
      },
      prompt: {
        type: 'STRING',
        description: 'The instruction/prompt to pass to agy -p for bootstrapping or running an agent task.'
      },
      description: {
        type: 'STRING',
        description: 'Optional human-readable description of the project when creating it.'
      }
    },
    required: ['action']
  }
};

const HOME = os.homedir();
const PROGETTI_DIR = path.join(HOME, 'Desktop', 'Progetti');
const CONFIG_PROJECTS_DIR = path.join(HOME, '.gemini', 'config', 'projects');
const AGY_BIN_CANDIDATES = [
  path.join(HOME, '.local', 'bin', 'agy'),
  '/usr/local/bin/agy',
  'agy'
];

async function findAgyBinary() {
  for (const bin of AGY_BIN_CANDIDATES) {
    if (bin.startsWith('/') && fs.existsSync(bin)) {
      return bin;
    }
  }
  try {
    const { stdout } = await execAsync('which agy');
    if (stdout.trim()) return stdout.trim();
  } catch (e) {
    // ignore
  }
  return AGY_BIN_CANDIDATES[0];
}

function getRegisteredProjects() {
  const map = new Map();
  if (!fs.existsSync(CONFIG_PROJECTS_DIR)) return map;

  const files = fs.readdirSync(CONFIG_PROJECTS_DIR);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const fullPath = path.join(CONFIG_PROJECTS_DIR, file);
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const resources = data.projectResources?.resources || [];
      for (const res of resources) {
        if (res.folderUri) {
          map.set(res.folderUri.replace('file://', ''), {
            id: data.id || path.basename(file, '.json'),
            name: data.name,
            file
          });
        }
      }
    } catch (err) {
      // skip invalid configs
    }
  }
  return map;
}

export async function execute(args = {}) {
  const { action, projectName, prompt, description } = args;
  const agyBin = await findAgyBinary();

  switch (action) {
    case 'get_status': {
      let version = 'unknown';
      let available = false;
      try {
        const { stdout } = await execAsync(`"${agyBin}" --version`);
        version = stdout.trim();
        available = true;
      } catch (err) {
        version = `Error: ${err.message}`;
      }

      const registeredMap = getRegisteredProjects();
      let diskProjectsCount = 0;
      if (fs.existsSync(PROGETTI_DIR)) {
        diskProjectsCount = fs.readdirSync(PROGETTI_DIR, { withFileTypes: true })
          .filter(e => e.isDirectory()).length;
      }

      return {
        status: 'success',
        available,
        agyPath: agyBin,
        version,
        progettiDirectory: PROGETTI_DIR,
        totalProjectsOnDisk: diskProjectsCount,
        registeredAntigravityProjects: registeredMap.size
      };
    }

    case 'list_projects': {
      if (!fs.existsSync(PROGETTI_DIR)) {
        return { status: 'error', message: `Base directory ${PROGETTI_DIR} not found.` };
      }

      const registeredMap = getRegisteredProjects();
      const entries = fs.readdirSync(PROGETTI_DIR, { withFileTypes: true });
      const projects = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const projectPath = path.join(PROGETTI_DIR, entry.name);
        const registered = registeredMap.get(projectPath);

        projects.push({
          name: entry.name,
          path: projectPath,
          hasGit: fs.existsSync(path.join(projectPath, '.git')),
          hasGeminiMd: fs.existsSync(path.join(projectPath, 'GEMINI.md')),
          isRegistered: !!registered,
          projectId: registered?.id || null
        });
      }

      return {
        status: 'success',
        count: projects.length,
        projects
      };
    }

    case 'create_project': {
      if (!projectName) {
        return { status: 'error', message: 'projectName parameter is required for create_project.' };
      }

      const cleanName = projectName.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '-');
      const projectPath = path.join(PROGETTI_DIR, cleanName);

      // 1. Create directory
      const isNew = !fs.existsSync(projectPath);
      if (isNew) {
        fs.mkdirSync(projectPath, { recursive: true });
      }

      // 2. Initialize Git if needed
      const gitDir = path.join(projectPath, '.git');
      if (!fs.existsSync(gitDir)) {
        try {
          await execAsync('git init -b main', { cwd: projectPath });
        } catch (e) {
          try { await execAsync('git init', { cwd: projectPath }); } catch (ignored) {}
        }
      }

      // 3. Create .gitignore if missing
      const gitignorePath = path.join(projectPath, '.gitignore');
      if (!fs.existsSync(gitignorePath)) {
        fs.writeFileSync(gitignorePath, [
          'node_modules/',
          'dist/',
          'build/',
          '.env',
          '.env.local',
          '.DS_Store',
          '*.log',
          'venv/',
          '__pycache__/',
          '.gemini/'
        ].join('\n') + '\n', 'utf8');
      }

      // 4. Create GEMINI.md if missing
      const geminiMdPath = path.join(projectPath, 'GEMINI.md');
      if (!fs.existsSync(geminiMdPath)) {
        fs.writeFileSync(geminiMdPath, [
          `# ${cleanName}`,
          '',
          '## Project Overview',
          description ? description : `Project ${cleanName} managed via Antigravity.`,
          '',
          '## Workspace Details',
          `- Path: \`${projectPath}\``,
          `- Created: ${new Date().toISOString().split('T')[0]}`,
          '',
          '## Workflow Guidelines',
          '- Write clean, modular, tested code.',
          '- Follow established repository patterns.'
        ].join('\n') + '\n', 'utf8');
      }

      // 5. Register in Antigravity Projects config
      fs.mkdirSync(CONFIG_PROJECTS_DIR, { recursive: true });
      const registeredMap = getRegisteredProjects();
      let projectId = registeredMap.get(projectPath)?.id;

      if (!projectId) {
        projectId = crypto.randomUUID();
        const projectConfig = {
          id: projectId,
          name: cleanName,
          projectResources: {
            resources: [
              { folderUri: `file://${projectPath}` }
            ]
          },
          settings: {
            fileAccessPolicy: 'AGENT_SETTING_POLICY_ALLOW',
            internetPolicy: 'AGENT_SETTING_POLICY_ASK',
            autoExecutionPolicy: 'CASCADE_COMMANDS_AUTO_EXECUTION_OFF',
            artifactReviewMode: 'ARTIFACT_REVIEW_MODE_ALWAYS'
          },
          updatedAt: new Date().toISOString()
        };
        fs.writeFileSync(path.join(CONFIG_PROJECTS_DIR, `${projectId}.json`), JSON.stringify(projectConfig, null, 2), 'utf8');
      }

      // 6. Optional bootstrap prompt via agy
      let promptOutput = null;
      if (prompt) {
        try {
          const { stdout } = await execFileAsync(
            agyBin,
            ['-p', prompt, '--dangerously-skip-permissions'],
            { cwd: projectPath, timeout: 180000, maxBuffer: 5 * 1024 * 1024 }
          );
          promptOutput = stdout.trim();
        } catch (err) {
          promptOutput = `Bootstrap prompt failed or timed out: ${err.message}`;
        }
      }

      return {
        status: 'success',
        isNew,
        projectName: cleanName,
        projectPath,
        projectId,
        registeredConfigFile: `${projectId}.json`,
        promptOutput
      };
    }

    case 'run_task': {
      if (!projectName) {
        return { status: 'error', message: 'projectName parameter is required for run_task.' };
      }
      if (!prompt) {
        return { status: 'error', message: 'prompt parameter is required for run_task.' };
      }

      const cleanName = projectName.trim().replace(/[^a-zA-Z0-9_\-\.]/g, '-');
      const projectPath = path.join(PROGETTI_DIR, cleanName);

      if (!fs.existsSync(projectPath)) {
        return { status: 'error', message: `Project directory ${projectPath} does not exist.` };
      }

      const startTime = Date.now();
      try {
        const { stdout, stderr } = await execFileAsync(
          agyBin,
          ['-p', prompt, '--dangerously-skip-permissions'],
          { cwd: projectPath, timeout: 300000, maxBuffer: 10 * 1024 * 1024 }
        );
        const durationMs = Date.now() - startTime;
        return {
          status: 'success',
          projectName: cleanName,
          durationMs,
          output: stdout.trim(),
          diagnostics: stderr ? stderr.trim() : null
        };
      } catch (err) {
        const durationMs = Date.now() - startTime;
        return {
          status: 'error',
          projectName: cleanName,
          durationMs,
          message: err.message,
          stdout: err.stdout ? err.stdout.trim() : '',
          stderr: err.stderr ? err.stderr.trim() : ''
        };
      }
    }

    default:
      return {
        status: 'error',
        message: `Unknown action "${action}". Valid actions: get_status, list_projects, create_project, run_task.`
      };
  }
}
