import { Mic, Image as ImageIcon, Square, Send, X, Terminal, Bot } from 'lucide-react';
import type { Agent, LogEvent } from '../types';

type InputAreaProps = {
  isDragging: boolean;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  showSuggestions: boolean;
  suggestions: string[];
  handleSuggestionClick: (s: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  toggleRecording: () => void;
  isRecording: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  input: string;
  setInput: (val: string) => void;
  setShowSuggestions: (show: boolean) => void;
  setSuggestions: (s: string[]) => void;
  handlePaste: (e: React.ClipboardEvent) => void;
  isConfiguringKey: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  activeAgents: Agent[];
  handleStop: () => void;
  selectedImages: string[];
  removeImage: (idx: number) => void;
  currentContextTokens: number;
  logs: LogEvent[];
};

export function InputArea({
  isDragging,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  showSuggestions,
  suggestions,
  handleSuggestionClick,
  handleSubmit,
  toggleRecording,
  isRecording,
  textareaRef,
  input,
  setInput,
  setShowSuggestions,
  setSuggestions,
  handlePaste,
  isConfiguringKey,
  fileInputRef,
  handleImageUpload,
  activeAgents,
  handleStop,
  selectedImages,
  removeImage,
  currentContextTokens,
  logs,
  selectedAgentId,
}: InputAreaProps & { selectedAgentId: string | null }) {
  const activeAgent = activeAgents.find(a => a.id === selectedAgentId);

  return (
    <div
      className="input-area"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ position: 'relative' }}
    >
      {selectedAgentId && selectedAgentId !== 'orchestrator' && activeAgent && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '1.5rem',
          marginBottom: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: '#eff6ff',
          padding: '0.25rem 0.75rem',
          borderRadius: '20px',
          border: '1px solid #dbeafe',
          fontSize: '0.75rem',
          color: '#2563eb',
          fontWeight: 600,
          boxShadow: 'var(--shadow-sm)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <Bot size={12} />
          Messaging: {activeAgent.name}
          <button 
            onClick={() => {/* could add a clear selection here */}}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0 2px' }}
          >
          </button>
        </div>
      )}
      {isDragging && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          background: 'rgba(59,130,246,0.08)',
          border: '2px dashed #3b82f6',
          borderRadius: '12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          <span style={{ color: '#3b82f6', fontWeight: 600, fontSize: '0.9rem' }}>Drop images here</span>
        </div>
      )}
      {showSuggestions && (
        <div className="suggestions-menu" style={{ 
          position: 'absolute', 
          bottom: '100%', 
          left: '1rem', 
          right: '1rem', 
          background: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 -4px 15px rgba(0,0,0,0.1)', 
          border: '1px solid #e2e8f0',
          marginBottom: '0.5rem',
          zIndex: 100,
          padding: '0.5rem'
        }}>
          {suggestions.map(s => (
            <button 
              key={s} 
              onClick={() => handleSuggestionClick(s)}
              style={{ 
                display: 'block', 
                width: '100%', 
                textAlign: 'left', 
                padding: '0.75rem 1rem', 
                border: 'none', 
                background: 'none', 
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '0.9rem',
                color: '#334155'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <span style={{ fontWeight: 600, color: '#3b82f6' }}>{s}</span>
              <span style={{ marginLeft: '1rem', color: '#64748b', fontSize: '0.8rem' }}>
                {s === '/hosts' ? 'Promote https://host.frastab.com/ - Scan FB group for host offerings & comment' :
                 s === '/compress' ? 'Compress session history & prune bloated context' :
                 s === '/new' ? 'Analyze session and reset workspace' : 
                 s === '/stop' ? 'Stop current generation immediately' :
                 s === '/learn' ? 'Extract insights and architectural proposals' : 
                 s === '/ego' ? 'Execute autonomous web task in Ego Lite' :
                 'Show available commands'}
              </span>
            </button>
          ))}
        </div>
      )}
      <form className="input-container" onSubmit={handleSubmit}>
        <button
          type="button"
          onClick={toggleRecording}
          style={{
            background: isRecording ? '#fee2e2' : 'none',
            border: isRecording ? '1px solid #fca5a5' : 'none',
            borderRadius: '8px',
            padding: '0.45rem',
            cursor: 'pointer',
            color: isRecording ? '#dc2626' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            marginRight: '0.5rem',
            boxShadow: isRecording ? '0 0 0 3px rgba(239, 68, 68, 0.2)' : 'none'
          }}
          title={isRecording ? "Listening... (click to stop voice input)" : "Start Voice Input"}
        >
          <Mic size={20} style={{ animation: isRecording ? 'pulse 1.5s infinite' : 'none' }} />
        </button>
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onPaste={handlePaste}
          onChange={(e) => {
            const val = e.target.value;
            setInput(val);
            const allCmds = ['/hosts', '/compress', '/new', '/stop', '/learn', '/ego', '/help'];
            if (val === '/') {
              setSuggestions(allCmds);
              setShowSuggestions(true);
            } else if (val.startsWith('/')) {
              const list = allCmds.filter(s => s.startsWith(val));
              setSuggestions(list);
              setShowSuggestions(list.length > 0);
            } else {
              setShowSuggestions(false);
            }
            
            // Auto-resize textarea
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (input.trim() || selectedImages.length > 0) {
                handleSubmit(e as any);
              }
            }
          }}
          placeholder={
            isRecording ? "🎙️ Listening... (speak into your microphone, click mic to finish)" :
            isConfiguringKey === 'ollama' ? "Enter Ollama Cloud API Key (saved permanently to backend/.env)..." :
            isConfiguringKey === 'digitalocean' ? "Enter DigitalOcean API Key..." :
            isConfiguringKey === 'gemini' ? "Enter Gemini API Key..." :
            isConfiguringKey === 'perplexity' ? "Enter Perplexity API Key..." :
            isConfiguringKey === 'tavily' ? "Enter Tavily API Key..." :
            isConfiguringKey === 'telegram' ? "Enter Telegram Bot Token..." :
            "Type / for commands, or ask me anything..."
          }
        />
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            style={{ display: 'none' }} 
            accept="image/*" 
            multiple
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()}
            style={{ background: 'none', border: 'none', padding: '0.5rem', cursor: 'pointer', color: '#64748b' }}
            title="Upload Images"
          >
            <ImageIcon size={20} />
          </button>
          {activeAgents.some(a => a.status === 'working') ? (
            <button
              type="button"
              onClick={handleStop}
              title="Stop generation"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#ef4444', border: 'none', borderRadius: '8px',
                padding: '0.45rem 0.75rem', cursor: 'pointer', color: 'white',
                gap: '0.3rem', fontSize: '0.8rem', fontWeight: 600
              }}
            >
              <Square size={14} fill="white" /> Stop
            </button>
          ) : (
            <button type="submit" disabled={!input.trim() && selectedImages.length === 0}>
              <Send size={18} />
            </button>
          )}
        </div>
      </form>
      {selectedImages.length > 0 && (
        <div className="image-previews" style={{ display: 'flex', gap: '0.5rem', padding: '0.5rem 1rem', overflowX: 'auto' }}>
          {selectedImages.map((img, idx) => (
            <div key={idx} style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              <img src={img} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button 
                onClick={() => removeImage(idx)}
                style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Log Stream Area */}
      {logs.length > 0 && activeAgents.some(a => a.status === 'working') && (
        <div style={{ 
          margin: '0.5rem 1rem 0',
          padding: '0.5rem',
          background: '#1e293b',
          borderRadius: '8px',
          border: '1px solid #334155',
          maxHeight: '100px',
          overflowY: 'auto',
          fontSize: '0.7rem',
          fontFamily: 'monospace',
          color: '#cbd5e1'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', borderBottom: '1px solid #334155', paddingBottom: '0.25rem', color: '#94a3b8', fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase' }}>
             <Terminal size={10} /> Live Log Stream
          </div>
          {logs.slice(-5).map((log, i) => (
            <div key={log.id} style={{ 
              marginBottom: '2px', 
              opacity: i === 4 ? 1 : 0.6,
              display: 'flex',
              gap: '0.5rem'
            }}>
              <span style={{ color: '#64748b' }}>[{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
              <span style={{ 
                color: log.level === 'error' ? '#ef4444' : log.type === 'tool_start' ? '#3b82f6' : log.type === 'tool_result' ? '#22c55e' : '#cbd5e1' 
              }}>
                {log.message}
              </span>
            </div>
          ))}
          <div ref={(el) => el?.scrollIntoView({ behavior: 'smooth' })} />
        </div>
      )}
      <div style={{ padding: '0.25rem 1rem 0.5rem', textAlign: 'right', fontSize: '0.65rem', color: currentContextTokens > 150000 ? '#ef4444' : '#94a3b8', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', alignItems: 'center' }}>
        <span>Current Session Context:</span>
        <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>
          {currentContextTokens >= 1000 ? (currentContextTokens / 1000).toFixed(1) + 'k' : currentContextTokens} tokens
        </span>
      </div>
    </div>
  );
}
