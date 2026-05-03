import express from 'express';
console.log('Backend process starting...');
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import ollama from 'ollama';
import { tavily } from '@tavily/core';
import { Telegraf } from 'telegraf';

let dbPromise = null;
const dynamicSkills = new Map();
const availableAgents = new Map();
let projectData = { activeProjectId: 'default', projects: [] };
const activeAgents = new Map([['orchestrator', { id: 'orchestrator', name: 'Orchestrator', role: 'Main Controller', status: 'idle' }]]);
const agentInstances = new Map();

function loadProjects() {
  const projectsPath = path.join(process.cwd(), 'projects.json');
  if (fs.existsSync(projectsPath)) {
    projectData = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
    console.log(`Loaded ${projectData.projects.length} projects. Active: ${projectData.activeProjectId}`);
  }
}
function saveProjects() {
  const projectsPath = path.join(process.cwd(), 'projects.json');
  fs.writeFileSync(projectsPath, JSON.stringify(projectData, null, 2));
}
loadProjects();

// Watch for changes in projects.json
fs.watch(path.join(process.cwd(), 'projects.json'), (eventType) => {
  if (eventType === 'change') {
    console.log('projects.json changed. Reloading projects...');
    loadProjects();
  }
});

function updateEnv(key, value) {
  const envPath = path.join(process.cwd(), '.env');
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }
  
  const lines = content.split('\n');
  const index = lines.findIndex(line => line.startsWith(`${key}=`) || line.startsWith(`# ${key}=`));
  
  if (index !== -1) {
    lines[index] = `${key}=${value}`;
  } else {
    lines.push(`${key}=${value}`);
  }
  
  fs.writeFileSync(envPath, lines.join('\n'));
  process.env[key] = value;
  console.log(`Updated .env: ${key} saved permanently.`);
}


async function loadDynamicSkills() {
  const skillsDir = path.join(process.cwd(), 'skills');
  if (!fs.existsSync(skillsDir)) return;
  const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.js'));
  for (const file of files) {
    try {
      const skillPath = path.join(skillsDir, file);
      // Use a timestamp to bypass ESM caching for hot reloading
      const skill = await import(`${skillPath}?t=${Date.now()}`);
      if (skill.declaration && skill.execute) {
        dynamicSkills.set(skill.declaration.name, skill);
        console.log(`Loaded dynamic skill: ${skill.declaration.name}`);
      }
    } catch (e) {
      console.error(`Failed to load skill ${file}:`, e);
    }
  }
}
await loadDynamicSkills();
function initDb() {
  dbPromise = open({
    filename: path.join(process.cwd(), 'database.sqlite'),
    driver: sqlite3.Database
  }).then(db => {
    console.log('SQLite Database initialized');
    return db;
  }).then(async (db) => {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS agent_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agentId TEXT,
        role TEXT,
        parts TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS active_agents (
        agentId TEXT PRIMARY KEY,
        name TEXT,
        role TEXT,
        status TEXT DEFAULT 'idle'
      );
      CREATE TABLE IF NOT EXISTS workflows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        status TEXT DEFAULT 'active',
        data TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS system_stats (
        key TEXT PRIMARY KEY,
        value INTEGER DEFAULT 0
      );
      INSERT OR IGNORE INTO system_stats (key, value) VALUES ('total_input_tokens', 0);
      INSERT OR IGNORE INTO system_stats (key, value) VALUES ('total_output_tokens', 0);
      INSERT OR IGNORE INTO system_stats (key, value) VALUES ('total_requests', 0);
    `);
    console.log('SQLite Database initialized');
    return db;
  });
}
initDb();

const execPromise = util.promisify(exec);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/screenshots', express.static(path.join(process.cwd(), 'screenshots')));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // For development
  },
  maxHttpBufferSize: 1e7 // 10MB
});

async function loadAvailableAgents() {
  const agentsDir = path.join(process.cwd(), 'agents');
  if (!fs.existsSync(agentsDir)) return;
  const dirs = fs.readdirSync(agentsDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  for (const name of dirs) {
    const displayName = name.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    const systemPath = path.join(agentsDir, name, 'system.md');
    if (fs.existsSync(systemPath)) {
      availableAgents.set(name, {
        name: displayName,
        systemPromptPath: systemPath,
        description: `Specialized agent for ${displayName}`
      });
      console.log(`Discovered agent: ${displayName}`);
      
      // Also add to activeAgents so it shows up in the UI Tracker if not already there
      if (!activeAgents.has(name)) {
        activeAgents.set(name, { id: name, name: displayName, role: 'Specialized Agent', status: 'idle' });
      }
    }
  }
  if (io) io.emit('active_agents', Array.from(activeAgents.values()));
}
await loadAvailableAgents();

// Watch for changes in the agents directory
fs.watch(path.join(process.cwd(), 'agents'), { recursive: true }, async (eventType, filename) => {
  if (filename && (filename.endsWith('system.md') || eventType === 'rename')) {
    console.log(`Detected change in agents directory: ${filename}. Reloading agents...`);
    await loadAvailableAgents();
  }
});

function sendLog(socket, agentId, type, message, data = null, level = 'info') {
  if (socket) {
    socket.emit('agent_log', {
      id: Date.now().toString() + Math.random().toString(36).substring(7),
      timestamp: new Date().toISOString(),
      agentId,
      type,
      level,
      message,
      data
    });
  }
}

// Initialize Vertex AI
const project = process.env.GOOGLE_CLOUD_PROJECT || 'rally-nyc';
const location = 'global';

const vertexAI = new VertexAI({
  project: project,
  location: location,
  apiEndpoint: 'aiplatform.googleapis.com',
});

console.log(`Vertex AI initialized for project ${project} in ${location} mode`);

let tvly = null;
if (process.env.TAVILY_API_KEY) {
  tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
}

let tgBot = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
  tgBot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
}

function getToolDeclarations() {
  return [
    {
      functionDeclarations: [
        {
          name: 'run_command',
          description: 'Execute a terminal command on the machine.',
          parameters: {
            type: 'OBJECT',
            properties: {
              command: { type: 'STRING', description: 'The bash command to run' }
            },
            required: ['command']
          }
        },
        {
          name: 'edit_file',
          description: 'Read or write a file. CRITICAL: You are the developer. If the user asks for code, do NOT provide a "blueprint" or "conceptual" response. You MUST use this tool to write the ACTUAL source code to disk. Never ask the user to save a file; always do it yourself. This tool is authorized for all files including index.js, system.md, and .env.',
          parameters: {
            type: 'OBJECT',
            properties: {
              action: { type: 'STRING', enum: ['read', 'write'], description: 'Action to perform' },
              path: { type: 'STRING', description: 'Relative path from project root or absolute path' },
              content: { type: 'STRING', description: 'The entire file content to write. Ensure this is valid, functional code.' }
            },
            required: ['action', 'path']
          }
        },
        {
          name: 'browser_action',
          description: `Interact with the web using the official vercel-labs/agent-browser CLI.
EXHAUSTIVE COMMAND LIST:
- CORE: open [url], click <sel>, dblclick <sel>, fill <sel> <text>, type <sel> <text>, press <key>, keyboard type <text>, keyboard inserttext <text>, keydown <key>, keyup <key>, hover <sel>, focus <sel>, select <sel> <val>, check <sel>, uncheck <sel>, scroll <dir> [px], scrollintoview <sel>, drag <src> <tgt>, upload <sel> <files>, close.
- VISUAL: screenshot [path], screenshot --annotate, pdf <path>.
- INFO: snapshot (accessibility tree with refs - BEST FOR AI REASONING), get text <sel>, get html <sel>, get value <sel>, get attr <sel> <attr>, get title, get url, get count <sel>, get box <sel>, get styles <sel>.
- STATE/STORE: cookies, cookies set <name> <val>, storage local, storage session, dialog accept [text], dialog dismiss, dialog status.
- TABS/WINDOWS: tab, tab new [url], tab new --label <name>, tab <t1|label>, tab close, window new, frame <sel>, frame main.
- NETWORK: network requests, network route <url> --abort, network request <id>, har start/stop.
- NAVIGATION: back, forward, reload, pushstate <url>.
- ADVANCED: batch "[cmd1]" "[cmd2]", diff snapshot, diff screenshot --baseline <path>, trace start/stop, profiler start/stop, console, errors, highlight <sel>, state save/load <path>.

CRITICAL: There is NO 'search' command. To search: open google.com -> fill search box -> press Enter.
WORKFLOW: 1. open -> 2. snapshot (to read refs) -> 3. screenshot (to show user).`,
          parameters: {
            type: 'OBJECT',
            properties: {
              command: { type: 'STRING', description: 'The exact agent-browser command to run (e.g., "open google.com")' }
            },
            required: ['command']
          }
        },
        {
          name: 'supabase_action',
          description: 'Interact with the Supabase database. Use this to discover IDs, list tables, or query data. NEVER ask the user for a UUID if you can find it by listing rows in a table.',
          parameters: {
            type: 'OBJECT',
            properties: {
              action: { type: 'STRING', enum: ['query', 'insert', 'update', 'select_all', 'list_tables'], description: 'Action to perform' },
              table: { type: 'STRING', description: 'Table name (required for query, insert, update, select_all)' },
              query: { type: 'OBJECT', description: 'Query filter (for select) or data (for insert/update)' }
            },
            required: ['action']
          }
        },
        {
          name: 'spawn_agent',
          description: `Spawn a specialized sub-agent. Available agents: ${Array.from(availableAgents.keys()).join(', ') || 'none'}.`,
          parameters: {
            type: 'OBJECT',
            properties: {
              agentId: { type: 'STRING', description: 'A unique ID for the sub-agent' },
              role: { type: 'STRING', description: 'The role name or agent type (e.g., "researcher", "developer")' },
              task: { type: 'STRING', description: 'The specific task to assign' }
            },
            required: ['agentId', 'role', 'task']
          }
        },
        {
          name: 'web_search',
          description: 'Search the live web for current information using Tavily.',
          parameters: {
            type: 'OBJECT',
            properties: {
              query: { type: 'STRING', description: 'The search query' }
            },
            required: ['query']
          }
        },
        {
          name: 'manage_workflow',
          description: 'Manage a complex multi-agent workflow. Use this to track progress across multiple steps and agents.',
          parameters: {
            type: 'OBJECT',
            properties: {
              action: { type: 'STRING', enum: ['start', 'update', 'status', 'list'], description: 'Action to perform' },
              workflowId: { type: 'INTEGER', description: 'ID of the workflow' },
              name: { type: 'STRING', description: 'Name of the workflow' },
              data: { type: 'OBJECT', description: 'JSON data to store' },
              status: { type: 'STRING', description: 'New status' }
            },
            required: ['action']
          }
        },
        {
          name: 'manage_projects',
          description: 'Manage multiple projects/environments. Use this to switch between different Supabase setups.',
          parameters: {
            type: 'OBJECT',
            properties: {
              action: { type: 'STRING', enum: ['list', 'add', 'select', 'delete'], description: 'Action to perform' },
              projectId: { type: 'STRING', description: 'Unique ID for the project' },
              title: { type: 'STRING', description: 'Title of the project' },
              description: { type: 'STRING', description: 'Description of the project' },
              supabaseUrl: { type: 'STRING', description: 'Supabase URL' },
              supabaseKey: { type: 'STRING', description: 'Supabase Service Role Key' }
            },
            required: ['action']
          }
        },
        ...Array.from(dynamicSkills.values()).map(s => s.declaration)
      ]
    }
  ];
}

async function executeTool(call, socket) {
  const name = call.name;
  const args = call.args;
  try {
    if (name === 'run_command') {
      const { stdout, stderr } = await execPromise(args.command, { timeout: 30000 });
      return { output: stdout || stderr || 'Command executed successfully.' };
    }
    if (name === 'edit_file') {
      const filePath = path.isAbsolute(args.path) ? args.path : path.join(process.cwd(), args.path);
      if (args.action === 'read') {
        const content = fs.readFileSync(filePath, 'utf-8');
        return { content };
      } else {
        // Ensure parent directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.writeFileSync(filePath, args.content || '');
        return { status: `File ${path.basename(filePath)} written successfully.` };
      }
    }
    if (name === 'supabase_action') {
      const activeProject = projectData.projects.find(p => p.id === projectData.activeProjectId) || projectData.projects[0];
      if (!activeProject) return { error: 'No active project configured.' };

      // Support multiple naming conventions for the service role key
      const apiKey = activeProject.supabaseServiceRoleKey || activeProject.supabaseKey;
      if (!apiKey) return { error: `No Service Role Key found for project: ${activeProject.title}. Please ensure 'supabaseServiceRoleKey' or 'supabaseKey' is defined.` };

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(activeProject.supabaseUrl, apiKey);
      const { action, table, query } = args;

      if (action === 'list_tables') {
        const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
          headers: { 'apikey': process.env.SUPABASE_KEY, 'Authorization': `Bearer ${process.env.SUPABASE_KEY}` }
        });
        const spec = await response.json();
        const tables = Object.keys(spec.definitions || {});
        return { tables };
      }

      if (!table || table.trim() === '') {
        return { error: 'The "table" argument is required for this action. Please provide a valid table name.' };
      }

      if (action === 'select_all') {
        const { data, error } = await supabase.from(table).select('*');
        if (error) throw error;
        return { data };
      }
      if (action === 'query') {
        let q = supabase.from(table).select('*');
        if (query) {
          Object.entries(query).forEach(([key, val]) => {
            if (typeof val === 'object' && val !== null) {
              // Support operators: { price: { gte: 100, lte: 500 } }
              Object.entries(val).forEach(([op, opVal]) => {
                if (op === 'eq') q = q.eq(key, opVal);
                if (op === 'gt') q = q.gt(key, opVal);
                if (op === 'gte') q = q.gte(key, opVal);
                if (op === 'lt') q = q.lt(key, opVal);
                if (op === 'lte') q = q.lte(key, opVal);
                if (op === 'neq') q = q.neq(key, opVal);
                if (op === 'like') q = q.like(key, opVal);
              });
            } else {
              // Default to equality
              q = q.eq(key, val);
            }
          });
        }
        const { data, error } = await q;
        if (error) throw error;
        return { data };
      }
      if (action === 'insert') {
        const { data, error } = await supabase.from(table).insert(query).select();
        if (error) throw error;
        return { data };
      }
      return { error: 'Unsupported supabase action' };
    }
    if (name === 'spawn_agent') {
      const { agentId, role, task } = args;
      sendLog(socket, 'orchestrator', 'system', `Spawning sub-agent: ${role} (${agentId})`);
      const agentData = { id: agentId, name: role, role: 'Sub-Agent', status: 'working' };
      activeAgents.set(agentId, agentData);
      dbPromise.then(db => db.run('INSERT OR REPLACE INTO active_agents (agentId, name, role, status) VALUES (?, ?, ?, ?)', [agentId, agentData.name, agentData.role, agentData.status]));
      io.emit('agent_spawned', { agentId, name: role, role: 'Sub-Agent' });
      
      // Determine which system prompt to use
      let systemPromptPath = path.join(process.cwd(), 'agents', 'orchestrator', 'system.md');
      const agentType = role.toLowerCase();
      if (availableAgents.has(agentType)) {
        systemPromptPath = availableAgents.get(agentType).systemPromptPath;
        sendLog(socket, 'orchestrator', 'system', `Using specialized system prompt for ${agentType}`);
      } else {
        sendLog(socket, 'orchestrator', 'system', `No specialized agent for "${role}" found. Using default orchestrator prompt.`);
      }

      const subAgent = new Agent(agentId, systemPromptPath);
      const subTaskPath = path.join(process.cwd(), 'tasks', `${agentId}_task.md`);
      fs.writeFileSync(subTaskPath, `# Task for ${role}\n${task}`);
      
      const response = await subAgent.processMessage(`Your role is ${role}. Task: ${task}`, socket);
      return { output: `Sub-agent ${role} finished task. Result: ${response || 'Task completed.'}` };
    }

    if (name === 'manage_workflow') {
      const { action, workflowId, name: workflowName, data, status } = args;
      const db = await dbPromise;

      if (action === 'start') {
        const result = await db.run(
          'INSERT INTO workflows (name, data) VALUES (?, ?)',
          [workflowName, JSON.stringify(data || {})]
        );
        return { workflowId: result.lastID, status: 'started' };
      }

      if (action === 'update') {
        if (!workflowId) return { error: 'workflowId is required for update' };
        let query = 'UPDATE workflows SET ';
        const params = [];
        const updates = [];
        if (data) {
          updates.push('data = ?');
          params.push(JSON.stringify(data));
        }
        if (status) {
          updates.push('status = ?');
          params.push(status);
        }
        if (updates.length === 0) return { error: 'No data or status provided to update' };
        
        query += updates.join(', ') + ' WHERE id = ?';
        params.push(workflowId);
        await db.run(query, params);
        return { status: 'updated' };
      }

      if (action === 'status') {
        if (!workflowId) return { error: 'workflowId is required for status' };
        const workflow = await db.get('SELECT * FROM workflows WHERE id = ?', [workflowId]);
        if (!workflow) return { error: 'Workflow not found' };
        return { ...workflow, data: JSON.parse(workflow.data) };
      }

      if (action === 'list') {
        const workflows = await db.all('SELECT * FROM workflows ORDER BY timestamp DESC LIMIT 10');
        return { workflows: workflows.map(w => ({ ...w, data: JSON.parse(w.data) })) };
      }
    }

    if (name === 'manage_projects') {
      const { action, projectId, title, description, supabaseUrl, supabaseKey } = args;
      if (action === 'list') {
        return { activeProjectId: projectData.activeProjectId, projects: projectData.projects };
      }
      if (action === 'add') {
        if (!projectId || !supabaseUrl || !supabaseKey) return { error: 'projectId, supabaseUrl, and supabaseKey are required' };
        const newProject = { id: projectId, title: title || projectId, description: description || '', supabaseUrl, supabaseKey };
        projectData.projects.push(newProject);
        saveProjects();
        return { status: 'Project added', projectId };
      }
      if (action === 'select') {
        if (!projectId) return { error: 'projectId is required' };
        const project = projectData.projects.find(p => p.id === projectId);
        if (!project) return { error: 'Project not found' };
        projectData.activeProjectId = projectId;
        saveProjects();
        return { status: 'Active project switched', activeProjectId: projectId };
      }
      if (action === 'delete') {
        if (!projectId) return { error: 'projectId is required' };
        projectData.projects = projectData.projects.filter(p => p.id !== projectId);
        if (projectData.activeProjectId === projectId) projectData.activeProjectId = projectData.projects[0]?.id || '';
        saveProjects();
        return { status: 'Project deleted' };
      }
    }

    if (dynamicSkills.has(name)) {
      const skill = dynamicSkills.get(name);
      return await skill.execute(args);
    }
    if (name === 'browser_action') {
      let cmd = args.command;
      
      // stubborness override: if model uses old 'snapshot -i' but user wants a visual, force screenshot
      if (cmd.includes('snapshot -i')) {
        cmd = cmd.replace('snapshot -i', 'screenshot');
      }

      const isScreenshot = cmd.includes('screenshot') || cmd.includes('snapshot');
      
      // If it's a screenshot and no path is provided, suggest one to make it easier to find
      if (cmd.startsWith('screenshot') && !cmd.includes(' ')) {
        cmd = 'screenshot ./screenshot.png';
      }

      const { stdout, stderr } = await execPromise(`npx agent-browser ${cmd}`);
      let screenshotUrl = null;
      
      if (isScreenshot) {
        // Find newly created png files in the current directory
        const files = fs.readdirSync(process.cwd());
        const pngFiles = files.filter(f => f.endsWith('.png')).sort((a, b) => {
          return fs.statSync(path.join(process.cwd(), b)).mtimeMs - fs.statSync(path.join(process.cwd(), a)).mtimeMs;
        });
        
        if (pngFiles.length > 0) {
          const latestFile = pngFiles[0];
          const fileName = `shot_${Date.now()}.png`;
          const newPath = path.join(process.cwd(), 'screenshots', fileName);
          fs.renameSync(path.join(process.cwd(), latestFile), newPath);
          screenshotUrl = `/screenshots/${fileName}`;
        }
      }
      return { 
        output: stdout || stderr || 'Browser action executed.',
        screenshotUrl 
      };
    }
    if (name === 'web_search') {
      if (!tvly) return { error: 'Tavily API key not configured.' };
      const result = await tvly.search(args.query, { searchDepth: 'advanced', maxResults: 5 });
      return { 
        results: result.results.map(r => ({ title: r.title, url: r.url, content: r.content })) 
      };
    }
  } catch (error) {
    return { error: error.message };
  }
  return { error: 'Unknown tool' };
}

// Multi-Agent Architecture
class Agent {
  constructor(id, systemPromptPath, initialTask = null, initialMemory = null) {
    this.id = id;
    this.systemPromptPath = systemPromptPath;
    this.history = [];
    this.processing = false;
    this.historyLoaded = false;
    this.shouldStop = false;
    this.historyPromise = this.loadHistory();
    if (initialMemory) {
      this.saveToHistory('user', [{ text: `Initial context: ${initialMemory}` }]);
    }
    if (initialTask) {
      const taskPath = path.join(process.cwd(), 'tasks', `${this.id}_task.md`);
      if (!fs.existsSync(path.join(process.cwd(), 'tasks'))) fs.mkdirSync(path.join(process.cwd(), 'tasks'));
      fs.writeFileSync(taskPath, `# Initial Task\n${initialTask}`);
    }
    agentInstances.set(this.id, this);
  }

  stop() {
    this.shouldStop = true;
    console.log(`Stopping agent ${this.id}`);
  }

  async loadHistory() {
    try {
      const db = await dbPromise;
      const rows = await db.all('SELECT role, parts FROM agent_memory WHERE agentId = ? ORDER BY id ASC', [this.id]);
      this.history = rows.map(r => {
        const parts = JSON.parse(r.parts).filter(p => Object.keys(p).length > 0);
        return { role: r.role, parts };
      }).filter(h => h.parts.length > 0);
      this.historyLoaded = true;
      console.log(`Loaded ${this.history.length} history items for agent ${this.id}`);
    } catch (e) {
      console.error('Failed to load history:', e);
      this.historyLoaded = true; // Still mark as loaded to unblock
    }
  }

  async saveToHistory(role, parts) {
    const validParts = parts.filter(p => Object.keys(p).length > 0);
    if (validParts.length === 0) return;

    this.history.push({ role, parts: validParts });
    try {
      const db = await dbPromise;
      await db.run('INSERT INTO agent_memory (agentId, role, parts) VALUES (?, ?, ?)', [this.id, role, JSON.stringify(validParts)]);
    } catch (e) {
      console.error('Failed to save to history:', e);
    }
  }

  async processMessage(userMessage, socket, provider = 'gemini', images = []) {
    if (this.processing) {
      sendLog(socket, this.id, 'warning', `Agent is already processing a message. Please wait.`);
      return;
    }

    this.processing = true;
    if (activeAgents.has(this.id)) {
      activeAgents.get(this.id).status = 'working';
    }
    if (socket) socket.emit('agent_status', { agentId: this.id, status: 'working' });
    
    // Ensure history is loaded
    if (!this.historyLoaded) {
      await this.historyPromise;
    }

    // Task Estimation Logic
    let estimatedSeconds = 15; // default base
    if (userMessage.toLowerCase().includes('search') || userMessage.toLowerCase().includes('research')) estimatedSeconds += 20;
    if (userMessage.toLowerCase().includes('browser') || userMessage.toLowerCase().includes('open')) estimatedSeconds += 30;
    if (userMessage.toLowerCase().includes('edit') || userMessage.toLowerCase().includes('file')) estimatedSeconds += 10;
    
    if (socket) socket.emit('task_estimate', { agentId: this.id, seconds: estimatedSeconds });
    
    const parts = [{ text: userMessage }];
    if (images && images.length > 0) {
      images.forEach(img => {
        const matches = img.match(/^data:(.+);base64,(.+)$/);
        if (matches && matches.length === 3) {
          parts.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2]
            }
          });
        }
      });
    }

    await this.saveToHistory('user', parts);
    if (socket) sendLog(socket, this.id, 'system', `User message received: ${userMessage.substring(0, 50)}... [Provider: ${provider}, Images: ${images.length}]`);

    try {
      // Load current system prompt and task from Markdown files (OpenClaw approach)
      let systemContent = '';
      try {
        systemContent = fs.readFileSync(this.systemPromptPath, 'utf8');
      } catch (e) {
        systemContent = 'You are an AI personal assistant.';
      }
      
      let taskContent = '';
      try {
        taskContent = fs.readFileSync(path.join(process.cwd(), 'tasks', `${this.id}_task.md`), 'utf8');
      } catch (e) {
        // Fallback to current_task.md for orchestrator or if specific task missing
        try {
          taskContent = fs.readFileSync(path.join(process.cwd(), 'tasks', 'current_task.md'), 'utf8');
        } catch (err) {
          taskContent = '# Current Task\nNo task assigned.';
        }
      }

      let memoryContent = '';
      try {
        if (!fs.existsSync(path.join(process.cwd(), 'memory'))) fs.mkdirSync(path.join(process.cwd(), 'memory'));
        memoryContent = fs.readFileSync(path.join(process.cwd(), 'memory', `${this.id}_memory.md`), 'utf8');
      } catch (e) {
        memoryContent = '# Long-term Memory\nNo long-term memories stored yet.';
      }

      const now = new Date().toISOString().split('T')[0];
      const time = new Date().toLocaleTimeString();
      const agentsList = Array.from(availableAgents.values()).map(a => `- ${a.name}: ${a.description}`).join('\n');
      const activeProject = projectData.projects.find(p => p.id === projectData.activeProjectId) || { title: 'None', description: '' };
      
      // Load Project Context
      let projectContext = '';
      try {
        const projectContextPath = path.join(process.cwd(), `${projectData.activeProjectId}_context.md`);
        if (fs.existsSync(projectContextPath)) {
          projectContext = `\n\n# ACTIVE PROJECT CONTEXT\n${fs.readFileSync(projectContextPath, 'utf8')}`;
        }
      } catch (e) {
        console.error('Failed to load project context:', e);
      }

      // Load Global Knowledge
      let globalKnowledge = '';
      try {
        const knowledgeDir = path.join(process.cwd(), 'knowledge');
        if (fs.existsSync(knowledgeDir)) {
          const kFiles = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.md'));
          globalKnowledge = '\n\n# GLOBAL KNOWLEDGE\n' + kFiles.map(f => {
            const content = fs.readFileSync(path.join(knowledgeDir, f), 'utf8');
            return `## ${f.replace('.md', '')}\n${content}`;
          }).join('\n\n');
        }
      } catch (e) {
        console.error('Failed to load global knowledge:', e);
      }

      const fullSystemPrompt = `Current Date: ${now}\nCurrent Time: ${time}\n\nActive Project: ${activeProject.title} (${activeProject.description})${projectContext}${globalKnowledge}\n\nAvailable Specialized Agents:\n${agentsList}\n\n${systemContent}\n\n${taskContent}\n\n${memoryContent}`;

      let turnCount = 0;
      while (turnCount < 10 && !this.shouldStop) {
        turnCount++;
        if (socket) sendLog(socket, this.id, 'api_request', `Generating content (turn ${turnCount}) using Vertex AI`);
        
        let response;
        if (provider === 'gemini') {
          const model = vertexAI.preview.getGenerativeModel({
            model: 'gemini-3.1-flash-lite-preview', 
            tools: [
              { functionDeclarations: getToolDeclarations()[0].functionDeclarations },
              { googleSearch: {} }
            ]
          });

          const result = await model.generateContent({
            contents: this.history,
            systemInstruction: {
              role: 'system',
              parts: [{ text: fullSystemPrompt }]
            }
          });

          const candidates = result.response.candidates;
          if (!candidates || candidates.length === 0) throw new Error('No candidates returned from Vertex AI');
          
          const firstCandidate = candidates[0].content;
          const functionCalls = firstCandidate.parts.filter(p => p.functionCall).map(p => p.functionCall);
          const text = firstCandidate.parts.filter(p => p.text).map(p => p.text).join('\n');

          response = {
            functionCalls: functionCalls.length > 0 ? functionCalls : null,
            text: text,
            originalParts: firstCandidate.parts,
            usage: {
              promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
              candidatesTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
              totalTokens: result.response.usageMetadata?.totalTokenCount || 0
            }
          };
        } else if (provider === 'gemini_api' || (provider === 'gemini' && process.env.GOOGLE_API_KEY)) {
          // Use standard Gemini API (AI Studio) if an API Key is present
          const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
          const model = genAI.getGenerativeModel({ 
            model: 'gemini-1.5-flash',
            tools: [{ functionDeclarations: getToolDeclarations()[0].functionDeclarations }]
          });

          // Convert history to standard role/parts format
          const contents = this.history.map(h => ({
            role: h.role === 'model' ? 'model' : 'user',
            parts: h.parts.map(p => {
              if (p.text) return { text: p.text };
              if (p.functionCall) return { functionCall: p.functionCall };
              if (p.functionResponse) return { functionResponse: p.functionResponse };
              return {};
            })
          }));

          const result = await model.generateContent({
            contents,
            systemInstruction: fullSystemPrompt
          });

          const res = result.response;
          const text = res.text();
          const functionCalls = res.candidates[0].content.parts
            .filter(p => p.functionCall)
            .map(p => p.functionCall);

          response = {
            functionCalls: functionCalls.length > 0 ? functionCalls : null,
            text: text,
            usage: {
              promptTokens: res.usageMetadata?.promptTokenCount || 0,
              candidatesTokens: res.usageMetadata?.candidatesTokenCount || 0,
              totalTokens: res.usageMetadata?.totalTokenCount || 0
            }
          };
        } else if (provider === 'vertex_research') {
          socket.emit('agent_message', {
            agentId: this.id,
            content: 'Deep Research is currently only supported via the unified GenAI SDK. Defaulting to standard Vertex Agent.'
          });
          provider = 'gemini';
          continue;
        } else if (provider === 'perplexity') {
          // ... (keep perplexity logic) ...
          const convertSchema = (schema) => {
            if (!schema || typeof schema !== 'object') return schema;
            const s = { ...schema };
            if (s.type && typeof s.type === 'string') s.type = s.type.toLowerCase();
            if (s.properties) {
              const props = {};
              for (const [k, v] of Object.entries(s.properties)) {
                props[k] = convertSchema(v);
              }
              s.properties = props;
            }
            if (s.items) s.items = convertSchema(s.items);
            return s;
          };

          const agentTools = getToolDeclarations()[0].functionDeclarations.map(fd => ({
            type: 'function',
            name: fd.name,
            description: fd.description,
            parameters: convertSchema(fd.parameters)
          }));

          const items = [];
          this.history.forEach((h, hIdx) => {
            const text = h.parts.filter(p => p.text).map(p => p.text).join('\n');
            if (text) {
              items.push({
                type: 'message',
                role: h.role === 'model' ? 'assistant' : 'user',
                content: text
              });
            }

            h.parts.forEach((p, pIdx) => {
              if (p.functionCall) {
                items.push({
                  type: 'function_call',
                  name: p.functionCall.name,
                  arguments: JSON.stringify(p.functionCall.args),
                  call_id: `call_${hIdx}_${pIdx}`
                });
              }
              if (p.functionResponse) {
                items.push({
                  type: 'function_call_output',
                  call_id: `call_${hIdx - 1}_${pIdx}`,
                  output: JSON.stringify(p.functionResponse.response)
                });
              }
            });
          });

          const res = await fetch('https://api.perplexity.ai/v1/agent', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'perplexity/sonar',
              input: items,
              instructions: fullSystemPrompt,
              tools: agentTools
            })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error.message || 'Perplexity Agent API Error');
          
          response = {
            functionCalls: data.output?.filter(item => item.type === 'function_call').map(tc => ({
              name: tc.name,
              args: JSON.parse(tc.arguments)
            })),
            text: data.output_text || data.output?.filter(item => item.type === 'message')
              .flatMap(item => item.content)
              .filter(c => c.type === 'output_text')
              .map(c => c.text)
              .join('\n'),
            usage: {
              promptTokens: data.usage?.input_tokens || 0,
              candidatesTokens: data.usage?.output_tokens || 0,
              totalTokens: data.usage?.total_tokens || 0
            }
          };
        } else {
          const ollamaModel = provider === 'ollama_qwen' ? 'qwen2.5-coder:14b' : 'gemma2:2b';
          const ollamaMessages = [
            { role: 'system', content: fullSystemPrompt },
            ...this.history.map((h, hIdx) => {
              if (h.role === 'user') {
                if (h.parts[0].functionResponse) {
                  return { 
                    role: 'tool', 
                    content: JSON.stringify(h.parts[0].functionResponse.response),
                    tool_call_id: `call_${hIdx - 1}`
                  };
                }
                return { role: 'user', content: h.parts[0].text };
              }
              if (h.role === 'model') {
                if (h.parts[0].functionCall) {
                  return { role: 'assistant', tool_calls: h.parts.map((p, pIdx) => ({ 
                    id: `call_${hIdx}`,
                    type: 'function',
                    function: { name: p.functionCall.name, arguments: p.functionCall.args } 
                  })) };
                }
                return { role: 'assistant', content: h.parts[0].text };
              }
              return { role: h.role, content: h.parts[0].text };
            })
          ];

          const ollamaTools = getToolDeclarations()[0].functionDeclarations.map(fd => ({
            type: 'function',
            function: {
              name: fd.name,
              description: fd.description,
              parameters: {
                type: 'object',
                properties: fd.parameters.properties,
                required: fd.parameters.required
              }
            }
          }));

          const res = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            body: JSON.stringify({
              model: ollamaModel,
              messages: ollamaMessages,
              tools: ollamaTools,
              stream: false
            })
          });
          const result = await res.json();
          response = {
            functionCalls: result.message?.tool_calls?.map(tc => ({
              name: tc.function.name,
              args: tc.function.arguments
            })),
            text: result.message?.content,
            usage: {
              promptTokens: result.prompt_eval_count,
              candidatesTokens: result.eval_count,
              totalTokens: (result.prompt_eval_count || 0) + (result.eval_count || 0)
            }
          };
        }
        
        sendLog(socket, this.id, 'api_response', `Received API response`, { 
          hasFunctionCalls: !!response.functionCalls && response.functionCalls.length > 0, 
          hasText: !!response.text,
          usage: response.usage
        });

        // Always send text if present, even with tools
        if (response.text && response.text.trim() !== '') {
          socket.emit('agent_message', {
            agentId: this.id,
            content: response.text,
            usage: response.usage
          });
        }

        if (response.functionCalls && response.functionCalls.length > 0) {
          // Model decided to call tools
          if (response.originalParts) {
            await this.saveToHistory('model', response.originalParts);
          } else {
            await this.saveToHistory('model', response.functionCalls.map(fc => ({ functionCall: fc })));
          }
          const functionResponses = [];
          
          for (const call of response.functionCalls) {
            sendLog(socket, this.id, 'tool_call', `Executing tool: ${call.name}`, call.args);
            
            const progress = Math.min(Math.floor((turnCount / 5) * 100), 95);
            socket.emit('task_progress', { agentId: this.id, progress });

            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Tool execution timed out after 60s: ${call.name}`)), 60000)
            );

            let result;
            try {
              result = await Promise.race([
                executeTool(call, socket),
                timeoutPromise
              ]);
            } catch (err) {
              result = { error: err.message };
            }
            
            sendLog(socket, this.id, 'tool_result', `Tool result: ${call.name}`, result, result.error ? 'error' : 'info');

            if (result.screenshotUrl) {
              images.push(result.screenshotUrl);
            }

            functionResponses.push({
              functionResponse: {
                name: call.name,
                response: result
              }
            });
          }

          await this.saveToHistory('user', functionResponses);
        } else {
          // Model provided only text response
          if (response.originalParts) {
            await this.saveToHistory('model', response.originalParts);
          } else {
            await this.saveToHistory('model', [{ text: response.text }]);
          }

          // Send final message to UI with all collected images
          if (socket) {
            socket.emit('agent_message', {
              agentId: this.id,
              role: 'assistant',
              content: response.text || '',
              images: images, // Use the collected images array
              usage: response.usage
            });

            // Update cumulative stats
            dbPromise.then(async db => {
              await db.run('UPDATE system_stats SET value = value + ? WHERE key = ?', [response.usage.promptTokens, 'total_input_tokens']);
              await db.run('UPDATE system_stats SET value = value + ? WHERE key = ?', [response.usage.candidatesTokens, 'total_output_tokens']);
              await db.run('UPDATE system_stats SET value = value + 1 WHERE key = ?', ['total_requests']);
              
              const rows = await db.all('SELECT * FROM system_stats');
              const stats = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
              io.emit('system_stats', stats);
            });
          }
          break; // Done
        }
      }
    } catch (error) {
      console.error(`Agent ${this.id} error:`, error);
      if (socket) {
        sendLog(socket, this.id, 'error', `Agent execution error`, { error: error.message }, 'error');
        socket.emit('agent_error', { agentId: this.id, error: error.message });
      }
    } finally {
      this.processing = false;
      if (activeAgents.has(this.id)) {
        activeAgents.get(this.id).status = 'idle';
      }
      if (socket) socket.emit('agent_status', { agentId: this.id, status: 'idle' });
    }
  }
}

const orchestrator = new Agent('orchestrator', path.join(process.cwd(), 'agents', 'orchestrator', 'system.md'));
agentInstances.set('orchestrator', orchestrator);

async function summarizeAndPersist(socket) {
  if (socket) sendLog(socket, 'orchestrator', 'system', 'Analyzing session for long-term memory extraction...');
  
  try {
    const db = await dbPromise;
    const history = await db.all('SELECT role, parts FROM agent_memory WHERE agentId = ? ORDER BY id ASC', ['orchestrator']);
    
    if (history.length < 2) return; // Not enough context to learn

    const model = vertexAI.preview.getGenerativeModel({
      model: 'gemini-3.1-flash-lite-preview',
    });

    const conversationText = history.map(h => `${h.role}: ${JSON.parse(h.parts).map(p => p.text || '[Tool/Other]').join(' ')}`).join('\n');
    
    const result = await model.generateContent(`Analyze this conversation and extract:
1. Key facts/decisions made.
2. New skills or tools added.
3. Project-specific context.
4. Long-term preferences.

Format the output as a concise Markdown summary to be appended to the "Long-term Memory" file.

CONVERSATION:
${conversationText}`);

    const analysis = result.response.candidates[0].content.parts[0].text;
    
    const memoryDir = path.join(process.cwd(), 'memory');
    if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir);
    const memoryPath = path.join(memoryDir, 'orchestrator_memory.md');
    
    let currentMemory = '';
    if (fs.existsSync(memoryPath)) currentMemory = fs.readFileSync(memoryPath, 'utf8');
    
    const updatedMemory = `${currentMemory}\n\n## Session Extract: ${new Date().toISOString()}\n${analysis}`;
    fs.writeFileSync(memoryPath, updatedMemory);
    
    if (socket) sendLog(socket, 'orchestrator', 'system', 'Long-term memory successfully updated.');
  } catch (e) {
    console.error('Failed to summarize and persist:', e);
    if (socket) sendLog(socket, 'orchestrator', 'error', 'Learning phase failed, but proceeding with reset.');
  }
}

async function systemReset(socket) {
  console.log('Performing systemic reset...');
  if (socket) sendLog(socket, 'orchestrator', 'system', 'Initiating systemic reset sequence...');
  
  // 0. Learn from session
  await summarizeAndPersist(socket);
  await new Promise(r => setTimeout(r, 800));

  // 1. Stop all active agents
  if (socket) sendLog(socket, 'orchestrator', 'system', 'Terminating active sub-agents...');
  for (const [id, agent] of agentInstances.entries()) {
    agent.stop();
  }
  await new Promise(r => setTimeout(r, 500));

  // 2. Clear database
  if (socket) sendLog(socket, 'orchestrator', 'system', 'Wiping agent memory and short-term history...');
  try {
    const db = await dbPromise;
    await db.run('DELETE FROM agent_memory');
    await db.run('DELETE FROM active_agents WHERE agentId != ?', ['orchestrator']);
  } catch (e) {
    console.error('Failed to clear database tables:', e);
  }
  await new Promise(r => setTimeout(r, 500));

  // 3. Reset activeAgents map (keep only orchestrator)
  if (socket) sendLog(socket, 'orchestrator', 'system', 'Re-initializing agent registry...');
  activeAgents.clear();
  activeAgents.set('orchestrator', { id: 'orchestrator', name: 'Orchestrator', role: 'Main Controller', status: 'idle' });

  // 4. Reset agentInstances map (keep only orchestrator)
  const orchestratorInstance = agentInstances.get('orchestrator');
  agentInstances.clear();
  if (orchestratorInstance) {
    orchestratorInstance.history = [];
    orchestratorInstance.shouldStop = false; 
    agentInstances.set('orchestrator', orchestratorInstance);
  }
  await new Promise(r => setTimeout(r, 500));

  // 5. Clean up tasks directory
  if (socket) sendLog(socket, 'orchestrator', 'system', 'Cleaning up temporary task files...');
  try {
    const tasksDir = path.join(process.cwd(), 'tasks');
    if (fs.existsSync(tasksDir)) {
      const files = fs.readdirSync(tasksDir);
      for (const file of files) {
        if (file !== 'current_task.md' && file !== 'orchestrator_task.md') {
          fs.unlinkSync(path.join(tasksDir, file));
        }
      }
    }
  } catch (e) {
    console.error('Failed to cleanup tasks directory:', e);
  }
  await new Promise(r => setTimeout(r, 800));

  // 6. Notify frontend
  if (socket) {
    sendLog(socket, 'orchestrator', 'system', 'Systemic reset completed successfully.');
    socket.emit('agent_message', {
      agentId: 'orchestrator',
      content: 'System has been fully reset. All sub-agents terminated, history cleared, and temporary files purged.',
    });
    socket.emit('chat_history', { agentId: 'orchestrator', history: [] });
    io.emit('active_agents', Array.from(activeAgents.values()));
  }
}

async function loadActiveAgents() {
  try {
    const db = await dbPromise;
    const rows = await db.all('SELECT * FROM active_agents');
    rows.forEach(row => {
      activeAgents.set(row.agentId, { id: row.agentId, name: row.name, role: row.role, status: row.status });
    });
    console.log(`Restored ${rows.length} agents from database`);
  } catch (e) {
    console.error('Failed to restore active agents:', e);
  }
}
loadActiveAgents();

const checkKeys = () => ({
  hasGemini: true,
  hasTavily: !!process.env.TAVILY_API_KEY,
  hasTelegram: !!process.env.TELEGRAM_BOT_TOKEN,
  hasPerplexity: !!process.env.PERPLEXITY_API_KEY
});

io.on('connection', (socket) => {
  console.log('Frontend connected:', socket.id);
  
  const sendKeyStatus = () => {
    socket.emit('api_key_status', checkKeys());
  };

  sendKeyStatus();
  
  // Send existing history for orchestrator
  socket.emit('chat_history', { 
    agentId: 'orchestrator', 
    history: orchestrator.history 
  });

  // Send active agents list
  socket.emit('active_agents', Array.from(activeAgents.values()));

  socket.on('user_message', async (data) => {
    console.log('Received message:', data.content, 'Provider:', data.provider);

    // Handle /new command to clear history
    if (data.content.trim() === '/new') {
      await systemReset(socket);
      return;
    }

    if (data.content.trim() === '/learn') {
      const skill = dynamicSkills.get('learn');
      if (skill) {
        sendLog(socket, 'orchestrator', 'system', 'Executing /learn routine...');
        socket.emit('agent_status', { agentId: 'orchestrator', status: 'working' });
        const result = await skill.execute({});
        
        for (const step of result.steps_taken || []) {
          sendLog(socket, 'orchestrator', 'system', step);
          await new Promise(r => setTimeout(r, 600));
        }

        socket.emit('agent_message', {
          agentId: 'orchestrator',
          content: `### Learning Summary\n${result.summary}\n\n**New Proposals:**\n${result.proposals.map(p => `- [${p.type}] ${p.name}: ${p.description}`).join('\n')}`,
        });
        socket.emit('agent_status', { agentId: 'orchestrator', status: 'idle' });
      }
      return;
    }
    
    if (data.internal && data.content.startsWith('system_internal_poll: monitor_ollama')) {
      const skill = dynamicSkills.get('monitor_ollama');
      if (skill) {
        try {
          const result = await skill.execute({});
          socket.emit('ollama_status', result);
        } catch (e) {
          console.error('Ollama monitor poll failed:', e);
        }
      }
      return;
    }

    // Send to orchestrator
    await orchestrator.processMessage(data.content, socket, data.provider, data.images);
  });

  socket.on('spawn_agent_manual', async (data) => {
    const { agentId, name, role, task, scope, memory } = data;
    sendLog(socket, 'orchestrator', 'system', `Manually creating agent: ${name} (${agentId})`);
    
    // Initialize task file
    if (!fs.existsSync(path.join(process.cwd(), 'tasks'))) fs.mkdirSync(path.join(process.cwd(), 'tasks'));
    const taskPath = path.join(process.cwd(), 'tasks', `${agentId}_task.md`);
    fs.writeFileSync(taskPath, `# Manual Task for ${name}\n**Role:** ${role}\n**Scope:** ${scope}\n\n**Primary Task:**\n${task}`);

    const newAgent = new Agent(agentId, path.join(process.cwd(), 'agents', 'orchestrator', 'system.md'), task, memory);
    
    const agentData = { id: agentId, name: name, role: role, status: 'working' };
    activeAgents.set(agentId, agentData);
    dbPromise.then(db => db.run('INSERT OR REPLACE INTO active_agents (agentId, name, role, status) VALUES (?, ?, ?, ?)', [agentId, agentData.name, agentData.role, agentData.status]));
    io.emit('agent_spawned', { agentId, name, role });

    socket.emit('agent_message', {
      agentId: 'orchestrator',
      content: `Successfully initialized **${name}** as a ${role}.`,
    });

    // Start the agent processing the task
    await newAgent.processMessage(`Your role is ${role}. Your scope is limited to: ${scope}. Please begin your task: ${task}`, socket);
    activeAgents.get(agentId).status = 'idle';
    io.emit('agent_status', { agentId, status: 'idle' });
  });

  socket.on('clear_history', async (data) => {
    if (data.agentId === 'orchestrator') {
      await systemReset(socket);
    } else {
      const agent = agentInstances.get(data.agentId);
      if (agent) {
        agent.history = [];
      }
      try {
        const db = await dbPromise;
        await db.run('DELETE FROM agent_memory WHERE agentId = ?', [data.agentId]);
        sendLog(socket, data.agentId, 'system', 'History cleared from database');
        socket.emit('agent_message', {
          agentId: data.agentId,
          content: 'Session history has been cleared. I am ready for a fresh start!',
        });
        socket.emit('chat_history', { agentId: data.agentId, history: [] });
      } catch (e) {
        console.error('Failed to clear history:', e);
      }
    }
  });

  sendKeyStatus();

  socket.on('set_gemini_key', (data) => {
    const key = data.apiKey;
    if (key) {
      updateEnv('GOOGLE_API_KEY', key);
      sendKeyStatus();
      socket.emit('agent_message', { agentId: 'orchestrator', content: 'Gemini API Key saved permanently to .env!' });
    }
  });

  socket.on('set_tavily_key', (data) => {
    const key = data.apiKey;
    if (key) {
      updateEnv('TAVILY_API_KEY', key);
      sendKeyStatus();
      socket.emit('agent_message', { agentId: 'orchestrator', content: 'Tavily API Key saved permanently to .env!' });
    }
  });

  socket.on('set_perplexity_key', (data) => {
    const key = data.apiKey;
    if (key) {
      updateEnv('PERPLEXITY_API_KEY', key);
      sendKeyStatus();
      socket.emit('agent_message', { agentId: 'orchestrator', content: 'Perplexity API Key saved permanently to .env!' });
    }
  });

  socket.on('set_telegram_token', (data) => {
    const token = data.token;
    if (token) {
      updateEnv('TELEGRAM_BOT_TOKEN', token);
      sendKeyStatus();
      socket.emit('agent_message', { agentId: 'orchestrator', content: 'Telegram Bot Token saved permanently to .env!' });
    }
  });

  socket.on('generate_agent_from_prompt', async (data) => {
    const { prompt } = data;
    sendLog(socket, 'orchestrator', 'api_request', `Generating agent config for: ${prompt}`);
    
    try {
      const model = vertexAI.preview.getGenerativeModel({
        model: 'gemini-3.1-flash-lite-preview',
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              name: { type: 'STRING' },
              role: { type: 'STRING' },
              task: { type: 'STRING' },
              scope: { type: 'STRING' },
              memory: { type: 'STRING' }
            },
            required: ['name', 'role', 'task', 'scope', 'memory']
          }
        }
      });

      const result = await model.generateContent(`Generate a specialized AI agent configuration based on this request: "${prompt}". 
      Return a JSON object with:
      - name: A short, catchy name
      - role: A professional role title
      - task: A detailed set of primary instructions (Markdown supported)
      - scope: What the agent should and should not do
      - memory: Any initial context or focus`);

      const config = JSON.parse(result.response.candidates[0].content.parts[0].text);
      socket.emit('agent_config_generated', config);
      sendLog(socket, 'orchestrator', 'api_response', `Agent config generated: ${config.name}`);
    } catch (error) {
      console.error('Failed to generate agent config:', error);
      sendLog(socket, 'orchestrator', 'error', `Failed to generate agent config`, { error: error.message }, 'error');
    }
  });

  socket.on('request_agent_details', async (data) => {
    const { agentId } = data;
    try {
      let systemPrompt = '';
      let taskPrompt = '';
      
      // Determine system prompt path
      const systemPath = agentId === 'orchestrator' 
        ? path.join(process.cwd(), 'agents', 'orchestrator', 'system.md')
        : path.join(process.cwd(), 'agents', 'orchestrator', 'system.md'); // Default for now
      
      try {
        systemPrompt = fs.readFileSync(systemPath, 'utf8');
      } catch (e) {
        systemPrompt = 'No rules defined.';
      }

      // Determine task path
      const taskPath = agentId === 'orchestrator'
        ? path.join(process.cwd(), 'tasks', 'current_task.md')
        : path.join(process.cwd(), 'tasks', `${agentId}_task.md`);
      
      try {
        taskPrompt = fs.readFileSync(taskPath, 'utf8');
      } catch (e) {
        taskPrompt = 'No active task.';
      }

      // Get tools (Skills)
      const tools = toolDeclarations[0].functionDeclarations;

      // Get history (Memory)
      let longTermMemory = '';
      try {
        const memoryPath = path.join(process.cwd(), 'memory', `${agentId}_memory.md`);
        longTermMemory = fs.readFileSync(memoryPath, 'utf8');
      } catch (e) {
        longTermMemory = 'No long-term memory stored.';
      }

      socket.emit('agent_details', {
        agentId,
        rules: systemPrompt,
        skills: tools,
        memory: {
          task: taskPrompt,
          longTerm: longTermMemory
        }
      });
    } catch (error) {
      console.error('Failed to fetch agent details:', error);
      socket.emit('agent_error', { agentId, error: 'Failed to fetch details' });
    }
  });

  socket.on('disconnect', () => {
    console.log('Frontend disconnected:', socket.id);
  });
});

function initTelegramBot(bot) {
  if (bot._initialized) return;
  bot._initialized = true;

  const botId = Math.random().toString(36).substring(7);
  console.log(`Telegram bot instance [${botId}] starting...`);

  bot.start((ctx) => ctx.reply('Welcome to your Multi-Agent Personal Assistant! Send me a message, a voice note, or a photo to start.'));
  
  bot.on('photo', async (ctx) => {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const fileLink = await ctx.telegram.getFileLink(photo.file_id);
    const caption = ctx.message.caption || 'Look at this image';
    
    // Download image as base64
    const response = await fetch(fileLink);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    await ctx.sendChatAction('typing');
    
    const mockSocket = {
      emit: (event, data) => {
        if (event === 'agent_message' && !data.isTool) {
          ctx.reply(data.content, { parse_mode: 'Markdown' });
        }
      }
    };
    
    await orchestrator.processMessage(caption, mockSocket, 'gemini', [dataUrl]);
  });

  bot.on('voice', async (ctx) => {
    const voice = ctx.message.voice;
    const fileLink = await ctx.telegram.getFileLink(voice.file_id);
    
    // Download voice as base64
    const response = await fetch(fileLink);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    
    // Pass audio to Gemini for transcription and response
    await ctx.sendChatAction('typing');
    
    const mockSocket = {
      emit: async (event, data) => {
        if (event === 'agent_message' && !data.isTool) {
          if (data.content && data.content.trim() !== '') {
            const tempWav = path.join(process.cwd(), `voice_${Date.now()}.wav`);
            const tempOgg = path.join(process.cwd(), `voice_${Date.now()}.ogg`);
            
            try {
              const { exec } = await import('child_process');
              const util = await import('util');
              const execPromise = util.promisify(exec);
              
              // Generate voice with Mac 'say'
              await execPromise(`say -o "${tempWav}" --data-format=I16@22050 "${data.content.replace(/"/g, '').replace(/\*/g, '').replace(/#/g, '')}"`);
              // Convert to ogg opus for Telegram
              await execPromise(`ffmpeg -y -i "${tempWav}" -c:a libopus "${tempOgg}"`);
              // Send as voice
              await ctx.replyWithVoice({ source: tempOgg });
              // Also send text for accessibility
              ctx.reply(data.content, { parse_mode: 'Markdown' });
            } catch (e) {
              console.error('Voice reply error:', e);
              ctx.reply(data.content, { parse_mode: 'Markdown' });
            } finally {
              if (fs.existsSync(tempWav)) fs.unlinkSync(tempWav);
              if (fs.existsSync(tempOgg)) fs.unlinkSync(tempOgg);
            }
          }
        }
      }
    };
    
    const audioInput = `data:audio/ogg;base64,${base64}`;
    await orchestrator.processMessage('Please listen to this voice message and respond.', mockSocket, 'gemini', [audioInput]);
  });

  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    
    // Create a mock socket-like object to bridge Telegram to existing agent logic
    const mockSocket = {
      emit: (event, data) => {
        if (event === 'agent_message' && !data.isTool) {
          if (data.content && data.content.trim() !== '') {
            try {
              ctx.reply(data.content, { parse_mode: 'Markdown' });
            } catch (e) {
              ctx.reply(data.content); // Fallback to plain text if markdown fails
            }
          }
          if (data.images && data.images.length > 0) {
            data.images.forEach(img => {
              ctx.reply(`📸 [View Captured Image]: ${img}`);
            });
          }
        }
        if (event === 'agent_error') {
          ctx.reply(`❌ Error: ${data.error}`);
        }
        // Also send to web UI if connected
        io.emit(event, data);
      }
    };

    await orchestrator.processMessage(text, mockSocket, 'gemini');
  });

  bot.launch().then(() => {
    console.log(`Telegram bot [${botId}] launched successfully`);
  }).catch(err => console.error(`Telegram bot [${botId}] launch error:`, err));

  // Enable graceful stop for all relevant signals
  const shutdown = (signal) => {
    console.log(`Stopping bot [${botId}] due to ${signal}`);
    bot.stop(signal);
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // Handle nodemon restarts
}

if (tgBot) {
  initTelegramBot(tgBot);
}

app.get('/api/files', (req, res) => {
  const dirs = ['memory', 'tasks', 'knowledge', 'skills', 'agents'];
  const results = {};
  
  dirs.forEach(dir => {
    const dirPath = path.join(process.cwd(), dir);
    if (fs.existsSync(dirPath)) {
      results[dir] = fs.readdirSync(dirPath).filter(f => f.endsWith('.md') || f.endsWith('.js') || f.endsWith('.json'));
    }
  });
  
  res.json(results);
});

app.get('/api/files/:dir/:file', (req, res) => {
  const { dir, file } = req.params;
  const filePath = path.join(process.cwd(), dir, file);
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ content });
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const db = await dbPromise;
    const rows = await db.all('SELECT * FROM system_stats');
    const stats = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.post('/api/chrome/launch', async (req, res) => {
  try {
    const { exec } = await import('child_process');
    const util = await import('util');
    const execPromise = util.promisify(exec);

    // Launch Chrome with remote debugging on Mac
    exec('open -a "Google Chrome" --args --remote-debugging-port=9222');
    
    // Wait a moment and check if port 9222 is listening
    setTimeout(async () => {
      try {
        await execPromise('lsof -i :9222');
        console.log('Chrome Debug Port 9222 is active.');
      } catch (e) {
        console.warn('Chrome Debug Port 9222 failed to open. Chrome might need a full restart (Cmd+Q).');
      }
    }, 2000);

    res.json({ status: 'success', message: 'Chrome launch command sent. Please ensure Chrome was CLOSED before clicking.' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to launch Chrome' });
  }
});

const DEFAULT_PORT = process.env.PORT || 3001;

const startServer = (port) => {
  httpServer.removeAllListeners('error');
  httpServer.removeAllListeners('listening');

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is in use, trying ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });

  httpServer.on('listening', () => {
    const actualPort = httpServer.address().port;
    console.log(`Backend Server running on port ${actualPort}`);
    
    // Write port to a file so frontend can discover it
    try {
      const portFilePath = path.join(process.cwd(), 'port.json');
      let currentPort = null;
      if (fs.existsSync(portFilePath)) {
        currentPort = JSON.parse(fs.readFileSync(portFilePath, 'utf8')).port;
      }
      if (currentPort !== actualPort) {
        fs.writeFileSync(portFilePath, JSON.stringify({ port: actualPort }));
      }
    } catch (err) {
      console.error('Failed to write port.json:', err);
    }
  });

  httpServer.listen(port, '0.0.0.0');
};

startServer(DEFAULT_PORT);

