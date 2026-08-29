import fs from 'fs';
import path from 'path';

export const declaration = {
  name: 'create_agent',
  description: 'Creates a new standalone, persistent specialized agent by saving its configuration to disk. Use this when the user asks to create an agent for future use.',
  parameters: {
    type: 'OBJECT',
    properties: {
      agent_id: {
        type: 'STRING',
        description: 'A unique identifier for the agent (lowercase, underscore separated). Example: vacation_rental_manager'
      },
      agent_name: {
        type: 'STRING',
        description: 'A human-readable name for the agent. Example: Vacation Rental Manager'
      },
      role: {
        type: 'STRING',
        description: 'A brief summary of the agent\'s role. Example: Handles vacation rental inquiry emails.'
      },
      system_prompt: {
        type: 'STRING',
        description: 'The complete system prompt (instructions) for this new agent.'
      }
    },
    required: ['agent_id', 'agent_name', 'role', 'system_prompt']
  }
};

export async function execute(args) {
  const { agent_id, agent_name, role, system_prompt } = args;

  if (!agent_id || !agent_name || !system_prompt) {
    return { error: 'Missing required parameters: agent_id, agent_name, and system_prompt are required.' };
  }

  const sanitizedAgentId = agent_id.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const agentsDir = path.join(process.cwd(), 'agents', sanitizedAgentId);

  try {
    if (!fs.existsSync(agentsDir)) {
      fs.mkdirSync(agentsDir, { recursive: true });
    }

    const systemPromptPath = path.join(agentsDir, 'system.md');
    
    // Prefix the prompt with the role and name for context if needed, but primarily just save the prompt
    const fullPrompt = `# Role: ${role}\n# Name: ${agent_name}\n\n${system_prompt}`;
    
    fs.writeFileSync(systemPromptPath, fullPrompt, 'utf8');

    return {
      success: true,
      message: `Agent '${agent_name}' (${sanitizedAgentId}) has been successfully created and persisted to disk. It is now available for future use.`,
      agent_id: sanitizedAgentId
    };
  } catch (error) {
    console.error('Error creating agent:', error);
    return {
      error: `Failed to create agent: ${error.message}`
    };
  }
}
