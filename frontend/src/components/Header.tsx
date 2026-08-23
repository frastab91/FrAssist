import React from 'react';
import { Settings, ChevronDown, Folder, Terminal, Volume2, VolumeX, Globe, Play, MessageSquare, Activity, Clock } from 'lucide-react';
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
  settingsMenuRef: React.RefObject<HTMLDivElement | null>;
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
  ollamaStatus: any;
  onOpenWhatsApp: () => void;
  whatsappConnected: boolean;
  onOpenMissionControl: () => void;
  workingAgentsCount: number;
  pendingApprovalsCount: number;
  currentStatus?: string;
  handleStop?: () => void;
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
  ollamaStatus,
  onOpenWhatsApp,
  whatsappConnected,
  onOpenMissionControl,
  workingAgentsCount,
  pendingApprovalsCount,
  currentStatus = '',
  handleStop,
}: HeaderProps) {
  return (
    <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Workspace</h1>
        
        {/* Mission Control Launcher Button */}
        <button
          onClick={onOpenMissionControl}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.4rem 0.85rem',
            borderRadius: '8px',
            border: (workingAgentsCount > 0 || pendingApprovalsCount > 0) ? '1px solid #93c5fd' : '1px solid #e2e8f0',
            background: (workingAgentsCount > 0 || pendingApprovalsCount > 0) ? '#f0f7ff' : '#f8fafc',
            color: '#1e293b',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 600,
            transition: 'all 0.2s',
            boxShadow: (workingAgentsCount > 0 || pendingApprovalsCount > 0) ? '0 1px 4px rgba(59, 130, 246, 0.15)' : 'none'
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#e2e8f0')}
          onMouseLeave={e => (e.currentTarget.style.background = (workingAgentsCount > 0 || pendingApprovalsCount > 0) ? '#f0f7ff' : '#f8fafc')}
        >
          <Activity size={15} color="#2563eb" />
          <span>Mission Control</span>
          
          {workingAgentsCount > 0 && (
            <span style={{
              fontSize: '0.7rem',
              padding: '1px 6px',
              borderRadius: '10px',
              background: '#2563eb',
              color: 'white',
              fontWeight: 700
            }}>
              {workingAgentsCount} running
            </span>
          )}

          {pendingApprovalsCount > 0 && (
            <span style={{
              fontSize: '0.7rem',
              padding: '1px 6px',
              borderRadius: '10px',
              background: '#ea580c',
              color: 'white',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '2px'
            }}>
              <Clock size={10} />
              {pendingApprovalsCount} waiting
            </span>
          )}
        </button>

        {/* Live Running Task Pill in Header */}
        {workingAgentsCount > 0 && (
          <div className="header-task-pill" title="Current Activity">
            <span className="header-task-dot" />
            <span className="header-task-title">
              {currentStatus || 'Task in progress...'}
            </span>
            {handleStop && (
              <button 
                onClick={handleStop}
                className="header-task-stop-btn"
                title="Stop task"
              >
                ✕ Stop
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
        {/* Model selector — always visible */}
        <select
          value={aiProvider}
          onChange={(e) => setAiProvider(e.target.value as any)}
          style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <optgroup label="DigitalOcean Serverless GenAI">
            <option value="do:router:general">DO Router (Auto Cost-Optimized)</option>
            <option value="digitalocean">DO Custom Router (frassistrouter)</option>
            <option value="do:openai-gpt-oss-120b">DO GPT-OSS 120B (High Quality)</option>
            <option value="do:mistral-3-14B">DO Mistral 3 14B (Fast)</option>
          </optgroup>
          
          <optgroup label="Other Cloud Providers">
            <option value="gemini">Vertex Agents (Gemini 2.5 Flash Lite)</option>
            <option value="vertex_research">Deep Research Agent</option>
            <option value="perplexity">Perplexity Sonar</option>
          </optgroup>
          
          <optgroup label="Local Models (Ollama)">
            {ollamaStatus?.availableModels && ollamaStatus.availableModels.length > 0 ? (
              ollamaStatus.availableModels.map((m: any) => (
                <option key={m.name} value={`ollama:${m.name}`}>
                  Ollama ({m.name})
                </option>
              ))
            ) : (
              <>
                <option value="ollama">Ollama (Auto-Detect)</option>
                <option value="ollama_qwen">Ollama (qwen2.5-coder:14b)</option>
              </>
            )}
          </optgroup>
        </select>

        {aiProvider.startsWith('ollama') && (
          <button
            onClick={() => {
              const defaultModel = ollamaStatus?.availableModels?.[0]?.name || 'qwen2.5-coder:14b';
              const model = aiProvider.startsWith('ollama:') ? aiProvider.substring(7) : (aiProvider === 'ollama_qwen' ? 'qwen2.5-coder:14b' : defaultModel);
              socket?.emit('run_ollama_model', { model });
            }}
            title="Run/Pull Model via CLI"
            style={{ 
              background: '#22c55e', color: 'white', border: 'none', 
              borderRadius: '8px', padding: '0.45rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <Play size={14} fill="currentColor" />
          </button>
        )}

        {ollamaStatus?.status === 'Offline' && (
          <button
            onClick={() => socket?.emit('run_ollama_model', { model: '--help' })} // A dummy command to trigger start logic if we had any, but for now just a helper
            style={{ 
              background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', 
              borderRadius: '8px', padding: '0.45rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Ollama Offline
          </button>
        )}

        {/* WhatsApp Pairing Button */}
        <button
          onClick={onOpenWhatsApp}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.85rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: whatsappConnected ? '#bbf7d0' : '#e2e8f0',
            background: whatsappConnected ? '#f0fdf4' : 'white',
            color: whatsappConnected ? '#166534' : '#334155',
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
            transition: 'all 0.2s ease'
          }}
          title="WhatsApp Multi-Device Connection"
        >
          <MessageSquare size={15} color={whatsappConnected ? '#25D366' : '#64748b'} />
          WhatsApp
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: whatsappConnected ? '#22c55e' : '#94a3b8',
            display: 'inline-block'
          }} />
        </button>

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
