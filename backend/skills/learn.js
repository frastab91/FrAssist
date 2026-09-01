import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { VertexAI } from '@google-cloud/vertexai';
import { generateGeminiContent, hasGeminiKey } from '../services/geminiService.js';

export const declaration = {
  name: 'learn',
  description: 'Summarizes daily conversation history and extracts reusable architectural insights and proposals.',
  parameters: {
    type: 'OBJECT',
    properties: {},
    required: []
  }
};

export async function execute(args) {
  const steps = [
    'Scanning conversation logs for key insights...',
    'Analyzing project-specific architectural patterns...',
    'Synthesizing reusable improvement proposals...',
    'Finalizing architectural extraction...'
  ];

  console.log('--- Executing /learn Routine ---');
  
  try {
    const db = await open({ filename: './database.sqlite', driver: sqlite3.Database });
    const history = await db.all('SELECT role, parts FROM agent_memory WHERE agentId = ? ORDER BY id ASC', ['orchestrator']);
    
    if (history.length < 2) {
      return {
        status: 'Insufficient context',
        summary: 'Not enough conversation history to extract meaningful long-term insights.',
        steps_taken: steps,
        proposals: []
      };
    }

    const conversationText = history.map(h => {
      let text = '[Tool/Other]';
      try {
        const parts = JSON.parse(h.parts);
        text = (parts || []).map(p => p.text || '[Tool/Other]').join(' ');
      } catch (e) {}
      return `${h.role}: ${text}`;
    }).join('\n');

    const prompt = `You are an expert executive AI architect for a software engineering assistant.
Your mission is to analyze the following conversation and extract ONLY high-value, reusable architectural insights, codebase patterns, and concrete proposals for long-term project improvements.

CRITICAL DISTINCTION:
❌ DO NOT extract one-off queries, generic tasks, basic web navigation, trivial bugs, or real-estate/property management examples.
❌ DO NOT propose obvious, generic, or trivial changes. If the session was about fixing a small bug or completing a basic task, DO NOT propose any architectural changes.
✅ DO extract reusable software patterns, UI/UX decisions, system config standards, preferred tech stacks, and concrete actionable proposals for new automation skills or system features.

MOST IMPORTANT INSTRUCTION: 
Most conversations do NOT contain any architectural insights or need long-term proposals. It is EXPECTED and CORRECT to return empty proposals 90% of the time. DO NOT invent proposals just to fill the array. Be extremely conservative.

Return the result strictly as a valid JSON object with the following structure:
{
  "summary": "A 2-3 sentence high-level summary of the architectural and workflow insights gained from this session.",
  "proposals": [
    {
      "type": "skill" | "architecture" | "workflow",
      "name": "Short Name of Proposal",
      "description": "A 1-sentence description of the proposed actionable improvement."
    }
  ]
}

If no meaningful architectural insights or proposals can be extracted (which is the default and expected outcome), return:
{
  "summary": "No new reusable architectural patterns or long-term workflows were identified in this session.",
  "proposals": []
}

CONVERSATION:
${conversationText.slice(-8000)}
`;

    let textResult = '{}';

    if (hasGeminiKey()) {
      try {
        const gemRes = await generateGeminiContent({
          contents: prompt,
          model: 'gemini-3.7-flash',
          generationConfig: { responseMimeType: 'application/json' }
        });
        textResult = gemRes.text?.trim() || '{}';
      } catch (gemErr) {
        console.warn('[Learn] Gemini AI Studio inference failed, falling back to Vertex AI:', gemErr.message);
      }
    }

    if (!textResult || textResult === '{}') {
      const project = process.env.GOOGLE_CLOUD_PROJECT || 'rally-nyc';
      const location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
      const vertexAI = new VertexAI({
        project: project,
        location: location,
        apiEndpoint: 'aiplatform.googleapis.com',
      });
      const model = vertexAI.preview.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
      });
      const result = await model.generateContent(prompt);
      textResult = result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '{}';
    }
    
    // Extract JSON block in case there's markdown wrapping
    const jsonMatch = textResult.match(/\{[\s\S]*\}/);
    let parsedResult = {
      summary: "Failed to parse architectural insights.",
      proposals: []
    };
    
    if (jsonMatch) {
      try {
        parsedResult = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error("JSON parsing error in /learn:", e);
      }
    }

    return {
      status: 'Routine executed successfully',
      summary: parsedResult.summary || "No insights found.",
      steps_taken: steps,
      proposals: parsedResult.proposals || []
    };

  } catch (error) {
    console.error("Error executing /learn:", error);
    return {
      status: 'Error',
      summary: 'An error occurred while trying to learn from the session history: ' + error.message,
      steps_taken: steps,
      proposals: []
    };
  }
}
