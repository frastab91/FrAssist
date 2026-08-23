import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

import { setAutoReplyStatus, getAutoReplyContacts, isAutoReplyEnabled, evaluateAutoReply } from './services/whatsapp.js';
import * as autoReplySkill from './skills/whatsapp_auto_reply.js';

async function runAutoReplyTests() {
  console.log('--- STARTING TARGETED AUTO-REPLY TESTS ---');

  // Test 1: Manage Auto-Reply Status
  console.log('\n[Test 1] Testing setAutoReplyStatus & isAutoReplyEnabled:');
  await setAutoReplyStatus('+393488762971', true, 'Giovanna');
  const enabled = await isAutoReplyEnabled('+393488762971');
  console.log(`Auto-reply for +393488762971: ${enabled} (Expected: true)`);
  if (!enabled) throw new Error('Test 1 failed: Auto-reply was not enabled.');

  const contacts = await getAutoReplyContacts();
  console.log('Auto-reply contacts list:', contacts);

  // Test 2: In-Knowledge Query Evaluation (should generate grounded reply)
  console.log('\n[Test 2] Testing In-Knowledge Query:');
  const inKnowledgeEval = await evaluateAutoReply(
    'Quali sono i property ID di Hostex per Piano 1 e Attico?',
    'Giovanna',
    '+393488762971',
    '280040524779650@lid'
  );
  console.log('In-Knowledge Eval Result:', inKnowledgeEval);
  if (!inKnowledgeEval.shouldReply) {
    throw new Error('Test 2 failed: Expected grounded reply for in-knowledge query.');
  }

  // Test 3: Out-of-Knowledge Query Evaluation (MUST be NO_KNOWLEDGE_MATCH / Silent)
  console.log('\n[Test 3] Testing Out-of-Knowledge Query (Strict Non-Reply):');
  const outOfKnowledgeEval = await evaluateAutoReply(
    'Posso portare il mio elicottero privato sul tetto dell appartamento?',
    'Giovanna',
    '+393488762971',
    '280040524779650@lid'
  );
  console.log('Out-of-Knowledge Eval Result:', outOfKnowledgeEval);
  if (outOfKnowledgeEval.shouldReply) {
    throw new Error('Test 3 failed: STRICT GUARDRAIL VIOLATION. Assistant attempted to reply to an ungrounded question!');
  }
  console.log('Strict guardrail confirmed: Assistant stayed silent when knowledge was not found.');

  // Test 4: Dynamic Skill execution
  console.log('\n[Test 4] Testing manage_whatsapp_auto_reply skill:');
  const skillList = await autoReplySkill.execute({ action: 'list' });
  console.log('Skill list output:', skillList);

  const toggleRes = await autoReplySkill.execute({ action: 'toggle', phone: '+393488762971' });
  console.log('Skill toggle output:', toggleRes);

  console.log('\n--- ALL TARGETED AUTO-REPLY TESTS PASSED SUCCESSFULLY! ---');
}

runAutoReplyTests().catch(err => {
  console.error('\nAUTO-REPLY TEST SUITE FAILED:', err);
  process.exit(1);
});
