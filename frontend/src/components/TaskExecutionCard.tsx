import { useState, useEffect } from 'react';
import { Bot, Terminal, Square, Loader2, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Cpu, Wrench, Sparkles, Network } from 'lucide-react';
import type { Agent, LogEvent, TaskActivityStep } from '../types';

type TaskExecutionCardProps = {
  agent: Agent;
  currentStatus: string;
  logs: LogEvent[];
  steps?: TaskActivityStep[];
  handleStop: () => void;
  onOpenLogs?: () => void;
};

export function TaskExecutionCard({
  agent,
  currentStatus,
  logs,
  steps = [],
  handleStop,
}: TaskExecutionCardProps) {
  const [seconds, setSeconds] = useState(0);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [showAllSteps, setShowAllSteps] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const agentLogs = logs.filter(l => l.agentId === agent.id || l.agentId === 'system');
  const lastLog = agentLogs.slice(-1)[0];
  const recentLogs = agentLogs.slice(-4);

  // Status text resolution
  const activeMessage = agent.currentTask || currentStatus || 'Analyzing & executing task...';

  // Determine stage type for visual theming
  const isTool = activeMessage.toLowerCase().includes('executing') || activeMessage.toLowerCase().includes('running') || !!agent.activeTool;
  const isRouter = activeMessage.toLowerCase().includes('router') || activeMessage.toLowerCase().includes('digitalocean') || activeMessage.toLowerCase().includes('vertex') || activeMessage.toLowerCase().includes('ollama');
  const isSubagent = activeMessage.toLowerCase().includes('sub-agent') || activeMessage.toLowerCase().includes('spawning') || activeMessage.toLowerCase().includes('delegating');
  const isSynthesizing = activeMessage.toLowerCase().includes('synthesizing') || activeMessage.toLowerCase().includes('composing');

  // Time warnings
  const isDelayed = seconds > 25;
  const isStuck = seconds > 60;
  const isCritical = seconds > 90;

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="task-execution-container">
      <div className={`task-execution-card ${isCritical ? 'critical' : isStuck ? 'stuck' : isDelayed ? 'delayed' : 'active'}`}>
        
        {/* Shimmering Top Progress Stripe */}
        <div className="task-progress-stripe">
          <div className="task-progress-shimmer" />
        </div>

        {/* Card Header: Agent Identity, Timer, Stop Button */}
        <div className="task-card-header">
          <div className="task-agent-badge">
            <div className="task-avatar-wrapper">
              <span className="task-pulse-ring" />
              <Bot size={16} className="task-agent-icon" />
            </div>
            <div className="task-agent-info">
              <span className="task-agent-name">{agent.name}</span>
              <span className="task-agent-role">{agent.role || 'Autonomous Controller'}</span>
            </div>
          </div>

          <div className="task-card-actions">
            {/* Live Timer Pill */}
            <div className="task-timer-pill" title="Elapsed Time">
              <span className="task-live-dot" />
              <span className="task-timer-text">{formatTime(seconds)}</span>
            </div>

            {/* Quick Stop Button */}
            <button
              onClick={handleStop}
              className="task-stop-btn"
              title="Stop and abort current generation"
            >
              <Square size={11} fill="currentColor" />
              <span>Stop</span>
            </button>
          </div>
        </div>

        {/* Hero Active Stage Banner */}
        <div className="task-hero-stage">
          <div className="stage-icon-box">
            {isTool ? (
              <Wrench size={18} className="stage-icon icon-tool" />
            ) : isRouter ? (
              <Cpu size={18} className="stage-icon icon-router" />
            ) : isSubagent ? (
              <Network size={18} className="stage-icon icon-subagent" />
            ) : isSynthesizing ? (
              <Sparkles size={18} className="stage-icon icon-sparkle" />
            ) : (
              <Loader2 size={18} className="stage-icon icon-spin" />
            )}
          </div>
          
          <div className="stage-content">
            <div className="stage-label">
              {isTool ? 'Tool Action in Progress' : 
               isRouter ? 'Inference & Neural Routing' : 
               isSubagent ? 'Delegated Sub-Agent' : 
               isSynthesizing ? 'Formulating Response' : 
               'Active Task'}
            </div>
            <div className="stage-message">
              {activeMessage}
            </div>
          </div>
        </div>

        {/* Live Step Timeline (if steps exist) */}
        {steps && steps.length > 0 && (
          <div className="task-steps-wrapper">
            <div className="task-steps-header" onClick={() => setShowAllSteps(!showAllSteps)}>
              <span className="steps-title">
                Activity Stream ({steps.filter(s => s.status === 'completed').length}/{steps.length} steps)
              </span>
              <button type="button" className="steps-toggle-btn">
                {showAllSteps ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {showAllSteps && (
              <div className="task-steps-list">
                {steps.map((step, idx) => (
                  <div key={step.id || idx} className={`task-step-item ${step.status}`}>
                    <div className="step-indicator">
                      {step.status === 'completed' ? (
                        <CheckCircle2 size={14} className="step-icon-success" />
                      ) : step.status === 'running' ? (
                        <span className="step-spinner" />
                      ) : step.status === 'error' ? (
                        <AlertTriangle size={14} className="step-icon-error" />
                      ) : (
                        <span className="step-dot-pending" />
                      )}
                    </div>
                    <div className="step-details">
                      <div className="step-title-row">
                        <span className="step-title-text">{step.title}</span>
                        {step.durationMs ? (
                          <span className="step-duration">{(step.durationMs / 1000).toFixed(1)}s</span>
                        ) : null}
                      </div>
                      {step.detail && (
                        <div className="step-subdetail">{step.detail}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Telemetry / Live Terminal Output Preview */}
        {recentLogs.length > 0 && (
          <div className="task-telemetry-box">
            <div 
              className="telemetry-header" 
              onClick={() => setShowTelemetry(!showTelemetry)}
            >
              <div className="telemetry-title">
                <Terminal size={11} />
                <span>Live Telemetry</span>
                <span className="telemetry-count">{recentLogs.length} events</span>
              </div>
              <button type="button" className="telemetry-toggle-btn">
                {showTelemetry ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>

            {showTelemetry ? (
              <div className="telemetry-logs-expanded">
                {recentLogs.map((log) => (
                  <div key={log.id} className={`telemetry-row ${log.level}`}>
                    <span className="telemetry-time">
                      [{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                    </span>
                    <span className="telemetry-msg">{log.message}</span>
                  </div>
                ))}
              </div>
            ) : lastLog ? (
              <div className="telemetry-row-collapsed">
                <span className="telemetry-preview-tag">{lastLog.type || 'info'}</span>
                <span className="telemetry-preview-text">{lastLog.message}</span>
              </div>
            ) : null}
          </div>
        )}

        {/* Slow / Stuck Operation Alert */}
        {isDelayed && (
          <div className={`task-delay-alert ${isCritical ? 'critical' : isStuck ? 'stuck' : 'delayed'}`}>
            <div className="delay-alert-row">
              <div className="delay-alert-msg">
                <AlertTriangle size={14} />
                <span>
                  {isCritical 
                    ? 'Operation has taken over 90s. The remote server or tool may be unresponsive.' 
                    : isStuck 
                    ? 'Operation in progress (>60s). Large models or browser automation can take extra time.'
                    : 'Still running (>25s)...'}
                </span>
              </div>
              <div className="delay-alert-actions">
                <button onClick={handleStop} className="delay-abort-btn">
                  {isCritical ? 'Force Abort' : 'Cancel Task'}
                </button>
                {isCritical && (
                  <button onClick={() => window.location.reload()} className="delay-reload-btn">
                    Reload Page
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
