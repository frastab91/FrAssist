import { Plus, Bot, Brain, Trash2, Settings, MessageSquare, Send, Globe, Clock, Loader2 } from 'lucide-react';
import type { Agent, SystemStats, ChatSession } from '../types';
import { Socket } from 'socket.io-client';

type SidebarProps = {
  setShowCreateModal: (show: boolean) => void;
  activeAgents: Agent[];
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  setShowInspector: (show: boolean) => void;
  socket: Socket | null;
  ollamaStatus: any;
  systemStats: SystemStats;
  heartbeat: any;
  onUsageClick: () => void;
  // Session & Channel props
  activeChannel: 'web' | 'whatsapp' | 'telegram' | 'agent';
  setActiveChannel: (channel: 'web' | 'whatsapp' | 'telegram' | 'agent') => void;
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  sessions: ChatSession[];
  sessionWorkingMap?: Record<string, boolean>;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenWhatsApp: () => void;
  whatsappConnected: boolean;
};

function formatRelativeTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (isNaN(diffSec) || diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 172800) return 'Yesterday';
    return `${Math.floor(diffSec / 86400)}d ago`;
  } catch (e) {
    return '';
  }
}

export function Sidebar({
  setShowCreateModal,
  activeAgents,
  selectedAgentId,
  setSelectedAgentId,
  setShowInspector,
  socket,
  ollamaStatus,
  systemStats,
  heartbeat,
  onUsageClick,
  activeChannel,
  setActiveChannel,
  activeSessionId,
  setActiveSessionId,
  sessions,
  sessionWorkingMap = {},
  onNewChat,
  onDeleteSession,
  onOpenWhatsApp,
  whatsappConnected,
}: SidebarProps) {
  const handleDeleteAgent = (e: React.MouseEvent, agentId: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete ${agentId}?`)) {
      socket?.emit('delete_agent', { agentId });
      if (selectedAgentId === agentId) {
        setSelectedAgentId(null);
      }
    }
  };

  const handleInspectAgent = (e: React.MouseEvent, agentId: string) => {
    e.stopPropagation();
    setSelectedAgentId(agentId);
    setShowInspector(true);
    socket?.emit('request_agent_details', { agentId });
  };

  return (
    <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="sidebar-header" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={24} className="brand-icon" color="#3b82f6" />
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>FrAssist</h2>
        </div>
        <button 
          onClick={onNewChat}
          className="add-btn"
          title="Start New Chat Session"
          style={{
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '0.4rem 0.6rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(59,130,246,0.3)'
          }}
        >
          <Plus size={14} /> New
        </button>
      </div>

      {/* Scrollable Navigation Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* 1. CHANNELS SECTION */}
        <div className="sidebar-section">
          <h3 className="section-title" style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>
            Channels & Workspaces
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {/* Web Workspace */}
            <div 
              className={`menu-item ${activeChannel === 'web' && !selectedAgentId ? 'active' : ''}`}
              onClick={() => {
                setActiveChannel('web');
                setSelectedAgentId(null);
              }}
              style={{ padding: '0.5rem 0.6rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Globe size={16} color="#3b82f6" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Web Workspace</span>
              </div>
              <span style={{ fontSize: '0.65rem', background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: '10px', fontWeight: 600 }}>Main</span>
            </div>

            {/* WhatsApp Channel */}
            <div 
              className={`menu-item ${activeChannel === 'whatsapp' ? 'active' : ''}`}
              onClick={() => {
                setActiveChannel('whatsapp');
                setSelectedAgentId(null);
                onOpenWhatsApp();
              }}
              style={{ padding: '0.5rem 0.6rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <MessageSquare size={16} color="#25D366" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>WhatsApp</span>
              </div>
              <span style={{
                fontSize: '0.65rem',
                background: whatsappConnected ? '#dcfce7' : '#f1f5f9',
                color: whatsappConnected ? '#15803d' : '#64748b',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: whatsappConnected ? '#22c55e' : '#94a3b8' }}></span>
                {whatsappConnected ? 'Paired' : 'Pair'}
              </span>
            </div>

            {/* Telegram Channel */}
            <div 
              className={`menu-item ${activeChannel === 'telegram' ? 'active' : ''}`}
              onClick={() => {
                setActiveChannel('telegram');
                setSelectedAgentId(null);
              }}
              style={{ padding: '0.5rem 0.6rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Send size={16} color="#0088cc" />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Telegram Bot</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. AGENTS DIRECT SESSIONS */}
        <div className="sidebar-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <h3 className="section-title" style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
              Specialized Agents
            </h3>
            <button 
              onClick={() => setShowCreateModal(true)} 
              style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', padding: 0 }}
              title="Create Custom Agent"
            >
              <Plus size={14} />
            </button>
          </div>
          <div className="agent-menu" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {activeAgents.map((agent) => (
              <div 
                key={agent.id} 
                className={`menu-item ${selectedAgentId === agent.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedAgentId(agent.id);
                  setActiveChannel('agent');
                }}
                style={{ padding: '0.45rem 0.6rem', borderRadius: '8px', cursor: 'pointer' }}
              >
                <div className="item-main">
                  <div className="item-icon">
                    {agent.id === 'orchestrator' ? <Bot size={16} /> : agent.icon}
                    <span className={`status-dot ${agent.status}`}></span>
                  </div>
                  <div className="item-info">
                    <span className="item-name" style={{ fontSize: '0.82rem' }}>{agent.name}</span>
                    <span className="item-role" style={{ fontSize: '0.7rem' }}>{agent.role}</span>
                  </div>
                </div>
                
                <div className="item-actions">
                  <button 
                    className="action-btn" 
                    onClick={(e) => handleInspectAgent(e, agent.id)}
                    title="Agent Details"
                  >
                    <Settings size={13} />
                  </button>
                  {agent.id !== 'orchestrator' && (
                    <button 
                      className="action-btn delete" 
                      onClick={(e) => handleDeleteAgent(e, agent.id)}
                      title="Delete Agent"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. PAST CHATS / SESSIONS */}
        <div className="sidebar-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
            <h3 className="section-title" style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Clock size={12} /> Past Chats
            </h3>
            <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>7-day TTL</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {sessions.length === 0 ? (
              <div style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#94a3b8' }}>
                No past sessions yet
              </div>
            ) : (
              sessions.map((s) => {
                const isActive = activeSessionId === s.id;
                return (
                  <div
                    key={s.id}
                    className={`menu-item ${isActive ? 'active' : ''}`}
                    onClick={() => {
                      setActiveSessionId(s.id);
                      socket?.emit('load_session', { sessionId: s.id });
                    }}
                    style={{
                      padding: '0.5rem 0.6rem',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      border: isActive ? '1px solid #bfdbfe' : '1px solid transparent'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#1d4ed8' : '#334155',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '180px'
                      }}>
                        {s.title}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm('Delete this chat session?')) {
                            onDeleteSession(s.id);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Delete Session"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.65rem', color: '#94a3b8' }}>
                      {sessionWorkingMap[s.id] ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.62rem',
                          color: '#2563eb',
                          background: '#eff6ff',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 600
                        }}>
                          <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> Running
                        </span>
                      ) : (
                        <span>{formatRelativeTime(s.updatedAt)}</span>
                      )}
                      
                      {/* Sub-agent tags */}
                      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                        {s.subagentsUsed && s.subagentsUsed.map((agentId) => {
                          const agentName = activeAgents.find(a => a.id === agentId)?.name || agentId;
                          return (
                            <span 
                              key={agentId}
                              style={{
                                background: agentId === 'orchestrator' ? '#f1f5f9' : '#eff6ff',
                                color: agentId === 'orchestrator' ? '#475569' : '#2563eb',
                                padding: '1px 4px',
                                borderRadius: '4px',
                                fontSize: '0.6rem',
                                fontWeight: 600,
                                textTransform: 'capitalize'
                              }}
                            >
                              {agentName}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div style={{ padding: '0.4rem 0.2rem', fontSize: '0.62rem', color: '#94a3b8', textAlign: 'center' }}>
            Chats auto-clean after 7 days of inactivity
          </div>
        </div>

      </div>

      {/* Footer System Health & Usage */}
      <div className="sidebar-footer" style={{ padding: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
        {heartbeat && (
          <div className="footer-card heartbeat" style={{ marginBottom: '0.5rem' }}>
            <div className="card-header">
              <span className="status-label">SYSTEM HEALTH</span>
              <span className="live-dot pulse">●</span>
            </div>
            <div className="heartbeat-stats">
              <div className="stat-mini">
                <span className="mini-label">CPU</span>
                <span className="mini-val">{heartbeat.cpu?.[0]?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="stat-mini">
                <span className="mini-label">MEM</span>
                <span className="mini-val">{heartbeat.mem?.usage?.toFixed(0) || '0'}%</span>
              </div>
              <div className="stat-mini">
                <span className="mini-label">UP</span>
                <span className="mini-val">{((heartbeat.uptime || 0) / 3600).toFixed(1)}h</span>
              </div>
            </div>
          </div>
        )}

        {ollamaStatus && (
          <div className="footer-card ollama" style={{ marginBottom: '0.5rem' }}>
            <div className="card-header">
              <span className="status-label">LLM STATUS</span>
              <span className="live-dot" style={{ color: ollamaStatus.status === 'Running' ? '#22c55e' : '#ef4444' }}>●</span>
            </div>
            <div className="model-list">
              {ollamaStatus.models?.map((m: any, i: number) => (
                <div key={i} className="model-item" style={{ fontSize: '0.7rem' }}>
                  <span className="model-name">{m.name}</span>
                </div>
              )) || <span className="no-models" style={{ fontSize: '0.7rem' }}>Ollama Active</span>}
            </div>
          </div>
        )}

        <div 
          className="footer-card usage"
          onClick={onUsageClick}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-header">
            <span className="usage-label"><Brain size={12} /> CUMULATIVE USAGE</span>
          </div>
          <div className="usage-grid">
            <div className="usage-stat">
              <span className="stat-val">{(systemStats.total_input_tokens / 1000).toFixed(1)}k</span>
              <span className="stat-label">In</span>
            </div>
            <div className="usage-stat">
              <span className="stat-val">{(systemStats.total_output_tokens / 1000).toFixed(1)}k</span>
              <span className="stat-label">Out</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
