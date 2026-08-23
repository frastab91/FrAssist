import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Terminal } from 'lucide-react';
import type { Message, Agent, LogEvent, TaskActivityStep } from '../types';
import { TaskExecutionCard } from './TaskExecutionCard';

type ChatAreaProps = {
  messages: Message[];
  activeAgents: Agent[];
  logs: LogEvent[];
  currentStatus: string;
  taskSteps?: TaskActivityStep[];
  setEnlargedImage: (url: string | null) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  handleStop: () => void;
  activeChannel?: 'web' | 'whatsapp' | 'telegram' | 'agent';
  selectedAgentId?: string | null;
  sessionTitle?: string;
  subagentsUsed?: string[];
  onOpenLogs?: () => void;
  isCurrentSessionWorking?: boolean;
};

export function ChatArea({
  messages,
  activeAgents,
  logs,
  currentStatus,
  taskSteps = [],
  setEnlargedImage,
  messagesEndRef,
  handleStop,
  activeChannel = 'web',
  selectedAgentId = null,
  sessionTitle = '',
  subagentsUsed = [],
  onOpenLogs,
  isCurrentSessionWorking = false,
}: ChatAreaProps) {
  const selectedAgent = activeAgents.find(a => a.id === selectedAgentId);
  const workingAgents = activeAgents.filter(a => a.status === 'working');

  return (
    <div className="chat-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Session Breadcrumb & Sub-Agent Tags Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.55rem 1.25rem',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        fontSize: '0.78rem',
        color: '#64748b'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600, color: '#334155' }}>
            {activeChannel === 'whatsapp' ? '📱 WhatsApp Channel' :
             activeChannel === 'telegram' ? '✈️ Telegram Channel' :
             selectedAgent ? `🤖 Talking directly to ${selectedAgent.name}` :
             '🌐 Main Workspace'}
          </span>
          {sessionTitle && sessionTitle !== 'New Workspace Chat' && (
            <span style={{ color: '#94a3b8' }}>• {sessionTitle}</span>
          )}
        </div>
        {subagentsUsed && subagentsUsed.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Agents:</span>
            {subagentsUsed.map((agentId) => (
              <span key={agentId} style={{
                background: agentId === 'orchestrator' ? '#f1f5f9' : '#eff6ff',
                color: agentId === 'orchestrator' ? '#475569' : '#2563eb',
                padding: '1px 6px',
                borderRadius: '4px',
                fontWeight: 600,
                fontSize: '0.65rem',
                textTransform: 'capitalize'
              }}>
                {activeAgents.find(a => a.id === agentId)?.name || agentId}
              </span>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
      {messages.map((msg) => (
        <div key={msg.id} className={`message-wrapper ${msg.role} ${msg.isTool ? 'tool-message' : ''}`}>
          <div className={`message ${msg.role} ${msg.isTool ? 'tool' : ''}`}>
            {msg.role === 'assistant' && !msg.isTool && (
              <div className="message-header">
                <Bot size={14} /> {activeAgents.find(a => a.id === msg.agentId)?.name || msg.agentId || 'Orchestrator'}
              </div>
            )}
            {msg.isTool && (
              <div className="tool-execution-header">
                <Terminal size={12} /> Tool Action ({activeAgents.find(a => a.id === msg.agentId)?.name || msg.agentId || 'Orchestrator'})
              </div>
            )}
            <div className="message-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                  ),
                  img: ({ src, alt }) => {
                    return (
                      <span 
                        className="markdown-image-wrapper" 
                        style={{ 
                          marginTop: '0.75rem', 
                          borderRadius: '12px', 
                          overflow: 'hidden', 
                          border: '1px solid #e2e8f0', 
                          cursor: 'zoom-in',
                          maxWidth: '100%',
                          width: 'fit-content',
                          display: 'block'
                        }}
                        onClick={() => setEnlargedImage(src || null)}
                      >
                        <img 
                          src={src} 
                          alt={alt} 
                          style={{ 
                            maxWidth: '100%', 
                            maxHeight: '400px', 
                            display: 'block',
                            objectFit: 'contain'
                          }} 
                          onError={() => {
                            console.error("Image failed to load:", src);
                          }}
                        />
                      </span>
                    );
                  },
                  table: ({ children }) => (
                    <div className="table-container" style={{ overflowX: 'auto', margin: '1rem 0' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th style={{ border: '1px solid #e2e8f0', padding: '8px', background: '#f8fafc', fontWeight: 'bold', textAlign: 'left' }}>
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'left' }}>
                      {children}
                    </td>
                  )
                }}
              >{msg.content}</ReactMarkdown>
            </div>
            {msg.images && msg.images.length > 0 && (
              <div className="message-images" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                {msg.images.map((img, i) => (
                  <div 
                    key={i} 
                    className="message-image-thumbnail" 
                    style={{ 
                      width: '140px', 
                      height: '100px', 
                      borderRadius: '10px', 
                      overflow: 'hidden', 
                      border: '1px solid #e2e8f0', 
                      cursor: 'zoom-in',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}
                    onClick={() => setEnlargedImage(img)}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    <img 
                      src={img} 
                      alt="Thumbnail" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                    />
                  </div>
                ))}
              </div>
            )}
            {msg.audioUrl && (
              <div style={{ marginTop: '0.5rem' }}>
                <audio
                  controls
                  autoPlay
                  src={msg.audioUrl}
                  style={{ width: '100%', borderRadius: '8px', height: '36px' }}
                />
              </div>
            )}
            {msg.usage && !msg.isTool && (
              <div className="usage-stats" style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {(msg.model || msg.usage.model) && (
                  <span style={{ 
                    background: '#eff6ff', 
                    color: '#2563eb', 
                    fontWeight: 600, 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    border: '1px solid #dbeafe',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.68rem'
                  }}>
                    ⚡ {msg.model || msg.usage.model}
                  </span>
                )}
                <span>Input: {msg.usage.promptTokens}</span>
                <span>Output: {msg.usage.candidatesTokens}</span>
                <span>Total: {msg.usage.totalTokens}</span>
                {msg.usage.durationMs && <span>Time: {(msg.usage.durationMs / 1000).toFixed(1)}s</span>}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* Render Live Task Execution Cards if this session is working or has active steps */}
      {(isCurrentSessionWorking || taskSteps.some(s => s.status === 'running')) && workingAgents.map(agent => (
        <TaskExecutionCard 
          key={`exec-${agent.id}`} 
          agent={agent} 
          currentStatus={currentStatus} 
          logs={logs}
          steps={taskSteps}
          handleStop={handleStop}
          onOpenLogs={onOpenLogs}
        />
      ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
