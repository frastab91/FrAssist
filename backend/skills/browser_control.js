export const declaration = {
  name: 'browser_control',
  description: 'Autonomous browser tool for web navigation, searching, interacting with web pages (buttons, inputs, links, dropdowns), and capturing screenshots. Actions include navigate, click (by @ref, CSS selector, or visible text), click_text, click_coords, type, press (key or sequence e.g. "Enter" or "ArrowDown, Enter"), snapshot, screenshot, scroll, and wait.',
  parameters: {
    type: 'OBJECT',
    properties: {
      action: { 
        type: 'STRING', 
        enum: ['navigate', 'click', 'click_text', 'click_coords', 'select_option', 'type', 'press', 'press_keys', 'snapshot', 'screenshot', 'scroll', 'hover', 'tabs', 'close_tab', 'wait', 'reset', 'init', 'get_text', 'extract_text', 'distill'],
        description: 'The browser action to perform: "navigate" (opens a URL), "snapshot" (inspects page accessibility tree with element @refs and active dropdown suggestions), "click" (clicks an element @ref, CSS selector, or text), "click_text" (clicks element containing visible text), "type" (types text into input @ref), "get_text" (extracts clean text from a CSS selector, @ref, or article body), "distill" (extracts clean Markdown article content from current page), "press" (presses key), "scroll" (scrolls down/up), "screenshot" (captures visual proof), "wait" (waits N ms).'
      },
      url: { type: 'STRING', description: 'URL for navigate (e.g. https://www.google.com or direct shop URL).' },
      selector: { type: 'STRING', description: 'Element reference (e.g. @e1, @e2) from snapshot, CSS selector (e.g. "article", "div.post-content"), or element text.' },
      text: { type: 'STRING', description: 'Text to type into an input field, visible text to click when using click_text, or selector for get_text.' },
      x: { type: 'NUMBER', description: 'X coordinate for click_coords.' },
      y: { type: 'NUMBER', description: 'Y coordinate for click_coords.' },
      keys: { type: 'STRING', description: 'Key or comma-separated keys to press (e.g. "Enter" or "ArrowDown, Enter").' },
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
  const { action, url, selector, text, x, y, keys, tabId, waitMs, annotate } = args;

  const formatRes = (res) => {
    if (!res) return '';
    if (typeof res === 'string') return res;
    return (res.stdout || res.stderr || JSON.stringify(res)).trim();
  };

  const normalized = (action || '').toLowerCase().trim().replace(/[\s_-]+/g, '_');
  const useEgo = (process.env.BROWSER_PROVIDER === 'ego' || !process.env.BROWSER_PROVIDER) && EgoAdapter.isAvailable();

  try {
    if (args.sessionId) {
      EgoAdapter.setSessionContext(args.sessionId);
    }
    if (useEgo) {
      switch (normalized) {
        case 'init':
          return { output: 'Ego Lite session active.' };

        case 'navigate':
        case 'open':
        case 'goto':
          return { output: formatRes(await EgoAdapter.navigateAndSnapshot(url)) };
        
        case 'get_text':
        case 'extract_text':
        case 'read_text':
        case 'get_content':
          return { output: formatRes(await EgoAdapter.getText(selector || text)) };

        case 'distill':
        case 'read_page':
          const distRes = await EgoAdapter.distillPage(url || '', EgoAdapter.getSpaceName(args.sessionId));
          if (distRes && distRes.text) {
            let md = '';
            if (distRes.title) md += `# ${distRes.title}\n\n`;
            if (distRes.byline) md += `*${distRes.byline}*\n\n`;
            md += distRes.text;
            return { output: md };
          }
          return { output: distRes?.error || 'No content extracted.' };

        case 'click':
        case 'tap':
        case 'select':
          return { output: formatRes(await EgoAdapter.click(selector || text, text)) };

        case 'click_text':
        case 'tap_text':
        case 'select_option':
        case 'choose_option':
          return { output: formatRes(await EgoAdapter.clickText(text || selector)) };

        case 'click_coords':
        case 'click_at':
          return { output: formatRes(await EgoAdapter.clickCoords(x || selector, y || text)) };
        
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
        case 'press_keys':
        case 'key':
        case 'keypress':
        case 'keydown':
        case 'enter':
          return { output: formatRes(await EgoAdapter.press(keys || selector || text || 'Enter')) };
        
        case 'scroll':
          return { output: formatRes(await EgoAdapter.scroll(text || 'down', waitMs || 500)) };
        
        case 'hover':
          return { output: formatRes(await EgoAdapter.hover(selector)) };

        case 'wait':
        case 'sleep':
          return { output: formatRes(await EgoAdapter.wait(waitMs || 2000)) };
        
        case 'tabs':
        case 'list_tabs':
          return { output: formatRes(await EgoAdapter.listTabs()) };

        case 'close_tab':
          return { output: formatRes(await EgoAdapter.closeTab(tabId)) };

        case 'reset':
        case 'stop':
        case 'close':
        case 'complete':
          const closeRes = await EgoAdapter.close(EgoAdapter.getSpaceName(args.sessionId));
          return { output: formatRes(closeRes) || 'Ego Lite session closed and task space completed.' };
        
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
      
      case 'get_text':
      case 'extract_text':
        return { output: formatRes(await BrowserManager.snapshot()) };
      
      case 'click':
      case 'tap':
      case 'select':
        return { output: formatRes(await BrowserManager.click(selector || text)) };

      case 'click_text':
      case 'tap_text':
      case 'select_option':
        return { output: formatRes(await BrowserManager.clickText(text || selector)) };

      case 'click_coords':
      case 'click_at':
        return { output: formatRes(await BrowserManager.clickCoords(x || selector, y || text)) };
      
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
      case 'press_keys':
      case 'key':
      case 'keypress':
      case 'keydown':
      case 'enter':
        return { output: formatRes(await BrowserManager.press(keys || selector || text || 'Enter')) };
      
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
