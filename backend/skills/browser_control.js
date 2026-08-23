export const declaration = {
  name: 'browser_control',
  description: 'Autonomous browser tool for web navigation, searching, interacting with web pages (buttons, inputs, links), and capturing screenshots. Direct execution: navigate directly to a URL, snapshot to inspect elements and get references (e.g. @e1, @e2), click/type using references, and screenshot to verify.',
  parameters: {
    type: 'OBJECT',
    properties: {
      action: { 
        type: 'STRING', 
        enum: ['navigate', 'click', 'type', 'press', 'snapshot', 'screenshot', 'scroll', 'hover', 'tabs', 'close_tab', 'wait', 'reset', 'init'],
        description: 'The browser action to perform: "navigate" (opens a URL), "snapshot" (inspects page accessibility tree with element @refs), "click" (clicks an element @ref or CSS selector), "type" (types text into input @ref), "press" (presses key e.g. "Enter"), "scroll" (scrolls down/up), "screenshot" (captures visual proof for user), "wait" (waits N ms).'
      },
      url: { type: 'STRING', description: 'URL for navigate (e.g. https://www.google.com or direct shop URL).' },
      selector: { type: 'STRING', description: 'Element reference (e.g. @e1, @e2) from snapshot, or CSS selector.' },
      text: { type: 'STRING', description: 'Text to type into an input field.' },
      tabId: { type: 'STRING', description: 'Target tab ID or label.' },
      waitMs: { type: 'NUMBER', description: 'Milliseconds to wait (e.g. 2000).' },
      annotate: { type: 'BOOLEAN', description: 'If true, screenshot will include numbered labels.' }
    },
    required: ['action']
  }
};

import { BrowserManager } from './utils/browser_manager.js';
import { EgoAdapter } from './utils/ego_adapter.js';
import path from 'path';
import fs from 'fs';

export async function execute(args) {
  const { action, url, selector, text, tabId, waitMs, annotate } = args;

  const formatRes = (res) => {
    if (!res) return '';
    if (typeof res === 'string') return res;
    return (res.stdout || res.stderr || JSON.stringify(res)).trim();
  };

  const normalized = (action || '').toLowerCase().trim().replace(/[\s_-]+/g, '_');
  const useEgo = process.env.BROWSER_PROVIDER === 'ego' && EgoAdapter.isAvailable();

  try {
    if (useEgo) {
      switch (normalized) {
        case 'init':
          return { output: 'Ego Lite session active.' };

        case 'navigate':
        case 'open':
        case 'goto':
          return { output: formatRes(await EgoAdapter.navigateAndSnapshot(url)) };
        
        case 'click':
        case 'tap':
        case 'select':
          return { output: formatRes(await EgoAdapter.click(selector)) };
        
        case 'type':
        case 'keyboard_type':
        case 'keyboard':
        case 'fill':
        case 'input':
        case 'write':
          return { output: formatRes(await EgoAdapter.type(selector, text)) };
        
        case 'snapshot':
        case 'inspect':
          return { output: formatRes(await EgoAdapter.navigateAndSnapshot('')) };
        
        case 'screenshot':
        case 'capture':
          const dir = path.join(process.cwd(), 'screenshots');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          const baseName = `capture_${Date.now()}.png`;
          const filename = path.join(dir, baseName);
          try {
            await EgoAdapter.screenshot(filename);
            return { result: 'success', screenshotUrl: `/screenshots/${baseName}` };
          } catch (shotErr) {
            return { 
              error: shotErr.message, 
              isBlocked: true, 
              advice: 'The webpage is blocked by a Cloudflare security verification / CAPTCHA. Do NOT present this image to the user. Instead, try an alternate domain/photo source or request human verification in Ego browser.' 
            };
          }
        
        case 'press':
        case 'key':
        case 'keypress':
        case 'keydown':
        case 'enter':
          return { output: formatRes(await EgoAdapter.press(selector || text || 'Enter')) };
        
        case 'scroll':
          return { output: formatRes(await EgoAdapter.scroll(text || 'down', waitMs || 500)) };
        
        case 'hover':
          return { output: formatRes(await EgoAdapter.hover(selector)) };

        case 'wait':
        case 'sleep':
          return { output: formatRes(await EgoAdapter.wait(waitMs || 2000)) };
        
        case 'reset':
        case 'stop':
        case 'close':
          return { output: 'Ego Lite session reset.' };
        
        default:
          return { error: `Unsupported action: ${action}` };
      }
    }

    // Otherwise use BrowserManager (Stealth Playwright)
    switch (normalized) {
      case 'init':
        const initResult = await BrowserManager.launch();
        return { output: initResult.message };

      case 'navigate':
      case 'open':
      case 'goto':
        return { output: formatRes(await BrowserManager.navigate(url)) };
      
      case 'click':
      case 'tap':
      case 'select':
        return { output: formatRes(await BrowserManager.click(selector)) };
      
      case 'type':
      case 'keyboard_type':
      case 'keyboard':
      case 'fill':
      case 'input':
      case 'write':
        return { output: formatRes(await BrowserManager.type(selector, text)) };
      
      case 'snapshot':
      case 'inspect':
        return { output: formatRes(await BrowserManager.snapshot()) };
      
      case 'screenshot':
      case 'capture':
        const dir = path.join(process.cwd(), 'screenshots');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        const baseName = `capture_${Date.now()}.png`;
        const filename = path.join(dir, baseName);
        try {
          await BrowserManager.screenshot(filename, annotate);
          return { result: 'success', screenshotUrl: `/screenshots/${baseName}` };
        } catch (shotErr) {
          return { 
            error: shotErr.message, 
            isBlocked: true, 
            advice: 'The webpage is blocked by a Cloudflare security verification / CAPTCHA. Do NOT present this image to the user. Instead, try an alternate domain/photo source or request human verification.' 
          };
        }
      
      case 'press':
      case 'key':
      case 'keypress':
      case 'keydown':
      case 'enter':
        return { output: formatRes(await BrowserManager.press(selector || text || 'Enter')) };
      
      case 'scroll':
        return { output: formatRes(await BrowserManager.scroll(text || 'down', waitMs || 500)) };
      
      case 'hover':
        return { output: formatRes(await BrowserManager.hover(selector)) };

      case 'wait':
      case 'sleep':
        return { output: formatRes(await BrowserManager.wait(waitMs || 2000)) };
      
      case 'reset':
      case 'stop':
      case 'close':
        await BrowserManager.stop();
        return { output: 'Browser session reset.' };
      
      default:
        return { error: `Unsupported action: ${action}` };
    }
  } catch (error) {
    return { error: error.message };
  }
}

export default {
  declaration,
  execute
};
