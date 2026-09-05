import { EgoAdapter } from './utils/ego_adapter.js';

export const declaration = {
  name: 'web_reader',
  description: 'Read the full text and content of any website, article, or documentation directly into clean Markdown. Powered by live in-browser content distillation sharing your authenticated session, completely bypassing Cloudflare Turnstile, bot detection, navigation chrome, and paywall hurdles (e.g. Financial Times, Bloomberg, Substack, Medium, NYT). ALWAYS use this when asked to read, summarize, or analyze URLs.',
  parameters: {
    type: 'OBJECT',
    properties: {
      url: { type: 'STRING', description: 'The absolute URL of the web page or article to read.' },
      maxLength: { type: 'NUMBER', description: 'Optional maximum character length to return (default: 25000).' }
    },
    required: ['url']
  }
};

function isBlockedOrError(text) {
  if (!text || text.trim().length < 100) return true;
  const lower = text.toLowerCase();
  
  if (lower.startsWith('title: application error') || lower.includes('markdown content:\napplication error')) {
    return true;
  }
  
  const blockPhrases = [
    'application error',
    'subscribe to read',
    'become an ft subscriber',
    'ft.com/products',
    'paywall',
    'access denied',
    '403 forbidden',
    '401 unauthorized',
    'please enable js and disable any ad blocker',
    'verify you are human',
    'attention required! | cloudflare',
    'challenges.cloudflare.com',
    'one more step\n\nplease complete the security check',
    'page you are trying to access does not exist',
    'the page you are trying to access does not exist',
    'page not found',
    'error code\n:\n404'
  ];
  
  const isPaywallSnippet = blockPhrases.some(phrase => lower.includes(phrase));
  if (isPaywallSnippet && (text.length < 2500 || lower.includes('become an ft subscriber') || lower.includes('title: subscribe to read') || lower.includes('title: application error') || lower.includes('page you are trying to access does not exist'))) {
    return true;
  }
  return false;
}

export async function execute(args) {
  let { url, maxLength = 25000 } = args;
  if (!url) return { error: 'A valid URL is required.' };
  
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }

  // 1. Prioritize In-Browser Content Distillation (shares user logins, cookies, and handles live dynamic rendering)
  if (EgoAdapter.isAvailable()) {
    try {
      if (args.sessionId) {
        EgoAdapter.setSessionContext(args.sessionId);
      }
      const res = await EgoAdapter.distillPage(url, EgoAdapter.getSpaceName(args.sessionId));
      if (res && res.text && !res.error && !isBlockedOrError(res.text) && res.text.trim().length > 250) {
        let content = '';
        if (res.title) content += `# ${res.title}\n\n`;
        if (res.byline || res.publishDate) {
          content += `*${[res.byline, res.publishDate].filter(Boolean).join(' | ')}*\n\n`;
        }
        content += res.text;

        if (content.length > maxLength) {
          content = content.slice(0, maxLength) + `\n\n[Content truncated to ${maxLength} characters...]`;
        }
        return {
          source: 'ego_distillation',
          url,
          title: res.title,
          byline: res.byline,
          publishDate: res.publishDate,
          content
        };
      }
    } catch (egoErr) {
      console.warn('[web_reader] Ego in-browser distillation error, falling back:', egoErr.message);
    }
  }

  // 2. Fallback: Jina Reader
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'X-Return-Format': 'markdown',
      'X-Timeout': '20'
    };

    if (process.env.JINA_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;
    }

    const res = await fetch(jinaUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(20000)
    });

    if (res.ok) {
      let content = await res.text();
      if (!isBlockedOrError(content)) {
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
    console.warn('[web_reader] Jina Reader error or blocked, attempting fallback:', err.message);
  }

  // 3. Fallback: Firecrawl API if configured
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
        signal: AbortSignal.timeout(25000)
      });

      if (res.ok) {
        const data = await res.json();
        let md = data.data?.markdown || data.markdown;
        if (md && !isBlockedOrError(md)) {
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

  // 4. Fallback: Wayback Machine Archive
  try {
    const wbRes = await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(10000) });
    if (wbRes.ok) {
      const wbData = await wbRes.json();
      const snapshotUrl = wbData.archived_snapshots?.closest?.url;
      if (snapshotUrl) {
        const snapRes = await fetch(`https://r.jina.ai/${snapshotUrl}`, { signal: AbortSignal.timeout(15000) });
        if (snapRes.ok) {
          const snapContent = await snapRes.text();
          if (!isBlockedOrError(snapContent)) {
            return {
              source: 'wayback_archive',
              url,
              content: snapContent.slice(0, maxLength)
            };
          }
        }
      }
    }
  } catch (wbErr) {
    console.warn('[web_reader] Wayback archive error:', wbErr.message);
  }

  // 5. Try Smart News Search / Syndication Synthesis (Parallel) for hard paywalls
  if (process.env.PARALLEL_API_KEY) {
    try {
      const urlSlug = url.split('/').pop().replace(/[_\W]+/g, ' ').trim();
      const domain = new URL(url).hostname.replace(/^www\./, '');
      const searchQuery = `"${url}" OR ("${urlSlug}" ${domain} full article reporting)`;

      const searchRes = await fetch('https://api.parallel.ai/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.PARALLEL_API_KEY
        },
        body: JSON.stringify({
          objective: searchQuery,
          search_queries: [searchQuery],
          advanced_settings: {
            max_results: 5,
            excerpt_settings: { max_chars_per_result: 10000 }
          }
        })
      });

      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.results && data.results.length > 0) {
          const formattedResults = data.results.map((r, idx) => {
            const content = Array.isArray(r.excerpts) ? r.excerpts.join('\n\n') : '';
            return `### [${idx + 1}] ${r.title || 'Result'}\nSource: ${r.url || ''}\n\n${content}`;
          }).join('\n\n---\n\n');
          return {
            source: 'news_search_synthesis_parallel',
            url,
            content: `# Article & Reporting Context for: ${url}\n\n${formattedResults}`.slice(0, maxLength)
          };
        }
      }
    } catch (parallelErr) {
      console.warn('[web_reader] Parallel fallback error:', parallelErr.message);
    }
  }

  // 6. Try Smart News Search / Syndication Synthesis (Tavily) for hard paywalls
  if (process.env.TAVILY_API_KEY) {
    try {
      const { tavily } = await import('@tavily/core');
      const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
      
      // Extract keywords from URL path / slug
      const urlSlug = url.split('/').pop().replace(/[_\W]+/g, ' ').trim();
      const domain = new URL(url).hostname.replace(/^www\./, '');
      const searchQuery = `"${url}" OR ("${urlSlug}" ${domain} full article reporting)`;
      
      const searchRes = await tvly.search(searchQuery, { searchDepth: 'advanced', maxResults: 5 });
      if (searchRes.results && searchRes.results.length > 0) {
        const formattedResults = searchRes.results.map((r, idx) => `### [${idx + 1}] ${r.title}\nSource: ${r.url}\n\n${r.content}`).join('\n\n---\n\n');
        return {
          source: 'news_search_synthesis',
          url,
          content: `# Article & Reporting Context for: ${url}\n\n${formattedResults}`.slice(0, maxLength)
        };
      }
    } catch (tavilyErr) {
      console.warn('[web_reader] Tavily fallback error:', tavilyErr.message);
    }
  }

  // 6. Final Fallback: Direct fetch with basic HTML extraction
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      const html = await res.text();
      const clean = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (clean && !isBlockedOrError(clean)) {
        return {
          source: 'direct_fetch',
          url,
          content: clean.slice(0, maxLength)
        };
      }
    }
  } catch (err) {
    return { error: `Failed to read web page: ${err.message}` };
  }

  return { error: 'Unable to extract readable content from URL after trying Jina, Ego Browser, Archive, and News Search.' };
}
