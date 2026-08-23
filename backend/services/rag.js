import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { VertexAI } from '@google-cloud/vertexai';
import { GoogleGenerativeAI } from '@google/generative-ai';

let dbInstance = null;
let cachedVectorRows = null;
let lastCacheTime = 0;

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT || 'myllm-460104',
  location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
});

async function getChromaDb() {
  if (!dbInstance) {
    const dbPath = path.join(process.cwd(), 'data', 'chroma_db', 'chroma.sqlite3');
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Chroma SQLite database not found at ${dbPath}`);
    }
    dbInstance = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });
  }
  return dbInstance;
}

function cosineSimilarity(vecA, vecB) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generate 768-dim text-embedding-004 embedding vector for query
 */
export async function getQueryEmbedding(text) {
  if (!text || !text.trim()) {
    throw new Error('Query text is required for embedding generation.');
  }

  // 1. Try Gemini AI Studio API key if available
  if (process.env.GOOGLE_API_KEY) {
    try {
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
      const res = await model.embedContent(text);
      if (res?.embedding?.values) {
        return res.embedding.values;
      }
    } catch (err) {
      console.warn('[RAG Service] GoogleGenerativeAI embedContent failed, falling back to Vertex AI:', err.message);
    }
  }

  // 2. Vertex AI REST prediction
  const project = process.env.GOOGLE_CLOUD_PROJECT || 'myllm-460104';
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
  const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/text-embedding-004:predict`;

  const helperModel = vertexAI.preview.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  const token = await helperModel.fetchToken();

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      instances: [{ content: text }]
    })
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`Vertex AI text-embedding-004 request failed (${resp.status}): ${errBody}`);
  }

  const data = await resp.json();
  const vector = data.predictions?.[0]?.embeddings?.values;
  if (!vector || vector.length === 0) {
    throw new Error('No embedding vector returned by Vertex AI text-embedding-004.');
  }

  return vector;
}

/**
 * Search the ChromaDB collection (tramontiemare_guest_faq) with semantic similarity
 */
export async function searchKnowledgeBase(queryText, topK = 4, filters = {}) {
  const queryVec = await getQueryEmbedding(queryText);
  const db = await getChromaDb();

  const now = Date.now();
  if (!cachedVectorRows || now - lastCacheTime > 60000) {
    const rows = await db.all('SELECT id, vector, metadata FROM embeddings_queue WHERE vector IS NOT NULL');
    cachedVectorRows = rows.map(r => {
      let meta = {};
      try {
        meta = JSON.parse(r.metadata || '{}');
      } catch (e) {}
      const floatArr = new Float32Array(r.vector.buffer, r.vector.byteOffset, r.vector.byteLength / 4);
      return {
        id: r.id,
        floatArr,
        document: meta['chroma:document'] || '',
        metadata: meta
      };
    });
    lastCacheTime = now;
  }

  let candidates = cachedVectorRows;

  // Apply optional metadata filters
  if (filters.apartment && filters.apartment !== 'all') {
    const apLower = filters.apartment.toLowerCase();
    candidates = candidates.filter(c => (c.metadata.apartment || '').toLowerCase().includes(apLower));
  }
  if (filters.topic) {
    const topicLower = filters.topic.toLowerCase();
    candidates = candidates.filter(c => (c.metadata.topic || '').toLowerCase().includes(topicLower));
  }
  if (filters.source) {
    const sourceLower = filters.source.toLowerCase();
    candidates = candidates.filter(c => (c.metadata.source || '').toLowerCase() === sourceLower);
  }

  const scored = candidates.map(c => {
    const score = cosineSimilarity(queryVec, c.floatArr);
    return {
      id: c.id,
      score: Math.round(score * 10000) / 10000,
      document: c.document,
      metadata: c.metadata
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/**
 * Format semantic chunks into a clean context prompt block
 */
export async function formatKnowledgeBaseContext(queryText, topK = 4, filters = {}) {
  try {
    const results = await searchKnowledgeBase(queryText, topK, filters);
    if (!results || results.length === 0) return '';

    let formatted = '--- SEMANTIC KNOWLEDGE BASE (tramontiemare_guest_faq) ---\n';
    results.forEach((r, idx) => {
      const topic = r.metadata.topic ? `[Topic: ${r.metadata.topic}]` : '';
      const ap = r.metadata.apartment ? `[Apartment: ${r.metadata.apartment}]` : '';
      const participant = r.metadata.participant ? `[Participant: ${r.metadata.participant}]` : '';
      formatted += `\n[Excerpt #${idx + 1} | Match: ${(r.score * 100).toFixed(1)}% ${topic} ${ap} ${participant}]\n${r.document}\n`;
    });
    return formatted;
  } catch (err) {
    console.warn('[RAG Service] Vector search skipped (using direct markdown knowledge):', err.message || err);
    return '';
  }
}
