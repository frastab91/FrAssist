/**
 * FrAssist Native Hybrid Model Router
 * Dynamically routes prompts and agent tasks to the optimal LLM provider & model
 * based on modality, context length, agent role, and intent heuristics (<5ms latency).
 */

import { estimateTokens } from './tokenTracker.js';

export const DEFAULT_ROUTER_CONFIG = {
  fast_chat: 'ollama_cloud:gemma4:31b-cloud',
  coding: 'ollama_cloud:kimi-k2.7-code:cloud',
  heavy_vision: 'gemini',
  research: 'ollama_cloud:qwen3.5:397b-cloud',
  general: 'ollama_cloud:deepseek-v4-flash:cloud',
  maxFastTokens: 32000,
  enableSmartRouting: true
};

let activeConfig = { ...DEFAULT_ROUTER_CONFIG };
let routerDb = null;

/**
 * Assign active database connection for router config persistence.
 */
export function setRouterDb(db) {
  routerDb = db;
  initRouterSettingsTable(db).catch(err => {
    console.error('[ModelRouter] Error initializing router_settings table:', err.message);
  });
}

/**
 * Initialize router_settings SQLite table and load persisted config.
 */
async function initRouterSettingsTable(db) {
  if (!db) return;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS router_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const rows = await db.all('SELECT key, value FROM router_settings');
  for (const row of rows) {
    if (row.key in activeConfig) {
      if (row.key === 'maxFastTokens') {
        activeConfig[row.key] = parseInt(row.value, 10) || DEFAULT_ROUTER_CONFIG.maxFastTokens;
      } else if (row.key === 'enableSmartRouting') {
        activeConfig[row.key] = row.value === 'true' || row.value === '1';
      } else {
        activeConfig[row.key] = row.value;
      }
    }
  }
  console.log('[ModelRouter] Configuration loaded:', activeConfig);
}

/**
 * Get the current active router configuration.
 */
export function getRouterConfig() {
  return { ...activeConfig };
}

/**
 * Update the router configuration in memory and persist to database.
 */
export async function updateRouterConfig(newConfig, db = routerDb) {
  if (!newConfig || typeof newConfig !== 'object') {
    throw new Error('Invalid router configuration payload');
  }

  const allowedKeys = ['fast_chat', 'coding', 'heavy_vision', 'research', 'general', 'maxFastTokens', 'enableSmartRouting'];
  for (const key of allowedKeys) {
    if (newConfig[key] !== undefined) {
      activeConfig[key] = newConfig[key];
      if (db) {
        await db.run(
          `INSERT INTO router_settings (key, value, updated_at)
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
          [key, String(newConfig[key]), String(newConfig[key])]
        );
      }
    }
  }

  console.log('[ModelRouter] Configuration updated and persisted:', activeConfig);
  return { success: true, config: getRouterConfig() };
}

/**
 * Reset router configuration to system defaults.
 */
export async function resetRouterConfig(db = routerDb) {
  activeConfig = { ...DEFAULT_ROUTER_CONFIG };
  if (db) {
    await db.run('DELETE FROM router_settings');
  }
  console.log('[ModelRouter] Configuration reset to defaults.');
  return { success: true, config: getRouterConfig() };
}

/**
 * Detects if a text prompt has coding/technical intent.
 */
function isCodingIntent(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  // Strong code indicators
  if (text.includes('```') || text.includes('function ') || text.includes('const ') || text.includes('import ') || text.includes('class ')) {
    return true;
  }
  
  // Technical keywords
  const codeKeywords = [
    'typescript', 'javascript', 'python', 'refactor', 'bug', 'error', 'exception',
    'stack trace', 'syntax', 'regex', 'sql query', 'dockerfile', 'endpoint',
    'component', 'pull request', 'github', 'git commit', 'unit test', 'api route',
    'scrivi codice', 'correggi il codice', 'programma in', 'crea uno script', 'funzione js'
  ];

  return codeKeywords.some(kw => lower.includes(kw));
}

/**
 * Detects if a text prompt requires real-time web search or research.
 */
function isResearchIntent(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  
  const searchKeywords = [
    'cerca su internet', 'cerca online', 'cerca sul web', 'search online', 'search the web',
    'latest news', 'ultime notizie', 'previsioni meteo', 'current weather',
    'chi è il presidente', 'tavily', 'fonti web', 'trova informazioni su',
    'live price', 'stock price', 'prezzo aggiornato'
  ];

  return searchKeywords.some(kw => lower.includes(kw));
}

/**
 * Detects if a text prompt is brief conversational dialogue.
 */
function isConversationalIntent(text) {
  if (!text) return false;
  const trimmed = text.trim().toLowerCase();
  
  if (trimmed.length < 80) {
    const greetingPhrases = [
      'ciao', 'buongiorno', 'buonasera', 'salve', 'hello', 'hi', 'hey',
      'grazie', 'thank you', 'thanks', 'perfetto', 'ottimo', 'ok', 'va bene',
      'come stai', 'how are you', 'chi sei', 'who are you', 'cosa puoi fare',
      'test', 'prova'
    ];
    if (greetingPhrases.some(p => trimmed === p || trimmed.startsWith(p + ' ') || trimmed.startsWith(p + '!') || trimmed.startsWith(p + '?'))) {
      return true;
    }
  }

  return false;
}

/**
 * Route a task or message dynamically to the best provider & model.
 * 
 * @param {Object} params
 * @param {string} [params.message=''] - Incoming user or guest message
 * @param {Array} [params.history=[]] - Session history array
 * @param {Array} [params.images=[]] - Attached image/media files
 * @param {string} [params.agentId='orchestrator'] - Executing agent identifier
 * @param {string} [params.channel='web'] - Request channel ('web', 'whatsapp', 'telegram', 'cron')
 * @param {string} [params.requestedProvider='auto'] - Provider requested by caller
 * @returns {{ provider: string, model?: string, category: string, reason: string, isAuto: boolean, confidence: number }}
 */
export function routeTask({
  message = '',
  history = [],
  images = [],
  agentId = 'orchestrator',
  channel = 'web',
  requestedProvider = 'auto'
} = {}) {
  const config = getRouterConfig();

  // If caller specified an explicit provider that is NOT auto, respect it directly
  const isAutoMode = !requestedProvider || 
    requestedProvider === 'auto' || 
    requestedProvider === 'auto_hybrid' || 
    requestedProvider === 'smart' ||
    requestedProvider.startsWith('auto:');

  if (!isAutoMode) {
    return {
      provider: requestedProvider,
      category: 'manual_override',
      reason: 'Manual provider override selected by user',
      isAuto: false,
      confidence: 1.0
    };
  }

  // -------------------------------------------------------------
  // Tier 0: Hard Capability & Modality Constraints (Instant, 0ms)
  // -------------------------------------------------------------

  // 1. Multimodal Images / Media attached
  if (images && images.length > 0) {
    const target = config.heavy_vision || 'gemini';
    return {
      provider: target,
      category: 'heavy_vision',
      reason: `Multimodal attachment detected (${images.length} image/media items). Routed to vision-enabled model.`,
      isAuto: true,
      confidence: 1.0
    };
  }

  // 2. Ego-Browser / Autonomous Navigation commands
  const rawMsg = (message || '').trim();
  if (rawMsg.startsWith('/ego ') || rawMsg.startsWith('/browse ') || rawMsg.includes('ego-browser') || rawMsg.includes('agent-browser')) {
    const target = config.heavy_vision || 'gemini';
    return {
      provider: target,
      category: 'heavy_vision',
      reason: 'Autonomous browser tool execution requires high-reliability reasoning.',
      isAuto: true,
      confidence: 0.98
    };
  }

  // 3. Token Budget / Context Window Overflow Check
  let historyString = '';
  if (Array.isArray(history)) {
    historyString = history.map(h => {
      if (h && h.parts) {
        return h.parts.filter(p => p && p.text).map(p => p.text).join('\n');
      }
      return typeof h === 'string' ? h : (h.content || '');
    }).join('\n');
  }

  const estimatedTokens = estimateTokens(historyString + '\n' + rawMsg);
  const maxFastThreshold = config.maxFastTokens || 32000;
  if (estimatedTokens > maxFastThreshold) {
    const target = config.heavy_vision || 'gemini';
    return {
      provider: target,
      category: 'heavy_vision',
      reason: `Context payload exceeds threshold (~${estimatedTokens} tokens > ${maxFastThreshold}). Routed to 1M+ context window model.`,
      isAuto: true,
      confidence: 1.0
    };
  }

  // -------------------------------------------------------------
  // Tier 1: Agent & Role Specialization
  // -------------------------------------------------------------

  if (agentId === 'researcher') {
    const target = config.research || 'ollama_cloud:qwen3.5:397b-cloud';
    return {
      provider: target,
      category: 'research',
      reason: 'Researcher agent specialized in live web grounding & synthesis.',
      isAuto: true,
      confidence: 0.95
    };
  }

  if (agentId === 'developer') {
    const target = config.coding || 'ollama_cloud:kimi-k2.7-code:cloud';
    return {
      provider: target,
      category: 'coding',
      reason: 'Developer agent specialized in code syntax, Playwright flows, and debugging.',
      isAuto: true,
      confidence: 0.95
    };
  }

  if (agentId === 'copy_editor_expert') {
    const target = config.fast_chat || 'ollama_cloud:gemma4:31b-cloud';
    return {
      provider: target,
      category: 'fast_chat',
      reason: 'Copy editor agent specialized in rapid text refinement.',
      isAuto: true,
      confidence: 0.90
    };
  }

  if (agentId === 'vacation_rental_manager') {
    const target = config.fast_chat || 'ollama_cloud:minimax-m3:cloud';
    return {
      provider: target,
      category: 'fast_chat',
      reason: 'Vacation rental concierge with multilingual RAG knowledge grounding.',
      isAuto: true,
      confidence: 0.90
    };
  }

  // -------------------------------------------------------------
  // Tier 2: Intent & Complexity Heuristics (<5ms)
  // -------------------------------------------------------------

  // Check Coding Intent
  if (isCodingIntent(rawMsg)) {
    const target = config.coding || 'ollama_cloud:glm-5.2:cloud';
    return {
      provider: target,
      category: 'coding',
      reason: 'Detected code syntax, programming task, or technical refactoring intent.',
      isAuto: true,
      confidence: 0.90
    };
  }

  // Check Research / Web Search Intent
  if (isResearchIntent(rawMsg)) {
    const target = config.research || 'ollama_cloud:qwen3.5:397b-cloud';
    return {
      provider: target,
      category: 'research',
      reason: 'Detected real-time internet search or factual lookup intent.',
      isAuto: true,
      confidence: 0.88
    };
  }

  // Check Brief Conversational Intent / WhatsApp Auto-reply
  if (channel === 'whatsapp' || isConversationalIntent(rawMsg)) {
    const target = config.fast_chat || 'ollama_cloud:gemma4:31b-cloud';
    return {
      provider: target,
      category: 'fast_chat',
      reason: channel === 'whatsapp' 
        ? 'WhatsApp messaging channel optimized for low-latency conversational replies.'
        : 'Brief conversational inquiry (sub-300ms low latency model).',
      isAuto: true,
      confidence: 0.85
    };
  }

  // Default / General multi-turn reasoning fallback
  const target = config.general || config.fast_chat || 'ollama_cloud:gemma4:31b';
  return {
    provider: target,
    category: 'general',
    reason: 'General assistant task matched with default balanced model.',
    isAuto: true,
    confidence: 0.80
  };
}

/**
 * Returns human-readable label for a provider or model string.
 */
export function getFriendlyModelName(providerStr) {
  if (!providerStr) return 'Auto-Router';
  if (providerStr === 'auto' || providerStr === 'auto_hybrid') return 'Smart Hybrid Auto-Router';
  if (providerStr === 'gemini') return 'Google Gemini 3.7 Flash (AI Studio)';
  if (providerStr === 'gemini:gemini-3.8-flash' || providerStr === 'gemini:gemini-3.8') return 'Google Gemini 3.8 Flash';
  if (providerStr === 'gemini:gemini-3.7-flash') return 'Google Gemini 3.7 Flash (AI Studio)';
  if (providerStr === 'gemini:gemini-3.6-flash') return 'Google Gemini 3.6 Flash (AI Studio)';
  if (providerStr === 'gemini:gemini-flash-latest') return 'Google Gemini Flash Latest (AI Studio)';
  if (providerStr.startsWith('gemini:')) return `Google Gemini (${providerStr.substring(7)})`;
  if (providerStr === 'gemini_api') return 'Google Gemini (Google AI Studio)';
  if (providerStr.startsWith('gemini_api:')) return `Google Gemini (${providerStr.substring(11)})`;
  if (providerStr.startsWith('vertex:')) return `Google Vertex AI (${providerStr.substring(7)})`;
  if (providerStr === 'digitalocean') return 'DigitalOcean GenAI (General Router)';
  if (providerStr.startsWith('do:')) return `DigitalOcean (${providerStr.substring(3)})`;
  if (providerStr.startsWith('ollama_cloud:')) return `Ollama Cloud (${providerStr.substring(13)})`;
  if (providerStr.startsWith('ollama:')) return `Local Ollama (${providerStr.substring(7)})`;
  if (providerStr === 'ollama') return 'Local Ollama';
  if (providerStr === 'perplexity') return 'Google Gemini (Research)';
  return providerStr;
}

export default {
  DEFAULT_ROUTER_CONFIG,
  setRouterDb,
  getRouterConfig,
  updateRouterConfig,
  resetRouterConfig,
  routeTask,
  getFriendlyModelName
};
