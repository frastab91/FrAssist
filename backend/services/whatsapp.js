import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { VertexAI } from '@google-cloud/vertexai';
import { formatKnowledgeBaseContext } from './rag.js';
import { createChatCompletion as callDigitalOcean } from './digitalocean.js';
import { recordTokenUsage, estimateTokens } from './tokenTracker.js';
import { fetchOllamaCloudWithFailover } from './ollama_client.js';
import { generateGeminiContent, hasGeminiKey } from './geminiService.js';

let sock = null;
let ioInstance = null;
let currentQr = null;
let connectedUser = null;
let isConnecting = false;
let dbInstance = null;

const authDir = path.join(process.cwd(), 'data', 'whatsapp_auth');

// Initialize Vertex AI / Gemini for strict knowledge evaluation
const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT || 'myllm-460104',
  location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
});

export function cleanReasoningOutput(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .replace(/<reasoning>[\s\S]*$/gi, '')
    .replace(/<thought>[\s\S]*$/gi, '')
    .trim();
}

export function resolveRealPhoneNumber(jidOrLid) {
  if (!jidOrLid) return '';
  const clean = jidOrLid.replace(/[^0-9]/g, '');

  // If it's already a standard phone number JID (@s.whatsapp.net) and not a 14-15 digit LID
  if (!jidOrLid.includes('@lid') && clean.length <= 13 && clean.length >= 8) {
    return `+${clean}`;
  }

  // Check Baileys LID reverse mapping file
  try {
    const reverseMapFile = path.join(authDir, `lid-mapping-${clean}_reverse.json`);
    if (fs.existsSync(reverseMapFile)) {
      const raw = JSON.parse(fs.readFileSync(reverseMapFile, 'utf8'));
      if (raw) {
        const phone = String(raw).replace(/[^0-9]/g, '');
        if (phone) return `+${phone}`;
      }
    }
  } catch (e) {
    // Ignore read error
  }

  return clean ? `+${clean}` : jidOrLid;
}

async function getDb() {
  if (!dbInstance) {
    dbInstance = await open({
      filename: path.join(process.cwd(), 'database.sqlite'),
      driver: sqlite3.Database
    });

    await dbInstance.exec(`
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

      CREATE TABLE IF NOT EXISTS whatsapp_contacts (
        jid TEXT PRIMARY KEY,
        phone TEXT,
        name TEXT,
        push_name TEXT,
        notify_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_wa_contacts_phone ON whatsapp_contacts(phone);

      CREATE TABLE IF NOT EXISTS whatsapp_auto_reply (
        remote_jid TEXT PRIMARY KEY,
        phone TEXT,
        contact_name TEXT,
        enabled INTEGER DEFAULT 1,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_wa_auto_reply_enabled ON whatsapp_auto_reply(enabled);

      CREATE TABLE IF NOT EXISTS whatsapp_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS whatsapp_scheduled_messages (
        id TEXT PRIMARY KEY,
        remote_jid TEXT,
        phone TEXT,
        contact_name TEXT,
        text TEXT,
        scheduled_at INTEGER,
        scheduled_at_iso TEXT,
        status TEXT DEFAULT 'pending',
        security_code TEXT,
        created_by TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sent_at DATETIME,
        error_message TEXT,
        message_id TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_wa_sched_status_time ON whatsapp_scheduled_messages(status, scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_wa_sched_jid ON whatsapp_scheduled_messages(remote_jid);
    `);

    // 1. One-time legacy cleanup: Sanitize host messages where from_me = 1 was labeled 'TraMonti e Mare'
    try {
      await dbInstance.run(`
        UPDATE whatsapp_messages 
        SET sender_name = 'Me' 
        WHERE from_me = 1 AND (sender_name = 'TraMonti e Mare' OR sender_name LIKE 'Tra-Monti%')
      `);
    } catch (e) {}

    // 2. Populate whatsapp_contacts from existing incoming messages where sender_name is a guest name
    try {
      await dbInstance.run(`
        INSERT OR IGNORE INTO whatsapp_contacts (jid, phone, name, push_name, updated_at)
        SELECT 
          remote_jid, 
          sender_phone, 
          sender_name, 
          sender_name, 
          datetime('now')
        FROM whatsapp_messages 
        WHERE from_me = 0 AND sender_name NOT LIKE '+%' AND sender_name != 'Guest' AND sender_name != 'Me' AND sender_name != 'TraMonti e Mare'
        GROUP BY remote_jid
      `);
    } catch (e) {}
  }
  return dbInstance;
}

export function validateSecurityCode(code) {
  const expectedCode = String(process.env.WHATSAPP_SECURITY_CODE || '1234').trim();
  if (!code) return false;
  return String(code).trim() === expectedCode;
}

export function getWhatsAppStatus() {
  return {
    connected: Boolean(sock && connectedUser),
    user: connectedUser,
    qr: currentQr,
    isConnecting
  };
}

export async function saveOrUpdateContact({ jid, phone, name, pushName, notifyName }) {
  if (!jid || jid === 'status@broadcast') return;
  const db = await getDb();
  const realPhone = phone || resolveRealPhoneNumber(jid);
  const cleanName = (name || pushName || notifyName || '').replace(/^~/, '').trim();

  // Do not save host's own name as contact name
  if (cleanName === 'TraMonti e Mare' || cleanName === 'Me' || cleanName === 'Guest' || cleanName.toLowerCase().startsWith('tra-monti')) {
    return;
  }

  try {
    await db.run(
      `INSERT INTO whatsapp_contacts (jid, phone, name, push_name, notify_name, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(jid) DO UPDATE SET
         phone = COALESCE(NULLIF(?, ''), phone),
         name = COALESCE(NULLIF(?, ''), name),
         push_name = COALESCE(NULLIF(?, ''), push_name),
         notify_name = COALESCE(NULLIF(?, ''), notify_name),
         updated_at = datetime('now')`,
      [jid, realPhone, cleanName, pushName || cleanName, notifyName || cleanName, realPhone, cleanName, pushName || cleanName, notifyName || cleanName]
    );
  } catch (e) {
    console.error('[WhatsApp] Contact save error:', e);
  }
}

export async function resolveContactDisplayName(remoteJid, fallbackPhone = '', fallbackName = '') {
  if (!remoteJid) return fallbackName || fallbackPhone || 'Unknown Contact';
  const db = await getDb();
  const cleanPhone = resolveRealPhoneNumber(remoteJid || fallbackPhone);

  // 1. Check whatsapp_auto_reply custom contact_name
  try {
    const arRow = await db.get(
      `SELECT contact_name FROM whatsapp_auto_reply WHERE remote_jid = ? OR phone = ? LIMIT 1`,
      [remoteJid, cleanPhone]
    );
    if (arRow?.contact_name && arRow.contact_name !== 'Guest' && arRow.contact_name !== 'Me' && arRow.contact_name !== 'TraMonti e Mare') {
      return arRow.contact_name.replace(/^~/, '').trim();
    }
  } catch (e) {}

  // 2. Check whatsapp_contacts
  try {
    const contactRow = await db.get(
      `SELECT name, push_name, notify_name FROM whatsapp_contacts WHERE jid = ? OR phone = ? LIMIT 1`,
      [remoteJid, cleanPhone]
    );
    if (contactRow) {
      const resolved = contactRow.name || contactRow.push_name || contactRow.notify_name;
      if (resolved && resolved !== 'Guest' && resolved !== 'Me' && resolved !== 'TraMonti e Mare' && !resolved.startsWith('+')) {
        return resolved.replace(/^~/, '').trim();
      }
    }
  } catch (e) {}

  // 3. Check most recent incoming message sender_name
  try {
    const msgRow = await db.get(
      `SELECT sender_name FROM whatsapp_messages 
       WHERE (remote_jid = ? OR sender_phone LIKE ?) AND from_me = 0 AND sender_name NOT LIKE '+%' AND sender_name != 'Guest' AND sender_name != 'Me' AND sender_name != 'TraMonti e Mare' 
       ORDER BY timestamp DESC LIMIT 1`,
      [remoteJid, `%${cleanPhone.replace(/[^0-9]/g, '')}%`]
    );
    if (msgRow?.sender_name) {
      return msgRow.sender_name.replace(/^~/, '').trim();
    }
  } catch (e) {}

  // 4. Check fallbackName if valid
  if (fallbackName && fallbackName !== 'Guest' && fallbackName !== 'Me' && fallbackName !== 'TraMonti e Mare' && !fallbackName.startsWith('+')) {
    return fallbackName.replace(/^~/, '').trim();
  }

  // 5. Fallback to clean formatted phone number
  return cleanPhone || remoteJid;
}

export async function setAutoReplyStatus(remoteJidOrPhone, enabled, contactName = '', remoteJidParam = '') {
  const db = await getDb();
  let jid = (remoteJidParam || remoteJidOrPhone || '').trim();
  const clean = (remoteJidOrPhone || '').replace(/[^0-9]/g, '');
  const realPhone = resolveRealPhoneNumber(jid.includes('@s.whatsapp.net') || clean ? (clean ? `+${clean}` : jid) : remoteJidOrPhone);

  if (!jid.includes('@')) {
    if (clean) {
      jid = `${clean}@s.whatsapp.net`;
    } else {
      jid = `${(contactName || remoteJidOrPhone || 'contact').toLowerCase().replace(/\s+/g, '_')}@s.whatsapp.net`;
    }
  }

  // If this phone is known under a specific LID in whatsapp_messages, bind the LID as primary JID
  if (clean && clean.length >= 6) {
    try {
      const msgRow = await db.get(
        `SELECT remote_jid FROM whatsapp_messages WHERE sender_phone LIKE ? OR remote_jid LIKE ? ORDER BY timestamp DESC LIMIT 1`,
        [`%${clean}%`, `%${clean}%`]
      );
      if (msgRow && msgRow.remote_jid) {
        jid = msgRow.remote_jid;
      }
    } catch (e) {}
  }

  // Check if there is an existing entry for this contact to update
  try {
    const existing = await db.get(
      `SELECT remote_jid FROM whatsapp_auto_reply WHERE remote_jid = ? OR (phone != '' AND phone = ?) OR (contact_name != '' AND contact_name = ?) LIMIT 1`,
      [jid, realPhone, contactName]
    );
    if (existing && existing.remote_jid) {
      jid = existing.remote_jid;
    }
  } catch (e) {}

  const cleanCustomName = (contactName === 'TraMonti e Mare' || contactName === 'Me') ? '' : contactName;

  await db.run(
    `INSERT INTO whatsapp_auto_reply (remote_jid, phone, contact_name, enabled, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(remote_jid) DO UPDATE SET enabled = ?, contact_name = COALESCE(NULLIF(?, ''), contact_name), phone = COALESCE(NULLIF(?, ''), phone), updated_at = datetime('now')`,
    [jid, realPhone, cleanCustomName, enabled ? 1 : 0, enabled ? 1 : 0, cleanCustomName, realPhone]
  );
  
  const updatedList = await getAutoReplyContacts();
  if (ioInstance) {
    ioInstance.emit('whatsapp_auto_replies_list', updatedList);
    ioInstance.emit('whatsapp_chats_list', { chats: await getWhatsAppChats() });
  }
  return { success: true, jid, phone: realPhone, enabled: Boolean(enabled) };
}

export async function disableAllAutoReplies() {
  const db = await getDb();
  await db.run('UPDATE whatsapp_auto_reply SET enabled = 0;');
  const updatedList = await getAutoReplyContacts();
  if (ioInstance) {
    ioInstance.emit('whatsapp_auto_replies_list', updatedList);
    ioInstance.emit('whatsapp_chats_list', { chats: await getWhatsAppChats() });
  }
  console.log('[WhatsApp] EMERGENCY: Force-disabled all auto-replies.');
  return { success: true, message: 'All automated replies have been force-disabled.' };
}

export async function getAutoReplyContacts() {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM whatsapp_auto_reply ORDER BY updated_at DESC');
  return rows.map(r => ({
    remoteJid: r.remote_jid,
    phone: r.phone || resolveRealPhoneNumber(r.remote_jid),
    contactName: r.contact_name || '',
    enabled: Boolean(r.enabled),
    updatedAt: r.updated_at
  }));
}

export async function isAutoReplyEnabled(remoteJidOrPhone) {
  if (!remoteJidOrPhone) return false;
  const db = await getDb();
  const clean = remoteJidOrPhone.replace(/[^0-9]/g, '');
  const realPhone = resolveRealPhoneNumber(remoteJidOrPhone);

  let row = null;
  if (clean && clean.length >= 6) {
    row = await db.get(
      `SELECT enabled FROM whatsapp_auto_reply WHERE remote_jid = ? OR remote_jid LIKE ? OR phone = ? OR phone LIKE ? LIMIT 1`,
      [remoteJidOrPhone, `%${clean}%`, realPhone, `%${clean}%`]
    );
  } else {
    row = await db.get(
      `SELECT enabled FROM whatsapp_auto_reply WHERE remote_jid = ? OR phone = ? OR contact_name = ? LIMIT 1`,
      [remoteJidOrPhone, realPhone, remoteJidOrPhone]
    );
  }
  return Boolean(row && row.enabled === 1);
}

export async function getWhatsAppModel() {
  try {
    const db = await getDb();
    const row = await db.get(`SELECT value FROM whatsapp_settings WHERE key = 'model' LIMIT 1`);
    if (row && row.value) return row.value;
  } catch (e) {}
  return process.env.WHATSAPP_AI_MODEL || process.env.DEFAULT_LLM_PROVIDER || 'ollama_cloud';
}

export async function setWhatsAppModel(model) {
  if (!model) return;
  const db = await getDb();
  await db.run(
    `INSERT INTO whatsapp_settings (key, value, updated_at)
     VALUES ('model', ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`,
    [model, model]
  );
  console.log(`[WhatsApp] Updated preferred AI model to: ${model}`);
  return { success: true, model };
}

export async function evaluateAutoReply(guestMessage, contactName, senderPhone, remoteJid, modelOverride = null) {
  let semanticKnowledge = '';
  try {
    semanticKnowledge = await formatKnowledgeBaseContext(guestMessage, 5);
  } catch (ragErr) {
    console.error('[WhatsApp Auto-Reply] Semantic RAG retrieval error from ChromaDB:', ragErr);
  }

  // Load canonical structured Scalea property, access, and logistics knowledge
  let scaleaKnowledge = '';
  try {
    const kCandidates = [
      path.join(process.cwd(), 'knowledge', 'tra-montiemare'),
      path.join(process.cwd(), 'backend', 'knowledge', 'tra-montiemare'),
      path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'knowledge', 'tra-montiemare')
    ];
    const kDir = kCandidates.find(p => fs.existsSync(p));
    if (kDir) {
      const files = ['access_and_checkin.md', 'properties.md', 'local_guide.md', 'reviews_and_faqs.md'];
      scaleaKnowledge = files
        .filter(f => fs.existsSync(path.join(kDir, f)))
        .map(f => `--- CANONICAL DOCUMENT: ${f} ---\n${fs.readFileSync(path.join(kDir, f), 'utf8')}`)
        .join('\n\n');
    }
  } catch (kErr) {
    console.error('[WhatsApp Auto-Reply] Error loading structured Scalea knowledge:', kErr);
  }

  if ((!semanticKnowledge || !semanticKnowledge.trim()) && (!scaleaKnowledge || !scaleaKnowledge.trim())) {
    console.log(`[WhatsApp Auto-Reply] No relevant house knowledge found for: "${guestMessage}"`);
    return { shouldReply: false, reason: 'NO_KNOWLEDGE_MATCH' };
  }

  // Get recent 5 conversation messages for context
  let recentHistory = '';
  try {
    const db = await getDb();
    const rows = await db.all(
      `SELECT from_me, text FROM whatsapp_messages WHERE remote_jid = ? OR sender_phone LIKE ? ORDER BY timestamp DESC LIMIT 5`,
      [remoteJid, `%${(senderPhone || '').replace(/[^0-9]/g, '')}%`]
    );
    recentHistory = rows.reverse().map(r => `${r.from_me ? 'TraMonti e Mare (Host)' : contactName}: "${r.text}"`).join('\n');
  } catch (e) {}

  const strictPrompt = `You are the intelligent automated WhatsApp concierge for Tra-Montiemare vacation rentals in Scalea (Hosts: Francesco & Enerlida).
A guest/contact has sent a message via WhatsApp.

CRITICAL HOST IDENTITY:
- The property is hosted and owned by Francesco & Enerlida together (NOT by Francesco alone).
- Always represent both Francesco & Enerlida or use the collective "we" as the hosting team.

CURRENT INQUIRY:
Guest: "${contactName}"
Message: "${guestMessage}"

RECENT CONVERSATION CONTEXT (Chronological, last 5 messages):
${recentHistory || 'None (New Conversation)'}

CANONICAL SCALEA VACATION RENTAL KNOWLEDGE (Ground Truth: Access, Stairs, Videos, Properties, Logistics):
${scaleaKnowledge || 'None'}

SEMANTIC KNOWLEDGE BASE (ChromaDB vector matches):
${semanticKnowledge || 'None'}

CRITICAL RULES:
1. DIRECT, IMMEDIATE ANSWERS (NO GATEKEEPING OR DEFERRALS):
   - NEVER tell a guest "te lo diremo quando arrivi", "preferiamo dirtelo quando sarai qui", "stiamo verificando e ti faremo sapere", or "ti ricontatteremo il prima possibile" when answering basic questions.
   - If the information exists in the knowledge base / vector DB (e.g. parking, check-in, wifi, beach distance, restaurants, amenities), ANSWER IMMEDIATELY, directly, and comprehensively in the very first reply.
   - When asked about parking: immediately explain that the house is in the pedestrian historic center, parking is public (free and paid) just outside the pedestrian zone (~5-7 mins walk, around Piazza De Palma), and provide the walking video link if relevant.

2. NATURAL WHATSAPP CONVERSATIONAL FORMATTING (NO REPETITIVE SIGNATURES):
   - In a back-and-forth WhatsApp conversation (when there is ongoing recent context), DO NOT repeat formal greetings (e.g. "Ciao [Nome]") on every single response, and DO NOT add a formal sign-off (e.g. "A presto, Francesco & Enerlida") on every message.
   - Keep messages natural, friendly, concise, and direct — formatted like actual WhatsApp text messages, not formal business letters or emails.
   - Only include a warm greeting and sign-off on the very first initial message of a brand new thread.

3. KNOWLEDGE GROUNDING & ACCURACY:
   - Base factual answers strictly on the provided knowledge base and ChromaDB excerpts.
   - If the guest asks for recommendations or local information mentioned in the knowledge base, provide them right away with specifics.
   - If a specific question is completely unknown, impossible to answer from the knowledge base, or requires custom host confirmation, be transparent and say you are noting it down for Francesco & Enerlida to reply personally.
   - If the request is totally off-topic or spam, output ONLY: [NO_KNOWLEDGE_MATCH]

4. FRUSTRATION HANDLING:
   - If the guest expresses frustration, impatience, or complaints, remain calm, polite, and immediately provide the direct answers without bureaucratic excuses or repetitive phrases.

5. LANGUAGE & CLEAN OUTPUT:
   - Reply in the same language as the guest (Italian if Italian, English if English).
   - Do NOT output prefixes like "Assistant:", "Host:", "Concierge:" or markdown code fences.`;

  const chosenModel = modelOverride || (await getWhatsAppModel());
  let effectiveModel = chosenModel;
  if (!effectiveModel || effectiveModel === 'auto' || effectiveModel === 'auto_hybrid') {
    const { routeTask } = await import('./modelRouter.js');
    const route = routeTask({
      message: guestMessage,
      channel: 'whatsapp',
      agentId: 'vacation_rental_manager'
    });
    effectiveModel = route.provider;
    console.log(`[WhatsApp Auto-Reply] Smart Router selected: ${effectiveModel} (${route.reason})`);
  }
  console.log(`[WhatsApp Auto-Reply] Evaluating with model: ${effectiveModel} (configured: ${chosenModel})`);

  try {
    let replyText = '';

    // 0. Ollama Cloud execution with automatic multi-key failover
    if (effectiveModel.startsWith('ollama_cloud')) {
      const cloudModel = effectiveModel.startsWith('ollama_cloud:') 
        ? effectiveModel.substring(13) 
        : (process.env.OLLAMA_CLOUD_MODEL || 'nemotron-3-nano:30b');

      const ollamaRes = await fetchOllamaCloudWithFailover('https://ollama.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: cloudModel,
          messages: [
            { role: 'system', content: 'You are the digital concierge for Tra-Montiemare vacation rentals in Scalea hosted by Francesco & Enerlida.' },
            { role: 'user', content: strictPrompt }
          ],
          options: {
            num_predict: 2048
          },
          stream: false
        })
      }, {
        logTag: 'WhatsApp Concierge (Ollama Cloud)',
        onFailover: (info) => {
          console.warn(`[WhatsApp Concierge] Key #${info.fromKeyIndex} quota/error limit reached. Failed over to backup key #${info.toKeyIndex}!`);
        }
      });

      const oData = await ollamaRes.json();
      const content = cleanReasoningOutput(oData.message?.content || '');
      const thinking = cleanReasoningOutput(oData.message?.thinking || '');
      replyText = (content.trim() !== '' ? content : (thinking.trim() !== '' ? thinking : '')).trim();
      const pIn = oData.prompt_eval_count || estimateTokens(strictPrompt);
      const pOut = oData.eval_count || estimateTokens(replyText);
      recordTokenUsage('whatsapp_concierge', pIn, pOut, pIn + pOut, `ollama_cloud/${cloudModel}`).catch(() => {});
    }
    // 1. Ollama local model execution
    else if (effectiveModel.startsWith('ollama')) {
      const defaultOllamaModel = effectiveModel.startsWith('ollama:') 
        ? effectiveModel.substring(7) 
        : (effectiveModel === 'ollama_qwen' ? 'qwen2.5-coder:14b' : 'qwen2.5-coder:14b');
      
      const ollamaRes = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: defaultOllamaModel,
          messages: [
            { role: 'system', content: 'You are the digital concierge for Tra-Montiemare vacation rentals in Scalea hosted by Francesco & Enerlida.' },
            { role: 'user', content: strictPrompt }
          ],
          stream: false
        })
      });

      if (ollamaRes.ok) {
        const oData = await ollamaRes.json();
        replyText = oData.message?.content?.trim() || '';
      } else {
        throw new Error(`Ollama Error (${ollamaRes.status}): ${await ollamaRes.text()}`);
      }
    } 
    // 2. DigitalOcean Serverless Inference Router execution
    else if (effectiveModel.startsWith('digitalocean') || effectiveModel.startsWith('do') || effectiveModel.startsWith('router:')) {
      const doModel = effectiveModel.startsWith('digitalocean:')
        ? effectiveModel.substring(13)
        : (effectiveModel.startsWith('do:') ? effectiveModel.substring(3) : (effectiveModel === 'digitalocean' || effectiveModel === 'do' ? undefined : effectiveModel));
      
      replyText = (await callDigitalOcean([
        { role: 'user', content: strictPrompt }
      ], { model: doModel, agentId: 'whatsapp_concierge' }))?.trim() || '';
    }
    // 3. Google Gemini execution (also fallback for deprecated perplexity)
    else if (effectiveModel === 'gemini' || effectiveModel === 'perplexity' || effectiveModel.startsWith('gemini') || effectiveModel.startsWith('vertex')) {
      let gemModel = (effectiveModel.startsWith('gemini:') || effectiveModel.startsWith('vertex:'))
        ? effectiveModel.substring(effectiveModel.indexOf(':') + 1)
        : (effectiveModel === 'gemini-1.5-flash' ? 'gemini-3.5-flash-lite' : 'gemini-3.8-flash');
      if (gemModel === 'gemini-3.8') gemModel = 'gemini-3.8-flash';

      if (hasGeminiKey()) {
        const gRes = await generateGeminiContent({
          contents: strictPrompt,
          model: gemModel,
          systemInstruction: 'You are the digital concierge for Tra-Montiemare vacation rentals in Scalea hosted by Francesco & Enerlida.'
        });
        replyText = gRes.text?.trim() || '';
        recordTokenUsage('whatsapp_concierge', gRes.usage?.promptTokens || 0, gRes.usage?.candidatesTokens || 0, gRes.usage?.totalTokens || 0, gRes.model).catch(() => {});
      } else if (vertexAI) {
        const model = vertexAI.preview.getGenerativeModel({ model: gemModel || 'gemini-3.8-flash' });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: strictPrompt }] }],
          systemInstruction: {
            role: 'system',
            parts: [{ text: 'You are the digital concierge for Tra-Montiemare vacation rentals in Scalea hosted by Francesco & Enerlida.' }]
          }
        });
        replyText = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
      } else {
        throw new Error('Neither GEMINI_API_KEY nor Google Vertex AI is configured');
      }
    }
    // 4. Groq Fast Cloud LLM execution
    else if (effectiveModel.startsWith('groq') || effectiveModel.includes('gpt-oss') || effectiveModel.includes('qwen3.6')) {
      if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is not configured in backend/.env');
      }
      const groqModel = effectiveModel.includes(':') ? effectiveModel.split(':')[1] : 'openai/gpt-oss-120b';
      replyText = (await createGroqChatCompletion([
        { role: 'system', content: 'You are the digital concierge for Tra-Montiemare vacation rentals in Scalea hosted by Francesco & Enerlida.' },
        { role: 'user', content: strictPrompt }
      ], { model: groqModel, agentId: 'whatsapp_concierge' }))?.trim() || '';
    }
    // 5. Google Gemini (Cloud API Key or Vertex AI)
    else {
      let geminiModelName = (chosenModel.startsWith('gemini:') || chosenModel.startsWith('vertex:'))
        ? chosenModel.substring(chosenModel.indexOf(':') + 1)
        : (chosenModel === 'gemini-1.5-flash' ? 'gemini-3.5-flash-lite' : 'gemini-3.8-flash');
      if (geminiModelName === 'gemini-3.8') geminiModelName = 'gemini-3.8-flash';

      if (hasGeminiKey()) {
        const gRes = await generateGeminiContent({
          contents: strictPrompt,
          model: geminiModelName
        });
        replyText = gRes.text?.trim() || '';
        recordTokenUsage('whatsapp_concierge', gRes.usage?.promptTokens || 0, gRes.usage?.candidatesTokens || 0, gRes.usage?.totalTokens || 0, gRes.model).catch(() => {});
      } else if (vertexAI) {
        const model = vertexAI.preview.getGenerativeModel({ model: geminiModelName || 'gemini-3.8-flash' });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: strictPrompt }] }]
        });
        replyText = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        const usageMeta = result.response.usageMetadata;
        const gIn = usageMeta?.promptTokenCount || estimateTokens(strictPrompt);
        const gOut = usageMeta?.candidatesTokenCount || estimateTokens(replyText);
        recordTokenUsage('whatsapp_concierge', gIn, gOut, gIn + gOut, geminiModelName || 'gemini-3.8-flash').catch(() => {});
      }
    }

    replyText = cleanReasoningOutput(replyText);

    if (!replyText || replyText.includes('[NO_KNOWLEDGE_MATCH]')) {
      console.log(`[WhatsApp Auto-Reply] Evaluator skipped for "${guestMessage}".`);
      return { shouldReply: false, reason: 'NO_KNOWLEDGE_MATCH', model: chosenModel };
    }

    console.log(`[WhatsApp Auto-Reply] Auto-reply generated for "${guestMessage}": "${replyText}"`);
    return { shouldReply: true, replyText, reply: replyText, model: chosenModel };
  } catch (err) {
    console.warn(`[WhatsApp Auto-Reply] AI evaluation error with ${chosenModel}:`, err.message || err);
    return { shouldReply: false, reason: err.message || 'AI_EVALUATION_ERROR', model: chosenModel };
  }
}

export async function initWhatsApp(io) {
  if (io) ioInstance = io;

  // Initialize DB table
  await getDb().catch(err => console.error('[WhatsApp] DB Init Error:', err));

  // Ensure data directory exists
  if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
    fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
  }
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Connect socket
  await connectToWhatsApp();
}

function extractTextFromMessage(message) {
  if (!message) return '';
  if (typeof message === 'string') return message;
  
  // Unwrap nested ephemeral or viewOnce wrappers
  const unwrap = message.ephemeralMessage?.message || 
                 message.viewOnceMessage?.message || 
                 message.viewOnceMessageV2?.message || 
                 message.documentWithCaptionMessage?.message || 
                 message.editedMessage?.message?.protocolMessage?.editedMessage ||
                 message;

  return unwrap.conversation || 
         unwrap.extendedTextMessage?.text || 
         unwrap.imageMessage?.caption || 
         unwrap.videoMessage?.caption || 
         unwrap.documentMessage?.caption ||
         unwrap.templateButtonReplyMessage?.selectedDisplayText ||
         unwrap.buttonsResponseMessage?.selectedDisplayText ||
         unwrap.listResponseMessage?.title ||
         unwrap.listResponseMessage?.singleSelectReply?.selectedRowId ||
         '';
}

async function processIncomingOrSyncedMessage(msg, isLive = false) {
  if (!msg || !msg.message) return;
  const senderJid = msg.key?.remoteJid;
  if (!senderJid || senderJid === 'status@broadcast') return;

  const isFromMe = Boolean(msg.key.fromMe);
  const messageText = extractTextFromMessage(msg.message);
  if (!messageText || !messageText.trim()) return;

  const realPhone = resolveRealPhoneNumber(senderJid);
  const rawPushName = msg.pushName ? msg.pushName.replace(/^~/, '').trim() : '';
  
  // Avoid assigning the host's pushName ("TraMonti e Mare") to outgoing messages as contact identity
  const senderName = isFromMe ? 'Me' : (rawPushName || realPhone || 'Guest');
  const msgId = msg.key.id || `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const timestamp = (typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp * 1000 : Date.now()) || Date.now();

  // If incoming from a guest and pushName is present, update contacts directory
  if (!isFromMe && rawPushName && rawPushName !== 'TraMonti e Mare') {
    await saveOrUpdateContact({
      jid: senderJid,
      phone: realPhone,
      pushName: rawPushName,
      name: rawPushName
    });
  }

  try {
    const db = await getDb();
    await db.run(
      `INSERT OR REPLACE INTO whatsapp_messages (id, remote_jid, sender_phone, sender_name, from_me, text, replied, timestamp, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [msgId, senderJid, realPhone, senderName, isFromMe ? 1 : 0, messageText.trim(), isFromMe ? 1 : 0, timestamp]
    );

    if (isFromMe) {
      await db.run(
        `UPDATE whatsapp_messages SET replied = 1 WHERE remote_jid = ? AND from_me = 0 AND replied = 0`,
        [senderJid]
      );
    }
  } catch (dbErr) {
    console.error('[WhatsApp] DB save message error:', dbErr);
  }

  const resolvedContactName = await resolveContactDisplayName(senderJid, realPhone, isFromMe ? '' : senderName);

  if (ioInstance) {
    ioInstance.emit('whatsapp_message', {
      id: msgId,
      from: realPhone,
      senderPhone: realPhone,
      remoteJid: senderJid,
      senderName: isFromMe ? (connectedUser?.name || 'Me') : resolvedContactName,
      contactName: resolvedContactName,
      text: messageText.trim(),
      fromMe: isFromMe,
      replied: isFromMe ? true : false,
      timestamp
    });
  }

  // Live Auto-Reply Trigger
  if (isLive && !isFromMe && sock) {
    try {
      const autoReplyActive = await isAutoReplyEnabled(senderJid);
      if (autoReplyActive) {
        console.log(`[WhatsApp Auto-Reply] Evaluating incoming live message from ${resolvedContactName} (${senderJid}): "${messageText}"`);
        const evalResult = await evaluateAutoReply(messageText, resolvedContactName, realPhone, senderJid);
        const replyText = evalResult.replyText || evalResult.reply;

        if (evalResult.shouldReply && replyText) {
          const formattedReply = replyText.startsWith('🤖') ? replyText : `🤖 ${replyText}`;
          console.log(`[WhatsApp Auto-Reply] Sending automated grounded reply to ${senderJid}: "${formattedReply}"`);
          const sendResult = await sock.sendMessage(senderJid, { text: formattedReply });
          const outMsgId = sendResult?.key?.id || `auto_${Date.now()}`;
          const outTimestamp = Date.now();

          const db = await getDb();
          await db.run(
            `INSERT OR REPLACE INTO whatsapp_messages (id, remote_jid, sender_phone, sender_name, from_me, text, replied, timestamp, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [outMsgId, senderJid, realPhone, 'Me', 1, formattedReply, 1, outTimestamp]
          );

          await db.run(
            `UPDATE whatsapp_messages SET replied = 1 WHERE remote_jid = ? AND from_me = 0`,
            [senderJid]
          );

          if (ioInstance) {
            ioInstance.emit('whatsapp_message', {
              id: outMsgId,
              from: realPhone,
              senderPhone: realPhone,
              remoteJid: senderJid,
              senderName: connectedUser?.name || 'TraMonti e Mare (Host)',
              contactName: resolvedContactName,
              text: formattedReply,
              fromMe: true,
              replied: true,
              timestamp: outTimestamp
            });
            // Also notify UI to refresh chats list
            ioInstance.emit('whatsapp_chats_list', { chats: await getWhatsAppChats() });
          }
        }
      }
    } catch (autoErr) {
      console.error('[WhatsApp Auto-Reply] Live auto-reply error:', autoErr);
    }
  }
}

export async function connectToWhatsApp() {
  if (isConnecting) return;
  isConnecting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version, isLatest } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307], isLatest: false }));

    console.log(`[WhatsApp] Using Baileys v${version.join('.')}, isLatest: ${isLatest}`);

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['FrAssist Agent', 'Chrome', '1.0.0'],
      syncFullHistory: true,
      shouldSyncHistoryMessage: () => true,
      keepAliveIntervalMs: 30000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          currentQr = await QRCode.toDataURL(qr);
          console.log('[WhatsApp] Generated new pairing QR code.');
          if (ioInstance) {
            ioInstance.emit('whatsapp_qr', { qr: currentQr });
            ioInstance.emit('whatsapp_status', getWhatsAppStatus());
          }
        } catch (err) {
          console.error('[WhatsApp] Failed to generate QR data URL:', err);
        }
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[WhatsApp] Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);

        connectedUser = null;
        sock = null;
        isConnecting = false;

        if (ioInstance) {
          ioInstance.emit('whatsapp_status', getWhatsAppStatus());
        }

        if (shouldReconnect) {
          setTimeout(() => {
            connectToWhatsApp();
          }, 3000);
        } else {
          // Logged out - clean up auth files
          try {
            fs.rmSync(authDir, { recursive: true, force: true });
          } catch (e) {
            console.error('[WhatsApp] Error removing auth directory:', e);
          }
          currentQr = null;
          if (ioInstance) {
            ioInstance.emit('whatsapp_status', getWhatsAppStatus());
          }
        }
      } else if (connection === 'open') {
        console.log('[WhatsApp] Connection opened successfully!');
        isConnecting = false;
        currentQr = null;

        const rawId = sock?.user?.id || '';
        const phone = rawId.split(':')[0] || rawId.split('@')[0];

        connectedUser = {
          id: rawId,
          phone: phone ? `+${phone}` : 'Connected',
          name: sock?.user?.name || 'TraMonti e Mare'
        };

        if (ioInstance) {
          ioInstance.emit('whatsapp_status', getWhatsAppStatus());
          ioInstance.emit('whatsapp_chats_list', { chats: await getWhatsAppChats() });
        }

        // Process any due scheduled messages now that WhatsApp is connected
        checkAndDispatchDueScheduledMessages().catch(e => console.error('[WhatsApp Scheduler] Error processing due messages on open:', e));
      }
    });

    // Contacts sync
    sock.ev.on('contacts.upsert', async (contacts) => {
      if (Array.isArray(contacts)) {
        for (const c of contacts) {
          await saveOrUpdateContact({
            jid: c.id,
            name: c.name,
            pushName: c.notify || c.verifiedName,
            notifyName: c.notify
          });
        }
      }
    });

    sock.ev.on('contacts.update', async (updates) => {
      if (Array.isArray(updates)) {
        for (const c of updates) {
          await saveOrUpdateContact({
            jid: c.id,
            name: c.name,
            pushName: c.notify || c.verifiedName,
            notifyName: c.notify
          });
        }
      }
    });

    // History sync when linked
    sock.ev.on('messaging-history.set', async ({ messages, contacts }) => {
      if (Array.isArray(contacts)) {
        console.log(`[WhatsApp] Syncing ${contacts.length} contacts from history...`);
        for (const c of contacts) {
          await saveOrUpdateContact({
            jid: c.id,
            name: c.name,
            pushName: c.notify || c.verifiedName,
            notifyName: c.notify
          });
        }
      }
      if (Array.isArray(messages)) {
        console.log(`[WhatsApp] Syncing ${messages.length} messages from history...`);
        for (const msg of messages) {
          await processIncomingOrSyncedMessage(msg);
        }
      }
      if (ioInstance) {
        ioInstance.emit('whatsapp_chats_list', { chats: await getWhatsAppChats() });
      }
    });

    // Live messages (notify + append)
    sock.ev.on('messages.upsert', async (m) => {
      if (m.messages && Array.isArray(m.messages)) {
        for (const msg of m.messages) {
          await processIncomingOrSyncedMessage(msg, true);
        }
        if (ioInstance) {
          ioInstance.emit('whatsapp_chats_list', { chats: await getWhatsAppChats() });
        }
      }
    });

  } catch (error) {
    console.error('[WhatsApp] Connection initialization error:', error);
    isConnecting = false;
  }
}

export async function sendWhatsAppMessage(to, text, securityCode, explicitRemoteJid = null) {
  // Enforce security code validation
  if (!validateSecurityCode(securityCode)) {
    throw new Error(
      'SECURITY_VALIDATION_FAILED: Invalid or missing security code. A valid security verification code is required to authorize sending WhatsApp messages. Please ask the user for their security confirmation code before sending.'
    );
  }

  if (!sock || !connectedUser) {
    throw new Error('WhatsApp is not connected. Please pair a device in the FrAssist UI first.');
  }

  let jid = (explicitRemoteJid || to || '').trim();
  if (!jid.includes('@')) {
    const cleanNumber = jid.replace(/[^0-9]/g, '');
    jid = `${cleanNumber}@s.whatsapp.net`;
  }

  const realPhone = resolveRealPhoneNumber(jid || to);
  const result = await sock.sendMessage(jid, { text });
  const msgId = result?.key?.id || `out_${Date.now()}`;
  const timestamp = Date.now();

  try {
    const db = await getDb();
    await db.run(
      `INSERT OR REPLACE INTO whatsapp_messages (id, remote_jid, sender_phone, sender_name, from_me, text, replied, timestamp, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [msgId, jid, realPhone, 'Me', 1, text, 1, timestamp]
    );

    // Mark previous unreplied incoming messages from this contact as replied
    await db.run(
      `UPDATE whatsapp_messages SET replied = 1 WHERE remote_jid = ? AND from_me = 0 AND replied = 0`,
      [jid]
    );
  } catch (dbErr) {
    console.error('[WhatsApp] Error recording outgoing message in DB:', dbErr);
  }

  const resolvedContactName = await resolveContactDisplayName(jid, realPhone);

  const messagePayload = {
    id: msgId,
    from: realPhone,
    senderPhone: realPhone,
    senderName: connectedUser?.name || 'Me',
    contactName: resolvedContactName,
    remoteJid: jid,
    text,
    fromMe: true,
    replied: true,
    timestamp
  };

  if (ioInstance) {
    ioInstance.emit('whatsapp_message', messagePayload);
    ioInstance.emit('whatsapp_chats_list', { chats: await getWhatsAppChats() });
  }

  return {
    success: true,
    recipient: realPhone,
    contactName: resolvedContactName,
    jid,
    messageId: msgId,
    message: messagePayload
  };
}

export async function getWhatsAppChats({ filter = 'all', query = null, limit = 200, offset = 0 } = {}) {
  const db = await getDb();
  
  const chatsQuery = `
    WITH AllJids AS (
      SELECT jid as remote_jid FROM whatsapp_contacts WHERE jid IS NOT NULL AND jid != ''
      UNION
      SELECT remote_jid FROM whatsapp_auto_reply WHERE remote_jid IS NOT NULL AND remote_jid != ''
      UNION
      SELECT remote_jid FROM whatsapp_messages WHERE remote_jid IS NOT NULL AND remote_jid != ''
    ),
    RankedMessages AS (
      SELECT 
        m.*,
        ROW_NUMBER() OVER (PARTITION BY m.remote_jid ORDER BY m.timestamp DESC, m.id DESC) as rn
      FROM whatsapp_messages m
    ),
    ChatStats AS (
      SELECT 
        remote_jid,
        MAX(timestamp) as latest_timestamp,
        COUNT(*) as total_messages,
        SUM(CASE WHEN from_me = 0 AND replied = 0 THEN 1 ELSE 0 END) as unreplied_count
      FROM whatsapp_messages
      GROUP BY remote_jid
    )
    SELECT 
      aj.remote_jid,
      COALESCE(cs.latest_timestamp, CAST(strftime('%s', c.updated_at) AS INTEGER) * 1000, 0) as latest_timestamp,
      COALESCE(cs.total_messages, 0) as total_messages,
      COALESCE(cs.unreplied_count, 0) as unreplied_count,
      rm.text as last_message_text,
      rm.from_me as last_message_from_me,
      rm.sender_name as last_message_sender_name,
      rm.sender_phone as last_message_sender_phone,
      c.name as contact_name_stored,
      c.push_name as contact_push_name,
      c.phone as contact_phone,
      ar.contact_name as auto_reply_name,
      ar.enabled as auto_reply_enabled
    FROM AllJids aj
    LEFT JOIN ChatStats cs ON aj.remote_jid = cs.remote_jid
    LEFT JOIN RankedMessages rm ON aj.remote_jid = rm.remote_jid AND rm.rn = 1
    LEFT JOIN whatsapp_contacts c ON aj.remote_jid = c.jid
    LEFT JOIN whatsapp_auto_reply ar ON aj.remote_jid = ar.remote_jid
    WHERE aj.remote_jid != 'status@broadcast'
    ORDER BY latest_timestamp DESC;
  `;

  const rawRows = await db.all(chatsQuery);
  const autoReplyMap = new Map();
  try {
    const arList = await getAutoReplyContacts();
    arList.forEach(a => autoReplyMap.set(a.remoteJid, a));
  } catch (e) {}

  const result = [];
  for (const r of rawRows) {
    const realPhone = resolveRealPhoneNumber(r.remote_jid || r.contact_phone || r.last_message_sender_phone);
    let contactName = r.auto_reply_name || r.contact_name_stored || r.contact_push_name;
    if (!contactName || contactName === 'Guest' || contactName === 'Me' || contactName === 'TraMonti e Mare' || contactName.startsWith('+')) {
      contactName = await resolveContactDisplayName(r.remote_jid, realPhone, r.last_message_sender_name);
    }

    const isAutoReplyOn = Boolean(r.auto_reply_enabled || autoReplyMap.get(r.remote_jid)?.enabled);
    const unrepliedCount = Number(r.unreplied_count) || 0;

    // Apply filters
    if (filter === 'unreplied' && unrepliedCount === 0) continue;
    if (filter === 'autoreply' && !isAutoReplyOn) continue;

    // Apply query search
    if (query && query.trim()) {
      const q = query.toLowerCase().trim();
      const matchName = (contactName || '').toLowerCase().includes(q);
      const matchPhone = (realPhone || '').toLowerCase().includes(q);
      const matchText = (r.last_message_text || '').toLowerCase().includes(q);
      const matchJid = (r.remote_jid || '').toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchText && !matchJid) continue;
    }

    result.push({
      remoteJid: r.remote_jid,
      phone: realPhone,
      contactName: contactName || realPhone,
      lastMessage: {
        text: r.last_message_text || '',
        fromMe: Boolean(r.last_message_from_me),
        timestamp: r.latest_timestamp
      },
      latestTimestamp: r.latest_timestamp,
      unrepliedCount,
      totalMessages: Number(r.total_messages) || 0,
      autoReplyEnabled: isAutoReplyOn,
      updatedAt: r.latest_timestamp
    });
  }

  return result.slice(offset, offset + limit);
}

export async function getWhatsAppChatMessages(remoteJid, { limit = 300, offset = 0 } = {}) {
  if (!remoteJid) return [];
  const db = await getDb();
  const realPhone = resolveRealPhoneNumber(remoteJid);
  const realClean = realPhone.replace(/[^0-9]/g, '');
  const jidClean = remoteJid.replace(/[^0-9]/g, '');
  
  const rows = await db.all(
    `SELECT * FROM whatsapp_messages 
     WHERE remote_jid = ? 
        OR (length(?) >= 6 AND (remote_jid LIKE ? OR sender_phone LIKE ?))
        OR (length(?) >= 6 AND (remote_jid LIKE ? OR sender_phone LIKE ?))
     ORDER BY timestamp ASC, id ASC
     LIMIT ? OFFSET ?`,
    [
      remoteJid,
      realClean, `%${realClean}%`, `%${realClean}%`,
      jidClean, `%${jidClean}%`, `%${jidClean}%`,
      limit, offset
    ]
  );

  const contactName = await resolveContactDisplayName(remoteJid, realPhone);

  return rows.map(r => ({
    id: r.id,
    remoteJid: r.remote_jid,
    senderPhone: resolveRealPhoneNumber(r.remote_jid || r.sender_phone),
    senderName: r.from_me ? 'Me' : (r.sender_name && r.sender_name !== 'TraMonti e Mare' && r.sender_name !== 'Me' ? r.sender_name.replace(/^~/, '') : contactName),
    fromMe: Boolean(r.from_me),
    text: r.text,
    replied: Boolean(r.replied),
    timestamp: r.timestamp,
    createdAt: r.created_at
  }));
}

export async function getWhatsAppMessages({ filter = 'latest', limit = 50, phone = null, query = null } = {}) {
  const db = await getDb();
  let sql = 'SELECT * FROM whatsapp_messages WHERE 1=1';
  const params = [];

  if (phone) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    sql += ` AND (sender_phone LIKE ? OR remote_jid LIKE ?)`;
    params.push(`%${cleanPhone}%`, `%${cleanPhone}%`);
  }

  if (query) {
    sql += ` AND (text LIKE ? OR sender_name LIKE ? OR sender_phone LIKE ?)`;
    params.push(`%${query}%`, `%${query}%`, `%${query}%`);
  }

  if (filter === 'unreplied' || filter === 'unread') {
    sql += ' AND from_me = 0 AND replied = 0';
  } else if (filter === 'replied') {
    sql += ' AND from_me = 0 AND replied = 1';
  } else if (filter === 'sent' || filter === 'outgoing') {
    sql += ' AND from_me = 1';
  } else if (filter === 'received' || filter === 'incoming') {
    sql += ' AND from_me = 0';
  }

  sql += ' ORDER BY timestamp DESC, id DESC LIMIT ?';
  params.push(Math.min(Number(limit) || 50, 500));

  const rows = await db.all(sql, params);
  const result = [];
  for (const r of rows) {
    const contactName = await resolveContactDisplayName(r.remote_jid, r.sender_phone, r.sender_name);
    result.push({
      id: r.id,
      remoteJid: r.remote_jid,
      senderPhone: resolveRealPhoneNumber(r.remote_jid || r.sender_phone),
      senderName: r.from_me ? 'Me' : contactName,
      fromMe: Boolean(r.from_me),
      text: r.text,
      replied: Boolean(r.replied),
      timestamp: r.timestamp,
      createdAt: r.created_at
    });
  }
  return result;
}

export async function markWhatsAppMessageReplied(remoteJidOrId) {
  const db = await getDb();
  if (remoteJidOrId.includes('@')) {
    await db.run(
      `UPDATE whatsapp_messages SET replied = 1 WHERE remote_jid = ?`,
      [remoteJidOrId]
    );
  } else {
    await db.run(
      `UPDATE whatsapp_messages SET replied = 1 WHERE id = ? OR sender_phone LIKE ? OR remote_jid LIKE ?`,
      [remoteJidOrId, `%${remoteJidOrId.replace(/[^0-9]/g, '')}%`, `%${remoteJidOrId.replace(/[^0-9]/g, '')}%`]
    );
  }
  if (ioInstance) {
    ioInstance.emit('whatsapp_chats_list', { chats: await getWhatsAppChats() });
  }
  return { success: true };
}

export async function clearWhatsAppChatHistory(remoteJidOrPhone) {
  if (!remoteJidOrPhone) return { success: false, error: 'remoteJidOrPhone required' };
  const db = await getDb();
  const realPhone = resolveRealPhoneNumber(remoteJidOrPhone);
  const realClean = realPhone.replace(/[^0-9]/g, '');
  const jidClean = remoteJidOrPhone.replace(/[^0-9]/g, '');

  // 1. Preserve contact identity in whatsapp_contacts so the contact remains in the sidebar list
  try {
    const existingMsg = await db.get(
      `SELECT remote_jid, sender_phone, sender_name FROM whatsapp_messages 
       WHERE remote_jid = ? 
          OR (length(?) >= 6 AND (remote_jid LIKE ? OR sender_phone LIKE ?))
          OR (length(?) >= 6 AND (remote_jid LIKE ? OR sender_phone LIKE ?))
       ORDER BY timestamp DESC LIMIT 1`,
      [
        remoteJidOrPhone,
        realClean, `%${realClean}%`, `%${realClean}%`,
        jidClean, `%${jidClean}%`, `%${jidClean}%`
      ]
    );

    const contactDisplayName = await resolveContactDisplayName(
      remoteJidOrPhone, 
      realPhone, 
      existingMsg?.sender_name && existingMsg.sender_name !== 'Me' && existingMsg.sender_name !== 'TraMonti e Mare' ? existingMsg.sender_name : ''
    );

    const finalJid = existingMsg?.remote_jid || (remoteJidOrPhone.includes('@') ? remoteJidOrPhone : `${realClean || 'contact'}@s.whatsapp.net`);

    await db.run(
      `INSERT INTO whatsapp_contacts (jid, phone, name, push_name, notify_name, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(jid) DO UPDATE SET
         phone = COALESCE(NULLIF(?, ''), phone),
         name = COALESCE(NULLIF(?, ''), name),
         push_name = COALESCE(NULLIF(?, ''), push_name),
         updated_at = datetime('now')`,
      [
        finalJid, realPhone, contactDisplayName, contactDisplayName, contactDisplayName,
        realPhone, contactDisplayName, contactDisplayName
      ]
    );
  } catch (contactErr) {
    console.error('[WhatsApp] Error preserving contact before clearing history:', contactErr);
  }

  // 2. Delete messages from whatsapp_messages
  await db.run(
    `DELETE FROM whatsapp_messages 
     WHERE remote_jid = ? 
        OR (length(?) >= 6 AND (remote_jid LIKE ? OR sender_phone LIKE ?))
        OR (length(?) >= 6 AND (remote_jid LIKE ? OR sender_phone LIKE ?))`,
    [
      remoteJidOrPhone,
      realClean, `%${realClean}%`, `%${realClean}%`,
      jidClean, `%${jidClean}%`, `%${jidClean}%`
    ]
  );

  console.log(`[WhatsApp] Cleared message history for contact: ${remoteJidOrPhone} (${realPhone})`);
  return { success: true, remoteJid: remoteJidOrPhone };
}

export async function exportAllWhatsAppConversationsToJson() {
  const db = await getDb();
  const rows = await db.all('SELECT * FROM whatsapp_messages ORDER BY timestamp ASC;');

  const conversationsByContact = {};
  let guestCounter = 1;

  for (const r of rows) {
    const key = r.remote_jid || r.sender_phone || 'unknown';

    if (!conversationsByContact[key]) {
      const cleanName = (!r.from_me && r.sender_name && !r.sender_name.startsWith('+')) ? r.sender_name.replace(/^~/, '') : `Guest ${guestCounter++}`;
      conversationsByContact[key] = {
        conversationId: `conv_${Object.keys(conversationsByContact).length + 1}`,
        participant: cleanName,
        totalMessages: 0,
        messages: []
      };
    }

    if (conversationsByContact[key].participant.startsWith('Guest ') && !r.from_me && r.sender_name && !r.sender_name.startsWith('+')) {
      conversationsByContact[key].participant = r.sender_name.replace(/^~/, '');
    }

    // Mask any explicit phone numbers in text for privacy
    const sanitizedText = (r.text || '').replace(/\+?[0-9]{8,15}/g, '[REDACTED_PHONE]');

    conversationsByContact[key].totalMessages += 1;
    conversationsByContact[key].messages.push({
      role: r.from_me ? 'host' : 'guest',
      sender: r.from_me ? 'TraMonti e Mare (Host)' : conversationsByContact[key].participant,
      text: sanitizedText,
      timestamp: r.timestamp,
      date: new Date(r.timestamp).toISOString(),
      formattedTime: new Date(r.timestamp).toLocaleString()
    });
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    privacyNotice: 'All personal phone numbers, JIDs, and contact numbers have been redacted for privacy and knowledge-base ingestion.',
    totalConversations: Object.keys(conversationsByContact).length,
    totalMessages: rows.length,
    conversations: Object.values(conversationsByContact)
  };

  const exportDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const exportPath = path.join(exportDir, 'whatsapp_conversations_export.json');
  fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf8');

  return {
    filePath: exportPath,
    totalMessages: exportData.totalMessages,
    totalConversations: exportData.totalConversations
  };
}

export async function disconnectWhatsApp() {
  try {
    if (sock) {
      await sock.logout().catch(() => {});
      sock.end?.();
    }
  } catch (e) {
    console.error('[WhatsApp] Logout error:', e);
  } finally {
    sock = null;
    connectedUser = null;
    currentQr = null;
    isConnecting = false;
    try {
      fs.rmSync(authDir, { recursive: true, force: true });
    } catch (e) {
      console.error('[WhatsApp] Error clearing auth directory:', e);
    }
    if (ioInstance) {
      ioInstance.emit('whatsapp_status', getWhatsAppStatus());
    }
    // Re-initialize to generate a fresh QR code
    setTimeout(() => {
      connectToWhatsApp();
    }, 1000);
  }
}

// ---------------------------------------------------------------------------
// WHATSAPP MESSAGE SCHEDULER SYSTEM
// ---------------------------------------------------------------------------

export function parseScheduledDateTime(input) {
  if (!input) return null;

  if (typeof input === 'number') {
    // If it's in seconds (e.g. 10 digits)
    if (input < 10000000000) return input * 1000;
    return input;
  }

  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input.getTime();
  }

  const str = String(input).trim();
  if (!str) return null;

  // Pure digits (timestamp string)
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    if (num < 10000000000) return num * 1000;
    return num;
  }

  const lower = str.toLowerCase().trim();
  const now = new Date();

  // Pattern: in X minutes / +Xm / +X mins
  const minMatch = lower.match(/^(?:\+|(?:in\s+))?(\d+)\s*(?:m|min|mins|minute|minutes)$/);
  if (minMatch) {
    return now.getTime() + parseInt(minMatch[1], 10) * 60 * 1000;
  }

  // Pattern: in X hours / +Xh / +X hrs
  const hourMatch = lower.match(/^(?:\+|(?:in\s+))?(\d+)\s*(?:h|hr|hrs|hour|hours)$/);
  if (hourMatch) {
    return now.getTime() + parseInt(hourMatch[1], 10) * 3600 * 1000;
  }

  // Pattern: in X days / +Xd
  const dayMatch = lower.match(/^(?:\+|(?:in\s+))?(\d+)\s*(?:d|day|days)$/);
  if (dayMatch) {
    return now.getTime() + parseInt(dayMatch[1], 10) * 86400 * 1000;
  }

  // Keyword presets
  if (lower === 'tomorrow morning') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.getTime();
  }
  if (lower === 'tomorrow afternoon') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(14, 30, 0, 0);
    return d.getTime();
  }
  if (lower === 'tomorrow evening' || lower === 'tomorrow night') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(18, 30, 0, 0);
    return d.getTime();
  }
  if (lower === 'tonight') {
    const d = new Date(now);
    d.setHours(20, 0, 0, 0);
    if (d.getTime() <= now.getTime()) {
      d.setDate(d.getDate() + 1);
    }
    return d.getTime();
  }

  // Pattern: "tomorrow at HH:MM" or "tomorrow HH:MM" or "tomorrow at HH:MM am/pm"
  const tomorrowTimeMatch = lower.match(/^tomorrow(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (tomorrowTimeMatch) {
    let hours = parseInt(tomorrowTimeMatch[1], 10);
    const minutes = tomorrowTimeMatch[2] ? parseInt(tomorrowTimeMatch[2], 10) : 0;
    const meridiem = tomorrowTimeMatch[3];
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;

    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(hours, minutes, 0, 0);
    return d.getTime();
  }

  // Pattern: "today at HH:MM" or "today HH:MM" or "tonight at HH:MM"
  const todayTimeMatch = lower.match(/^(?:today|tonight)(?:\s+at)?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (todayTimeMatch) {
    let hours = parseInt(todayTimeMatch[1], 10);
    const minutes = todayTimeMatch[2] ? parseInt(todayTimeMatch[2], 10) : 0;
    const meridiem = todayTimeMatch[3];
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;

    const d = new Date(now);
    d.setHours(hours, minutes, 0, 0);
    if (d.getTime() <= now.getTime()) {
      d.setDate(d.getDate() + 1);
    }
    return d.getTime();
  }

  // Pattern: "next [day of week] at HH:MM"
  const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeekMatch = lower.match(/^(?:next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s+at)?\s*(\d{1,2})?(?::(\d{2}))?\s*(am|pm)?$/);
  if (dayOfWeekMatch) {
    const targetDayIndex = daysOfWeek.indexOf(dayOfWeekMatch[1]);
    let hours = dayOfWeekMatch[2] ? parseInt(dayOfWeekMatch[2], 10) : 9;
    const minutes = dayOfWeekMatch[3] ? parseInt(dayOfWeekMatch[3], 10) : 0;
    const meridiem = dayOfWeekMatch[4];
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;

    const d = new Date(now);
    let diff = (targetDayIndex - now.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    d.setDate(d.getDate() + diff);
    d.setHours(hours, minutes, 0, 0);
    return d.getTime();
  }

  // Standard ISO or date string parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.getTime();
  }

  return null;
}

export async function scheduleWhatsAppMessage({
  recipient,
  remoteJid = null,
  phone = null,
  text,
  scheduledAt,
  securityCode,
  createdBy = 'user'
}) {
  if (!validateSecurityCode(securityCode)) {
    throw new Error(
      'SECURITY_VALIDATION_FAILED: Invalid or missing security code. A valid security verification code is required to authorize scheduling WhatsApp messages.'
    );
  }

  const rawMessage = (text || '').trim();
  if (!rawMessage) {
    throw new Error('Message text is required to schedule a WhatsApp message.');
  }

  const target = (remoteJid || phone || recipient || '').trim();
  if (!target) {
    throw new Error('Recipient or target phone number is required.');
  }

  let jid = target;
  if (!jid.includes('@')) {
    const cleanNumber = jid.replace(/[^0-9]/g, '');
    jid = `${cleanNumber}@s.whatsapp.net`;
  }

  const realPhone = resolveRealPhoneNumber(jid || target);
  const contactName = await resolveContactDisplayName(jid, realPhone);

  const timestampMs = parseScheduledDateTime(scheduledAt);
  if (!timestampMs || isNaN(timestampMs)) {
    throw new Error(`Unable to parse scheduled delivery time: "${scheduledAt}". Please provide a valid date/time or relative format (e.g. "tomorrow at 09:00", "+2h", or ISO string).`);
  }

  // Ensure scheduled time is at least within 30 seconds of now or in the future
  if (timestampMs < Date.now() - 30000) {
    throw new Error(`Scheduled time must be in the future. Received: ${new Date(timestampMs).toLocaleString()}`);
  }

  const schedId = `sched_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const scheduledIso = new Date(timestampMs).toISOString();

  const db = await getDb();
  await db.run(
    `INSERT INTO whatsapp_scheduled_messages (
      id, remote_jid, phone, contact_name, text, scheduled_at, scheduled_at_iso,
      status, security_code, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, datetime('now'))`,
    [schedId, jid, realPhone, contactName, rawMessage, timestampMs, scheduledIso, securityCode, createdBy]
  );

  const scheduledItem = {
    id: schedId,
    remoteJid: jid,
    phone: realPhone,
    contactName,
    text: rawMessage,
    scheduledAt: timestampMs,
    scheduledAtIso: scheduledIso,
    status: 'pending',
    createdBy,
    createdAt: new Date().toISOString()
  };

  if (ioInstance) {
    ioInstance.emit('whatsapp_scheduled_messages_list', {
      scheduledMessages: await getScheduledWhatsAppMessages()
    });
  }

  console.log(`[WhatsApp Scheduler] Scheduled message ${schedId} for ${contactName} (${realPhone}) at ${scheduledIso}`);

  return {
    success: true,
    scheduledMessage: scheduledItem,
    message: `WhatsApp message successfully scheduled for ${contactName} (${realPhone}) at ${new Date(timestampMs).toLocaleString()}`
  };
}

export async function getScheduledWhatsAppMessages({ status = null, remoteJid = null, limit = 100 } = {}) {
  const db = await getDb();
  let query = `SELECT * FROM whatsapp_scheduled_messages WHERE 1=1`;
  const params = [];

  if (status && status !== 'all') {
    query += ` AND status = ?`;
    params.push(status);
  }

  if (remoteJid) {
    query += ` AND (remote_jid = ? OR phone LIKE ?)`;
    params.push(remoteJid, `%${remoteJid.replace(/[^0-9]/g, '')}%`);
  }

  query += ` ORDER BY 
    CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
    scheduled_at ASC,
    created_at DESC
    LIMIT ?`;
  params.push(limit);

  const rows = await db.all(query, params);
  return rows.map(r => ({
    id: r.id,
    remoteJid: r.remote_jid,
    phone: r.phone,
    contactName: r.contact_name || r.phone || 'Contact',
    text: r.text,
    scheduledAt: r.scheduled_at,
    scheduledAtIso: r.scheduled_at_iso,
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at,
    sentAt: r.sent_at,
    errorMessage: r.error_message,
    messageId: r.message_id
  }));
}

export async function cancelScheduledWhatsAppMessage(id) {
  const db = await getDb();
  const item = await db.get('SELECT * FROM whatsapp_scheduled_messages WHERE id = ?', [id]);
  if (!item) {
    throw new Error(`Scheduled message with ID "${id}" not found.`);
  }

  if (item.status !== 'pending') {
    throw new Error(`Cannot cancel message with status "${item.status}". Only pending scheduled messages can be cancelled.`);
  }

  await db.run('UPDATE whatsapp_scheduled_messages SET status = "cancelled" WHERE id = ?', [id]);

  if (ioInstance) {
    ioInstance.emit('whatsapp_scheduled_messages_list', {
      scheduledMessages: await getScheduledWhatsAppMessages()
    });
  }

  console.log(`[WhatsApp Scheduler] Cancelled scheduled message ${id}`);
  return { success: true, id, message: 'Scheduled message has been cancelled.' };
}

export async function deleteScheduledWhatsAppMessage(id) {
  const db = await getDb();
  await db.run('DELETE FROM whatsapp_scheduled_messages WHERE id = ?', [id]);

  if (ioInstance) {
    ioInstance.emit('whatsapp_scheduled_messages_list', {
      scheduledMessages: await getScheduledWhatsAppMessages()
    });
  }

  return { success: true, id, message: 'Scheduled message removed.' };
}

export async function sendScheduledWhatsAppMessageNow(id, overrideSecurityCode = null) {
  const db = await getDb();
  const item = await db.get('SELECT * FROM whatsapp_scheduled_messages WHERE id = ?', [id]);
  if (!item) {
    throw new Error(`Scheduled message with ID "${id}" not found.`);
  }

  const secCode = overrideSecurityCode || item.security_code || process.env.WHATSAPP_SECURITY_CODE || '1234';
  const result = await sendWhatsAppMessage(item.remote_jid || item.phone, item.text, secCode, item.remote_jid);

  await db.run(
    'UPDATE whatsapp_scheduled_messages SET status = "sent", sent_at = datetime("now"), message_id = ? WHERE id = ?',
    [result?.messageId || `sent_${Date.now()}`, id]
  );

  if (ioInstance) {
    ioInstance.emit('whatsapp_scheduled_messages_list', {
      scheduledMessages: await getScheduledWhatsAppMessages()
    });
  }

  return {
    success: true,
    id,
    result,
    message: `Scheduled message dispatched immediately to ${item.contact_name || item.phone}.`
  };
}

let schedulerInterval = null;

export async function checkAndDispatchDueScheduledMessages() {
  try {
    const db = await getDb();
    const now = Date.now();
    const dueMessages = await db.all(
      'SELECT * FROM whatsapp_scheduled_messages WHERE status = "pending" AND scheduled_at <= ? ORDER BY scheduled_at ASC',
      [now]
    );

    if (!dueMessages || dueMessages.length === 0) return;

    if (!sock || !connectedUser) {
      console.log(`[WhatsApp Scheduler] Found ${dueMessages.length} due message(s), but WhatsApp is not connected. Pending dispatch on reconnection.`);
      return;
    }

    console.log(`[WhatsApp Scheduler] Processing ${dueMessages.length} due scheduled message(s)...`);

    for (const item of dueMessages) {
      try {
        const secCode = item.security_code || process.env.WHATSAPP_SECURITY_CODE || '1234';
        const result = await sendWhatsAppMessage(item.remote_jid || item.phone, item.text, secCode, item.remote_jid);

        await db.run(
          'UPDATE whatsapp_scheduled_messages SET status = "sent", sent_at = datetime("now"), message_id = ? WHERE id = ?',
          [result?.messageId || `sent_${Date.now()}`, item.id]
        );

        console.log(`[WhatsApp Scheduler] Successfully dispatched scheduled message ${item.id} to ${item.contact_name || item.phone}`);

        if (ioInstance) {
          ioInstance.emit('whatsapp_scheduled_message_sent', {
            id: item.id,
            contactName: item.contact_name,
            phone: item.phone,
            text: item.text,
            sentAt: new Date().toISOString()
          });
        }
      } catch (sendErr) {
        console.error(`[WhatsApp Scheduler] Failed to dispatch scheduled message ${item.id}:`, sendErr.message);
        await db.run(
          'UPDATE whatsapp_scheduled_messages SET status = "failed", error_message = ? WHERE id = ?',
          [sendErr.message, item.id]
        );

        if (ioInstance) {
          ioInstance.emit('whatsapp_scheduled_message_failed', {
            id: item.id,
            contactName: item.contact_name,
            phone: item.phone,
            error: sendErr.message
          });
        }
      }
    }

    if (ioInstance) {
      ioInstance.emit('whatsapp_scheduled_messages_list', {
        scheduledMessages: await getScheduledWhatsAppMessages()
      });
    }
  } catch (err) {
    console.error('[WhatsApp Scheduler] Error in checkAndDispatchDueScheduledMessages:', err);
  }
}

export function startWhatsAppScheduler(io) {
  if (io) ioInstance = io;
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  // Check every 10 seconds
  schedulerInterval = setInterval(() => {
    checkAndDispatchDueScheduledMessages().catch(e => console.error('[WhatsApp Scheduler] Interval error:', e));
  }, 10000);

  // Immediate check
  checkAndDispatchDueScheduledMessages().catch(() => {});
  console.log('[WhatsApp Scheduler] Active and monitoring scheduled dispatches (10s interval)');
}


