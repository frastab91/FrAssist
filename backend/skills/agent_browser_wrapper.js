export const declaration = {
  name: 'autonomous_browse',
  description: 'Robust, autonomous web browsing wrapper with automatic retries and session persistence.',
  parameters: {
    type: 'OBJECT',
    properties: {
      url: { type: 'STRING', description: 'URL to navigate to' },
      instructions: { type: 'STRING', description: 'Natural language instructions' },
      sessionName: { type: 'STRING', description: 'Session for persistence' }
    },
    required: ['url', 'instructions']
  }
};

import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);

export async function execute(args) {
  const { url, instructions, sessionName = 'default_session' } = args;
  
  // Use persistent profile path
  const profilePath = `./data/browser_profile_${sessionName}`;
  
  // Helper to run commands with the persistent profile
  const run = async (cmd) => {
    return await execPromise(`AGENT_BROWSER_PROFILE=${profilePath} agent-browser ${cmd}`);
  };

  try {
    // 1. Open URL
    await run(`open ${url}`);
    
    // 2. Initial Wait for Load
    await run('wait --load networkidle');
    
    // 3. Autonomous interaction loop (using chat for convenience)
    const { stdout } = await run(`chat "${instructions.replace(/"/g, '\\"')}"`);
    
    return { result: 'success', output: stdout };
    
  } catch (error) {
    // Fallback: Try a fresh snapshot if the chat fails
    try {
        const { stdout } = await run('snapshot -i');
        return { result: 'partial_success', message: 'Chat failed, returning snapshot for manual recovery', snapshot: stdout };
    } catch (e) {
        return { result: 'error', message: `Browser failed completely: ${error.message}` };
    }
  }
}
