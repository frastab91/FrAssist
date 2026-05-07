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

  // Stuck detection levels
  const isDelayed = seconds > 30;
  const isStuck = seconds > 60;
  const isCritical = seconds > 90;

  const getBubbleStyle = () => {
    if (isCritical) return "border-red-200 bg-red-50/50 shadow-red-100";
    if (isStuck) return "border-amber-200 bg-amber-50/50 shadow-amber-100";
    if (isDelayed) return "border-blue-200 bg-blue-50/50 shadow-blue-100";
    return "border-blue-100 bg-blue-50/30";
  };

  return (
    <div className="message-row assistant mb-4">
      <div className={`message assistant shadow-sm transition-all duration-500 ${getBubbleStyle()}`}>
        <div className="message-header">
          <span className={`agent-icon ${seconds % 2 === 0 ? 'animate-pulse' : ''} ${isCritical ? 'text-red-500' : isStuck ? 'text-amber-500' : 'text-blue-500'}`}>
            <Bot size={14} />
          </span>
          <span className={`agent-name font-bold ${isCritical ? 'text-red-700' : isStuck ? 'text-amber-700' : 'text-blue-700'}`}>
            {agent.name}
          </span>
          <span className={`ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full ${isCritical ? 'bg-red-100 text-red-500' : isStuck ? 'bg-amber-100 text-amber-500' : 'bg-blue-100 text-blue-400'}`}>
            {Math.floor(seconds / 60)}:{(seconds % 60).toString().padStart(2, '0')}
          </span>
        </div>
        
        <div className="flex flex-col mt-1">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className={`w-2 h-2 rounded-full animate-bounce ${isCritical ? 'bg-red-500' : isStuck ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ animationDelay: '0ms' }}></span>
              <span className={`w-2 h-2 rounded-full animate-bounce ${isCritical ? 'bg-red-500' : isStuck ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ animationDelay: '150ms' }}></span>
              <span className={`w-2 h-2 rounded-full animate-bounce ${isCritical ? 'bg-red-500' : isStuck ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ animationDelay: '300ms' }}></span>
            </div>
            <span className={`text-sm font-medium ${isCritical ? 'text-red-800' : isStuck ? 'text-amber-800' : 'text-blue-800'}`}>
              {displayStatus}
            </span>
          </div>
          
          {lastLog && lastLog.message !== displayStatus && (
            <div className={`mt-2 p-2 bg-white/60 rounded border flex flex-col gap-1 ${isCritical ? 'border-red-100' : isStuck ? 'border-amber-100' : 'border-blue-100/50'}`}>
              <div className={`flex items-center gap-1.5 text-[9px] uppercase tracking-wider font-bold ${isCritical ? 'text-red-400' : isStuck ? 'text-amber-400' : 'text-blue-400'}`}>
                <Terminal size={10} />
                Latest Telemetry
              </div>
              <div className={`text-[11px] font-mono leading-tight break-all ${isCritical ? 'text-red-600' : isStuck ? 'text-amber-600' : 'text-blue-600'}`}>
                {lastLog.message}
              </div>
            </div>
          )}
          
          {isDelayed && (
            <div className={`mt-3 p-2 rounded-lg border flex flex-col gap-2 ${isCritical ? 'bg-red-100/50 border-red-200' : isStuck ? 'bg-amber-100/50 border-amber-200' : 'bg-blue-100/50 border-blue-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className={`text-[10px] font-bold flex items-center gap-1 ${isCritical ? 'text-red-700' : isStuck ? 'text-amber-700' : 'text-blue-700'}`}>
                  {isCritical ? (
                    <>⚠️ SYSTEM UNRESPONSIVE</>
                  ) : isStuck ? (
                    <>⏳ STILL WORKING...</>
                  ) : (
                    <>ℹ️ TAKING LONGER THAN USUAL</>
                  )}
                </div>
                <div className="flex gap-1">
                  <button 
                    onClick={handleStop}
                    className={`text-[10px] px-2 py-1 rounded font-bold transition-all shadow-sm ${
                      isCritical ? 'bg-red-600 text-white hover:bg-red-700' : 
                      isStuck ? 'bg-amber-600 text-white hover:bg-amber-700' : 
                      'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isCritical ? 'Force Abort' : 'Stop & Reset'}
                  </button>
                  {isCritical && (
                    <button 
                      onClick={() => window.location.reload()}
                      className="text-[10px] bg-gray-800 text-white px-2 py-1 rounded font-bold hover:bg-black transition-all shadow-sm"
                    >
                      Hard Refresh
                    </button>
                  )}
                </div>
              </div>
              <p className={`text-[9px] leading-snug ${isCritical ? 'text-red-600' : isStuck ? 'text-amber-600' : 'text-blue-600'}`}>
                {isCritical ? "The system appears to be stuck. You should Force Abort or Refresh the page." : 
                 isStuck ? "This operation is taking a lot of time. You can wait or cancel it." : 
                 "Still processing. Some tools (like browser automation) can take a minute."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
