import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import os from 'os';

const execPromise = util.promisify(exec);

// BrowserManager handles long-running persistent Chrome instance
export class BrowserManager {
  static getChromePath() {
    // macOS default path
    return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  }

  static getProfilePath() {
    // Exact path to user's profile directory
    return path.join(os.homedir(), "Library/Application Support/Google/Chrome");
  }

  static async checkChromeRunning() {
    try {
      const { stdout } = await execPromise('pgrep -u $(whoami) -x "Google Chrome"');
      return stdout.trim().length > 0;
    } catch (e) {
      return false; // pgrep returns non-zero if no process found
    }
  }

  static async launch() {
    const isRunning = await this.checkChromeRunning();
    
    // If it's already running, check if it's already bound to 9222
    try {
      const { stdout: lsofOut } = await execPromise(`lsof -t -i:9222`);
      if (lsofOut.trim()) {
        return { success: true, message: "Browser daemon already running on port 9222." };
      }
    } catch (e) {
      // Port 9222 not in use
      if (isRunning) {
        throw new Error("Profile already in use: A Chrome window is already open without debugging. Please manually close all Chrome windows before initializing the daemon.");
      }
    }

    const chrome = this.getChromePath();
    const profileDir = this.getProfilePath();
    const port = 9222;

    const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

    const cmd = `"${chrome}" --remote-debugging-port=${port} --user-data-dir="${profileDir}" --profile-directory="Default" --no-first-run --no-default-browser-check --disable-blink-features=AutomationControlled --user-agent="${userAgent}" &`;
    
    try {
      exec(cmd);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { success: true, message: "Browser daemon initialized on port 9222 using persistent profile." };
    } catch (e) {
      console.error("Failed to launch browser:", e);
      throw new Error(`Failed to launch browser: ${e.message}`);
    }
  }

  static async stop() {
    try {
      const { stdout } = await execPromise(`lsof -t -i:9222`);
      if (stdout) {
        const pids = stdout.trim().split('\n');
        for (const pid of pids) {
          await execPromise(`kill -9 ${pid}`);
        }
        return "Browser daemon stopped.";
      }
      return "No process bound to port 9222.";
    } catch (e) {
      return "No process bound to port 9222.";
    }
  }

  static async runAction(action) {
    // Force agent-browser to connect to the existing port
    const cmd = `AGENT_BROWSER_URL=http://localhost:9222 agent-browser ${action}`;
    return await execPromise(cmd);
  }
}
