/**
 * Google AI Studio / Gemini API Service
 * Manages GoogleGenerativeAI client initialization, model fallback cascades,
 * tool calling, token estimation, and inference using GEMINI_API_KEY.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Supported Google AI Studio models in priority sequence
export const GEMINI_MODELS = {
  FLASH_PRIMARY: 'gemini-3.7-flash',
  FLASH_PREVIOUS: 'gemini-3.6-flash',
  FLASH_LATEST: 'gemini-flash-latest',
  FLASH_LITE: 'gemini-3.5-flash-lite',
  PRO_LATEST: 'gemini-pro-latest'
};

const DEFAULT_MODEL = GEMINI_MODELS.FLASH_PRIMARY;

let cachedGenAI = null;
let lastApiKey = null;

/**
 * Get active GEMINI_API_KEY or GOOGLE_API_KEY from environment
 */
export function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
}

/**
 * Check if Google AI Studio API key is present
 */
export function hasGeminiKey() {
  const key = getGeminiApiKey();
  return typeof key === 'string' && key.trim().length > 0;
}

/**
 * Get singleton instance of GoogleGenerativeAI client
 */
export function getGeminiClient() {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in backend/.env');
  }

  if (!cachedGenAI || lastApiKey !== apiKey) {
    cachedGenAI = new GoogleGenerativeAI(apiKey);
    lastApiKey = apiKey;
  }
  return cachedGenAI;
}

/**
 * Normalize requested model name for Google AI Studio
 */
export function normalizeGeminiModel(modelName) {
  if (!modelName || modelName === 'gemini' || modelName === 'gemini_api' || modelName === 'auto') {
    return DEFAULT_MODEL;
  }
  if (modelName.startsWith('gemini:')) {
    return modelName.substring(7);
  }
  if (modelName.startsWith('gemini_api:')) {
    return modelName.substring(11);
  }
  // If legacy 2.5 flash requested on AI studio, upgrade to 3.7 flash
  if (modelName === 'gemini-2.5-flash' || modelName === 'gemini-1.5-flash') {
    return GEMINI_MODELS.FLASH_PRIMARY;
  }
  if (modelName === 'gemini-2.5-flash-lite' || modelName === 'gemini-1.5-flash-lite') {
    return GEMINI_MODELS.FLASH_LITE;
  }
  return modelName;
}

/**
 * Generate content using Google AI Studio API with automatic fallback
 * 
 * @param {Object} options
 * @param {Array|string} options.contents - History or prompt
 * @param {string} [options.model] - Specific gemini model name
 * @param {string} [options.systemInstruction] - System prompt instructions
 * @param {Array} [options.tools] - Function declarations array
 * @param {Object} [options.generationConfig] - Temperature, maxTokens, responseSchema etc.
 * @param {AbortSignal} [options.signal] - Abort controller signal
 * @returns {Promise<{ text: string, functionCalls: Array|null, originalParts: Array, model: string, usage: Object }>}
 */
export async function generateGeminiContent({
  contents,
  model = DEFAULT_MODEL,
  systemInstruction,
  tools,
  generationConfig,
  signal
} = {}) {
  const genAI = getGeminiClient();
  const targetModel = normalizeGeminiModel(model);

  const fallbackSequence = [
    targetModel,
    GEMINI_MODELS.FLASH_PRIMARY,
    GEMINI_MODELS.FLASH_PREVIOUS,
    GEMINI_MODELS.FLASH_LATEST
  ].filter((m, idx, arr) => arr.indexOf(m) === idx);

  let lastError = null;

  for (const currentModel of fallbackSequence) {
    try {
      const modelOptions = { model: currentModel };
      if (tools && tools.length > 0) {
        modelOptions.tools = tools;
      }
      if (systemInstruction) {
        modelOptions.systemInstruction = typeof systemInstruction === 'string'
          ? systemInstruction
          : (systemInstruction.parts?.[0]?.text || systemInstruction.text || String(systemInstruction));
      }
      if (generationConfig) {
        modelOptions.generationConfig = generationConfig;
      }

      const generativeModel = genAI.getGenerativeModel(modelOptions);

      // Handle formatted contents or raw string with thoughtSignature preservation
      let formattedContents = contents;
      if (typeof contents === 'string') {
        formattedContents = [{ role: 'user', parts: [{ text: contents }] }];
      } else if (Array.isArray(contents)) {
        // Collect function calls that have valid thought signatures
        const validCallNames = new Set();
        formattedContents = contents.map(h => {
          const role = h.role === 'model' ? 'model' : 'user';
          const parts = (h.parts || []).map(p => {
            if (p.text !== undefined) return { text: p.text };
            if (p.functionCall) {
              const hasSig = !!(p.thoughtSignature || p.thought_signature || p.thought);
              if (hasSig) {
                validCallNames.add(p.functionCall.name);
                const fcPart = { functionCall: p.functionCall };
                if (p.thoughtSignature) fcPart.thoughtSignature = p.thoughtSignature;
                if (p.thought_signature) fcPart.thought_signature = p.thought_signature;
                if (p.thought) fcPart.thought = p.thought;
                for (const k of Object.keys(p)) {
                  if (!fcPart[k]) fcPart[k] = p[k];
                }
                return fcPart;
              } else {
                // If historical function call lacks thoughtSignature (from older sessions or other models),
                // represent as text to avoid Gemini API 400 rejection
                return { text: `[Tool Executed: ${p.functionCall.name || 'tool'} with parameters ${JSON.stringify(p.functionCall.args || {})}]` };
              }
            }
            if (p.functionResponse) {
              if (validCallNames.has(p.functionResponse.name)) {
                return { functionResponse: p.functionResponse };
              } else {
                return { text: `[Tool Result for ${p.functionResponse.name || 'tool'}: ${typeof p.functionResponse.response === 'string' ? p.functionResponse.response : JSON.stringify(p.functionResponse.response || {})}]` };
              }
            }
            if (p.inlineData) return { inlineData: p.inlineData };
            return { ...p };
          });
          return { role, parts };
        });
      }

      const generatePromise = generativeModel.generateContent({ contents: formattedContents });

      let result;
      if (signal) {
        const abortPromise = new Promise((_, reject) => {
          if (signal.aborted) return reject(new Error('Gemini API request aborted'));
          signal.addEventListener('abort', () => reject(new Error('Gemini API request aborted')));
        });
        result = await Promise.race([generatePromise, abortPromise]);
      } else {
        result = await generatePromise;
      }

      const res = result.response;
      let text = '';
      try {
        text = res.text();
      } catch (_) {
        text = '';
      }

      const candidateParts = res.candidates?.[0]?.content?.parts || [];
      const functionCalls = candidateParts
        .filter(p => p && p.functionCall)
        .map(p => p.functionCall);

      return {
        text: text || '',
        functionCalls: functionCalls.length > 0 ? functionCalls : null,
        originalParts: candidateParts,
        model: currentModel,
        usage: {
          promptTokens: res.usageMetadata?.promptTokenCount || 0,
          candidatesTokens: res.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: res.usageMetadata?.totalTokenCount || 0
        }
      };
    } catch (err) {
      lastError = err;
      console.warn(`[GeminiService] Inference failed on model ${currentModel}: ${err.message}. Trying next fallback...`);
      // If error is an abort or 401 unauthenticated, don't keep looping
      if (err.message?.includes('aborted') || err.message?.includes('API_KEY_INVALID') || err.message?.includes('401')) {
        throw err;
      }
    }
  }

  throw lastError || new Error('All Gemini models in fallback sequence failed.');
}

/**
 * Test Google AI Studio API connectivity and latency
 */
export async function testGeminiInference(modelName = DEFAULT_MODEL) {
  const startTime = Date.now();
  const res = await generateGeminiContent({
    contents: 'Say "Google AI Studio Ready" in 4 words.',
    model: modelName
  });
  return {
    success: true,
    latency: Date.now() - startTime,
    model: res.model,
    reply: res.text.trim()
  };
}

export default {
  GEMINI_MODELS,
  getGeminiApiKey,
  hasGeminiKey,
  getGeminiClient,
  normalizeGeminiModel,
  generateGeminiContent,
  testGeminiInference
};
