import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { getQueryEmbedding } from '../services/rag.js';

async function ingestJson() {
  const jsonPath = path.join(process.cwd(), 'data', 'knowledge_base.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('File not found:', jsonPath);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`[Ingest] Ingesting ${raw.length} items from knowledge_base.json into ChromaDB...`);

  const db = await open({
    filename: path.join(process.cwd(), 'data', 'chroma_db', 'chroma.sqlite3'),
    driver: sqlite3.Database
  });

  await db.run('DELETE FROM embeddings_queue');
  await db.run('UPDATE collections SET dimension = 768 WHERE name = "tramontiemare_guest_faq"');

  for (const item of raw) {
    const docText = `${item.question} ${item.answer} ${item.links ? item.links.join(' ') : ''}`.trim();
    const vec = await getQueryEmbedding(docText);
    const floatArr = new Float32Array(vec);
    const buffer = Buffer.from(floatArr.buffer);

    const meta = {
      'chroma:document': docText,
      question: item.question,
      answer: item.answer,
      topic: item.topic || 'general',
      participant: item.participant || 'guest support',
      links: item.links ? JSON.stringify(item.links) : '[]',
      source: item.source || 'manual'
    };

    await db.run(
      'INSERT INTO embeddings_queue (operation, topic, id, vector, encoding, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [0, 'persistent://default/default/tramontiemare_guest_faq', item.id, buffer, 'FLOAT32', JSON.stringify(meta)]
    );
    console.log(`✓ Ingested: ${item.id} ("${item.question.substring(0, 40)}...")`);
  }

  console.log(`[Ingest] Successfully ingested ${raw.length} items with 768-dim embeddings!`);
}

ingestJson().catch(err => {
  console.error('[Ingest Error]:', err);
  process.exit(1);
});
