#!/usr/bin/env node

import path from 'path';
import { fileURLToPath } from 'url';
import { execute } from '../skills/fb_hosts_outreach.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure ~/.local/bin is in PATH for ego-browser
if (!process.env.PATH.includes('/.local/bin')) {
  process.env.PATH = `${process.env.HOME}/.local/bin:${process.env.PATH}`;
}

const args = process.argv.slice(2);
let dryRun = false;
let maxPosts = 5;
let commentText = 'dm plese! :)';
let targetUrl = 'https://www.facebook.com/groups/325849768974770';

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--dry-run' || arg === '-d') {
    dryRun = true;
  } else if (arg === '--max' || arg === '-m') {
    maxPosts = parseInt(args[++i], 10) || 5;
  } else if (arg === '--comment' || arg === '-c') {
    commentText = args[++i] || commentText;
  } else if (arg === '--url' || arg === '-u') {
    targetUrl = args[++i] || targetUrl;
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
Usage: node run_fb_hosts.js [options]

Options:
  --dry-run, -d      Simulate scanning and filtering without posting comments
  --max, -m <n>      Max number of offering posts to comment on (default: 5)
  --comment, -c <t>  Custom comment text (default: 'dm plese! :)')
  --url, -u <url>    Facebook group URL
  --help, -h         Show this help message
    `);
    process.exit(0);
  }
}

console.log('='.repeat(65));
console.log('  🏡 FrAssist FB Hosts Automated Outreach');
console.log('  Promoting: https://host.frastab.com/');
console.log('='.repeat(65));

(async () => {
  try {
    const res = await execute({
      maxPosts,
      dryRun,
      targetUrl,
      commentText
    }, (msg) => {
      console.log(`[LOG] ${msg}`);
    });

    console.log('\n' + '='.repeat(65));
    console.log(res.summary);
    console.log('='.repeat(65));
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Error running outreach: ${err.message}`);
    process.exit(1);
  }
})();
