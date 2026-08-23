/**
 * WhatsApp Messaging Skill
 * Allows FrAssist agents to send WhatsApp messages after human security code validation.
 */

import { sendWhatsAppMessage, getWhatsAppStatus } from '../services/whatsapp.js';

export const declaration = {
  name: 'send_whatsapp_message',
  description: 'Send a WhatsApp message to a phone number (e.g. +393401234567). IMPORTANT: Requires a valid security_code provided by the user. If the user has not provided their security verification code, do not make up a code; draft the response and ask the user to provide their security code to confirm and send.',
  parameters: {
    type: 'OBJECT',
    properties: {
      recipient: {
        type: 'STRING',
        description: 'The recipient phone number with country code (e.g. +393401234567, 393401234567, etc.)'
      },
      message: {
        type: 'STRING',
        description: 'The text message content to send.'
      },
      security_code: {
        type: 'STRING',
        description: 'The user security validation code (e.g. 1234). Required to authorize sending.'
      }
    },
    required: ['recipient', 'message', 'security_code']
  }
};

export async function execute(args = {}) {
  const { recipient, message, security_code } = args;
  if (!security_code) {
    throw new Error('Security verification code is required. Please ask the user to provide their WhatsApp security code to authorize sending.');
  }

  if (!recipient || !message) {
    throw new Error('Both "recipient" and "message" parameters are required.');
  }

  const status = getWhatsAppStatus();
  if (!status.connected) {
    throw new Error('WhatsApp is not currently connected. Please pair your WhatsApp device in the FrAssist UI.');
  }

  const result = await sendWhatsAppMessage(recipient, message, security_code);
  return {
    success: true,
    message: `WhatsApp message sent successfully to ${recipient}`,
    details: result
  };
}
