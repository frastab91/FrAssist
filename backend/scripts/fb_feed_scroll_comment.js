import { EgoAdapter } from '../skills/utils/ego_adapter.js';

async function run() {
  console.log('🚀 Starting FB Feed Rental Commenter...');

  const script = `
const task = await useOrCreateTaskSpace('FB Feed Live Outreach');
try {
  await openOrReuseTab('https://www.facebook.com/', { wait: true, timeout: 25 });
  await wait(3.5);

  let commentedCount = 0;
  const target = 15;
  const commentedSignatures = new Set();
  const commentTemplates = [
    "Amazing! can you send me a pm :) ?",
    "Beautiful! can you please contact me :)",
    "Looks fantastic! Could you please send me a PM?",
    "Great place! Please send me a DM :)",
    "Beautiful space! Can you send me details in PM?",
    "Amazing! Can you PM me please? :)",
    "Wonderful! Please send me a private message with details :)",
    "Looks great! Can you send me a PM with more info? :)"
  ];

  for (let scrollIteration = 0; scrollIteration < 80; scrollIteration++) {
    if (commentedCount >= target) break;

    cliLog('=== Iteration ' + (scrollIteration + 1) + ' | Progress: ' + commentedCount + '/' + target + ' ===');

    // Expand "See more"
    await js(\`(() => {
      document.querySelectorAll('div[role="button"]').forEach(b => {
        const t = (b.innerText || '').trim().toLowerCase();
        if (t === 'see more' || t === 'altro' || t === 'ver más' || t === 'voir plus') {
          try { b.click(); } catch(e) {}
        }
      });
    })()\`);
    await wait(1);

    // Scan posts in feed
    const scanRes = await js(\`(() => {
      const feed = document.querySelector('div[role="feed"]') || document.querySelector('div[role="main"]');
      if (!feed) return { posts: [] };

      const isLookingFor = [
        'looking for', 'in search of', 'seeking', 'iso ', 'i need a', 'wanted:',
        'anyone know of', 'any recommendations', 'cerco', 'sto cercando', 'busco',
        'en recherche', 'je cherche', 'help me find', 'budget:', 'my budget',
        'anyone subletting', 'does anyone have', 'where to stay', 'recommend me'
      ];

      const offerKeywords = [
        'for rent', 'renting', 'available from', 'available now', 'available for',
        'apartment for', 'flat for', 'studio for', 'room available', 'villa for',
        'bedroom available', 'sublet available', 'subletting', 'house for rent',
        'affittasi', 'disponibile da', 'affitto', 'alquilo', 'se alquila',
        'en location', 'à louer', 'chambre disponible', 'piso disponible',
        'monthly rent', 'rent per month', 'utilities included', 'bills included',
        'fully furnished', 'spacious apartment', 'private room', 'coliving space',
        'our villa', 'our apartment', 'my apartment is available', 'short term rental',
        'mid term rental', 'long term rental', 'price per night', 'price per month',
        'dm for details', 'pm for price', 'message for details', 'host in', 'vacation rental',
        'sea view', 'terrace', 'balcony', 'fully equipped', 'per month', 'al mese', 'al mes',
        'wifi', 'swimming pool', 'garden', 'flatmates', 'flatmate', 'stanza', 'stanzetta',
        'monolocale', 'bilocale', 'trilocale', 'attico', 'mansarda', 'locazione'
      ];

      const articles = Array.from(feed.querySelectorAll('div[role="article"], div[data-pagelet^="FeedUnit"]'));
      const found = [];

      for (let i = 0; i < articles.length; i++) {
        const el = articles[i];
        const text = (el.innerText || '').trim();
        if (text.length < 25) continue;

        const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
        const author = lines[0] || 'Unknown';
        const sig = (author + ':::' + text.substring(0, 120)).replace(/\\s+/g, ' ');

        const lower = text.toLowerCase();
        const isLooking = isLookingFor.some(kw => lower.includes(kw));
        const hasOffer = offerKeywords.some(kw => lower.includes(kw));
        const hasAccommodation = /(apartment|flat|studio|room|villa|house|casa|stanz[ae]|bilocale|trilocale|piso|departamento|logement|chambre|coliving|property|condo|guest house)/i.test(lower);
        const hasRentalTerms = /(rent|affitt|alquil|louer|available|disponib|furnished|arredat|mobi|wifi|sqm|mq|€|\\$|£|month|mese|night|notte)/i.test(lower);

        const isMatch = !isLooking && (hasOffer || (hasAccommodation && hasRentalTerms));
        if (isMatch) {
          found.push({ index: i, author, sig, preview: text.substring(0, 100) });
        }
      }

      return { posts: found };
    })()\`);

    if (scanRes && scanRes.posts && scanRes.posts.length > 0) {
      for (const p of scanRes.posts) {
        if (commentedCount >= target) break;
        if (commentedSignatures.has(p.sig)) continue;

        commentedSignatures.add(p.sig);
        const commentMsg = commentTemplates[commentedCount % commentTemplates.length];
        cliLog('🎯 Found rental post by ' + p.author + ': "' + p.preview.replace(/\\n/g, ' ') + '"');

        // Scroll to post and open comment box
        await js(\`((idx) => {
          const feed = document.querySelector('div[role="feed"]') || document.querySelector('div[role="main"]');
          if (!feed) return;
          const articles = Array.from(feed.querySelectorAll('div[role="article"], div[data-pagelet^="FeedUnit"]'));
          const el = articles[idx];
          if (!el) return;

          el.scrollIntoView({ behavior: 'smooth', block: 'center' });

          let textbox = el.querySelector('div[role="textbox"][contenteditable="true"]') ||
                        el.querySelector('form div[role="textbox"]');

          if (!textbox) {
            const buttons = Array.from(el.querySelectorAll('div[role="button"], span, div'));
            const commentBtn = buttons.find(b => {
              const aria = (b.getAttribute('aria-label') || '').toLowerCase();
              const txt = (b.innerText || '').toLowerCase();
              return aria.includes('leave a comment') || aria.includes('comment') || aria.includes('commenta') ||
                     aria.includes('commenter') || aria.includes('comentar') ||
                     txt === 'comment' || txt === 'commenta' || txt === 'comentar' || txt === 'commenter';
            });
            if (commentBtn) {
              commentBtn.click();
            }
          }
        })(\` + p.index + \`)\`);

        await wait(2);

        // Type comment
        const typeRes = await js(\`((idx, msg) => {
          const feed = document.querySelector('div[role="feed"]') || document.querySelector('div[role="main"]');
          const articles = Array.from(feed.querySelectorAll('div[role="article"], div[data-pagelet^="FeedUnit"]'));
          const el = articles[idx] || document;

          let textbox = el.querySelector('div[role="textbox"][contenteditable="true"]') ||
                        el.querySelector('form div[role="textbox"]') ||
                        document.querySelector('div[role="textbox"][contenteditable="true"]');

          if (!textbox) return { success: false, reason: 'textbox not found' };

          textbox.focus();
          document.execCommand('insertText', false, msg);
          textbox.dispatchEvent(new Event('input', { bubbles: true }));
          textbox.dispatchEvent(new Event('change', { bubbles: true }));

          return { success: true };
        })(\` + p.index + \`, \` + JSON.stringify(commentMsg) + \`)\`);

        if (typeRes && typeRes.success) {
          await wait(1);
          await pressKey('Enter');
          await wait(3);

          commentedCount++;
          cliLog('✅ Commented (' + commentedCount + '/' + target + ') on ' + p.author + '\\'s post with: "' + commentMsg + '"');
          await wait(3.5);
        } else {
          cliLog('⚠️ Could not open textbox for post by ' + p.author);
        }
      }
    }

    // Scroll down for next batch
    await scroll(0, 1600);
    await wait(3.5);
  }

  cliLog('🎉 Finished! Total comments posted: ' + commentedCount);
  await screenshot('fb_feed_scroll_done.png');
} catch (e) {
  cliLog('ERROR: ' + e.message);
}
await completeTaskSpace(task.name, { keep: true });
`;

  const res = await EgoAdapter.runScript(script);
  console.log('Script execution finished:\n', res);
}

run();
