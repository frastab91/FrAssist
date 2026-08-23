/**
 * WhatsApp Message Scheduling Skill
 * Allows FrAssist agents to schedule WhatsApp messages to be delivered at optimal future times,
 * inspect pending/historical scheduled messages, cancel scheduled messages, or trigger immediate dispatch.
 */

import {
  scheduleWhatsAppMessage,
  getScheduledWhatsAppMessages,
  cancelScheduledWhatsAppMessage,
  sendScheduledWhatsAppMessageNow,
  getWhatsAppStatus,
  parseScheduledDateTime
} from '../services/whatsapp.js';

export const declaration = {
  name: 'schedule_whatsapp_message',
  description: 'Schedule a WhatsApp message to be sent at a specific future date/time or optimal hour (e.g. "tomorrow at 9:00 AM", "in 2 hours", "tonight at 20:00", "next Monday at 10:00 AM", or ISO date string). Also supports listing scheduled messages, cancelling pending messages, or dispatching them immediately. IMPORTANT: Scheduling or sending messages strictly requires the user security_code. If the user has not provided their security verification code, do not guess; draft the message and schedule details and ask the user for their security code to confirm.',
  parameters: {
    type: 'OBJECT',
    properties: {
      action: {
        type: 'STRING',
        enum: ['schedule', 'list', 'cancel', 'send_now'],
        description: 'Action to perform: "schedule" (default - schedule a new message), "list" (view pending or historical scheduled messages), "cancel" (cancel a scheduled message by ID), or "send_now" (immediately dispatch a scheduled message).'
      },
      recipient: {
        type: 'STRING',
        description: 'The recipient phone number (e.g. +393401234567, 393401234567) or contact name. Required for "schedule".'
      },
      message: {
        type: 'STRING',
        description: 'The message text content to send. Required for "schedule".'
      },
      scheduled_time: {
        type: 'STRING',
        description: 'The target delivery time. Supports natural relative expressions (e.g. "tomorrow at 9am", "in 3 hours", "+45m", "tonight at 20:00", "next Monday at 09:30") or ISO date strings (e.g. "2026-08-23T09:00:00"). Required for "schedule".'
      },
      security_code: {
        type: 'STRING',
        description: 'The user security validation code (e.g. "1234"). Required for "schedule" and "send_now" to authorize dispatch.'
      },
      id: {
        type: 'STRING',
        description: 'The scheduled message ID (e.g. "sched_1787..."). Required for "cancel" and "send_now".'
      },
      status_filter: {
        type: 'STRING',
        enum: ['pending', 'sent', 'cancelled', 'failed', 'all'],
        description: 'Optional status filter when listing scheduled messages (default is "pending").'
      }
    }
  }
};

export async function execute(args = {}) {
  const {
    action = 'schedule',
    recipient,
    message,
    scheduled_time,
    security_code,
    id,
    status_filter = 'pending'
  } = args;

  const status = getWhatsAppStatus();

  // Action: LIST
  if (action === 'list') {
    const list = await getScheduledWhatsAppMessages({ status: status_filter });
    const pendingCount = list.filter(m => m.status === 'pending').length;
    return {
      whatsappConnected: status.connected,
      filter: status_filter,
      totalCount: list.length,
      pendingCount,
      scheduledMessages: list.map(m => ({
        id: m.id,
        recipient: m.contactName ? `${m.contactName} (${m.phone})` : m.phone,
        message: m.text,
        scheduledFor: new Date(m.scheduledAt).toLocaleString(),
        scheduledAtIso: m.scheduledAtIso,
        status: m.status,
        createdAt: m.createdAt,
        sentAt: m.sentAt,
        errorMessage: m.errorMessage
      }))
    };
  }

  // Action: CANCEL
  if (action === 'cancel') {
    if (!id) {
      throw new Error('Parameter "id" is required to cancel a scheduled message.');
    }
    const result = await cancelScheduledWhatsAppMessage(id);
    return {
      success: true,
      message: `Scheduled WhatsApp message (${id}) has been cancelled successfully.`,
      details: result
    };
  }

  // Action: SEND NOW
  if (action === 'send_now') {
    if (!id) {
      throw new Error('Parameter "id" is required to immediately dispatch a scheduled message.');
    }
    if (!security_code) {
      throw new Error('Security verification code is required to authorize immediate message dispatch.');
    }
    const result = await sendScheduledWhatsAppMessageNow(id, security_code);
    return {
      success: true,
      message: `Scheduled message (${id}) dispatched immediately.`,
      details: result
    };
  }

  // Action: SCHEDULE (Default)
  if (action === 'schedule') {
    if (!security_code) {
      throw new Error('Security verification code is required. Please ask the user to provide their WhatsApp security code to authorize scheduling and dispatching messages.');
    }

    if (!recipient || !message || !scheduled_time) {
      throw new Error('Parameters "recipient", "message", and "scheduled_time" are all required to schedule a WhatsApp message.');
    }

    const parsedTime = parseScheduledDateTime(scheduled_time);
    if (!parsedTime) {
      throw new Error(`Could not parse scheduled delivery time: "${scheduled_time}". Please specify a clear time (e.g. "tomorrow at 9am", "in 2 hours", or ISO timestamp).`);
    }

    const result = await scheduleWhatsAppMessage({
      recipient,
      text: message,
      scheduledAt: parsedTime,
      securityCode: security_code,
      createdBy: 'agent'
    });

    return {
      success: true,
      scheduledMessageId: result.scheduledMessage.id,
      recipient: result.scheduledMessage.contactName ? `${result.scheduledMessage.contactName} (${result.scheduledMessage.phone})` : result.scheduledMessage.phone,
      scheduledFor: new Date(result.scheduledMessage.scheduledAt).toLocaleString(),
      scheduledAtIso: result.scheduledMessage.scheduledAtIso,
      text: result.scheduledMessage.text,
      status: result.scheduledMessage.status,
      message: `WhatsApp message to ${result.scheduledMessage.contactName || result.scheduledMessage.phone} has been successfully scheduled for ${new Date(result.scheduledMessage.scheduledAt).toLocaleString()}.`
    };
  }

  throw new Error('Unsupported action: ' + action);
}
