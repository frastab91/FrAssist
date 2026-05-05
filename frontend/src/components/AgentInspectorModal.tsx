import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, X, Shield, Terminal, Brain } from 'lucide-react';
import type { AgentDetails } from '../types';

type AgentInspectorModalProps = {
  selectedAgentDetails: AgentDetails;
  setShowInspector: (show: boolean) => void;
  inspectorTab: 'rules' | 'skills' | 'memory';
  setInspectorTab: (tab: 'rules' | 'skills' | 'memory') => void;
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
          {inspectorTab === 'memory' && (
            <div className="inspector-pane">
              <div className="memory-section">
                <h3>Active Task</h3>
                <div className="task-preview">
                  <ReactMarkdown>{selectedAgentDetails.memory.task}</ReactMarkdown>
                </div>
              </div>
              <div className="memory-section" style={{ marginTop: '1.5rem' }}>
                <h3>Long-term Knowledge</h3>
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
