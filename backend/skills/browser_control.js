export const declaration = {
  name: 'browser_control',
  description: 'Granular browser control following the OpenClaw operating loop. Use this for complex web tasks, tab management, and sessions.',
  parameters: {
    type: 'OBJECT',
    properties: {
      action: { 
        type: 'STRING', 
        enum: ['navigate', 'click', 'type', 'snapshot', 'screenshot', 'tabs', 'close_tab', 'wait', 'reset'],
        description: 'The specific browser action to perform.'
      },
      url: { type: 'STRING', description: 'URL for navigate or tab new.' },
      selector: { type: 'STRING', description: 'CSS selector or reference ID (e.g., @e1) for click/type.' },
      text: { type: 'STRING', description: 'Text to type into an input.' },
      tabId: { type: 'STRING', description: 'Target tab ID or label.' },
      profile: { 
        type: 'STRING', 
        enum: ['isolated', 'user'], 
        default: 'isolated',
        description: 'Use "user" to attach to your real Chrome session (Amazon, Gmail, etc). Use "isolated" for a clean state.'
      },
      waitMs: { type: 'NUMBER', description: 'Milliseconds to wait.' },
      annotate: { type: 'BOOLEAN', description: 'If true, screenshot will include numbered labels.' }
    },
    required: ['action']
  }
};

import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = util.promisify(exec);

export async function execute(args) {
  const { action, url, selector, text, tabId, profile = 'isolated', waitMs, annotate } = args;
  
  // Resolve profile path or flags
  let profileFlag = '';
  if (profile === 'user') {
    profileFlag = '--auto-connect'; // Attempt to connect to running Chrome
  } else {
    const sessionDir = path.join(process.cwd(), 'data', `browser_profile_${args.sessionName || 'default'}`);
    if (!fs.existsSync(path.dirname(sessionDir))) fs.mkdirSync(path.dirname(sessionDir), { recursive: true });
    profileFlag = `--profile "${sessionDir}"`;
  }

  const run = async (cmd) => {
    const fullCmd = `agent-browser ${profileFlag} ${cmd}`;
    const { stdout, stderr } = await execPromise(fullCmd);
    if (stderr && !stdout) throw new Error(stderr);
    return stdout;
  };

  try {
    switch (action) {
      case 'navigate':
        return { output: await run(`open "${url}"`) };
      
      case 'click':
        return { output: await run(`click "${selector}"`) };
      
      case 'type':
        return { output: await run(`fill "${selector}" "${text}"`) };
      
      case 'snapshot':
        return { output: await run(`snapshot -i ${tabId ? `--tab ${tabId}` : ''}`) };
      
      case 'screenshot':
        const baseName = `capture_${Date.now()}.png`;
        const filename = path.join(process.cwd(), 'screenshots', baseName);
        const screenshotCmd = `screenshot ${annotate ? '--annotate' : ''} "${filename}" ${tabId ? `--tab ${tabId}` : ''}`;
        await run(screenshotCmd);
        return { result: 'success', screenshotUrl: `/screenshots/${baseName}` };
      
      case 'tabs':
        return { output: await run('tab') };
      
      case 'close_tab':
        return { output: await run(`tab close ${tabId || ''}`) };
      
      case 'wait':
        return { output: await run(`wait ${waitMs || 2000}`) };
      
      case 'reset':
        return { output: await run('close') };
      
      default:
        return { error: `Unsupported action: ${action}` };
    }
  } catch (error) {
    if (error.message.includes('daemon already running')) {
      return { 
        error: error.message, 
        suggestion: "The browser daemon is locked to a different profile. Please run action: 'reset' first to switch modes."
      };
    }
    return { error: error.message };
  }
}
