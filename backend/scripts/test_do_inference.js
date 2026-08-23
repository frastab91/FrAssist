import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { createChatCompletion, streamChatCompletion } from '../services/digitalocean.js';

async function main() {
  console.log('Testing DigitalOcean Inference Router API...\n');

  const testPrompt = `Are there any syntax issues here? Code: 
Python 
prices_usd = {'laptop': 1200, 'mouse': 25, 'monitor': 300, 'cable': 12} 
exchange_rate = 0.92 
# The line below is the focus 
expensive_items_eur = {k: v * exchange_rate for k, v in prices_usd.items() if v > 50} 
print(expensive_items_eur)`;

  const messages = [
    {
      role: 'user',
      content: testPrompt
    }
  ];

  try {
    console.log('--- 1. Testing Standard Non-Streaming Call ---');
    const response = await createChatCompletion(messages, {
      model: 'router:frassistrouter'
    });
    console.log('Response:\n', response);
    console.log('\n-----------------------------------------------\n');

    console.log('--- 2. Testing Streaming Call ---');
    process.stdout.write('Streamed Output: ');
    for await (const chunk of streamChatCompletion(messages, { model: 'router:frassistrouter' })) {
      process.stdout.write(chunk);
    }
    console.log('\n\nTest completed successfully!');
  } catch (error) {
    console.error('Error during DigitalOcean API test:', error.message || error);
  }
}

main();
