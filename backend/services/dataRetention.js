import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

/**
 * Data Retention & Lifecycle Manager for FrAssist
 * 
 * Enforces industry-standard data retention policies:
 * - Time-To-Live (TTL) expiration on temporary chat messages, sessions, and logs
 * - Maximum disk size bounds on trace logs and screenshot/audio artifacts
 * - Automatic LRU (Least Recently Used) eviction
 * - Scheduled background watchdog execution
 */

function resolveDbPath() {
  const backendDb = path.join(process.cwd(), 'backend', 'database.sqlite');
  if (fs.existsSync(backendDb)) return backendDb;
  return path.join(process.cwd(), 'database.sqlite');
}

export class DataRetentionManager {
  static dbInstance = null;
  static watchdogInterval = null;

  // Configuration defaults with environment variable overrides
  static config = {
    sessionRetentionDays: parseInt(process.env.SESSION_RETENTION_DAYS, 10) || 7,
    maxSessions: parseInt(process.env.MAX_SESSIONS, 10) || 50,
    maxMessagesPerSession: parseInt(process.env.MAX_MESSAGES_PER_SESSION, 10) || 200,
    auditRetentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS, 10) || 14,
    screenshotRetentionHours: parseInt(process.env.SCREENSHOT_RETENTION_HOURS, 10) || 24,
    traceLogMaxBytes: parseInt(process.env.TRACE_LOG_MAX_BYTES, 10) || 5 * 1024 * 1024, // 5MB
    mediaDirMaxBytes: parseInt(process.env.MEDIA_DIR_MAX_BYTES, 10) || 50 * 1024 * 1024, // 50MB
    cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS, 10) || 60 * 60 * 1000 // 1 hour
  };

  static async getDb() {
    if (this.dbInstance) return this.dbInstance;
    this.dbInstance = await open({
      filename: resolveDbPath(),
      driver: sqlite3.Database
    });
    return this.dbInstance;
  }

  static setDb(db) {
    this.dbInstance = db;
  }

  /**
   * 1. Prune Chat Sessions & Messages based on age, max count, and max messages per session
   */
  static async pruneSessionsAndMessages() {
    const db = await this.getDb();
    const stats = { deletedSessions: 0, deletedMessages: 0 };

    try {
      // A. Delete sessions older than sessionRetentionDays (except permanent default session)
      const cutoffDate = new Date(Date.now() - this.config.sessionRetentionDays * 24 * 60 * 60 * 1000).toISOString();
      
      const oldSessions = await db.all(
        `SELECT id FROM chat_sessions WHERE id != 'session_default' AND updated_at < ?`,
        [cutoffDate]
      );

      for (const s of oldSessions) {
        await db.run('DELETE FROM chat_messages WHERE session_id = ?', [s.id]);
        await db.run('DELETE FROM chat_sessions WHERE id = ?', [s.id]);
        stats.deletedSessions++;
      }

      // B. Enforce maxSessions cap (evict oldest sessions first)
      const allSessions = await db.all(
        `SELECT id FROM chat_sessions WHERE id != 'session_default' ORDER BY updated_at DESC`
      );

      if (allSessions.length > this.config.maxSessions) {
        const excessSessions = allSessions.slice(this.config.maxSessions);
        for (const s of excessSessions) {
          await db.run('DELETE FROM chat_messages WHERE session_id = ?', [s.id]);
          await db.run('DELETE FROM chat_sessions WHERE id = ?', [s.id]);
          stats.deletedSessions++;
        }
      }

      // C. Cap messages per session (trim oldest messages exceeding limit)
      const remainingSessions = await db.all('SELECT id FROM chat_sessions');
      for (const s of remainingSessions) {
        const msgCountRes = await db.get('SELECT COUNT(*) as count FROM chat_messages WHERE session_id = ?', [s.id]);
        const count = msgCountRes?.count || 0;
        
        if (count > this.config.maxMessagesPerSession) {
          const excess = count - this.config.maxMessagesPerSession;
          await db.run(
            `DELETE FROM chat_messages WHERE id IN (
              SELECT id FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC LIMIT ?
            )`,
            [s.id, excess]
          );
          stats.deletedMessages += excess;
        }
      }

      // D. Clean orphan messages whose sessions no longer exist
      const orphanRes = await db.run(
        `DELETE FROM chat_messages WHERE session_id NOT IN (SELECT id FROM chat_sessions) AND session_id != 'session_default'`
      );
      if (orphanRes?.changes) {
        stats.deletedMessages += orphanRes.changes;
      }

    } catch (err) {
      console.error('[DataRetention] Error pruning sessions and messages:', err.message);
    }

    return stats;
  }

  /**
   * 2. Prune Temporary Media & Artifacts (screenshots, audio clips)
   */
  static pruneDirectory(dirPath, maxAgeHours, maxDirBytes) {
    if (!fs.existsSync(dirPath)) return { deletedFiles: 0, freedBytes: 0 };
    
    let deletedFiles = 0;
    let freedBytes = 0;
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

    try {
      const files = fs.readdirSync(dirPath).map(f => {
        const fullPath = path.join(dirPath, f);
        try {
          const stat = fs.statSync(fullPath);
          return { name: f, path: fullPath, size: stat.size, mtimeMs: stat.mtimeMs, isFile: stat.isFile() };
        } catch (_) {
          return null;
        }
      }).filter(Boolean);

      // A. Remove files older than TTL
      for (const file of files) {
        if (file.isFile && (now - file.mtimeMs > maxAgeMs)) {
          try {
            fs.unlinkSync(file.path);
            deletedFiles++;
            freedBytes += file.size;
          } catch (_) {}
        }
      }

      // B. Enforce total directory size cap (LRU: oldest modified files deleted first)
      const remainingFiles = fs.readdirSync(dirPath).map(f => {
        const fullPath = path.join(dirPath, f);
        try {
          const stat = fs.statSync(fullPath);
          return { name: f, path: fullPath, size: stat.size, mtimeMs: stat.mtimeMs, isFile: stat.isFile() };
        } catch (_) {
          return null;
        }
      }).filter(Boolean);

      let totalBytes = remainingFiles.reduce((sum, f) => sum + f.size, 0);
      if (totalBytes > maxDirBytes) {
        // Sort oldest first
        remainingFiles.sort((a, b) => a.mtimeMs - b.mtimeMs);
        for (const f of remainingFiles) {
          if (totalBytes <= maxDirBytes) break;
          if (f.isFile) {
            try {
              fs.unlinkSync(f.path);
              deletedFiles++;
              freedBytes += f.size;
              totalBytes -= f.size;
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      console.error(`[DataRetention] Error pruning directory ${dirPath}:`, err.message);
    }

    return { deletedFiles, freedBytes };
  }

  /**
   * 3. Prune Rolling Trace Log File
   */
  static pruneTraceLog() {
    const traceLogPath = path.join(process.cwd(), 'data', 'trace.jsonl');
    if (!fs.existsSync(traceLogPath)) return { freedBytes: 0 };

    try {
      const size = fs.statSync(traceLogPath).size;
      if (size > this.config.traceLogMaxBytes) {
        const content = fs.readFileSync(traceLogPath, 'utf8');
        const lines = content.trim().split('\n').filter(Boolean);
        // Keep the latest 1000 lines
        const kept = lines.slice(-1000).join('\n') + '\n';
        fs.writeFileSync(traceLogPath, kept);
        const newSize = fs.statSync(traceLogPath).size;
        return { freedBytes: Math.max(0, size - newSize) };
      }
    } catch (err) {
      console.error('[DataRetention] Error pruning trace log:', err.message);
    }
    return { freedBytes: 0 };
  }

  /**
   * 4. Prune Audit & Token Logs older than TTL
   */
  static async pruneAuditLogs() {
    const db = await this.getDb();
    const stats = { deletedAuditLogs: 0 };

    try {
      const cutoffDate = new Date(Date.now() - this.config.auditRetentionDays * 24 * 60 * 60 * 1000).toISOString();
      const res = await db.run('DELETE FROM token_usage_log WHERE timestamp < ?', [cutoffDate]);
      if (res?.changes) {
        stats.deletedAuditLogs = res.changes;
      }
    } catch (err) {
      console.error('[DataRetention] Error pruning audit logs:', err.message);
    }

    return stats;
  }

  /**
   * Run full cleanup sweep across all storage tiers
   */
  static async runFullCleanup() {
    console.log('[DataRetention] Starting automated lifecycle data cleanup sweep...');
    const t0 = Date.now();

    const sessionStats = await this.pruneSessionsAndMessages();
    const screenshotStats = this.pruneDirectory(
      path.join(process.cwd(), 'screenshots'),
      this.config.screenshotRetentionHours,
      this.config.mediaDirMaxBytes
    );
    const audioStats = this.pruneDirectory(
      path.join(process.cwd(), 'audio'),
      this.config.screenshotRetentionHours * 2,
      this.config.mediaDirMaxBytes
    );
    const traceStats = this.pruneTraceLog();
    const auditStats = await this.pruneAuditLogs();

    const summary = {
      durationMs: Date.now() - t0,
      timestamp: new Date().toISOString(),
      sessionStats,
      screenshotStats,
      audioStats,
      traceStats,
      auditStats
    };

    console.log('[DataRetention] Cleanup complete:', JSON.stringify(summary));
    return summary;
  }

  /**
   * Start periodic background watchdog
   */
  static startWatchdog() {
    if (this.watchdogInterval) return;
    // Run initial cleanup on startup
    setTimeout(() => this.runFullCleanup().catch(console.error), 10000);
    
    // Schedule periodic sweep
    this.watchdogInterval = setInterval(() => {
      this.runFullCleanup().catch(console.error);
    }, this.config.cleanupIntervalMs);

    if (this.watchdogInterval.unref) {
      this.watchdogInterval.unref();
    }
  }

  static stopWatchdog() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }
}

export default DataRetentionManager;
