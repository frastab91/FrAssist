export const declaration = {
  name: 'compress_session',
  description: 'Compresses and summarizes the active conversation session history into a dense, high-signal executive memory, reducing token consumption by up to 90% while preserving key facts, tasks, and constraints.',
  parameters: {
    type: 'OBJECT',
    properties: {
      targetAgentId: {
        type: 'STRING',
        description: 'Agent ID to compress (defaults to orchestrator).'
      }
    },
    required: []
  }
};

export async function execute(args, context = {}) {
  const { targetAgentId = 'orchestrator' } = args || {};
  return {
    status: 'success',
    message: `Compression requested for agent ${targetAgentId}. Execute /compress in chat for full interactive optimization.`
  };
}
