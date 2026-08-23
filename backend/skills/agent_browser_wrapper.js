export const declaration = {
  name: 'autonomous_browse',
  description: 'Autonomous web browsing wrapper with stealth anti-detection and session persistence.',
  parameters: {
    type: 'OBJECT',
    properties: {
      url: { type: 'STRING', description: 'URL to navigate to' },
      instructions: { type: 'STRING', description: 'Natural language instructions for what to do on the page' }
    },
    required: ['url']
  }
};

import { BrowserManager } from './utils/browser_manager.js';
import { EgoAdapter } from './utils/ego_adapter.js';

export async function execute(args) {
  const { url, instructions } = args;
  const useEgo = process.env.BROWSER_PROVIDER === 'ego' && EgoAdapter.isAvailable();

  try {
    if (useEgo) {
      const snap = await EgoAdapter.navigateAndSnapshot(url);
      return {
        result: 'success',
        status: `Navigated to ${url} via Ego Lite`,
        pageElements: snap,
        message: 'Page opened with Ego Lite. Use browser_control (click, type, press, screenshot) to complete the interaction.'
      };
    }

    const navResult = await BrowserManager.navigate(url);
    await BrowserManager.wait(2000);
    const snapshot = await BrowserManager.snapshot();

    return {
      result: 'success',
      status: navResult,
      pageElements: snapshot,
      message: 'Page opened with stealth profile. Use browser_control (click, type, press, screenshot) to complete the interaction.'
    };
  } catch (error) {
    return { result: 'error', message: `Autonomous browse failed: ${error.message}` };
  }
}
