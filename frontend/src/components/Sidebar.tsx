import React, { useState } from 'react';
import { Plus, Bot, Brain, Trash2, Settings, MessageSquare } from 'lucide-react';
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
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand">
          <Bot size={24} className="brand-icon" />
          <h2>FrAssist</h2>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="add-btn"
          title="Create New Agent"
        >
          <Plus size={18} />
        </button>
      </div>

      <div className="sidebar-section">
        <h3 className="section-title">Active Agents</h3>
        <div className="agent-menu">
          {activeAgents.map((agent) => (
            <div 
              key={agent.id} 
              className={`menu-item ${selectedAgentId === agent.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedAgentId(agent.id);
                // Optionally auto-inspect or just select
              }}
            >
              <div className="item-main">
                <div className="item-icon">
                  {agent.id === 'orchestrator' ? <Bot size={16} /> : agent.icon}
                  <span className={`status-dot ${agent.status}`}></span>
                </div>
                <div className="item-info">
                  <span className="item-name">{agent.name}</span>
                  <span className="item-role">{agent.role}</span>
                </div>
              </div>
              
              <div className="item-actions">
                <button 
                  className="action-btn" 
                  onClick={(e) => handleInspectAgent(e, agent.id)}
                  title="Agent Details"
                >
                  <Settings size={14} />
                </button>
                {agent.id !== 'orchestrator' && (
                  <button 
                    className="action-btn delete" 
                    onClick={(e) => handleDeleteAgent(e, agent.id)}
                    title="Delete Agent"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sidebar-footer">
        {ollamaStatus && (
          <div className="footer-card ollama">
            <div className="card-header">
              <span className="status-label">LLM STATUS</span>
              <span className="live-dot">●</span>
            </div>
            <div className="model-list">
              {ollamaStatus.models?.map((m: any, i: number) => (
                <div key={i} className="model-item">
                  <span className="model-name">{m.name}</span>
                  <span className="model-size">{m.size}</span>
                </div>
              )) || <span className="no-models">No active models</span>}
            </div>
          </div>
        )}

        <div 
          className="footer-card usage"
          onClick={onUsageClick}
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

