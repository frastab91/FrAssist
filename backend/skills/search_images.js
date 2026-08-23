export const declaration = {
  name: 'search_images',
  description: 'Search the web for real, authentic, high-quality photos, destination imagery, landmarks, and editorial photography online. NEVER use AI image generators for blog posts or articles; ALWAYS use search_images to find genuine photos.',
  parameters: {
    type: 'OBJECT',
    properties: {
      query: { 
        type: 'STRING', 
        description: 'Specific search query for real photos (e.g. "Tropea Calabria Santa Maria dell Isola", "Scalea centro storico", "Digital nomad laptop ocean terrace Italy", "Pollino national park hiking").' 
      },
      count: { 
        type: 'INTEGER', 
        description: 'Number of image results to return (default 5, max 15).' 
      },
      downloadLocal: {
        type: 'BOOLEAN',
        description: 'If true, downloads and caches the verified images locally into /screenshots/ and provides relative /screenshots/ URLs alongside original public URLs. Default is true.'
      }
    },
    required: ['query']
  }
};

import fs from 'fs';
import path from 'path';

/**
 * Search DuckDuckGo Image Search
 */
async function searchDdg(query, maxCount = 8) {
  try {
    const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!tokenRes.ok) return [];
    const html = await tokenRes.text();
    const vqdMatch = html.match(/vqd=([\"']?)([\d-]+)\1/i) || html.match(/vqd=([\d-]+)/i);
    if (!vqdMatch) return [];
    
    const vqd = vqdMatch[2] || vqdMatch[1];
    const imgRes = await fetch(`https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&f=,,,type:photo,&p=1`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(12000)
    });
    
    if (!imgRes.ok) return [];
    const data = await imgRes.json();
    return (data.results || []).slice(0, maxCount).map(r => ({
      title: r.title ? r.title.replace(/<[^>]*>/g, '').trim() : 'Web Photo',
      url: r.image,
      thumbnail: r.thumbnail,
      width: r.width,
      height: r.height,
      source: r.source || 'Web Search'
    }));
  } catch (err) {
    console.warn('[search_images] DDG search error:', err.message);
    return [];
  }
}

/**
 * Search Wikimedia Commons High-Res Media
 */
async function searchWikimedia(query, maxCount = 5) {
  try {
    const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query + ' filetype:bitmap')}&gsrnamespace=6&gsrlimit=${maxCount * 2}&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1200&format=json`;
    const res = await fetch(wikiUrl, {
      headers: { 'User-Agent': 'FrAssistBot/1.0 (travel assistant; contact@tra-montiemare.it)' },
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) return [];
    const data = await res.json();
    const pages = Object.values(data.query?.pages || {});
    const results = [];
    for (const p of pages) {
      const info = p.imageinfo?.[0];
      if (info && (info.mime?.startsWith('image/jpeg') || info.mime?.startsWith('image/png') || info.mime?.startsWith('image/webp'))) {
        const cleanTitle = p.title.replace(/^File:/i, '').replace(/\.(jpg|jpeg|png|webp)$/i, '').replace(/[_-]/g, ' ').trim();
        results.push({
          title: cleanTitle || 'Wikimedia Commons Photo',
          url: info.thumburl || info.url,
          originalUrl: info.url,
          width: info.thumbwidth || info.width,
          height: info.thumbheight || info.height,
          source: 'Wikimedia Commons'
        });
      }
      if (results.length >= maxCount) break;
    }
    return results;
  } catch (err) {
    console.warn('[search_images] Wikimedia search error:', err.message);
    return [];
  }
}

/**
 * Download and cache verified image locally
 */
async function downloadAndCacheImage(url, index = 0) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('image/')) return null;

    const ext = contentType.includes('png') ? 'png' : (contentType.includes('webp') ? 'webp' : 'jpg');
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length < 10000) return null; // Ignore tiny tracking pixels or empty icons

    const fileName = `web_img_${Date.now()}_${index}.${ext}`;
    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });
    
    const filePath = path.join(screenshotsDir, fileName);
    fs.writeFileSync(filePath, buffer);
    return `/screenshots/${fileName}`;
  } catch (err) {
    return null;
  }
}

export async function execute(args) {
  const query = (args.query || '').trim();
  const count = Math.min(Math.max(parseInt(args.count, 10) || 5, 1), 15);
  const shouldDownload = args.downloadLocal !== false;

  if (!query) {
    return { error: 'query parameter is required (e.g. "Tropea Calabria beach", "Scalea centro storico")' };
  }

  try {
    // 1. Gather results from primary online image search sources in parallel
    const [ddgResults, wikiResults] = await Promise.all([
      searchDdg(query, count * 2),
      searchWikimedia(query, count)
    ]);

    // Merge and deduplicate by URL
    const seenUrls = new Set();
    const rawImages = [];
    
    // Interleave sources for balanced variety
    const maxLen = Math.max(ddgResults.length, wikiResults.length);
    for (let i = 0; i < maxLen; i++) {
      if (ddgResults[i] && !seenUrls.has(ddgResults[i].url)) {
        seenUrls.add(ddgResults[i].url);
        rawImages.push(ddgResults[i]);
      }
      if (wikiResults[i] && !seenUrls.has(wikiResults[i].url)) {
        seenUrls.add(wikiResults[i].url);
        rawImages.push(wikiResults[i]);
      }
    }

    if (rawImages.length === 0) {
      return {
        query,
        count: 0,
        images: [],
        message: `No online photos found for "${query}". Try broadening your search terms.`
      };
    }

    const selectedImages = rawImages.slice(0, count);

    // 2. Download and verify images if requested
    const verifiedImages = [];
    for (let i = 0; i < selectedImages.length; i++) {
      const img = selectedImages[i];
      let localUrl = null;
      if (shouldDownload) {
        localUrl = await downloadAndCacheImage(img.url, i);
      }
      verifiedImages.push({
        title: img.title,
        url: img.url,
        localUrl: localUrl || img.url,
        width: img.width,
        height: img.height,
        source: img.source,
        htmlTag: `<img class="max-w-full h-auto rounded-lg" src="${localUrl || img.url}" alt="${img.title.replace(/"/g, '&quot;')}" />`
      });
    }

    return {
      query,
      count: verifiedImages.length,
      images: verifiedImages,
      recommendedMarkdown: verifiedImages.map(img => `![${img.title}](${img.localUrl || img.url})`).join('\n\n'),
      recommendedHtml: verifiedImages.map(img => img.htmlTag).join('\n\n')
    };
  } catch (error) {
    console.error('[search_images] Execution error:', error);
    return { error: `Failed to search images: ${error.message}` };
  }
}

export default {
  declaration,
  execute
};
