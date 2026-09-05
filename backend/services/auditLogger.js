import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

/**
 * Performance & Execution Audit Logger for FrAssist
 * 
 * Provides structured telemetry on agent performance:
 * - Request duration & model inference latency
 * - Tool invocation counts and failure rates
 * - Turn budgets and completion rates
 * - Aggregate audit reports by agent, model, and date
 */

function resolveDbPath() {
  const backendDb = path.join(process.cwd(), 'backend', 'database.sqlite');
  if (fs.existsSync(backendDb)) return backendDb;
  return path.join(process.cwd(), 'database.sqlite');
}

export class PerformanceAuditLogger {
  static dbInstance = null;

  static async getDb() {
    if (this.dbInstance) return this.dbInstance;
    this.dbInstance = await open({
      filename: resolveDbPath(),
      driver: sqlite3.Database
    });
    
    await this.dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS agent_performance_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        agent_id TEXT,
        model TEXT,
        duration_ms INTEGER,
        turns_count INTEGER,
        tools_executed INTEGER DEFAULT 0,
        tools_failed INTEGER DEFAULT 0,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        status TEXT DEFAULT 'completed',
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_audit_agent ON agent_performance_audit(agent_id);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON agent_performance_audit(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_session ON agent_performance_audit(session_id);
    `);
    
    return this.dbInstance;
  }

  static setDb(db) {
    this.dbInstance = db;
  }

  /**
   * Record an agent turn/session run summary
   */
  static async recordRun({
    sessionId = 'session_default',
    agentId = 'orchestrator',
    model = 'unknown',
    durationMs = 0,
    turnsCount = 1,
    toolsExecuted = 0,
    toolsFailed = 0,
    inputTokens = 0,
    outputTokens = 0,
    status = 'completed',
    errorMessage = null
  }) {
    try {
      const db = await this.getDb();
      await db.run(
        `INSERT INTO agent_performance_audit 
         (session_id, agent_id, model, duration_ms, turns_count, tools_executed, tools_failed, input_tokens, output_tokens, status, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          agentId,
          model,
          Math.round(durationMs),
          turnsCount,
          toolsExecuted,
          toolsFailed,
          inputTokens,
          outputTokens,
          status,
          errorMessage ? String(errorMessage).slice(0, 500) : null
        ]
      );
    } catch (err) {
      console.error('[PerformanceAuditLogger] Error recording audit run:', err.message);
    }
  }

  /**
   * Get audit summary report for inspecting performance
   */
  static async getSummaryReport(days = 7) {
    try {
      const db = await this.getDb();
      const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const totals = await db.get(`
        SELECT 
          COUNT(*) as total_runs,
          AVG(duration_ms) as avg_duration_ms,
          SUM(turns_count) as total_turns,
          SUM(tools_executed) as total_tools,
          SUM(tools_failed) as total_tool_failures,
          SUM(input_tokens) as total_input_tokens,
          SUM(output_tokens) as total_output_tokens,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as total_errors
        FROM agent_performance_audit
        WHERE created_at >= ?
      `, [cutoffDate]);

      const byModel = await db.all(`
        SELECT 
          model,
          COUNT(*) as runs,
          ROUND(AVG(duration_ms)) as avg_duration_ms,
          SUM(tools_executed) as tools,
          SUM(tools_failed) as tool_failures,
          ROUND(SUM(input_tokens + output_tokens)) as total_tokens
        FROM agent_performance_audit
        WHERE created_at >= ?
        GROUP BY model
        ORDER BY runs DESC
      `, [cutoffDate]);

      const byAgent = await db.all(`
        SELECT 
          agent_id,
          COUNT(*) as runs,
          ROUND(AVG(duration_ms)) as avg_duration_ms,
          SUM(tools_executed) as tools,
          SUM(tools_failed) as tool_failures
        FROM agent_performance_audit
        WHERE created_at >= ?
        GROUP BY agent_id
        ORDER BY runs DESC
      `, [cutoffDate]);

      const recentRuns = await db.all(`
        SELECT 
          session_id, agent_id, model, duration_ms, turns_count, tools_executed, tools_failed, status, created_at
        FROM agent_performance_audit
        ORDER BY created_at DESC
        LIMIT 20
      `);

      return {
        timeframeDays: days,
        totals: {
          ...totals,
          avg_duration_ms: Math.round(totals?.avg_duration_ms || 0),
          tool_failure_rate_pct: totals?.total_tools > 0 ? ((totals.total_tool_failures / totals.total_tools) * 100).toFixed(1) : 0,
          error_rate_pct: totals?.total_runs > 0 ? ((totals.total_errors / totals.total_runs) * 100).toFixed(1) : 0
        },
        byModel,
        byAgent,
        recentRuns
      };
    } catch (err) {
      console.error('[PerformanceAuditLogger] Error generating summary report:', err.message);
      return { error: err.message };
    }
  }
}

export default PerformanceAuditLogger;
