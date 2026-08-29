/**
 * Ollama Cloud Resilient Client with Multi-Key Failover
 * Automatically detects rate limits (429), quota limits, expired keys (401/403),
 * or server errors and seamlessly falls back to OLLAMA_API_KEY_2.
 */

/**
 * Returns configured Ollama Cloud API keys in priority order.
 * @returns {string[]}
 */
export function getOllamaCloudKeys() {
  const keys = [];
  if (process.env.OLLAMA_API_KEY && process.env.OLLAMA_API_KEY.trim()) {
    keys.push(process.env.OLLAMA_API_KEY.trim());
  }
  if (process.env.OLLAMA_API_KEY_2 && process.env.OLLAMA_API_KEY_2.trim()) {
    const key2 = process.env.OLLAMA_API_KEY_2.trim();
    if (!keys.includes(key2)) {
      keys.push(key2);
    }
  }
  return keys;
}

/**
 * Checks if an HTTP status or error message qualifies for key failover.
 */
function isFailoverEligible(status, errorText = '') {
  // 429: Too Many Requests (Rate limit / Quota reached)
  // 401/403: Unauthorized / Forbidden / Expired or invalid key
  // 500/502/503/504: Ollama server overload
  if ([429, 401, 403, 500, 502, 503, 504].includes(status)) {
    return true;
  }
  const lower = String(errorText).toLowerCase();
  return (
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('limit exceeded') ||
    lower.includes('credit') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('exhausted') ||
    lower.includes('too many requests')
  );
}

/**
 * Executes a fetch against Ollama Cloud API with automatic key failover.
 * 
 * @param {string} url - Target URL (e.g. 'https://ollama.com/api/chat')
 * @param {RequestInit} options - Fetch options
 * @param {Object} [config]
 * @param {(info: { fromKeyIndex: number, toKeyIndex: number, status: number, error: string }) => void} [config.onFailover]
 * @param {string} [config.logTag='Ollama Cloud']
 * @returns {Promise<Response>}
 */
export async function fetchOllamaCloudWithFailover(url, options = {}, config = {}) {
  const keys = getOllamaCloudKeys();
  const logTag = config.logTag || 'Ollama Cloud';

  if (keys.length === 0) {
    throw new Error('OLLAMA_API_KEY is not configured in backend/.env');
  }

  let lastError = null;

  for (let i = 0; i < keys.length; i++) {
    const currentKey = keys[i];
    const keyLabel = i === 0 ? 'Primary (OLLAMA_API_KEY)' : `Backup #${i + 1} (OLLAMA_API_KEY_${i + 1})`;

    const headers = {
      ...(options.headers || {}),
      'Authorization': `Bearer ${currentKey}`
    };

    try {
      const res = await fetch(url, {
        ...options,
        headers
      });

      if (res.ok) {
        if (i > 0) {
          console.log(`[${logTag}] Successfully completed request using ${keyLabel}`);
        }
        return res;
      }

      // Non-OK response received
      const errText = await res.text();
      lastError = new Error(`Ollama Cloud Error (${res.status}): ${errText}`);

      const hasNextKey = i + 1 < keys.length;
      if (hasNextKey && isFailoverEligible(res.status, errText)) {
        const nextKeyLabel = `Backup #${i + 2} (OLLAMA_API_KEY_${i + 2})`;
        console.warn(`[${logTag} Failover] ${keyLabel} failed with status ${res.status} ("${errText.slice(0, 150)}"). Failing over to ${nextKeyLabel}...`);
        
        if (typeof config.onFailover === 'function') {
          try {
            config.onFailover({
              fromKeyIndex: i + 1,
              toKeyIndex: i + 2,
              status: res.status,
              error: errText
            });
          } catch (cbErr) {
            console.error(`[${logTag}] onFailover callback error:`, cbErr);
          }
        }
        // Proceed to next iteration with backup key
        continue;
      }

      // If not eligible for failover or no next key available, throw error
      throw lastError;
    } catch (err) {
      // If error is an AbortError caused by timeout or stop, rethrow unless we want key retry
      if (err.name === 'AbortError' && options.signal?.aborted) {
        throw err;
      }

      const hasNextKey = i + 1 < keys.length;
      if (hasNextKey && err !== lastError) {
        // Network-level error failover
        console.warn(`[${logTag} Failover] Network error on ${keyLabel} (${err.message}). Trying backup key...`);
        if (typeof config.onFailover === 'function') {
          config.onFailover({
            fromKeyIndex: i + 1,
            toKeyIndex: i + 2,
            status: 0,
            error: err.message
          });
        }
        continue;
      }

      throw (lastError || err);
    }
  }

  throw lastError || new Error('All configured Ollama Cloud API keys failed.');
}

/**
 * Fetches available models from Ollama Cloud with automatic key failover.
 */
export async function fetchOllamaCloudModels() {
  const res = await fetchOllamaCloudWithFailover('https://ollama.com/api/tags', {
    signal: AbortSignal.timeout(8000)
  }, { logTag: 'Ollama Cloud Models' });

  const data = await res.json();
  return data.models || [];
}

/**
 * Runs a lightweight test inference against Ollama Cloud.
 */
export async function testOllamaCloudInference(model = 'nemotron-3-nano:30b', onFailover) {
  const startTime = Date.now();
  const res = await fetchOllamaCloudWithFailover('https://ollama.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Say "Ready" in one word.' }],
      stream: false
    }),
    signal: AbortSignal.timeout(15000)
  }, {
    logTag: 'Ollama Cloud Diagnostic',
    onFailover
  });

  const data = await res.json();
  const reply = (data.message?.content || data.message?.thinking || 'Connected').trim();
  return {
    success: true,
    latency: Date.now() - startTime,
    model,
    reply: reply.slice(0, 100)
  };
}
