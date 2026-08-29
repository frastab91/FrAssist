/**
 * Automated test script for ModelRouter
 */

import { routeTask, getRouterConfig, updateRouterConfig, resetRouterConfig } from '../services/modelRouter.js';

console.log('Testing FrAssist Native Hybrid Model Router...');

// Test 1: Vision / Multimodal routing
const visionResult = routeTask({
  message: 'Look at this screenshot and tell me what is wrong',
  images: [{ mimeType: 'image/png', data: 'fake_base64' }]
});
console.log('Test 1 (Vision):', visionResult.category === 'heavy_vision' ? '✅ PASS' : '❌ FAIL', visionResult);

// Test 2: Coding intent routing
const codeResult = routeTask({
  message: 'Write a TypeScript function that implements a binary search tree with balance check.'
});
console.log('Test 2 (Coding):', codeResult.category === 'coding' ? '✅ PASS' : '❌ FAIL', codeResult);

// Test 3: Fast Conversational intent routing
const chatResult = routeTask({
  message: 'Ciao! Come stai oggi?'
});
console.log('Test 3 (Fast Chat):', chatResult.category === 'fast_chat' ? '✅ PASS' : '❌ FAIL', chatResult);

// Test 4: Developer agent specialization
const devAgentResult = routeTask({
  agentId: 'developer',
  message: 'Please review the architecture of backend/index.js'
});
console.log('Test 4 (Developer Agent):', devAgentResult.category === 'coding' ? '✅ PASS' : '❌ FAIL', devAgentResult);

// Test 5: Researcher agent specialization
const resAgentResult = routeTask({
  agentId: 'researcher',
  message: 'Find the top 5 competitors in vacation rentals in Southern Italy'
});
console.log('Test 5 (Researcher Agent):', resAgentResult.category === 'research' ? '✅ PASS' : '❌ FAIL', resAgentResult);

// Test 6: WhatsApp Channel routing
const waResult = routeTask({
  channel: 'whatsapp',
  message: 'Is parking available at the house?'
});
console.log('Test 6 (WhatsApp Fast Chat):', waResult.category === 'fast_chat' ? '✅ PASS' : '❌ FAIL', waResult);

// Test 7: Browser automation routing
const egoResult = routeTask({
  message: '/ego Navigate to scalea.it and find council meeting notes'
});
console.log('Test 7 (Ego Browser):', egoResult.category === 'heavy_vision' ? '✅ PASS' : '❌ FAIL', egoResult);

// Test 8: Custom Router Config override
await updateRouterConfig({ coding: 'gemini' });
const updatedCodeResult = routeTask({
  message: 'Write a python script to parse CSV files'
});
console.log('Test 8 (Config Override to gemini):', updatedCodeResult.provider === 'gemini' ? '✅ PASS' : '❌ FAIL', updatedCodeResult);

await resetRouterConfig();
console.log('All ModelRouter unit tests completed!');
