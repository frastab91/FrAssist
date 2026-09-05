import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Terminal, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Wrench, Bookmark, Copy, Check } from 'lucide-react';
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
  activeSessionId?: string;
  bookmarkedMessageIds?: Set<string> | string[];
  onToggleBookmark?: (message: Message) => void;
  activeTool?: string;
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
  activeSessionId,
  bookmarkedMessageIds,
  onToggleBookmark,
  activeTool,
}: ChatAreaProps) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const handleCopyMessage = (msg: Message) => {
    navigator.clipboard.writeText(msg.content);
    setCopiedMessageId(msg.id);
    setTimeout(() => setCopiedMessageId(null), 1500);
  };

  const isBookmarked = (id: string) => {
    if (!bookmarkedMessageIds) return false;
    if (bookmarkedMessageIds instanceof Set) {
      return bookmarkedMessageIds.has(id);
    }
    return Array.isArray(bookmarkedMessageIds) && bookmarkedMessageIds.includes(id);
  };

  const selectedAgent = activeAgents.find(a => a.id === selectedAgentId);

  // Filter telemetry logs strictly to this active session or global system logs
  const sessionLogs = useMemo(() => {
    return logs.filter(l => l.sessionId === activeSessionId);
  }, [logs, activeSessionId]);

  // Only consider agents working if THIS session is actively working or running steps
  const workingAgents = useMemo(() => {
    if (!isCurrentSessionWorking && !taskSteps.some(s => s.status === 'running')) {
      return [];
    }
    const targetAgentId = selectedAgentId || 'orchestrator';
    const baseAgent = activeAgents.find(a => a.id === targetAgentId) || {
      id: targetAgentId,
      name: targetAgentId === 'orchestrator' ? 'Orchestrator' : targetAgentId,
      role: targetAgentId === 'orchestrator' ? 'Main Controller' : 'Agent',
      status: 'working'
    };
    // Ensure the agent object strictly reflects THIS session's status and active tool
    const primaryAgent: Agent = {
      ...baseAgent,
      status: 'working',
      currentTask: currentStatus || baseAgent.currentTask,
      activeTool: activeTool || undefined,
    };
    return [primaryAgent];
  }, [isCurrentSessionWorking, taskSteps, selectedAgentId, activeAgents, currentStatus, activeTool]);

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
    <div className="chat-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, flex: '1 1 0%', overflow: 'hidden' }}>
      {/* Session Breadcrumb & Sub-Agent Tags Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.4rem 1.25rem',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        fontSize: '0.75rem',
        color: '#64748b',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, overflow: 'hidden' }}>
          <span style={{ fontWeight: 600, color: '#334155', whiteSpace: 'nowrap' }}>
            {activeChannel === 'whatsapp' ? '📱 WhatsApp Channel' :
             activeChannel === 'telegram' ? '✈️ Telegram Channel' :
             selectedAgent ? `🤖 Talking directly to ${selectedAgent.name}` :
             '🌐 Main Workspace'}
          </span>
          {sessionTitle && sessionTitle !== 'New Workspace Chat' && (
            <span style={{ color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>• {sessionTitle}</span>
          )}
        </div>
        {subagentsUsed && subagentsUsed.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
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

      <div style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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
              <div className="message-header" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                color: msg.isError ? '#991b1b' : undefined,
                marginBottom: '0.45rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Bot size={14} /> {activeAgents.find(a => a.id === msg.agentId)?.name || msg.agentId || 'Orchestrator'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <button
                    onClick={() => handleCopyMessage(msg)}
                    title={copiedMessageId === msg.id ? 'Copied to clipboard' : 'Copy message'}
                    aria-label="Copy message"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 5px',
                      borderRadius: '4px',
                      color: copiedMessageId === msg.id ? '#16a34a' : '#94a3b8',
                      display: 'inline-flex',
                      alignItems: 'center',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#334155')}
                    onMouseLeave={e => (e.currentTarget.style.color = copiedMessageId === msg.id ? '#16a34a' : '#94a3b8')}
                  >
                    {copiedMessageId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                  {onToggleBookmark && (
                    <button
                      onClick={() => onToggleBookmark(msg)}
                      title={isBookmarked(msg.id) ? 'Saved in bookmarks/ (click to remove)' : 'Bookmark message to MD file'}
                      aria-label="Bookmark message"
                      style={{
                        background: isBookmarked(msg.id) ? '#fef3c7' : 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 5px',
                        borderRadius: '4px',
                        color: isBookmarked(msg.id) ? '#d97706' : '#94a3b8',
                        display: 'inline-flex',
                        alignItems: 'center',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={e => {
                        if (!isBookmarked(msg.id)) e.currentTarget.style.color = '#d97706';
                      }}
                      onMouseLeave={e => {
                        if (!isBookmarked(msg.id)) e.currentTarget.style.color = '#94a3b8';
                      }}
                    >
                      <Bookmark 
                        size={14} 
                        fill={isBookmarked(msg.id) ? '#f59e0b' : 'none'} 
                        color={isBookmarked(msg.id) ? '#d97706' : 'currentColor'} 
                      />
                    </button>
                  )}
                </div>
              </div>
            )}
            {msg.role === 'user' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '0.35rem',
                marginBottom: '0.35rem',
                opacity: 0.85
              }}>
                <button
                  onClick={() => handleCopyMessage(msg)}
                  title={copiedMessageId === msg.id ? 'Copied' : 'Copy prompt'}
                  aria-label="Copy prompt"
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px 4px',
                    borderRadius: '4px',
                    color: copiedMessageId === msg.id ? '#86efac' : 'rgba(255,255,255,0.7)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                  onMouseLeave={e => (e.currentTarget.style.color = copiedMessageId === msg.id ? '#86efac' : 'rgba(255,255,255,0.7)')}
                >
                  {copiedMessageId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                </button>
                {onToggleBookmark && (
                  <button
                    onClick={() => onToggleBookmark(msg)}
                    title={isBookmarked(msg.id) ? 'Saved in bookmarks/ (click to remove)' : 'Bookmark prompt to MD file'}
                    aria-label="Bookmark prompt"
                    style={{
                      background: isBookmarked(msg.id) ? 'rgba(253, 224, 71, 0.2)' : 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '4px',
                      color: isBookmarked(msg.id) ? '#fde047' : 'rgba(255,255,255,0.7)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      if (!isBookmarked(msg.id)) e.currentTarget.style.color = '#fde047';
                    }}
                    onMouseLeave={e => {
                      if (!isBookmarked(msg.id)) e.currentTarget.style.color = isBookmarked(msg.id) ? '#fde047' : 'rgba(255,255,255,0.7)';
                    }}
                  >
                    <Bookmark 
                      size={13} 
                      fill={isBookmarked(msg.id) ? '#fde047' : 'none'} 
                      color={isBookmarked(msg.id) ? '#fde047' : 'currentColor'} 
                    />
                  </button>
                )}
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
          activeTool={activeTool}
          logs={sessionLogs}
          activeSessionId={activeSessionId}
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
