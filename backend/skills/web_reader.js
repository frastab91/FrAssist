export const declaration = {
  name: 'web_reader',
  description: 'Read the full text and content of any website, article, or documentation directly into clean Markdown. Highly effective for news (e.g. Financial Times, Bloomberg, Medium, Substack) and research, completely bypassing Cloudflare Turnstile and bot detection.',
  parameters: {
    type: 'OBJECT',
    properties: {
      url: { type: 'STRING', description: 'The absolute URL of the web page or article to read.' },
      maxLength: { type: 'NUMBER', description: 'Optional maximum character length to return (default: 20000).' }
    },
    required: ['url']
  }
};

export async function execute(args) {
  let { url, maxLength = 20000 } = args;
  if (!url) return { error: 'A valid URL is required.' };
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  // 1. Try Jina Reader
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'X-Return-Format': 'markdown',
      'X-Timeout': '25'
    };

    if (process.env.JINA_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;
    }

    const res = await fetch(jinaUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30000)
    });

    if (res.ok) {
      let content = await res.text();
      if (content && content.trim().length > 100) {
        if (content.length > maxLength) {
          content = content.slice(0, maxLength) + `\n\n[Content truncated to ${maxLength} characters...]`;
        }
        return {
          source: 'jina_reader',
          url,
          content
        };
      }
    }
  } catch (err) {
    console.warn('[web_reader] Jina Reader error, attempting fallback:', err.message);
  }

  // 2. Try Firecrawl API if configured
  if (process.env.FIRECRAWL_API_KEY) {
    try {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url,
          formats: ['markdown']
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (res.ok) {
        const data = await res.json();
        let md = data.data?.markdown || data.markdown;
        if (md) {
          if (md.length > maxLength) {
            md = md.slice(0, maxLength) + `\n\n[Content truncated...]`;
          }
          return {
            source: 'firecrawl',
            url,
            content: md
          };
        }
      }
    } catch (err) {
      console.warn('[web_reader] Firecrawl error:', err.message);
    }
  }

  // 3. Fallback: Direct fetch with basic HTML extraction
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      const html = await res.text();
      // Basic text cleanup
      const clean = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return {
        source: 'direct_fetch',
        url,
        content: clean.slice(0, maxLength)
      };
    }
  } catch (err) {
    return { error: `Failed to read web page: ${err.message}` };
  }

  return { error: 'Unable to extract readable content from URL.' };
}
