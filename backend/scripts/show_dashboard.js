const fs = require('fs');
const path = require('path');
const readline = require('readline');

const LOG_FILE = path.join(__dirname, '../data/usage_analytics.jsonl');

async function showDashboard() {
    if (!fs.existsSync(LOG_FILE)) {
        console.log("No usage data found yet.");
        return;
    }

    const stats = {};
    let totalTokens = 0;

    const fileStream = fs.createReadStream(LOG_FILE);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line) continue;
        const entry = JSON.parse(line);
        const tokens = entry.tokens_in + entry.tokens_out;
        
        stats[entry.category] = (stats[entry.category] || 0) + tokens;
        totalTokens += tokens;
    }

    console.log("--- Usage Dashboard ---");
    for (const [category, tokens] of Object.entries(stats)) {
        console.log(`${category}: ${tokens} tokens`);
    }
    console.log("-----------------------");
    console.log(`Total Usage: ${totalTokens} tokens`);
}

showDashboard();
