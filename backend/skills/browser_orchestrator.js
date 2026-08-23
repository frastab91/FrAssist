export const declaration = {
  name: 'browser_orchestrator',
  description: 'Manage persistent stealth browser sessions and capture content.',
  parameters: {
    type: 'OBJECT',
    properties: {
      action: { type: 'STRING', enum: ['init', 'close', 'smart_capture'], description: 'Action to perform' },
      outputPath: { type: 'STRING', description: 'Path to save the screenshot' }
    },
    required: ['action']
  }
};

import { BrowserManager } from './utils/browser_manager.js';
import { EgoAdapter } from './utils/ego_adapter.js';
import path from 'path';
import fs from 'fs';

export async function execute(args) {
  const { action, outputPath = './screenshots/smart_capture.png' } = args;
  const useEgo = process.env.BROWSER_PROVIDER === 'ego' && EgoAdapter.isAvailable();

  try {
    if (useEgo) {
      if (action === 'init') {
        return { result: 'success', message: 'Ego Lite session ready.' };
      }
      if (action === 'close') {
        const res = await EgoAdapter.close();
        return { result: 'success', message: res || 'Ego Lite session closed and task space completed.' };
      }
      if (action === 'smart_capture') {
        await EgoAdapter.scroll('down', 800);
        await EgoAdapter.wait(1500);
        const filename = path.resolve(outputPath);
        const dir = path.dirname(filename);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        await EgoAdapter.screenshot(filename);
        return { result: 'success', message: `Content captured to ${outputPath}`, screenshotUrl: `/screenshots/${path.basename(filename)}` };
      }
      return { result: 'error', message: `Unknown action: ${action}` };
    }

    if (action === 'init') {
      const res = await BrowserManager.launch();
      return { result: 'success', message: res.message };
    }
    
    if (action === 'close') {
      const res = await BrowserManager.stop();
      return { result: 'success', message: res };
    }

    if (action === 'smart_capture') {
      await BrowserManager.scroll('down', 800);
      await BrowserManager.wait(1500);
      const filename = path.resolve(outputPath);
      await BrowserManager.screenshot(filename, true);
      return { result: 'success', message: `Content captured to ${outputPath}`, screenshotUrl: `/screenshots/${path.basename(filename)}` };
    }

    return { result: 'error', message: `Unknown action: ${action}` };
  } catch (error) {
    return { result: 'error', message: error.message };
  }
}
