/**
 * WhatsApp Auto-Reply Management Skill
 * Allows toggling and viewing automated, strictly-grounded AI responses for specific contacts.
 */

import { setAutoReplyStatus, getAutoReplyContacts, isAutoReplyEnabled, getWhatsAppStatus } from '../services/whatsapp.js';

export const declaration = {
  name: 'manage_whatsapp_auto_reply',
  description: 'Enable, disable, or list automated AI responses for specific WhatsApp contacts. Auto-reply strictly adheres to the knowledge base: if an inquiry cannot be answered with 100% certainty from the knowledge base, the AI will NEVER reply and will leave the message for human review.',
  parameters: {
    type: 'OBJECT',
    properties: {
      action: {
        type: 'STRING',
        enum: ['enable', 'disable', 'toggle', 'list', 'status'],
        description: 'Action to perform: "enable", "disable", "toggle", "list", or "status".'
      },
      phone: {
        type: 'STRING',
        description: 'Phone number of the contact (e.g. "+393488762971" or "393488762971"). Required for enable/disable/toggle/status.'
      },
      contact_name: {
        type: 'STRING',
        description: 'Optional name of the contact (e.g. "Giovanna").'
      }
    },
    required: ['action']
  }
};

export async function execute(args = {}) {
  const { action = 'list', phone, contact_name } = args;
  const status = getWhatsAppStatus();

  if (action === 'list') {
    const contacts = await getAutoReplyContacts();
    return {
      whatsappConnected: status.connected,
      totalConfigured: contacts.length,
      activeAutoReplies: contacts.filter(c => c.enabled),
      allContacts: contacts
    };
  }

  if (!phone) {
    throw new Error('Parameter "phone" is required for action: ' + action);
  }

  if (action === 'enable') {
    const res = await setAutoReplyStatus(phone, true, contact_name || '');
    return {
      success: true,
      message: `Auto-Reply successfully ENABLED for ${res.phone} (${contact_name || 'Contact'}). Only strictly knowledge-grounded replies will be sent.`,
      details: res
    };
  }

  if (action === 'disable') {
    const res = await setAutoReplyStatus(phone, false, contact_name || '');
    return {
      success: true,
      message: `Auto-Reply DISABLED for ${res.phone}. All messages from this contact now require manual responses.`,
      details: res
    };
  }

  if (action === 'toggle') {
    const current = await isAutoReplyEnabled(phone);
    const res = await setAutoReplyStatus(phone, !current, contact_name || '');
    return {
      success: true,
      message: `Auto-Reply toggled to ${!current ? 'ENABLED' : 'DISABLED'} for ${res.phone}.`,
      details: res
    };
  }

  if (action === 'status') {
    const enabled = await isAutoReplyEnabled(phone);
    return {
      phone,
      autoReplyActive: enabled,
      rule: 'Strictly grounded in project knowledge base. Silent if answer not found.'
    };
  }

  throw new Error('Unsupported action: ' + action);
}
