import { EgoAdapter } from '../skills/utils/ego_adapter.js';

const COMMENT_VARIATIONS = [
  "Amazing! can you send me a pm :) ?",
  "Beautiful! can you please contact me",
  "Looks great! Could you send me a PM? :)",
  "Very nice! Can you send me a PM with details?",
  "Love this! Can you send me a PM please? :)",
  "Amazing place! Please send me a PM :)",
  "Looks wonderful! Can you message me the details? :)",
  "Great place! Could you send me a PM?"
];

function getRandomComment() {
  return COMMENT_VARIATIONS[Math.floor(Math.random() * COMMENT_VARIATIONS.length)];
}

async function run() {
  console.log("Starting Facebook feed rental outreach script...");
  
  const script = `
    const targetCount = 15;
    let commentedCount = 0;
    const commentedPostTexts = new Set();
    const commentVariations = ${JSON.stringify(COMMENT_VARIATIONS)};
    
    function getComment() {
      return commentVariations[Math.floor(Math.random() * commentVariations.length)];
    }

    const OFFERING_PATTERNS = [
      /\\b(?:for rent|to rent|available from|available now|room for rent|apartment for rent|flat for rent|studio for rent|house for rent|villa for rent)\\b/i,
      /\\b(?:renting out|sublet|subletting|monthly rent|weekly rent|price per month|€\\s*\\d+|\\$\\s*\\d+|£\\s*\\d+|per month|\\/month|bills included)\\b/i,
      /\\b(?:coliving|co-living|shared apartment|private room available|entire apartment|spacious room|fully furnished|balcony|wifi included)\\b/i,
      /\\b(?:our (?:apartment|house|villa|coliving|studio|place|home)|spots? left|rooms? left)\\b/i
    ];

    const SEEKING_PATTERNS = [
      /\\b(?:looking for|in search of|i'm searching|i am searching|seeking|iso|any recommendations|looking to rent|anyone know|need a room|need an apartment)\\b/i,
      /\\b(?:budget is|my budget|looking for a place|moving to|where to stay)\\b/i
    ];

    function isOfferingPost(text) {
      if (!text || text.length < 20) return false;
      const lower = text.toLowerCase();
      // If strongly seeking, skip
      let seekingScore = 0;
      for (const p of SEEKING_PATTERNS) {
        if (p.test(lower)) seekingScore += 2;
      }
      let offeringScore = 0;
      for (const p of OFFERING_PATTERNS) {
        if (p.test(lower)) offeringScore += 1;
      }
      if (seekingScore >= 2 && offeringScore < 2) return false;
      return offeringScore >= 1;
    }

    cliLog('Ensuring on Facebook feed...');
    if (!window.location.href.includes('facebook.com')) {
      window.location.href = 'https://www.facebook.com/';
      await new Promise(r => setTimeout(r, 4000));
    }

    let scrollAttempts = 0;
    const maxScrollAttempts = 80;

    while (commentedCount < targetCount && scrollAttempts < maxScrollAttempts) {
      scrollAttempts++;
      cliLog(\`--- Scan round \${scrollAttempts} | Commented so far: \${commentedCount}/\${targetCount} ---\`);

      // Find all post articles/containers
      const articles = Array.from(document.querySelectorAll('div[role="feed"] > div, div[role="article"], div[data-ad-preview="message"]'));
      cliLog(\`Found \${articles.length} potential feed items on page\`);

      for (let i = 0; i < articles.length; i++) {
        if (commentedCount >= targetCount) break;
        const el = articles[i];
        const text = el.innerText || '';
        if (text.length < 30) continue;

        // Create a signature to avoid duplicates
        const snippet = text.slice(0, 120).replace(/\\s+/g, ' ').trim();
        if (commentedPostTexts.has(snippet)) continue;

        if (isOfferingPost(text)) {
          cliLog(\`>>> Match candidate (\${commentedCount + 1}/\${targetCount}): "\${snippet.slice(0, 70)}..."\`);
          
          // Scroll item into view
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(r => setTimeout(r, 1500));

          // Look for comment box or comment button inside this post
          let commentBox = el.querySelector('div[role="textbox"][contenteditable="true"], div[aria-label*="comment" i][role="textbox"], div[aria-label*="commenta" i][role="textbox"], div[aria-label*="Scrivi un commento" i], div[aria-label*="Write a comment" i]');
          
          if (!commentBox) {
            // Click comment button if comment box not yet open
            const commentBtn = el.querySelector('div[aria-label*="Comment" i][role="button"], div[aria-label*="Commenta" i][role="button"], div[aria-label*="Lascia un commento" i]');
            if (commentBtn) {
              commentBtn.click();
              await new Promise(r => setTimeout(r, 1200));
              commentBox = el.querySelector('div[role="textbox"][contenteditable="true"], div[aria-label*="comment" i][role="textbox"], div[aria-label*="Scrivi un commento" i], div[aria-label*="Write a comment" i]');
            }
          }

          if (commentBox) {
            const commentToPost = getComment();
            cliLog(\`Posting comment: "\${commentToPost}"\`);
            
            commentBox.focus();
            await new Promise(r => setTimeout(r, 400));
            
            // Insert text using execCommand or input events
            document.execCommand('insertText', false, commentToPost);
            await new Promise(r => setTimeout(r, 800));

            // Press enter on the comment box
            const enterDown = new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
            commentBox.dispatchEvent(enterDown);
            const enterUp = new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true });
            commentBox.dispatchEvent(enterUp);

            await new Promise(r => setTimeout(r, 2500));

            commentedPostTexts.add(snippet);
            commentedCount++;
            cliLog(\`Successfully commented (\${commentedCount}/\${targetCount}) on post: "\${snippet.slice(0, 50)}..."\`);
          } else {
            cliLog('Could not locate active comment box for post, skipping.');
            commentedPostTexts.add(snippet);
          }
        }
      }

      // Scroll down to load more posts
      window.scrollBy({ top: 900, behavior: 'smooth' });
      await new Promise(r => setTimeout(r, 2500));
    }

    cliLog(\`Outreach finished. Total commented: \${commentedCount}/\${targetCount}\`);
    return { success: true, commentedCount, targetCount };
  `;

  const result = await EgoAdapter.runScript(script);
  console.log("Result:", result);
}

run().catch(console.error);
