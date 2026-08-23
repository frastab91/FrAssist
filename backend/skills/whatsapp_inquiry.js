/**
 * WhatsApp Inquiry Skill
 * Allows FrAssist agents across any workspace or channel to inspect WhatsApp messages,
 * find unreplied conversations, search conversation history, or view sent/received messages.
 */

import { getWhatsAppMessages, getWhatsAppStatus } from '../services/whatsapp.js';

export const declaration = {
  name: 'inquire_whatsapp_messages',
  description: 'Inquire WhatsApp to view latest messages, retrieve unreplied messages awaiting response, view messages already replied to or sent, or search conversation history with a specific phone number or keyword.',
  parameters: {
    type: 'OBJECT',
    properties: {
      filter: {
        type: 'STRING',
        enum: ['latest', 'all', 'unreplied', 'replied', 'sent', 'received', 'unread'],
        description: 'Filter mode: "latest" or "all" (all recent messages), "unreplied" (incoming messages awaiting reply), "replied" (incoming messages that were replied to), "sent" (messages sent by user/agent), "received" (all incoming messages). Default is "latest".'
      },
      query: {
        type: 'STRING',
        description: 'Optional keyword or contact name to search within message contents or sender names.'
      },
      phone: {
        type: 'STRING',
        description: 'Optional phone number to filter conversation history with a specific contact.'
      },
      limit: {
        type: 'INTEGER',
        description: 'Maximum number of messages to return (default: 15, max: 50).'
      }
    }
  }
};

export async function execute(args = {}) {
  const { filter = 'latest', query = null, phone = null, limit = 15 } = args;
  const status = getWhatsAppStatus();

  const messages = await getWhatsAppMessages({ filter, query, phone, limit });

  const unrepliedCount = messages.filter(m => !m.fromMe && !m.replied).length;

  return {
    whatsappConnected: status.connected,
    pairedUser: status.user?.phone || null,
    filterApplied: filter,
    queryApplied: query || null,
    totalReturned: messages.length,
    unrepliedCount,
    statusNote: messages.length === 0 
      ? (status.connected ? 'No messages found in the local log matching the criteria.' : 'WhatsApp is not currently connected in FrAssist.')
      : `Found ${messages.length} message(s).`,
    messages: messages.map(m => ({
      id: m.id,
      senderPhone: m.senderPhone,
      senderName: m.senderName,
      direction: m.fromMe ? 'outgoing (sent by you/agent)' : 'incoming (received)',
      text: m.text,
      isReplied: m.replied,
      needsReply: !m.fromMe && !m.replied,
      timestamp: new Date(m.timestamp).toLocaleString()
    }))
  };
}
