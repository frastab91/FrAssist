import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Terminal } from 'lucide-react';
import type { Message, Agent, LogEvent } from '../types';

type ChatAreaProps = {
  messages: Message[];
  activeAgents: Agent[];
  logs: LogEvent[];
  currentStatus: string;
  setEnlargedImage: (url: string | null) => void;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  handleStop: () => void;
};

export function ChatArea({
  messages,
  activeAgents,
  logs,
  currentStatus,
  setEnlargedImage,
  messagesEndRef,
  handleStop,
}: ChatAreaProps) {
  return (
    <div className="chat-container">
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
                    const isLocal = src?.startsWith('/screenshots') || src?.startsWith('/audio');
                    // Fallback to relative if we can't determine the host, but usually handled by Vite proxy
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
                          onError={(e) => {
                            console.error("Image failed to load:", src);
                            // Optional: handle retry or fallback
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
              <div className="usage-stats" style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: '#64748b', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem', display: 'flex', gap: '0.75rem' }}>
                <span>Input: {msg.usage.promptTokens}</span>
                <span>Output: {msg.usage.candidatesTokens}</span>
                <span>Total: {msg.usage.totalTokens}</span>
              </div>
            )}
          </div>
        </div>
      ))}
      {activeAgents.filter(a => a.status === 'working').map(agent => (
        <TypingBubble 
          key={`typing-${agent.id}`} 
          agent={agent} 
          currentStatus={currentStatus} 
          logs={logs}
          handleStop={handleStop}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}

function TypingBubble({ agent, currentStatus, logs, handleStop }: { agent: Agent, currentStatus: string, logs: LogEvent[], handleStop: () => void }) {
  const [seconds, setSeconds] = React.useState(0);
  
  React.useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const lastLog = logs.filter(l => l.agentId === agent.id || l.agentId === 'system').slice(-1)[0];
  const displayStatus = agent.id === 'orchestrator' ? currentStatus || 'Thinking...' : 'Working...';

  return (
    <div className="message-row assistant mb-4">
      <div className="message assistant shadow-sm border-blue-100 bg-blue-50/30">
        <div className="message-header">
          <span className="agent-icon animate-pulse text-blue-500">
            <Bot size={14} />
          </span>
          <span className="agent-name text-blue-700 font-bold">{agent.name}</span>
          <span className="ml-auto text-[10px] font-mono text-blue-400 bg-blue-100/50 px-1.5 py-0.5 rounded-full">
            {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')}
          </span>
        </div>
        
        <div className="flex flex-col mt-1">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <span className="text-sm font-medium text-blue-800">
              {displayStatus}
            </span>
          </div>
          
          {lastLog && lastLog.message !== displayStatus && (
            <div className="mt-2 p-2 bg-white/60 rounded border border-blue-100/50 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-bold text-blue-400">
                <Terminal size={10} />
                Latest Telemetry
              </div>
              <div className="text-[11px] text-blue-600 font-mono leading-tight break-all">
                {lastLog.message}
              </div>
            </div>
          )}
          
          {seconds > 30 && (
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="text-[10px] text-amber-600 italic animate-pulse flex items-center gap-1">
                <span>⚠️ This step is taking longer than usual...</span>
              </div>
              <button 
                onClick={handleStop}
                className="text-[10px] bg-amber-100 hover:bg-amber-200 text-amber-700 px-2 py-1 rounded font-bold transition-colors"
              >
                Stop & Reset
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
