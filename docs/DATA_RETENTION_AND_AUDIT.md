# Data Retention, Lifecycle & Performance Audit System

## Overview
FrAssist implements an automated, tiered data retention and telemetry lifecycle system following industry best practices for agentic AI applications. It prevents unbounded disk growth and memory leaks while providing structured performance auditability.

---

## 1. Storage Tiers & Retention Policies

| Tier / Asset | Location | Retention Policy / Bounds | Default Thresholds |
| :--- | :--- | :--- | :--- |
| **Chat Sessions** | SQLite (`chat_sessions`) | **TTL + Max Count** | • 7-day inactivity TTL<br>• Max 50 active sessions<br>• Oldest non-default sessions evicted first |
| **Chat Messages** | SQLite (`chat_messages`) | **Per-Session Cap + Orphan Pruning** | • Max 200 messages per session<br>• Orphan rows without sessions auto-deleted |
| **Media & Screenshots** | `/screenshots`, `/audio` | **TTL + Max Directory Size (LRU)** | • 24-hour TTL for screenshots<br>• 48-hour TTL for audio clips<br>• 50MB max directory size (LRU eviction) |
| **Telemetry & Trace Logs** | `/data/trace.jsonl` | **Size-Bounded Ring Buffer** | • Max 5MB file cap<br>• Auto-rotates to newest 1,000 sanitized lines<br>• Individual log payloads sanitized to ≤1,500 chars |
| **Audit Logs** | SQLite (`agent_performance_audit`) | **Time-To-Live (TTL)** | • 14-day retention for granular telemetry<br>• Aggregate summaries queryable anytime |

---

## 2. Architecture & Components

### A. DataRetentionManager (`backend/services/dataRetention.js`)
* Runs an automated background watchdog every 1 hour (and cron sweep every 2 hours).
* Methods:
  - `pruneSessionsAndMessages()`: Enforces max sessions and message caps.
  - `pruneDirectory(dirPath, maxAgeHours, maxDirBytes)`: Prunes media files with LRU eviction.
  - `pruneTraceLog()`: Keeps trace files compact and lightweight.
  - `pruneAuditLogs()`: Cleans expired audit records.
  - `runFullCleanup()`: Executes a full sweep across all tiers.

### B. PerformanceAuditLogger (`backend/services/auditLogger.js`)
* Records telemetry for every agent task run:
  - `session_id`, `agent_id`, `model`
  - `duration_ms`, `turns_count`
  - `tools_executed`, `tools_failed`
  - `input_tokens`, `output_tokens`
  - `status` (`completed`, `error`, `stopped`)
* Query metrics via `GET /api/audit/summary?days=7`.

---

## 3. REST API Endpoints

### Performance Audit
* **Endpoint:** `GET /api/audit/summary?days=7`
* **Response:**
  ```json
  {
    "timeframeDays": 7,
    "totals": {
      "total_runs": 45,
      "avg_duration_ms": 3200,
      "total_turns": 120,
      "total_tools": 85,
      "total_tool_failures": 3,
      "tool_failure_rate_pct": "3.5",
      "error_rate_pct": "2.2"
    },
    "byModel": [ ... ],
    "byAgent": [ ... ],
    "recentRuns": [ ... ]
  }
  ```

### Manual Maintenance Sweep
* **Endpoint:** `POST /api/maintenance/cleanup`
* **Response:**
  ```json
  {
    "success": true,
    "summary": {
      "durationMs": 42,
      "timestamp": "2026-09-02T02:00:00.000Z",
      "sessionStats": { "deletedSessions": 2, "deletedMessages": 140 },
      "screenshotStats": { "deletedFiles": 15, "freedBytes": 12500000 },
      "traceStats": { "freedBytes": 0 }
    }
  }
  ```

---

## 4. Environment Configuration (`.env`)

You can customize retention thresholds using environment variables:

```bash
SESSION_RETENTION_DAYS=7
MAX_SESSIONS=50
MAX_MESSAGES_PER_SESSION=200
AUDIT_RETENTION_DAYS=14
SCREENSHOT_RETENTION_HOURS=24
TRACE_LOG_MAX_BYTES=5242880 # 5 MB
MEDIA_DIR_MAX_BYTES=52428800 # 50 MB
```
