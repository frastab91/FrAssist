/**
 * On-Demand Knowledge Retrieval Skill (get_project_knowledge)
 * Allows any agent (Orchestrator, Vacation Rental Manager, Researcher, Developer, etc.)
 * to fetch specific modular knowledge documents or inspect the knowledge catalog on demand.
 */

import fs from 'fs';
import path from 'path';

export const declaration = {
  name: 'get_project_knowledge',
  description: 'Retrieve specific knowledge files or view the knowledge catalog for the active project. Use this on demand when you need deep details such as check-in codes, arrival video links, canonical local restaurant recommendations, marketing strategies, or database schemas.',
  parameters: {
    type: 'OBJECT',
    properties: {
      topic: {
        type: 'STRING',
        description: 'The topic to load (e.g., "access_and_checkin", "local_guide", "properties", "reviews_and_faqs", "editorial_plan", "growth_strategy", "execution_plan", "database_schema", "overview", "user_profile").'
      },
      project: {
        type: 'STRING',
        description: 'Optional project identifier (e.g., "tra-montiemare", "rally-nyc", "overnight", "general"). If omitted, uses active project or searches all.'
      },
      file: {
        type: 'STRING',
        description: 'Optional direct relative file path within the knowledge/ directory (e.g., "tra-montiemare/access_and_checkin.md").'
      },
      action: {
        type: 'STRING',
        enum: ['read', 'catalog'],
        description: 'Action to perform. Use "catalog" to see all available knowledge files and topics, or "read" to retrieve content.'
      }
    }
  }
};

function scanKnowledgeCatalog(baseDir) {
  const catalog = [];
  if (!fs.existsSync(baseDir)) return catalog;

  function walk(currentDir, relativePrefix = '') {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.join(relativePrefix, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const topic = path.basename(entry.name, '.md');
        const content = fs.readFileSync(fullPath, 'utf8');
        const firstHeader = (content.match(/^#\s+(.+)$/m) || [])[1] || topic;
        const project = relativePrefix ? relativePrefix.split(path.sep)[0] : 'root';
        catalog.push({
          topic,
          project,
          relativePath: relPath,
          title: firstHeader,
          fullPath
        });
      }
    }
  }

  walk(baseDir);
  return catalog;
}

export async function execute(args = {}) {
  const { topic, project, file, action = 'read' } = args;
  const candidates = [
    path.join(process.cwd(), 'knowledge'),
    path.join(process.cwd(), 'backend', 'knowledge'),
    path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'knowledge')
  ];
  const knowledgeDir = candidates.find(p => fs.existsSync(p)) || candidates[0];
  const catalog = scanKnowledgeCatalog(knowledgeDir);

  if (action === 'catalog' || (!topic && !file)) {
    return {
      status: 'success',
      totalDocuments: catalog.length,
      catalog: catalog.map(c => ({
        project: c.project,
        topic: c.topic,
        title: c.title,
        file: c.relativePath
      }))
    };
  }

  // Direct file lookup
  if (file) {
    const directPath = path.isAbsolute(file) ? file : path.join(knowledgeDir, file);
    if (fs.existsSync(directPath)) {
      return {
        status: 'success',
        source: file,
        content: fs.readFileSync(directPath, 'utf8')
      };
    }
  }

  // Topic lookup with optional project filtering
  const targetTopic = (topic || '').trim().toLowerCase().replace(/\.md$/, '');
  const targetProj = (project || '').trim().toLowerCase().replace(/[-_]/g, '');

  let matches = catalog.filter(c => {
    const cTopic = c.topic.toLowerCase();
    const topicMatch = cTopic === targetTopic || cTopic.includes(targetTopic) || targetTopic.includes(cTopic);
    if (!topicMatch) return false;

    if (targetProj) {
      const cProj = c.project.toLowerCase().replace(/[-_]/g, '');
      return cProj.includes(targetProj) || targetProj.includes(cProj);
    }
    return true;
  });

  if (matches.length === 0) {
    // Broad fallback match across titles
    matches = catalog.filter(c => c.title.toLowerCase().includes(targetTopic));
  }

  if (matches.length === 0) {
    return {
      status: 'not_found',
      message: `No knowledge document found matching topic "${topic}"${project ? ` in project "${project}"` : ''}.`,
      availableTopics: catalog.map(c => `${c.project}/${c.topic}`)
    };
  }

  const selected = matches[0];
  return {
    status: 'success',
    topic: selected.topic,
    project: selected.project,
    title: selected.title,
    file: selected.relativePath,
    content: fs.readFileSync(selected.fullPath, 'utf8')
  };
}
