import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Ensure working directory is always backend root regardless of how the script is launched
process.chdir(__dirname);

import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '.env') });
import express from 'express';
console.log('Backend process starting...');
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec, spawn } from 'child_process';
import util from 'util';
import fs from 'fs';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { tavily } from '@tavily/core';
import { Telegraf } from 'telegraf';
import cron from 'node-cron';
import os from 'os';
import { initWhatsApp, getWhatsAppStatus, disconnectWhatsApp, connectToWhatsApp, getWhatsAppMessages, getWhatsAppChats, getWhatsAppChatMessages, sendWhatsAppMessage, evaluateAutoReply, resolveContactDisplayName, getWhatsAppModel, setWhatsAppModel, markWhatsAppMessageReplied, setAutoReplyStatus, getAutoReplyContacts, isAutoReplyEnabled, exportAllWhatsAppConversationsToJson, disableAllAutoReplies, clearWhatsAppChatHistory, scheduleWhatsAppMessage, getScheduledWhatsAppMessages, cancelScheduledWhatsAppMessage, deleteScheduledWhatsAppMessage, sendScheduledWhatsAppMessageNow, startWhatsAppScheduler } from './services/whatsapp.js';
import { BrowserManager } from './skills/utils/browser_manager.js';
import { EgoAdapter } from './skills/utils/ego_adapter.js';
import { recordTokenUsage, estimateTokens, setTokenTrackerIO, setTokenTrackerDb } from './services/tokenTracker.js';
import { fetchOllamaCloudWithFailover, fetchOllamaCloudModels, testOllamaCloudInference } from './services/ollama_client.js';
import { generateGeminiContent, testGeminiInference, hasGeminiKey, GEMINI_MODELS } from './services/geminiService.js';
import { routeTask, getRouterConfig, updateRouterConfig, resetRouterConfig, setRouterDb, getFriendlyModelName } from './services/modelRouter.js';

let dbPromise = null;
const dynamicSkills = new Map();
const availableAgents = new Map();
let projectData = { projects: [] };
const activeAgents = new Map([['orchestrator', { id: 'orchestrator', name: 'Orchestrator', role: 'Main Controller', status: 'idle' }]]);
const agentInstances = new Map();

export function getProjectSupabaseCredentials(projectId) {
  const normId = (projectId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (normId.includes('rally')) {
    return {
      id: 'rally-nyc',
      title: 'Rally NYC',
      url: process.env.SUPABASE_URL_RALLY_NYC || '',
      key: process.env.SUPABASE_SERVICE_ROLE_KEY_RALLY_NYC || process.env.SUPABASE_KEY_RALLY_NYC || process.env.SUPABASE_ANON_KEY_RALLY_NYC || ''
    };
  }
  if (normId.includes('overnight') || normId.includes('wanderisco')) {
    return {
      id: 'overnight',
      title: 'Overnight / Wanderisco',
      url: process.env.SUPABASE_URL_OVERNIGHT || '',
      key: process.env.SUPABASE_SERVICE_ROLE_KEY_OVERNIGHT || process.env.SUPABASE_KEY_OVERNIGHT || process.env.SUPABASE_ANON_KEY_OVERNIGHT || ''
    };
  }
  // Default to Scalea / Tra-Montiemare
  return {
    id: 'tra-montiemare',
    title: 'Tra-Montiemare (Scalea Vacation Rental)',
    url: process.env.SUPABASE_URL_TRAMONTIEMARE || process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_SERVICE_ROLE_KEY_TRAMONTIEMARE || process.env.SUPABASE_KEY_TRAMONTIEMARE || process.env.SUPABASE_KEY || ''
  };
}

function loadProjects() {
  const projectsPath = path.join(process.cwd(), 'context', 'projects.json');
  if (fs.existsSync(projectsPath)) {
    try {
      projectData = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
      console.log(`Loaded ${projectData.projects?.length || 0} projects from projects.json.`);
    } catch (err) {
      console.error('Error reading projects.json:', err);
    }
  }
}
function saveProjects() {
  const projectsPath = path.join(process.cwd(), 'context', 'projects.json');
  fs.writeFileSync(projectsPath, JSON.stringify(projectData, null, 2));
}
loadProjects();

// Watch for changes in projects.json
const projectsWatchPath = path.join(process.cwd(), 'context', 'projects.json');
if (fs.existsSync(projectsWatchPath)) {
  fs.watch(projectsWatchPath, (eventType) => {
    if (eventType === 'change') {
      console.log('projects.json changed. Reloading projects...');
      loadProjects();
    }
  });
}

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

function mergeEnvContent(existingContent, newContent) {
  const existingLines = (existingContent || '').split('\n');
  const newLines = (newContent || '').split('\n');
  
  const newKeyValues = new Map();
  
  for (const line of newLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      newKeyValues.set(match[1], match[2]);
    }
  }

  const updatedExistingKeys = new Set();
  const resultLines = existingLines.map(line => {
    const match = line.match(/^(?:export\s+)?([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1];
      if (newKeyValues.has(key)) {
        updatedExistingKeys.add(key);
        const val = newKeyValues.get(key);
        process.env[key] = val;
        return `${key}=${val}`;
      }
    }
    return line;
  });

  const appendedLines = [];
  for (const [key, val] of newKeyValues.entries()) {
    if (!updatedExistingKeys.has(key)) {
      appendedLines.push(`${key}=${val}`);
      process.env[key] = val;
    }
  }

  if (appendedLines.length > 0) {
    if (resultLines.length > 0 && resultLines[resultLines.length - 1].trim() !== '') {
      resultLines.push('');
    }
    resultLines.push(...appendedLines);
  }

  return {
    merged: resultLines.join('\n'),
    updatedCount: updatedExistingKeys.size,
    addedCount: appendedLines.length
  };
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
const skillsDirPath = path.join(process.cwd(), 'skills');
if (fs.existsSync(skillsDirPath)) {
  fs.watch(skillsDirPath, { recursive: true }, async (eventType, filename) => {
    if (filename && filename.endsWith('.js')) {
      console.log(`Detected change in skills directory: ${filename}. Reloading skills...`);
      await loadDynamicSkills();
    }
  });
}
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
        model TEXT,
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

      CREATE TABLE IF NOT EXISTS pending_approvals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agentId TEXT,
        title TEXT,
        description TEXT,
        content TEXT,
        type TEXT DEFAULT 'draft_review',
        status TEXT DEFAULT 'pending',
        metadata TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        channel TEXT DEFAULT 'web',
        target_agent TEXT DEFAULT 'orchestrator',
        subagents_used TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        role TEXT,
        agent_id TEXT,
        content TEXT,
        images TEXT DEFAULT '[]',
        usage TEXT,
        is_tool INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id TEXT PRIMARY KEY,
        remote_jid TEXT,
        sender_phone TEXT,
        sender_name TEXT,
        from_me INTEGER DEFAULT 0,
        text TEXT,
        replied INTEGER DEFAULT 0,
        timestamp INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_wa_remote_jid ON whatsapp_messages(remote_jid);
      CREATE INDEX IF NOT EXISTS idx_wa_replied ON whatsapp_messages(replied);
      CREATE INDEX IF NOT EXISTS idx_wa_from_me ON whatsapp_messages(from_me);

      CREATE TABLE IF NOT EXISTS whatsapp_auto_reply (
        remote_jid TEXT PRIMARY KEY,
        phone TEXT,
        contact_name TEXT,
        enabled INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_wa_auto_reply_enabled ON whatsapp_auto_reply(enabled);

      CREATE TABLE IF NOT EXISTS facebook_outreach_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_url TEXT,
        post_id TEXT,
        post_url TEXT,
        author TEXT,
        post_snippet TEXT,
        comment_text TEXT,
        status TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_fb_post_url ON facebook_outreach_log(post_url);
      CREATE INDEX IF NOT EXISTS idx_fb_post_id ON facebook_outreach_log(post_id);
    `);

    try {
      await db.exec(`ALTER TABLE token_usage_log ADD COLUMN model TEXT`);
    } catch (_) {
      // Column already exists
    }
    setTokenTrackerDb(db);
    setRouterDb(db);

    console.log('SQLite Database initialized with Session, Message & WhatsApp Auto-Reply tables');
    await cleanupOldSessions(db);
    return db;
  });
}

// 7-day TTL Cleanup Routine
async function cleanupOldSessions(dbInstance = null) {
  try {
    const db = dbInstance || (await dbPromise);
    if (!db) return;
    
    // Delete sessions and messages older than 7 days
    await db.run(`
      DELETE FROM chat_messages WHERE session_id IN (
        SELECT id FROM chat_sessions WHERE updated_at < datetime('now', '-7 days')
      )
    `);
    const sessionResult = await db.run(`
      DELETE FROM chat_sessions WHERE updated_at < datetime('now', '-7 days')
    `);

    if (sessionResult && sessionResult.changes > 0) {
      console.log(`[7-Day TTL] Automatically cleaned up ${sessionResult.changes} expired session(s).`);
    }
  } catch (err) {
    console.error('[7-Day TTL] Error cleaning up old sessions:', err);
  }
}

// Schedule TTL cleanup every 6 hours
cron.schedule('0 */6 * * *', () => {
  cleanupOldSessions();
});

// Session Helper Functions
let activeSessionId = 'session_default';

async function getOrCreateSession(sessionId = 'session_default', channel = 'web', targetAgent = 'orchestrator', initialPrompt = '') {
  const db = await dbPromise;
  if (!db) return null;
  let session = await db.get(`SELECT * FROM chat_sessions WHERE id = ?`, [sessionId]);
  if (!session) {
    const initialSubagents = JSON.stringify([targetAgent || 'orchestrator']);
    let title = initialPrompt ? initialPrompt.slice(0, 45).trim() + (initialPrompt.length > 45 ? '...' : '') : 'New Workspace Chat';
    if (channel === 'whatsapp') title = 'WhatsApp Conversation';
    if (channel === 'telegram') title = 'Telegram Conversation';

    await db.run(
      `INSERT INTO chat_sessions (id, title, channel, target_agent, subagents_used, created_at, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [sessionId, title, channel, targetAgent || 'orchestrator', initialSubagents]
    );
    session = await db.get(`SELECT * FROM chat_sessions WHERE id = ?`, [sessionId]);
  }
  return session;
}

async function recordMessageInSession(sessionId, msgData) {
  try {
    const db = await dbPromise;
    if (!db) return;
    const targetSessionId = sessionId || activeSessionId || 'session_default';
    const msgId = msgData.id || `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const imgJson = JSON.stringify(msgData.images || (msgData.image ? [msgData.image] : []));
    const usageJson = msgData.usage ? JSON.stringify(msgData.usage) : null;
    const isToolVal = msgData.isTool ? 1 : 0;

    await db.run(
      `INSERT OR REPLACE INTO chat_messages (id, session_id, role, agent_id, content, images, usage, is_tool, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [msgId, targetSessionId, msgData.role, msgData.agentId || 'orchestrator', msgData.content || '', imgJson, usageJson, isToolVal]
    );

    // Update session's updated_at and subagents_used
    const session = await db.get(`SELECT * FROM chat_sessions WHERE id = ?`, [targetSessionId]);
    if (session) {
      let subagents = [];
      try { subagents = JSON.parse(session.subagents_used || '[]'); } catch (e) {}
      if (msgData.agentId && !subagents.includes(msgData.agentId)) {
        subagents.push(msgData.agentId);
      }

      let title = session.title;
      if ((title === 'New Workspace Chat' || !title) && msgData.role === 'user' && msgData.content) {
        title = msgData.content.slice(0, 45).trim() + (msgData.content.length > 45 ? '...' : '');
      }

      await db.run(
        `UPDATE chat_sessions SET updated_at = datetime('now'), subagents_used = ?, title = ? WHERE id = ?`,
        [JSON.stringify(subagents), title, targetSessionId]
      );
    }
  } catch (err) {
    console.error('Failed to record message in session:', err);
  }
}

async function getAllSessions() {
  const db = await dbPromise;
  if (!db) return [];
  const rows = await db.all(`SELECT * FROM chat_sessions ORDER BY updated_at DESC`);
  return rows.map(r => {
    let subagentsUsed = [];
    try { subagentsUsed = JSON.parse(r.subagents_used || '[]'); } catch (e) {}
    return {
      id: r.id,
      title: r.title,
      channel: r.channel || 'web',
      targetAgent: r.target_agent || 'orchestrator',
      subagentsUsed,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  });
}

async function getSessionMessages(sessionId) {
  const db = await dbPromise;
  if (!db) return [];
  const rows = await db.all(`SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC`, [sessionId]);
  return rows.map(r => {
    let images = [];
    let usage = undefined;
    try { images = JSON.parse(r.images || '[]'); } catch (e) {}
    try { usage = r.usage ? JSON.parse(r.usage) : undefined; } catch (e) {}
    return {
      id: r.id,
      sessionId: r.session_id,
      role: r.role,
      agentId: r.agent_id,
      content: r.content,
      images: images.length > 0 ? images : undefined,
      usage,
      isTool: Boolean(r.is_tool),
      timestamp: r.timestamp
    };
  });
}

async function deleteSession(sessionId) {
  const db = await dbPromise;
  if (!db) return;
  await db.run(`DELETE FROM chat_messages WHERE session_id = ?`, [sessionId]);
  await db.run(`DELETE FROM chat_sessions WHERE id = ?`, [sessionId]);
}

initDb();

const execPromise = util.promisify(exec);

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

setTokenTrackerIO(io);

// Initialize WhatsApp Multi-Device client & Message Scheduler
initWhatsApp(io).catch(err => console.error('[WhatsApp] Initialization error:', err));
startWhatsAppScheduler(io);

async function loadAvailableAgents() {
  const possiblePaths = [
    path.join(__dirname, 'agents'),
    path.join(process.cwd(), 'agents'),
    path.join(process.cwd(), 'backend', 'agents')
  ];
  const agentsDir = possiblePaths.find(p => fs.existsSync(p));
  if (!agentsDir) {
    console.log('No agents directory found in possible paths:', possiblePaths);
    return;
  }
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
      
      const role = name === 'orchestrator' ? 'Main Controller' : 'Specialized Agent';
      activeAgents.set(name, { id: name, name: displayName, role, status: 'idle' });
      
      if (typeof dbPromise !== 'undefined') {
        dbPromise.then(db => {
          db.run('INSERT OR IGNORE INTO active_agents (agentId, name, role, status) VALUES (?, ?, ?, ?)', [name, displayName, role, 'idle']).catch(() => {});
        }).catch(() => {});
      }
    }
  }
  if (io) io.emit('active_agents', Array.from(activeAgents.values()));
}
await loadAvailableAgents();

// Watch for changes in the agents directory safely
const agentsWatchDir = [
  path.join(__dirname, 'agents'),
  path.join(process.cwd(), 'agents'),
  path.join(process.cwd(), 'backend', 'agents')
].find(p => fs.existsSync(p));

if (agentsWatchDir && fs.existsSync(agentsWatchDir)) {
  fs.watch(agentsWatchDir, { recursive: true }, async (eventType, filename) => {
    if (filename && (filename.endsWith('system.md') || eventType === 'rename')) {
      console.log(`Detected change in agents directory: ${filename}. Reloading agents...`);
      await loadAvailableAgents();
    }
  });
}

const traceLogPath = path.join(process.cwd(), 'data', 'trace.jsonl');
if (!fs.existsSync(path.join(process.cwd(), 'data'))) fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });

const activeSessionRuns = new Map();

function sendLog(socket, agentId, type, message, data = null, level = 'info', sessionId = null) {
  const targetSessionId = sessionId || data?.sessionId || null;
  const event = {
    id: Date.now().toString() + Math.random().toString(36).substring(7),
    timestamp: new Date().toISOString(),
    agentId,
    sessionId: targetSessionId,
    type,
    level,
    message,
    data
  };
  // Broadcast to ALL connected clients so every open tab sees every event (no redundant socket.emit)
  if (typeof io !== 'undefined' && io) {
    io.emit('agent_log', event);
  } else if (socket && typeof socket.emit === 'function') {
    try { socket.emit('agent_log', event); } catch (_) {}
  }
  // Persist to rolling trace file for offline inspection
  try {
    fs.appendFileSync(traceLogPath, JSON.stringify(event) + '\n');
    // Rotate trace file if it exceeds 50,000 lines — keep the newest 25,000
    const fileSize = fs.statSync(traceLogPath).size;
    if (fileSize > 15 * 1024 * 1024) { // ~15 MB threshold
      const content = fs.readFileSync(traceLogPath, 'utf8');
      const allLines = content.trim().split('\n').filter(Boolean);
      if (allLines.length > 50000) {
        const trimmed = allLines.slice(-25000).join('\n') + '\n';
        fs.writeFileSync(traceLogPath, trimmed);
      }
    }
  } catch (_) {}
  
  if (agentInstances.has(agentId)) {
    agentInstances.get(agentId).lastActivity = Date.now();
  }
}

function broadcastTaskActivity(agentId, action, detail, meta = {}, sessionId = null) {
  const targetSessionId = sessionId || meta?.sessionId || null;
  const event = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    agentId: agentId || 'orchestrator',
    sessionId: targetSessionId,
    action,
    detail,
    timestamp: Date.now(),
    ...meta
  };
  if (typeof io !== 'undefined') {
    io.emit('task_activity', event);
  }
}

async function sendLogHistory(socket) {
  if (!fs.existsSync(traceLogPath)) return;
  try {
    const data = fs.readFileSync(traceLogPath, 'utf8');
    const lines = data.trim().split('\n').filter(Boolean);
    // Send the last 2000 entries (matching frontend MAX_LOGS cap)
    const lastLogs = lines.slice(-2000).map(line => {
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

// Split long messages to adhere to Telegram's 4096 character limit
function splitTelegramMessage(text, maxLength = 3900) {
  if (!text) return [];
  if (typeof text !== 'string') text = String(text);
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try splitting at double newline (paragraph boundary)
    let splitIdx = remaining.lastIndexOf('\n\n', maxLength);
    if (splitIdx === -1 || splitIdx < maxLength * 0.3) {
      // Try single newline
      splitIdx = remaining.lastIndexOf('\n', maxLength);
    }
    if (splitIdx === -1 || splitIdx < maxLength * 0.3) {
      // Try space boundary
      splitIdx = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIdx === -1 || splitIdx < maxLength * 0.3) {
      // Hard cut
      splitIdx = maxLength;
    }

    const chunk = remaining.substring(0, splitIdx).trim();
    if (chunk.length > 0) chunks.push(chunk);
    remaining = remaining.substring(splitIdx).trim();
  }

  return chunks;
}

// Send message safely with chunking and Markdown-to-plain fallback
async function sendSafeTelegramMessage(target, chatIdOrNull, text) {
  if (!text || text.trim() === '') return;
  const chunks = splitTelegramMessage(text);

  for (const chunk of chunks) {
    if (!chunk || chunk.trim() === '') continue;
    try {
      if (chatIdOrNull) {
        await target.sendMessage(chatIdOrNull, chunk, { parse_mode: 'Markdown' });
      } else {
        await target.reply(chunk, { parse_mode: 'Markdown' });
      }
    } catch (err) {
      // Fallback to plain text if markdown fails (e.g. unescaped characters)
      try {
        if (chatIdOrNull) {
          await target.sendMessage(chatIdOrNull, chunk);
        } else {
          await target.reply(chunk);
        }
      } catch (fallbackErr) {
        console.error('Failed to send Telegram message:', fallbackErr.message);
      }
    }
  }
}

// Send photo safely to Telegram (handles local files, data URIs, and remote URLs)
async function sendSafeTelegramPhoto(target, chatIdOrNull, img, captionOrNull = null) {
  if (!img) return;
  try {
    let photoPayload = null;

    if (typeof img === 'string') {
      const trimmed = img.trim();
      if (trimmed.startsWith('data:image/')) {
        const base64Data = trimmed.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
        photoPayload = { source: Buffer.from(base64Data, 'base64') };
      } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        photoPayload = { url: trimmed };
      } else {
        // Resolve local file path
        const cleanPath = trimmed.replace(/^\//, '');
        const filename = path.basename(trimmed);
        const candidates = [
          trimmed,
          path.join(process.cwd(), cleanPath),
          path.join(process.cwd(), 'screenshots', filename),
          path.join(process.cwd(), 'backend', 'screenshots', filename),
          path.join(process.cwd(), '..', 'backend', 'screenshots', filename),
          path.resolve(process.cwd(), trimmed)
        ];
        for (const candidate of candidates) {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            photoPayload = { source: candidate };
            break;
          }
        }
      }
    } else if (Buffer.isBuffer(img)) {
      photoPayload = { source: img };
    }

    if (!photoPayload) {
      console.warn(`[Telegram Photo] Could not find or resolve image source: ${img}`);
      return;
    }

    const options = captionOrNull ? { caption: String(captionOrNull).substring(0, 1024) } : {};

    if (chatIdOrNull) {
      await target.sendPhoto(chatIdOrNull, photoPayload, options);
    } else if (typeof target.replyWithPhoto === 'function') {
      await target.replyWithPhoto(photoPayload, options);
    } else if (target.telegram && typeof target.telegram.sendPhoto === 'function' && lastTelegramChatId) {
      await target.telegram.sendPhoto(lastTelegramChatId, photoPayload, options);
    }
  } catch (err) {
    console.error(`[Telegram Photo] Failed to send photo: ${err.message}`);
  }
}

// Process and send full agent response to Telegram including text and photos
async function processTelegramAgentMessage(target, chatIdOrNull, data) {
  if (!data || data.isTool) return;

  const imagesToSend = [];
  if (Array.isArray(data.images)) {
    for (const img of data.images) {
      if (img && !imagesToSend.includes(img)) imagesToSend.push(img);
    }
  }

  let contentText = data.content || '';

  // Extract markdown images: ![alt](url)
  const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = mdImgRegex.exec(contentText)) !== null) {
    const imgUrl = match[2];
    if (imgUrl && !imagesToSend.includes(imgUrl)) {
      imagesToSend.push(imgUrl);
    }
  }

  // Remove markdown image syntax so Telegram doesn't display broken !screenshot text
  contentText = contentText.replace(mdImgRegex, '').trim();

  // Send text message if non-empty
  if (contentText && contentText.trim() !== '') {
    await sendSafeTelegramMessage(target, chatIdOrNull, contentText);
  }

  // Send photos as native Telegram images
  for (const img of imagesToSend) {
    await sendSafeTelegramPhoto(target, chatIdOrNull, img);
  }
}

// Keep-alive continuous chat action (Telegram actions expire after ~5s)
function startChatAction(ctx, initialAction = 'typing') {
  let currentAction = initialAction;
  let isStopped = false;

  const sendAction = () => {
    if (isStopped) return;
    ctx.sendChatAction(currentAction).catch(() => {});
  };

  sendAction();
  const intervalId = setInterval(sendAction, 4000);

  return {
    setAction: (newAction) => {
      if (isStopped || currentAction === newAction) return;
      currentAction = newAction;
      sendAction();
    },
    stop: () => {
      if (isStopped) return;
      isStopped = true;
      clearInterval(intervalId);
    }
  };
}

// Adaptive chat action based on agent logs/tools
function handleAdaptiveChatAction(actionCtrl, logData) {
  if (!actionCtrl || !logData) return;
  const msg = (logData.message || '').toLowerCase();
  const type = (logData.type || '').toLowerCase();

  if (type === 'tool_call' || type === 'system' || type === 'agent_thought') {
    if (msg.includes('generate_image') || msg.includes('screenshot') || msg.includes('photo') || msg.includes('browser_screenshot')) {
      actionCtrl.setAction('upload_photo');
    } else if (msg.includes('generate_speech') || msg.includes('tts') || msg.includes('voice') || msg.includes('google tts')) {
      actionCtrl.setAction('record_voice');
    } else if (msg.includes('file') || msg.includes('download') || msg.includes('export')) {
      actionCtrl.setAction('upload_document');
    } else {
      actionCtrl.setAction('typing');
    }
  }
}

let tgBot = null;
let lastTelegramChatId = null;
if (process.env.TELEGRAM_BOT_TOKEN) {
  tgBot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
}

// Detect BCP-47 language code and map to optimal Journey / Neural American English voices
function detectLangCode(text) {
  if (!text || typeof text !== 'string') {
    return { languageCode: 'en-US', name: process.env.GOOGLE_TTS_VOICE_EN || 'en-US-Journey-F' };
  }

  const t = text.toLowerCase();

  // Distinct, non-ambiguous word sets for language detection
  const itMatches = (t.match(/\b(perché|questo|questa|questi|queste|anche|grazie|prego|sono|siamo|hanno|abbiamo|tutto|tutti|ogni|molto|bene|male|adesso|oggi|domani|ieri|buongiorno|buonasera|arrivederci|allora|dunque|quindi|inoltre|sempre|niente|qualcosa)\b/g) || []).length;
  const esMatches = (t.match(/\b(porque|esto|esta|estos|estas|también|gracias|buenos|buenas|estamos|tienen|tenemos|todo|todos|cada|mucho|bien|ahora|hoy|mañana|ayer|hola|entonces|además|siempre|nada|algo|usted|ustedes)\b/g) || []).length;
  const frMatches = (t.match(/\b(parce|pourquoi|cette|aussi|merci|sommes|avons|tout|tous|chaque|beaucoup|bien|maintenant|aujourd'hui|demain|hier|bonjour|bonsoir|alors|donc|toujours|rien|quelque)\b/g) || []).length;
  const deMatches = (t.match(/\b(warum|weil|dieser|diese|dieses|auch|danke|bitte|sind|haben|alles|alle|jeder|sehr|gut|jetzt|heute|morgen|gestern|guten|immer|nichts|etwas)\b/g) || []).length;
  const enMatches = (t.match(/\b(the|is|are|was|were|have|has|had|will|would|could|should|with|from|this|that|these|those|what|when|where|which|who|how|why|because|about|into|more|some|such|than|them|their|there|today|yesterday|tomorrow|hello|welcome|assistant|please|thanks|thank)\b/g) || []).length;

  let lang = 'en';
  // Only switch away from American English if non-English matches distinctly outnumber English
  if (itMatches >= 3 && itMatches > enMatches * 1.5) lang = 'it';
  else if (esMatches >= 3 && esMatches > enMatches * 1.5) lang = 'es';
  else if (frMatches >= 3 && frMatches > enMatches * 1.5) lang = 'fr';
  else if (deMatches >= 3 && deMatches > enMatches * 1.5) lang = 'de';

  const itVoice = process.env.GOOGLE_TTS_VOICE_IT || 'it-IT-Journey-F';
  const enVoice = process.env.GOOGLE_TTS_VOICE_EN || 'en-US-Journey-F';
  const esVoice = process.env.GOOGLE_TTS_VOICE_ES || 'es-ES-Journey-F';
  const frVoice = process.env.GOOGLE_TTS_VOICE_FR || 'fr-FR-Journey-F';
  const deVoice = process.env.GOOGLE_TTS_VOICE_DE || 'de-DE-Journey-F';

  const voiceMap = {
    it: { languageCode: 'it-IT', name: itVoice },
    es: { languageCode: 'es-ES', name: esVoice },
    fr: { languageCode: 'fr-FR', name: frVoice },
    de: { languageCode: 'de-DE', name: deVoice },
    en: { languageCode: 'en-US', name: enVoice },
  };

  return voiceMap[lang] || voiceMap.en;
}

// Call Google Cloud TTS REST API with ultra-natural American English Journey/Studio voices
async function googleTTS(text) {
  const voice = detectLangCode(text);
  const speakingRate = parseFloat(process.env.GOOGLE_TTS_SPEAKING_RATE) || 1.0;
  const pitch = parseFloat(process.env.GOOGLE_TTS_PITCH) || 0.0;
  const effectsProfile = process.env.GOOGLE_TTS_EFFECTS_PROFILE || 'headphone-class-device';
  const gcpProject = process.env.GOOGLE_CLOUD_PROJECT || 'myllm-460104';

  // Get access token via gcloud ADC (same creds used by Vertex AI)
  const { stdout } = await execPromise('gcloud auth print-access-token');
  const accessToken = stdout.trim();

  const synthesize = async (voiceConfig) => {
    return fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Goog-User-Project': gcpProject,
        },
        body: JSON.stringify({
          input: { text },
          voice: voiceConfig,
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate,
            pitch,
            effectsProfileId: [effectsProfile],
          },
        }),
      }
    );
  };

  let res = await synthesize(voice);

  // Fallback to standard Neural2 voice if Journey voice is not supported
  if (!res.ok) {
    const langCode = voice.languageCode || 'en-US';
    const fallbackVoice = { languageCode: langCode, name: `${langCode}-Neural2-F` };
    console.warn(`[Google TTS] Voice ${voice.name} returned status ${res.status}. Falling back to ${fallbackVoice.name}`);
    res = await synthesize(fallbackVoice);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google TTS API error ${res.status}: ${err}`);
  }

  const json = await res.json();
  return { mp3Buffer: Buffer.from(json.audioContent, 'base64'), voice };
}

function parseLooseArgs(argStr) {
  if (!argStr) return {};
  if (typeof argStr === 'object') return argStr;
  if (typeof argStr !== 'string') return {};
  argStr = argStr.trim();
  try {
    return JSON.parse(argStr);
  } catch (e) {
    try {
      const fn = new Function('return (' + argStr + ')');
      return fn();
    } catch (e2) {
      const queryMatch = argStr.match(/query:\s*["'](.*?)["']/i);
      if (queryMatch) return { query: queryMatch[1] };
      return { raw: argStr };
    }
  }
}

function extractTextToolCalls(rawText, validToolNames = new Set()) {
  if (!rawText || typeof rawText !== 'string') return { cleanText: rawText, toolCalls: [] };
  
  const toolCalls = [];
  let cleanText = rawText;

  // Match all <tool_call ...>...</tool_call> blocks (using \b to avoid matching container <tool_calls>)
  const toolCallBlockRegex = /<tool_call\b([^>]*)>([\s\S]*?)<\/tool_call>/gi;
  let match;
  while ((match = toolCallBlockRegex.exec(rawText)) !== null) {
    const fullMatch = match[0];
    const tagAttrs = match[1] || '';
    const inner = (match[2] || '').trim();

    let name = '';
    const nameMatch = tagAttrs.match(/name=["']?([a-zA-Z0-9_-]+)["']?/i);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }

    let args = {};
    if (inner.startsWith('{')) {
      const parsed = parseLooseArgs(inner);
      if (!name && (parsed.name || parsed.tool || parsed.function)) {
        name = parsed.name || parsed.tool || parsed.function;
        args = parsed.arguments || parsed.parameters || parsed.args || parsed;
      } else {
        args = parsed;
      }
    } else {
      const funcMatch = inner.match(/^([a-zA-Z0-9_-]+)\s*\(([\s\S]*)\)$/);
      if (funcMatch) {
        if (!name) name = funcMatch[1].trim();
        args = parseLooseArgs(funcMatch[2]);
      } else {
        const words = inner.split(/\s+/);
        if (!name && words[0]) name = words[0];
        args = parseLooseArgs(inner.substring(name.length));
      }
    }

    if (name) {
      toolCalls.push({ name: String(name).trim(), args: parseLooseArgs(args) });
    }
    cleanText = cleanText.replace(fullMatch, '');
  }

  // Fallback 1: Code blocks ```tool_call ... ```
  const codeBlockPattern = /```(?:tool_call|tool_code|tool)\s*([\s\S]*?)```/gi;
  while ((match = codeBlockPattern.exec(cleanText)) !== null) {
    const [fullMatch, blockContent] = match;
    const parsed = parseLooseArgs(blockContent);
    if (parsed && (parsed.name || parsed.tool || parsed.function)) {
      const name = parsed.name || parsed.tool || parsed.function;
      const args = parsed.arguments || parsed.parameters || parsed.args || parsed;
      toolCalls.push({ name: String(name).trim(), args: parseLooseArgs(args) });
      cleanText = cleanText.replace(fullMatch, '');
    }
  }

  // Fallback 2: [TOOL_CALL: name(...)]
  const bracketPattern = /\[TOOL_CALL:\s*([a-zA-Z0-9_-]+)\s*\(([\s\S]*?)\)\]/gi;
  while ((match = bracketPattern.exec(cleanText)) !== null) {
    const [fullMatch, name, rawArgs] = match;
    const args = parseLooseArgs(rawArgs);
    toolCalls.push({ name: name.trim(), args });
    cleanText = cleanText.replace(fullMatch, '');
  }

  // Fallback 3: Bare JSON objects in text (e.g. {"action": "screenshot"} or {"action": "navigate", "url": "..."})
  if (toolCalls.length === 0) {
    const jsonBlockRegex = /\{[\s\r\n]*"(?:action|command|query|agentId|url|path|task|name)"[\s\S]*?\}/g;
    while ((match = jsonBlockRegex.exec(cleanText)) !== null) {
      const fullMatch = match[0];
      const parsed = parseLooseArgs(fullMatch);
      if (parsed && typeof parsed === 'object') {
        let inferredTool = '';
        if (parsed.name && (validToolNames.size === 0 || validToolNames.has(parsed.name))) {
          inferredTool = parsed.name;
        } else if (parsed.action && ['navigate', 'open', 'click', 'type', 'press', 'snapshot', 'screenshot', 'scroll', 'hover', 'tabs', 'close_tab', 'wait', 'reset', 'init'].includes(parsed.action)) {
          inferredTool = 'browser_control';
        } else if (parsed.action && ['query', 'insert', 'update', 'select_all', 'list_tables'].includes(parsed.action)) {
          inferredTool = 'supabase_action';
        } else if (parsed.command) {
          inferredTool = 'run_command';
        } else if (parsed.query && !parsed.action) {
          inferredTool = 'web_search';
        } else if (parsed.agentId && parsed.task) {
          inferredTool = 'spawn_agent';
        }

        if (inferredTool) {
          toolCalls.push({ name: inferredTool, args: parsed });
          cleanText = cleanText.replace(fullMatch, '');
        }
      }
    }
  }

  // Remove any outer <tool_calls>...</tool_calls> or stray tags
  cleanText = cleanText
    .replace(/<\/?(?:tool_calls|tools|tool_call|function_calls|function_call)[^>]*>/gi, '')
    .trim();

  return { cleanText, toolCalls };
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
          description: 'Read, write, or append to a file. CRITICAL: You are the developer. If the user asks for code, do NOT provide a "blueprint" or "conceptual" response. You MUST use this tool to write the ACTUAL source code to disk. Never ask the user to save a file; always do it yourself. This tool is authorized for all files including index.js, system.md, and .env. (Note: Any writes or appends to .env automatically protect and merge existing environment variables so credentials and keys are never wiped).',
          parameters: {
            type: 'OBJECT',
            properties: {
              action: { type: 'STRING', enum: ['read', 'write', 'append'], description: 'Action to perform ("read", "write", or "append")' },
              path: { type: 'STRING', description: 'Relative path from project root or absolute path' },
              content: { type: 'STRING', description: 'The file content to write or append. Ensure this is valid, functional code.' }
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
              query: { type: 'OBJECT', description: 'Query filter (for select) or data (for insert/update)' },
              projectId: { type: 'STRING', description: 'Optional project ID (e.g. "tra-montiemare", "rally-nyc") to query a specific project database instead of the active one' }
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
          name: 'send_telegram_notification',
          description: 'Send a proactive notification, editorial update, or status alert directly to the user via Telegram.',
          parameters: {
            type: 'OBJECT',
            properties: {
              message: { type: 'STRING', description: 'The markdown formatted message to send to the user on Telegram.' }
            },
            required: ['message']
          }
        },
        {
          name: 'web_search',
          description: 'Search the live web for current information. USE THIS STRICTLY FOR SEARCH ONLY. Do NOT use this when browsing, navigating, or interacting with specific sites/apps is needed (for that, you MUST use ego-lite via browser_control).',
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
              action: { type: 'STRING', enum: ['list', 'add', 'select', 'delete', 'sync_schema'], description: 'Action to perform. Use sync_schema to query Supabase and save the full table/column structure to the project context knowledge.' },
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
              cron: { type: 'STRING', description: 'Standard cron expression (e.g. "0 8 * * *" for 8am daily, or "0 9 */3 * *" for every 3 days)' },
              task: { type: 'STRING', description: 'The task description for the agent to execute when the job triggers' },
              agentId: { type: 'STRING', description: 'Optional agent ID to execute this job (e.g. "copy_editor_expert", "orchestrator")' }
            },
            required: ['action']
          }
        },
        {
          name: 'request_human_approval',
          description: 'Submit an action, drafted content (article, email, report), or decision to the human user for visual review, editing, approval, or rejection in the Operations Tracker.',
          parameters: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING', description: 'Brief title of what needs review/approval (e.g. "Calabria Article Draft Review", "Send Outbound Email")' },
              description: { type: 'STRING', description: 'Explanation of what was done and what the user is reviewing' },
              content: { type: 'STRING', description: 'The drafted content, markdown article, email text, or action payload to review/edit' },
              type: { type: 'STRING', enum: ['draft_review', 'action_approval', 'telegram_draft', 'email_draft', 'memory_update'], description: 'Category of approval request' }
            },
            required: ['title', 'content']
          }
        },
        ...Array.from(dynamicSkills.values()).map(s => s.declaration)
      ]
    }
  ];
}

async function executeTool(call, socket, sessionId = 'session_default') {
  const name = call.name;
  const args = call.args;
  const _t0 = Date.now();

  // Build a concise, human-readable args preview (truncate large strings)
  const _argsSummary = Object.entries(args || {}).map(([k, v]) => {
    const str = typeof v === 'string' ? v : JSON.stringify(v);
    return `${k}=${str.length > 120 ? str.substring(0, 120) + '…' : str}`;
  }).join(' | ');
  sendLog(socket, 'system', 'tool_start', `▶ ${name}${_argsSummary ? ' — ' + _argsSummary : ''}`, { tool: name, args, sessionId }, 'info', sessionId);

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
      let rawPath = (args.path || '').trim();
      let filePath = path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), rawPath);

      // Smart path resolution: check if rawPath points to a knowledge or context file without the prefix
      if (!fs.existsSync(filePath)) {
        const candidates = [
          path.join(process.cwd(), 'knowledge', rawPath),
          path.join(process.cwd(), 'backend', 'knowledge', rawPath),
          path.join(process.cwd(), 'context', rawPath),
          path.join(process.cwd(), 'context', 'projects', rawPath),
          path.join(process.cwd(), 'backend', 'context', 'projects', rawPath)
        ];
        const found = candidates.find(c => fs.existsSync(c));
        if (found) filePath = found;
      }

      if (args.action === 'read') {
        if (!fs.existsSync(filePath)) {
          return { error: `File not found: ${args.path}. (Note: Knowledge files are stored under 'knowledge/<project_id>/<file>.md')` };
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        return { content, path: filePath };
      } else {
        // If writing and file doesn't exist yet but user omitted 'knowledge/' prefix for known projects
        if (!fs.existsSync(filePath) && !rawPath.startsWith('knowledge/') && !rawPath.startsWith('context/')) {
          const knownProjects = ['tra-montiemare', 'rally_nyc', 'rally-nyc', 'overnight', 'general'];
          if (knownProjects.some(p => rawPath.startsWith(p))) {
            filePath = path.join(process.cwd(), 'knowledge', rawPath);
          }
        }
        // Ensure parent directory exists
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        const fileName = path.basename(filePath);
        const isEnvFile = fileName === '.env' || fileName.startsWith('.env.') || fileName.endsWith('.env');

        if (isEnvFile) {
          let existing = '';
          if (fs.existsSync(filePath)) {
            existing = fs.readFileSync(filePath, 'utf-8');
            try {
              fs.writeFileSync(`${filePath}.bak`, existing);
            } catch (err) {
              console.error('Failed to create .env backup:', err);
            }
          }
          const mergeResult = mergeEnvContent(existing, args.content || '');
          fs.writeFileSync(filePath, mergeResult.merged);
          return {
            status: `File ${fileName} safely updated and merged (${mergeResult.updatedCount} updated, ${mergeResult.addedCount} added, all existing keys preserved). Backup saved to ${fileName}.bak.`,
            path: filePath
          };
        }

        if (args.action === 'append') {
          if (fs.existsSync(filePath)) {
            const existing = fs.readFileSync(filePath, 'utf-8');
            const separator = existing.endsWith('\n') || !existing ? '' : '\n';
            fs.writeFileSync(filePath, existing + separator + (args.content || ''));
          } else {
            fs.writeFileSync(filePath, args.content || '');
          }
          return { status: `File ${path.basename(filePath)} appended successfully.`, path: filePath };
        }

        fs.writeFileSync(filePath, args.content || '');
        return { status: `File ${path.basename(filePath)} written successfully.`, path: filePath };
      }
    }
    if (name === 'supabase_action') {
      const creds = getProjectSupabaseCredentials(args.projectId);
      const supabaseUrl = (creds.url || '').replace(/\/+$/, '');
      const apiKey = creds.key;

      if (!supabaseUrl || !apiKey) {
        return { error: `No Supabase credentials configured in .env for project '${creds.id}'. Please check SUPABASE_URL_${creds.id.toUpperCase().replace(/[-/]/g, '_')}.` };
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, apiKey);
      const { action, table, query } = args;

      if (action === 'list_tables') {
        const response = await fetch(`${supabaseUrl}/rest/v1/`, {
          headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) {
          return { error: `Failed to fetch tables from Supabase (${response.status} ${response.statusText}). URL: ${supabaseUrl}/rest/v1/` };
        }
        const spec = await response.json();
        let tables = [];
        if (spec.definitions) {
          tables = Object.keys(spec.definitions);
        } else if (spec.components && spec.components.schemas) {
          tables = Object.keys(spec.components.schemas);
        } else if (spec.paths) {
          tables = Object.keys(spec.paths).map(p => p.replace(/^\//, '')).filter(p => p && p !== 'rpc');
        }
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
      if (action === 'update') {
        const { match, values } = query || {};
        if (!match || !values) {
          return { error: 'For update action, "query" must contain "match" (e.g. { id: "..." }) and "values" (e.g. { status: "published" }).' };
        }
        let q = supabase.from(table).update(values);
        Object.entries(match).forEach(([k, v]) => {
          q = q.eq(k, v);
        });
        const { data, error } = await q.select();
        if (error) throw error;
        return { data };
      }
      return { error: 'Unsupported supabase action' };
    }
    if (name === 'spawn_agent') {
      const { agentId, role, task } = args;
      sendLog(socket, 'orchestrator', 'system', `Spawning sub-agent: ${role} (${agentId})`);
      const agentData = { id: agentId, name: role, role: 'Sub-Agent', status: 'working', currentTask: task };
      activeAgents.set(agentId, agentData);
      dbPromise.then(db => db.run('INSERT OR REPLACE INTO active_agents (agentId, name, role, status) VALUES (?, ?, ?, ?)', [agentId, agentData.name, agentData.role, agentData.status]));
      io.emit('agent_spawned', { agentId, name: role, role: 'Sub-Agent', sessionId });
      io.emit('agent_status', { agentId, status: 'working', message: `Active: ${task ? task.substring(0, 70) : 'Processing sub-task...'}`, sessionId });
      broadcastTaskActivity('orchestrator', 'subagent_start', `Delegating to ${role} (${agentId}): "${task ? task.substring(0, 80) : ''}"`, { subAgentId: agentId, role, task, sessionId }, sessionId);
      
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
      
      const response = await subAgent.processMessage(`Your role is ${role}. Task: ${task}`, socket, process.env.DEFAULT_LLM_PROVIDER || 'ollama_cloud', [], sessionId);
      
      broadcastTaskActivity('orchestrator', 'subagent_end', `Sub-agent ${role} completed task`, { subAgentId: agentId, role, sessionId }, sessionId);
      if (activeAgents.has(agentId)) {
        activeAgents.get(agentId).status = 'idle';
      }
      io.emit('agent_status', { agentId, status: 'idle', message: '', sessionId });
      io.emit('active_agents', Array.from(activeAgents.values()));

      return { output: `Sub-agent ${role} finished task. Result: ${response || 'Task completed.'}` };
    }

    if (name === 'request_human_approval') {
      const { title, description, content, type = 'draft_review' } = args;
      const db = await dbPromise;
      const callerAgentId = (socket && socket.agentId) || 'orchestrator';
      const result = await db.run(
        'INSERT INTO pending_approvals (agentId, title, description, content, type, status) VALUES (?, ?, ?, ?, ?, ?)',
        [callerAgentId, title, description || '', content, type, 'pending']
      );
      const approval = {
        id: result.lastID,
        agentId: callerAgentId,
        title,
        description: description || '',
        content,
        type,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      io.emit('pending_approval_created', approval);
      getTrackerOverview().then(overview => io.emit('tracker_update', overview));
      sendLog(socket, callerAgentId, 'system', `Submitted item for user approval: "${title}" (Approval ID: #${approval.id})`, approval);
      
      // Update agent status to indicate it is waiting on approval
      if (activeAgents.has(callerAgentId)) {
        activeAgents.get(callerAgentId).status = 'waiting_approval';
        io.emit('agent_status', { agentId: callerAgentId, status: 'waiting_approval' });
        io.emit('active_agents', Array.from(activeAgents.values()));
      }
      
      return { 
        status: 'waiting_for_user_approval', 
        approvalId: approval.id, 
        message: `Approval request #${approval.id} "${title}" created and sent to the Visual Operations Tracker for human review.` 
      };
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

        const targetAgentId = args.agentId || 'orchestrator';
        const result = await db.run(
          'INSERT INTO scheduled_jobs (name, cron, task, agentId) VALUES (?, ?, ?, ?)',
          [jobName || 'Unnamed Job', cronExpr, task, targetAgentId]
        );
        
        const newJobId = result.lastID;
        scheduleCronJob(newJobId, cronExpr, task, jobName, targetAgentId);
        
        return { status: 'Job scheduled successfully', jobId: newJobId, agentId: targetAgentId };
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
          scheduleCronJob(jobId, job.cron, job.task, job.name, job.agentId || 'orchestrator');
        }
        
        return { status: `Job ${newStatus}`, jobId };
      }

      if (action === 'update' || action === 'edit') {
        if (!jobId) return { error: 'jobId is required for update' };
        const job = await db.get('SELECT * FROM scheduled_jobs WHERE id = ?', [jobId]);
        if (!job) return { error: 'Job not found' };

        const updatedName = jobName || job.name;
        const updatedCron = cronExpr || job.cron;
        const updatedTask = task || job.task;
        const updatedAgentId = args.agentId || job.agentId || 'orchestrator';

        if (cronExpr && !cron.validate(cronExpr)) return { error: 'Invalid cron expression' };

        await db.run(
          'UPDATE scheduled_jobs SET name = ?, cron = ?, task = ?, agentId = ? WHERE id = ?',
          [updatedName, updatedCron, updatedTask, updatedAgentId, jobId]
        );

        if (scheduledCronTasks.has(jobId)) {
          scheduledCronTasks.get(jobId).stop();
          scheduledCronTasks.delete(jobId);
        }

        if (job.status === 'active') {
          scheduleCronJob(jobId, updatedCron, updatedTask, updatedName, updatedAgentId);
        }

        const overview = await getTrackerOverview();
        io.emit('tracker_update', overview);

        return { status: 'Job updated successfully', jobId, job: { id: jobId, name: updatedName, cron: updatedCron, task: updatedTask, agentId: updatedAgentId, status: job.status } };
      }
    }

    if (name === 'manage_projects') {
      const { action, projectId, title, description } = args;
      if (action === 'list') {
        return { projects: projectData.projects };
      }
      if (action === 'add') {
        if (!projectId) return { error: 'projectId is required' };
        const newProject = { id: projectId, title: title || projectId, description: description || '' };
        projectData.projects.push(newProject);
        saveProjects();
        return { status: 'Project added', projectId };
      }
      if (action === 'delete') {
        if (!projectId) return { error: 'projectId is required' };
        projectData.projects = projectData.projects.filter(p => p.id !== projectId);
        saveProjects();
        return { status: 'Project deleted' };
      }
      if (action === 'sync_schema') {
        const creds = getProjectSupabaseCredentials(projectId || args.projectId);
        const supabaseUrl = (creds.url || '').replace(/\/+$/, '');
        const apiKey = creds.key;
        if (!supabaseUrl || !apiKey) return { error: `Supabase credentials not found in .env for project '${creds.id}'.` };

        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(supabaseUrl, apiKey);

        // Query information_schema for all public tables and their columns
        const { data: columns, error: colError } = await supabase
          .from('information_schema.columns')
          .select('table_name, column_name, data_type, is_nullable, column_default, ordinal_position')
          .eq('table_schema', 'public')
          .order('table_name')
          .order('ordinal_position');

        let tableMap = {};

        if (!colError && columns && columns.length > 0) {
          for (const col of columns) {
            if (!tableMap[col.table_name]) tableMap[col.table_name] = [];
            const nullable = col.is_nullable === 'YES' ? ' (nullable)' : '';
            const def = col.column_default ? ` DEFAULT ${col.column_default}` : '';
            tableMap[col.table_name].push(`  - \`${col.column_name}\` — ${col.data_type}${nullable}${def}`);
          }
        } else {
          // Fallback: use OpenAPI spec to at least get table names
          const specRes = await fetch(`${supabaseUrl}/rest/v1/`, {
            headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` }
          });
          if (specRes.ok) {
            const spec = await specRes.json();
            const tables = spec.definitions
              ? Object.keys(spec.definitions)
              : spec.components?.schemas
              ? Object.keys(spec.components.schemas)
              : spec.paths
              ? Object.keys(spec.paths).map(p => p.replace(/^\//, '')).filter(p => p && p !== 'rpc')
              : [];
            for (const t of tables) tableMap[t] = ['  - (column details unavailable — grant SELECT on information_schema)'];
          } else {
            return { error: `Could not fetch schema: ${colError?.message || 'unknown error'}` };
          }
        }

        const tableCount = Object.keys(tableMap).length;
        const now = new Date().toISOString();
        let schemaMarkdown = `## Database Schema\n> Auto-synced ${now} from ${supabaseUrl}\n\n`;
        for (const [table, cols] of Object.entries(tableMap)) {
          schemaMarkdown += `### \`${table}\`\n${cols.join('\n')}\n\n`;
        }

        // Write schema to Tier 3 Knowledge file
        try {
          const knowledgeProjDir = path.join(process.cwd(), 'knowledge', targetId);
          if (!fs.existsSync(knowledgeProjDir)) fs.mkdirSync(knowledgeProjDir, { recursive: true });
          const schemaKnowledgePath = path.join(knowledgeProjDir, 'database_schema.md');
          fs.writeFileSync(schemaKnowledgePath, `# ${proj.title || targetId}: Database Schema\n> Auto-synced ${now} from ${supabaseUrl}\n\n${schemaMarkdown}`);
        } catch (e) {
          console.error('[sync_schema] Error writing to knowledge directory:', e);
        }

        // Write/replace the Database Schema section in the project manifest/context file
        const manifestPath = path.join(process.cwd(), 'context', 'projects', `${targetId}.md`);
        const legacyCtxPath = path.join(process.cwd(), 'context', `${targetId}_context.md`);
        const ctxPath = fs.existsSync(manifestPath) ? manifestPath : legacyCtxPath;
        let ctx = fs.existsSync(ctxPath) ? fs.readFileSync(ctxPath, 'utf8') : `# Project: ${proj.title} Context\n`;
        ctx = ctx.replace(/\n## Database Schema[\s\S]*?(?=\n## |\n# |$)/g, '').trimEnd();
        fs.writeFileSync(ctxPath, ctx + '\n\n' + schemaMarkdown);
        console.log(`[sync_schema] Wrote schema for ${tableCount} tables to ${ctxPath}`);
        return { status: 'Schema synced successfully', project: targetId, tables: Object.keys(tableMap), tableCount };
      }
    }

    if (dynamicSkills.has(name)) {
      const skill = dynamicSkills.get(name);
      return await skill.execute({ ...args, sessionId });
    }
    if (name === 'browser_action') {
      const browserControl = dynamicSkills.get('browser_control');
      if (browserControl) {
        let cmd = args.command || '';
        if (cmd.startsWith('open ')) {
          const url = cmd.replace(/^open\s+["']?/, '').replace(/["']?$/, '');
          return await browserControl.execute({ action: 'navigate', url });
        } else if (cmd.includes('snapshot')) {
          return await browserControl.execute({ action: 'snapshot' });
        } else if (cmd.includes('screenshot')) {
          return await browserControl.execute({ action: 'screenshot', annotate: true });
        } else if (cmd.startsWith('click ')) {
          const selector = cmd.replace(/^click\s+["']?/, '').replace(/["']?$/, '');
          return await browserControl.execute({ action: 'click', selector });
        } else if (cmd.startsWith('fill ')) {
          const parts = cmd.split(' ');
          const selector = parts[1]?.replace(/["']/g, '');
          const text = parts.slice(2).join(' ').replace(/["']/g, '');
          return await browserControl.execute({ action: 'type', selector, text });
        }
        return await browserControl.execute({ action: 'snapshot' });
      }
      return { output: 'Browser control executed.' };
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
    if (name === 'send_telegram_notification') {
      const { message, imageUrl } = args;
      if (!message && !imageUrl) return { error: 'message or imageUrl is required' };
      if (!tgBot || !lastTelegramChatId) {
        sendLog(socket, 'system', 'warning', `Telegram bot is not connected or no active chat ID yet. Message logged locally.`);
        return { 
          status: 'logged_locally', 
          note: 'Telegram notification recorded. (Send /start to your bot on Telegram to receive live notifications)',
          message 
        };
      }
      try {
        await processTelegramAgentMessage(tgBot.telegram, lastTelegramChatId, {
          content: message,
          images: imageUrl ? [imageUrl] : []
        });
        sendLog(socket, 'system', 'telegram_sent', `Telegram notification delivered to chat ${lastTelegramChatId}`);
        return { success: true, deliveredTo: lastTelegramChatId };
      } catch (err) {
        return { error: `Failed to send Telegram message: ${err.message}` };
      }
    }
    if (name === 'web_search') {
      if (process.env.PARALLEL_API_KEY) {
        try {
          const res = await fetch('https://api.parallel.ai/v1/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.PARALLEL_API_KEY
            },
            body: JSON.stringify({
              objective: args.query,
              search_queries: [args.query],
              advanced_settings: {
                max_results: 5,
                excerpt_settings: {
                  max_chars_per_result: 10000
                }
              }
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.results && data.results.length > 0) {
              return {
                results: data.results.map(r => ({
                  title: r.title || 'Parallel Search Result',
                  url: r.url || '',
                  content: Array.isArray(r.excerpts) ? r.excerpts.join('\n\n') : ''
                }))
              };
            }
          }
        } catch (parallelErr) {
          console.warn('[Web Search] Parallel search error, attempting Tavily fallback:', parallelErr.message);
        }
      }

      if (tvly) {
        try {
          const result = await tvly.search(args.query, { searchDepth: 'advanced', maxResults: 5 });
          if (result && result.results && result.results.length > 0) {
            return { 
              results: result.results.map(r => ({ title: r.title, url: r.url, content: r.content })) 
            };
          }
        } catch (tavilyErr) {
          console.warn('[Web Search] Tavily search error, attempting Perplexity fallback:', tavilyErr.message);
        }
      }

      if (process.env.PERPLEXITY_API_KEY) {
        try {
          const res = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: 'sonar',
              messages: [
                { role: 'system', content: 'You are a web search assistant. Provide accurate, factual findings with details and citations.' },
                { role: 'user', content: args.query }
              ]
            })
          });
          if (res.ok) {
            const data = await res.json();
            const text = data.choices?.[0]?.message?.content || '';
            return {
              results: [
                {
                  title: `Search Findings: ${args.query}`,
                  url: 'https://perplexity.ai',
                  content: text
                }
              ]
            };
          }
        } catch (pplxErr) {
          console.error('[Web Search] Perplexity fallback error:', pplxErr);
        }
      }

      return { error: 'Web search unavailable: please check API configuration.' };
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

  async processMessage(userMessage, socket, provider = process.env.DEFAULT_LLM_PROVIDER || 'ollama_cloud', images = [], sessionId = 'session_default') {
    if (activeSessionRuns.has(sessionId)) {
      sendLog(socket, this.id, 'warning', `Session is already processing a task. Please wait.`, null, 'warning', sessionId);
      return;
    }

    let effectiveMessage = userMessage || '';
    if (effectiveMessage.startsWith('/ego ') || effectiveMessage.startsWith('/browse ')) {
      const rawPrompt = effectiveMessage.replace(/^(\/ego|\/browse)\s+/, '');
      effectiveMessage = `Use ego-browser in Ego Lite to execute the following task autonomously: ${rawPrompt}`;
    }

    const sessionAbort = new AbortController();
    this.abortController = sessionAbort;
    activeSessionRuns.set(sessionId, {
      sessionId,
      agentId: this.id,
      abortController: sessionAbort,
      startTime: Date.now(),
      status: 'working'
    });

    this.processing = true;
    if (activeAgents.has(this.id)) {
      activeAgents.get(this.id).status = 'working';
    }
    if (typeof io !== 'undefined') {
      io.emit('agent_status', { sessionId, agentId: this.id, status: 'working', message: 'Analyzing request and preparing plan...' });
      io.emit('session_working_status', { sessionId, isWorking: true });
      io.emit('active_agents', Array.from(activeAgents.values()));
    }
    broadcastTaskActivity(this.id, 'start', 'Analyzing user request & initializing execution plan...', { message: effectiveMessage.substring(0, 100), sessionId }, sessionId);
    
    // Ensure history is loaded
    if (!this.historyLoaded) {
      await this.historyPromise;
    }

    if (userMessage.trim() === '/compress') {
      await compressSession(socket, this.id);
      activeSessionRuns.delete(sessionId);
      if (typeof io !== 'undefined') {
        io.emit('agent_status', { sessionId, agentId: this.id, status: 'idle' });
        io.emit('session_working_status', { sessionId, isWorking: false });
      } else if (socket) {
        socket.emit('agent_status', { sessionId, agentId: this.id, status: 'idle' });
      }
      return;
    }

    if (userMessage.trim() === '/hosts' || userMessage.trim().startsWith('/hosts ') || userMessage.trim().startsWith('/host ')) {
      const isDryRun = userMessage.toLowerCase().includes('dry') || userMessage.toLowerCase().includes('simulate');
      const numMatch = userMessage.match(/\b(\d+)\b/);
      const maxPosts = numMatch ? parseInt(numMatch[1], 10) : 5;

      const targetSession = sessionId || 'session_default';
      sendLog(socket, this.id, 'system', `🚀 Starting Facebook Hosts Outreach task (Target: max ${maxPosts} offering posts, mode: ${isDryRun ? 'DRY-RUN' : 'LIVE'})...`, null, 'info', targetSession);
      if (typeof io !== 'undefined') {
        io.emit('agent_status', { sessionId: targetSession, agentId: this.id, status: 'working', message: 'Scanning Facebook group for host offerings...' });
      } else if (socket) {
        socket.emit('agent_status', { sessionId: targetSession, agentId: this.id, status: 'working', message: 'Scanning Facebook group for host offerings...' });
      }

      const skill = dynamicSkills.get('fb_hosts_outreach');
      if (skill) {
        try {
          const result = await skill.execute({
            maxPosts,
            dryRun: isDryRun,
            targetUrl: 'https://www.facebook.com/groups/325849768974770',
            commentText: 'dm plese! :)'
          }, (msg) => {
            sendLog(socket, this.id, 'browser', msg, null, 'info', targetSession);
          });

          await recordMessageInSession(targetSession, {
            role: 'assistant',
            agent_id: this.id,
            content: result.summary,
            is_tool: false
          });

          if (typeof io !== 'undefined') {
            io.emit('agent_message', {
              sessionId: targetSession,
              agentId: this.id,
              content: result.summary,
              isTool: false
            });
            io.emit('agent_status', { sessionId: targetSession, agentId: this.id, status: 'idle' });
          } else if (socket) {
            socket.emit('agent_message', {
              sessionId: targetSession,
              agentId: this.id,
              content: result.summary,
              isTool: false
            });
            socket.emit('agent_status', { sessionId: targetSession, agentId: this.id, status: 'idle' });
          }
        } catch (e) {
          const errorMsg = `❌ Facebook outreach error: ${e.message}`;
          sendLog(socket, this.id, 'error', errorMsg, null, 'error', targetSession);
          if (typeof io !== 'undefined') {
            io.emit('agent_message', {
              sessionId: targetSession,
              agentId: this.id,
              content: errorMsg,
              isTool: true
            });
            io.emit('agent_status', { sessionId: targetSession, agentId: this.id, status: 'idle' });
          } else if (socket) {
            socket.emit('agent_message', {
              sessionId: targetSession,
              agentId: this.id,
              content: errorMsg,
              isTool: true
            });
            socket.emit('agent_status', { sessionId: targetSession, agentId: this.id, status: 'idle' });
          }
        }
      } else {
        const errorMsg = `❌ fb_hosts_outreach skill not found.`;
        if (typeof io !== 'undefined') {
          io.emit('agent_message', { sessionId: targetSession, agentId: this.id, content: errorMsg, isTool: true });
          io.emit('agent_status', { sessionId: targetSession, agentId: this.id, status: 'idle' });
        } else if (socket) {
          socket.emit('agent_message', { sessionId: targetSession, agentId: this.id, content: errorMsg, isTool: true });
          socket.emit('agent_status', { sessionId: targetSession, agentId: this.id, status: 'idle' });
        }
      }

      activeSessionRuns.delete(sessionId);
      if (typeof io !== 'undefined') {
        io.emit('session_working_status', { sessionId, isWorking: false });
      }
      this.processing = false;
      return;
    }

    if (userMessage.trim() === '/help') {
      const helpMsg = {
        sessionId,
        agentId: this.id,
        content: `### 🛠️ Available Slash Commands\n\n- \`/hosts [count]\`: Scan FB Digital Nomad housing group & comment on host offerings to promote https://host.frastab.com/\n- \`/compress\`: Compress session history & prune bloated context\n- \`/new\`: Analyze session and reset workspace\n- \`/stop\`: Stop current generation immediately\n- \`/learn\`: Extract insights and architectural proposals\n- \`/ego <prompt>\`: Execute autonomous web task in Ego Lite browser\n- \`/help\`: Show available commands`,
        isTool: true
      };
      if (typeof io !== 'undefined') {
        io.emit('agent_message', helpMsg);
        io.emit('agent_status', { sessionId, agentId: this.id, status: 'idle' });
        io.emit('session_working_status', { sessionId, isWorking: false });
      } else if (socket) {
        socket.emit('agent_message', helpMsg);
        socket.emit('agent_status', { sessionId, agentId: this.id, status: 'idle' });
      }
      activeSessionRuns.delete(sessionId);
      return;
    }

    // Task Estimation Logic
    let estimatedSeconds = 15; // default base
    if (userMessage.toLowerCase().includes('search') || userMessage.toLowerCase().includes('research')) estimatedSeconds += 20;
    if (userMessage.toLowerCase().includes('browser') || userMessage.toLowerCase().includes('open')) estimatedSeconds += 30;
    if (userMessage.toLowerCase().includes('edit') || userMessage.toLowerCase().includes('file')) estimatedSeconds += 10;

    // Load session-specific conversation history from SQLite chat_messages
    let sessionHistory = [];
    try {
      const existingMsgs = await getSessionMessages(sessionId);
      existingMsgs.forEach(m => {
        if (m.role === 'user') {
          const userParts = [{ text: m.content || '' }];
          if (m.images && m.images.length > 0) {
            m.images.forEach(img => {
              const matches = img.match(/^data:(.+);base64,(.+)$/);
              if (matches && matches.length === 3) {
                userParts.push({ inlineData: { mimeType: matches[1], data: matches[2] } });
              }
            });
          }
          sessionHistory.push({ role: 'user', parts: userParts });
        } else if (m.role === 'assistant' && !m.isTool) {
          sessionHistory.push({ role: 'model', parts: [{ text: m.content || '' }] });
        }
      });
    } catch (e) {
      console.warn(`[Session ${sessionId}] Failed to load existing session messages:`, e);
    }

    const parts = [{ text: effectiveMessage }];
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

    if (sessionHistory.length === 0 || sessionHistory[sessionHistory.length - 1].parts[0]?.text !== effectiveMessage) {
      sessionHistory.push({ role: 'user', parts });
    }

    await this.saveToHistory('user', parts);
    if (socket) sendLog(socket, this.id, 'system', `User message received: ${userMessage.substring(0, 50)}... [Provider: ${provider}, Images: ${images.length}, Session: ${sessionId}]`, null, 'info', sessionId);

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
      
      // Tier 1: Core Baseline Context (universal session rules)
      let coreContext = '';
      try {
        const corePath = path.join(process.cwd(), 'context', 'core.md');
        const sysPath = path.join(process.cwd(), 'context', 'system.md');
        if (fs.existsSync(corePath)) {
          coreContext = `\n\n# CORE BASELINE CONTEXT\n${fs.readFileSync(corePath, 'utf8')}`;
        } else if (fs.existsSync(sysPath)) {
          coreContext = `\n\n# CORE BASELINE CONTEXT\n${fs.readFileSync(sysPath, 'utf8')}`;
        }
      } catch (e) {
        console.error('Failed to load core context:', e);
      }

      // Tier 2: Static Multi-Project Portfolio Index (stable for 100% prompt caching)
      const projectsIndex = (projectData.projects || []).map(p => `- **${p.id}** (${p.title}): ${p.description}`).join('\n');
      const portfolioContext = projectsIndex ? `\n\n# MANAGED PROJECTS PORTFOLIO\n${projectsIndex}\n\n*Note: To inspect or fetch in-depth project documentation, check-in guides, local info, schemas, or growth plans, use the 'get_project_knowledge' tool.*` : '';

      // Static system prompt — stable across calls so Vertex AI implicit prompt caching can hit.
      // Date, time, and current task are intentionally excluded here.
      const staticSystemPrompt = `${portfolioContext}${coreContext}\n\nAvailable Specialized Agents:\n${agentsList}\n\nAvailable Runtime Capabilities (${toolNames.length}):\n${toolsList}\n\nWhen the user asks about your skills/capabilities/tools, answer with this concrete runtime list and exact count (no generic explanations).\n\n${systemContent}\n\n${memoryContent}`;

      // Dynamic context injected into the conversation turn instead of the system instruction.
      // Only date (not time) is included to avoid busting the cache on every request.
      const dynamicContextText = `
# SYSTEM CONTEXT (DO NOT OVERWRITE)
Today is ${now}.
Active Projects: ${(projectData.projects || []).map(p => p.title).join(', ')}

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

      // Dynamic context and real-time history shrinker for context efficiency & token guardrails.
      // Automatically caps heavy tool outputs (preventing 400k+ token dumps), truncates older turns,
      // and compacts history when sessions grow long.
      const shrinkHistoryForContext = (history, dynamicContext) => {
        if (!history || history.length === 0) return history;
        const recentCount = 2; // Treat only the last 2 turns as immediate active context
        
        // Sliding window: if history exceeds 20 turns, keep first turn (mission/system context) + last 14 turns
        let processedHistory = history;
        if (history.length > 20) {
          const firstTurn = history[0];
          const secondTurn = history[1];
          const recentSlice = history.slice(-14);
          const omittedCount = history.length - 2 - 14;
          processedHistory = [
            firstTurn,
            secondTurn,
            {
              role: 'user',
              parts: [{ text: `[System Notice: ${omittedCount} earlier messages archived to maintain lean context and low latency]` }]
            },
            ...recentSlice
          ];
        }

        const total = processedHistory.length;

        return processedHistory.map((h, idx) => {
          const isRecent = idx >= total - recentCount;
          const isFirst = idx === 0;

          let parts = (h.parts || []).map(p => {
            if (p.functionResponse) {
              let resp = p.functionResponse.response;
              let respStr = typeof resp === 'string' ? resp : JSON.stringify(resp);
              
              if (isRecent) {
                // Cap active tool outputs to 3500 chars (~800 tokens max)
                if (respStr && respStr.length > 3500) {
                  return {
                    functionResponse: {
                      name: p.functionResponse.name,
                      response: { output: respStr.substring(0, 3500) + '\n... [Tool output truncated to 3500 chars to conserve context. Full execution details saved in database/artifacts]' }
                    }
                  };
                }
                return p;
              }

              // Older tool outputs truncated to compact 200 chars
              if (respStr && respStr.length > 300) {
                return {
                  functionResponse: {
                    name: p.functionResponse.name,
                    response: { output: respStr.substring(0, 200) + '\n... [Historical tool output summarized for token optimization]' }
                  }
                };
              }
              return p;
            }

            if (p.text) {
              if (isRecent) {
                if (p.text.length > 6000) {
                  return {
                    text: p.text.substring(0, 6000) + '\n... [Output truncated for active context efficiency]'
                  };
                }
                return p;
              }
              if (p.text.length > 600) {
                return {
                  text: p.text.substring(0, 400) + '\n... [Historical turn condensed for token optimization]'
                };
              }
              return p;
            }

            if (p.inlineData) {
              if (isRecent) return p;
              return {
                text: `[Attached image: ${p.inlineData.mimeType || 'image/png'} (Omitted in historical turns to conserve context)]`
              };
            }

            return p;
          });

          if (isFirst && h.role === 'user' && dynamicContext) {
            parts = [{ text: dynamicContext + '\n\n---\n\n' }, ...parts];
          }

          return { ...h, parts };
        });
      };

      this.shouldStop = false;
      const collectedImages = [];
      const accumulatedUsage = {
        promptTokens: 0,
        candidatesTokens: 0,
        totalTokens: 0,
        durationMs: 0
      };

      // Dynamic Auto-Router Evaluation
      let effectiveProvider = provider || process.env.DEFAULT_LLM_PROVIDER || 'auto';
      let routingInfo = null;

      if (!effectiveProvider || effectiveProvider === 'auto' || effectiveProvider === 'auto_hybrid' || effectiveProvider.startsWith('auto:')) {
        routingInfo = routeTask({
          message: effectiveMessage,
          history: sessionHistory,
          images,
          agentId: this.id,
          channel: 'web',
          requestedProvider: effectiveProvider
        });
        effectiveProvider = routingInfo.provider;
        console.log(`[Auto-Router] Agent "${this.id}" routed to: ${effectiveProvider} (${routingInfo.reason})`);
        if (socket) {
          sendLog(
            socket,
            this.id,
            'api_request',
            `⚡ [Auto-Router] Selected ${getFriendlyModelName(effectiveProvider)} • Category: ${routingInfo.category.toUpperCase()} • Rationale: ${routingInfo.reason}`,
            null,
            'info',
            sessionId
          );
        }
      }

      if (effectiveProvider === 'perplexity') {
        effectiveProvider = 'gemini';
      }
      provider = effectiveProvider;

      let turnCount = 0;
      let consecutiveTextOnlyTurns = 0; // FIX: track reassurance-loop depth
      let hasEmittedFinalMessage = false;
      const executedActions = [];
      const MAX_TURNS = parseInt(process.env.AGENT_MAX_TURNS || '100', 10);
      while (turnCount < MAX_TURNS && !this.shouldStop && !sessionAbort.signal.aborted) {
        turnCount++;
        const providerNameMap = {
          'auto': 'Smart Hybrid Auto-Router',
          'auto_hybrid': 'Smart Hybrid Auto-Router',
          'ollama_cloud': `Ollama Cloud (${process.env.OLLAMA_CLOUD_MODEL || 'nemotron-3-nano:30b'})`,
          'gemini': 'Google Gemini (Native)',
          'gemini_api': 'Google Gemini (API Key)',
          'vertex_research': 'Google Vertex AI (Research)',
          'digitalocean': 'DigitalOcean Inference',
          'ollama': 'Local Ollama',
          'ollama_qwen': 'Local Ollama (Qwen)'
        };
        const displayName = providerNameMap[provider] || 
          (provider.startsWith('ollama_cloud:') ? `Ollama Cloud (${provider.substring(13)})` :
          (provider.startsWith('ollama:') ? `Local Ollama (${provider.substring(7)})` : 
          (provider.startsWith('do:') ? `DigitalOcean (${provider.substring(3)})` :
          (provider.startsWith('ollama') ? 'Local Ollama' : provider))));
        if (socket) sendLog(socket, this.id, 'api_request', `Generating content (turn ${turnCount}) using ${displayName}`, null, 'info', sessionId);
        
        if (typeof io !== 'undefined') {
          io.emit('agent_status', { 
            sessionId,
            agentId: this.id, 
            status: 'working', 
            message: `Routing inference via ${displayName} (turn ${turnCount})...`,
            step: turnCount
          });
        }
        broadcastTaskActivity(this.id, 'llm_start', `Querying ${displayName} (turn ${turnCount})...`, { provider, turn: turnCount, sessionId }, sessionId);
        
        const __llmStartTime = Date.now();
        let response;
        if (provider === 'gemini' || provider === 'gemini_api' || provider.startsWith('gemini:') || provider.startsWith('gemini_api:')) {
          const requestedGeminiModel = provider.startsWith('gemini:')
            ? provider.substring(7)
            : (provider.startsWith('gemini_api:') ? provider.substring(11) : 'gemini-3.7-flash');

          if (hasGeminiKey()) {
            // Google AI Studio execution via GEMINI_API_KEY
            const toolDeclarations = [{ functionDeclarations: getToolDeclarations()[0].functionDeclarations }];
            const gemResult = await generateGeminiContent({
              contents: shrinkHistoryForContext(sessionHistory, dynamicContextText),
              model: requestedGeminiModel,
              systemInstruction: staticSystemPrompt,
              tools: toolDeclarations,
              signal: sessionAbort.signal
            });

            response = {
              functionCalls: gemResult.functionCalls,
              text: gemResult.text,
              originalParts: gemResult.originalParts,
              model: gemResult.model,
              usage: gemResult.usage
            };
          } else {
            // Vertex AI fallback
            const model = vertexAI.preview.getGenerativeModel({
              model: 'gemini-2.5-flash', 
              tools: [{ functionDeclarations: getToolDeclarations()[0].functionDeclarations }]
            });

            const generatePromise = model.generateContent({
              contents: shrinkHistoryForContext(sessionHistory, dynamicContextText),
              systemInstruction: {
                role: 'system',
                parts: [{ text: staticSystemPrompt }]
              }
            });
            
            const timeoutPromise = new Promise((_, reject) => {
              const id = setTimeout(() => reject(new Error('Vertex AI API timeout (300s)')), 300000);
              sessionAbort.signal.addEventListener('abort', () => {
                clearTimeout(id);
                reject(new Error('Vertex AI request cancelled by user'));
              });
            });

            const result = await Promise.race([generatePromise, timeoutPromise]);

            const candidates = result.response.candidates;
            if (!candidates || candidates.length === 0) throw new Error('No candidates returned from Vertex AI');
            
            const firstCandidate = candidates[0]?.content;
            const candidateParts = firstCandidate?.parts || [];
            let functionCalls = candidateParts.filter(p => p && p.functionCall).map(p => p.functionCall);
            let text = candidateParts.filter(p => p && p.text).map(p => p.text).join('\n');
            let originalParts = candidateParts;
            let usageMeta = result.response.usageMetadata;

            response = {
              functionCalls: functionCalls.length > 0 ? functionCalls : null,
              text: text,
              originalParts: originalParts,
              model: 'gemini-2.5-flash',
              usage: {
                promptTokens: usageMeta?.promptTokenCount || 0,
                candidatesTokens: usageMeta?.candidatesTokenCount || 0,
                totalTokens: usageMeta?.totalTokenCount || 0
              }
            };
          }
        } else if (provider === 'digitalocean' || provider.startsWith('do')) {
          const doApiKey = process.env.DIGITAL_OCEAN_API_KEY || process.env.DO_INFERENCE_API_KEY;
          if (!doApiKey) {
            throw new Error('DIGITAL_OCEAN_API_KEY is not configured in backend/.env');
          }

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
            function: {
              name: fd.name,
              description: fd.description,
              parameters: convertSchema(fd.parameters)
            }
          }));

          const messages = [
            { role: 'system', content: staticSystemPrompt + '\n\n' + dynamicContextText }
          ];

          shrinkHistoryForContext(sessionHistory, '').forEach((h, hIdx) => {
            const textParts = h.parts.filter(p => p.text).map(p => p.text).join('\n');
            if (h.role === 'user') {
              const fnResponses = h.parts.filter(p => p.functionResponse);
              if (fnResponses.length > 0) {
                fnResponses.forEach((fr, frIdx) => {
                  messages.push({
                    role: 'tool',
                    tool_call_id: `call_${hIdx}_${frIdx}_${fr.functionResponse.name}`,
                    content: typeof fr.functionResponse.response === 'string' ? fr.functionResponse.response : JSON.stringify(fr.functionResponse.response)
                  });
                });
              } else if (textParts) {
                messages.push({ role: 'user', content: textParts });
              }
            } else if (h.role === 'model') {
              const fnCalls = h.parts.filter(p => p.functionCall);
              if (fnCalls.length > 0) {
                messages.push({
                  role: 'assistant',
                  content: textParts || null,
                  tool_calls: fnCalls.map((fc, fcIdx) => ({
                    id: `call_${hIdx}_${fcIdx}_${fc.functionCall.name}`,
                    type: 'function',
                    function: {
                      name: fc.functionCall.name,
                      arguments: typeof fc.functionCall.args === 'string' ? fc.functionCall.args : JSON.stringify(fc.functionCall.args)
                    }
                  }))
                });
              } else if (textParts) {
                messages.push({ role: 'assistant', content: textParts });
              }
            }
          });

          let targetModel = provider.startsWith('do:') 
            ? provider.substring(3) 
            : (process.env.DO_ROUTER_MODEL || 'router:general');

          if (targetModel === 'frassistrouter') {
            targetModel = 'router:frassistrouter';
          } else if (targetModel === 'general') {
            targetModel = 'router:general';
          }

          const doPayload = {
            model: targetModel,
            messages,
            ...(agentTools.length > 0 ? { tools: agentTools } : {})
          };

          const getDoSignal = () => this.abortController 
            ? AbortSignal.any([this.abortController.signal, AbortSignal.timeout(180000)])
            : AbortSignal.timeout(180000);

          let doRes = await fetch(process.env.DO_INFERENCE_URL || 'https://inference.do-ai.run/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${doApiKey}`
            },
            body: JSON.stringify(doPayload),
            signal: getDoSignal()
          });

          // Tier 1 Fallback: If custom router returns 404 (e.g. prompt out of domain), fallback to router:general
          if (!doRes.ok && doRes.status === 404 && targetModel !== 'router:general') {
            console.warn(`[DigitalOcean] Model ${targetModel} returned 404. Falling back to router:general...`);
            if (socket) sendLog(socket, this.id, 'system', `DO Router "${targetModel}" not matched. Failing over to router:general`, null, 'warning', sessionId);
            doPayload.model = 'router:general';
            doRes = await fetch(process.env.DO_INFERENCE_URL || 'https://inference.do-ai.run/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doApiKey}`
              },
              body: JSON.stringify(doPayload),
              signal: getDoSignal()
            });
          }

          // Tier 2 Fallback: If router:general returns 404 or error, fallback to direct direct model openai-gpt-oss-120b
          if (!doRes.ok && doPayload.model !== 'openai-gpt-oss-120b') {
            console.warn(`[DigitalOcean] Router returned ${doRes.status}. Falling back to openai-gpt-oss-120b...`);
            if (socket) sendLog(socket, this.id, 'system', `Failing over to DO openai-gpt-oss-120b`, null, 'warning', sessionId);
            doPayload.model = 'openai-gpt-oss-120b';
            if (agentTools.length > 0) doPayload.tools = agentTools;
            doRes = await fetch(process.env.DO_INFERENCE_URL || 'https://inference.do-ai.run/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doApiKey}`
              },
              body: JSON.stringify(doPayload),
              signal: getDoSignal()
            });
          }

          if (!doRes.ok) {
            const errText = await doRes.text();
            throw new Error(`DigitalOcean Router Error (${doRes.status}): ${errText}`);
          }

          const doData = await doRes.json();
          const servedModel = doData.model || targetModel;
          const selectedRoute = doRes.headers.get('x-model-router-selected-route');
          const upstreamTime = doRes.headers.get('do-upstream-service-time');

          if (socket) {
            sendLog(socket, this.id, 'system', `⚡ DigitalOcean served by: ${servedModel}${selectedRoute ? ` [Route: ${selectedRoute}]` : ''}${upstreamTime ? ` (${upstreamTime}ms)` : ''}`, null, 'info', sessionId);
          }

          const choice = doData.choices?.[0]?.message;
          let functionCalls = (choice?.tool_calls || []).map(tc => ({
            name: tc.function?.name,
            args: typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function?.arguments
          }));

          let rawText = choice?.content || '';

          // Fallback: If no native tool_calls, extract text-based tool calls or bare JSON
          if (functionCalls.length === 0 && rawText.trim() !== '') {
            const validToolNames = new Set(getToolDeclarations()[0].functionDeclarations.map(fd => fd.name));
            const extracted = extractTextToolCalls(rawText, validToolNames);
            if (extracted.toolCalls.length > 0) {
              functionCalls = extracted.toolCalls;
              rawText = extracted.cleanText;
              console.log(`[DigitalOcean Text Tool Calls Extracted] Found ${functionCalls.length} tool(s):`, functionCalls.map(f => f.name));
              if (socket) sendLog(socket, this.id, 'system', `⚡ Extracted tool call: ${functionCalls.map(f => f.name).join(', ')}`, null, 'info', sessionId);
            }
          }

          const pIn = doData.usage?.prompt_tokens 
            || doData.usage?.input_tokens 
            || estimateTokens(messages.map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n'));
          const pOut = doData.usage?.completion_tokens 
            || doData.usage?.output_tokens 
            || estimateTokens(rawText);
          const pTotal = doData.usage?.total_tokens || (pIn + pOut);

          response = {
            functionCalls: functionCalls.length > 0 ? functionCalls : null,
            text: rawText,
            model: servedModel,
            usage: {
              promptTokens: pIn,
              candidatesTokens: pOut,
              totalTokens: pTotal
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
          shrinkHistoryForContext(sessionHistory, '').forEach((h, hIdx) => {
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
            }),
            signal: this.abortController 
              ? AbortSignal.any([this.abortController.signal, AbortSignal.timeout(180000)])
              : AbortSignal.timeout(180000)
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
            model: 'sonar',
            usage: {
              promptTokens: data.usage?.input_tokens || 0,
              candidatesTokens: data.usage?.output_tokens || 0,
              totalTokens: data.usage?.total_tokens || 0
            }
          };
        } else if (provider === 'ollama_cloud' || provider.startsWith('ollama_cloud:')) {
          const ollamaModel = provider.startsWith('ollama_cloud:') 
            ? provider.substring(13) 
            : (process.env.OLLAMA_CLOUD_MODEL || 'nemotron-3-nano:30b');

          const mappedHistory = shrinkHistoryForContext(sessionHistory, '').map((h, hIdx) => {
            if (h.role === 'user') {
              if (h.parts[0]?.functionResponse) {
                return { 
                  role: 'tool', 
                  content: typeof h.parts[0].functionResponse.response === 'string' ? h.parts[0].functionResponse.response : JSON.stringify(h.parts[0].functionResponse.response),
                  tool_call_id: `call_${hIdx - 1}_0_${h.parts[0].functionResponse.name}`
                };
              }
              const userText = h.parts.filter(p => p.text).map(p => p.text).join('\n');
              return { role: 'user', content: userText || '' };
            }
            if (h.role === 'model') {
              const fnCalls = h.parts.filter(p => p.functionCall);
              if (fnCalls.length > 0) {
                return { role: 'assistant', tool_calls: fnCalls.map((p, pIdx) => ({ 
                  id: `call_${hIdx}_${pIdx}_${p.functionCall.name}`,
                  type: 'function',
                  function: { 
                    name: p.functionCall.name, 
                    arguments: typeof p.functionCall.args === 'string' ? JSON.parse(p.functionCall.args) : p.functionCall.args 
                  } 
                })), content: '' };
              }
              const modelText = h.parts.filter(p => p.text).map(p => p.text).join('\n');
              return { role: 'assistant', content: modelText || '' };
            }
            return { role: 'user', content: '' };
          });

          let lastUserIdx = -1;
          for (let i = mappedHistory.length - 1; i >= 0; i--) {
            if (mappedHistory[i].role === 'user') {
              lastUserIdx = i;
              break;
            }
          }

          if (lastUserIdx !== -1 && dynamicContextText) {
            mappedHistory[lastUserIdx].content = `[System Context Update]\n${dynamicContextText}\n\n[User Query]\n${mappedHistory[lastUserIdx].content}`;
          }

          let ollamaSystemPrompt = staticSystemPrompt;
          if (ollamaSystemPrompt.length > 6000) {
            const recentMemory = memoryContent.length > 2000 ? memoryContent.slice(-2000) : memoryContent;
            ollamaSystemPrompt = `${portfolioContext}${coreContext}\n\nAvailable Specialized Agents:\n${agentsList}\n\nAvailable Runtime Capabilities (${toolNames.length}):\n${toolsList}\n\n${systemContent}\n\n# Long-term Memory (Recent Summary)\n${recentMemory}`;
          }

          const ollamaMessages = [
            { role: 'system', content: ollamaSystemPrompt },
            ...mappedHistory
          ];

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

          const ollamaTools = getToolDeclarations()[0].functionDeclarations.map(fd => ({
            type: 'function',
            function: {
              name: fd.name,
              description: fd.description,
              parameters: convertSchema(fd.parameters)
            }
          }));

          if (typeof io !== 'undefined') {
            io.emit('agent_status', { sessionId, agentId: this.id, status: 'working', message: `Thinking with Ollama Cloud (${ollamaModel})...` });
          } else if (socket) {
            socket.emit('agent_status', { sessionId, agentId: this.id, status: 'working', message: `Thinking with Ollama Cloud (${ollamaModel})...` });
          }
          if (socket) {
            sendLog(socket, this.id, 'api_request', `Ollama Cloud Request: ${ollamaModel} (${ollamaMessages.length} messages)`, null, 'info', sessionId);
          }
          
          if (sessionAbort.signal.aborted || this.shouldStop) {
            throw new Error('Ollama Cloud request cancelled or timed out');
          }

          this.abortController = new AbortController();
          const abortListener = () => this.abortController?.abort();
          sessionAbort.signal.addEventListener('abort', abortListener, { once: true });
          const timeoutId = setTimeout(() => this.abortController?.abort(), 300000);
          const activityInterval = setInterval(() => {
            this.lastActivity = Date.now();
          }, 10000);
          
          let res;
          try {
            res = await fetchOllamaCloudWithFailover('https://ollama.com/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: ollamaModel,
                messages: ollamaMessages,
                tools: ollamaTools,
                stream: false,
                options: { num_ctx: 131072 } // Maximize context window
              }),
              signal: this.abortController.signal
            }, {
              logTag: `Agent ${this.id} (Ollama Cloud)`,
              onFailover: (info) => {
                console.warn(`[Ollama Cloud] Primary API key failed (${info.status}). Automatically failing over to backup key (OLLAMA_API_KEY_2)...`);
                if (socket) {
                  sendLog(socket, this.id, 'system', `⚠️ Primary Ollama Cloud key limit/error reached (${info.status || 'quota'}). Switched over to backup key (OLLAMA_API_KEY_2)!`, null, 'warning', sessionId);
                }
              }
            });
          } catch (err) {
            if (this.shouldStop || err.name === 'AbortError' || sessionAbort.signal.aborted) {
              throw new Error('Ollama Cloud request cancelled or timed out');
            }
            throw err;
          } finally {
            clearTimeout(timeoutId);
            clearInterval(activityInterval);
            sessionAbort.signal.removeEventListener('abort', abortListener);
          }
          
          const result = await res.json();
          const content = result.message?.content || '';
          const thinking = result.message?.thinking || '';
          let resolvedText = content.trim() !== '' ? content : (thinking.trim() !== '' ? thinking : '');

          let functionCalls = result.message?.tool_calls?.map(tc => ({
            name: tc.function.name,
            args: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments
          })) || [];

          if (functionCalls.length === 0 && resolvedText.trim() !== '') {
            const validToolNames = new Set(getToolDeclarations()[0].functionDeclarations.map(fd => fd.name));
            const extracted = extractTextToolCalls(resolvedText, validToolNames);
            if (extracted.toolCalls.length > 0) {
              functionCalls = extracted.toolCalls;
              resolvedText = extracted.cleanText;
              console.log(`[Ollama Cloud Text Tool Calls Extracted] Found ${functionCalls.length} tool(s):`, functionCalls.map(f => f.name));
              if (socket) sendLog(socket, this.id, 'system', `⚡ Extracted tool call: ${functionCalls.map(f => f.name).join(', ')}`);
            }
          }

          response = {
            functionCalls: functionCalls.length > 0 ? functionCalls : null,
            text: resolvedText,
            model: `ollama_cloud/${ollamaModel}`,
            usage: {
              promptTokens: result.prompt_eval_count || 0,
              candidatesTokens: result.eval_count || 0,
              totalTokens: (result.prompt_eval_count || 0) + (result.eval_count || 0)
            }
          };
        } else {
          // Resolve Ollama model dynamically
          let requestedModel = 'auto';
          if (provider === 'ollama_qwen') requestedModel = 'qwen2.5-coder:14b';
          else if (provider.startsWith('ollama:')) requestedModel = provider.substring(7);
          else if (provider !== 'ollama') requestedModel = provider;

          let ollamaModel = requestedModel;

          // Query Ollama for available models to ensure the requested model exists or resolve fallback
          try {
            const tagsRes = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
            if (tagsRes.ok) {
              const tagsData = await tagsRes.json();
              const installedModels = (tagsData.models || []).map(m => m.name);
              
              if (installedModels.length > 0) {
                if (requestedModel === 'auto' || requestedModel === 'ollama') {
                  // Default to first available model or qwen/gemma if present
                  const preferred = installedModels.find(m => m.includes('gemma4') || m.includes('qwen2.5')) || installedModels[0];
                  ollamaModel = preferred;
                } else if (!installedModels.includes(requestedModel)) {
                  // Try to find a partial match (e.g. 'gemma4' matching 'gemma4:latest')
                  const match = installedModels.find(m => m === requestedModel || m.startsWith(`${requestedModel}:`) || m.split(':')[0] === requestedModel.split(':')[0]);
                  if (match) {
                    ollamaModel = match;
                  } else {
                    ollamaModel = installedModels[0];
                  }
                }
              }
            }
          } catch (e) {
            console.warn('Could not query Ollama tags for model resolution:', e.message);
          }

          const mappedHistory = shrinkHistoryForContext(sessionHistory, '').map((h, hIdx) => {
            if (h.role === 'user') {
              if (h.parts[0]?.functionResponse) {
                return { 
                  role: 'tool', 
                  content: typeof h.parts[0].functionResponse.response === 'string' ? h.parts[0].functionResponse.response : JSON.stringify(h.parts[0].functionResponse.response),
                  tool_call_id: `call_${hIdx - 1}_0_${h.parts[0].functionResponse.name}`
                };
              }
              const userText = h.parts.filter(p => p.text).map(p => p.text).join('\n');
              return { role: 'user', content: userText || '' };
            }
            if (h.role === 'model') {
              const fnCalls = h.parts.filter(p => p.functionCall);
              if (fnCalls.length > 0) {
                return { role: 'assistant', tool_calls: fnCalls.map((p, pIdx) => ({ 
                  id: `call_${hIdx}_${pIdx}_${p.functionCall.name}`,
                  type: 'function',
                  function: { 
                    name: p.functionCall.name, 
                    arguments: typeof p.functionCall.args === 'string' ? JSON.parse(p.functionCall.args) : p.functionCall.args 
                  } 
                })) };
              }
              const modelText = h.parts.filter(p => p.text).map(p => p.text).join('\n');
              return { role: 'assistant', content: modelText || '' };
            }
            return { role: h.role, content: h.parts?.[0]?.text || '' };
          });

          // Inject dynamic context into the very last user message to preserve KV cache for history
          let lastUserIdx = -1;
          for (let i = mappedHistory.length - 1; i >= 0; i--) {
            if (mappedHistory[i].role === 'user') {
              lastUserIdx = i;
              break;
            }
          }
          if (lastUserIdx !== -1 && dynamicContextText) {
            mappedHistory[lastUserIdx].content = `[System Context Update]\n${dynamicContextText}\n\n[User Query]\n${mappedHistory[lastUserIdx].content}`;
          }

          let ollamaSystemPrompt = staticSystemPrompt;
          if (ollamaSystemPrompt.length > 6000) {
            // Trim memory for local inference speed while retaining core instructions & context
            const recentMemory = memoryContent.length > 2000 ? memoryContent.slice(-2000) : memoryContent;
            ollamaSystemPrompt = `${portfolioContext}${coreContext}\n\nAvailable Specialized Agents:\n${agentsList}\n\nAvailable Runtime Capabilities (${toolNames.length}):\n${toolsList}\n\n${systemContent}\n\n# Long-term Memory (Recent Summary)\n${recentMemory}`;
          }

          const ollamaMessages = [
            { role: 'system', content: ollamaSystemPrompt },
            ...mappedHistory
          ];

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

          const ollamaTools = getToolDeclarations()[0].functionDeclarations.map(fd => ({
            type: 'function',
            function: {
              name: fd.name,
              description: fd.description,
              parameters: convertSchema(fd.parameters)
            }
          }));

          if (typeof io !== 'undefined') {
            io.emit('agent_status', { sessionId, agentId: this.id, status: 'working', message: `Thinking with Ollama (${ollamaModel})...` });
          } else if (socket) {
            socket.emit('agent_status', { sessionId, agentId: this.id, status: 'working', message: `Thinking with Ollama (${ollamaModel})...` });
          }
          if (socket) {
            sendLog(socket, this.id, 'api_request', `Ollama Request: ${ollamaModel} (${ollamaMessages.length} messages)`, null, 'info', sessionId);
          }
          
          if (sessionAbort.signal.aborted || this.shouldStop) {
            throw new Error('Ollama request cancelled or timed out');
          }

          this.abortController = new AbortController();
          const abortListener = () => this.abortController?.abort();
          sessionAbort.signal.addEventListener('abort', abortListener, { once: true });
          const timeoutId = setTimeout(() => this.abortController?.abort(), 300000); // 300s timeout (allows model load + long generation)
          const activityInterval = setInterval(() => {
            this.lastActivity = Date.now();
          }, 10000);
          
          let res;
          try {
            res = await fetch('http://localhost:11434/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: ollamaModel,
                messages: ollamaMessages,
                tools: ollamaTools,
                stream: false
              }),
              signal: this.abortController.signal
            });
          } catch (err) {
            if (this.shouldStop || err.name === 'AbortError' || sessionAbort.signal.aborted) {
              throw new Error('Ollama request cancelled or timed out');
            }
            if (err.cause?.code === 'ECONNREFUSED' || err.message?.includes('fetch failed')) {
              throw new Error('Ollama server is not reachable at http://localhost:11434. Please ensure Ollama is running (`ollama serve`).');
            }
            throw err;
          } finally {
            clearTimeout(timeoutId);
            clearInterval(activityInterval);
            sessionAbort.signal.removeEventListener('abort', abortListener);
          }

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Ollama Error (${res.status}): ${errText}`);
          }
          
          const result = await res.json();
          const content = result.message?.content || '';
          const thinking = result.message?.thinking || '';
          let resolvedText = content.trim() !== '' ? content : (thinking.trim() !== '' ? thinking : '');

          let functionCalls = result.message?.tool_calls?.map(tc => ({
            name: tc.function.name,
            args: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments
          })) || [];

          if (functionCalls.length === 0 && resolvedText.trim() !== '') {
            const validToolNames = new Set(getToolDeclarations()[0].functionDeclarations.map(fd => fd.name));
            const extracted = extractTextToolCalls(resolvedText, validToolNames);
            if (extracted.toolCalls.length > 0) {
              functionCalls = extracted.toolCalls;
              resolvedText = extracted.cleanText;
              console.log(`[Ollama Text Tool Calls Extracted] Found ${functionCalls.length} tool(s):`, functionCalls.map(f => f.name));
              if (socket) sendLog(socket, this.id, 'system', `⚡ Extracted tool call: ${functionCalls.map(f => f.name).join(', ')}`);
            }
          }

          response = {
            functionCalls: functionCalls.length > 0 ? functionCalls : null,
            text: resolvedText,
            model: `ollama/${ollamaModel}`,
            usage: {
              promptTokens: result.prompt_eval_count || 0,
              candidatesTokens: result.eval_count || 0,
              totalTokens: (result.prompt_eval_count || 0) + (result.eval_count || 0)
            }
          };
        }
        
        if (response && response.usage) {
          response.usage.durationMs = Date.now() - __llmStartTime;
          accumulatedUsage.promptTokens += (response.usage.promptTokens || 0);
          accumulatedUsage.candidatesTokens += (response.usage.candidatesTokens || 0);
          accumulatedUsage.totalTokens += (response.usage.totalTokens || 0);
          accumulatedUsage.durationMs += response.usage.durationMs;

          // Record token usage immediately on every turn (works for tools, final text, and errors)
          await recordTokenUsage(
            this.id,
            response.usage.promptTokens,
            response.usage.candidatesTokens,
            response.usage.totalTokens,
            response.model
          );
        }

        sendLog(socket, this.id, 'api_response', `Received API response`, { 
          hasFunctionCalls: !!response.functionCalls && response.functionCalls.length > 0, 
          hasText: !!response.text,
          usage: response.usage
        });

        // Update task activity with intermediate reasoning if present
        if (response.text && response.text.trim() !== '' && response.functionCalls) {
          const reasoningSnippet = response.text.replace(/<\/?(?:tool_calls|tools|tool_call|function_calls|function_call)[^>]*>/gi, '').trim();
          if (reasoningSnippet) {
            broadcastTaskActivity(this.id, 'synthesis', reasoningSnippet.substring(0, 180) + (reasoningSnippet.length > 180 ? '...' : ''), { model: response.model, sessionId }, sessionId);
          }
        }

        if (response.functionCalls && response.functionCalls.length > 0) {
          // Model decided to call tools
          const modelParts = response.originalParts || response.functionCalls.map(fc => ({ functionCall: fc }));
          sessionHistory.push({ role: 'model', parts: modelParts });
          await this.saveToHistory('model', modelParts);
          const functionResponses = [];
          
          for (const call of response.functionCalls) {
            console.log(`[Agent ${this.id} | Session ${sessionId}] Executing tool: ${call.name}`);
            sendLog(socket, this.id, 'tool_call', `⚙️ Starting tool execution: ${call.name}`, { args: call.args, sessionId }, 'info', sessionId);
            
            const toolMsg = `Executing ${call.name}...`;
            if (typeof io !== 'undefined') {
              io.emit('agent_status', { sessionId, agentId: this.id, status: 'working', message: toolMsg, toolName: call.name, toolArgs: call.args, step: turnCount });
            }
            broadcastTaskActivity(this.id, 'tool_start', `Executing tool: ${call.name}`, { toolName: call.name, args: call.args, step: turnCount, sessionId }, sessionId);
            
            const progress = Math.min(Math.floor((turnCount / 5) * 100), 95);
            if (typeof io !== 'undefined') io.emit('task_progress', { agentId: this.id, sessionId, progress });

            let result;
            const _pmT0 = Date.now();
            let lastHeartbeatLog = _pmT0;

            // Continuous health-check and heartbeat monitor for this tool execution
            const healthInterval = setInterval(() => {
              this.lastActivity = Date.now();
              const elapsedSec = Math.floor((Date.now() - _pmT0) / 1000);
              
              if (typeof io !== 'undefined') {
                io.emit('agent_health', {
                  sessionId,
                  agentId: this.id,
                  status: 'working',
                  toolName: call.name,
                  elapsedSeconds: elapsedSec,
                  health: 'healthy',
                  timestamp: new Date().toISOString()
                });
              }

              // Periodic heartbeat notification every 30 seconds for long running operations
              if (Date.now() - lastHeartbeatLog >= 30000) {
                lastHeartbeatLog = Date.now();
                const msg = `⏳ [Health Check] ${call.name} is running smoothly (${elapsedSec}s elapsed)...`;
                if (socket) sendLog(socket, this.id, 'heartbeat', msg, { tool: call.name, elapsedSec }, 'info', sessionId);
                broadcastTaskActivity(this.id, 'heartbeat', msg, { toolName: call.name, elapsedSec, sessionId }, sessionId);
              }
            }, 5000);

            try {
              if (sessionAbort.signal.aborted || this.shouldStop) {
                throw new Error('Task was stopped by user');
              }

              const toolExecutionPromise = executeTool(call, socket, sessionId);

              // Respect explicit user stop requests without arbitrary timeout
              const abortWaitPromise = new Promise((_, reject) => {
                sessionAbort.signal.addEventListener('abort', () => reject(new Error('Task stopped by user')), { once: true });
              });

              result = await Promise.race([toolExecutionPromise, abortWaitPromise]);
            } catch (err) {
              result = { error: err.message || 'Tool execution encountered an error' };
              if (err.message === 'Task stopped by user') {
                this.shouldStop = true;
              }
            } finally {
              clearInterval(healthInterval);
            }
            const _pmDuration = Date.now() - _pmT0;

            const _resultPreview = (() => {
              if (result.error) return result.error;
              if (result.output) return result.output.substring(0, 200);
              if (result.content) return result.content.substring(0, 200);
              if (result.status) return result.status;
              if (result.data) return `${Array.isArray(result.data) ? result.data.length + ' rows' : 'object'}`;
              return JSON.stringify(result).substring(0, 200);
            })();

            executedActions.push({
              toolName: call.name,
              durationMs: _pmDuration,
              status: result.error ? 'error' : 'success',
              preview: _resultPreview,
              timestamp: Date.now()
            });

            if (result.error) {
              sendLog(socket, this.id, 'tool_result', `✗ ${call.name} failed (${_pmDuration}ms) — ${result.error}`, result, 'error', sessionId);
              broadcastTaskActivity(this.id, 'tool_end', `Failed ${call.name} (${_pmDuration}ms): ${result.error}`, { toolName: call.name, durationMs: _pmDuration, error: result.error, sessionId }, sessionId);
            } else {
              sendLog(socket, this.id, 'tool_result', `✓ ${call.name} (${_pmDuration}ms) — ${_resultPreview}`, result, 'info', sessionId);
              broadcastTaskActivity(this.id, 'tool_end', `Completed ${call.name} (${_pmDuration}ms)`, { toolName: call.name, durationMs: _pmDuration, preview: _resultPreview, sessionId }, sessionId);
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

          if (turnCount >= MAX_TURNS - 3 && functionResponses.length > 0) {
            const lastResp = functionResponses[functionResponses.length - 1].functionResponse;
            if (lastResp && typeof lastResp.response === 'object' && lastResp.response !== null) {
              lastResp.response._system_budget_notice = `[Turn budget notice]: You are on turn ${turnCount} of ${MAX_TURNS}. Please finalize any pending actions and provide a complete, detailed final answer to the user now.`;
            }
          }

          sessionHistory.push({ role: 'user', parts: functionResponses });
          await this.saveToHistory('user', functionResponses);
        } else {
          // Model provided only text response — check for reassurance loop before treating as final answer
          const REASSURANCE_SIGNALS = [
            'i am spawning', 'i have spawned', 'i will spawn', 'spawning the',
            'working in the background', 'i am working on', 'i am currently working',
            'i will notify you', 'i will let you know', 'will notify you when',
            'proceeding now', 'i am proceeding', 'i will proceed',
            'rest assured', 'stay tuned', 'things are proceeding',
            'i have initiated', 'i have just initiated', 'i have just spawned',
            'i\'ve spawned', 'i\'ve initiated', 'actively working'
          ];
          const lowerResponseText = (response.text || '').toLowerCase();
          const isReassuranceLoop = REASSURANCE_SIGNALS.some(sig => lowerResponseText.includes(sig));

          if (isReassuranceLoop && turnCount < 9) {
            // Save the hollow response to history so context is preserved
            const hollowParts = response.originalParts || [{ text: response.text }];
            sessionHistory.push({ role: 'model', parts: hollowParts });
            await this.saveToHistory('model', hollowParts);
            consecutiveTextOnlyTurns++;
            const warnMsg = `⚠️ Reassurance loop detected (occurrence #${consecutiveTextOnlyTurns}, turn ${turnCount}). The model described actions instead of calling tools. Injecting SYSTEM OVERRIDE.`;
            sendLog(socket, this.id, 'warning', warnMsg, null, 'warning', sessionId);
            broadcastTaskActivity(this.id, 'loop_guard', warnMsg, { turn: turnCount, consecutiveTextOnlyTurns, sessionId }, sessionId);

            // Inject a hard correction as the next user turn
            const overrideText =
              `[SYSTEM OVERRIDE — ANTI-REASSURANCE GUARD]: You just responded with text describing what you ` +
              `plan to do (occurrence #${consecutiveTextOnlyTurns}), but you did NOT call any tools. ` +
              `Describing an action is NOT the same as performing it. ` +
              `You MUST now call a tool IMMEDIATELY — use spawn_agent, supabase_action, web_search, ` +
              `request_human_approval, or any other relevant tool. ` +
              `Do NOT produce another text-only response. TAKE ACTION NOW.`;

            const overrideParts = [{ text: overrideText }];
            sessionHistory.push({ role: 'user', parts: overrideParts });
            await this.saveToHistory('user', overrideParts);
            continue; // Re-enter the while loop — force a real tool call
          }

          // Genuine final text answer — reset counter and send to UI
          consecutiveTextOnlyTurns = 0;
          const finalParts = response.originalParts || [{ text: response.text }];
          sessionHistory.push({ role: 'model', parts: finalParts });
          await this.saveToHistory('model', finalParts);

          // Send final message to UI with all collected images
          const currentSession = sessionId || socket?.currentSessionId || activeSessionId || 'session_default';
          const cleanFinalContent = (response.text || '')
            .replace(/<\/?(?:tool_calls|tools|tool_call|function_calls|function_call)[^>]*>/gi, '')
            .trim();
          const msgData = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            sessionId: currentSession,
            agentId: this.id,
            role: 'assistant',
            content: cleanFinalContent,
            images: collectedImages, 
            steps: executedActions,
            model: response.model || (provider === 'gemini' ? 'gemini-2.5-flash' : provider),
            usage: {
              promptTokens: accumulatedUsage.promptTokens,
              candidatesTokens: accumulatedUsage.candidatesTokens,
              totalTokens: accumulatedUsage.totalTokens,
              durationMs: accumulatedUsage.durationMs,
              model: response.model || (provider === 'gemini' ? 'gemini-2.5-flash' : provider)
            }
          };
          
          // Record assistant message into active SQLite session
          recordMessageInSession(currentSession, msgData);
          getAllSessions().then(s => io.emit('sessions_list', s));

          // Emit globally so all connected UI clients receive the message once
          if (typeof io !== 'undefined') {
            io.emit('agent_message', msgData);
          }
          if (socket && (socket.isMockSocket || !socket.id)) {
            socket.emit('agent_message', msgData);
          }
          hasEmittedFinalMessage = true;
          break; // Done
        }
      }

      // Safety net: If loop exited without emitting a final assistant message (e.g. max turns reached, loop end, or stopped)
      if (!hasEmittedFinalMessage && !sessionAbort.signal.aborted) {
        const currentSession = sessionId || socket?.currentSessionId || activeSessionId || 'session_default';
        let fallbackText = '';
        if (this.shouldStop) {
          fallbackText = `⏹️ **Task stopped by user** after ${turnCount} turns. Executed ${executedActions.length} action(s).`;
        } else if (turnCount >= MAX_TURNS) {
          const uniqueTools = [...new Set(executedActions.map(a => a.toolName))].join(', ');
          const actionSummaries = executedActions.slice(-8).map((a, i) => `• **${a.toolName}**: ${a.status === 'success' ? '✓' : '✗'} ${a.preview ? a.preview.replace(/\\n+/g, ' ').substring(0, 150) : 'Done'}`).join('\n');
          fallbackText = `⚠️ **Autonomous execution reached turn limit (${turnCount} turns, ${executedActions.length} actions executed)**.\n\n` +
            `**Tools Used:** **${uniqueTools || 'Various tools'}**\n\n` +
            `**Recent Actions & Output:**\n${actionSummaries || 'Actions recorded in system activity.'}\n\n` +
            `*All step data has been preserved. You can ask to proceed with the next specific phase.*`;
        } else if (executedActions.length > 0) {
          const uniqueTools = [...new Set(executedActions.map(a => a.toolName))].join(', ');
          fallbackText = `✅ **Task processing completed** (${executedActions.length} actions executed: ${uniqueTools}).`;
        }

        if (fallbackText) {
          const msgData = {
            id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            sessionId: currentSession,
            agentId: this.id,
            role: 'assistant',
            content: fallbackText,
            images: collectedImages,
            steps: executedActions,
            model: provider === 'gemini' ? 'gemini-2.5-flash' : provider,
            usage: {
              promptTokens: accumulatedUsage.promptTokens,
              candidatesTokens: accumulatedUsage.candidatesTokens,
              totalTokens: accumulatedUsage.totalTokens,
              durationMs: accumulatedUsage.durationMs,
              model: provider === 'gemini' ? 'gemini-2.5-flash' : provider
            }
          };

          recordMessageInSession(currentSession, msgData);
          getAllSessions().then(s => io.emit('sessions_list', s));

          if (typeof io !== 'undefined') {
            io.emit('agent_message', msgData);
          }
          if (socket && (socket.isMockSocket || !socket.id)) {
            socket.emit('agent_message', msgData);
          }
          hasEmittedFinalMessage = true;
        }
      }
    } catch (error) {
      console.error(`Agent ${this.id} error:`, error);
      broadcastTaskActivity(this.id, 'error', `Agent execution error: ${error.message}`, { error: error.message, sessionId }, sessionId);
      if (socket) {
        sendLog(socket, this.id, 'error', `Agent execution error`, { error: error.message }, 'error', sessionId);
        socket.emit('agent_error', { sessionId, agentId: this.id, error: error.message });
      }

      if (!hasEmittedFinalMessage) {
        const currentSession = sessionId || socket?.currentSessionId || activeSessionId || 'session_default';
        const errorContent = `⚠️ **Agent execution encountered an issue**: ${error.message || 'Unknown error'}\n\n` +
          (executedActions.length > 0 
            ? `*Completed ${executedActions.length} action(s) before interruption: ${[...new Set(executedActions.map(a => a.toolName))].join(', ')}.*`
            : `*The model request failed before tool actions could complete. Please try again or switch model in settings.*`);

        const errorMsgData = {
          id: `msg_err_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          sessionId: currentSession,
          agentId: this.id,
          role: 'assistant',
          content: errorContent,
          images: collectedImages,
          steps: executedActions,
          model: provider === 'gemini' ? 'gemini-2.5-flash' : provider,
          isError: true,
          usage: {
            promptTokens: accumulatedUsage.promptTokens,
            candidatesTokens: accumulatedUsage.candidatesTokens,
            totalTokens: accumulatedUsage.totalTokens,
            durationMs: accumulatedUsage.durationMs,
            model: provider === 'gemini' ? 'gemini-2.5-flash' : provider
          }
        };

        recordMessageInSession(currentSession, errorMsgData);
        getAllSessions().then(s => io.emit('sessions_list', s));
        if (typeof io !== 'undefined') io.emit('agent_message', errorMsgData);
        if (socket && (socket.isMockSocket || !socket.id)) socket.emit('agent_message', errorMsgData);
        hasEmittedFinalMessage = true;
      }
    } finally {
      activeSessionRuns.delete(sessionId);
      if (typeof io !== 'undefined') {
        io.emit('agent_status', { sessionId, agentId: this.id, status: 'idle', message: '' });
        io.emit('session_working_status', { sessionId, isWorking: false });
        broadcastTaskActivity(this.id, 'complete', 'Task processing finished', { sessionId }, sessionId);
      }
      const anyRunningForAgent = Array.from(activeSessionRuns.values()).some(r => r.agentId === this.id);
      if (!anyRunningForAgent) {
        this.processing = false;
        if (activeAgents.has(this.id)) {
          activeAgents.get(this.id).status = 'idle';
        }
        dbPromise.then(db => db.run('UPDATE active_agents SET status = ? WHERE agentId = ?', ['idle', this.id]).catch(() => {}));
        if (typeof io !== 'undefined') {
          io.emit('active_agents', Array.from(activeAgents.values()));
        }
      }

      // Schedule idle grace period cleanup for browser sessions (Ego-Lite and Stealth Playwright)
      try {
        EgoAdapter.scheduleTaskCompletionGrace(60000);
        BrowserManager.scheduleTaskCompletionGrace(60000);
      } catch (e) {
        console.warn('Error scheduling browser idle grace:', e.message);
      }
    }
  }
}

const orchestrator = new Agent('orchestrator', path.join(process.cwd(), 'agents', 'orchestrator', 'system.md'));
agentInstances.set('orchestrator', orchestrator);

const scheduledCronTasks = new Map();

function scheduleCronJob(jobId, cronExpr, task, jobName, agentId = 'orchestrator') {
  const taskObj = cron.schedule(cronExpr, async () => {
    console.log(`[Job ${jobId}] Running: ${jobName || 'Unnamed'} (Agent: ${agentId})`);
    const db = await dbPromise;
    await db.run('UPDATE scheduled_jobs SET lastRun = ? WHERE id = ?', [new Date().toISOString(), jobId]);
    
    const mockSocket = {
      emit: async (event, data) => {
        io.emit(event, data);
        if (event === 'agent_message' && !data.isTool) {
          if (lastTelegramChatId && tgBot) {
            const header = `🤖 *[${jobName || 'Scheduled Job'}]* (${agentId})\n\n`;
            const modifiedData = {
              ...data,
              content: data.content ? `${header}${data.content}` : ''
            };
            await processTelegramAgentMessage(tgBot.telegram, lastTelegramChatId, modifiedData);
          }
        }
      }
    };
    
    sendLog(mockSocket, agentId, 'job_start', `Running scheduled job: ${jobName || jobId}`);
    let targetAgent = agentInstances.get(agentId);
    if (!targetAgent) {
      const systemPath = path.join(process.cwd(), 'agents', agentId, 'system.md');
      if (fs.existsSync(systemPath)) {
        targetAgent = new Agent(agentId, systemPath);
        agentInstances.set(agentId, targetAgent);
      } else {
        targetAgent = orchestrator;
      }
    }
    await targetAgent.processMessage(`[SCHEDULED JOB] ${task}`, mockSocket);
  });
  scheduledCronTasks.set(jobId, taskObj);
}

async function loadScheduledJobs() {
  const db = await dbPromise;
  const jobs = await db.all('SELECT * FROM scheduled_jobs WHERE status = "active"');
  jobs.forEach(job => {
    scheduleCronJob(job.id, job.cron, job.task, job.name, job.agentId || 'orchestrator');
  });
  console.log(`Restored ${jobs.length} scheduled jobs`);
}
loadScheduledJobs();

async function runJobNow(jobId) {
  const db = await dbPromise;
  const job = await db.get('SELECT * FROM scheduled_jobs WHERE id = ?', [jobId]);
  if (!job) throw new Error('Job not found');

  await db.run('UPDATE scheduled_jobs SET lastRun = ? WHERE id = ?', [new Date().toISOString(), jobId]);
  
  const mockSocket = {
    emit: async (event, data) => {
      io.emit(event, data);
      if (event === 'agent_message' && !data.isTool) {
        if (lastTelegramChatId && tgBot) {
          const header = `🤖 *[Manual Run: ${job.name || 'Job'}]* (${job.agentId || 'orchestrator'})\n\n`;
          const modifiedData = {
            ...data,
            content: data.content ? `${header}${data.content}` : ''
          };
          await processTelegramAgentMessage(tgBot.telegram, lastTelegramChatId, modifiedData);
        }
      }
    }
  };

  const agentId = job.agentId || 'orchestrator';
  sendLog(mockSocket, agentId, 'job_start', `Manually triggered job: ${job.name || jobId}`);
  let targetAgent = agentInstances.get(agentId);
  if (!targetAgent) {
    const systemPath = path.join(process.cwd(), 'agents', agentId, 'system.md');
    if (fs.existsSync(systemPath)) {
      targetAgent = new Agent(agentId, systemPath);
      agentInstances.set(agentId, targetAgent);
    } else {
      targetAgent = orchestrator;
    }
  }
  // Run asynchronously
  targetAgent.processMessage(`[SCHEDULED JOB MANUAL TRIGGER] ${job.task}`, mockSocket).catch(err => {
    console.error(`Error running job ${jobId}:`, err);
  });
  getTrackerOverview().then(overview => io.emit('tracker_update', overview));
  return { status: 'Job execution started', jobId };
}

async function getTrackerOverview() {
  const db = await dbPromise;
  
  // 1. Active agents list with their current task content
  const agents = [];
  for (const [id, agent] of activeAgents.entries()) {
    let currentTask = '';
    const taskPath = path.join(process.cwd(), 'tasks', id === 'orchestrator' ? 'current_task.md' : `${id}_task.md`);
    if (fs.existsSync(taskPath)) {
      try {
        currentTask = fs.readFileSync(taskPath, 'utf8');
      } catch (e) {}
    }
    const instance = agentInstances.get(id);
    agents.push({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status || 'idle',
      isProcessing: instance ? !!instance.processing : false,
      lastActivity: instance ? instance.lastActivity : null,
      currentTask: currentTask
    });
  }

  // 2. Pending approvals
  let pendingApprovals = [];
  try {
    pendingApprovals = await db.all('SELECT * FROM pending_approvals ORDER BY id DESC');
  } catch (e) {
    console.error('Error fetching pending_approvals:', e);
  }

  // 3. Scheduled jobs
  let jobs = [];
  try {
    jobs = await db.all('SELECT * FROM scheduled_jobs ORDER BY id DESC');
  } catch (e) {
    console.error('Error fetching scheduled_jobs:', e);
  }

  return {
    agents,
    pendingApprovals,
    jobs,
    timestamp: new Date().toISOString()
  };
}

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
    if (agent.processing && (now - agent.lastActivity > 300000)) {
      console.warn(`[Watchdog] Agent ${id} seems stuck (no activity for 300s). Force aborting.`);
      sendLog(null, id, 'error', '⚠️ WATCHDOG: Agent stalled for >300s. Forcefully resetting...', null, 'error');
      agent.stop();
      agent.processing = false;
      if (activeAgents.has(id)) activeAgents.get(id).status = 'idle';
      io.emit('agent_status', { agentId: id, status: 'idle', message: 'Stalled - Reset by Watchdog' });
    }
  }
}, 30000);

async function summarizeAndPersist(socket, sessionId = 'session_default') {
  if (socket) sendLog(socket, 'orchestrator', 'system', 'Analyzing session for long-term memory extraction...', null, 'info', sessionId);
  try {
    const db = await dbPromise;
    const history = await db.all('SELECT role, parts FROM agent_memory WHERE agentId = ? ORDER BY id ASC', ['orchestrator']);
    if (!history || history.length < 2) return; // Not enough context to learn
    const conversationText = history.map(h => `${h.role}: ${(JSON.parse(h.parts) || []).map(p => p.text || '[Tool/Other]').join(' ')}`).join('\n');
    let analysis = '';
    const memoryPrompt = `You are an expert executive memory curator for an AI assistant (FrAssist).
Your mission is to extract ONLY genuine, long-term durable knowledge that will remain valuable across future sessions weeks or months from now.

CRITICAL DISTINCTION — EPHEMERAL vs. DURABLE:
❌ NEVER EXTRACT EPHEMERAL OR TRIVIAL CONTENT:
- One-off user tasks/requests, transient bugs, tool errors, API timeouts, or temporary glitches.
- Generic workflows, obvious web actions, or fleeting user remarks.
- Content that is already explicitly known or common sense.

✅ ONLY EXTRACT HIGH-VALUE, REPEATABLE, PERMANENT KNOWLEDGE:
- Reusable Architectural Patterns & Code Snippets (e.g., how the project handles auth, state management, database schemas, or API integrations).
- Repeatable Workflows & System Configs (e.g., CI/CD pipelines, specific deployment commands, persistent environment setups).
- Persistent User Preferences & Directives (e.g., preferred tech stack, "Always use TypeScript", "Never use Tailwind", specific formatting rules).
- Core Business Logic & Domain Rules (e.g., permanent project requirements, key entities, established technical boundaries).

STRICT EXTRACTION RULES (BE EXTREMELY CONSERVATIVE):
1. EXPECT TO FIND NOTHING: In 90% of sessions, there is NO new durable knowledge. You MUST default to replying EXACTLY with: "NO_NEW_MEMORY"
2. DO NOT invent memory. If the conversation was just doing tasks, coding a specific feature, fixing a bug, or chatting, reply with "NO_NEW_MEMORY".
3. ONLY extract if you are 100% confident the knowledge has long-term cross-session value that fundamentally changes how the assistant should behave in the future.
4. If valid durable knowledge exists, summarize it in 1-3 bullet points. Max 100 words. No fluff.

CONVERSATION:
${conversationText.slice(-8000)}`;

    if (hasGeminiKey()) {
      try {
        const gemRes = await generateGeminiContent({
          contents: memoryPrompt,
          model: 'gemini-3.7-flash'
        });
        analysis = gemRes.text?.trim() || '';
      } catch (gemErr) {
        console.warn('[Memory] Gemini AI Studio summarization error:', gemErr.message);
      }
    }

    if (!analysis) {
      const model = vertexAI.preview.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
      });
      const result = await model.generateContent(memoryPrompt);
      analysis = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    }
    if (!analysis || analysis.includes('NO_NEW_MEMORY')) {
      if (socket) sendLog(socket, 'orchestrator', 'system', 'No new durable memory facts found to persist.');
      return;
    }
    
    const memoryDir = path.join(process.cwd(), 'memory');
    if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });
    const memoryPath = path.join(memoryDir, 'orchestrator_memory.md');
    
    let currentMemory = '';
    if (fs.existsSync(memoryPath)) currentMemory = fs.readFileSync(memoryPath, 'utf8');
    
    let proposedMemory = `${currentMemory}\n\n## Session Extract: ${new Date().toISOString().split('T')[0]}\n${analysis}`;
    
    // If memory file exceeds 8KB, compact it
    if (proposedMemory.length > 8000) {
      try {
        const compactResult = await model.generateContent(`Consolidate and deduplicate this Long-term Memory file into a clean, concise structured profile (Core Architecture, Active Projects, Reusable Patterns, Preferences). Max 500 words.
CRITICAL RULES:
- PRESERVE: Reusable code patterns, architectural decisions, core project workflows, persistent preferences, and permanent technical domain knowledge.
- PURGE: Any one-off tasks, trivial workflows, temporary debugging steps, tool errors, bug reports, and transient session noise.
- BE AGGRESSIVE IN PURGING: If an item does not fundamentally alter how an AI assistant should act in future sessions, remove it.

MEMORY TO CONSOLIDATE:
${proposedMemory}`);
        const compacted = compactResult.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (compacted) proposedMemory = compacted;
      } catch (compactErr) {
        console.warn('Memory compaction skipped:', compactErr.message);
      }
    }

    // Require human confirmation before updating long-term memory
    const approvalResult = await db.run(
      'INSERT INTO pending_approvals (agentId, title, description, content, type, status) VALUES (?, ?, ?, ?, ?, ?)',
      ['orchestrator', `Long-term Memory Update (${new Date().toISOString().split('T')[0]})`, `Extracted facts:\n${analysis}\n\nReview and confirm in Operations Tracker before saving to orchestrator_memory.md.`, proposedMemory, 'memory_update', 'pending']
    );

    const newApproval = {
      id: approvalResult.lastID,
      agentId: 'orchestrator',
      title: `Long-term Memory Update (${new Date().toISOString().split('T')[0]})`,
      description: `Extracted facts:\n${analysis}\n\nReview and confirm in Operations Tracker before saving to orchestrator_memory.md.`,
      content: proposedMemory,
      type: 'memory_update',
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    io.emit('pending_approval_created', newApproval);
    getTrackerOverview().then(overview => io.emit('tracker_update', overview));

    if (socket) sendLog(socket, 'orchestrator', 'system', `Proposed memory update submitted for user approval (Approval #${newApproval.id}).`, null, 'info', sessionId);
    io.emit('agent_message', {
      sessionId,
      agentId: 'orchestrator',
      content: `🧠 **Proposed Memory Update**: I found new facts from our session. I have created approval item **#${newApproval.id}** in the Operations Tracker. Please confirm or edit it before it is saved to long-term memory.`,
      isTool: true
    });
  } catch (e) {
    console.error('Failed to summarize and persist memory:', e);
    if (socket) sendLog(socket, 'orchestrator', 'error', 'Learning phase failed, but proceeding with reset.', null, 'error', sessionId);
  }
}

async function systemReset(socket, sessionId = 'session_default') {
  console.log('Performing systemic reset...');
  if (socket) sendLog(socket, 'orchestrator', 'system', 'Initiating systemic reset sequence...', null, 'info', sessionId);
  
  // 0. Learn from session
  await summarizeAndPersist(socket, sessionId);
  await new Promise(r => setTimeout(r, 800));

  // 1. Stop all active agents and browser sessions
  if (socket) sendLog(socket, 'orchestrator', 'system', 'Terminating active sub-agents and closing browser sessions...');
  for (const [id, agent] of agentInstances.entries()) {
    agent.stop();
  }
  try {
    await EgoAdapter.closeAllActiveSpaces();
    await BrowserManager.stop();
  } catch (e) {
    console.error('Failed to clean up browser sessions during reset:', e);
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

async function compressSession(socket, targetAgentId = 'orchestrator') {
  const agent = agentInstances.get(targetAgentId) || orchestrator;
  if (!agent) return;

  if (socket) sendLog(socket, targetAgentId, 'system', 'Analyzing session history for context compression...');
  if (socket) socket.emit('agent_status', { agentId: targetAgentId, status: 'working' });

  if (!agent.historyLoaded) {
    await agent.historyPromise;
  }

  const history = agent.history || [];
  if (history.length <= 2) {
    if (socket) {
      sendLog(socket, targetAgentId, 'system', 'Session history is already compact (<= 2 entries). No compression needed.');
      socket.emit('agent_message', {
        agentId: targetAgentId,
        content: 'Session history is already compact and within optimal token limits.',
        isTool: true
      });
      socket.emit('agent_status', { agentId: targetAgentId, status: 'idle' });
    }
    return;
  }

  const rawTextBefore = JSON.stringify(history);
  const approxTokensBefore = Math.round(rawTextBefore.length / 4);

  // Extract conversation text
  const conversationLogs = [];
  for (const h of history) {
    const role = h.role === 'model' ? 'Assistant' : 'User';
    const textParts = (h.parts || []).map(p => {
      if (p.text) return p.text;
      if (p.functionCall) return `[Action: ${p.functionCall.name}(${JSON.stringify(p.functionCall.args || {})})]`;
      if (p.functionResponse) {
        const respStr = typeof p.functionResponse.response === 'string'
          ? p.functionResponse.response
          : JSON.stringify(p.functionResponse.response);
        return `[Result: ${respStr.substring(0, 300)}]`;
      }
      return '';
    }).filter(Boolean).join('\n');

    if (textParts.trim()) {
      conversationLogs.push(`${role}: ${textParts}`);
    }
  }

  const fullTranscript = conversationLogs.join('\n\n');

  let summary = '';
  // Try Groq for ultra-fast summarization first if available
  if (process.env.GROQ_API_KEY) {
    try {
      const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are an AI context compression engine. Summarize the following session transcript into a dense, structured Markdown summary under 250 words. Include: 1. User goals & ongoing tasks, 2. Key findings & state, 3. Decisions & constraints.'
            },
            {
              role: 'user',
              content: fullTranscript.substring(0, 35000)
            }
          ],
          temperature: 0.1,
          max_tokens: 600
        })
      });
      const gJson = await groqRes.json();
      summary = gJson.choices?.[0]?.message?.content || '';
    } catch (e) {
      console.warn('[Compress] Groq summarization error:', e.message);
    }
  }

  // Fallback to Gemini AI Studio / Vertex AI
  if (!summary) {
    const compressPrompt = `You are an AI context compression engine. Summarize the following session transcript into a dense, structured Markdown summary under 250 words preserving all essential tasks, facts, preferences, and state:\n\n${fullTranscript.substring(0, 35000)}`;
    if (hasGeminiKey()) {
      try {
        const gRes = await generateGeminiContent({
          contents: compressPrompt,
          model: 'gemini-3.7-flash'
        });
        summary = gRes.text?.trim() || '';
      } catch (gemErr) {
        console.warn('[Compress] Gemini AI Studio summarization error:', gemErr.message);
      }
    }

    if (!summary) {
      try {
        const model = vertexAI.preview.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const res = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{
              text: compressPrompt
            }]
          }]
        });
        summary = res.response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } catch (err) {
        console.warn('[Compress] Vertex AI summarization error:', err.message);
        summary = `### Prior Session Summary\n- Multi-turn conversation with ${history.length} turns processed.\n- Ongoing tasks and key facts preserved in workspace context.`;
      }
    }
  }

  // Keep the latest 2 items for immediate conversational continuity
  const recentItems = history.slice(-2);

  const compressedHistory = [
    {
      role: 'user',
      parts: [{ text: `[Session Context Compressed - Prior Conversation Summary]\n${summary}` }]
    },
    {
      role: 'model',
      parts: [{ text: 'Understood. I have preserved all key context, state, and goals from our previous conversation and am operating with optimized context.' }]
    },
    ...recentItems
  ];

  // Update in-memory history
  agent.history = compressedHistory;

  // Persist to DB
  try {
    const db = await dbPromise;
    await db.run('DELETE FROM agent_memory WHERE agentId = ?', [targetAgentId]);
    for (const h of compressedHistory) {
      await db.run('INSERT INTO agent_memory (agentId, role, parts) VALUES (?, ?, ?)', [
        targetAgentId,
        h.role,
        JSON.stringify(h.parts)
      ]);
    }
  } catch (dbErr) {
    console.error('Failed to update agent_memory during compression:', dbErr);
  }

  const rawTextAfter = JSON.stringify(compressedHistory);
  const approxTokensAfter = Math.round(rawTextAfter.length / 4);
  const savedTokens = Math.max(0, approxTokensBefore - approxTokensAfter);
  const percentSaved = approxTokensBefore > 0 ? Math.round((savedTokens / approxTokensBefore) * 100) : 0;

  if (socket) {
    sendLog(socket, targetAgentId, 'system', `Session compressed: ~${(approxTokensBefore / 1000).toFixed(1)}k → ~${(approxTokensAfter / 1000).toFixed(1)}k tokens (${percentSaved}% reduction)`);

    socket.emit('agent_message', {
      agentId: targetAgentId,
      content: `### ⚡ Session Context Compressed\n\n**Context Optimization:** \`${(approxTokensBefore / 1000).toFixed(1)}k\` ➔ \`${(approxTokensAfter / 1000).toFixed(1)}k\` tokens (**-${percentSaved}% saved**)\n\n#### Preserved Context Summary:\n${summary}`,
      isTool: true
    });

    socket.emit('chat_history', {
      agentId: targetAgentId,
      history: agent.history
    });

    socket.emit('agent_status', { agentId: targetAgentId, status: 'idle' });
  }
}

async function loadActiveAgents() {
  try {
    const db = await dbPromise;
    await db.run("UPDATE active_agents SET status = 'idle'");
    const rows = await db.all('SELECT * FROM active_agents');
    rows.forEach(row => {
      activeAgents.set(row.agentId, { id: row.agentId, name: row.name, role: row.role, status: 'idle' });
    });
    console.log(`Restored ${rows.length} agents from database`);
  } catch (e) {
    console.error('Failed to restore active agents:', e);
  }
}
loadActiveAgents();

const checkKeys = () => ({
  hasGemini: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_CLOUD_PROJECT),
  hasGeminiStudio: !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
  hasOllamaCloud: !!process.env.OLLAMA_API_KEY,
  hasOllamaCloud2: !!process.env.OLLAMA_API_KEY_2,
  hasDigitalOcean: !!(process.env.DIGITAL_OCEAN_API_KEY || process.env.DO_INFERENCE_API_KEY),
  hasTavily: !!process.env.TAVILY_API_KEY,
  hasTelegram: !!process.env.TELEGRAM_BOT_TOKEN,
  hasPerplexity: !!process.env.PERPLEXITY_API_KEY,
  hasDuffel: !!getDuffelApiKey(),
  defaultProvider: process.env.DEFAULT_LLM_PROVIDER || 'ollama_cloud',
  defaultOllamaCloudModel: process.env.OLLAMA_CLOUD_MODEL || 'nemotron-3-nano:30b'
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
  loadAvailableAgents().then(() => {
    socket.emit('active_agents', Array.from(activeAgents.values()));
  }).catch(() => {
    socket.emit('active_agents', Array.from(activeAgents.values()));
  });

  socket.on('get_active_agents', async () => {
    await loadAvailableAgents();
    socket.emit('active_agents', Array.from(activeAgents.values()));
  });

  // Send WhatsApp initial status & scheduled messages
  socket.emit('whatsapp_status', getWhatsAppStatus());
  getScheduledWhatsAppMessages().then(scheduledMessages => {
    socket.emit('whatsapp_scheduled_messages_list', { scheduledMessages });
  }).catch(() => {});

  // Send active sessions list
  getAllSessions().then(sessions => socket.emit('sessions_list', sessions));
  socket.emit('active_session_runs', Array.from(activeSessionRuns.keys()));

  socket.on('get_sessions', async () => {
    const sessions = await getAllSessions();
    socket.emit('sessions_list', sessions);
    socket.emit('active_session_runs', Array.from(activeSessionRuns.keys()));
  });

  socket.on('create_session', async (data) => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const session = await getOrCreateSession(
      newSessionId,
      data.channel || 'web',
      data.targetAgentId || 'orchestrator',
      data.title || 'New Workspace Chat'
    );
    activeSessionId = newSessionId;
    socket.currentSessionId = newSessionId;
    const allSessions = await getAllSessions();
    io.emit('sessions_list', allSessions);
    socket.emit('session_created', { session, messages: [] });
  });

  socket.on('load_session', async ({ sessionId }) => {
    activeSessionId = sessionId;
    socket.currentSessionId = sessionId;
    const messages = await getSessionMessages(sessionId);
    const session = await getOrCreateSession(sessionId);
    socket.emit('session_loaded', { sessionId, session, messages });
  });

  socket.on('delete_session', async ({ sessionId }) => {
    await deleteSession(sessionId);
    const allSessions = await getAllSessions();
    io.emit('sessions_list', allSessions);
  });

  socket.on('whatsapp_get_status', () => {
    socket.emit('whatsapp_status', getWhatsAppStatus());
  });

  socket.on('whatsapp_request_qr', async () => {
    await connectToWhatsApp();
  });

  socket.on('whatsapp_disconnect', async () => {
    await disconnectWhatsApp();
  });

  socket.on('whatsapp_get_messages', async (data = {}) => {
    try {
      const messages = await getWhatsAppMessages(data);
      socket.emit('whatsapp_messages_list', {
        messages,
        filter: data.filter || 'latest',
        phone: data.phone || null
      });
    } catch (e) {
      console.error('[WhatsApp] Error getting messages via socket:', e);
      socket.emit('whatsapp_messages_list', { messages: [], error: e.message });
    }
  });

  socket.on('whatsapp_get_chats', async (data = {}) => {
    try {
      const chats = await getWhatsAppChats(data);
      socket.emit('whatsapp_chats_list', { chats, filter: data.filter || 'all', query: data.query || null });
    } catch (e) {
      console.error('[WhatsApp] Error getting chats via socket:', e);
      socket.emit('whatsapp_chats_list', { chats: [], error: e.message });
    }
  });

  socket.on('whatsapp_get_chat_messages', async (data = {}) => {
    try {
      if (data.remoteJid) {
        const messages = await getWhatsAppChatMessages(data.remoteJid, data);
        socket.emit('whatsapp_chat_messages_list', {
          remoteJid: data.remoteJid,
          messages
        });
      }
    } catch (e) {
      console.error('[WhatsApp] Error getting chat messages via socket:', e);
      socket.emit('whatsapp_chat_messages_list', { remoteJid: data.remoteJid, messages: [], error: e.message });
    }
  });

  socket.on('whatsapp_send_message', async (data = {}, callback) => {
    try {
      const { to, phone, remoteJid, text, securityCode } = data;
      const target = remoteJid || phone || to;
      if (!target || !text) {
        if (callback) callback({ success: false, error: 'Target contact and message text are required.' });
        return;
      }
      const result = await sendWhatsAppMessage(target, text, securityCode, remoteJid);
      if (callback) callback({ success: true, result });
    } catch (e) {
      console.error('[WhatsApp] Direct send message error:', e);
      if (callback) callback({ success: false, error: e.message });
      socket.emit('whatsapp_send_error', { error: e.message });
    }
  });

  socket.on('whatsapp_get_model', async () => {
    try {
      const model = await getWhatsAppModel();
      socket.emit('whatsapp_model_selected', { model });
    } catch (e) {
      console.error('[WhatsApp] Error getting model:', e);
    }
  });

  socket.on('whatsapp_set_model', async (data = {}) => {
    try {
      if (data.model) {
        await setWhatsAppModel(data.model);
        io.emit('whatsapp_model_selected', { model: data.model });
      }
    } catch (e) {
      console.error('[WhatsApp] Error setting model:', e);
    }
  });

  socket.on('whatsapp_generate_ai_draft', async (data = {}, callback) => {
    try {
      const { remoteJid, phone, contactName, model } = data;
      const messages = await getWhatsAppChatMessages(remoteJid, { limit: 10 });
      const lastIncoming = [...messages].reverse().find(m => !m.fromMe);
      const guestText = lastIncoming?.text || 'Hello';
      const cName = contactName || (await resolveContactDisplayName(remoteJid, phone));
      const evalResult = await evaluateAutoReply(guestText, cName, phone || '', remoteJid, model || null);
      
      let draftText = evalResult.replyText || evalResult.reply || '';
      if (!draftText && evalResult.reason !== 'NO_KNOWLEDGE_MATCH') {
        draftText = `Ciao ${cName}! Grazie per il tuo messaggio. Siamo a tua disposizione per qualsiasi informazione su Tra-Montiemare e il soggiorno a Scalea.`;
      }

      if (callback) {
        callback({
          success: true,
          draft: draftText,
          shouldReply: evalResult.shouldReply,
          reason: evalResult.reason,
          model: evalResult.model || model
        });
      }
    } catch (e) {
      console.error('[WhatsApp] AI draft error:', e);
      if (callback) callback({ success: false, error: e.message });
    }
  });

  socket.on('whatsapp_mark_replied', async (data = {}) => {
    try {
      if (data.id || data.phone || data.remoteJid) {
        await markWhatsAppMessageReplied(data.remoteJid || data.id || data.phone);
        const chats = await getWhatsAppChats();
        io.emit('whatsapp_chats_list', { chats });
        if (data.remoteJid) {
          const messages = await getWhatsAppChatMessages(data.remoteJid);
          socket.emit('whatsapp_chat_messages_list', { remoteJid: data.remoteJid, messages });
        }
      }
    } catch (e) {
      console.error('[WhatsApp] Error marking message replied:', e);
    }
  });

  socket.on('whatsapp_get_auto_replies', async () => {
    try {
      const list = await getAutoReplyContacts();
      socket.emit('whatsapp_auto_replies_list', list);
    } catch (e) {
      console.error('[WhatsApp] Error getting auto replies list:', e);
    }
  });

  socket.on('whatsapp_toggle_auto_reply', async (data = {}) => {
    try {
      if (data.phone || data.remoteJid || data.contactName) {
        await setAutoReplyStatus(
          data.phone || data.remoteJid || data.contactName,
          data.enabled,
          data.contactName || '',
          data.remoteJid || ''
        );
        const list = await getAutoReplyContacts();
        io.emit('whatsapp_auto_replies_list', list);
      }
    } catch (e) {
      console.error('[WhatsApp] Error toggling auto-reply:', e);
    }
  });

  socket.on('whatsapp_emergency_stop', async () => {
    try {
      await disableAllAutoReplies();
      const list = await getAutoReplyContacts();
      io.emit('whatsapp_auto_replies_list', list);
      socket.emit('whatsapp_emergency_stop_confirmed', { success: true });
    } catch (e) {
      console.error('[WhatsApp] Error executing emergency stop:', e);
    }
  });

  socket.on('whatsapp_clear_chat_history', async (data = {}, callback) => {
    try {
      const { remoteJid, phone } = data;
      const target = remoteJid || phone;
      if (!target) {
        if (typeof callback === 'function') callback({ error: 'remoteJid or phone is required' });
        return;
      }
      await clearWhatsAppChatHistory(target);
      const chats = await getWhatsAppChats();
      io.emit('whatsapp_chats_list', { chats });
      socket.emit('whatsapp_chat_messages_list', { remoteJid: target, messages: [] });
      if (typeof callback === 'function') callback({ success: true, remoteJid: target });
    } catch (e) {
      console.error('[WhatsApp] Error clearing chat history:', e);
      if (typeof callback === 'function') callback({ error: e.message });
    }
  });

  // WhatsApp Message Scheduler Socket Handlers
  socket.on('whatsapp_get_scheduled_messages', async (data = {}, callback) => {
    try {
      const scheduledMessages = await getScheduledWhatsAppMessages(data);
      socket.emit('whatsapp_scheduled_messages_list', { scheduledMessages });
      if (typeof callback === 'function') callback({ success: true, scheduledMessages });
    } catch (e) {
      console.error('[WhatsApp] Error getting scheduled messages:', e);
      socket.emit('whatsapp_scheduled_messages_list', { scheduledMessages: [], error: e.message });
      if (typeof callback === 'function') callback({ success: false, error: e.message });
    }
  });

  socket.on('whatsapp_schedule_message', async (data = {}, callback) => {
    try {
      const result = await scheduleWhatsAppMessage({
        recipient: data.recipient || data.phone || data.remoteJid,
        remoteJid: data.remoteJid,
        phone: data.phone,
        text: data.text,
        scheduledAt: data.scheduledAt,
        securityCode: data.securityCode,
        createdBy: data.createdBy || 'ui'
      });
      if (typeof callback === 'function') callback(result);
    } catch (e) {
      console.error('[WhatsApp] Error scheduling message:', e);
      if (typeof callback === 'function') callback({ success: false, error: e.message });
    }
  });

  socket.on('whatsapp_cancel_scheduled_message', async (data = {}, callback) => {
    try {
      const result = await cancelScheduledWhatsAppMessage(data.id);
      if (typeof callback === 'function') callback(result);
    } catch (e) {
      console.error('[WhatsApp] Error cancelling scheduled message:', e);
      if (typeof callback === 'function') callback({ success: false, error: e.message });
    }
  });

  socket.on('whatsapp_delete_scheduled_message', async (data = {}, callback) => {
    try {
      const result = await deleteScheduledWhatsAppMessage(data.id);
      if (typeof callback === 'function') callback(result);
    } catch (e) {
      console.error('[WhatsApp] Error deleting scheduled message:', e);
      if (typeof callback === 'function') callback({ success: false, error: e.message });
    }
  });

  socket.on('whatsapp_send_scheduled_now', async (data = {}, callback) => {
    try {
      const result = await sendScheduledWhatsAppMessageNow(data.id, data.securityCode);
      if (typeof callback === 'function') callback(result);
    } catch (e) {
      console.error('[WhatsApp] Error sending scheduled message immediately:', e);
      if (typeof callback === 'function') callback({ success: false, error: e.message });
    }
  });

  socket.on('poll_ollama', async () => {
    const skill = dynamicSkills.get('monitor_ollama');
    if (skill) {
      try {
        const result = await skill.execute({});
        socket.emit('ollama_status', result);
      } catch (e) {
        console.error('Ollama monitor poll failed:', e);
      }
    }
  });

  socket.on('user_message', async (data) => {
    // Immediate bypass for internal system background polls
    if (data.internal || data.content?.startsWith('system_internal_poll')) {
      if (data.content?.startsWith('system_internal_poll: monitor_ollama')) {
        const skill = dynamicSkills.get('monitor_ollama');
        if (skill) {
          try {
            const result = await skill.execute({});
            socket.emit('ollama_status', result);
          } catch (e) {
            console.error('Ollama monitor poll failed:', e);
          }
        }
      }
      return;
    }

    console.log('Received message:', data.content, 'Provider:', data.provider);

    const targetSessionId = data.sessionId || socket.currentSessionId || activeSessionId || 'session_default';
    socket.currentSessionId = targetSessionId;
    activeSessionId = targetSessionId;

    await getOrCreateSession(targetSessionId, data.channel || 'web', data.targetAgentId || 'orchestrator', data.content);
    await recordMessageInSession(targetSessionId, {
      role: 'user',
      content: data.content,
      images: data.images,
      isTool: false
    });
    getAllSessions().then(s => io.emit('sessions_list', s));

    // Handle /compress command
    if (data.content.trim() === '/compress' || data.content.trim().startsWith('/compress ')) {
      await compressSession(socket, data.targetAgentId || 'orchestrator');
      return;
    }

    // Handle /hosts command
    if (data.content.trim() === '/hosts' || data.content.trim().startsWith('/hosts ') || data.content.trim().startsWith('/host ')) {
      const isDryRun = data.content.toLowerCase().includes('dry') || data.content.toLowerCase().includes('simulate');
      const numMatch = data.content.match(/\b(\d+)\b/);
      const maxPosts = numMatch ? parseInt(numMatch[1], 10) : 5;
      const targetSession = targetSessionId || 'session_default';

      sendLog(socket, 'orchestrator', 'system', `🚀 Starting Facebook Hosts Outreach task (Target: max ${maxPosts} offering posts, mode: ${isDryRun ? 'DRY-RUN' : 'LIVE'})...`, null, 'info', targetSession);
      if (typeof io !== 'undefined') {
        io.emit('agent_status', { sessionId: targetSession, agentId: 'orchestrator', status: 'working', message: 'Scanning Facebook group for host offerings...' });
        io.emit('session_working_status', { sessionId: targetSession, isWorking: true });
      } else {
        socket.emit('agent_status', { sessionId: targetSession, agentId: 'orchestrator', status: 'working', message: 'Scanning Facebook group for host offerings...' });
      }

      const skill = dynamicSkills.get('fb_hosts_outreach');
      if (skill) {
        try {
          const result = await skill.execute({
            maxPosts,
            dryRun: isDryRun,
            targetUrl: 'https://www.facebook.com/groups/325849768974770',
            commentText: 'dm plese! :)'
          }, (msg) => {
            sendLog(socket, 'orchestrator', 'browser', msg, null, 'info', targetSession);
          });

          await recordMessageInSession(targetSession, {
            role: 'assistant',
            agent_id: 'orchestrator',
            content: result.summary,
            is_tool: false
          });

          if (typeof io !== 'undefined') {
            io.emit('agent_message', {
              sessionId: targetSession,
              agentId: 'orchestrator',
              content: result.summary,
              isTool: false
            });
            io.emit('agent_status', { sessionId: targetSession, agentId: 'orchestrator', status: 'idle' });
            io.emit('session_working_status', { sessionId: targetSession, isWorking: false });
          } else {
            socket.emit('agent_message', {
              sessionId: targetSession,
              agentId: 'orchestrator',
              content: result.summary,
              isTool: false
            });
            socket.emit('agent_status', { sessionId: targetSession, agentId: 'orchestrator', status: 'idle' });
          }
        } catch (e) {
          const errorMsg = `❌ Facebook outreach error: ${e.message}`;
          sendLog(socket, 'orchestrator', 'error', errorMsg, null, 'error', targetSession);
          if (typeof io !== 'undefined') {
            io.emit('agent_message', {
              sessionId: targetSession,
              agentId: 'orchestrator',
              content: errorMsg,
              isTool: true
            });
            io.emit('agent_status', { sessionId: targetSession, agentId: 'orchestrator', status: 'idle' });
            io.emit('session_working_status', { sessionId: targetSession, isWorking: false });
          } else {
            socket.emit('agent_message', {
              sessionId: targetSession,
              agentId: 'orchestrator',
              content: errorMsg,
              isTool: true
            });
            socket.emit('agent_status', { sessionId: targetSession, agentId: 'orchestrator', status: 'idle' });
          }
        }
      } else {
        if (typeof io !== 'undefined') {
          io.emit('agent_message', { sessionId: targetSession, agentId: 'orchestrator', content: `❌ fb_hosts_outreach skill not found.`, isTool: true });
          io.emit('agent_status', { sessionId: targetSession, agentId: 'orchestrator', status: 'idle' });
          io.emit('session_working_status', { sessionId: targetSession, isWorking: false });
        } else {
          socket.emit('agent_message', { sessionId: targetSession, agentId: 'orchestrator', content: `❌ fb_hosts_outreach skill not found.`, isTool: true });
          socket.emit('agent_status', { sessionId: targetSession, agentId: 'orchestrator', status: 'idle' });
        }
      }
      return;
    }

    // Handle /help command
    if (data.content.trim() === '/help') {
      socket.emit('agent_message', {
        agentId: 'orchestrator',
        content: `### 🛠️ Available Slash Commands\n\n- \`/hosts [count]\`: Scan FB Digital Nomad housing group & comment on host offerings to promote https://host.frastab.com/\n- \`/compress\`: Compress session history & prune bloated context\n- \`/new\`: Analyze session and reset workspace\n- \`/stop\`: Stop current generation immediately\n- \`/learn\`: Extract insights and architectural proposals\n- \`/ego <prompt>\`: Execute autonomous web task in Ego Lite browser\n- \`/help\`: Show available commands`,
        isTool: true
      });
      return;
    }

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
      const targetSession = data.sessionId || socket.currentSessionId || activeSessionId || 'session_default';
      socket.emit('agent_message', { sessionId: targetSession, agentId: 'orchestrator', content: '_Generation stopped by user._', isTool: true });
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
    let targetAgent = agentInstances.get(targetId);
    if (!targetAgent && availableAgents.has(targetId)) {
      const agentInfo = availableAgents.get(targetId);
      targetAgent = new Agent(targetId, agentInfo.systemPromptPath);
      agentInstances.set(targetId, targetAgent);
    }
    if (!targetAgent) {
      if (targetId !== 'orchestrator') {
        sendLog(socket, 'system', 'error', `Target agent ${targetId} not found. Routing to orchestrator.`);
      }
      targetAgent = orchestrator;
    }

    targetAgent.processMessage(data.content, socket, data.provider, data.images, targetSessionId).catch(err => {
      console.error(`[Session ${targetSessionId}] Execution error:`, err);
    });
  });

  socket.on('run_ollama_model', async (data) => {
    const { model } = data;
    if (!model) return;
    
    sendLog(socket, 'system', 'info', `Executing 'ollama run ${model}'...`);
    
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

  socket.on('stop_generation', (data = {}) => {
    const targetSession = data.sessionId || socket.currentSessionId || null;
    let stopped = 0;
    console.log(`[System] Stop requested. targetSession=${targetSession}`);
    
    if (targetSession && activeSessionRuns.has(targetSession)) {
      const run = activeSessionRuns.get(targetSession);
      run.abortController?.abort();
      activeSessionRuns.delete(targetSession);
      stopped++;
      io.emit('agent_status', { sessionId: targetSession, agentId: run.agentId, status: 'idle', message: 'Halted by user' });
      io.emit('session_working_status', { sessionId: targetSession, isWorking: false });
      broadcastTaskActivity(run.agentId, 'stop', 'Task stopped by user', { sessionId: targetSession }, targetSession);
      sendLog(socket, run.agentId, 'system', `⏹ Session ${targetSession} halted by user`, null, 'warning', targetSession);
      socket.emit('agent_message', { sessionId: targetSession, agentId: run.agentId, content: '_Generation stopped by user._', isTool: true });
      
      const anyRunningForAgent = Array.from(activeSessionRuns.values()).some(r => r.agentId === run.agentId);
      if (!anyRunningForAgent) {
        const ag = activeAgents.get(run.agentId);
        if (ag) ag.status = 'idle';
        io.emit('active_agents', Array.from(activeAgents.values()));
      }
    } else {
      for (const [sId, run] of activeSessionRuns.entries()) {
        run.abortController?.abort();
        activeSessionRuns.delete(sId);
        stopped++;
        io.emit('agent_status', { sessionId: sId, agentId: run.agentId, status: 'idle', message: 'Halted by user' });
        io.emit('session_working_status', { sessionId: sId, isWorking: false });
      }
      for (const [id, agent] of agentInstances.entries()) {
        agent.stop();
      }
      for (const [id, agent] of activeAgents.entries()) {
        agent.status = 'idle';
      }
      dbPromise.then(db => db.run("UPDATE active_agents SET status = 'idle'").catch(() => {}));
      io.emit('active_agents', Array.from(activeAgents.values()));
      getTrackerOverview().then(overview => io.emit('tracker_update', overview));
      sendLog(socket, 'orchestrator', 'system', `⏹ All generation stopped (${stopped} active runs halted)`, { stoppedCount: stopped }, 'warning');
    }
  });

  socket.on('cancel_agent_task', async ({ agentId }) => {
    console.log(`[System] Cancel requested for specific agent: ${agentId}`);
    const agent = agentInstances.get(agentId);
    if (agent) {
      agent.stop();
      agent.processing = false;
    }
    if (activeAgents.has(agentId)) {
      activeAgents.get(agentId).status = 'idle';
    }
    const db = await dbPromise;
    await db.run('UPDATE active_agents SET status = ? WHERE agentId = ?', ['idle', agentId]).catch(() => {});
    io.emit('agent_status', { agentId, status: 'idle', message: 'Task cancelled by user' });
    io.emit('active_agents', Array.from(activeAgents.values()));
    const overview = await getTrackerOverview();
    io.emit('tracker_update', overview);
    sendLog(socket, agentId, 'warning', `⏹ Agent task cancelled by user`);
  });

  socket.on('request_tracker_overview', async () => {
    const overview = await getTrackerOverview();
    socket.emit('tracker_overview', overview);
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
    const key = data.apiKey || data.key;
    if (key) {
      updateEnv('GEMINI_API_KEY', key);
      updateEnv('GOOGLE_API_KEY', key);
      sendKeyStatus();
      socket.emit('agent_message', { agentId: 'orchestrator', content: 'Google Gemini (Google AI Studio) API Key saved permanently to .env!' });
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

  socket.on('set_ollama_cloud_key', (data) => {
    const key = data.apiKey || data.key;
    if (key) {
      updateEnv('OLLAMA_API_KEY', key);
      sendKeyStatus();
      socket.emit('agent_message', { agentId: 'orchestrator', content: 'Primary Ollama Cloud API Key saved permanently to .env!' });
    }
  });

  socket.on('set_ollama_cloud_key_2', (data) => {
    const key = data.apiKey || data.key;
    if (key) {
      updateEnv('OLLAMA_API_KEY_2', key);
      sendKeyStatus();
      socket.emit('agent_message', { agentId: 'orchestrator', content: 'Backup Ollama Cloud API Key (OLLAMA_API_KEY_2) saved permanently to .env!' });
    }
  });

  socket.on('set_digitalocean_key', (data) => {
    const key = data.apiKey || data.key;
    if (key) {
      updateEnv('DIGITAL_OCEAN_API_KEY', key);
      sendKeyStatus();
      socket.emit('agent_message', { agentId: 'orchestrator', content: 'DigitalOcean API Key saved permanently to .env!' });
    }
  });

  socket.on('set_default_llm_provider', (data) => {
    const provider = data.provider;
    if (provider) {
      updateEnv('DEFAULT_LLM_PROVIDER', provider);
      if (data.model) {
        if (provider.startsWith('ollama_cloud')) {
          updateEnv('OLLAMA_CLOUD_MODEL', data.model);
        }
      }
      sendKeyStatus();
      socket.emit('agent_message', { agentId: 'orchestrator', content: `Default LLM Provider updated to: ${provider}` });
    }
  });

  // Model Router Socket Handlers
  socket.on('get_router_config', () => {
    socket.emit('router_config', getRouterConfig());
  });

  socket.on('update_router_config', async (data) => {
    try {
      const payload = data?.config || data;
      const res = await updateRouterConfig(payload);
      io.emit('router_config', getRouterConfig());
      socket.emit('agent_message', { agentId: 'orchestrator', content: 'Smart Hybrid Router configuration updated!' });
    } catch (e) {
      socket.emit('agent_message', { agentId: 'orchestrator', content: `Failed to update router config: ${e.message}` });
    }
  });

  socket.on('reset_router_config', async () => {
    try {
      await resetRouterConfig();
      io.emit('router_config', getRouterConfig());
      socket.emit('agent_message', { agentId: 'orchestrator', content: 'Smart Hybrid Router reset to system defaults.' });
    } catch (e) {
      socket.emit('agent_message', { agentId: 'orchestrator', content: `Failed to reset router config: ${e.message}` });
    }
  });

  socket.on('get_ollama_cloud_models', async () => {
    try {
      const models = await fetchOllamaCloudModels();
      socket.emit('ollama_cloud_models', { models });
    } catch (e) {
      socket.emit('ollama_cloud_models', { error: e.message, models: [] });
    }
  });

  socket.on('generate_agent_from_prompt', async (data) => {
    const { prompt } = data;
    sendLog(socket, 'orchestrator', 'api_request', `Generating agent config for: ${prompt}`);
    
    try {
      let configText = '';
      const agentGenPrompt = `Generate a specialized AI agent configuration based on this request: "${prompt}". 
      Return a JSON object with:
      - name: A short, catchy name
      - role: A professional role title
      - task: A detailed set of primary instructions (Markdown supported)
      - scope: What the agent should and should not do
      - memory: Any initial context or focus`;

      if (hasGeminiKey()) {
        try {
          const gRes = await generateGeminiContent({
            contents: agentGenPrompt,
            model: 'gemini-3.7-flash',
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
          configText = gRes.text?.trim() || '';
        } catch (gemErr) {
          console.warn('[AgentGen] Gemini AI Studio failed, falling back to Vertex AI:', gemErr.message);
        }
      }

      if (!configText) {
        const model = vertexAI.preview.getGenerativeModel({
          model: 'gemini-2.5-flash-lite',
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
        const result = await model.generateContent(agentGenPrompt);
        configText = result.response.candidates[0].content.parts[0].text;
      }

      const config = JSON.parse(configText);
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
      const systemPath = path.join(process.cwd(), 'agents', agentId, 'system.md');
      
      try {
        if (fs.existsSync(systemPath)) {
          systemPrompt = fs.readFileSync(systemPath, 'utf8');
        } else {
          const fallbackPath = path.join(process.cwd(), 'agents', 'orchestrator', 'system.md');
          systemPrompt = fs.existsSync(fallbackPath) ? fs.readFileSync(fallbackPath, 'utf8') : 'No rules defined.';
        }
      } catch (e) {
        systemPrompt = 'No rules defined.';
      }

      // Determine task path
      const taskPath = agentId === 'orchestrator'
        ? path.join(process.cwd(), 'tasks', 'current_task.md')
        : path.join(process.cwd(), 'tasks', `${agentId}_task.md`);
      
      try {
        if (fs.existsSync(taskPath)) {
          taskPrompt = fs.readFileSync(taskPath, 'utf8');
        } else {
          taskPrompt = 'No active task.';
        }
      } catch (e) {
        taskPrompt = 'No active task.';
      }

      // Get tools (Skills)
      const toolDecl = getToolDeclarations();
      const tools = (toolDecl && toolDecl[0] && toolDecl[0].functionDeclarations) ? toolDecl[0].functionDeclarations : [];

      // Get history (Memory)
      let longTermMemory = '';
      try {
        const memoryPath = path.join(process.cwd(), 'memory', `${agentId}_memory.md`);
        if (fs.existsSync(memoryPath)) {
          longTermMemory = fs.readFileSync(memoryPath, 'utf8');
        } else {
          longTermMemory = 'No long-term memory stored.';
        }
      } catch (e) {
        longTermMemory = 'No long-term memory stored.';
      }

      // Get scheduled jobs for this agent
      let jobs = [];
      try {
        const db = await dbPromise;
        jobs = await db.all('SELECT id, name, cron, task, status, lastRun, agentId FROM scheduled_jobs WHERE agentId = ? OR agentId = "orchestrator" ORDER BY id DESC', [agentId]);
      } catch (e) {
        console.error('Failed to load jobs for agent details:', e);
      }

      socket.emit('agent_details', {
        agentId,
        rules: systemPrompt,
        skills: tools,
        memory: {
          task: taskPrompt,
          longTerm: longTermMemory
        },
        jobs
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

  bot.start((ctx) => {
    lastTelegramChatId = ctx.chat.id;
    return ctx.reply('👋 Welcome to your Multi-Agent Personal Assistant!\n\nYou can send me:\n• 💬 Text messages & tasks\n• 🎙️ Voice notes (I will listen and reply in voice)\n• 📸 Photos for vision analysis\n• 📍 Location pins');
  });

  bot.help((ctx) => {
    lastTelegramChatId = ctx.chat.id;
    return ctx.reply('🤖 *FrAssist Telegram Assistant*:\n\n• Send any question, instruction, or task\n• Send voice notes to talk hands-free\n• Send photos with captions for visual understanding\n• Share location for local recommendations', { parse_mode: 'Markdown' });
  });
  
  bot.on('photo', async (ctx) => {
    lastTelegramChatId = ctx.chat.id;
    const actionCtrl = startChatAction(ctx, 'typing');
    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const fileLink = await ctx.telegram.getFileLink(photo.file_id);
      const caption = ctx.message.caption || 'Look at this image';
      const telegramSessionId = `telegram_${ctx.chat.id}`;
      
      // Download image as base64
      const response = await fetch(fileLink);
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const dataUrl = `data:image/jpeg;base64,${base64}`;

      await getOrCreateSession(telegramSessionId, 'telegram', 'orchestrator', caption);
      await recordMessageInSession(telegramSessionId, { role: 'user', content: caption, agentId: 'orchestrator', images: [dataUrl] });

      const mockSocket = {
        isMockSocket: true,
        emit: async (event, data) => {
          if (event === 'agent_log') {
            handleAdaptiveChatAction(actionCtrl, data);
          }
          if (event === 'agent_message' && !data.isTool) {
            await processTelegramAgentMessage(ctx, null, data);
          }
          if (event === 'agent_error') {
            await ctx.reply(`❌ Error: ${data.error}`).catch(() => {});
          }
        }
      };
      
      await orchestrator.processMessage(caption, mockSocket, 'gemini', [dataUrl], telegramSessionId);
    } catch (err) {
      console.error('[Telegram photo error]:', err);
      await ctx.reply(`❌ Failed to process photo: ${err.message}`).catch(() => {});
    } finally {
      actionCtrl.stop();
    }
  });

  bot.on('voice', async (ctx) => {
    lastTelegramChatId = ctx.chat.id;
    const actionCtrl = startChatAction(ctx, 'typing');
    const tempInOgg = path.join(process.cwd(), `tg_in_${Date.now()}.ogg`);
    const tempInWav = path.join(process.cwd(), `tg_in_${Date.now()}.wav`);
    const telegramSessionId = `telegram_${ctx.chat.id}`;
    
    try {
      const voice = ctx.message.voice;
      const fileLink = await ctx.telegram.getFileLink(voice.file_id);
      
      // Download voice buffer and transcode to 16kHz mono WAV for Gemini Multimodal
      const response = await fetch(fileLink);
      const buffer = await response.arrayBuffer();
      fs.writeFileSync(tempInOgg, Buffer.from(buffer));
      await execPromise(`ffmpeg -y -i "${tempInOgg}" -ar 16000 -ac 1 "${tempInWav}"`);
      const wavBase64 = fs.readFileSync(tempInWav).toString('base64');
      
      await getOrCreateSession(telegramSessionId, 'telegram', 'orchestrator', 'Voice Message');
      await recordMessageInSession(telegramSessionId, { role: 'user', content: '🎤 [Voice message]', agentId: 'orchestrator' });

      const mockSocket = {
        isMockSocket: true,
        emit: async (event, data) => {
          if (event === 'agent_log') {
            handleAdaptiveChatAction(actionCtrl, data);
          }
          if (event === 'agent_message' && !data.isTool) {
            let contentText = data.content || '';
            const imagesToSend = [];
            if (Array.isArray(data.images)) {
              for (const img of data.images) {
                if (img && !imagesToSend.includes(img)) imagesToSend.push(img);
              }
            }
            const mdImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
            let match;
            while ((match = mdImgRegex.exec(contentText)) !== null) {
              const imgUrl = match[2];
              if (imgUrl && !imagesToSend.includes(imgUrl)) imagesToSend.push(imgUrl);
            }
            contentText = contentText.replace(mdImgRegex, '').trim();

            if (contentText && contentText.trim() !== '') {
              const tempMp3 = path.join(process.cwd(), `voice_out_${Date.now()}.mp3`);
              const tempOgg = path.join(process.cwd(), `voice_out_${Date.now()}.ogg`);
              try {
                // Adaptive action: notify user we are generating voice
                actionCtrl.setAction('record_voice');
                const _tgText = contentText.replace(/\*/g, '').replace(/#/g, '').trim();
                const { mp3Buffer, voice: _tgVoice } = await googleTTS(_tgText);
                console.log(`[Telegram TTS] ${_tgVoice.name} (${_tgVoice.languageCode})`);
                fs.writeFileSync(tempMp3, mp3Buffer);
                await execPromise(`ffmpeg -y -i "${tempMp3}" -c:a libopus "${tempOgg}"`);
                await ctx.replyWithVoice({ source: tempOgg });
                await sendSafeTelegramMessage(ctx, null, contentText);
              } catch (e) {
                console.error('[Telegram Voice reply error]:', e);
                await sendSafeTelegramMessage(ctx, null, contentText);
              } finally {
                if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
                if (fs.existsSync(tempOgg)) fs.unlinkSync(tempOgg);
              }
            }

            for (const img of imagesToSend) {
              await sendSafeTelegramPhoto(ctx, null, img);
            }
          }
          if (event === 'agent_error') {
            await ctx.reply(`❌ Error: ${data.error}`).catch(() => {});
          }
        }
      };
      
      const audioInput = `data:audio/wav;base64,${wavBase64}`;
      await orchestrator.processMessage('Please listen to this voice message and respond.', mockSocket, 'gemini', [audioInput], telegramSessionId);
    } catch (err) {
      console.error('[Telegram voice error]:', err);
      await ctx.reply(`❌ Failed to process voice: ${err.message}`).catch(() => {});
    } finally {
      if (fs.existsSync(tempInOgg)) fs.unlinkSync(tempInOgg);
      if (fs.existsSync(tempInWav)) fs.unlinkSync(tempInWav);
      actionCtrl.stop();
    }
  });

  bot.on('text', async (ctx) => {
    lastTelegramChatId = ctx.chat.id;
    const text = ctx.message.text;
    const actionCtrl = startChatAction(ctx, 'typing');
    const telegramSessionId = `telegram_${ctx.chat.id}`;
    
    try {
      await getOrCreateSession(telegramSessionId, 'telegram', 'orchestrator', text);
      await recordMessageInSession(telegramSessionId, { role: 'user', content: text, agentId: 'orchestrator' });

      // Create a mock socket-like object to bridge Telegram to existing agent logic
      const mockSocket = {
        isMockSocket: true,
        emit: async (event, data) => {
          if (event === 'agent_log') {
            handleAdaptiveChatAction(actionCtrl, data);
          }
          if (event === 'agent_message' && !data.isTool) {
            await processTelegramAgentMessage(ctx, null, data);
          }
          if (event === 'agent_error') {
            await ctx.reply(`❌ Error: ${data.error}`).catch(() => {});
          }
        }
      };

      await orchestrator.processMessage(text, mockSocket, process.env.DEFAULT_LLM_PROVIDER || 'ollama_cloud', [], telegramSessionId);
    } catch (err) {
      console.error('[Telegram text error]:', err);
      await ctx.reply(`❌ Error: ${err.message}`).catch(() => {});
    } finally {
      actionCtrl.stop();
    }
  });

  bot.on('location', async (ctx) => {
    lastTelegramChatId = ctx.chat.id;
    const actionCtrl = startChatAction(ctx, 'typing');
    const telegramSessionId = `telegram_${ctx.chat.id}`;
    try {
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

      await getOrCreateSession(telegramSessionId, 'telegram', 'orchestrator', 'Location update');
      await recordMessageInSession(telegramSessionId, { role: 'user', content: locationMessage, agentId: 'orchestrator' });

      const mockSocket = {
        isMockSocket: true,
        emit: async (event, data) => {
          if (event === 'agent_log') {
            handleAdaptiveChatAction(actionCtrl, data);
          }
          if (event === 'agent_message' && !data.isTool) {
            await processTelegramAgentMessage(ctx, null, data);
          }
          if (event === 'agent_error') {
            await ctx.reply(`❌ Error: ${data.error}`).catch(() => {});
          }
        }
      };

      await orchestrator.processMessage(locationMessage, mockSocket, process.env.DEFAULT_LLM_PROVIDER || 'ollama_cloud', [], telegramSessionId);
    } catch (err) {
      console.error('[Telegram location error]:', err);
      await ctx.reply(`❌ Error: ${err.message}`).catch(() => {});
    } finally {
      actionCtrl.stop();
    }
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

// LLM Provider Management APIs
app.get('/api/llm/settings', (req, res) => {
  res.json({
    defaultProvider: process.env.DEFAULT_LLM_PROVIDER || 'ollama_cloud',
    defaultOllamaCloudModel: process.env.OLLAMA_CLOUD_MODEL || 'nemotron-3-nano:30b',
    keys: checkKeys()
  });
});

app.post('/api/llm/settings', (req, res) => {
  const { defaultProvider, defaultOllamaCloudModel, ollamaKey, ollamaKey2, digitaloceanKey, geminiKey, perplexityKey, tavilyKey, telegramToken, duffelKey } = req.body;
  if (defaultProvider) updateEnv('DEFAULT_LLM_PROVIDER', defaultProvider);
  if (defaultOllamaCloudModel) updateEnv('OLLAMA_CLOUD_MODEL', defaultOllamaCloudModel);
  if (ollamaKey) updateEnv('OLLAMA_API_KEY', ollamaKey);
  if (ollamaKey2) updateEnv('OLLAMA_API_KEY_2', ollamaKey2);
  if (digitaloceanKey) updateEnv('DIGITAL_OCEAN_API_KEY', digitaloceanKey);
  if (geminiKey) {
    updateEnv('GEMINI_API_KEY', geminiKey);
    updateEnv('GOOGLE_API_KEY', geminiKey);
  }
  if (perplexityKey) updateEnv('PERPLEXITY_API_KEY', perplexityKey);
  if (tavilyKey) updateEnv('TAVILY_API_KEY', tavilyKey);
  if (telegramToken) updateEnv('TELEGRAM_BOT_TOKEN', telegramToken);
  if (duffelKey) updateEnv('DUFFEL_API_KEY', duffelKey);

  io.emit('api_key_status', checkKeys());
  res.json({ success: true, settings: checkKeys() });
});

app.get('/api/llm/cloud-models', async (req, res) => {
  try {
    const models = await fetchOllamaCloudModels();
    return res.json({ models });
  } catch (err) {
    return res.status(500).json({ error: err.message, models: [] });
  }
});

app.get('/api/llm/router-config', (req, res) => {
  res.json({ success: true, config: getRouterConfig() });
});

app.post('/api/llm/router-config', async (req, res) => {
  try {
    const payload = req.body?.config || req.body;
    const result = await updateRouterConfig(payload);
    io.emit('router_config', getRouterConfig());
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/llm/router-reset', async (req, res) => {
  try {
    const result = await resetRouterConfig();
    io.emit('router_config', getRouterConfig());
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/llm/test-provider', async (req, res) => {
  const { provider, model } = req.body;
  const targetProvider = provider || process.env.DEFAULT_LLM_PROVIDER || 'auto';
  const startTime = Date.now();
  try {
    if (targetProvider === 'auto' || targetProvider === 'auto_hybrid' || targetProvider.startsWith('auto:')) {
      const sampleRoute = routeTask({
        message: 'Explain how the hybrid router operates',
        agentId: 'orchestrator'
      });
      const routedModel = sampleRoute.provider;
      return res.json({
        success: true,
        latency: Date.now() - startTime,
        model: `Auto -> ${getFriendlyModelName(routedModel)}`,
        reply: `Smart Auto-Router active (Category: ${sampleRoute.category.toUpperCase()}) • ${sampleRoute.reason}`
      });
    } else if (targetProvider.startsWith('ollama_cloud')) {
      const targetModel = model || (targetProvider.startsWith('ollama_cloud:') ? targetProvider.substring(13) : (process.env.OLLAMA_CLOUD_MODEL || 'nemotron-3-nano:30b'));
      let usedBackupKey = false;
      const testResult = await testOllamaCloudInference(targetModel, (info) => {
        usedBackupKey = true;
      });
      return res.json({
        success: true,
        latency: testResult.latency,
        model: targetModel,
        reply: testResult.reply,
        note: usedBackupKey ? 'Dispatched using backup key OLLAMA_API_KEY_2' : 'Dispatched using primary key OLLAMA_API_KEY'
      });
    } else if (targetProvider.startsWith('digitalocean') || targetProvider.startsWith('do')) {
      const { createChatCompletion } = await import('./services/digitalocean.js');
      const doModel = model || (targetProvider.startsWith('do:') ? targetProvider.substring(3) : undefined);
      const text = await createChatCompletion([{ role: 'user', content: 'Say "Ready" in one word.' }], { model: doModel });
      return res.json({ success: true, latency: Date.now() - startTime, model: doModel || 'default', reply: text.trim().slice(0, 100) });
    } else if (targetProvider === 'gemini' || targetProvider === 'gemini_api' || targetProvider.startsWith('gemini:') || targetProvider.startsWith('gemini_api:')) {
      const gemModel = targetProvider.startsWith('gemini:')
        ? targetProvider.substring(7)
        : (targetProvider.startsWith('gemini_api:') ? targetProvider.substring(11) : (model || 'gemini-3.7-flash'));

      if (hasGeminiKey()) {
        const testRes = await testGeminiInference(gemModel);
        return res.json({
          success: true,
          latency: testRes.latency,
          model: testRes.model,
          reply: testRes.reply,
          note: 'Inference verified via Google AI Studio API (GEMINI_API_KEY)'
        });
      } else {
        const genAIModel = vertexAI.preview.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
        const result = await genAIModel.generateContent('Say "Ready" in one word.');
        const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text || 'Connected';
        return res.json({ success: true, latency: Date.now() - startTime, model: 'gemini-2.5-flash-lite (Vertex)', reply: text.trim().slice(0, 100) });
      }
    } else {
      return res.json({ success: true, latency: Date.now() - startTime, provider: targetProvider, reply: 'Provider OK' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, latency: Date.now() - startTime });
  }
});

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
    
    // Add today's live token stats in local timezone
    const todayRow = await db.get(`
      SELECT 
        COALESCE(SUM(promptTokens), 0) as today_input_tokens,
        COALESCE(SUM(candidatesTokens), 0) as today_output_tokens,
        COALESCE(SUM(totalTokens), 0) as today_total_tokens,
        COUNT(*) as today_requests
      FROM token_usage_log
      WHERE date(timestamp, 'localtime') = date('now', 'localtime')
    `);

    res.json({
      ...stats,
      ...(todayRow || { today_input_tokens: 0, today_output_tokens: 0, today_total_tokens: 0, today_requests: 0 })
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/stats/detailed', async (req, res) => {
  try {
    const db = await dbPromise;
    // Group by local date (YYYY-MM-DD) and agentId
    const rows = await db.all(`
      SELECT 
        date(timestamp, 'localtime') as date, 
        agentId, 
        SUM(promptTokens) as inputTokens, 
        SUM(candidatesTokens) as outputTokens,
        SUM(totalTokens) as totalTokens,
        COUNT(*) as requests
      FROM token_usage_log 
      GROUP BY date(timestamp, 'localtime'), agentId
      ORDER BY date DESC, totalTokens DESC
      LIMIT 100
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch detailed stats' });
  }
});

// --- SYSTEM & AGENT HEALTH CHECK ENDPOINTS ---
app.get('/api/health', async (req, res) => {
  try {
    const db = await dbPromise;
    let dbStatus = 'healthy';
    try {
      await db.get('SELECT 1');
    } catch (e) {
      dbStatus = 'degraded: ' + e.message;
    }

    const activeRunsList = Array.from(activeSessionRuns.entries()).map(([sessionId, run]) => ({
      sessionId,
      agentId: run.agentId,
      elapsedSeconds: Math.floor((Date.now() - (run.startTime || Date.now())) / 1000),
      isWorking: true
    }));

    const memoryUsage = process.memoryUsage();

    res.json({
      status: 'healthy',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      database: dbStatus,
      activeSessionsRunning: activeRunsList.length,
      activeRuns: activeRunsList,
      activeAgents: Array.from(activeAgents.values()),
      memory: {
        rssMb: (memoryUsage.rss / 1024 / 1024).toFixed(1),
        heapUsedMb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(1),
        heapTotalMb: (memoryUsage.heapTotal / 1024 / 1024).toFixed(1)
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

app.get('/api/health/agents', (req, res) => {
  const agentsStatus = Array.from(activeAgents.values()).map(a => {
    const isCurrentlyRunning = Array.from(activeSessionRuns.values()).some(r => r.agentId === a.id);
    return {
      ...a,
      status: isCurrentlyRunning ? 'working' : a.status || 'idle'
    };
  });
  res.json({
    agents: agentsStatus,
    activeRuns: Array.from(activeSessionRuns.values()).map(r => ({
      sessionId: r.sessionId,
      agentId: r.agentId,
      elapsedSeconds: Math.floor((Date.now() - (r.startTime || Date.now())) / 1000)
    }))
  });
});

// --- TRACKER & OPERATIONS ENDPOINTS ---
app.get('/api/tracker/overview', async (req, res) => {
  try {
    const overview = await getTrackerOverview();
    res.json(overview);
  } catch (e) {
    res.status(500).json({ error: `Failed to fetch tracker overview: ${e.message}` });
  }
});

app.get('/api/approvals', async (req, res) => {
  try {
    const db = await dbPromise;
    const approvals = await db.all('SELECT * FROM pending_approvals ORDER BY id DESC');
    res.json(approvals);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

app.post('/api/approvals', async (req, res) => {
  try {
    const { agentId = 'orchestrator', title, description = '', content = '', type = 'draft_review' } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'title and content are required' });
    const db = await dbPromise;
    const result = await db.run(
      'INSERT INTO pending_approvals (agentId, title, description, content, type, status) VALUES (?, ?, ?, ?, ?, ?)',
      [agentId, title, description, content, type, 'pending']
    );
    const newApproval = { id: result.lastID, agentId, title, description, content, type, status: 'pending', createdAt: new Date().toISOString() };
    io.emit('pending_approval_created', newApproval);
    getTrackerOverview().then(overview => io.emit('tracker_update', overview));
    res.json(newApproval);
  } catch (e) {
    res.status(500).json({ error: `Failed to create approval: ${e.message}` });
  }
});

app.post('/api/approvals/:id/action', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, editedContent, notes } = req.body; // action: 'approve' | 'reject' | 'edit'
    const db = await dbPromise;
    const approval = await db.get('SELECT * FROM pending_approvals WHERE id = ?', [id]);
    if (!approval) return res.status(404).json({ error: 'Approval item not found' });

    let newStatus = approval.status;
    let finalContent = approval.content;

    if (action === 'approve') {
      newStatus = 'approved';
      if (editedContent) finalContent = editedContent;

      if (approval.type === 'memory_update') {
        const memoryDir = path.join(process.cwd(), 'memory');
        if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });
        const memoryPath = path.join(memoryDir, 'orchestrator_memory.md');
        fs.writeFileSync(memoryPath, finalContent);
        sendLog(null, 'orchestrator', 'system', 'Long-term memory (orchestrator_memory.md) updated after user approval.');
      }
    } else if (action === 'reject') {
      newStatus = 'rejected';
    } else if (action === 'edit') {
      if (editedContent) finalContent = editedContent;
    }

    await db.run(
      'UPDATE pending_approvals SET status = ?, content = ?, updatedAt = ? WHERE id = ?',
      [newStatus, finalContent, new Date().toISOString(), id]
    );

    const updated = { ...approval, status: newStatus, content: finalContent, updatedAt: new Date().toISOString() };
    io.emit('pending_approval_updated', updated);
    
    // Broadcast status change log
    const agentId = approval.agentId || 'orchestrator';
    sendLog(null, agentId, 'info', `User ${action.toUpperCase()} approval #${id} ("${approval.title}")${notes ? ': ' + notes : ''}`);
    
    // Notify chat
    io.emit('agent_message', {
      sessionId: approval.sessionId || 'session_default',
      agentId: 'orchestrator',
      content: `User marked approval #${id} (*${approval.title}*) as **${newStatus.toUpperCase()}**.${notes ? ' Note: ' + notes : ''}`,
      isTool: true
    });

    // Reset agent status back to idle if it was waiting_approval
    if (activeAgents.has(agentId) && activeAgents.get(agentId).status === 'waiting_approval') {
      activeAgents.get(agentId).status = 'idle';
      io.emit('agent_status', { agentId, status: 'idle' });
      io.emit('active_agents', Array.from(activeAgents.values()));
    }

    // FIX: Inject continuation trigger so the orchestrator resumes the next workflow step
    // automatically after approval — without requiring a manual user nudge.
    if (action === 'approve' && ['draft_review', 'action_approval', 'email_draft', 'telegram_draft'].includes(approval.type)) {
      try {
        const db2 = await dbPromise;
        const lastSession = await db2.get(
          `SELECT id FROM chat_sessions WHERE (target_agent = ? OR target_agent = 'orchestrator' OR target_agent IS NULL)
           ORDER BY updated_at DESC LIMIT 1`,
          [agentId]
        );
        const resumeSessionId = lastSession?.id || 'session_default';
        const targetAgent = agentInstances.get(agentId) || orchestrator;

        const continuationMessage =
          `[SYSTEM: Approval #${id} ("${approval.title}") was just APPROVED by the user. ` +
          `Immediately continue to the NEXT step of the workflow without asking for confirmation. ` +
          `If this is a blog post draft, publish it directly to the active project Supabase database (table: 'blog_posts') using supabase_action. ` +
          `The approved content follows:\n\n${finalContent}\n\nProceed now.]`;

        const mockSocket = {
          isMockSocket: true,
          emit: (event, data) => {
            if (typeof io !== 'undefined') io.emit(event, data);
          }
        };

        sendLog(mockSocket, agentId, 'system',
          `Approval #${id} granted — injecting continuation trigger into session ${resumeSessionId}`,
          { approvalId: id, sessionId: resumeSessionId }
        );

        // Ensure session is unlocked so continuation can start immediately
        if (activeSessionRuns.has(resumeSessionId)) {
          activeSessionRuns.delete(resumeSessionId);
        }

        // Non-blocking: fire-and-forget so the HTTP response returns immediately
        setImmediate(() => {
          targetAgent.processMessage(continuationMessage, mockSocket, process.env.DEFAULT_LLM_PROVIDER || 'ollama_cloud', [], resumeSessionId)
            .catch(e => console.error(`[Approval Continuation Error] Approval #${id}:`, e));
        });
      } catch (continuationErr) {
        console.error('[Approval Continuation] Failed to inject continuation trigger:', continuationErr);
      }
    }

    const overview = await getTrackerOverview();
    io.emit('tracker_update', overview);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: `Failed to process approval action: ${e.message}` });
  }
});

app.get('/api/jobs', async (req, res) => {
  try {
    const db = await dbPromise;
    const jobs = await db.all('SELECT * FROM scheduled_jobs ORDER BY id DESC');
    res.json(jobs);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

app.post('/api/jobs', async (req, res) => {
  try {
    const { name: jobName, cron: cronExpr, task, agentId = 'orchestrator' } = req.body;
    if (!cronExpr || !task) return res.status(400).json({ error: 'cron and task are required' });
    if (!cron.validate(cronExpr)) return res.status(400).json({ error: 'Invalid cron expression' });

    const db = await dbPromise;
    const result = await db.run(
      'INSERT INTO scheduled_jobs (name, cron, task, agentId) VALUES (?, ?, ?, ?)',
      [jobName || 'Unnamed Job', cronExpr, task, agentId]
    );
    const newJobId = result.lastID;
    scheduleCronJob(newJobId, cronExpr, task, jobName, agentId);
    
    const overview = await getTrackerOverview();
    io.emit('tracker_update', overview);
    res.json({ id: newJobId, name: jobName, cron: cronExpr, task, agentId, status: 'active' });
  } catch (e) {
    res.status(500).json({ error: `Failed to create job: ${e.message}` });
  }
});

app.post('/api/jobs/:id/run-now', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await runJobNow(Number(id));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: `Failed to trigger job: ${e.message}` });
  }
});

app.post('/api/jobs/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const db = await dbPromise;
    const job = await db.get('SELECT * FROM scheduled_jobs WHERE id = ?', [id]);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const newStatus = job.status === 'active' ? 'paused' : 'active';
    await db.run('UPDATE scheduled_jobs SET status = ? WHERE id = ?', [newStatus, id]);

    if (newStatus === 'paused' && scheduledCronTasks.has(Number(id))) {
      scheduledCronTasks.get(Number(id)).stop();
      scheduledCronTasks.delete(Number(id));
    } else if (newStatus === 'active') {
      scheduleCronJob(Number(id), job.cron, job.task, job.name, job.agentId || 'orchestrator');
    }

    const overview = await getTrackerOverview();
    io.emit('tracker_update', overview);
    res.json({ id: Number(id), status: newStatus });
  } catch (e) {
    res.status(500).json({ error: `Failed to toggle job: ${e.message}` });
  }
});

app.put('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const jobId = Number(id);
    const { name: jobName, cron: cronExpr, task, agentId = 'orchestrator' } = req.body;

    if (!cronExpr || !task) return res.status(400).json({ error: 'cron and task are required' });
    if (!cron.validate(cronExpr)) return res.status(400).json({ error: 'Invalid cron expression' });

    const db = await dbPromise;
    const job = await db.get('SELECT * FROM scheduled_jobs WHERE id = ?', [jobId]);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const finalName = jobName || job.name || 'Unnamed Job';
    await db.run(
      'UPDATE scheduled_jobs SET name = ?, cron = ?, task = ?, agentId = ? WHERE id = ?',
      [finalName, cronExpr, task, agentId, jobId]
    );

    if (scheduledCronTasks.has(jobId)) {
      scheduledCronTasks.get(jobId).stop();
      scheduledCronTasks.delete(jobId);
    }

    if (job.status === 'active') {
      scheduleCronJob(jobId, cronExpr, task, finalName, agentId);
    }

    const overview = await getTrackerOverview();
    io.emit('tracker_update', overview);
    res.json({ id: jobId, name: finalName, cron: cronExpr, task, agentId, status: job.status });
  } catch (e) {
    res.status(500).json({ error: `Failed to update job: ${e.message}` });
  }
});

app.delete('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const jobId = Number(id);
    if (scheduledCronTasks.has(jobId)) {
      scheduledCronTasks.get(jobId).stop();
      scheduledCronTasks.delete(jobId);
    }
    const db = await dbPromise;
    await db.run('DELETE FROM scheduled_jobs WHERE id = ?', [jobId]);
    const overview = await getTrackerOverview();
    io.emit('tracker_update', overview);
    res.json({ status: 'Job deleted', id: jobId });
  } catch (e) {
    res.status(500).json({ error: `Failed to delete job: ${e.message}` });
  }
});

app.post('/api/agents/:id/cancel', async (req, res) => {
  try {
    const { id: agentId } = req.params;
    const agent = agentInstances.get(agentId);
    if (agent) {
      agent.stop();
      agent.processing = false;
    }
    if (activeAgents.has(agentId)) {
      activeAgents.get(agentId).status = 'idle';
    }
    const db = await dbPromise;
    await db.run('UPDATE active_agents SET status = ? WHERE agentId = ?', ['idle', agentId]).catch(() => {});
    io.emit('agent_status', { agentId, status: 'idle', message: 'Halted by user' });
    io.emit('active_agents', Array.from(activeAgents.values()));
    const overview = await getTrackerOverview();
    io.emit('tracker_update', overview);
    res.json({ status: 'Agent stopped', agentId });
  } catch (e) {
    res.status(500).json({ error: `Failed to cancel agent: ${e.message}` });
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

app.get('/api/whatsapp/export', async (req, res) => {
  try {
    const result = await exportAllWhatsAppConversationsToJson();
    res.download(result.filePath, 'whatsapp_conversations_export.json');
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/clear-chat', async (req, res) => {
  try {
    const { remoteJid, phone } = req.body || {};
    const target = remoteJid || phone;
    if (!target) {
      return res.status(400).json({ error: 'remoteJid or phone is required' });
    }
    const result = await clearWhatsAppChatHistory(target);
    const chats = await getWhatsAppChats();
    io.emit('whatsapp_chats_list', { chats });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// WhatsApp Scheduled Messages REST API
app.get('/api/whatsapp/scheduled', async (req, res) => {
  try {
    const { status, remoteJid, limit } = req.query;
    const scheduledMessages = await getScheduledWhatsAppMessages({
      status,
      remoteJid,
      limit: limit ? parseInt(limit, 10) : 100
    });
    res.json({ success: true, scheduledMessages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/whatsapp/schedule', async (req, res) => {
  try {
    const { recipient, remoteJid, phone, text, scheduledAt, securityCode, createdBy } = req.body || {};
    const result = await scheduleWhatsAppMessage({
      recipient,
      remoteJid,
      phone,
      text,
      scheduledAt,
      securityCode,
      createdBy: createdBy || 'api'
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/whatsapp/scheduled/:id/cancel', async (req, res) => {
  try {
    const result = await cancelScheduledWhatsAppMessage(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/whatsapp/scheduled/:id/send-now', async (req, res) => {
  try {
    const { securityCode } = req.body || {};
    const result = await sendScheduledWhatsAppMessageNow(req.params.id, securityCode);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/whatsapp/scheduled/:id', async (req, res) => {
  try {
    const result = await deleteScheduledWhatsAppMessage(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
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

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3001;

const startServer = (port) => {
  const numericPort = parseInt(port, 10) || 3001;
  httpServer.removeAllListeners('error');
  httpServer.removeAllListeners('listening');

  httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = numericPort + 1;
      console.log(`Port ${numericPort} is in use, trying ${nextPort}...`);
      startServer(nextPort);
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

