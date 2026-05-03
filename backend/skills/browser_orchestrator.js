export const declaration = {
  name: 'browser_orchestrator',
  description: 'Manage persistent browser sessions for autonomous browsing, now with advanced content detection.',
  parameters: {
    type: 'OBJECT',
    properties: {
      action: { type: 'STRING', enum: ['init', 'status', 'close', 'smart_capture'], description: 'Action to perform' },
      sessionName: { type: 'STRING', description: 'Name of the persistent session' },
      outputPath: { type: 'STRING', description: 'Path to save the screenshot' }
    },
    required: ['action']
  }
};

import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);

export async function execute(args) {
  const { action, sessionName = 'default_session', outputPath = './screenshots/smart_capture.png' } = args;
  const profilePath = `./data/browser_profile_${sessionName}`;
  const run = (cmd) => execPromise(`AGENT_BROWSER_PROFILE=${profilePath} agent-browser ${cmd}`);

  try {
    if (action === 'init') {
      await run('doctor --fix');
      return { result: 'success', message: 'Session initialized' };
    }
    
    if (action === 'smart_capture') {
      // 1. Scroll and wait to bypass initial ad/preview
      await run('scroll down 800');
      await run('wait 2000');
      
      // 2. Try to find the article body by tag or structure
      // If we are still seeing "ad" or "subscribe", keep scrolling
      const { stdout: snap } = await run('snapshot -c');
      if (snap.includes('ad') || snap.includes('subscribe')) {
          await run('scroll down 1000');
          await run('wait 2000');
      }
      
      // 3. Final capture
      await run(`screenshot ${outputPath}`);
      return { result: 'success', message: `Content captured to ${outputPath}` };
    }
    
  } catch (error) {
    return { result: 'error', message: error.message };
  }
}
