import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Terminal, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Wrench } from 'lucide-react';
import type { Message, Agent, LogEvent, TaskActivityStep } from '../types';
import { TaskExecutionCard } from './TaskExecutionCard';
import { ArticleCard } from './ArticleCard';
import { AudioPlayer } from './AudioPlayer';

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

function consolidateArticleBlocks(content: string): string {
  if (!content || typeof content !== 'string' || !content.includes('```article')) {
    return content;
  }

  const articleRegex = /```article\s*([\s\S]*?)\s*```/g;
  const matches = [...content.matchAll(articleRegex)];
  if (matches.length <= 1) return content;

  const combined = matches.map(m => m[1].trim()).filter(Boolean).join('\n---\n');
  const firstIdx = content.indexOf('```article');
  const lastMatch = matches[matches.length - 1];
  const lastMatchIdx = content.lastIndexOf(lastMatch[0]);
  const endIdx = lastMatchIdx + lastMatch[0].length;

  const prefix = content.slice(0, firstIdx);
  const suffix = content.slice(endIdx);

  return `${prefix}\`\`\`article\n${combined}\n\`\`\`${suffix}`;
}

/**
 * Collapsible Accordion showing tool actions executed during a turn.
 */
function StepsAccordion({ steps }: { steps: NonNullable<Message['steps']> }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!steps || steps.length === 0) return null;

  const successCount = steps.filter(s => s.status === 'success').length;
  const errorCount = steps.filter(s => s.status === 'error').length;
  const totalDuration = steps.reduce((sum, s) => sum + (s.durationMs || 0), 0);

  return (
    <div style={{
      margin: '0.6rem 0',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      background: '#f8fafc',
      overflow: 'hidden',
      fontSize: '0.75rem'
    }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '0.45rem 0.75rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
          background: isOpen ? '#f1f5f9' : 'transparent',
          transition: 'background 0.15s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          {isOpen ? <ChevronDown size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
          <Wrench size={13} color="#4f46e5" />
          <span style={{ fontWeight: 600, color: '#1e293b' }}>
            ⚡ Executed {steps.length} Tool {steps.length === 1 ? 'Action' : 'Actions'}
          </span>
          <span style={{ color: '#64748b', fontSize: '0.7rem' }}>
            ({(totalDuration / 1000).toFixed(1)}s total)
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          {successCount > 0 && (
            <span style={{ color: '#166534', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600 }}>
              {successCount} succeeded
            </span>
          )}
          {errorCount > 0 && (
            <span style={{ color: '#991b1b', background: '#fee2e2', padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600 }}>
              {errorCount} failed
            </span>
          )}
        </div>
      </div>

      {isOpen && (
        <div style={{
          padding: '0.5rem 0.75rem',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          maxHeight: '220px',
          overflowY: 'auto'
        }}>
          {steps.map((step, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                padding: '0.35rem 0.5rem',
                background: step.status === 'error' ? '#fef2f2' : 'white',
                borderRadius: '6px',
                border: '1px solid #f1f5f9',
                fontSize: '0.72rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                {step.status === 'error' ? (
                  <AlertCircle size={12} color="#dc2626" style={{ flexShrink: 0 }} />
                ) : (
                  <CheckCircle2 size={12} color="#16a34a" style={{ flexShrink: 0 }} />
                )}
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0f172a' }}>
                  {step.toolName}
                </span>
                {step.preview && (
                  <span style={{ color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: '0.35rem' }}>
                    — {step.preview}
                  </span>
                )}
              </div>

              {step.durationMs !== undefined && (
                <span style={{ color: '#94a3b8', fontSize: '0.65rem', marginLeft: '0.5rem', flexShrink: 0 }}>
                  {step.durationMs}ms
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

  const markdownComponents = useMemo(() => ({
    p: ({ children }: any) => (
      <div className="md-paragraph" style={{ margin: '0.4rem 0', lineHeight: '1.6' }}>
        {children}
      </div>
    ),
    a: ({ href, children }: any) => {
      if (href && (href.match(/\.(mp3|wav|ogg|m4a)$/i) || href.startsWith('/audio/') || href.includes('/audio/'))) {
        return (
          <AudioPlayer 
            src={href} 
            title={typeof children === 'string' && children !== href && !children.startsWith('/audio') ? children : 'Voice Audio'} 
          />
        );
      }
      return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
    },
    img: ({ src, alt }: any) => {
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
    table: ({ children }: any) => (
      <div className="table-container" style={{ overflowX: 'auto', margin: '1rem 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          {children}
        </table>
      </div>
    ),
    th: ({ children }: any) => (
      <th style={{ border: '1px solid #e2e8f0', padding: '8px', background: '#f8fafc', fontWeight: 'bold', textAlign: 'left' }}>
        {children}
      </th>
    ),
    td: ({ children }: any) => (
      <td style={{ border: '1px solid #e2e8f0', padding: '8px', textAlign: 'left' }}>
        {children}
      </td>
    ),
    pre: ({ children }: any) => (
      <div className="md-pre-block" style={{ margin: '0.6rem 0', maxWidth: '100%', overflowX: 'auto' }}>
        {children}
      </div>
    ),
    code(props: any) {
      const {children, className, node, ...rest} = props;
      const match = /language-(\w+)/.exec(className || '');
      if (match && match[1] === 'article') {
        return <ArticleCard data={String(children).replace(/\n$/, '')} />;
      }
      const strChild = String(children || '').trim();
      if (strChild.startsWith('/audio/') && strChild.match(/\.(mp3|wav|ogg|m4a)$/i)) {
        return <AudioPlayer src={strChild} title="Voice Audio" />;
      }
      return <code {...rest} className={className} style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{children}</code>;
    }
  }), [setEnlargedImage]);

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
          <div 
            className={`message ${msg.role} ${msg.isTool ? 'tool' : ''}`}
            style={{
              borderColor: msg.isError ? '#fca5a5' : undefined,
              background: msg.isError ? '#fef2f2' : undefined
            }}
          >
            {msg.role === 'assistant' && !msg.isTool && (
              <div className="message-header" style={{ color: msg.isError ? '#991b1b' : undefined }}>
                <Bot size={14} /> {activeAgents.find(a => a.id === msg.agentId)?.name || msg.agentId || 'Orchestrator'}
              </div>
            )}
            {msg.isTool && (
              <div className="tool-execution-header">
                <Terminal size={12} /> Tool Action ({activeAgents.find(a => a.id === msg.agentId)?.name || msg.agentId || 'Orchestrator'})
              </div>
            )}

            {/* Render Executed Tool Steps Accordion if attached to message */}
            {msg.steps && msg.steps.length > 0 && (
              <StepsAccordion steps={msg.steps} />
            )}

            <div className="message-content">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >{consolidateArticleBlocks(msg.content)}</ReactMarkdown>
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
              <div style={{ marginTop: '0.65rem' }}>
                <AudioPlayer
                  src={msg.audioUrl}
                  title="Voice Message"
                  autoPlay={false}
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
