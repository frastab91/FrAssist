import React from 'react';
import { X, Shield, Brain } from 'lucide-react';
import { Socket } from 'socket.io-client';

type AgentCreateModalProps = {
  setShowCreateModal: (show: boolean) => void;
  agentIdea: string;
  setAgentIdea: (idea: string) => void;
  isGeneratingAgent: boolean;
  setIsGeneratingAgent: (isGenerating: boolean) => void;
  socket: Socket | null;
  newAgent: { name: string; role: string; task: string; scope: string; memory: string };
  setNewAgent: (agent: { name: string; role: string; task: string; scope: string; memory: string }) => void;
  handleCreateAgent: (e: React.FormEvent) => void;
};

export function AgentCreateModal({
  setShowCreateModal,
  agentIdea,
  setAgentIdea,
  isGeneratingAgent,
  setIsGeneratingAgent,
  socket,
  newAgent,
  setNewAgent,
  handleCreateAgent,
}: AgentCreateModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Create New Agent</h2>
          <button onClick={() => setShowCreateModal(false)}><X size={20} /></button>
        </div>
        
        {/* AI Generation Section */}
        <div className="ai-gen-section">
          <label>Describe your Agent Idea</label>
          <div className="ai-gen-input">
            <textarea 
              placeholder="e.g. A senior dev that specializes in Supabase and can help me with database migrations..."
              value={agentIdea}
              onChange={e => setAgentIdea(e.target.value)}
              rows={2}
            />
            <button 
              onClick={() => {
                if (!agentIdea.trim()) return;
                setIsGeneratingAgent(true);
                socket?.emit('generate_agent_from_prompt', { prompt: agentIdea });
              }}
              disabled={isGeneratingAgent}
              className="ai-gen-btn"
            >
              {isGeneratingAgent ? 'Generating...' : 'Magic Define'}
            </button>
          </div>
          <div className="ai-gen-hint">The AI will populate the fields below based on your description.</div>
        </div>

        <div className="divider"><span>OR DEFINE MANUALLY</span></div>

        <form onSubmit={handleCreateAgent}>
          <div className="form-group">
            <label>Agent Name</label>
            <input 
              autoFocus
              placeholder="e.g. Code Reviewer" 
              value={newAgent.name} 
              onChange={e => setNewAgent({...newAgent, name: e.target.value})}
              required
            />
          </div>
          <div className="form-group">
            <label>Role</label>
            <input 
              placeholder="e.g. Senior Backend Engineer" 
              value={newAgent.role} 
              onChange={e => setNewAgent({...newAgent, role: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label>Primary Task</label>
            <textarea 
              placeholder="What should this agent do?" 
              rows={3}
              value={newAgent.task}
              onChange={e => setNewAgent({...newAgent, task: e.target.value})}
              required
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label><Shield size={14} /> Scope</label>
              <input 
                placeholder="e.g. Only backend/ folder" 
                value={newAgent.scope} 
                onChange={e => setNewAgent({...newAgent, scope: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label><Brain size={14} /> Initial Memory</label>
              <input 
                placeholder="e.g. Context about PR #42" 
                value={newAgent.memory} 
                onChange={e => setNewAgent({...newAgent, memory: e.target.value})}
              />
            </div>
          </div>
          <button type="submit" className="submit-btn">Initialize Agent</button>
        </form>
      </div>
    </div>
  );
}
