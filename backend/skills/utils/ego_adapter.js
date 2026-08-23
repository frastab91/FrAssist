import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
const execPromise = util.promisify(exec);

const EGO_BIN = '/Users/francescostabilito/.local/bin/ego-browser';

function normalizeSelector(sel) {
  if (!sel) return '';
  const s = String(sel).trim();
  if (/^@?e?(\d+)$/i.test(s)) {
    return '@' + s.match(/^@?e?(\d+)$/i)[1];
  }
  if (/^\[?ref=(\d+)\]?$/i.test(s)) {
    return '@' + s.match(/^\[?ref=(\d+)\]?$/i)[1];
  }
  return s;
}

export class EgoAdapter {
  static isAvailable() {
    return fs.existsSync(EGO_BIN);
  }

  static getTaskSpaceHeader(name = 'FrAssist Task') {
    return `const task = await useOrCreateTaskSpace('${name}');\nif (task && task.ownership === 'user') { await claimTaskSpace(task.id); }`;
  }

  static getObstacleClearanceScript() {
    return String.raw`
    const obstacleReport = await js(String.raw`(() => {
      // 1. Detect Cloudflare / Security Check / CAPTCHA
      const bodyText = document.body ? (document.body.innerText || '') : '';
      const title = document.title || '';
      
      const cfPatterns = [
        'verifica di sicurezza',
        'stiamo verificando che tu non sia un robot',
        'verify you are human',
        'checking if the site connection is secure',
        'just a moment...',
        'ddos protection by cloudflare',
        'attention required! | cloudflare',
        'cf-turnstile',
        'challenges.cloudflare.com'
      ];
      
      let isBlocked = false;
      let blockReason = '';
      
      for (const pattern of cfPatterns) {
        if (bodyText.toLowerCase().includes(pattern) || title.toLowerCase().includes(pattern)) {
          isBlocked = true;
          blockReason = pattern;
          break;
        }
      }

      // 2. Attempt Turnstile Checkbox Auto-Click
      const turnstileFrame = document.querySelector('iframe[src*="challenges.cloudflare.com"], #challenge-stage, .cf-turnstile');
      let clickedTurnstile = false;
      if (turnstileFrame) {
        try {
          const rect = turnstileFrame.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            turnstileFrame.click();
            clickedTurnstile = true;
          }
        } catch (e) {}
      }

      // 3. Auto-Dismiss Common Cookie / GDPR Banners
      const cookieSelectors = [
        '#onetrust-accept-btn-handler',
        '#accept-cookies',
        'button[id*="accept-cookie" i]',
        'button[class*="cookie-accept" i]',
        'button[id*="consent-accept" i]',
        'button[class*="agree" i]',
        'button[id*="acceptAll" i]',
        'button[class*="acceptAll" i]',
        'button[aria-label*="accept" i]',
        'button[aria-label*="accetta" i]'
      ];

      let dismissedCookies = false;
      for (const sel of cookieSelectors) {
        try {
          const btn = document.querySelector(sel);
          if (btn && btn.offsetParent !== null) {
            btn.click();
            dismissedCookies = true;
            break;
          }
        } catch(e) {}
      }

      // 4. Remove obstructive fixed backdrop overlays that hide page content
      document.querySelectorAll('div[class*="backdrop"], div[class*="overlay-backdrop"], div[id*="onetrust-consent-sdk"], div[class*="cookie-consent"]').forEach(el => {
        try { el.remove(); } catch(e) {}
      });

      return {
        isBlocked,
        blockReason,
        clickedTurnstile,
        dismissedCookies,
        title,
        url: window.location.href
      };
    })()`);
    `;
  }

  static async runScript(script) {
    if (!this.isAvailable()) {
      throw new Error('ego-browser binary not found at ' + EGO_BIN);
    }
    const cmd = `${EGO_BIN} nodejs <<'EOF'\n${script}\nEOF`;
    const { stdout, stderr } = await execPromise(cmd, { timeout: 60000 });
    return (stdout || stderr || '').trim();
  }

  static async navigateAndSnapshot(url) {
    const urlJson = JSON.stringify(url || '');
    const script = `
${this.getTaskSpaceHeader()}
if (${urlJson}) {
  await openOrReuseTab(${urlJson}, { wait: true, timeout: 20 });
  await wait(1.5);
}

${this.getObstacleClearanceScript()}

if (obstacleReport && obstacleReport.clickedTurnstile) {
  await wait(3.5);
}

const snap = await snapshotText();
if (obstacleReport && obstacleReport.isBlocked) {
  cliLog('[⚠️ BLOCKED BY SECURITY VERIFICATION/CAPTCHA: ' + (obstacleReport.blockReason || 'Cloudflare Turnstile') + ']\\n' + snap);
} else {
  cliLog(snap);
}
`;
    return await this.runScript(script);
  }

  static async click(selector) {
    const clean = normalizeSelector(selector);
    const selJson = JSON.stringify(clean);
    const script = `
${this.getTaskSpaceHeader()}
try {
  await click(${selJson});
} catch (err) {
  const alt = ${selJson}.replace(/^@e/, '@');
  await click(alt);
}
await wait(1);
const snap = await snapshotText();
cliLog(snap);
`;
    return await this.runScript(script);
  }

  static async type(selector, text) {
    const clean = selector ? normalizeSelector(selector) : null;
    const selJson = JSON.stringify(clean);
    const textJson = JSON.stringify(text || '');
    const script = `
${this.getTaskSpaceHeader()}
let typed = false;
if (${selJson}) {
  try {
    await fillInput(${selJson}, ${textJson});
    typed = true;
  } catch (e) {
    try {
      const alt = ${selJson}.replace(/^@e/, '@');
      await fillInput(alt, ${textJson});
      typed = true;
    } catch {}
  }
}
if (!typed) {
  await typeText(${textJson});
}
await wait(0.5);
const snap = await snapshotText();
cliLog(snap);
`;
    return await this.runScript(script);
  }

  static async press(key = 'Enter') {
    const cleanKey = (key || 'Enter').replace(/^@/, '');
    const keyJson = JSON.stringify(cleanKey);
    const script = `
${this.getTaskSpaceHeader()}
await pressKey(${keyJson});
await wait(1);
const snap = await snapshotText();
cliLog(snap);
`;
    return await this.runScript(script);
  }

  static async scroll(direction = 'down', px = 500) {
    const dy = direction.includes('up') ? -Math.abs(px) : Math.abs(px);
    const script = `
${this.getTaskSpaceHeader()}
await scrollBy(${dy});
await wait(0.5);
cliLog('Scrolled ${direction} ${px}px');
`;
    return await this.runScript(script);
  }

  static async hover(selector) {
    const clean = normalizeSelector(selector);
    const selJson = JSON.stringify(clean);
    const script = `
${this.getTaskSpaceHeader()}
await hover(${selJson});
await wait(0.5);
cliLog('Hovered ${selJson}');
`;
    return await this.runScript(script);
  }

  static async wait(ms = 2000) {
    const sec = ms / 1000;
    const script = `
${this.getTaskSpaceHeader()}
await wait(${sec});
cliLog('Waited ${sec}s');
`;
    return await this.runScript(script);
  }

  static async screenshot(outputPath) {
    const pathJson = JSON.stringify(outputPath);
    const script = `
${this.getTaskSpaceHeader()}

${this.getObstacleClearanceScript()}

if (obstacleReport && obstacleReport.clickedTurnstile) {
  await wait(3.5);
}

if (obstacleReport && obstacleReport.isBlocked) {
  cliLog(JSON.stringify({
    error: 'BLOCKED_BY_CLOUDFLARE_CHALLENGE',
    isBlocked: true,
    reason: obstacleReport.blockReason,
    message: 'Page is blocked by Cloudflare verification (' + obstacleReport.blockReason + '). Screenshot suppressed to avoid displaying CAPTCHA/security interstitials.'
  }));
} else {
  await captureScreenshot(${pathJson});
  cliLog(JSON.stringify({ success: true, path: ${pathJson} }));
}
`;
    const res = await this.runScript(script);
    try {
      const parsed = JSON.parse(res);
      if (parsed.isBlocked) {
        throw new Error(parsed.message || 'Page is blocked by security verification');
      }
      return parsed.path || outputPath;
    } catch (e) {
      if (e.message.includes('Page is blocked by security verification') || e.message.includes('BLOCKED_BY_CLOUDFLARE_CHALLENGE')) {
        throw e;
      }
      return outputPath;
    }
  }
}


