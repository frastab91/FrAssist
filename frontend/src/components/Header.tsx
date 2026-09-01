import React, { useState } from 'react';
import { Settings, ChevronDown, Folder, Terminal, Volume2, VolumeX, Globe, Play, MessageSquare, Activity, PanelLeft, Copy, Check, Hash } from 'lucide-react';
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
  toggleSidebar: () => void;
  isSidebarOpen: boolean;
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
  isCurrentSessionWorking?: boolean;
  handleStop?: () => void;
  onOpenSettings?: () => void;
  activeSessionId?: string;
};

export function Header({
  toggleSidebar,
  isSidebarOpen,
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
  workingAgentsCount: _workingAgentsCount,
  pendingApprovalsCount,
  currentStatus = '',
  isCurrentSessionWorking = false,
  handleStop,
  onOpenSettings,
  activeSessionId = 'session_default',
}: HeaderProps) {
  const [copiedSessionId, setCopiedSessionId] = useState(false);

  const handleCopySessionId = () => {
    if (activeSessionId) {
      navigator.clipboard.writeText(activeSessionId);
      setCopiedSessionId(true);
      setTimeout(() => setCopiedSessionId(false), 2000);
    }
  };

  return (
    <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <button
          onClick={toggleSidebar}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', color: '#64748b', display: 'flex', alignItems: 'center' }}
          title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          <PanelLeft size={18} />
        </button>
        <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          FrAssist
          <span style={{ fontSize: '0.65rem', background: '#dbeafe', color: '#1e40af', padding: '0.15rem 0.45rem', borderRadius: '9999px', fontWeight: 600 }}>v2.5</span>
        </span>

        {/* Visible Session ID Badge with 1-Click Copy */}
        <button
          onClick={handleCopySessionId}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.25rem 0.55rem',
            background: copiedSessionId ? '#dcfce7' : '#f1f5f9',
            border: `1px solid ${copiedSessionId ? '#86efac' : '#e2e8f0'}`,
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            color: copiedSessionId ? '#15803d' : '#475569',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            maxWidth: '220px'
          }}
          title={`Session ID: ${activeSessionId}\nClick to copy for reference or debugging`}
        >
          <Hash size={12} style={{ color: copiedSessionId ? '#16a34a' : '#94a3b8', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeSessionId}
          </span>
          {copiedSessionId ? (
            <Check size={12} style={{ color: '#16a34a', flexShrink: 0 }} />
          ) : (
            <Copy size={11} style={{ color: '#94a3b8', flexShrink: 0 }} />
          )}
        </button>
        
        {/* Mission Control button */}
        <button
          onClick={onOpenMissionControl}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: pendingApprovalsCount > 0 ? '#fef3c7' : '#f8fafc',
            color: pendingApprovalsCount > 0 ? '#92400e' : '#334155',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
            transition: 'all 0.15s ease'
          }}
          title="Mission Control: Track subagents, approvals, and scheduled jobs"
        >
          <Activity size={14} color={pendingApprovalsCount > 0 ? '#d97706' : '#64748b'} />
          Mission Control
          {pendingApprovalsCount > 0 && (
            <span style={{
              background: '#ef4444',
              color: 'white',
              borderRadius: '9999px',
              padding: '0.1rem 0.4rem',
              fontSize: '0.68rem',
              fontWeight: 700
            }}>
              {pendingApprovalsCount}
            </span>
          )}
        </button>

        {/* Live Running Task Pill in Header (only when THIS active session is working) */}
        {isCurrentSessionWorking && (
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
          onChange={(e) => {
            const val = e.target.value;
            setAiProvider(val as any);
            localStorage.setItem('frassist_ai_provider', val);
            socket?.emit('set_default_llm_provider', { provider: val });
          }}
          style={{ padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}
        >
          <optgroup label="🚀 Smart Routing (Recommended)">
            <option value="auto">⚡ Smart Hybrid Auto-Router</option>
          </optgroup>

          <optgroup label="⚡ Ollama Cloud (Top Frontier Models)">
            <option value="ollama_cloud:glm-5.3-flash:cloud">GLM 5.3 Flash (1M Context - Ultra Fast)</option>
            <option value="ollama_cloud:glm-5.2:cloud">GLM 5.2 (1M Context - Repo Scale)</option>
            <option value="ollama_cloud:deepseek-v4-flash:cloud">DeepSeek V4 Flash (284B MoE)</option>
            <option value="ollama_cloud:deepseek-v4-pro:cloud">DeepSeek V4 Pro (1.6T MoE Reasoning)</option>
            <option value="ollama_cloud:kimi-k2.7-code:cloud">Kimi K2.7 Code (Agentic Coding)</option>
            <option value="ollama_cloud:minimax-m3:cloud">MiniMax M3 (1M Context SWE-Bench)</option>
            <option value="ollama_cloud:qwen3.5:397b-cloud">Qwen 3.5 397B (Multilingual Concierge)</option>
            <option value="ollama_cloud:gemma4:31b-cloud">Gemma 4 31B (Sub-300ms Clean Code)</option>
            <option value="ollama_cloud:nemotron-3-ultra:cloud">Nemotron-3 Ultra (550B MoE Workflow)</option>
            <option value="ollama_cloud:gpt-oss:20b-cloud">GPT-OSS 20B (Ultra-Fast General)</option>
            <option value="ollama_cloud:rafw007/deepseek-v4-flash-fast:latest">DeepSeek-V4 Flash Fast (Ops/Terminal)</option>
            <option value="ollama_cloud">Ollama Cloud (Default)</option>
          </optgroup>

          <optgroup label="DigitalOcean Serverless GenAI">
            <option value="do:router:general">DO Router (Auto Cost-Optimized)</option>
            <option value="digitalocean">DO Custom Router (frassistrouter)</option>
            <option value="do:openai-gpt-oss-120b">DO GPT-OSS 120B (High Quality)</option>
            <option value="do:mistral-3-14B">DO Mistral 3 14B (Fast)</option>
          </optgroup>
          
          <optgroup label="Google Gemini (Google AI Studio)">
            <option value="gemini">Google Gemini 3.7 Flash (Default)</option>
            <option value="gemini:gemini-3.7-flash">Google Gemini 3.7 Flash</option>
            <option value="gemini:gemini-3.6-flash">Google Gemini 3.6 Flash</option>
            <option value="gemini:gemini-flash-latest">Google Gemini Flash (Latest)</option>
            <option value="vertex_research">Deep Research Agent</option>
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

        {aiProvider.startsWith('ollama') && !aiProvider.startsWith('ollama_cloud') && (
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

        {ollamaStatus?.status === 'Offline' && aiProvider.startsWith('ollama') && !aiProvider.startsWith('ollama_cloud') && (
          <button
            onClick={() => socket?.emit('run_ollama_model', { model: '--help' })}
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
              position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: '280px',
              background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 200, overflow: 'hidden'
            }}>

              {/* API Keys section */}
              <div style={{ padding: '0.6rem 0.75rem', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>API Keys</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                  {([
                    ['ollama', 'Ollama Cloud', keyStatus.hasOllamaCloud],
                    ['digitalocean', 'DigitalOcean', keyStatus.hasDigitalOcean],
                    ['gemini', 'Google AI Studio', keyStatus.hasGemini],
                    ['perplexity', 'Perplexity', keyStatus.hasPerplexity],
                    ['tavily', 'Tavily', keyStatus.hasTavily],
                    ['telegram', 'Telegram', keyStatus.hasTelegram],
                  ] as const).map(([key, label, ok]) => (
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
                <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Tools & Options</div>
                {onOpenSettings && (
                  <MenuItem icon={<Settings size={14} color="#2563eb" />} label="Full AI & API Settings..." onClick={() => { onOpenSettings(); setShowSettingsMenu(false); }} />
                )}
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
