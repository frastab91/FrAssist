import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  X, 
  Bot, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Play, 
  Pause, 
  Trash2, 
  Edit3, 
  Activity, 
  Plus, 
  RefreshCw, 
  Square,
  ChevronRight,
  ChevronDown,
  Calendar,
  Eye,
  Loader2,
  MessageSquare,
  Search
} from 'lucide-react';
import type { TrackerOverview } from '../types';
import { Socket } from 'socket.io-client';
import { formatCronDescription } from '../lib/cronFormatter';

type MissionControlModalProps = {
  isOpen: boolean;
  onClose: () => void;
  trackerData: TrackerOverview;
  onRefresh: () => void;
  socket: Socket | null;
  onInspectAgent?: (agentId: string) => void;
  onSelectSession?: (sessionId: string) => void;
};

export function MissionControlModal({
  isOpen,
  onClose,
  trackerData,
  onRefresh,
  socket,
  onInspectAgent,
  onSelectSession,
}: MissionControlModalProps) {
  const [activeTab, setActiveTab] = useState<'agents' | 'approvals' | 'crons'>('agents');
  
  // Approval state
  const [editingApprovalId, setEditingApprovalId] = useState<number | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [approvalNotes, setApprovalNotes] = useState<{ [id: number]: string }>({});
  const [isSubmittingApproval, setIsSubmittingApproval] = useState<number | null>(null);

  // Expanded task previews
  const [expandedTasks, setExpandedTasks] = useState<{ [agentId: string]: boolean }>({});

  // Triggering job tracking
  const [triggeringJobIds, setTriggeringJobIds] = useState<Set<number>>(new Set());

  // New Cron Form state
  const [showNewJobModal, setShowNewJobModal] = useState(false);
  const [newJobName, setNewJobName] = useState('');
  const [newJobCron, setNewJobCron] = useState('0 8 * * *');
  const [newJobTask, setNewJobTask] = useState('');
  const [newJobAgent, setNewJobAgent] = useState('orchestrator');
  const [isSubmittingJob, setIsSubmittingJob] = useState(false);

  // Edit Cron Form state
  const [editingJob, setEditingJob] = useState<{
    id: number;
    name: string;
    cron: string;
    task: string;
    agentId: string;
  } | null>(null);
  const [isUpdatingJob, setIsUpdatingJob] = useState(false);

  // Search & filter state for crons
  const [cronSearchQuery, setCronSearchQuery] = useState('');
  const [cronStatusFilter, setCronStatusFilter] = useState<'all' | 'active' | 'paused'>('all');

  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionSessionId, setActionSessionId] = useState<string | null>(null);

  if (!isOpen) return null;

  const showNotification = (msg: string, sessionId?: string | null) => {
    setActionMessage(msg);
    setActionSessionId(sessionId || null);
    setTimeout(() => {
      setActionMessage(null);
      setActionSessionId(null);
    }, 7000);
  };

  const handleApprovalAction = async (id: number, action: 'approve' | 'reject' | 'edit') => {
    setIsSubmittingApproval(id);
    try {
      const res = await fetch(`/api/approvals/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          editedContent: editingApprovalId === id ? editedContent : undefined,
          notes: approvalNotes[id] || undefined
        })
      });
      if (res.ok) {
        showNotification(`Approval #${id} marked as ${action.toUpperCase()}`);
        setEditingApprovalId(null);
        onRefresh();
      }
    } catch (err: any) {
      showNotification(`Action failed: ${err.message}`);
    } finally {
      setIsSubmittingApproval(null);
    }
  };

  const handleCancelAgent = async (agentId: string) => {
    if (socket) {
      socket.emit('cancel_agent_task', { agentId });
      showNotification(`Sent cancellation signal to ${agentId}`);
      onRefresh();
    } else {
      try {
        await fetch(`/api/agents/${agentId}/cancel`, { method: 'POST' });
        showNotification(`Agent ${agentId} task cancelled`);
        onRefresh();
      } catch (err: any) {
        showNotification(`Failed to cancel agent: ${err.message}`);
      }
    }
  };

  const handleTriggerJob = async (job: { id: number; name?: string; agentId?: string }) => {
    setTriggeringJobIds(prev => new Set(prev).add(job.id));
    showNotification(`🚀 Initializing "${job.name || `Job #${job.id}`}"...`);
    try {
      const res = await fetch(`/api/jobs/${job.id}/run-now`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        showNotification(
          `🚀 Running "${job.name || `Job #${job.id}`}"! Dedicated chat session active.`,
          data.sessionId || null
        );
        onRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showNotification(`Failed to trigger job: ${data.error || res.statusText}`);
      }
    } catch (err: any) {
      showNotification(`Failed to trigger job: ${err.message}`);
    } finally {
      setTimeout(() => {
        setTriggeringJobIds(prev => {
          const next = new Set(prev);
          next.delete(job.id);
          return next;
        });
      }, 1500);
    }
  };

  const handleToggleJob = async (jobId: number) => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/toggle`, { method: 'POST' });
      if (res.ok) {
        showNotification(`Job #${jobId} status toggled`);
        onRefresh();
      }
    } catch (err: any) {
      showNotification(`Failed to toggle job: ${err.message}`);
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (!window.confirm(`Are you sure you want to delete job #${jobId}?`)) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
      if (res.ok) {
        showNotification(`Job #${jobId} deleted`);
        onRefresh();
      }
    } catch (err: any) {
      showNotification(`Failed to delete job: ${err.message}`);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJobName || !newJobCron || !newJobTask) {
      alert('Please fill out all fields');
      return;
    }
    setIsSubmittingJob(true);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newJobName,
          cron: newJobCron,
          task: newJobTask,
          agentId: newJobAgent
        })
      });
      if (res.ok) {
        showNotification(`Scheduled new job: "${newJobName}"`);
        setShowNewJobModal(false);
        setNewJobName('');
        setNewJobTask('');
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create job');
      }
    } catch (err: any) {
      alert(`Error creating job: ${err.message}`);
    } finally {
      setIsSubmittingJob(false);
    }
  };

  const handleStartEditJob = (job: any) => {
    setShowNewJobModal(false);
    setEditingJob({
      id: job.id,
      name: job.name || '',
      cron: job.cron || '0 8 * * *',
      task: job.task || '',
      agentId: job.agentId || 'orchestrator'
    });
  };

  const handleUpdateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingJob) return;
    if (!editingJob.name || !editingJob.cron || !editingJob.task) {
      alert('Please fill out all fields');
      return;
    }
    setIsUpdatingJob(true);
    try {
      const res = await fetch(`/api/jobs/${editingJob.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingJob.name,
          cron: editingJob.cron,
          task: editingJob.task,
          agentId: editingJob.agentId
        })
      });
      if (res.ok) {
        showNotification(`Updated cron job: "${editingJob.name}"`);
        setEditingJob(null);
        onRefresh();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update job');
      }
    } catch (err: any) {
      alert(`Error updating job: ${err.message}`);
    } finally {
      setIsUpdatingJob(false);
    }
  };

  const workingAgentsCount = (trackerData.agents || []).filter(a => a.status === 'working' || a.status === 'waiting_approval').length;
  const pendingApprovalsCount = (trackerData.pendingApprovals || []).filter(a => a.status === 'pending').length;

  const allJobs = trackerData.jobs || [];

  const filteredJobs = useMemo(() => {
    return allJobs.filter(job => {
      if (cronStatusFilter !== 'all' && job.status !== cronStatusFilter) {
        return false;
      }
      if (!cronSearchQuery.trim()) return true;
      const q = cronSearchQuery.toLowerCase().trim();

      const nameMatch = (job.name || '').toLowerCase().includes(q);
      const taskMatch = (job.task || '').toLowerCase().includes(q);
      const agentMatch = (job.agentId || '').toLowerCase().includes(q);
      const cronMatch = (job.cron || '').toLowerCase().includes(q);
      const descMatch = formatCronDescription(job.cron).toLowerCase().includes(q);
      const statusMatch = (job.status || '').toLowerCase().includes(q);

      return nameMatch || taskMatch || agentMatch || cronMatch || descMatch || statusMatch;
    });
  }, [allJobs, cronSearchQuery, cronStatusFilter]);

  const activeJobsCount = useMemo(() => {
    return allJobs.filter(j => j.status === 'active').length;
  }, [allJobs]);

  const pausedJobsCount = useMemo(() => {
    return allJobs.filter(j => j.status === 'paused').length;
  }, [allJobs]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content tracker-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '920px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.35)'
            }}>
              <Activity size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.01em', color: '#ffffff' }}>Mission Control</h2>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#93c5fd',
                  border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>
                  OPS CENTER
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                Live agent tracking, human-in-the-loop approvals, and background schedulers
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={onRefresh}
              title="Refresh State"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#e2e8f0',
                padding: '0.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#e2e8f0',
                padding: '0.5rem',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Action notification toast */}
        {actionMessage && (
          <div style={{
            background: '#eff6ff',
            color: '#1e40af',
            padding: '0.65rem 1.25rem',
            fontSize: '0.85rem',
            fontWeight: 500,
            borderBottom: '1px solid #bfdbfe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={16} color="#2563eb" style={{ flexShrink: 0 }} />
              <span>{actionMessage}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {actionSessionId && onSelectSession && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectSession(actionSessionId);
                    onClose();
                  }}
                  style={{
                    padding: '3px 9px',
                    borderRadius: '5px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    boxShadow: '0 1px 3px rgba(37,99,235,0.25)'
                  }}
                  title="Open dedicated chat session to interact live"
                >
                  <MessageSquare size={12} />
                  Open Live Chat Session
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setActionMessage(null);
                  setActionSessionId(null);
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div style={{
          display: 'flex',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 1rem'
        }}>
          <button
            onClick={() => setActiveTab('agents')}
            style={{
              padding: '0.85rem 1.25rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: activeTab === 'agents' ? 600 : 500,
              color: activeTab === 'agents' ? '#2563eb' : '#64748b',
              borderBottom: activeTab === 'agents' ? '2px solid #2563eb' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            <Bot size={17} />
            <span>Active Agents & Tasks</span>
            {workingAgentsCount > 0 && (
              <span style={{
                fontSize: '0.7rem',
                padding: '2px 7px',
                borderRadius: '10px',
                background: '#dbeafe',
                color: '#1d4ed8',
                fontWeight: 700
              }}>
                {workingAgentsCount} Active
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('approvals')}
            style={{
              padding: '0.85rem 1.25rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: activeTab === 'approvals' ? 600 : 500,
              color: activeTab === 'approvals' ? '#ea580c' : '#64748b',
              borderBottom: activeTab === 'approvals' ? '2px solid #ea580c' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            <Clock size={17} />
            <span>Waiting On & Approvals</span>
            {pendingApprovalsCount > 0 && (
              <span style={{
                fontSize: '0.7rem',
                padding: '2px 7px',
                borderRadius: '10px',
                background: '#ffedd5',
                color: '#c2410c',
                fontWeight: 700
              }}>
                {pendingApprovalsCount} Waiting
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('crons')}
            style={{
              padding: '0.85rem 1.25rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: activeTab === 'crons' ? 600 : 500,
              color: activeTab === 'crons' ? '#059669' : '#64748b',
              borderBottom: activeTab === 'crons' ? '2px solid #059669' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}
          >
            <Calendar size={17} />
            <span>Crons & Schedulers</span>
            <span style={{
              fontSize: '0.7rem',
              padding: '2px 7px',
              borderRadius: '10px',
              background: '#e2e8f0',
              color: '#475569',
              fontWeight: 600
            }}>
              {(trackerData.jobs || []).length}
            </span>
          </button>
        </div>

        {/* Tab Body */}
        <div style={{
          padding: '1.5rem',
          overflowY: 'auto',
          flex: 1,
          background: '#f8fafc'
        }}>
          {/* TAB 1: AGENTS & TASKS */}
          {activeTab === 'agents' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                  Showing {(trackerData.agents || []).length} registered agents ({workingAgentsCount} running or awaiting review)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                {(trackerData.agents || []).map(agent => {
                  const isWorking = agent.status === 'working';
                  const isWaitingApproval = agent.status === 'waiting_approval';
                  const isExpanded = !!expandedTasks[agent.id];

                  return (
                    <div 
                      key={agent.id}
                      style={{
                        background: '#ffffff',
                        borderRadius: '12px',
                        border: isWorking ? '1px solid #93c5fd' : isWaitingApproval ? '1px solid #fdba74' : '1px solid #e2e8f0',
                        boxShadow: isWorking ? '0 4px 12px rgba(59, 130, 246, 0.08)' : '0 1px 3px rgba(0,0,0,0.05)',
                        padding: '1.25rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '10px',
                            background: isWorking ? '#dbeafe' : isWaitingApproval ? '#ffedd5' : '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative'
                          }}>
                            <Bot size={22} color={isWorking ? '#2563eb' : isWaitingApproval ? '#ea580c' : '#64748b'} />
                            <span 
                              style={{
                                position: 'absolute',
                                bottom: '-2px',
                                right: '-2px',
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: isWorking ? '#22c55e' : isWaitingApproval ? '#f97316' : '#94a3b8',
                                border: '2px solid #ffffff'
                              }}
                            />
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#0f172a' }}>
                                {agent.name}
                              </h3>
                              <span style={{
                                fontSize: '0.75rem',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: isWorking ? '#dcfce7' : isWaitingApproval ? '#fef3c7' : '#f1f5f9',
                                color: isWorking ? '#15803d' : isWaitingApproval ? '#b45309' : '#64748b',
                                fontWeight: 600,
                                textTransform: 'uppercase'
                              }}>
                                {agent.status}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                              Role: <span style={{ fontWeight: 500, color: '#334155' }}>{agent.role}</span> • ID: <code style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '1px 4px', borderRadius: '4px' }}>{agent.id}</code>
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {isWorking && (
                            <button
                              onClick={() => handleCancelAgent(agent.id)}
                              style={{
                                padding: '0.4rem 0.8rem',
                                background: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fca5a5',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = '#fecaca')}
                              onMouseLeave={e => (e.currentTarget.style.background = '#fee2e2')}
                            >
                              <Square size={13} fill="#b91c1c" />
                              Cancel Task
                            </button>
                          )}

                          {onInspectAgent && (
                            <button
                              onClick={() => onInspectAgent(agent.id)}
                              style={{
                                padding: '0.4rem 0.8rem',
                                background: '#f8fafc',
                                color: '#475569',
                                border: '1px solid #cbd5e1',
                                borderRadius: '8px',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem'
                              }}
                            >
                              <Eye size={14} />
                              Inspector
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Current Task Box */}
                      {agent.currentTask && (
                        <div style={{ marginTop: '0.85rem' }}>
                          <button
                            onClick={() => setExpandedTasks(prev => ({ ...prev, [agent.id]: !prev[agent.id] }))}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              color: '#3b82f6',
                              fontWeight: 500,
                              padding: 0
                            }}
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span>{isExpanded ? 'Hide Task Prompt' : 'View Current Task Prompt'}</span>
                          </button>

                          {isExpanded && (
                            <div style={{
                              marginTop: '0.5rem',
                              padding: '0.75rem 1rem',
                              background: '#f8fafc',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                              fontSize: '0.85rem',
                              color: '#334155',
                              maxHeight: '180px',
                              overflowY: 'auto'
                            }}>
                              <ReactMarkdown>{agent.currentTask}</ReactMarkdown>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: WAITING ON & APPROVALS */}
          {activeTab === 'approvals' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                  Review and sign off on drafts, content, and agent actions requiring human approval.
                </span>
              </div>

              {(trackerData.pendingApprovals || []).length === 0 ? (
                <div style={{
                  padding: '3rem 1rem',
                  textAlign: 'center',
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}>
                  <CheckCircle2 size={40} color="#22c55e" style={{ margin: '0 auto 0.75rem auto', display: 'block' }} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 600 }}>All Caught Up!</h3>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                    No drafts or agent decisions are currently waiting for your review.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {(trackerData.pendingApprovals || []).map(approval => {
                    const isPending = approval.status === 'pending';
                    const isEditing = editingApprovalId === approval.id;
                    const isSubmitting = isSubmittingApproval === approval.id;

                    return (
                      <div 
                        key={approval.id}
                        style={{
                          background: '#ffffff',
                          borderRadius: '12px',
                          border: isPending ? '1px solid #f97316' : '1px solid #e2e8f0',
                          boxShadow: isPending ? '0 4px 12px rgba(249, 115, 22, 0.08)' : '0 1px 3px rgba(0,0,0,0.05)',
                          padding: '1.25rem',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {isPending && (
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '4px',
                            background: 'linear-gradient(90deg, #ea580c 0%, #f97316 100%)'
                          }} />
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>
                                {approval.title}
                              </h3>
                              <span style={{
                                fontSize: '0.7rem',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: isPending ? '#ffedd5' : approval.status === 'approved' ? '#dcfce7' : '#fee2e2',
                                color: isPending ? '#c2410c' : approval.status === 'approved' ? '#15803d' : '#b91c1c',
                                fontWeight: 700,
                                textTransform: 'uppercase'
                              }}>
                                {approval.status}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
                              Requested by <span style={{ fontWeight: 600, color: '#334155' }}>{approval.agentId}</span> • Type: <code>{approval.type}</code> • {new Date(approval.createdAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>

                        {approval.description && (
                          <p style={{ fontSize: '0.85rem', color: '#475569', margin: '0 0 0.75rem 0' }}>
                            {approval.description}
                          </p>
                        )}

                        {/* Content Viewer / Editor */}
                        <div style={{
                          background: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          padding: '1rem',
                          marginBottom: '1rem'
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>
                              {isEditing ? 'Edit Content' : 'Draft / Action Payload'}
                            </span>
                            {isPending && !isEditing && (
                              <button
                                onClick={() => {
                                  setEditingApprovalId(approval.id);
                                  setEditedContent(approval.content);
                                }}
                                style={{
                                  border: 'none',
                                  background: 'none',
                                  color: '#2563eb',
                                  fontSize: '0.8rem',
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.25rem'
                                }}
                              >
                                <Edit3 size={13} />
                                Edit Content
                              </button>
                            )}
                          </div>

                          {isEditing ? (
                            <textarea
                              value={editedContent}
                              onChange={(e) => setEditedContent(e.target.value)}
                              rows={8}
                              style={{
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                fontFamily: 'inherit',
                                fontSize: '0.85rem',
                                boxSizing: 'border-box'
                              }}
                            />
                          ) : (
                            <div style={{
                              maxHeight: '260px',
                              overflowY: 'auto',
                              fontSize: '0.85rem',
                              color: '#1e293b'
                            }}>
                              <ReactMarkdown>{approval.content}</ReactMarkdown>
                            </div>
                          )}
                        </div>

                        {/* Action Bar (Only for Pending items) */}
                        {isPending && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <div style={{ flex: 1, minWidth: '220px' }}>
                              <input
                                type="text"
                                placeholder="Optional review note or feedback..."
                                value={approvalNotes[approval.id] || ''}
                                onChange={(e) => setApprovalNotes(prev => ({ ...prev, [approval.id]: e.target.value }))}
                                style={{
                                  width: '100%',
                                  padding: '0.45rem 0.75rem',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  fontSize: '0.8rem',
                                  boxSizing: 'border-box'
                                }}
                              />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {isEditing && (
                                <button
                                  onClick={() => setEditingApprovalId(null)}
                                  disabled={isSubmitting}
                                  style={{
                                    padding: '0.5rem 0.85rem',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    background: '#ffffff',
                                    color: '#64748b',
                                    fontSize: '0.8rem',
                                    fontWeight: 500,
                                    cursor: 'pointer'
                                  }}
                                >
                                  Cancel Edit
                                </button>
                              )}

                              <button
                                onClick={() => handleApprovalAction(approval.id, 'reject')}
                                disabled={isSubmitting}
                                style={{
                                  padding: '0.5rem 0.9rem',
                                  borderRadius: '8px',
                                  border: '1px solid #fca5a5',
                                  background: '#fee2e2',
                                  color: '#b91c1c',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem'
                                }}
                              >
                                <XCircle size={15} />
                                Reject
                              </button>

                              <button
                                onClick={() => handleApprovalAction(approval.id, 'approve')}
                                disabled={isSubmitting}
                                style={{
                                  padding: '0.5rem 1.1rem',
                                  borderRadius: '8px',
                                  border: 'none',
                                  background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                  color: '#ffffff',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
                                }}
                              >
                                <CheckCircle2 size={15} />
                                {isEditing ? 'Save & Approve' : 'Approve & Continue'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CRONS & SCHEDULERS */}
          {activeTab === 'crons' && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.85rem',
                flexWrap: 'wrap',
                gap: '0.75rem'
              }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500 }}>
                  Manage recurring agent routines and background jobs
                </span>
                <button
                  onClick={() => setShowNewJobModal(true)}
                  style={{
                    padding: '0.45rem 0.9rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Plus size={15} />
                  New Cron Job
                </button>
              </div>

              {/* Search & Filter Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                background: '#ffffff',
                padding: '0.65rem 0.85rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
              }}>
                {/* Search Input */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '0.42rem 0.75rem',
                  flex: '1 1 300px',
                  minWidth: '220px'
                }}>
                  <Search size={15} color="#64748b" style={{ flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Search crons by name, task, agent, or schedule..."
                    value={cronSearchQuery}
                    onChange={(e) => setCronSearchQuery(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: '0.82rem',
                      width: '100%',
                      color: '#0f172a'
                    }}
                  />
                  {cronSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCronSearchQuery('')}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: '#94a3b8',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: '4px'
                      }}
                      title="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filter Pills and Showing Count */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{
                    display: 'flex',
                    background: '#f1f5f9',
                    borderRadius: '8px',
                    padding: '2px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <button
                      type="button"
                      onClick={() => setCronStatusFilter('all')}
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: cronStatusFilter === 'all' ? '#ffffff' : 'transparent',
                        color: cronStatusFilter === 'all' ? '#0f172a' : '#64748b',
                        fontWeight: cronStatusFilter === 'all' ? 600 : 500,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        boxShadow: cronStatusFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      All ({allJobs.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCronStatusFilter('active')}
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: cronStatusFilter === 'active' ? '#ffffff' : 'transparent',
                        color: cronStatusFilter === 'active' ? '#15803d' : '#64748b',
                        fontWeight: cronStatusFilter === 'active' ? 600 : 500,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        boxShadow: cronStatusFilter === 'active' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Active ({activeJobsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCronStatusFilter('paused')}
                      style={{
                        padding: '0.3rem 0.65rem',
                        borderRadius: '6px',
                        border: 'none',
                        background: cronStatusFilter === 'paused' ? '#ffffff' : 'transparent',
                        color: cronStatusFilter === 'paused' ? '#b45309' : '#64748b',
                        fontWeight: cronStatusFilter === 'paused' ? 600 : 500,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        boxShadow: cronStatusFilter === 'paused' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Paused ({pausedJobsCount})
                    </button>
                  </div>

                  {(cronSearchQuery || cronStatusFilter !== 'all') && (
                    <span style={{
                      fontSize: '0.75rem',
                      color: '#64748b',
                      whiteSpace: 'nowrap',
                      background: '#f8fafc',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0'
                    }}>
                      Showing <strong>{filteredJobs.length}</strong> of {allJobs.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Inline Form to Add New Cron Job */}
              {showNewJobModal && (
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #bfdbfe',
                  padding: '1.25rem',
                  marginBottom: '1.25rem',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.08)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>Schedule New Recurring Job</h3>
                    <button onClick={() => setShowNewJobModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}>
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleCreateJob} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Job Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Daily Market Briefing"
                        value={newJobName}
                        onChange={(e) => setNewJobName(e.target.value)}
                        required
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Target Agent</label>
                      <select
                        value={newJobAgent}
                        onChange={(e) => setNewJobAgent(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', background: 'white' }}
                      >
                        {(trackerData.agents || []).map(a => (
                          <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                        Cron Expression (Standard 5-part cron)
                      </label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder="e.g. 0 8 * * *"
                          value={newJobCron}
                          onChange={(e) => setNewJobCron(e.target.value)}
                          required
                          style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                        />
                        <button
                          type="button"
                          onClick={() => setNewJobCron('0 8 * * *')}
                          style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Daily 8AM
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewJobCron('0 * * * *')}
                          style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.75rem', cursor: 'pointer' }}
                        >
                          Hourly
                        </button>
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        <span>Schedule: <strong>{formatCronDescription(newJobCron)}</strong></span>
                      </div>
                    </div>

                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Task Prompt / Execution Instructions</label>
                      <textarea
                        rows={3}
                        placeholder="What should the agent do when triggered?"
                        value={newJobTask}
                        onChange={(e) => setNewJobTask(e.target.value)}
                        required
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                      />
                    </div>

                    <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowNewJobModal(false)}
                        style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmittingJob}
                        style={{ padding: '0.45rem 1rem', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#ffffff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {isSubmittingJob ? 'Saving...' : 'Save & Schedule'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Jobs List */}
              {allJobs.length === 0 ? (
                <div style={{
                  padding: '3rem 1rem',
                  textAlign: 'center',
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0'
                }}>
                  <Calendar size={40} color="#94a3b8" style={{ margin: '0 auto 0.75rem auto', display: 'block' }} />
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a', fontWeight: 600 }}>No Scheduled Crons</h3>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                    Click "+ New Cron Job" to schedule background tasks for your agents.
                  </p>
                </div>
              ) : filteredJobs.length === 0 ? (
                <div style={{
                  padding: '3rem 1.5rem',
                  textAlign: 'center',
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1.5px dashed #cbd5e1'
                }}>
                  <Search size={36} color="#94a3b8" style={{ margin: '0 auto 0.75rem auto', display: 'block' }} />
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 600 }}>No Matching Crons Found</h3>
                  <p style={{ margin: '0.35rem 0 1rem 0', fontSize: '0.82rem', color: '#64748b' }}>
                    {cronSearchQuery
                      ? <>No cron jobs match &ldquo;<strong>{cronSearchQuery}</strong>&rdquo;{cronStatusFilter !== 'all' ? ` with status &ldquo;${cronStatusFilter}&rdquo;` : ''}.</>
                      : <>No {cronStatusFilter} cron jobs found.</>}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCronSearchQuery('');
                      setCronStatusFilter('all');
                    }}
                    style={{
                      padding: '0.4rem 0.85rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      color: '#334155',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Reset Search & Filters
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {filteredJobs.map(job => {
                    const isActive = job.status === 'active';
                    const isEditingThisJob = editingJob && editingJob.id === job.id;

                    // Inline Editor for this specific job
                    if (isEditingThisJob) {
                      return (
                        <div 
                          key={job.id}
                          style={{
                            background: '#ffffff',
                            borderRadius: '12px',
                            border: '2px solid #2563eb',
                            padding: '1.25rem',
                            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.12)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                background: '#eff6ff',
                                color: '#2563eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <Edit3 size={15} />
                              </div>
                              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#1e293b' }}>
                                Edit Cron Job: {job.name || `#${job.id}`}
                              </h4>
                            </div>
                            <button 
                              type="button" 
                              onClick={() => setEditingJob(null)} 
                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b' }}
                            >
                              <X size={18} />
                            </button>
                          </div>

                          <form onSubmit={handleUpdateJob} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Job Name</label>
                              <input
                                type="text"
                                placeholder="e.g. Daily FT Digest"
                                value={editingJob.name}
                                onChange={(e) => setEditingJob({ ...editingJob, name: e.target.value })}
                                required
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box' }}
                              />
                            </div>

                            <div>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Target Agent</label>
                              <select
                                value={editingJob.agentId}
                                onChange={(e) => setEditingJob({ ...editingJob, agentId: e.target.value })}
                                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', background: 'white' }}
                              >
                                {(trackerData.agents || []).map(a => (
                                  <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                                ))}
                              </select>
                            </div>

                            <div style={{ gridColumn: 'span 2' }}>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                                Cron Schedule Expression
                              </label>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <input
                                  type="text"
                                  placeholder="e.g. 0 8 * * *"
                                  value={editingJob.cron}
                                  onChange={(e) => setEditingJob({ ...editingJob, cron: e.target.value })}
                                  required
                                  style={{ flex: 1, minWidth: '160px', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', fontFamily: 'monospace' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setEditingJob({ ...editingJob, cron: '0 8 * * *' })}
                                  style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.75rem', cursor: 'pointer' }}
                                >
                                  Daily 8AM
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingJob({ ...editingJob, cron: '0 9 * * 1-5' })}
                                  style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.75rem', cursor: 'pointer' }}
                                >
                                  Weekdays 9AM
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingJob({ ...editingJob, cron: '0 * * * *' })}
                                  style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.75rem', cursor: 'pointer' }}
                                >
                                  Hourly
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingJob({ ...editingJob, cron: '*/30 * * * *' })}
                                  style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.75rem', cursor: 'pointer' }}
                                >
                                  Every 30m
                                </button>
                              </div>
                              <div style={{ marginTop: '4px', fontSize: '0.75rem', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={12} />
                                <span>Schedule: <strong>{formatCronDescription(editingJob.cron)}</strong></span>
                              </div>
                            </div>

                            <div style={{ gridColumn: 'span 2' }}>
                              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Task Prompt / Execution Instructions</label>
                              <textarea
                                rows={5}
                                placeholder="What should the agent do when triggered?"
                                value={editingJob.task}
                                onChange={(e) => setEditingJob({ ...editingJob, task: e.target.value })}
                                required
                                style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem', boxSizing: 'border-box', lineHeight: 1.45 }}
                              />
                            </div>

                            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                              <button
                                type="button"
                                onClick={() => setEditingJob(null)}
                                style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#64748b', fontSize: '0.8rem', cursor: 'pointer' }}
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={isUpdatingJob}
                                style={{ padding: '0.45rem 1.1rem', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#ffffff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                              >
                                {isUpdatingJob ? 'Saving Changes...' : 'Save Changes'}
                              </button>
                            </div>
                          </form>
                        </div>
                      );
                    }

                    const isJobRunning = !!job.isRunning || triggeringJobIds.has(job.id);

                    return (
                      <div 
                        key={job.id}
                        style={{
                          background: isJobRunning ? '#f8faff' : '#ffffff',
                          borderRadius: '12px',
                          border: isJobRunning ? '1.5px solid #93c5fd' : '1px solid #e2e8f0',
                          boxShadow: isJobRunning ? '0 2px 10px rgba(59, 130, 246, 0.08)' : 'none',
                          padding: '1.1rem 1.25rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.65rem',
                          opacity: isActive ? 1 : 0.7,
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '1rem'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: '#0f172a' }}>
                                {job.name || 'Unnamed Job'}
                              </h4>
                              {isJobRunning ? (
                                <span style={{
                                  fontSize: '0.7rem',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #93c5fd',
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.3rem',
                                  boxShadow: '0 0 8px rgba(59, 130, 246, 0.2)'
                                }}>
                                  <Loader2 size={11} className="stage-icon icon-spin" style={{ color: '#2563eb' }} />
                                  RUNNING NOW
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '0.7rem',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  background: isActive ? '#dcfce7' : '#f1f5f9',
                                  color: isActive ? '#15803d' : '#64748b',
                                  fontWeight: 600,
                                  textTransform: 'uppercase'
                                }}>
                                  {job.status}
                                </span>
                              )}
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                border: '1px solid #bfdbfe',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.3rem'
                              }}>
                                <Clock size={12} />
                                {formatCronDescription(job.cron)}
                              </span>
                              <span style={{
                                fontSize: '0.7rem',
                                fontFamily: 'monospace',
                                background: '#f8fafc',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                border: '1px solid #e2e8f0',
                                color: '#64748b'
                              }} title="Raw cron expression">
                                {job.cron}
                              </span>
                            </div>

                            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.8rem', color: '#475569' }}>
                              Agent: <span style={{ fontWeight: 600 }}>{job.agentId || 'orchestrator'}</span> • Task: {job.task}
                            </p>

                            {job.lastRun && (
                              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
                                Last Run: {new Date(job.lastRun).toLocaleString()}
                              </p>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                              type="button"
                              disabled={isJobRunning}
                              onClick={() => handleTriggerJob(job)}
                              title={isJobRunning ? "Job is actively running in background" : "Run immediately in background"}
                              style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: '8px',
                                border: isJobRunning ? '1px solid #93c5fd' : '1px solid #bfdbfe',
                                background: isJobRunning ? '#dbeafe' : '#eff6ff',
                                color: isJobRunning ? '#1e40af' : '#1d4ed8',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: isJobRunning ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                boxShadow: isJobRunning ? '0 0 0 2px rgba(59, 130, 246, 0.15)' : 'none',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {isJobRunning ? (
                                <>
                                  <Loader2 size={12} className="stage-icon icon-spin" style={{ color: '#1e40af' }} />
                                  Running...
                                </>
                              ) : (
                                <>
                                  <Play size={12} fill="#1d4ed8" />
                                  Run Now
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditJob(job);
                              }}
                              title="Edit Job"
                              style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: '8px',
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#1e293b',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.3rem',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                              }}
                            >
                              <Edit3 size={13} color="#2563eb" />
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleJob(job.id)}
                              title={isActive ? 'Pause Job' : 'Resume Job'}
                              style={{
                                padding: '0.4rem 0.65rem',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0',
                                background: '#f8fafc',
                                color: '#475569',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                            >
                              {isActive ? <Pause size={14} /> : <Play size={14} />}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteJob(job.id)}
                              title="Delete Job"
                              style={{
                                padding: '0.4rem 0.65rem',
                                borderRadius: '8px',
                                border: '1px solid #fee2e2',
                                background: '#fff1f2',
                                color: '#e11d48',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {isJobRunning && (
                          <div style={{
                            padding: '0.5rem 0.85rem',
                            borderRadius: '8px',
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '0.6rem',
                            fontSize: '0.78rem',
                            color: '#1e40af'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: '220px' }}>
                              <Loader2 size={13} className="stage-icon icon-spin" style={{ color: '#2563eb', flexShrink: 0 }} />
                              <span>Executing now with agent <strong>{job.agentId || 'orchestrator'}</strong>.</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              {job.activeSessionId && onSelectSession && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onSelectSession(job.activeSessionId!);
                                    onClose();
                                  }}
                                  style={{
                                    padding: '4px 10px',
                                    borderRadius: '5px',
                                    border: 'none',
                                    background: '#2563eb',
                                    color: '#ffffff',
                                    fontSize: '0.73rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    boxShadow: '0 1px 3px rgba(37,99,235,0.25)'
                                  }}
                                  title="Open dedicated live chat session to view outputs & interact"
                                >
                                  <MessageSquare size={12} />
                                  Open Live Chat
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (onInspectAgent) {
                                    onInspectAgent(job.agentId || 'orchestrator');
                                  } else {
                                    setActiveTab('agents');
                                  }
                                }}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: '5px',
                                  border: '1px solid #93c5fd',
                                  background: '#ffffff',
                                  color: '#1d4ed8',
                                  fontSize: '0.73rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <Eye size={12} />
                                Inspect Agent
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
