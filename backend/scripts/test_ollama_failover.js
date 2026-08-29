import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { getOllamaCloudKeys, fetchOllamaCloudWithFailover, fetchOllamaCloudModels, testOllamaCloudInference } from '../services/ollama_client.js';

async function testFailover() {
  console.log('====================================================');
  console.log('1. Checking Loaded Ollama Keys');
  console.log('====================================================');
  const keys = getOllamaCloudKeys();
  console.log(`Found ${keys.length} Ollama key(s):`);
  keys.forEach((k, idx) => {
    console.log(`  Key ${idx + 1}: ${k.slice(0, 8)}...${k.slice(-4)}`);
  });

  console.log('\n====================================================');
  console.log('2. Testing Normal Connectivity with Primary Key');
  console.log('====================================================');
  try {
    const models = await fetchOllamaCloudModels();
    console.log(`✓ Successfully fetched ${models.length} Ollama Cloud models.`);
    console.log('Sample models:', models.slice(0, 4).map(m => m.name));
  } catch (err) {
    console.error('✗ Fetch models error:', err.message);
  }

  console.log('\n====================================================');
  console.log('3. Testing Simulated Key 1 Failure -> Automatic Failover to Key 2');
  console.log('====================================================');
  
  // Temporarily set primary key to an invalid key to simulate quota/auth error
  const originalKey1 = process.env.OLLAMA_API_KEY;
  process.env.OLLAMA_API_KEY = 'invalid_mock_quota_reached_key_123';

  let failoverTriggered = false;
  try {
    console.log('Calling testOllamaCloudInference with broken primary key...');
    const result = await testOllamaCloudInference('nemotron-3-nano:30b', (info) => {
      failoverTriggered = true;
      console.log(`⚡ onFailover callback triggered! Switched from Key #${info.fromKeyIndex} to Key #${info.toKeyIndex} (Status: ${info.status})`);
    });

    console.log('✓ Inference succeeded with failover key!');
    console.log('Response:', result.reply);
    console.log('Latency:', result.latency, 'ms');
    console.log('Failover callback was executed:', failoverTriggered);
  } catch (err) {
    console.error('✗ Failover test failed:', err.message);
  } finally {
    // Restore original primary key
    process.env.OLLAMA_API_KEY = originalKey1;
  }

  console.log('\n====================================================');
  console.log('4. Testing Normal Inference After Restoring Keys');
  console.log('====================================================');
  try {
    const normalResult = await testOllamaCloudInference('nemotron-3-nano:30b');
    console.log('✓ Normal inference successful:', normalResult.reply, `(${normalResult.latency}ms)`);
  } catch (err) {
    console.error('✗ Normal inference error:', err.message);
  }
}

testFailover();
