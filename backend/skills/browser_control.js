export const declaration = {
  name: 'browser_control',
  description: 'Granular browser control using a persistent OpenClaw-style daemon.',
  parameters: {
    type: 'OBJECT',
    properties: {
      action: { 
        type: 'STRING', 
        enum: ['navigate', 'click', 'type', 'snapshot', 'screenshot', 'tabs', 'close_tab', 'wait', 'reset', 'init'],
        description: 'The specific browser action to perform.'
      },
      url: { type: 'STRING', description: 'URL for navigate or tab new.' },
      selector: { type: 'STRING', description: 'CSS selector or reference ID (e.g., @e1) for click/type.' },
      text: { type: 'STRING', description: 'Text to type into an input.' },
      tabId: { type: 'STRING', description: 'Target tab ID or label.' },
      waitMs: { type: 'NUMBER', description: 'Milliseconds to wait.' },
      annotate: { type: 'BOOLEAN', description: 'If true, screenshot will include numbered labels.' }
    },
    required: ['action']
  }
};

import { BrowserManager } from './utils/browser_manager.js';
import path from 'path';
import fs from 'fs';

export async function execute(args) {
  const { action, url, selector, text, tabId, waitMs, annotate } = args;

  try {
    switch (action) {
      case 'init':
        const initResult = await BrowserManager.launch();
        return { output: initResult.message };

      case 'navigate':
        return { output: await BrowserManager.runAction(`open "${url}"`) };
      
      case 'click':
        return { output: await BrowserManager.runAction(`click "${selector}"`) };
      
      case 'type':
        return { output: await BrowserManager.runAction(`fill "${selector}" "${text}"`) };
      
      case 'snapshot':
        return { output: await BrowserManager.runAction(`snapshot -i ${tabId ? `--tab ${tabId}` : ''}`) };
      
      case 'screenshot':
        const dir = path.join(process.cwd(), 'screenshots');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const baseName = `capture_${Date.now()}.png`;
        const filename = path.join(dir, baseName);
        await BrowserManager.runAction(`screenshot ${annotate ? '--annotate' : ''} "${filename}" ${tabId ? `--tab ${tabId}` : ''}`);
        return { result: 'success', screenshotUrl: `/screenshots/${baseName}` };
      
      case 'tabs':
        return { output: await BrowserManager.runAction('tab') };
      
      case 'close_tab':
        return { output: await BrowserManager.runAction(`tab close ${tabId || ''}`) };
      
      case 'wait':
        return { output: await BrowserManager.runAction(`wait ${waitMs || 2000}`) };
      
      case 'reset':
        return { output: await BrowserManager.stop() };
      
      default:
        return { error: `Unsupported action: ${action}` };
    }
  } catch (error) {
    return { error: error.message };
  }
}
