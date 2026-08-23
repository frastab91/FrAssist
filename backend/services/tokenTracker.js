import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

let dbInstance = null;
let ioInstance = null;

export function setTokenTrackerIO(io) {
  ioInstance = io;
}

export function setTokenTrackerDb(db) {
  dbInstance = db;
}

async function getDb() {
  if (dbInstance) return dbInstance;
  dbInstance = await open({
    filename: path.join(process.cwd(), 'database.sqlite'),
    driver: sqlite3.Database
  });
  return dbInstance;
}

/**
 * Estimate token count based on text length if API usage metadata is missing (~4 chars per token)
 */
export function estimateTokens(text = '') {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Record token usage into database.sqlite (token_usage_log and system_stats)
 * and broadcast the updated stats via Socket.io if available.
 * 
 * @param {string} agentId - Identifier of agent or service (e.g. 'orchestrator', 'digitalocean_router', 'whatsapp_concierge')
 * @param {number} promptTokens - Input tokens
 * @param {number} candidatesTokens - Output tokens
 * @param {number} [totalTokens] - Total tokens (defaults to prompt + candidates)
 * @param {string} [model] - Model name (e.g. 'router:frassistrouter', 'gemini-2.5-flash', 'openai-gpt-oss-120b')
 */
export async function recordTokenUsage(agentId = 'orchestrator', promptTokens = 0, candidatesTokens = 0, totalTokens = null, model = 'unknown') {
  const pTokens = Math.max(0, parseInt(promptTokens, 10) || 0);
  const cTokens = Math.max(0, parseInt(candidatesTokens, 10) || 0);
  const tTokens = Math.max(pTokens + cTokens, parseInt(totalTokens, 10) || (pTokens + cTokens));

  if (tTokens <= 0) return;

  try {
    const db = await getDb();
    
    // Ensure table and columns exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS token_usage_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agentId TEXT,
        promptTokens INTEGER,
        candidatesTokens INTEGER,
        totalTokens INTEGER,
        model TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS system_stats (
        key TEXT PRIMARY KEY,
        value INTEGER DEFAULT 0
      );
    `);

    // Ensure model column exists if table was created in older schema
    try {
      await db.exec(`ALTER TABLE token_usage_log ADD COLUMN model TEXT`);
    } catch (_) {
      // Column already exists
    }

    await db.run('UPDATE system_stats SET value = COALESCE(value, 0) + ? WHERE key = ?', [pTokens, 'total_input_tokens']);
    await db.run('UPDATE system_stats SET value = COALESCE(value, 0) + ? WHERE key = ?', [cTokens, 'total_output_tokens']);
    await db.run('UPDATE system_stats SET value = COALESCE(value, 0) + 1 WHERE key = ?', ['total_requests']);

    await db.run(
      'INSERT INTO token_usage_log (agentId, promptTokens, candidatesTokens, totalTokens, model) VALUES (?, ?, ?, ?, ?)',
      [agentId, pTokens, cTokens, tTokens, model || 'unknown']
    );

    const rows = await db.all('SELECT * FROM system_stats');
    const stats = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
    
    if (ioInstance) {
      ioInstance.emit('system_stats', stats);
    }
    
    return stats;
  } catch (err) {
    console.error('[TokenTracker] Error recording token usage:', err.message);
  }
}

export default {
  recordTokenUsage,
  estimateTokens,
  setTokenTrackerIO,
  setTokenTrackerDb
};
