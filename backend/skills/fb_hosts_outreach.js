import { EgoAdapter } from './utils/ego_adapter.js';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

let dbInstance = null;

async function getDb() {
  if (!dbInstance) {
    dbInstance = await open({
      filename: path.join(process.cwd(), 'database.sqlite'),
      driver: sqlite3.Database
    });
    await dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS facebook_outreach_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_url TEXT,
        post_id TEXT,
        post_url TEXT,
        author TEXT,
        post_snippet TEXT,
        comment_text TEXT,
        status TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_fb_post_url ON facebook_outreach_log(post_url);
      CREATE INDEX IF NOT EXISTS idx_fb_post_id ON facebook_outreach_log(post_id);
    `);
  }
  return dbInstance;
}

export const declaration = {
  name: 'fb_hosts_outreach',
  description: 'Automates prospecting on Facebook Group for host outreach (promoting https://host.frastab.com/). Navigates to the Digital Nomad accommodation group, SORTS THE FEED BY NEWEST FIRST, scans for posts OFFERING accommodation/houses/rooms/coliving, posts "dm plese! :)" on relevant offering posts with duplicate prevention, and VERIFIES each comment actually appears on the account before recording it as success. Will scan enough posts to reach a target number of verified comments, up to a configurable maximum scan limit.',
  parameters: {
    type: 'OBJECT',
    properties: {
      maxPosts: { type: 'NUMBER', description: 'Target minimum number of offering posts to comment on (default: 5, enforced minimum: 5).' },
      commentText: { type: 'STRING', description: 'Comment text to post (default: "dm plese! :)").' },
      dryRun: { type: 'BOOLEAN', description: 'If true, scans and classifies posts without actually submitting comments.' },
      targetUrl: { type: 'STRING', description: 'Facebook group URL (default: "https://www.facebook.com/groups/325849768974770").' },
      maxScan: { type: 'NUMBER', description: 'Maximum number of posts to scan before giving up (default: 50).' }
    }
  }
};

/**
 * Heuristic classifier to determine if a Facebook group post is OFFERING accommodation vs SEEKING
 */
export function classifyPost(text) {
  if (!text || typeof text !== 'string') return { isOffering: false, reason: 'Empty text' };
  const lower = text.toLowerCase();

  // Strong Seeking phrases (someone looking for a place to stay)
  const seekingPatterns = [
    /\blooking for (a |an |to rent|accommodation|apartment|room|place|flat|house|coliving|studio)\b/i,
    /\bin search of\b/i,
    /\bsearching for\b/i,
    /\bseeking (a |an |accommodation|apartment|room|place|flat|house)\b/i,
    /\banyone have (a |an |any )?(room|place|apartment|house|recommendation)/i,
    /\banyone know (of )?(a |an |any )?(room|place|apartment|house|coliving)/i,
    /\bneed a place\b/i,
    /\bneed accommodation\b/i,
    /\bwe need (a |an )?(place|apartment|room)/i,
    /\bi need (a |an )?(place|apartment|room)/i,
    /\biso (a |an )?(room|place|apartment|house)/i,
    /\bwhere can (i|we) (stay|find)\b/i
  ];

  // Strong Offering phrases (hosts renting out / sharing places)
  const offeringPatterns = [
    /\b(apartment|room|studio|house|villa|flat|place|coliving|co-living) (is )?available\b/i,
    /\bavailable (from|now|for|in|between|until|starting)\b/i,
    /\bfor rent\b/i,
    /\bto rent\b/i,
    /\brenting out\b/i,
    /\bwe have (a |an |some )?(room|rooms|apartment|spot|spots|place|villa|studio)/i,
    /\bwe offer\b/i,
    /\bour (apartment|house|villa|coliving|co-living|studio|place|home)\b/i,
    /\b(spot|spots|room|rooms) left\b/i,
    /\bcancelation|cancellation\b/i,
    /\bsublet|subletting\b/i,
    /\b(€|\$|£|\bchf\b|\beur\b|\busd\b)\s*\d+/i,
    /\b\d+\s*(€|\$|£|\beur\b|\busd\b)\s*(\/|\s*per\s*)(month|night|week|mo)/i,
    /\bper month|per night|per week|monthly rate|daily rate\b/i,
    /\bpm for (info|details|more|price)\b/i,
    /\bdm for (info|details|more|price)\b/i,
    /\blooking for (guests|tenants|nomads|flatmates|roommates|people to join)\b/i,
    /\bconscious co-living|coliving space|coliving house\b/i,
    /\bperfect for digital nomads\b/i,
    /\bfully equipped|fully furnished|high-speed wifi|high speed internet\b/i
  ];

  const hasSeeking = seekingPatterns.some(p => p.test(lower));
  const hasOffering = offeringPatterns.some(p => p.test(lower));

  // If it matches seeking for tenants/guests, it is an offering
  if (/looking for (guests|tenants|nomads|flatmates|roommates|someone to take|people to join)/i.test(lower)) {
    return { isOffering: true, reason: 'Matched host looking for guests/tenants' };
  }

  if (hasSeeking && !hasOffering) {
    return { isOffering: false, reason: 'Identified as SEEKING / LOOKING for accommodation' };
  }

  if (hasOffering) {
    return { isOffering: true, reason: 'Identified as OFFERING accommodation / listing' };
  }

  // General heuristic check
  if (/\b(available|rent|bedroom|apartment|coliving|studio)\b/i.test(lower) && !hasSeeking) {
    return { isOffering: true, reason: 'Keywords indicate likely offering' };
  }

  return { isOffering: false, reason: 'No clear offering signals found' };
}

export async function execute(args = {}, logCallback = null) {
  // Enforce minimum target of 5 verified comments per run
  let targetPosts = Number(args.maxPosts) || 5;
  if (targetPosts < 5) {
    targetPosts = 5;
  }
  const maxScan = Number(args.maxScan) || 50;
  const commentText = args.commentText || 'dm plese! :)';
  const dryRun = !!args.dryRun;
  const targetUrl = args.targetUrl || 'https://www.facebook.com/groups/325849768974770';

  const log = (msg) => {
    console.log(`[FB-Hosts-Outreach] ${msg}`);
    if (typeof logCallback === 'function') {
      logCallback(msg);
    }
  };

  log(`🚀 Initializing Facebook Hosts Outreach task...`);
  log(`🎯 Target Group: ${targetUrl}`);
  log(`💬 Comment to post: "${commentText}"`);
  log(`⚙️ Minimum comments target: ${targetPosts} | Max posts to scan: ${maxScan} | Mode: ${dryRun ? 'DRY-RUN (Simulate)' : 'LIVE EXECUTION'}`);

  const db = await getDb();

  // Load already commented URLs from SQLite
  const existingRows = await db.all(`SELECT post_url, post_id FROM facebook_outreach_log WHERE status = 'commented'`);
  const commentedSet = new Set();
  existingRows.forEach(r => {
    if (r.post_url) commentedSet.add(r.post_url);
    if (r.post_id) commentedSet.add(r.post_id);
  });

  log(`📊 Loaded ${commentedSet.size} previously commented post records from database.`);

  // Phase 1: Open group, sort by newest, and collect enough posts
  const collectScript = `
const targetUrl = ${JSON.stringify(targetUrl)};
const maxScan = ${maxScan};

const task = await useOrCreateTaskSpace('FB Hosts Outreach - Collect');
cliLog('TASK_START');

try {
  await openOrReuseTab(targetUrl, { wait: true, timeout: 25 });
  await wait(3.5);

  // ===== STEP 1: SORT GROUP FEED BY NEWEST =====
  const sortRes = await js(String.raw\`(() => {
    const candidates = Array.from(document.querySelectorAll('div[role="button"], button, div[aria-haspopup="menu"]'));
    let sortBtn = null;
    for (const c of candidates) {
      const aria = (c.getAttribute('aria-label') || '').toLowerCase();
      const txt = (c.innerText || '').toLowerCase();
      if (aria.includes('sort') || aria.includes('ordina') || aria.includes('ordenar') || txt.includes('sort group feed') || txt.includes('ordina') || txt.includes('recent')) {
        sortBtn = c;
        break;
      }
    }
    if (!sortBtn) return { error: 'Sort button not found' };
    sortBtn.click();
    return { success: true, label: sortBtn.getAttribute('aria-label') || sortBtn.innerText };
  })()\`);
  cliLog('SORT_CLICK:' + JSON.stringify(sortRes));
  await wait(2);

  // Select "Newest" option
  const newestRes = await js(String.raw\`(() => {
    const items = Array.from(document.querySelectorAll('div[role="menuitem"], div[role="option"], div[role="menuitemradio"], span[dir="auto"]'));
    for (const it of items) {
      const t = (it.innerText || '').trim().toLowerCase();
      if (t === 'newest' || t === 'più recenti' || t === 'más recientes' || t === 'recent' || t === 'newest posts') {
        it.click();
        return { success: true, selected: it.innerText.trim() };
      }
    }
    return { error: 'Newest option not found in menu' };
  })()\`);
  cliLog('SORT_SELECT:' + JSON.stringify(newestRes));
  await wait(3);

  // Collect posts with repeated expansion + scrolling until we have enough candidates
  let allPosts = [];
  let scrollAttempt = 0;
  const maxScrollAttempts = 10;

  while (allPosts.length < maxScan && scrollAttempt < maxScrollAttempts) {
    scrollAttempt++;

    // Expand all "See more" buttons
    await js(String.raw\`(() => {
      document.querySelectorAll('div[role="button"]').forEach(b => {
        const t = (b.innerText || '').trim().toLowerCase();
        if (t === 'see more' || t === 'altro' || t === 'ver más' || t === 'voir plus') {
          try { b.click(); } catch(e) {}
        }
      });
    })()\`);
    await wait(1.5);

    // Extract posts currently in the DOM
    const batch = await js(String.raw\`(() => {
      const feed = document.querySelector('div[role="feed"]');
      if (!feed) return [];

      const children = Array.from(feed.children);
      const posts = [];

      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const childText = (child.innerText || '').trim();
        if (childText.length < 30 || childText.includes('sort group feed by')) continue;

        // Extract message texts
        const msgEls = child.querySelectorAll('div[data-ad-preview="message"], div[dir="auto"]');
        const textPieces = [];
        msgEls.forEach(el => {
          const t = (el.innerText || '').trim();
          if (t.length > 20 && !textPieces.includes(t)) {
            textPieces.push(t);
          }
        });
        const combinedText = textPieces.join('\\\\n\\\\n') || childText.slice(0, 800);

        // Extract permalink or post identifier
        const linkEl = child.querySelector('a[href*="/posts/"], a[href*="permalink"]');
        const permalink = linkEl ? linkEl.href : null;
        let postId = null;
        if (permalink) {
          const m = permalink.match(/posts\\/(\\d+)/) || permalink.match(/permalink\\/(\\d+)/);
          if (m) postId = m[1];
        }

        // Author extraction
        let author = 'Host';
        const actionBtn = child.querySelector('div[aria-label*="Actions for this post by" i], button[aria-label*="Actions for this post by" i]');
        if (actionBtn) {
          const aria = actionBtn.getAttribute('aria-label') || '';
          const match = aria.match(/Actions for this post by (.+)/i);
          if (match) author = match[1].trim();
        }
        if (author === 'Host') {
          const authorEl = child.querySelector('h2 a, h3 a, h4 a, strong a, a[role="link"]');
          if (authorEl && (authorEl.innerText || '').trim().length > 1) {
            author = authorEl.innerText.trim();
          }
        }

        const hasMyComment = childText.toLowerCase().includes('dm plese! :)') || childText.toLowerCase().includes('dm please');

        posts.push({
          domIndex: i,
          postId: postId || 'post_' + i + '_' + Date.now(),
          permalink: permalink || (window.location.href.split('?')[0] + '#post_' + i),
          author,
          text: combinedText,
          hasMyComment
        });
      }
      return posts;
    })()\`);

    // Deduplicate by permalink within the batch and append new ones
    for (const p of batch) {
      if (!allPosts.some(existing => existing.permalink === p.permalink && existing.domIndex === p.domIndex)) {
        allPosts.push(p);
      }
    }

    cliLog('SCROLL_BATCH:' + JSON.stringify({ scrollAttempt, collectedSoFar: allPosts.length }));

    // Scroll further if we need more
    if (allPosts.length < maxScan && scrollAttempt < maxScrollAttempts) {
      await scrollBy(1500);
      await wait(2.5);
    }
  }

  cliLog('FOUND_POSTS_RAW:' + JSON.stringify(allPosts));
} catch (err) {
  cliLog('ERROR:' + err.message);
}

await completeTaskSpace(task.name, { keep: false });
`;

  log(`🌐 Inspecting group feed via Ego Browser (sorted by NEWEST, scanning up to ${maxScan} posts)...`);
  const rawOutput = await EgoAdapter.runScript(collectScript);

  const postsMatch = rawOutput.match(/FOUND_POSTS_RAW:(.+)/);
  if (!postsMatch) {
    log(`⚠️ Could not parse raw posts output. Raw response:\n${rawOutput.slice(0, 500)}`);
    return {
      status: 'warning',
      message: 'No posts extracted or session could not access feed.',
      rawOutput: rawOutput.slice(0, 500)
    };
  }

  let posts = [];
  try {
    posts = JSON.parse(postsMatch[1]);
  } catch (e) {
    log(`❌ Failed to parse posts JSON: ${e.message}`);
    return { status: 'error', error: e.message };
  }

  log(`🔎 Extracted ${posts.length} posts from group feed (newest first). Starting intelligent classification...`);

  const results = {
    totalScanned: posts.length,
    offeringsFound: 0,
    commented: [],
    skippedAlreadyCommented: [],
    skippedNotOffering: []
  };

  const toCommentQueue = [];

  for (const post of posts) {
    const classification = classifyPost(post.text);
    const postSnippet = post.text.replace(/\s+/g, ' ').slice(0, 160);

    if (!classification.isOffering) {
      results.skippedNotOffering.push({
        author: post.author,
        permalink: post.permalink,
        reason: classification.reason,
        snippet: postSnippet
      });
      continue;
    }

    results.offeringsFound++;

    const isDup = commentedSet.has(post.permalink) || (post.postId && commentedSet.has(post.postId)) || post.hasMyComment;
    if (isDup) {
      log(`⏭️ Skipping duplicate post by ${post.author} (already commented): "${postSnippet}..."`);
      results.skippedAlreadyCommented.push({
        author: post.author,
        permalink: post.permalink,
        snippet: postSnippet
      });
      continue;
    }

    toCommentQueue.push({
      ...post,
      snippet: postSnippet,
      reason: classification.reason
    });

    if (toCommentQueue.length >= targetPosts) {
      break;
    }
  }

  const verifiedCount = results.commented.filter(c => c.status === 'commented').length;
  log(`✅ Classification complete: Found ${results.offeringsFound} offering posts. ${toCommentQueue.length} queued for comment (target was ${targetPosts}).`);

  // If we didn't reach target, report it but still proceed with whatever we found
  if (toCommentQueue.length < targetPosts) {
    log(`⚠️ Only ${toCommentQueue.length} fresh offering posts found (target: ${targetPosts}). Will comment on all available ones.`);
  }

  // Phase 2: Execute comments one by one
  for (let i = 0; i < toCommentQueue.length; i++) {
    const item = toCommentQueue[i];
    log(`💬 [${i + 1}/${toCommentQueue.length}] Processing offering post by ${item.author} (${item.permalink})...`);
    log(`📝 Post snippet: "${item.snippet}..."`);

    if (dryRun) {
      log(`🔎 [DRY-RUN] Simulated comment '${commentText}' on post ${item.permalink}`);
      results.commented.push({
        author: item.author,
        permalink: item.permalink,
        snippet: item.snippet,
        status: 'simulated'
      });
      continue;
    }

    const commentScript = `
const targetUrl = ${JSON.stringify(targetUrl)};
const postIndex = ${item.domIndex};
const commentText = ${JSON.stringify(commentText)};

const task = await useOrCreateTaskSpace('FB Hosts Outreach Comment');
try {
  await openOrReuseTab(targetUrl, { wait: true, timeout: 20 });
  await wait(2);

  const setupRes = await js(String.raw\`(() => {
    const feed = document.querySelector('div[role="feed"]');
    if (!feed) return { error: 'Feed not found' };
    const postDiv = feed.children[\\${postIndex}];
    if (!postDiv) return { error: 'Post div not found' };

    let textbox = postDiv.querySelector('div[role="textbox"]');
    if (!textbox) {
      const commentBtn = postDiv.querySelector('div[aria-label="Leave a comment"], div[aria-label="Commenta"], div[aria-label*="Comment" i]');
      if (commentBtn) {
        commentBtn.click();
      }
      textbox = postDiv.querySelector('div[role="textbox"]');
    }

    if (textbox) {
      textbox.focus();
      return { success: true, aria: textbox.getAttribute('aria-label') };
    }
    return { error: 'Textbox not found' };
  })()\`);

  cliLog('SETUP_RESULT:' + JSON.stringify(setupRes));
  await wait(1);

  // Type comment text
  await typeText(commentText);
  await wait(1);

  // Submit comment with Enter key
  await pressKey('Enter');
  await wait(3);

  // Re-read the post to verify our comment appears
  const verifyRes = await js(String.raw\`(() => {
    const feed = document.querySelector('div[role="feed"]');
    if (!feed) return { error: 'Feed not found' };
    const postDiv = feed.children[\\${postIndex}];
    if (!postDiv) return { error: 'Post div not found' };

    const postText = (postDiv.innerText || '').toLowerCase();
    const needle = \\${JSON.stringify(commentText.toLowerCase())};
    const found = postText.includes(needle);
    return { found, postTextSnippet: postText.slice(0, 300) };
  })()\`);

  cliLog('VERIFY_RESULT:' + JSON.stringify(verifyRes));

  if (verifyRes && verifyRes.found) {
    cliLog('COMMENT_POSTED_SUCCESS');
  } else {
    cliLog('COMMENT_VERIFY_FAILED:' + JSON.stringify(verifyRes));
  }
} catch (e) {
  cliLog('COMMENT_ERROR:' + e.message);
}

await completeTaskSpace(task.name, { keep: false });
`;

    try {
      const commentOutput = await EgoAdapter.runScript(commentScript);
      const isSuccess = commentOutput.includes('COMMENT_POSTED_SUCCESS');
      const verifyFailed = commentOutput.includes('COMMENT_VERIFY_FAILED');

      if (isSuccess) {
        log(`🎉 Successfully commented "${commentText}" on post by ${item.author} (VERIFIED in DOM)!`);
        await db.run(
          `INSERT INTO facebook_outreach_log (group_url, post_id, post_url, author, post_snippet, comment_text, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [targetUrl, item.postId, item.permalink, item.author, item.snippet, commentText, 'commented']
        );
        commentedSet.add(item.permalink);
        if (item.postId) commentedSet.add(item.postId);

        results.commented.push({
          author: item.author,
          permalink: item.permalink,
          snippet: item.snippet,
          status: 'commented'
        });
      } else if (verifyFailed) {
        log(`⚠️ Comment was submitted but NOT verified in DOM for post by ${item.author}. Not recording as success.`);
        results.commented.push({
          author: item.author,
          permalink: item.permalink,
          snippet: item.snippet,
          status: 'unverified'
        });
      } else {
        log(`⚠️ Comment execution finished with response: ${commentOutput.slice(0, 200)}`);
        results.commented.push({
          author: item.author,
          permalink: item.permalink,
          snippet: item.snippet,
          status: 'attempted'
        });
      }
    } catch (commentErr) {
      log(`❌ Error commenting on post: ${commentErr.message}`);
    }

    if (i < toCommentQueue.length - 1) {
      log(`⏳ Waiting 3.5s before next post to ensure safe posting cadence...`);
      await new Promise(r => setTimeout(r, 3500));
    }
  }

  const finalVerified = results.commented.filter(c => c.status === 'commented').length;
  log(`🏁 Facebook Hosts Outreach finished: ${finalVerified}/${targetPosts} verified comments placed.`);

  return {
    status: 'success',
    results,
    target: targetPosts,
    verifiedCount: finalVerified,
    summary: `### 🎯 Facebook Hosts Outreach Completed\n\n- **Target Group**: [Digital Nomad Accommodation & Co-housing](${targetUrl})\n- **Service Promoted**: [Host Landing Page](https://host.frastab.com/)\n- **Feed Sorted By**: Newest\n- **Posts Scanned**: ${results.totalScanned}\n- **House Offerings Identified**: ${results.offeringsFound}\n- **Target Verified Comments**: ${targetPosts}\n- **Comments Posted (Verified)**: ${finalVerified} (message: \`${commentText}\`)\n- **Comments Unverified**: ${results.commented.filter(c => c.status === 'unverified').length}\n- **Duplicate Posts Skipped**: ${results.skippedAlreadyCommented.length}\n- **Seeking/Non-Offering Posts Skipped**: ${results.skippedNotOffering.length}\n\n${results.commented.length > 0 ? '#### 📬 Commented Posts:\n' + results.commented.map((c, idx) => `${idx + 1}. **${c.author}**: [View Post](${c.permalink})\n   > *"${c.snippet}"* (status: ${c.status})`).join('\n') : '_No new offering posts required comments in this run._'}\n\n${finalVerified < targetPosts ? `⚠️ **Shortfall:** Only ${finalVerified} verified comments were achieved against the target of ${targetPosts}. This usually means there were not enough fresh offering posts available in the feed.` : ''}`
  };
}

export default {
  declaration,
  execute,
  classifyPost
};
