import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, X, Shield, Terminal, Brain, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import type { AgentDetails } from '../types';

type AgentInspectorModalProps = {
  selectedAgentDetails: AgentDetails;
  setShowInspector: (show: boolean) => void;
  inspectorTab: 'rules' | 'skills' | 'schedule' | 'memory';
  setInspectorTab: (tab: 'rules' | 'skills' | 'schedule' | 'memory') => void;
};

export function AgentInspectorModal({
  selectedAgentDetails,
  setShowInspector,
  inspectorTab,
  setInspectorTab,
}: AgentInspectorModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-content inspector-modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Bot size={24} color="#3b82f6" />
            <div>
              <h2 style={{ margin: 0 }}>Agent Inspector</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{selectedAgentDetails.agentId}</p>
            </div>
          </div>
          <button onClick={() => setShowInspector(false)}><X size={20} /></button>
        </div>
        
        <div className="inspector-tabs">
          <button 
            className={inspectorTab === 'rules' ? 'active' : ''} 
            onClick={() => setInspectorTab('rules')}
          >
            <Shield size={14} /> Rules
          </button>
          <button 
            className={inspectorTab === 'skills' ? 'active' : ''} 
            onClick={() => setInspectorTab('skills')}
          >
            <Terminal size={14} /> Skills
          </button>
          <button 
            className={inspectorTab === 'schedule' ? 'active' : ''} 
            onClick={() => setInspectorTab('schedule')}
          >
            <Calendar size={14} /> Schedule {selectedAgentDetails.jobs && selectedAgentDetails.jobs.length > 0 ? `(${selectedAgentDetails.jobs.length})` : ''}
          </button>
          <button 
            className={inspectorTab === 'memory' ? 'active' : ''} 
            onClick={() => setInspectorTab('memory')}
          >
            <Brain size={14} /> Memory
          </button>
        </div>

        <div className="inspector-body">
          {inspectorTab === 'rules' && (
            <div className="inspector-pane">
              <ReactMarkdown>{selectedAgentDetails.rules}</ReactMarkdown>
            </div>
          )}
          {inspectorTab === 'skills' && (
            <div className="inspector-pane">
              <div className="skills-grid">
                {selectedAgentDetails.skills.map((skill: any, idx: number) => (
                  <div key={idx} className="skill-item">
                    <div className="skill-name">{skill.name}</div>
                    <div className="skill-desc">{skill.description}</div>
                    {skill.parameters?.properties && (
                      <div className="skill-params">
                        {Object.keys(skill.parameters.properties).map(p => (
                          <span key={p} className="param-tag">{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {inspectorTab === 'schedule' && (
            <div className="inspector-pane">
              <div className="schedule-section">
                <h3>Automated Jobs & Cadence</h3>
                {selectedAgentDetails.jobs && selectedAgentDetails.jobs.length > 0 ? (
                  <div className="jobs-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.75rem' }}>
                    {selectedAgentDetails.jobs.map((job) => (
                      <div 
                        key={job.id} 
                        style={{ 
                          padding: '1rem', 
                          background: 'rgba(255, 255, 255, 0.05)', 
                          borderRadius: '8px', 
                          border: '1px solid rgba(255, 255, 255, 0.1)' 
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.95rem' }}>{job.name}</span>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            background: job.status === 'active' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                            color: job.status === 'active' ? '#4ade80' : '#facc15',
                            fontWeight: 500
                          }}>
                            ● {job.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Clock size={12} /> Cron: <code style={{ color: '#38bdf8' }}>{job.cron}</code>
                          </span>
                          {job.lastRun && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <CheckCircle2 size={12} /> Last Run: {new Date(job.lastRun).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                          <strong>Execution Task:</strong> {job.task}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No periodic background jobs scheduled directly for this agent.</p>
                )}
              </div>
            </div>
          )}
          {inspectorTab === 'memory' && (
            <div className="inspector-pane">
              <div className="memory-section">
                <h3>Active Task & Schedule</h3>
                <div className="task-preview">
                  <ReactMarkdown>{selectedAgentDetails.memory.task}</ReactMarkdown>
                </div>
              </div>
              <div className="memory-section" style={{ marginTop: '1.5rem' }}>
                <h3>Long-term Knowledge & Guidelines</h3>
                <div className="knowledge-base">
                  <ReactMarkdown>{selectedAgentDetails.memory.longTerm}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
