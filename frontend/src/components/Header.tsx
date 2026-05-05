import React from 'react';
import { Settings, ChevronDown, Folder, Terminal, Volume2, VolumeX, Globe } from 'lucide-react';
import type { KeyStatus } from '../types';
import { Socket } from 'socket.io-client';

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%',
        padding: '0.45rem 0.5rem', border: 'none', background: 'none',
        cursor: 'pointer', borderRadius: '6px', fontSize: '0.8rem', color: '#334155',
        textAlign: 'left',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      {icon} {label}
    </button>
  );
}

type HeaderProps = {
  aiProvider: string;
  setAiProvider: (provider: any) => void;
  showSettingsMenu: boolean;
  setShowSettingsMenu: React.Dispatch<React.SetStateAction<boolean>>;
  settingsMenuRef: React.RefObject<HTMLDivElement>;
  keyStatus: KeyStatus;
  setIsConfiguringKey: (key: any) => void;
  showFiles: boolean;
  setShowFiles: (show: boolean) => void;
  showLogs: boolean;
  setShowLogs: (show: boolean) => void;
  isTtsEnabled: boolean;
  toggleTts: () => void;
  launchChrome: () => void;
  networkIp: string;
  setMessages: (messages: any) => void;
  setLogs: (logs: any) => void;
  socket: Socket | null;
};

export function Header({
  aiProvider,
  setAiProvider,
  showSettingsMenu,
  setShowSettingsMenu,
  settingsMenuRef,
  keyStatus,
  setIsConfiguringKey,
  showFiles,
  setShowFiles,
  showLogs,
  setShowLogs,
  isTtsEnabled,
  toggleTts,
  launchChrome,
  networkIp,
  setMessages,
  setLogs,
  socket,
}: HeaderProps) {
  return (
    <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
      <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Workspace</h1>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        {/* Model selector — always visible */}
        <select
          value={aiProvider}
          onChange={(e) => setAiProvider(e.target.value as any)}
          style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <option value="gemini">Vertex Agents (Gemini 2.0)</option>
          <option value="vertex_research">Deep Research Agent</option>
          <option value="perplexity">Perplexity Sonar</option>
          <option value="ollama">Ollama (gemma4:e2b)</option>
          <option value="ollama_qwen">Ollama (qwen2.5-coder:14b)</option>
        </select>

        {/* Settings dropdown */}
        <div ref={settingsMenuRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowSettingsMenu(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: showSettingsMenu ? '#f1f5f9' : 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
          >
            <Settings size={15} />
            Settings
            <ChevronDown size={13} style={{ transform: showSettingsMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>

          {showSettingsMenu && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: '260px',
              background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 200, overflow: 'hidden'
            }}>

              {/* API Keys section */}
              <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>API Keys</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                  {([['gemini', 'Vertex', keyStatus.hasGemini], ['tavily', 'Tavily', keyStatus.hasTavily], ['telegram', 'Telegram', keyStatus.hasTelegram], ['perplexity', 'Perplexity', keyStatus.hasPerplexity]] as const).map(([key, label, ok]) => (
                    <button
                      key={key}
                      onClick={() => { setIsConfiguringKey(key as any); setShowSettingsMenu(false); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                        padding: '0.35rem 0.6rem', borderRadius: '6px', border: '1px solid',
                        borderColor: ok ? '#bbf7d0' : '#fecaca',
                        background: ok ? '#f0fdf4' : '#fff5f5',
                        color: ok ? '#166534' : '#b91c1c',
                        cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500
                      }}
                    >
                      <span style={{ fontSize: '0.65rem' }}>{ok ? '✓' : '✗'}</span> {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tools section */}
              <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Tools</div>
                <MenuItem icon={<Folder size={14} />} label="Knowledge Base" onClick={() => { setShowFiles(!showFiles); setShowSettingsMenu(false); }} />
                <MenuItem icon={<Terminal size={14} />} label={showLogs ? 'Hide Log Stream' : 'Show Log Stream'} onClick={() => { setShowLogs(!showLogs); setShowSettingsMenu(false); }} />
                <MenuItem icon={isTtsEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />} label={isTtsEnabled ? 'Voice: On' : 'Voice: Off'} onClick={() => { toggleTts(); setShowSettingsMenu(false); }} />
                <MenuItem icon={<Globe size={14} color="#4285F4" />} label="Connect Chrome" onClick={() => { launchChrome(); setShowSettingsMenu(false); }} />
                {networkIp && (
                  <div style={{ fontSize: '0.72rem', color: '#64748b', padding: '0.3rem 0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Globe size={12} /> http://{networkIp}:3001
                  </div>
                )}
              </div>

              {/* Danger zone */}
              <div style={{ padding: '0.5rem 0.75rem' }}>
                <button
                  onClick={() => {
                    setMessages([]);
                    setLogs([]);
                    if (socket) socket.emit('clear_history', { agentId: 'orchestrator' });
                    setShowSettingsMenu(false);
                  }}
                  style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #fecaca', background: '#fff5f5', color: '#b91c1c', cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem' }}
                >
                  🗑 Reset Workspace
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
