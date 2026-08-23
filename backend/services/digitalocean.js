/**
 * DigitalOcean GenAI Inference Client
 * Handles requests to DO Serverless Inference / Model Router (e.g. router:frassistrouter)
 */

const DO_INFERENCE_URL = process.env.DO_INFERENCE_URL || 'https://inference.do-ai.run/v1/chat/completions';
const DO_ROUTER_MODEL = process.env.DO_ROUTER_MODEL || 'router:general';

/**
 * Get the API Key for DigitalOcean Inference
 */
function getApiKey() {
  return process.env.DIGITAL_OCEAN_API_KEY || process.env.DO_INFERENCE_API_KEY || '';
}

/**
 * Perform a chat completion using DigitalOcean Inference Router
 * 
 * @param {Array<{role: string, content: string}>} messages - List of chat messages
 * @param {Object} options - Optional parameters
 * @param {string} [options.model] - Model name or router (defaults to router:frassistrouter)
 * @param {number} [options.temperature] - Sampling temperature
 * @param {number} [options.max_tokens] - Max tokens to generate
 * @param {boolean} [options.stream] - Whether to stream response
 * @returns {Promise<string|ReadableStream>} - Generated text or stream
 */
import { recordTokenUsage, estimateTokens } from './tokenTracker.js';

export async function createChatCompletion(messages, options = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('DigitalOcean API key not found. Please set DO_INFERENCE_API_KEY or DIGITAL_OCEAN_API_KEY in backend/.env');
  }

  let model = options.model || DO_ROUTER_MODEL;
  if (model === 'frassistrouter') {
    model = 'router:frassistrouter';
  } else if (model === 'general') {
    model = 'router:general';
  }
  const isStream = options.stream === true;

  const payload = {
    model,
    messages,
    stream: isStream,
    ...(options.temperature !== undefined && { temperature: options.temperature }),
    ...(options.max_tokens !== undefined && { max_tokens: options.max_tokens })
  };

  const response = await fetch(DO_INFERENCE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`DigitalOcean Inference Error (${response.status}): ${errorBody}`);
  }

  if (isStream) {
    return response.body;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const servedModel = data.model || model;
  
  // Extract usage metadata from DO response or calculate fallback
  const promptTokens = data.usage?.prompt_tokens 
    || data.usage?.input_tokens 
    || estimateTokens(messages.map(m => m.content).join('\n'));
  const completionTokens = data.usage?.completion_tokens 
    || data.usage?.output_tokens 
    || estimateTokens(content);
  const totalTokens = data.usage?.total_tokens || (promptTokens + completionTokens);

  if (totalTokens > 0) {
    try {
      await recordTokenUsage(
        options.agentId || 'digitalocean_service',
        promptTokens,
        completionTokens,
        totalTokens,
        servedModel
      );
    } catch (err) {
      console.warn('[DO TokenTrack Error]:', err.message);
    }
  }

  if (options.includeUsage) {
    return {
      content,
      usage: { promptTokens, completionTokens, totalTokens },
      model: servedModel
    };
  }

  return content;
}

/**
 * Stream text and yield tokens asynchronously (SSE parser)
 * 
 * @param {Array<{role: string, content: string}>} messages
 * @param {Object} options
 * @returns {AsyncGenerator<string>}
 */
export async function* streamChatCompletion(messages, options = {}) {
  const stream = await createChatCompletion(messages, { ...options, stream: true });
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;
        if (trimmed === 'data: [DONE]') return;

        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              yield delta;
            }
          } catch (e) {
            // Ignore parse errors on partial frames
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export default {
  createChatCompletion,
  streamChatCompletion,
  DO_INFERENCE_URL,
  DO_ROUTER_MODEL
};
