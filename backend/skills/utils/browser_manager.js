import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import os from 'os';
import fs from 'fs';

chromium.use(StealthPlugin());

let activeContext = null;
let activePage = null;
let elementMap = new Map();
let lastActivity = Date.now();
let idleCheckInterval = null;
let taskGraceTimeout = null;

export class BrowserManager {
  static getIdleTimeoutMs() {
    return parseInt(process.env.BROWSER_IDLE_TIMEOUT_MS, 10) || 180000; // default 3 minutes
  }

  static recordActivity() {
    lastActivity = Date.now();
    if (taskGraceTimeout) {
      clearTimeout(taskGraceTimeout);
      taskGraceTimeout = null;
    }
    this.startIdleWatchdog();
  }

  static startIdleWatchdog() {
    if (!idleCheckInterval) {
      idleCheckInterval = setInterval(async () => {
        if (activeContext && Date.now() - lastActivity > this.getIdleTimeoutMs()) {
          const idleSec = Math.round((Date.now() - lastActivity) / 1000);
          console.log(`[BrowserManager] Idle timeout (${idleSec}s) reached. Cleanly stopping browser context.`);
          await this.stop();
        }
      }, 30000);
      if (idleCheckInterval.unref) {
        idleCheckInterval.unref();
      }
    }
  }

  static scheduleTaskCompletionGrace(delayMs = 60000) {
    if (!activeContext) return;
    if (taskGraceTimeout) {
      clearTimeout(taskGraceTimeout);
    }
    taskGraceTimeout = setTimeout(async () => {
      taskGraceTimeout = null;
      if (activeContext) {
        console.log(`[BrowserManager] Agent task finished and idle grace period (${Math.round(delayMs / 1000)}s) elapsed. Cleanly stopping browser session.`);
        await this.stop();
      }
    }, delayMs);
    if (taskGraceTimeout.unref) {
      taskGraceTimeout.unref();
    }
  }

  static getProfilePath() {
    return path.join(process.cwd(), 'data', 'browser_stealth_profile');
  }

  static async isPortActive(port = 9222) {
    try {
      const res = await fetch(`http://localhost:${port}/json/version`, { signal: AbortSignal.timeout(500) });
      return res.ok;
    } catch {
      return false;
    }
  }

  static async getContext() {
    this.recordActivity();
    if (activeContext) {
      try {
        const pages = activeContext.pages();
        if (pages.length > 0) {
          activePage = pages[pages.length - 1];
          return { context: activeContext, page: activePage };
        }
      } catch {
        activeContext = null;
        activePage = null;
      }
    }

    // 1. If USE_EXISTING_CHROME is enabled and port is active, attach directly via CDP
    if (process.env.USE_EXISTING_CHROME === 'true') {
      const cdpUrl = process.env.BROWSER_CDP_URL || 'http://localhost:9222';
      if (await this.isPortActive(9222)) {
        try {
          const browser = await chromium.connectOverCDP(cdpUrl);
          const contexts = browser.contexts();
          activeContext = contexts.length > 0 ? contexts[0] : await browser.newContext();
          const pages = activeContext.pages();
          activePage = pages.length > 0 ? pages[pages.length - 1] : await activeContext.newPage();
          console.log(`[BrowserManager] Attached to existing Chrome instance at ${cdpUrl}`);
          return { context: activeContext, page: activePage };
        } catch (err) {
          console.warn(`[BrowserManager] ConnectOverCDP warning: ${err.message}. Using stealth profile.`);
        }
      }
    }

    // 2. Otherwise, launch with dedicated persistent stealth profile
    const profileDir = this.getProfilePath();
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    } else {
      // Clean up stale locks if previous node process exited unexpectedly
      const lockFile = path.join(profileDir, 'SingletonLock');
      const socketFile = path.join(profileDir, 'SingletonSocket');
      try {
        if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile);
        if (fs.existsSync(socketFile)) fs.unlinkSync(socketFile);
      } catch (e) {
        console.warn('[BrowserManager] Stale lock cleanup note:', e.message);
      }
    }

    try {
      activeContext = await chromium.launchPersistentContext(profileDir, {
        headless: false,
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-infobars',
          '--window-size=1280,800'
        ]
      });
    } catch (launchErr) {
      if (launchErr.message.includes('already in use')) {
        // Fall back to ephemeral context if directory is locked
        const browser = await chromium.launch({
          headless: false,
          args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
        });
        activeContext = await browser.newContext({
          viewport: { width: 1280, height: 800 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        });
      } else {
        throw launchErr;
      }
    }

    const pages = activeContext.pages();
    activePage = pages.length > 0 ? pages[0] : await activeContext.newPage();
    return { context: activeContext, page: activePage };
  }

  static async launch() {
    const { page } = await this.getContext();
    const isAttached = process.env.USE_EXISTING_CHROME === 'true';
    return { 
      success: true, 
      message: isAttached 
        ? 'Connected to your existing Chrome session.' 
        : 'Stealth browser session active with persistent profile.' 
    };
  }

  static async stop() {
    if (taskGraceTimeout) {
      clearTimeout(taskGraceTimeout);
      taskGraceTimeout = null;
    }
    if (idleCheckInterval) {
      clearInterval(idleCheckInterval);
      idleCheckInterval = null;
    }
    if (activeContext) {
      try {
        await activeContext.close();
      } catch (e) {
        console.warn('Error closing browser context:', e.message);
      }
      activeContext = null;
      activePage = null;
      elementMap.clear();
      return 'Browser stopped successfully.';
    }
    return 'No active browser session.';
  }

  static async clearObstacles(page) {
    if (!page) return { isBlocked: false };
    try {
      return await page.evaluate(() => {
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

        // Auto-dismiss cookie / consent banners
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

        for (const sel of cookieSelectors) {
          try {
            const btn = document.querySelector(sel);
            if (btn && btn.offsetParent !== null) {
              btn.click();
              break;
            }
          } catch(e) {}
        }

        // Remove fixed backdrop overlays
        document.querySelectorAll('div[class*="backdrop"], div[class*="overlay-backdrop"], div[id*="onetrust-consent-sdk"], div[class*="cookie-consent"]').forEach(el => {
          try { el.remove(); } catch(e) {}
        });

        // Try clicking Turnstile widget
        const turnstileFrame = document.querySelector('iframe[src*="challenges.cloudflare.com"], #challenge-stage, .cf-turnstile');
        if (turnstileFrame) {
          try {
            const rect = turnstileFrame.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) turnstileFrame.click();
          } catch (e) {}
        }

        return { isBlocked, blockReason, title, url: window.location.href };
      });
    } catch {
      return { isBlocked: false };
    }
  }

  static async navigate(url) {
    const { page } = await this.getContext();
    let target = url;
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = `https://${target}`;
    }
    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);
    const report = await this.clearObstacles(page);
    const title = await page.title();
    if (report.isBlocked) {
      return `⚠️ [BLOCKED BY CLOUDFLARE/CAPTCHA: ${report.blockReason}]\n  ${page.url()}`;
    }
    return `✓ ${title}\n  ${page.url()}`;
  }

  static async snapshot() {
    const { page } = await this.getContext();
    elementMap.clear();
    const report = await this.clearObstacles(page);

    // Extract interactive elements and assign numbered @refs
    const elements = await page.evaluate(() => {
      const interactiveSelectors = 'a, button, input, textarea, select, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [onclick]';
      const nodes = Array.from(document.querySelectorAll(interactiveSelectors));
      const list = [];
      let count = 1;

      nodes.forEach(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const isVisible = rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';

        if (isVisible) {
          const ref = `@e${count++}`;
          let text = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('value') || el.getAttribute('title') || '').trim();
          text = text.replace(/\s+/g, ' ').slice(0, 80);
          
          let role = el.tagName.toLowerCase();
          if (el.getAttribute('role')) role = el.getAttribute('role');
          if (role === 'input' && el.getAttribute('type')) role = `input[${el.getAttribute('type')}]`;

          el.setAttribute('data-frassist-ref', ref);

          list.push({
            ref,
            role,
            text,
            tag: el.tagName.toLowerCase()
          });
        }
      });

      return list;
    });

    elements.forEach(item => {
      elementMap.set(item.ref, `[data-frassist-ref="${item.ref}"]`);
    });

    const lines = elements.map(e => `- ${e.role} ${e.text ? `"${e.text}" ` : ''}[ref=${e.ref}]`);
    const header = report.isBlocked ? `⚠️ [SECURITY VERIFICATION/CAPTCHA DETECTED: ${report.blockReason || 'Cloudflare'}]\n` : '';
    return header + (lines.slice(0, 150).join('\n') || 'Page loaded (no primary interactive elements detected).');
  }

  static async resolveSelector(selector) {
    if (!selector) return null;
    const clean = selector.trim();
    if (clean.startsWith('@e') && elementMap.has(clean)) {
      return elementMap.get(clean);
    }
    if (clean.startsWith('@e')) {
      return `[data-frassist-ref="${clean}"]`;
    }
    return clean;
  }

  static async click(selector) {
    const { page } = await this.getContext();
    const resolved = await this.resolveSelector(selector);
    if (!resolved) throw new Error(`Invalid selector: ${selector}`);
    
    try {
      await page.waitForSelector(resolved, { timeout: 4000 });
      await page.click(resolved);
    } catch {
      // Fallback: Click first matching element or evaluate click
      await page.evaluate((sel) => {
        const el = document.querySelector(sel) || Array.from(document.querySelectorAll('button, a, [role="button"], [role="link"]')).find(e => e.innerText?.toLowerCase().includes(sel.toLowerCase()));
        if (el) el.click();
      }, resolved);
    }
    await page.waitForTimeout(1000);
    return await this.snapshot();
  }

  static async clickText(text) {
    const { page } = await this.getContext();
    if (!text) throw new Error('Text to click is required');
    await page.evaluate((txt) => {
      const q = txt.trim().toLowerCase();
      const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], [role="option"], [role="link"], li, div, span, p'));
      let target = candidates.find(el => el.offsetParent !== null && (el.innerText || '').trim().toLowerCase() === q);
      if (!target) {
        const matches = candidates.filter(el => el.offsetParent !== null && (el.innerText || '').toLowerCase().includes(q));
        if (matches.length > 0) {
          matches.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
          target = matches[0];
        }
      }
      if (target) {
        target.scrollIntoView({ block: 'center' });
        target.click();
      }
    }, text);
    await page.waitForTimeout(1000);
    return await this.snapshot();
  }

  static async clickCoords(x, y) {
    const { page } = await this.getContext();
    await page.mouse.click(Number(x) || 0, Number(y) || 0);
    await page.waitForTimeout(1000);
    return await this.snapshot();
  }

  static async type(selector, text) {
    const { page } = await this.getContext();
    if (!text) throw new Error('Text to type is required');

    if (!selector) {
      // Try active element or typing into focused input
      await page.keyboard.type(text);
      await page.waitForTimeout(500);
      return await this.snapshot();
    }

    const resolved = await this.resolveSelector(selector);
    try {
      await page.waitForSelector(resolved, { timeout: 4000 });
      await page.fill(resolved, text);
    } catch (err) {
      console.warn(`[BrowserManager] Specific selector fill failed: ${err.message}. Trying smart input fallback.`);
      await page.evaluate(({ sel, val }) => {
        const el = document.querySelector(sel) || document.querySelector('input[type="text"], input[type="search"], textarea, input:not([type="hidden"])');
        if (el) {
          el.focus();
          el.value = val;
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, { sel: resolved, val: text });
    }
    await page.waitForTimeout(500);
    return await this.snapshot();
  }

  static async press(key = 'Enter') {
    const { page } = await this.getContext();
    const cleanKey = (key || 'Enter').replace(/^@/, '');
    await page.keyboard.press(cleanKey);
    await page.waitForTimeout(1000);
    return await this.snapshot();
  }

  static async scroll(direction = 'down', px = 500) {
    const { page } = await this.getContext();
    const amount = direction.includes('up') ? -Math.abs(px) : Math.abs(px);
    await page.evaluate((amt) => window.scrollBy(0, amt), amount);
    await page.waitForTimeout(500);
    return `✓ Scrolled ${direction} ${px}px`;
  }

  static async hover(selector) {
    const { page } = await this.getContext();
    const resolved = await this.resolveSelector(selector);
    if (!resolved) throw new Error(`Invalid selector: ${selector}`);
    await page.hover(resolved);
    return '✓ Hovered';
  }

  static async wait(ms = 2000) {
    const { page } = await this.getContext();
    await page.waitForTimeout(ms);
    return `✓ Waited ${ms}ms`;
  }

  static async screenshot(filename, annotate = false) {
    const { page } = await this.getContext();
    const report = await this.clearObstacles(page);

    if (report.isBlocked) {
      throw new Error(`Page is blocked by Cloudflare verification (${report.blockReason}). Screenshot suppressed to avoid displaying CAPTCHA/security interstitials.`);
    }
    
    if (annotate) {
      // Overlay visual badges with ref labels for vision reasoning
      await page.evaluate(() => {
        const existing = document.getElementById('frassist-annot-container');
        if (existing) existing.remove();

        const container = document.createElement('div');
        container.id = 'frassist-annot-container';
        container.style.position = 'absolute';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '999999';

        const refs = document.querySelectorAll('[data-frassist-ref]');
        refs.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const box = document.createElement('div');
            box.style.position = 'absolute';
            box.style.left = `${rect.left + window.scrollX}px`;
            box.style.top = `${rect.top + window.scrollY}px`;
            box.style.width = `${rect.width}px`;
            box.style.height = `${rect.height}px`;
            box.style.border = '2px solid red';
            box.style.boxSizing = 'border-box';
            box.appendChild(document.createElement('span'));
            container.appendChild(box);
          }
        });

        document.body.appendChild(container);
      });
    }

    const dir = path.dirname(filename);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    await page.screenshot({ path: filename, fullPage: false });

    // Clean up annotations after capture
    if (annotate) {
      await page.evaluate(() => {
        const existing = document.getElementById('frassist-annot-container');
        if (existing) existing.remove();
      });
    }

    return filename;
  }
}
