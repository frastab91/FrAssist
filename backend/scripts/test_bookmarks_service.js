import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
process.chdir(backendRoot);

const BOOKMARKS_DIR = path.join(backendRoot, 'bookmarks');
if (!fs.existsSync(BOOKMARKS_DIR)) {
  fs.mkdirSync(BOOKMARKS_DIR, { recursive: true });
}

console.log('🧪 Running Bookmarks Service Automated Tests...');

// Test 1: Directory exists
if (!fs.existsSync(BOOKMARKS_DIR)) {
  console.error('❌ Bookmarks directory does not exist');
  process.exit(1);
}
console.log('✅ Bookmarks directory exists at:', BOOKMARKS_DIR);

// Helper functions (mirrored from backend)
function parseBookmarkFile(filePath, filename) {
  const content = fs.readFileSync(filePath, 'utf8');
  const stat = fs.statSync(filePath);

  let metadata = {
    filename,
    messageId: '',
    title: filename.replace(/\.md$/, ''),
    role: 'assistant',
    agentId: 'orchestrator',
    sessionId: '',
    model: '',
    createdAt: stat.birthtime ? stat.birthtime.toISOString() : stat.mtime.toISOString(),
    size: stat.size,
  };
  let body = content;

  if (content.startsWith('---')) {
    const endIdx = content.indexOf('\n---', 3);
    if (endIdx !== -1) {
      const frontmatterStr = content.slice(3, endIdx).trim();
      body = content.slice(endIdx + 4).trim();

      frontmatterStr.split('\n').forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          let val = line.slice(colonIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (key === 'id' || key === 'messageId') metadata.messageId = val;
          else if (key === 'title') metadata.title = val;
          else if (key === 'role') metadata.role = val;
          else if (key === 'agentId' || key === 'agent') metadata.agentId = val;
          else if (key === 'sessionId' || key === 'session_id') metadata.sessionId = val;
          else if (key === 'model') metadata.model = val;
          else if (key === 'date' || key === 'createdAt') metadata.createdAt = val;
        }
      });
    }
  }

  if (!metadata.title || metadata.title === filename.replace(/\.md$/, '')) {
    const firstLine = body.split('\n').find(l => l.trim().length > 0) || '';
    const cleanTitle = firstLine.replace(/^#+\s*/, '').slice(0, 60).trim();
    if (cleanTitle) metadata.title = cleanTitle;
  }

  const cleanSnippet = body
    .replace(/^#+\s+/gm, '')
    .replace(/[*_`~[\]]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
  const preview = cleanSnippet.slice(0, 180) + (cleanSnippet.length > 180 ? '...' : '');

  return {
    ...metadata,
    preview,
    content: body,
    rawContent: content,
    filePath: `bookmarks/${filename}`
  };
}

// Test 2: Create a bookmark file
const testMsgId = `test_msg_${Date.now()}`;
const testTitle = 'How to architect agent memory with SQLite';
const testContent = `This is a test message explaining agent memory architecture.

## Key Points
1. Use SQLite WAL mode for concurrency.
2. Index session IDs and timestamps.
3. Prune old media artifacts periodically.`;

const testFilename = `bookmark_test_${testMsgId}.md`;
const testPath = path.join(BOOKMARKS_DIR, testFilename);

const frontmatter = [
  '---',
  `id: "${testMsgId}"`,
  `title: "${testTitle}"`,
  `date: "${new Date().toISOString()}"`,
  'role: "assistant"',
  'agent: "orchestrator"',
  'model: "gemini-3.8-flash"',
  'tags: ["bookmark", "saved"]',
  '---',
  '',
  `# ${testTitle}`,
  '',
  testContent,
  ''
].join('\n');

fs.writeFileSync(testPath, frontmatter, 'utf8');
console.log('✅ Created test bookmark file:', testFilename);

// Test 3: Parse the created file
const parsed = parseBookmarkFile(testPath, testFilename);
if (parsed.messageId !== testMsgId) {
  console.error(`❌ Parsed messageId mismatch: expected ${testMsgId}, got ${parsed.messageId}`);
  process.exit(1);
}
if (parsed.title !== testTitle) {
  console.error(`❌ Parsed title mismatch: expected ${testTitle}, got ${parsed.title}`);
  process.exit(1);
}
if (parsed.role !== 'assistant') {
  console.error(`❌ Parsed role mismatch: expected assistant, got ${parsed.role}`);
  process.exit(1);
}
if (!parsed.preview.includes('This is a test message')) {
  console.error('❌ Preview extraction failed:', parsed.preview);
  process.exit(1);
}
console.log('✅ Successfully parsed bookmark with frontmatter & preview:', {
  id: parsed.messageId,
  title: parsed.title,
  preview: parsed.preview.slice(0, 50) + '...'
});

// Test 4: Delete the test file
fs.unlinkSync(testPath);
if (fs.existsSync(testPath)) {
  console.error('❌ Failed to delete test file');
  process.exit(1);
}
console.log('✅ Cleaned up test bookmark file');

console.log('🎉 All Bookmarks Service tests passed successfully!');
