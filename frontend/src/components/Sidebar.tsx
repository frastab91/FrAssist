import React from 'react';
import { Plus, Bot, Brain } from 'lucide-react';
import type { Agent, SystemStats } from '../types';
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
  onUsageClick: () => void;
};

export function Sidebar({
  setShowCreateModal,
  activeAgents,
  selectedAgentId,
  setSelectedAgentId,
  setShowInspector,
  socket,
  ollamaStatus,
  systemStats,
  onUsageClick,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Agent Tracker</h2>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="add-agent-btn"
          style={{ 
            background: '#3b82f6', 
            color: 'white', 
            border: 'none', 
            borderRadius: '50%', 
            width: '28px', 
            height: '28px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="agent-list" style={{ flex: 1, overflowY: 'auto' }}>
        {activeAgents.map((agent) => (
          <div 
            key={agent.id} 
            className={`agent-card ${selectedAgentId === agent.id ? 'active' : ''}`}
            onClick={() => {
              setSelectedAgentId(agent.id);
              setShowInspector(true);
              socket?.emit('request_agent_details', { agentId: agent.id });
            }}
          >
            <div className="agent-header">
              <div className="agent-info">
                <div className="agent-icon">{agent.icon}</div>
                <div>
                  <div className="agent-name">{agent.name}</div>
                  <div className="agent-role">{agent.role}</div>
                </div>
              </div>
              <div className={`status-indicator ${agent.status}`}></div>
            </div>
          </div>
        ))}
      </div>

      {ollamaStatus && (
        <div className="ollama-monitor shadow-sm" style={{ margin: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <span>Local LLM Status</span>
            <span style={{ color: '#4ade80' }}>● Live</span>
          </div>
          {ollamaStatus.models?.map((m: any, i: number) => (
            <div key={i} style={{ marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9' }}>{m.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8' }}>
                <span>Size: {m.size}</span>
                <span>Used: {m.size}</span>
              </div>
            </div>
          )) || <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>No models active</div>}
        </div>
      )}

      <div 
        className="system-usage shadow-sm" 
        style={{ margin: '1rem', padding: '0.75rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.1)', cursor: 'pointer', transition: 'all 0.2s ease' }}
        onClick={onUsageClick}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
        onMouseLeave={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)'}
      >
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#3b82f6', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Brain size={12} /> Cumulative Usage
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
            <div style={{ fontWeight: 600, color: '#334155' }}>{(systemStats.total_input_tokens / 1000).toFixed(1)}k</div>
            In Tokens
          </div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
            <div style={{ fontWeight: 600, color: '#334155' }}>{(systemStats.total_output_tokens / 1000).toFixed(1)}k</div>
            Out Tokens
          </div>
        </div>
        <div style={{ marginTop: '0.5rem', fontSize: '0.65rem', color: '#94a3b8', textAlign: 'right' }}>
          Total Requests: {systemStats.total_requests}
        </div>
      </div>
    </aside>
  );
}
