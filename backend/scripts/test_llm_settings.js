import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { getWhatsAppModel } from '../services/whatsapp.js';

async function runTests() {
  console.log('=== 1. Checking Default WhatsApp Model ===');
  const waModel = await getWhatsAppModel();
  console.log('WhatsApp Model:', waModel);

  console.log('\n=== 2. Checking Ollama Cloud Connectivity ===');
  const ollamaKey = process.env.OLLAMA_API_KEY;
  console.log('Ollama Key present:', !!ollamaKey);
  if (ollamaKey) {
    try {
      const res = await fetch('https://ollama.com/api/tags', {
        headers: { 'Authorization': `Bearer ${ollamaKey}` },
        signal: AbortSignal.timeout(5000)
      });
      console.log('Tags HTTP Status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log(`Available Cloud Models (${data.models?.length || 0}):`, (data.models || []).slice(0, 5).map(m => m.name));
      }
    } catch (e) {
      console.error('Tags fetch error:', e.message);
    }

    try {
      console.log('\n=== 3. Testing Ollama Cloud Inference with nemotron-3-nano:30b ===');
      const start = Date.now();
      const chatRes = await fetch('https://ollama.com/api/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ollamaKey}`
        },
        body: JSON.stringify({
          model: 'nemotron-3-nano:30b',
          messages: [{ role: 'user', content: 'Say "Ollama Cloud Default OK" in 4 words.' }],
          stream: false
        }),
        signal: AbortSignal.timeout(15000)
      });
      console.log('Chat HTTP Status:', chatRes.status, `(took ${Date.now() - start}ms)`);
      if (chatRes.ok) {
        const result = await chatRes.json();
        const text = result.message?.content || result.message?.thinking || '';
        console.log('Response content:', text.trim());
      } else {
        console.log('Chat error body:', await chatRes.text());
      }
    } catch (e) {
      console.error('Chat error:', e.message);
    }
  }

  console.log('\n=== All verification tests completed! ===');
}

runTests();
