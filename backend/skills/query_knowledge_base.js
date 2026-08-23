/**
 * Knowledge Base RAG Skill (tramontiemare_guest_faq)
 * Allows any FrAssist agent (Orchestrator, Researcher, etc.) to query the ChromaDB vector database
 * built with text-embedding-004 to find factual property details, guest history, booking policies, and FAQs.
 */

import { searchKnowledgeBase } from '../services/rag.js';

export const declaration = {
  name: 'query_knowledge_base',
  description: 'Search the Tra-Montiemare vacation rentals knowledge base and past guest conversation history (ChromaDB vector store) using semantic search. Use this whenever you need to find property policies, check-in details, past guest interactions, amenities, prices, or apartment info.',
  parameters: {
    type: 'OBJECT',
    properties: {
      query: {
        type: 'STRING',
        description: 'Natural language question or search query (e.g., "What are the check-in instructions?", "Is there parking available?", "What was the feedback on WiFi?").'
      },
      apartment: {
        type: 'STRING',
        description: 'Optional filter by apartment name (e.g. "Top Floor", "Piano 1", "Attico", "general").'
      },
      topic: {
        type: 'STRING',
        description: 'Optional topic filter (e.g. "check-in", "pricing", "feedback", "amenities").'
      },
      top_k: {
        type: 'INTEGER',
        description: 'Number of top relevant knowledge excerpts to return (default: 4, max: 10).'
      }
    },
    required: ['query']
  }
};

export async function execute(args = {}) {
  const { query, apartment, topic, top_k = 4 } = args;

  if (!query || !query.trim()) {
    throw new Error('Parameter "query" is required to search the knowledge base.');
  }

  const limit = Math.min(Math.max(parseInt(top_k, 10) || 4, 1), 10);
  const filters = {};
  if (apartment) filters.apartment = apartment;
  if (topic) filters.topic = topic;

  const results = await searchKnowledgeBase(query.trim(), limit, filters);

  return {
    query,
    collection: 'tramontiemare_guest_faq',
    totalFound: results.length,
    results: results.map((r, index) => ({
      rank: index + 1,
      similarityScore: r.score,
      excerpt: r.document,
      apartment: r.metadata.apartment || 'N/A',
      topic: r.metadata.topic || 'General',
      participant: r.metadata.participant || 'Unknown',
      source: r.metadata.source || 'knowledge',
      date: r.metadata.first_date || 'N/A'
    }))
  };
}
