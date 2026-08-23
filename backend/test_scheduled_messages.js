/**
 * Test Suite for WhatsApp Message Scheduling Feature
 */

import {
  parseScheduledDateTime,
  scheduleWhatsAppMessage,
  getScheduledWhatsAppMessages,
  cancelScheduledWhatsAppMessage,
  deleteScheduledWhatsAppMessage,
  sendScheduledWhatsAppMessageNow,
  validateSecurityCode
} from './services/whatsapp.js';
import * as scheduleSkill from './skills/whatsapp_schedule.js';

async function runTests() {
  console.log('🧪 Starting WhatsApp Message Scheduling Test Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Date/Time Parsing Tests
  console.log('--- 1. Testing parseScheduledDateTime ---');
  const now = Date.now();

  const parsed30m = parseScheduledDateTime('in 30 mins');
  assert(parsed30m && parsed30m > now + 29 * 60 * 1000 && parsed30m <= now + 31 * 60 * 1000, 'Parses "in 30 mins"');

  const parsed2h = parseScheduledDateTime('+2h');
  assert(parsed2h && parsed2h > now + 1.9 * 3600 * 1000, 'Parses "+2h"');

  const parsedTomorrow = parseScheduledDateTime('tomorrow morning');
  assert(parsedTomorrow && parsedTomorrow > now, 'Parses "tomorrow morning"');

  const parsedTomorrowAt9 = parseScheduledDateTime('tomorrow at 09:00');
  assert(parsedTomorrowAt9 && parsedTomorrowAt9 > now, 'Parses "tomorrow at 09:00"');

  const testIso = new Date(now + 3600 * 1000).toISOString();
  const parsedIso = parseScheduledDateTime(testIso);
  assert(parsedIso === new Date(testIso).getTime(), 'Parses standard ISO date string');

  const parsedNull = parseScheduledDateTime('invalid gibberish time string');
  assert(parsedNull === null, 'Returns null on invalid time string');

  // 2. Security Code Validation
  console.log('\n--- 2. Testing Security Code Protection ---');
  let threwSecurityError = false;
  try {
    await scheduleWhatsAppMessage({
      recipient: '+393401234567',
      text: 'Test message without code',
      scheduledAt: now + 3600 * 1000,
      securityCode: 'wrong_code_9999'
    });
  } catch (err) {
    threwSecurityError = err.message.includes('SECURITY_VALIDATION_FAILED') || err.message.includes('security');
  }
  assert(threwSecurityError, 'Rejects scheduling without valid security verification code');

  // 3. Scheduling Messages with Valid Code
  console.log('\n--- 3. Testing scheduleWhatsAppMessage ---');
  const validCode = process.env.WHATSAPP_SECURITY_CODE || '1234';
  const targetPhone = '+393488762971';
  const scheduleTime = now + 2 * 3600 * 1000; // 2 hours from now

  const scheduleRes = await scheduleWhatsAppMessage({
    recipient: targetPhone,
    text: 'Buongiorno! Vi ricordiamo le istruzioni di check-in per oggi.',
    scheduledAt: scheduleTime,
    securityCode: validCode,
    createdBy: 'test_runner'
  });

  assert(scheduleRes.success === true, 'Successfully schedules a WhatsApp message');
  assert(scheduleRes.scheduledMessage && scheduleRes.scheduledMessage.id, 'Returns created scheduledMessage with ID');
  const createdId = scheduleRes.scheduledMessage.id;

  // 4. Listing Scheduled Messages
  console.log('\n--- 4. Testing getScheduledWhatsAppMessages ---');
  const list = await getScheduledWhatsAppMessages({ status: 'pending' });
  const found = list.find(m => m.id === createdId);
  assert(found !== undefined, 'Found newly created message in pending scheduled list');
  assert(found && found.status === 'pending', 'Status is "pending"');
  assert(found && found.text.includes('check-in'), 'Message text matches');

  // 5. Cancelling Scheduled Message
  console.log('\n--- 5. Testing cancelScheduledWhatsAppMessage ---');
  const cancelRes = await cancelScheduledWhatsAppMessage(createdId);
  assert(cancelRes.success === true, 'Successfully cancels scheduled message');

  const afterCancelList = await getScheduledWhatsAppMessages({ status: 'all' });
  const cancelledItem = afterCancelList.find(m => m.id === createdId);
  assert(cancelledItem && cancelledItem.status === 'cancelled', 'Status successfully updated to "cancelled"');

  // 6. Testing Agent Skill Tool Execution (schedule_whatsapp_message)
  console.log('\n--- 6. Testing schedule_whatsapp_message Agent Skill ---');
  const skillDeclaration = scheduleSkill.declaration;
  assert(skillDeclaration.name === 'schedule_whatsapp_message', 'Skill declaration name is correct');

  // Test Skill Action: schedule
  const skillScheduleRes = await scheduleSkill.execute({
    action: 'schedule',
    recipient: '+393409876543',
    message: 'Hello from AI Agent via skill schedule!',
    scheduled_time: 'tomorrow at 10:00',
    security_code: validCode
  });
  assert(skillScheduleRes.success === true, 'Agent skill successfully schedules message with natural time "tomorrow at 10:00"');
  const skillSchedId = skillScheduleRes.scheduledMessageId;

  // Test Skill Action: list
  const skillListRes = await scheduleSkill.execute({
    action: 'list',
    status_filter: 'pending'
  });
  assert(skillListRes.totalCount > 0, 'Agent skill lists pending scheduled messages');
  assert(skillListRes.scheduledMessages.some(m => m.id === skillSchedId), 'Agent skill list contains newly scheduled item');

  // Test Skill Action: cancel
  const skillCancelRes = await scheduleSkill.execute({
    action: 'cancel',
    id: skillSchedId
  });
  assert(skillCancelRes.success === true, 'Agent skill cancels scheduled message');

  // Cleanup test records
  await deleteScheduledWhatsAppMessage(createdId).catch(() => {});
  await deleteScheduledWhatsAppMessage(skillSchedId).catch(() => {});

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
