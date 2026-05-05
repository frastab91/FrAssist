const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../data/usage_analytics.jsonl');

function logSession(category, topic, tokensIn, tokensOut) {
    const entry = {
        timestamp: new Date().toISOString(),
        category,
        topic,
        tokens_in: tokensIn,
        tokens_out: tokensOut
    };
    
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

module.exports = { logSession };
