import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, X, Shield, Terminal, Brain, Calendar, Clock, CheckCircle2, Search } from 'lucide-react';
import type { AgentDetails } from '../types';
import { formatCronDescription } from '../lib/cronFormatter';

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
  const [scheduleSearch, setScheduleSearch] = useState('');

  const agentJobs = selectedAgentDetails.jobs || [];
  const filteredAgentJobs = agentJobs.filter(job => {
    if (!scheduleSearch.trim()) return true;
    const q = scheduleSearch.toLowerCase().trim();
    return (
      (job.name || '').toLowerCase().includes(q) ||
      (job.task || '').toLowerCase().includes(q) ||
      (job.cron || '').toLowerCase().includes(q) ||
      formatCronDescription(job.cron).toLowerCase().includes(q) ||
      (job.status || '').toLowerCase().includes(q)
    );
  });

  return (
    <div 
      className="modal-overlay" 
      style={{ zIndex: 1200 }} 
      onClick={() => setShowInspector(false)}
    >
      <div 
        className="modal-content inspector-modal" 
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #e2e8f0'
        }}
      >
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h3 style={{ margin: 0 }}>Automated Jobs & Cadence</h3>
                  {agentJobs.length > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '0.3rem 0.6rem',
                      minWidth: '200px'
                    }}>
                      <Search size={13} color="#64748b" />
                      <input
                        type="text"
                        placeholder="Search agent schedule..."
                        value={scheduleSearch}
                        onChange={(e) => setScheduleSearch(e.target.value)}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          outline: 'none',
                          fontSize: '0.78rem',
                          width: '100%',
                          color: '#0f172a'
                        }}
                      />
                      {scheduleSearch && (
                        <button
                          type="button"
                          onClick={() => setScheduleSearch('')}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                          title="Clear search"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {agentJobs.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No periodic background jobs scheduled directly for this agent.</p>
                ) : filteredAgentJobs.length === 0 ? (
                  <div style={{
                    padding: '1.5rem',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px dashed #cbd5e1'
                  }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                      No jobs match &ldquo;{scheduleSearch}&rdquo;.
                    </p>
                    <button
                      type="button"
                      onClick={() => setScheduleSearch('')}
                      style={{
                        marginTop: '0.5rem',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '5px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '0.75rem',
                        cursor: 'pointer'
                      }}
                    >
                      Clear Search
                    </button>
                  </div>
                ) : (
                  <div className="jobs-list" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.75rem' }}>
                    {filteredAgentJobs.map((job) => (
                      <div 
                        key={job.id} 
                        style={{ 
                          padding: '1rem', 
                          background: '#f8fafc', 
                          borderRadius: '8px', 
                          border: '1px solid #e2e8f0' 
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.95rem' }}>{job.name}</span>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            background: job.status === 'active' ? '#dcfce7' : '#fef3c7',
                            color: job.status === 'active' ? '#15803d' : '#b45309',
                            fontWeight: 600
                          }}>
                            ● {job.status.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#2563eb', fontWeight: 500 }}>
                            <Clock size={13} /> {formatCronDescription(job.cron)}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            (<code style={{ color: '#0f172a' }}>{job.cron}</code>)
                          </span>
                          {job.lastRun && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <CheckCircle2 size={12} /> Last Run: {new Date(job.lastRun).toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#334155', lineHeight: '1.4' }}>
                          <strong>Execution Task:</strong> {job.task}
                        </div>
                      </div>
                    ))}
                  </div>
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
