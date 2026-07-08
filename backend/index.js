import express from 'express';
console.log('Backend process starting...');
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec, spawn } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import ollama from 'ollama';
import { tavily } from '@tavily/core';
import { Telegraf } from 'telegraf';
import os from 'os';
import cron from 'node-cron';

let dbPromise = null;
const dynamicSkills = new Map();
const availableAgents = new Map();
let projectData = { activeProjectId: 'default', projects: [] };
const activeAgents = new Map([['orchestrator', { id: 'orchestrator', name: 'Orchestrator', role: 'Main Controller', status: 'idle' }]]);
const agentInstances = new Map();

function loadProjects() {
  const projectsPath = path.join(process.cwd(), 'context', 'projects.json');
  if (fs.existsSync(projectsPath)) {
    projectData = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
    console.log(`Loaded ${projectData.projects.length} projects. Active: ${projectData.activeProjectId}`);
  }
}
function saveProjects() {
  const projectsPath = path.join(process.cwd(), 'context', 'projects.json');
  fs.writeFileSync(projectsPath, JSON.stringify(projectData, null, 2));
}
loadProjects();

// Watch for changes in projects.json
fs.watch(path.join(process.cwd(), 'context', 'projects.json'), (eventType) => {
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
  dynamicSkills.clear();
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
// Watch for changes in skills so capability updates are reflected without full restart.
fs.watch(path.join(process.cwd(), 'skills'), { recursive: true }, async (eventType, filename) => {
  if (filename && filename.endsWith('.js')) {
    console.log(`Detected change in skills directory: ${filename}. Reloading skills...`);
    await loadDynamicSkills();
  }
});
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
      CREATE TABLE IF NOT EXISTS token_usage_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agentId TEXT,
        promptTokens INTEGER,
        candidatesTokens INTEGER,
        totalTokens INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT OR IGNORE INTO system_stats (key, value) VALUES ('total_input_tokens', 0);
      INSERT OR IGNORE INTO system_stats (key, value) VALUES ('total_output_tokens', 0);
      INSERT OR IGNORE INTO system_stats (key, value) VALUES ('total_requests', 0);
      UPDATE system_stats SET value = 0 WHERE value IS NULL;
      
      CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        cron TEXT,
        task TEXT,
        agentId TEXT,
        status TEXT DEFAULT 'active',
        lastRun DATETIME,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
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
if (!fs.existsSync(path.join(process.cwd(), 'screenshots'))) fs.mkdirSync(path.join(process.cwd(), 'screenshots'));
if (!fs.existsSync(path.join(process.cwd(), 'audio'))) fs.mkdirSync(path.join(process.cwd(), 'audio'));
app.use('/audio', express.static(path.join(process.cwd(), 'audio')));

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

const traceLogPath = path.join(process.cwd(), 'data', 'trace.jsonl');
if (!fs.existsSync(path.join(process.cwd(), 'data'))) fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });

function sendLog(socket, agentId, type, message, data = null, level = 'info') {
  const event = {
    id: Date.now().toString() + Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString(),
    agentId,
    type,
    level,
    message,
    data
  };
  // Broadcast to ALL connected clients so every open tab sees every event
  io.emit('agent_log', event);
  // Persist to rolling trace file for offline inspection
  try { fs.appendFileSync(traceLogPath, JSON.stringify(event) + '\n'); } catch (_) {}
  
  if (agentInstances.has(agentId)) {
    agentInstances.get(agentId).lastActivity = Date.now();
  }
}

async function sendLogHistory(socket) {
  if (!fs.existsSync(traceLogPath)) return;
  try {
    const data = fs.readFileSync(traceLogPath, 'utf8');
    const lines = data.trim().split('\n');
    const lastLogs = lines.slice(-200).map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    
    socket.emit('log_history', lastLogs);
  } catch (err) {
    console.error('Failed to send log history:', err);
  }
}

// Initialize Vertex AI
const project = process.env.GOOGLE_CLOUD_PROJECT || 'rally-nyc';
const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';

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
let lastTelegramChatId = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
  tgBot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
}

// Detect BCP-47 language code from text using stopword fingerprints.
function detectLangCode(text) {
  const t = text.toLowerCase();
  const scores = { it: 0, es: 0, fr: 0, de: 0, pt: 0, en: 0 };
  if (/\b(il|la|lo|gli|le|un|uno|una|che|non|per|con|del|della|sono|sei|\u00e8|ma|anche|questo|questa|quando|come|dove|perch\u00e9|dopo|prima|sempre|gi\u00e0|tutto|tutti|ogni|molto|bene|male|adesso|oggi|domani|ieri)\b/.test(t)) scores.it += 3;
  if (/[\u00e0\u00e8\u00e9\u00ec\u00ed\u00ee\u00f2\u00f3\u00f9\u00fa]/.test(t)) scores.it += 1;
  if (/\b(el|la|los|las|un|una|que|no|es|por|con|del|para|pero|m\u00e1s|esto|todo|est\u00e1|son|como|tiene|bien|aqu\u00ed|cuando|donde|tambi\u00e9n|porque|muy|hay|ser|hacer)\b/.test(t)) scores.es += 3;
  if (/[\u00f1\u00e1\u00e9\u00ed\u00f3\u00fa\u00fc]/.test(t)) scores.es += 1;
  if (/\b(le|la|les|un|une|des|que|qui|pas|est|pour|dans|avec|sur|du|au|je|tu|il|nous|vous|ils|elle|mais|ou|donc|tr\u00e8s|bien|ici|quand|o\u00f9|parce|aussi|tout|\u00eatre|avoir|faire)\b/.test(t)) scores.fr += 3;
  if (/[\u00e0\u00e2\u00e6\u00e7\u00e9\u00e8\u00ea\u00eb\u00ee\u00ef\u00f4\u0153\u00f9\u00fb\u00fc\u00ff]/.test(t)) scores.fr += 1;
  if (/\b(der|die|das|ein|eine|und|ist|nicht|f\u00fcr|mit|auf|den|dem|des|im|ich|du|er|wir|ihr|sie|aber|oder|wenn|als|auch|noch|nach|bei|vor|\u00fcber|durch|schon|sehr|hier|haben|sein|werden|k\u00f6nnen|m\u00fcssen)\b/.test(t)) scores.de += 3;
  if (/[\u00e4\u00f6\u00fc\u00df]/.test(t)) scores.de += 2;
  if (/\b(o|a|os|as|um|uma|que|n\u00e3o|\u00e9|para|com|em|do|da|por|mas|se|na|no|mais|como|quando|onde|porque|muito|bem|aqui|tamb\u00e9m|todo|ser|ter|fazer)\b/.test(t)) scores.pt += 3;
  if (/[\u00e3\u00f5\u00e2\u00ea\u00f4\u00e1\u00e9\u00ed\u00f3\u00fa]/.test(t)) scores.pt += 1;
  if (/\b(the|a|an|is|are|was|were|have|has|had|do|does|did|will|would|could|should|may|might|can|not|and|or|but|if|in|on|at|to|for|of|with|by|from|that|this|it|he|she|we|they|you|I|my|your)\b/.test(t)) scores.en += 2;
  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const lang = winner[1] > 0 ? winner[0] : 'en';
  // BCP-47 code -> WaveNet voice name (Neural2 where available, fallback to Standard)
  const voiceMap = {
    it: { languageCode: 'it-IT', name: 'it-IT-Neural2-A' },
    es: { languageCode: 'es-ES', name: 'es-ES-Neural2-A' },
    fr: { languageCode: 'fr-FR', name: 'fr-FR-Neural2-A' },
    de: { languageCode: 'de-DE', name: 'de-DE-Neural2-A' },
    pt: { languageCode: 'pt-PT', name: 'pt-PT-Standard-A' },
    en: { languageCode: 'en-US', name: 'en-US-Neural2-F' },
  };
  return voiceMap[lang] || voiceMap.en;
}

// Call Google Cloud TTS REST API and return MP3 Buffer.
async function googleTTS(text) {
  const voice = detectLangCode(text);
  // Get access token via gcloud ADC (same creds used by Vertex AI)
  const { stdout } = await execPromise('gcloud auth print-access-token');
  const accessToken = stdout.trim();

  const res = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Goog-User-Project': project,
      },
      body: JSON.stringify({
        input: { text },
        voice,
        audioConfig: { audioEncoding: 'MP3', speakingRate: 1.0, pitch: 0 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google TTS API error ${res.status}: ${err}`);
  }
  const json = await res.json();
  return { mp3Buffer: Buffer.from(json.audioContent, 'base64'), voice };
}

function getDuffelApiKey() {
  return process.env.DUFFEL_API_KEY || process.env.DUFFLE_API_KEY || null;
}

async function duffelRequest(endpoint, options = {}) {
  const apiKey = getDuffelApiKey();
  if (!apiKey) {
    throw new Error('Duffel API key not configured. Set DUFFEL_API_KEY (or DUFFLE_API_KEY).');
  }

  const res = await fetch(`https://api.duffel.com${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Duffel-Version': 'v2',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!res.ok) {
    const err = payload?.errors?.map(e => e?.title || e?.message).filter(Boolean).join('; ')
      || payload?.message
      || text
      || `Duffel error ${res.status}`;
    throw new Error(`Duffel API error ${res.status}: ${err}`);
  }

  return payload;
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
          name: 'send_voice_message',
          description: 'Convert text to a spoken voice message and deliver it to the user. Use this whenever the user asks for a voice message, audio reply, or wants to hear something spoken. It works on BOTH the Web UI (plays inline audio) and Telegram (sends a voice note). Always use this tool when asked for voice — never refuse.',
          parameters: {
            type: 'OBJECT',
            properties: {
              text: { type: 'STRING', description: 'The text to speak aloud' }
            },
            required: ['text']
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
          name: 'list_capabilities',
          description: 'Return an exact, deterministic list of currently available runtime tools/capabilities and counts.',
          parameters: {
            type: 'OBJECT',
            properties: {},
            required: []
          }
        },
        {
          name: 'duffel_search_airports',
          description: 'Search airports/cities with Duffel to resolve user-provided locations to valid IATA airport codes before flight search.',
          parameters: {
            type: 'OBJECT',
            properties: {
              query: { type: 'STRING', description: 'Airport or city keyword (e.g., "Milan", "New York", "FCO")' },
              limit: { type: 'INTEGER', description: 'Maximum number of results (default 8, max 20)' }
            },
            required: ['query']
          }
        },
        {
          name: 'duffel_search_flights',
          description: 'Search real flight offers with Duffel. Use this for travel and flight option requests.',
          parameters: {
            type: 'OBJECT',
            properties: {
              origin: { type: 'STRING', description: 'Origin IATA airport code, e.g. "MXP"' },
              destination: { type: 'STRING', description: 'Destination IATA airport code, e.g. "JFK"' },
              departureDate: { type: 'STRING', description: 'Departure date in YYYY-MM-DD format' },
              returnDate: { type: 'STRING', description: 'Optional return date in YYYY-MM-DD format for round-trips' },
              adults: { type: 'INTEGER', description: 'Number of adult passengers (default 1)' },
              cabinClass: { type: 'STRING', enum: ['economy', 'premium_economy', 'business', 'first'], description: 'Preferred cabin class' },
              maxConnections: { type: 'INTEGER', description: 'Optional maximum number of stops/connections' },
              currency: { type: 'STRING', description: 'Optional 3-letter currency code like EUR or USD' },
              limit: { type: 'INTEGER', description: 'Maximum number of offers returned (default 10, max 25)' }
            },
            required: ['origin', 'destination', 'departureDate']
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
        {
          name: 'manage_jobs',
          description: 'Schedule, list, or delete periodic tasks (cron jobs). Use this for tasks that need to run repeatedly (e.g., "every day at 8am").',
          parameters: {
            type: 'OBJECT',
            properties: {
              action: { type: 'STRING', enum: ['schedule', 'list', 'delete', 'toggle'], description: 'Action to perform' },
              jobId: { type: 'INTEGER', description: 'ID of the job for delete/toggle' },
              name: { type: 'STRING', description: 'Descriptive name for the job' },
              cron: { type: 'STRING', description: 'Standard cron expression (e.g. "0 8 * * *" for 8am daily)' },
              task: { type: 'STRING', description: 'The task description for the agent to execute when the job triggers' }
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
  const _t0 = Date.now();

  // Build a concise, human-readable args preview (truncate large strings)
  const _argsSummary = Object.entries(args || {}).map(([k, v]) => {
    const str = typeof v === 'string' ? v : JSON.stringify(v);
    return `${k}=${str.length > 120 ? str.substring(0, 120) + '…' : str}`;
  }).join(' | ');
  sendLog(socket, 'system', 'tool_start', `▶ ${name}${_argsSummary ? ' — ' + _argsSummary : ''}`, { tool: name, args });

  try {
    if (name === 'run_command') {
      return new Promise((resolve) => {
        let output = '';
        const child = spawn('bash', ['-c', args.command]);
        
        child.stdout.on('data', (data) => {
          const str = data.toString();
          output += str;
          if (socket) socket.emit('tool_output', { tool: 'run_command', content: str });
        });
        
        child.stderr.on('data', (data) => {
          const str = data.toString();
          output += str;
          if (socket) socket.emit('tool_output', { tool: 'run_command', content: str, type: 'stderr' });
        });
        
        child.on('close', (code) => {
          resolve({ output: output || (code === 0 ? 'Command finished.' : `Command failed with code ${code}`) });
        });
      });
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

      let subAgent = agentInstances.get(agentId);
      if (!subAgent) {
        subAgent = new Agent(agentId, systemPromptPath);
      }
      
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

    if (name === 'manage_jobs') {
      const { action, jobId, name: jobName, cron: cronExpr, task } = args;
      const db = await dbPromise;

      if (action === 'schedule') {
        if (!cronExpr || !task) return { error: 'cron and task are required for scheduling' };
        if (!cron.validate(cronExpr)) return { error: 'Invalid cron expression' };

        const result = await db.run(
          'INSERT INTO scheduled_jobs (name, cron, task, agentId) VALUES (?, ?, ?, ?)',
          [jobName || 'Unnamed Job', cronExpr, task, 'orchestrator']
        );
        
        const newJobId = result.lastID;
        scheduleCronJob(newJobId, cronExpr, task, jobName);
        
        return { status: 'Job scheduled successfully', jobId: newJobId };
      }

      if (action === 'list') {
        const jobs = await db.all('SELECT * FROM scheduled_jobs');
        return { jobs };
      }

      if (action === 'delete') {
        if (!jobId) return { error: 'jobId is required for delete' };
        if (scheduledCronTasks.has(jobId)) {
          scheduledCronTasks.get(jobId).stop();
          scheduledCronTasks.delete(jobId);
        }
        await db.run('DELETE FROM scheduled_jobs WHERE id = ?', [jobId]);
        return { status: 'Job deleted' };
      }

      if (action === 'toggle') {
        if (!jobId) return { error: 'jobId is required for toggle' };
        const job = await db.get('SELECT * FROM scheduled_jobs WHERE id = ?', [jobId]);
        if (!job) return { error: 'Job not found' };
        
        const newStatus = job.status === 'active' ? 'paused' : 'active';
        await db.run('UPDATE scheduled_jobs SET status = ? WHERE id = ?', [newStatus, jobId]);
        
        if (newStatus === 'paused' && scheduledCronTasks.has(jobId)) {
          scheduledCronTasks.get(jobId).stop();
          scheduledCronTasks.delete(jobId);
        } else if (newStatus === 'active') {
          scheduleCronJob(jobId, job.cron, job.task, job.name);
        }
        
        return { status: `Job ${newStatus}`, jobId };
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
      
      // systemic fix: if we have a CDP URL, force it and remove --profile to avoid daemon conflicts
      if (process.env.BROWSER_CDP_URL) {
        // Remove any existing --cdp flag to avoid duplicates
        cmd = cmd.replace(/--cdp\s+\S+/g, '');
        // Remove --profile flag as it triggers daemon management
        cmd = cmd.replace(/--profile\s+\S+/g, '');
        // Append the configured CDP URL
        cmd = `${cmd} --cdp ${process.env.BROWSER_CDP_URL}`;
      }

      // stubborness override: if model uses old 'snapshot -i' but user wants a visual, force screenshot
      if (cmd.includes('snapshot -i')) {
        cmd = cmd.replace('snapshot -i', 'screenshot');
      }

      const isScreenshot = cmd.includes('screenshot') || cmd.includes('snapshot');
      
      // If it's a screenshot and no path is provided, suggest one to make it easier to find
      if (cmd.startsWith('screenshot') && !cmd.includes(' ')) {
        cmd = 'screenshot ./screenshot.png';
      }

      console.log(`Executing browser action: npx agent-browser ${cmd}`);
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
    if (name === 'send_voice_message') {
      const text = args.text || '';
      const cleanText = text.replace(/"/g, '').replace(/\*/g, '').replace(/#/g, '').replace(/`/g, '').trim();
      if (!cleanText) return { error: 'No text provided.' };

      const audioDir = path.join(process.cwd(), 'audio');
      const fileId = `voice_${Date.now()}`;
      const oggPath = path.join(audioDir, `${fileId}.ogg`);
      const mp3Path = path.join(audioDir, `${fileId}.mp3`);

      try {
        // Generate speech with Google Cloud TTS
        const { mp3Buffer, voice } = await googleTTS(cleanText);
        sendLog(socket, 'system', 'tool_output', `🔊 Google TTS: ${voice.name} (${voice.languageCode})`, null, 'info');

        // Write MP3 directly (no ffmpeg needed — Google returns MP3)
        fs.writeFileSync(mp3Path, mp3Buffer);
        const audioUrl = `/audio/${fileId}.mp3`;
        io.emit('voice_message', { url: audioUrl, text });

        // Telegram: convert to ogg opus
        if (lastTelegramChatId && tgBot) {
          try {
            await execPromise(`ffmpeg -y -i "${mp3Path}" -c:a libopus "${oggPath}"`);
            await tgBot.telegram.sendVoice(lastTelegramChatId, { source: oggPath });
          } catch (tgErr) {
            console.error('Telegram voice send error:', tgErr);
          } finally {
            if (fs.existsSync(oggPath)) fs.unlinkSync(oggPath);
          }
        }

        return { status: 'Voice message sent.', audioUrl };
      } catch (e) {
        return { error: `Voice generation failed: ${e.message}` };
      }
    }
    if (name === 'web_search') {
      if (!tvly) return { error: 'Tavily API key not configured.' };
      const result = await tvly.search(args.query, { searchDepth: 'advanced', maxResults: 5 });
      return { 
        results: result.results.map(r => ({ title: r.title, url: r.url, content: r.content })) 
      };
    }
    if (name === 'list_capabilities') {
      const functionDeclarations = getToolDeclarations()[0].functionDeclarations || [];
      const capabilities = functionDeclarations
        .map((tool) => ({
          name: tool.name,
          description: tool.description || '',
          parameters: Object.keys(tool.parameters?.properties || {}),
          required: tool.parameters?.required || []
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const dynamicSkillNames = Array.from(dynamicSkills.keys()).sort((a, b) => a.localeCompare(b));
      const specializedAgents = Array.from(availableAgents.keys()).sort((a, b) => a.localeCompare(b));

      return {
        totalCapabilities: capabilities.length,
        capabilities,
        dynamicSkillsCount: dynamicSkillNames.length,
        dynamicSkills: dynamicSkillNames,
        specializedAgentsCount: specializedAgents.length,
        specializedAgents
      };
    }
    if (name === 'duffel_search_airports') {
      const query = String(args.query || '').trim();
      if (!query) return { error: 'query is required' };

      const limit = Math.max(1, Math.min(Number(args.limit) || 8, 20));
      const payload = await duffelRequest(`/air/airports?limit=${limit}&search=${encodeURIComponent(query)}`);
      const rows = Array.isArray(payload.data) ? payload.data : [];

      return {
        query,
        count: rows.length,
        airports: rows.map(a => ({
          id: a.id,
          iataCode: a.iata_code,
          icaoCode: a.icao_code,
          name: a.name,
          cityName: a.city_name,
          cityIataCode: a.city_iata_code,
          countryName: a.country_name,
          timeZone: a.time_zone
        }))
      };
    }
    if (name === 'duffel_search_flights') {
      const origin = String(args.origin || '').trim().toUpperCase();
      const destination = String(args.destination || '').trim().toUpperCase();
      const departureDate = String(args.departureDate || '').trim();
      const returnDate = args.returnDate ? String(args.returnDate).trim() : null;
      const adults = Math.max(1, Number(args.adults) || 1);
      const maxConnections = Number.isInteger(args.maxConnections) ? args.maxConnections : undefined;
      const cabinClass = args.cabinClass || 'economy';
      const currency = args.currency ? String(args.currency).trim().toUpperCase() : undefined;
      const limit = Math.max(1, Math.min(Number(args.limit) || 10, 25));

      if (!origin || !destination || !departureDate) {
        return { error: 'origin, destination, and departureDate are required' };
      }

      const slices = [
        {
          origin,
          destination,
          departure_date: departureDate
        }
      ];

      if (returnDate) {
        slices.push({
          origin: destination,
          destination: origin,
          departure_date: returnDate
        });
      }

      const requestBody = {
        data: {
          slices,
          passengers: Array.from({ length: adults }, () => ({ type: 'adult' })),
          cabin_class: cabinClass,
          return_offers: true,
          ...(typeof maxConnections === 'number' ? { max_connections: maxConnections } : {}),
          ...(currency ? { currency } : {})
        }
      };

      const payload = await duffelRequest('/air/offer_requests', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      const offers = Array.isArray(payload?.data?.offers) ? payload.data.offers.slice(0, limit) : [];
      return {
        search: {
          origin,
          destination,
          departureDate,
          returnDate,
          adults,
          cabinClass,
          maxConnections,
          currency
        },
        count: offers.length,
        offers: offers.map(o => ({
          id: o.id,
          totalAmount: o.total_amount,
          totalCurrency: o.total_currency,
          expiresAt: o.expires_at,
          paymentRequirements: o.payment_requirements,
          owner: o.owner ? { name: o.owner.name, iataCode: o.owner.iata_code } : null,
          slices: Array.isArray(o.slices) ? o.slices.map(s => ({
            origin: s.origin ? { iataCode: s.origin.iata_code, name: s.origin.name, cityName: s.origin.city_name } : null,
            destination: s.destination ? { iataCode: s.destination.iata_code, name: s.destination.name, cityName: s.destination.city_name } : null,
            departingAt: s.departing_at,
            arrivingAt: s.arriving_at,
            duration: s.duration,
            stops: Array.isArray(s.segments) ? Math.max(0, s.segments.length - 1) : 0,
            segments: Array.isArray(s.segments) ? s.segments.map(seg => ({
              departingAt: seg.departing_at,
              arrivingAt: seg.arriving_at,
              duration: seg.duration,
              marketingCarrier: seg.marketing_carrier ? {
                name: seg.marketing_carrier.name,
                iataCode: seg.marketing_carrier.iata_code
              } : null,
              operatingCarrier: seg.operating_carrier ? {
                name: seg.operating_carrier.name,
                iataCode: seg.operating_carrier.iata_code
              } : null,
              origin: seg.origin ? { iataCode: seg.origin.iata_code, name: seg.origin.name, cityName: seg.origin.city_name } : null,
              destination: seg.destination ? { iataCode: seg.destination.iata_code, name: seg.destination.name, cityName: seg.destination.city_name } : null
            })) : []
          })) : []
        }))
      };
    }
  } catch (error) {
    sendLog(socket, 'system', 'tool_error', `✗ ${name} failed (${Date.now() - _t0}ms) — ${error.message}`, { error: error.message }, 'error');
    return { error: error.message };
  }
  sendLog(socket, 'system', 'tool_end', `? ${name} — unknown tool`, { tool: name }, 'warning');
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
    this.abortController = null;
    if (initialMemory) {
      this.saveToHistory('user', [{ text: `Initial context: ${initialMemory}` }]);
    }
    if (initialTask) {
      const taskPath = path.join(process.cwd(), 'tasks', `${this.id}_task.md`);
      if (!fs.existsSync(path.join(process.cwd(), 'tasks'))) fs.mkdirSync(path.join(process.cwd(), 'tasks'));
      fs.writeFileSync(taskPath, `# Initial Task\n${initialTask}`);
    }
    this.lastActivity = Date.now();
    agentInstances.set(this.id, this);
  }

  stop() {
    this.shouldStop = true;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
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
      const agentsList = Array.from(availableAgents.values()).map(a => `- ${a.name}: ${a.description}`).join('\n');
      const toolNames = getToolDeclarations()[0].functionDeclarations.map(t => t.name);
      const toolsList = toolNames.map(name => `- ${name}`).join('\n');
      const activeProject = projectData.projects.find(p => p.id === projectData.activeProjectId) || { title: 'None', description: '' };
      
      // Load Project Context
      let projectContext = '';
      try {
        const projectContextPath = path.join(process.cwd(), 'context', `${projectData.activeProjectId}_context.md`);
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
        const contextDir = path.join(process.cwd(), 'context');
        
        let kFiles = [];
        if (fs.existsSync(knowledgeDir)) {
          kFiles = kFiles.concat(fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.md')).map(f => path.join(knowledgeDir, f)));
        }
        if (fs.existsSync(contextDir)) {
          // Include all .md files in context that are NOT specific project contexts already loaded
          const cFiles = fs.readdirSync(contextDir)
            .filter(f => f.endsWith('.md') && !f.includes('_context.md'))
            .map(f => path.join(contextDir, f));
          kFiles = kFiles.concat(cFiles);
        }

        if (kFiles.length > 0) {
          globalKnowledge = '\n\n# GLOBAL KNOWLEDGE\n' + kFiles.map(f => {
            const content = fs.readFileSync(f, 'utf8');
            const name = path.basename(f, '.md');
            return `## ${name}\n${content}`;
          }).join('\n\n');
        }
      } catch (e) {
        console.error('Failed to load global knowledge:', e);
      }

      // Static system prompt — stable across calls so Vertex AI implicit prompt caching can hit.
      // Date, time, and current task are intentionally excluded here.
      const staticSystemPrompt = `Active Project: ${activeProject.title} (${activeProject.description})${projectContext}${globalKnowledge}\n\nAvailable Specialized Agents:\n${agentsList}\n\nAvailable Runtime Capabilities (${toolNames.length}):\n${toolsList}\n\nWhen the user asks about your skills/capabilities/tools, answer with this concrete runtime list and exact count (no generic explanations).\n\n${systemContent}\n\n${memoryContent}`;

      // Dynamic context injected into the conversation turn instead of the system instruction.
      // Only date (not time) is included to avoid busting the cache on every request.
      const dynamicContextText = `
# SYSTEM CONTEXT (DO NOT OVERWRITE)
Today is ${now}.
Active Project: ${activeProject.title}
${activeProject.description ? `Project Description: ${activeProject.description}` : ''}

## SPECIALIZED AGENTS AVAILABLE:
${agentsList}

## CAPABILITIES & TOOLS:
${toolsList}

## CRITICAL RULES FOR ASSETS:
1. All screenshots and generated images ARE SAVED LOCALLY in "/screenshots/".
2. ALWAYS use the exact relative path returned by tools (e.g. "/screenshots/generated_123.png").
3. DO NOT prepend Supabase URLs (e.g. "https://...supabase.co/...") to local paths. 
4. Markdown tables MUST follow standard GFM format: Header, Newline, Separator (|---|), Newline, Rows.

# Current Task
${taskContent}
`;

      // Build a contents array with the dynamic context prepended to the first user message.
      // This leaves this.history unmodified so the conversation stays clean.
      const buildContentsWithContext = (history) => {
        if (!history || history.length === 0) return history;
        return history.map((h, idx) => {
          if (idx === 0 && h.role === 'user') {
            return { ...h, parts: [{ text: dynamicContextText + '\n\n---\n\n' }, ...h.parts] };
          }
          return h;
        });
      };

      this.shouldStop = false;
      this.abortController = new AbortController();
      const collectedImages = [];

      let turnCount = 0;
      while (turnCount < 10 && !this.shouldStop) {
        turnCount++;
        const providerNameMap = {
          'gemini': 'Vertex AI',
          'gemini_api': 'Gemini Studio',
          'perplexity': 'Perplexity AI',
          'ollama': 'Local Ollama',
          'ollama_qwen': 'Local Ollama (Qwen)'
        };
        const displayName = providerNameMap[provider] || 
          (provider.startsWith('ollama:') ? `Local Ollama (${provider.substring(7)})` : 
          (provider.startsWith('ollama') ? 'Local Ollama' : provider));
        if (socket) sendLog(socket, this.id, 'api_request', `Generating content (turn ${turnCount}) using ${displayName}`);
        
        let response;
        if (provider === 'gemini') {
          const model = vertexAI.preview.getGenerativeModel({
            model: 'gemini-3.1-flash-lite-preview', 
            tools: [
              { functionDeclarations: getToolDeclarations()[0].functionDeclarations },
              { googleSearch: {} }
            ]
          });

          const generatePromise = model.generateContent({
            contents: buildContentsWithContext(this.history),
            systemInstruction: {
              role: 'system',
              parts: [{ text: staticSystemPrompt }]
            }
          });
          
          const timeoutPromise = new Promise((_, reject) => {
            const id = setTimeout(() => reject(new Error('Vertex AI API timeout (60s)')), 60000);
            if (this.abortController) {
              this.abortController.signal.addEventListener('abort', () => {
                clearTimeout(id);
                reject(new Error('Vertex AI request cancelled by user'));
              });
            }
          });

          const result = await Promise.race([generatePromise, timeoutPromise]);

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

          // Convert history to standard role/parts format, injecting dynamic context
          const contents = buildContentsWithContext(this.history).map(h => ({
            role: h.role === 'model' ? 'model' : 'user',
            parts: h.parts.map(p => {
              if (p.text) return { text: p.text };
              if (p.functionCall) return { functionCall: p.functionCall };
              if (p.functionResponse) return { functionResponse: p.functionResponse };
              return {};
            })
          }));

          const generatePromise = model.generateContent({
            contents,
            systemInstruction: staticSystemPrompt
          });

          const timeoutPromise = new Promise((_, reject) => {
            const id = setTimeout(() => reject(new Error('Gemini API timeout (60s)')), 60000);
            if (this.abortController) {
              this.abortController.signal.addEventListener('abort', () => {
                clearTimeout(id);
                reject(new Error('Gemini API request cancelled by user'));
              });
            }
          });

          const result = await Promise.race([generatePromise, timeoutPromise]);

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
              instructions: staticSystemPrompt + '\n\n' + dynamicContextText,
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
          let ollamaModel = 'gemma2:2b'; // default
          if (provider === 'ollama_qwen') ollamaModel = 'qwen2.5-coder:14b';
          else if (provider.startsWith('ollama:')) ollamaModel = provider.substring(7);
          
          const ollamaMessages = [
            { role: 'system', content: staticSystemPrompt + '\n\n' + dynamicContextText },
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

          if (socket) sendLog(socket, this.id, 'api_request', `Ollama Request: ${ollamaModel} (${ollamaMessages.length} messages)`);
          
          this.abortController = new AbortController();
          const timeoutId = setTimeout(() => this.abortController?.abort(), 60000); // 60s timeout
          
          let res;
          try {
            res = await fetch('http://localhost:11434/api/chat', {
              method: 'POST',
              body: JSON.stringify({
                model: ollamaModel,
                messages: ollamaMessages,
                tools: ollamaTools,
                stream: false
              }),
              signal: this.abortController.signal
            });
          } catch (err) {
            if (this.shouldStop || err.name === 'AbortError') {
              throw new Error('Ollama request cancelled or timed out');
            }
            throw err;
          } finally {
            clearTimeout(timeoutId);
          }

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Ollama Error (${res.status}): ${errText}`);
          }
          
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

        // Send intermediate text if present (e.g. thoughts before tools)
        if (response.text && response.text.trim() !== '' && response.functionCalls) {
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
            console.log(`[Agent ${this.id}] Executing tool: ${call.name}`);
            sendLog(socket, this.id, 'tool_call', `⚙️ Starting tool execution: ${call.name}`, { args: call.args });
            
            if (socket) socket.emit('agent_status', { agentId: this.id, status: 'working', message: `Executing ${call.name}...` });
            
            const progress = Math.min(Math.floor((turnCount / 5) * 100), 95);
            socket.emit('task_progress', { agentId: this.id, progress });

            const timeoutMs = call.name === 'browser_action' ? 180000 : 90000;
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs/1000}s: ${call.name}`)), timeoutMs)
            );

            let result;
            const _pmT0 = Date.now();
            try {
              result = await Promise.race([
                executeTool(call, socket),
                timeoutPromise
              ]);
            } catch (err) {
              result = { error: err.message };
              if (err.message.includes('timed out')) {
                sendLog(socket, this.id, 'warning', `⚠️ ${call.name} is taking too long. Aborting turn.`, { tool: call.name }, 'warning');
                this.shouldStop = true; // Auto-stop if tool times out to prevent "hanging"
              }
            }
            const _pmDuration = Date.now() - _pmT0;

            if (result.error) {
              sendLog(socket, this.id, 'tool_result', `✗ ${call.name} failed (${_pmDuration}ms) — ${result.error}`, result, 'error');
            } else {
              // Build a concise result preview
              const _resultPreview = (() => {
                if (result.output) return result.output.substring(0, 200);
                if (result.content) return result.content.substring(0, 200);
                if (result.status) return result.status;
                if (result.data) return `${Array.isArray(result.data) ? result.data.length + ' rows' : 'object'}`;
                return JSON.stringify(result).substring(0, 200);
              })();
              sendLog(socket, this.id, 'tool_result', `✓ ${call.name} (${_pmDuration}ms) — ${_resultPreview}`, result, 'info');
            }

            if (result.screenshotUrl) {
              collectedImages.push(result.screenshotUrl);
            }
            if (result.imageUrl) {
              collectedImages.push(result.imageUrl);
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
            const msgData = {
              agentId: this.id,
              role: 'assistant',
              content: response.text || '',
              images: collectedImages, 
              usage: response.usage
            };
            
            // Emit to the specific socket (important for Telegram mockSocket)
            socket.emit('agent_message', msgData);
            
            // Also emit globally so UI updates survive socket reconnects
            // (We check if socket is not mockSocket by checking if io is available)
            if (typeof io !== 'undefined' && socket !== io) {
               io.emit('agent_message', msgData);
            }

            // Update cumulative stats
            dbPromise.then(async db => {
              await db.run('UPDATE system_stats SET value = COALESCE(value, 0) + ? WHERE key = ?', [response.usage.promptTokens, 'total_input_tokens']);
              await db.run('UPDATE system_stats SET value = COALESCE(value, 0) + ? WHERE key = ?', [response.usage.candidatesTokens, 'total_output_tokens']);
              await db.run('UPDATE system_stats SET value = COALESCE(value, 0) + 1 WHERE key = ?', ['total_requests']);
              
              await db.run('INSERT INTO token_usage_log (agentId, promptTokens, candidatesTokens, totalTokens) VALUES (?, ?, ?, ?)', [
                this.id, response.usage.promptTokens, response.usage.candidatesTokens, response.usage.totalTokens
              ]);
              
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
      if (typeof io !== 'undefined') io.emit('agent_status', { agentId: this.id, status: 'idle' });
    }
  }
}

const orchestrator = new Agent('orchestrator', path.join(process.cwd(), 'agents', 'orchestrator', 'system.md'));
agentInstances.set('orchestrator', orchestrator);

const scheduledCronTasks = new Map();

function scheduleCronJob(jobId, cronExpr, task, jobName) {
  const taskObj = cron.schedule(cronExpr, async () => {
    console.log(`[Job ${jobId}] Running: ${jobName || 'Unnamed'}`);
    const db = await dbPromise;
    await db.run('UPDATE scheduled_jobs SET lastRun = ? WHERE id = ?', [new Date().toISOString(), jobId]);
    
    const mockSocket = {
      emit: (event, data) => {
        io.emit(event, data); 
      }
    };
    
    sendLog(mockSocket, 'system', 'job_start', `Running scheduled job: ${jobName || jobId}`);
    await orchestrator.processMessage(`[SCHEDULED JOB] ${task}`, mockSocket);
  });
  scheduledCronTasks.set(jobId, taskObj);
}

async function loadScheduledJobs() {
  const db = await dbPromise;
  const jobs = await db.all('SELECT * FROM scheduled_jobs WHERE status = "active"');
  jobs.forEach(job => {
    scheduleCronJob(job.id, job.cron, job.task, job.name);
  });
  console.log(`Restored ${jobs.length} scheduled jobs`);
}
loadScheduledJobs();

setInterval(() => {
  const stats = {
    cpu: os.loadavg(),
    mem: {
      free: os.freemem(),
      total: os.totalmem(),
      usage: (1 - (os.freemem() / os.totalmem())) * 100
    },
    uptime: os.uptime(),
    timestamp: new Date().toISOString()
  };
  io.emit('system_heartbeat', stats);
}, 5000);

// Global Watchdog to prevent stuck agents
setInterval(() => {
  const now = Date.now();
  for (const [id, agent] of agentInstances) {
    if (agent.processing && (now - agent.lastActivity > 120000)) {
      console.warn(`[Watchdog] Agent ${id} seems stuck (no activity for 120s). Force aborting.`);
      sendLog(null, id, 'error', '⚠️ WATCHDOG: Agent stalled for >120s. Forcefully resetting...', null, 'error');
      agent.stop();
      agent.processing = false;
      if (activeAgents.has(id)) activeAgents.get(id).status = 'idle';
      io.emit('agent_status', { agentId: id, status: 'idle', message: 'Stalled - Reset by Watchdog' });
    }
  }
}, 30000);

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

  // 6. Clean up audio and screenshots
  if (socket) sendLog(socket, 'orchestrator', 'system', 'Purging local media (audio/screenshots)...');
  try {
    const audioDir = path.join(process.cwd(), 'audio');
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    
    [audioDir, screenshotsDir].forEach(dir => {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          if (fs.statSync(filePath).isFile() && !file.startsWith('.')) {
            fs.unlinkSync(filePath);
          }
        }
      }
    });
  } catch (e) {
    console.error('Failed to clean up media directories:', e);
  }

  await new Promise(r => setTimeout(r, 800));

  // 7. Notify frontend
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
  hasPerplexity: !!process.env.PERPLEXITY_API_KEY,
  hasDuffel: !!getDuffelApiKey()
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

  // Restore logs
  sendLogHistory(socket);

  // Send active agents list
  socket.emit('active_agents', Array.from(activeAgents.values()));

  socket.on('user_message', async (data) => {
    console.log('Received message:', data.content, 'Provider:', data.provider);

    // Handle /new command to clear history
    if (data.content.trim() === '/new') {
      await systemReset(socket);
      return;
    }

    if (data.content.trim() === '/stop') {
      let stopped = 0;
      for (const [id, agent] of agentInstances.entries()) {
        if (agent.processing) {
          agent.stop();
          stopped++;
          activeAgents.get(id) && (activeAgents.get(id).status = 'idle');
          io.emit('agent_status', { agentId: id, status: 'idle', message: '' });
        }
      }
      sendLog(socket, 'orchestrator', 'system', `⏹ Generation stopped via /stop (${stopped} agent(s) halted)`, null, 'warning');
      socket.emit('agent_message', { agentId: 'orchestrator', content: '_Generation stopped by user._', isTool: true });
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

    // Determine target agent
    const targetId = data.targetAgentId || 'orchestrator';
    const targetAgent = agentInstances.get(targetId) || orchestrator;
    
    if (targetId !== 'orchestrator' && !agentInstances.has(targetId)) {
      sendLog(socket, 'system', 'error', `Target agent ${targetId} not found. Routing to orchestrator.`);
    }

    await targetAgent.processMessage(data.content, socket, data.provider, data.images);
  });

  socket.on('run_ollama_model', async (data) => {
    const { model } = data;
    if (!model) return;
    
    sendLog(socket, 'system', 'info', `Executing 'ollama run ${model}'...`);
    
    // We run it in a separate process and don't wait for completion 
    // because 'run' starts an interactive session or stays open.
    // However, for the purpose of "ensuring it runs/is pulled", 
    // a simple exec or spawn is enough.
    const child = spawn('ollama', ['run', model]);
    
    child.stdout.on('data', (d) => {
      console.log(`[Ollama Run] ${d}`);
    });
    
    child.stderr.on('data', (d) => {
      const msg = d.toString();
      if (msg.includes('pulling')) {
        sendLog(socket, 'system', 'info', msg.trim());
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        sendLog(socket, 'system', 'success', `Model ${model} is ready.`);
      } else {
        sendLog(socket, 'system', 'error', `Ollama run failed with code ${code}`);
      }
    });
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

  socket.on('stop_generation', () => {
    let stopped = 0;
    console.log(`[System] Stop requested. Current agent instances: ${Array.from(agentInstances.keys()).join(', ')}`);
    
    for (const [id, agent] of agentInstances.entries()) {
      console.log(`[System] Checking agent ${id}: processing=${agent.processing}`);
      if (agent.processing) {
        agent.stop();
        stopped++;
        // Sync both maps
        const uiAgent = activeAgents.get(id);
        if (uiAgent) uiAgent.status = 'idle';
        io.emit('agent_status', { agentId: id, status: 'idle', message: 'Halted by user' });
      }
    }
    
    // If we reported 0 but the UI thinks someone is working, force a sync
    if (stopped === 0) {
      for (const [id, agent] of activeAgents.entries()) {
        if (agent.status === 'working') {
          agent.status = 'idle';
          io.emit('agent_status', { agentId: id, status: 'idle', message: 'Force reset' });
        }
      }
    }

    sendLog(socket, 'orchestrator', 'system', `⏹ Generation stopped (${stopped} active agent(s) halted)`, { stoppedCount: stopped }, 'warning');
    socket.emit('agent_message', { agentId: 'orchestrator', content: '_Generation stopped by user._', isTool: true });
  });

  socket.on('delete_agent', async (data) => {
    const { agentId } = data;
    if (agentId === 'orchestrator') {
      socket.emit('agent_message', { agentId: 'orchestrator', content: 'You cannot delete the orchestrator.', isTool: true });
      return;
    }
    
    activeAgents.delete(agentId);
    agentInstances.delete(agentId);
    
    const db = await dbPromise;
    await db.run('DELETE FROM active_agents WHERE agentId = ?', [agentId]);
    await db.run('DELETE FROM agent_memory WHERE agentId = ?', [agentId]);
    
    io.emit('active_agents', Array.from(activeAgents.values()));
    sendLog(socket, 'orchestrator', 'system', `Deleted agent: ${agentId}`);
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

  socket.on('set_duffel_key', (data) => {
    const key = data.apiKey;
    if (key) {
      updateEnv('DUFFEL_API_KEY', key);
      sendKeyStatus();
      socket.emit('agent_message', { agentId: 'orchestrator', content: 'Duffel API Key saved permanently to .env!' });
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
    lastTelegramChatId = ctx.chat.id;
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
    lastTelegramChatId = ctx.chat.id;
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
            const tempMp3 = path.join(process.cwd(), `voice_${Date.now()}.mp3`);
            const tempOgg = path.join(process.cwd(), `voice_${Date.now()}.ogg`);
            try {
              // Generate voice with Google Cloud TTS
              const _tgText = data.content.replace(/\*/g, '').replace(/#/g, '').trim();
              const { mp3Buffer, voice: _tgVoice } = await googleTTS(_tgText);
              console.log(`[Telegram TTS] ${_tgVoice.name} (${_tgVoice.languageCode})`);
              fs.writeFileSync(tempMp3, mp3Buffer);
              await execPromise(`ffmpeg -y -i "${tempMp3}" -c:a libopus "${tempOgg}"`);
              await ctx.replyWithVoice({ source: tempOgg });
              ctx.reply(data.content, { parse_mode: 'Markdown' });
            } catch (e) {
              console.error('Voice reply error:', e);
              ctx.reply(data.content, { parse_mode: 'Markdown' });
            } finally {
              if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
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
    lastTelegramChatId = ctx.chat.id;
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

  bot.on('location', async (ctx) => {
    lastTelegramChatId = ctx.chat.id;
    const { latitude, longitude } = ctx.message.location;

    // Reverse-geocode with Nominatim (no API key required, respects attribution)
    let locationDescription = `latitude ${latitude}, longitude ${longitude}`;
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
        { headers: { 'User-Agent': 'FrAssist/1.0 (personal assistant)' } }
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.display_name) {
          locationDescription = geoData.display_name;
        }
      }
    } catch (geoErr) {
      console.error('[Telegram location] Geocoding failed:', geoErr.message);
    }

    const isLive = !!ctx.message.location.live_period;
    const locationMessage = isLive
      ? `📍 I'm sharing my live location with you. I am currently at: ${locationDescription} (${latitude}, ${longitude}). Please use this to help me with anything location-related.`
      : `📍 I'm sharing my location with you. I am at: ${locationDescription} (${latitude}, ${longitude}). Please use this to help me with anything location-related.`;

    console.log(`[Telegram location] ${locationMessage}`);
    await ctx.sendChatAction('typing');

    const mockSocket = {
      emit: (event, data) => {
        if (event === 'agent_message' && !data.isTool) {
          if (data.content && data.content.trim() !== '') {
            try {
              ctx.reply(data.content, { parse_mode: 'Markdown' });
            } catch (e) {
              ctx.reply(data.content);
            }
          }
        }
        if (event === 'agent_error') {
          ctx.reply(`❌ Error: ${data.error}`);
        }
        io.emit(event, data);
      }
    };

    await orchestrator.processMessage(locationMessage, mockSocket, 'gemini');
  });

  bot.launch().then(() => {
    console.log(`Telegram bot [${botId}] launched successfully`);
  }).catch(err => console.error(`Telegram bot [${botId}] launch error:`, err));

  // Enable graceful stop for all relevant signals
  const shutdown = (signal) => {
    console.log(`Stopping bot [${botId}] due to ${signal}...`);
    try {
      bot.stop(signal);
    } catch (e) {
      // Ignore if already stopped
    }
    setTimeout(() => process.exit(0), 500); // Give it a moment to stop the bot then exit
  };
  
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGUSR2', () => shutdown('SIGUSR2')); // Handle nodemon restarts
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

app.get('/api/stats/detailed', async (req, res) => {
  try {
    const db = await dbPromise;
    // Group by date (YYYY-MM-DD) and agentId
    const rows = await db.all(`
      SELECT 
        date(timestamp) as date, 
        agentId, 
        SUM(promptTokens) as inputTokens, 
        SUM(candidatesTokens) as outputTokens,
        SUM(totalTokens) as totalTokens,
        COUNT(*) as requests
      FROM token_usage_log 
      GROUP BY date(timestamp), agentId
      ORDER BY date DESC, totalTokens DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch detailed stats' });
  }
});

app.post('/api/chrome/launch', async (req, res) => {
  try {
    const { exec } = await import('child_process');
    const util = await import('util');
    const execPromise = util.promisify(exec);
    const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const profilePath = path.join(os.homedir(), 'Library/Application Support/Google/Chrome/FrAssist');
    
    // Launch Chrome with remote debugging and custom profile
    const cmd = `"${chromePath}" --remote-debugging-port=9222 --user-data-dir="${profilePath}" --no-first-run --no-default-browser-check &`;
    await execPromise(cmd);
    
    // Wait a moment and check if port 9222 is listening
    setTimeout(async () => {
      try {
        await execPromise('lsof -i :9222');
        console.log('Chrome Debug Port 9222 is active.');
      } catch (e) {
        console.warn('Chrome Debug Port 9222 failed to open. Chrome might need a full restart (Cmd+Q).');
      }
    }, 2000);

    res.json({ status: 'success', message: 'Chrome launch command sent.' });
  } catch (e) {
    res.status(500).json({ error: `Failed to launch Chrome: ${e.message}` });
  }
});

app.get('/api/network-info', (req, res) => {
  const nets = os.networkInterfaces();
  const results = {};

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        if (!results[name]) {
          results[name] = [];
        }
        results[name].push(net.address);
      }
    }
  }
  res.json(results);
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

      // Also write to frontend/.env.local for dynamic Vite proxying
      const frontendEnvPath = path.join(process.cwd(), '..', 'frontend', '.env.local');
      fs.writeFileSync(frontendEnvPath, `VITE_BACKEND_PORT=${actualPort}\n`);
      console.log(`Dynamic port ${actualPort} synced to frontend/.env.local`);
    } catch (err) {
      console.error('Failed to sync port info:', err);
    }
  });

  httpServer.listen(port, '0.0.0.0');
};

startServer(DEFAULT_PORT);

