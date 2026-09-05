import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import os from 'os';
import path from 'path';
const execPromise = util.promisify(exec);

function resolveEgoBin() {
  if (process.env.EGO_BIN && fs.existsSync(process.env.EGO_BIN)) {
    return process.env.EGO_BIN;
  }
  const homeBin = path.join(os.homedir(), '.local', 'bin', 'ego-browser');
  if (fs.existsSync(homeBin)) {
    return homeBin;
  }
  const usrLocalBin = '/usr/local/bin/ego-browser';
  if (fs.existsSync(usrLocalBin)) {
    return usrLocalBin;
  }
  return homeBin;
}

const EGO_BIN = resolveEgoBin();

function normalizeSelector(sel) {
  if (!sel) return '';
  const s = String(sel).trim();
  if (/^@?e?(\d+)$/i.test(s)) {
    return '@' + s.match(/^@?e?(\d+)$/i)[1];
  }
  if (/^@?\[?ref[=:]?(\d+)\]?$/i.test(s)) {
    return '@' + s.match(/^@?\[?ref[=:]?(\d+)\]?$/i)[1];
  }
  const embeddedRef = s.match(/@ref=(\d+)/i);
  if (embeddedRef) {
    return '@' + embeddedRef[1];
  }
  return s;
}

export class EgoAdapter {
  static activeSpaces = new Set();
  static lastActivity = Date.now();
  static idleCheckInterval = null;
  static taskGraceTimeout = null;

  static currentSpace = 'FrAssist Task';

  static isAvailable() {
    return fs.existsSync(EGO_BIN);
  }

  static getSpaceName(sessionId = null) {
    if (sessionId && sessionId !== 'session_default') {
      const clean = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_');
      return `FrAssist_${clean}`;
    }
    return 'FrAssist Task';
  }

  static setSessionContext(sessionId) {
    this.currentSpace = this.getSpaceName(sessionId);
    return this.currentSpace;
  }

  static getIdleTimeoutMs() {
    return parseInt(process.env.BROWSER_IDLE_TIMEOUT_MS, 10) || 180000; // default 3 minutes
  }

  static recordActivity(name = null) {
    const space = name || this.currentSpace || 'FrAssist Task';
    this.activeSpaces.add(space);
    this.lastActivity = Date.now();
    if (this.taskGraceTimeout) {
      clearTimeout(this.taskGraceTimeout);
      this.taskGraceTimeout = null;
    }
    this.startIdleWatchdog();
  }

  static startIdleWatchdog() {
    if (!this.idleCheckInterval) {
      this.idleCheckInterval = setInterval(async () => {
        if (this.activeSpaces.size > 0 && Date.now() - this.lastActivity > this.getIdleTimeoutMs()) {
          const idleSec = Math.round((Date.now() - this.lastActivity) / 1000);
          console.log(`[EgoAdapter] Idle timeout (${idleSec}s) reached. Cleanly completing and closing task spaces.`);
          await this.closeAllActiveSpaces();
        }
      }, 30000);
      if (this.idleCheckInterval.unref) {
        this.idleCheckInterval.unref();
      }
    }
  }

  static scheduleTaskCompletionGrace(delayMs = 60000) {
    if (this.activeSpaces.size === 0) return;
    if (this.taskGraceTimeout) {
      clearTimeout(this.taskGraceTimeout);
    }
    this.taskGraceTimeout = setTimeout(async () => {
      this.taskGraceTimeout = null;
      if (this.activeSpaces.size > 0) {
        console.log(`[EgoAdapter] Agent task finished and idle grace period (${Math.round(delayMs / 1000)}s) elapsed. Cleanly completing and closing task spaces.`);
        await this.closeAllActiveSpaces();
      }
    }, delayMs);
    if (this.taskGraceTimeout.unref) {
      this.taskGraceTimeout.unref();
    }
  }

  static async completeTaskSpace(name = null) {
    if (!this.isAvailable()) return 'Ego binary not available.';
    const space = name || this.currentSpace || 'FrAssist Task';
    const nameJson = JSON.stringify(space);
    const script = `
const task = await useOrCreateTaskSpace(${nameJson});
if (task) {
  try {
    await completeTaskSpace(task.name || task.id);
  } catch (e) {}
}
cliLog('Task space completed: ' + ${nameJson});
`;
    try {
      const res = await this.runScript(script);
      this.activeSpaces.delete(space);
      return res;
    } catch (e) {
      this.activeSpaces.delete(space);
      return `Failed to complete task space: ${e.message}`;
    }
  }

  static async close(name = null) {
    if (!this.isAvailable()) return 'Ego binary not available.';
    const space = name || this.currentSpace || 'FrAssist Task';
    const nameJson = JSON.stringify(space);
    const script = `
const task = await useOrCreateTaskSpace(${nameJson});
if (task) {
  try {
    await js(String.raw\`(() => { try { window.close(); } catch(e) {} })()\`);
  } catch (e) {}
  try {
    await completeTaskSpace(task.name || task.id);
  } catch (e) {}
}
cliLog('Closed and completed task space: ' + ${nameJson});
`;
    try {
      const res = await this.runScript(script);
      this.activeSpaces.delete(space);
      return res;
    } catch (e) {
      this.activeSpaces.delete(space);
      return `Closed task space with warning: ${e.message}`;
    }
  }

  static async closeAllActiveSpaces() {
    if (this.taskGraceTimeout) {
      clearTimeout(this.taskGraceTimeout);
      this.taskGraceTimeout = null;
    }
    const spaces = this.activeSpaces.size > 0 ? Array.from(this.activeSpaces) : [this.currentSpace || 'FrAssist Task'];
    for (const space of spaces) {
      try {
        await this.close(space);
      } catch (e) {
        console.warn(`[EgoAdapter] Error closing space ${space}:`, e.message);
      }
    }
    this.activeSpaces.clear();
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
  }

  static getTaskSpaceHeader(name = null) {
    const space = name || this.currentSpace || 'FrAssist Task';
    this.recordActivity(space);
    return `const task = await useOrCreateTaskSpace('${space}');\nif (task && task.ownership === 'user') { await claimTaskSpace(task.id); }`;
  }

  static getObstacleClearanceScript() {
    return `
    const obstacleReport = await js(String.raw\`(() => {
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
    })()\`);
    `;
  }

  static getPostActionInspectionScript() {
    return `
let overlayList = [];
try {
  overlayList = await js(String.raw\`(() => {
    try {
      const list = [];
      const selectors = [
        '[role="listbox"] [role="option"]',
        '[role="option"]',
        'ul[role="listbox"] li',
        'div[class*="autocomplete" i] div',
        'div[class*="suggestion" i]',
        'div[class*="dropdown" i] [class*="item" i]',
        'ul[class*="dropdown" i] li',
        'div[class*="menu" i] button'
      ];
      for (const sel of selectors) {
        const items = Array.from(document.querySelectorAll(sel));
        for (const it of items) {
          if (it.offsetParent !== null) {
            const txt = (it.innerText || it.textContent || '').trim().replace(/\\s+/g, ' ');
            if (txt && txt.length > 1 && txt.length < 150 && !list.includes(txt)) {
              list.push(txt);
              if (list.length >= 8) break;
            }
          }
        }
        if (list.length > 0) break;
      }
      return list;
    } catch(e) { return []; }
  })()\`);
} catch (e) {}

let snap = '';
try {
  snap = await snapshotText();
  // Condense repetitive map markers to prevent snapshot flooding/truncation
  snap = snap.replace(/(?:[ \\t]*container "Map marker"[ \\t]*[\\r\\n]+[ \\t]*image[ \\t]*[\\r\\n]*){3,}/g, '  container "Map markers (omitted multiple markers to preserve page content)"\\n');
  if (Array.isArray(overlayList) && overlayList.length > 0) {
    snap += '\\n\\n--- 📍 ACTIVE DROPDOWN / AUTOCOMPLETE SUGGESTIONS ---\\n' +
      overlayList.map(o => '• "' + o + '" -> call browser_control({ action: "click_text", text: "' + o.split(',')[0].trim() + '" })').join('\\n') +
      '\\n---------------------------------------------------------';
  }
} catch (snapErr) {
  snap = '[Snapshot error: ' + (snapErr.message || String(snapErr)) + ']';
}
`;
  }

  static async runScript(script) {
    if (!this.isAvailable()) {
      throw new Error('ego-browser binary not found at ' + EGO_BIN);
    }
    const cmd = `${EGO_BIN} nodejs <<'EOF'\n${script}\nEOF`;
    try {
      const { stdout, stderr } = await execPromise(cmd, { timeout: 60000, maxBuffer: 15 * 1024 * 1024 });
      return (stdout || stderr || '').trim();
    } catch (err) {
      const output = (err.stdout || err.stderr || err.message || '').trim();
      if (output) {
        return output;
      }
      throw err;
    }
  }

  static async navigateAndSnapshot(url) {
    const urlJson = JSON.stringify(url || '');
    const script = `
${this.getTaskSpaceHeader()}
if (${urlJson}) {
  let inPlaceSuccess = false;
  try {
    const existingTabs = await listTabs();
    const activeTab = existingTabs.find(t => t.active) || existingTabs[0];
    if (activeTab && activeTab.url && activeTab.url !== 'chrome://newtab/' && activeTab.url !== 'about:blank') {
      await js(String.raw\`(() => { window.location.href = ${urlJson}; })()\`);
      await wait(2);
      inPlaceSuccess = true;
    }
  } catch (e) {}

  if (!inPlaceSuccess) {
    await openOrReuseTab(${urlJson}, { wait: true, timeout: 20 });
    await wait(1.5);
    // Cleanup any lingering blank tabs to prevent tab proliferation
    try {
      const allTabs = await listTabs();
      for (const t of allTabs) {
        if ((t.url === 'chrome://newtab/' || t.url === 'about:blank') && !t.active) {
          await closeTab(t.targetId || t.index);
        }
      }
    } catch (e) {}
  }
}

${this.getObstacleClearanceScript()}

if (obstacleReport && obstacleReport.clickedTurnstile) {
  await wait(3.5);
}

${this.getPostActionInspectionScript()}

if (obstacleReport && obstacleReport.isBlocked) {
  cliLog('[⚠️ BLOCKED BY SECURITY VERIFICATION/CAPTCHA: ' + (obstacleReport.blockReason || 'Cloudflare Turnstile') + ']\\n' + snap);
} else {
  cliLog(snap);
}
`;
    return await this.runScript(script);
  }

  static async listTabs() {
    const script = `
${this.getTaskSpaceHeader()}
const tabs = await listTabs();
cliLog(JSON.stringify(tabs));
`;
    return await this.runScript(script);
  }

  static async closeTab(tabId) {
    const targetJson = JSON.stringify(tabId || '');
    const script = `
${this.getTaskSpaceHeader()}
try {
  if (${targetJson}) {
    await closeTab(${targetJson});
  } else {
    const tabs = await listTabs();
    if (tabs.length > 1) {
      const active = tabs.find(t => t.active) || tabs[tabs.length - 1];
      await closeTab(active.targetId || active.index);
    }
  }
  cliLog('Tab closed.');
} catch (e) {
  cliLog('Failed to close tab: ' + e.message);
}
`;
    return await this.runScript(script);
  }

  static async click(selector, fallbackText = '') {
    const clean = normalizeSelector(selector);
    const selJson = JSON.stringify(clean);
    const isRefOrCss = clean.startsWith('@') || /^[.#\[]/.test(clean);
    const textTarget = fallbackText || (!isRefOrCss ? selector : '');

    // If it's pure text without a ref prefix or CSS selector, use clickText directly
    if (!isRefOrCss && textTarget) {
      return await this.clickText(textTarget);
    }

    const textFallbackJson = JSON.stringify(String(textTarget || '').trim());
    const script = `
${this.getTaskSpaceHeader()}
let clickError = null;
let clickSuccess = false;
try {
  await click(${selJson});
  clickSuccess = true;
} catch (err) {
  clickError = err.message || String(err);
  try {
    const alt = ${selJson}.replace(/^@e/, '@');
    if (alt !== ${selJson}) {
      await click(alt);
      clickError = null;
      clickSuccess = true;
    }
  } catch (err2) {
    clickError = err2.message || String(err2);
  }
}

// Fallback to text click if ref click failed or if fallbackText was supplied
if (!clickSuccess && ${textFallbackJson}) {
  try {
    const textClicked = await js(String.raw\`(() => {
      const q = ${textFallbackJson}.trim().toLowerCase();
      const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], [role="option"], [role="link"], li, [role="menuitem"], div, span, p'));
      let target = candidates.find(el => el.offsetParent !== null && (el.innerText || '').trim().toLowerCase() === q);
      if (!target) {
        const matches = candidates.filter(el => el.offsetParent !== null && (el.innerText || '').toLowerCase().includes(q));
        if (matches.length > 0) {
          matches.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
          target = matches[0];
        }
      }
      if (target) {
        target.scrollIntoView({ block: 'center', behavior: 'instant' });
        target.click();
        return true;
      }
      return false;
    })()\`);
    if (textClicked) {
      clickSuccess = true;
      clickError = null;
    }
  } catch (e) {}
}

await wait(1);
${this.getPostActionInspectionScript()}

if (clickError && !clickSuccess) {
  cliLog('[⚠️ CLICK FAILED: ' + clickError + ' - Reference ' + ${selJson} + ' was not found or not clickable. Use click_text or a valid @ref from the fresh snapshot below:]\\n' + snap);
} else {
  cliLog(snap);
}
`;
    return await this.runScript(script);
  }

  static async clickText(text) {
    const queryJson = JSON.stringify(String(text || '').trim());
    const script = `
${this.getTaskSpaceHeader()}
let clickedInfo = null;
try {
  clickedInfo = await js(String.raw\`(() => {
    const query = ${queryJson}.trim().toLowerCase();
    if (!query) return { success: false, reason: 'empty query' };
    const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], [role="option"], [role="link"], li, [role="menuitem"], div, span, p, label'));
    
    // 1. Exact match first
    let target = candidates.find(el => {
      if (!el || el.offsetParent === null) return false;
      const t = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim().toLowerCase();
      return t === query;
    });

    // 2. Contains match (favoring deepest element with shortest length)
    if (!target) {
      const matching = candidates.filter(el => {
        if (!el || el.offsetParent === null) return false;
        const t = (el.innerText || el.textContent || el.getAttribute('aria-label') || '').trim().toLowerCase();
        return t.includes(query);
      });
      if (matching.length > 0) {
        matching.sort((a, b) => (a.innerText || a.textContent || '').length - (b.innerText || b.textContent || '').length);
        target = matching[0];
      }
    }

    if (target) {
      target.scrollIntoView({ block: 'center', behavior: 'instant' });
      const rect = target.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      try { target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: cx, clientY: cy })); } catch(e) {}
      try { target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: cx, clientY: cy })); } catch(e) {}
      try { target.focus(); } catch(e) {}
      target.click();
      try { target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: cx, clientY: cy })); } catch(e) {}
      return { success: true, text: (target.innerText || target.textContent || '').trim().slice(0, 80) };
    }
    return { success: false, reason: 'not found' };
  })()\`);
} catch (e) {
  clickedInfo = { success: false, reason: e.message || String(e) };
}
await wait(1);
${this.getPostActionInspectionScript()}

if (clickedInfo && clickedInfo.success) {
  cliLog('[✓ Clicked text: "' + ${queryJson} + '" on element: ' + clickedInfo.text + ']\\n' + snap);
} else {
  cliLog('[⚠️ TEXT CLICK FAILED: Could not find visible element matching "' + ${queryJson} + '". Available snapshot:]\\n' + snap);
}
`;
    return await this.runScript(script);
  }

  static async clickCoords(x, y) {
    const nx = Number(x) || 0;
    const ny = Number(y) || 0;
    const script = `
${this.getTaskSpaceHeader()}
let clickRes = null;
try {
  clickRes = await js(String.raw\`(() => {
    const el = document.elementFromPoint(${nx}, ${ny});
    if (el) {
      try { el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: ${nx}, clientY: ${ny} })); } catch(e) {}
      try { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: ${nx}, clientY: ${ny} })); } catch(e) {}
      try { el.focus(); } catch(e) {}
      el.click();
      try { el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: ${nx}, clientY: ${ny} })); } catch(e) {}
      return { success: true, tag: el.tagName, text: (el.innerText || '').slice(0, 50) };
    }
    return { success: false };
  })()\`);
} catch(e) {}
await wait(1);
${this.getPostActionInspectionScript()}
cliLog('Clicked coordinates (${nx}, ${ny})' + (clickRes && clickRes.success ? ' on <' + clickRes.tag + '> "' + clickRes.text + '"' : ' (no element found)') + '\\n' + snap);
`;
    return await this.runScript(script);
  }

  static async type(selector, text) {
    const clean = selector ? normalizeSelector(selector) : null;
    const selJson = JSON.stringify(clean);
    const textJson = JSON.stringify(text || '');
    const script = `
${this.getTaskSpaceHeader()}
let typeError = null;
let typed = false;
if (${selJson}) {
  try {
    await fillInput(${selJson}, ${textJson});
    typed = true;
  } catch (e) {
    try {
      const alt = ${selJson}.replace(/^@e/, '@');
      if (alt !== ${selJson}) {
        await fillInput(alt, ${textJson});
        typed = true;
      } else {
        typeError = e.message || String(e);
      }
    } catch (e2) {
      typeError = e2.message || String(e2);
    }
  }
}
if (!typed) {
  try {
    await typeText(${textJson});
    typed = true;
  } catch (e3) {
    typeError = typeError || (e3.message || String(e3));
  }
}
// Wait for autocomplete / dynamic dropdown to appear
await wait(0.8);
${this.getPostActionInspectionScript()}

if (typeError && !typed) {
  cliLog('[⚠️ TYPE FAILED: ' + typeError + ' - Use a valid input @ref from the fresh snapshot below:]\\n' + snap);
} else {
  cliLog(snap);
}
`;
    return await this.runScript(script);
  }

  static async press(key = 'Enter') {
    const keys = Array.isArray(key) 
      ? key 
      : String(key).split(',').map(k => k.trim().replace(/^@/, '')).filter(Boolean);
    const keysJson = JSON.stringify(keys.length > 0 ? keys : ['Enter']);
    const script = `
${this.getTaskSpaceHeader()}
let pressErrors = [];
for (const k of ${keysJson}) {
  try {
    await pressKey(k);
    await wait(0.4);
  } catch (e) {
    pressErrors.push(k + ': ' + (e.message || String(e)));
  }
}
await wait(1);
${this.getPostActionInspectionScript()}

if (pressErrors.length > 0) {
  cliLog('[⚠️ KEY PRESS WARNING: ' + pressErrors.join('; ') + ']\\n' + snap);
} else {
  cliLog(snap);
}
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
let hoverError = null;
try {
  await hover(${selJson});
} catch (e) {
  hoverError = e.message || String(e);
}
await wait(0.5);
${this.getPostActionInspectionScript()}

if (hoverError) {
  cliLog('[⚠️ HOVER FAILED: ' + hoverError + ' - Fresh snapshot:]\\n' + snap);
} else {
  cliLog('Hovered ' + ${selJson} + '\\n' + snap);
}
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
  // Compensate for ego-browser viewport scroll offset bug:
  // when scrollY > 0, captureScreenshot translates the capture buffer down,
  // leaving blank background padding at the top. We save scroll, reset to (0,0), capture, and restore.
  const prevScroll = await js(String.raw\`(() => {
    const sx = window.scrollX || 0;
    const sy = window.scrollY || 0;
    if (sx !== 0 || sy !== 0) {
      window.scrollTo(0, 0);
    }
    return { sx, sy };
  })()\`);

  await captureScreenshot(${pathJson});

  if (prevScroll && (prevScroll.sx !== 0 || prevScroll.sy !== 0)) {
    await js(String.raw\`(() => {
      window.scrollTo(\${prevScroll.sx}, \${prevScroll.sy});
    })()\`);
  }

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

  static async getText(selector, spaceName = null) {
    const rawSel = (selector || '').trim();
    const selJson = JSON.stringify(rawSel);
    const norm = normalizeSelector(rawSel);
    const normJson = JSON.stringify(norm);
    const activeSpace = spaceName || this.currentSpace || 'FrAssist Task';

    const script = `
${this.getTaskSpaceHeader(activeSpace)}

const result = await js(String.raw\`(() => {
  try {
    const s = ${normJson};
    let el = null;
    if (s && s.startsWith('@')) {
      const refId = s.slice(1);
      el = document.querySelector('[ref="' + refId + '"]') || document.querySelector('[data-ref="' + refId + '"]');
    }
    if (!el && ${selJson}) {
      el = document.querySelector(${selJson});
    }
    if (!el && !${selJson}) {
      el = document.querySelector('article') || document.querySelector('main') || document.body;
    }
    if (!el) {
      return JSON.stringify({ error: 'Element not found for selector: ' + ${selJson} });
    }
    return JSON.stringify({
      selector: ${selJson},
      text: (el.innerText || el.textContent || '').trim()
    });
  } catch(e) {
    return JSON.stringify({ error: e.message });
  }
})()\`);

cliLog(result);
`;
    const res = await this.runScript(script);
    try {
      const parsed = JSON.parse(res);
      if (parsed.error) return parsed.error;
      return parsed.text || '';
    } catch (e) {
      return res;
    }
  }

  static async distillPage(url, spaceName = null) {
    const targetSpace = spaceName || this.currentSpace || 'Web Reader';
    const urlJson = JSON.stringify(url || '');
    const spaceJson = JSON.stringify(targetSpace);
    this.recordActivity(targetSpace);

    const script = `
const task = await useOrCreateTaskSpace(${spaceJson});
if (task && task.ownership === 'user') { await claimTaskSpace(task.id); }

if (${urlJson}) {
  let inPlaceSuccess = false;
  try {
    const existingTabs = await listTabs();
    const activeTab = existingTabs.find(t => t.active) || existingTabs[0];
    if (activeTab && activeTab.url && activeTab.url !== 'chrome://newtab/' && activeTab.url !== 'about:blank') {
      await js(String.raw\`(() => { window.location.href = ${urlJson}; })()\`);
      await wait(2.5);
      inPlaceSuccess = true;
    }
  } catch (e) {}

  if (!inPlaceSuccess) {
    await openOrReuseTab(${urlJson}, { wait: true, timeout: 20 });
    await wait(2);
  }
}

${this.getObstacleClearanceScript()}

if (obstacleReport && obstacleReport.clickedTurnstile) {
  await wait(3.5);
}

const distilled = await js(String.raw\`(() => {
  try {
    const docTitle = document.title || '';
    const docUrl = window.location.href;

    // Check if body exists
    if (!document.body) return JSON.stringify({ error: 'Empty document body' });

    // Clone body to safely remove noise without breaking live page execution
    const bodyClone = document.body.cloneNode(true);

    const unwantedSelectors = [
      'header', 'nav', 'footer', 'aside',
      '.o-header', '.o-footer', '.o-teaser', '.o-share',
      '#onetrust-consent-sdk', '.cookie-banner', '#cookie-banner',
      '.ad', '.ads', '.advertisement', '.ad-container',
      '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
      'script', 'style', 'noscript', 'iframe', 'svg',
      '.share-tools', '.social-share', '.subscribe-banner',
      '[data-trackable="share-buttons"]', '[data-trackable="social-share"]',
      '[data-trackable="myft-topic"]', '.myft-follow',
      '#comments', '.comments-area', '[data-trackable="comments"]',
      '[class*="share" i]', '[class*="social" i]'
    ];
    unwantedSelectors.forEach(sel => {
      try {
        bodyClone.querySelectorAll(sel).forEach(el => el.remove());
      } catch (e) {}
    });

    let byline = '';
    const authorEl = document.querySelector('[rel="author"], .byline, [class*="author" i], [itemprop="author"]');
    if (authorEl) byline = (authorEl.innerText || authorEl.textContent || '').trim();

    let publishDate = '';
    const timeEl = document.querySelector('time[datetime], meta[property="article:published_time"]');
    if (timeEl) {
      publishDate = timeEl.getAttribute('datetime') || timeEl.getAttribute('content') || timeEl.innerText || '';
    }

    const candidates = Array.from(bodyClone.querySelectorAll('article, main, [role="main"], [itemprop="articleBody"], .article-body, .story-body, .post-content, .entry-content, div.body'));
    let bestElement = bodyClone;
    let maxScore = -1;

    for (const el of candidates) {
      const pCount = el.querySelectorAll('p').length;
      const textLen = (el.innerText || el.textContent || '').trim().length;
      const score = pCount * 150 + textLen;
      if (score > maxScore && textLen > 250) {
        maxScore = score;
        bestElement = el;
      }
    }

    const paragraphs = Array.from(bestElement.querySelectorAll('h1, h2, h3, h4, p, blockquote, li'));
    let text = '';
    if (paragraphs.length >= 3) {
      text = paragraphs
        .map(p => {
          const tag = p.tagName.toLowerCase();
          const t = (p.innerText || p.textContent || '').trim().replace(/\\s+/g, ' ');
          if (!t) return '';
          if (t.toLowerCase().includes('opens in a new window') && (t.toLowerCase().includes('share') || t.toLowerCase().includes('facebook') || t.toLowerCase().includes('linkedin') || t.toLowerCase().includes('x.com'))) {
            return '';
          }
          if (t.toLowerCase().includes('add to myft')) return '';
          if (tag === 'h1') return '# ' + t;
          if (tag === 'h2') return '## ' + t;
          if (tag === 'h3') return '### ' + t;
          if (tag === 'h4') return '#### ' + t;
          if (tag === 'blockquote') return '> ' + t;
          if (tag === 'li') return '- ' + t;
          return t;
        })
        .filter(Boolean)
        .join('\\n\\n');
    } else {
      text = (bestElement.innerText || bestElement.textContent || '').trim();
    }

    return JSON.stringify({
      title: docTitle,
      byline: byline,
      publishDate: publishDate,
      url: docUrl,
      text: text,
      charCount: text.length
    });
  } catch (e) {
    return JSON.stringify({ error: e.message });
  }
})()\`);

cliLog(distilled);
`;
    const res = await this.runScript(script);
    try {
      const parsed = JSON.parse(res);
      return parsed;
    } catch (e) {
      return { text: res, error: 'JSON parse failed: ' + e.message };
    }
  }
}


