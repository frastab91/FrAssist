import React, { useState, useEffect } from 'react';
import { 
  X, Cloud, Cpu, Key, CheckCircle2, AlertCircle, RefreshCw, 
  Zap, Server, Eye, EyeOff, Check, Play, Sparkles, Code,
  MessageSquare, Sliders, RotateCcw, Search, Image as ImageIcon,
  Compass
} from 'lucide-react';
import type { KeyStatus } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiProvider: string;
  setAiProvider: (provider: any) => void;
  keyStatus: KeyStatus;
  socket: any;
  ollamaStatus?: any;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  aiProvider,
  setAiProvider,
  keyStatus,
  socket,
}) => {
  const [activeTab, setActiveTab] = useState<'providers' | 'keys' | 'diagnostics'>('providers');
  
  // Model state
  const [ollamaCloudModel, setOllamaCloudModel] = useState('nemotron-3-nano:30b');
  const [customCloudModel, setCustomCloudModel] = useState('');
  const [availableCloudModels, setAvailableCloudModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  // Router Config state
  const [routerConfig, setRouterConfig] = useState({
    fast_chat: 'ollama_cloud:gemma4:31b',
    coding: 'ollama_cloud:qwen2.5-coder:32b',
    heavy_vision: 'gemini',
    research: 'gemini',
    general: 'ollama_cloud:gemma4:31b'
  });
  const [isSavingRouter, setIsSavingRouter] = useState(false);
  const [routerSaveSuccess, setRouterSaveSuccess] = useState(false);

  // API Keys state
  const [keysInput, setKeysInput] = useState({
    ollama: '',
    digitalocean: '',
    gemini: '',
    tavily: '',
    telegram: '',
    duffel: ''
  });
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [savedKeySuccess, setSavedKeySuccess] = useState<Record<string, boolean>>({});

  // Test Connection state
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; latency?: number; model?: string; reply?: string; note?: string; error?: string } | null>(null);

  // Sync current cloud model from aiProvider
  useEffect(() => {
    if (aiProvider.startsWith('ollama_cloud:')) {
      const model = aiProvider.substring(13);
      setOllamaCloudModel(model);
    } else if (aiProvider === 'ollama_cloud') {
      setOllamaCloudModel(keyStatus.defaultOllamaCloudModel || 'nemotron-3-nano:30b');
    }
  }, [aiProvider, keyStatus.defaultOllamaCloudModel]);

  // Fetch Ollama Cloud models
  const fetchCloudModels = async () => {
    setIsLoadingModels(true);
    setModelsError(null);
    try {
      const res = await fetch('/api/llm/cloud-models');
      if (res.ok) {
        const data = await res.json();
        if (data.models && Array.isArray(data.models)) {
          setAvailableCloudModels(data.models);
        }
      } else {
        const errData = await res.json().catch(() => ({}));
        setModelsError(errData.error || `HTTP ${res.status}`);
      }
    } catch (err: any) {
      setModelsError(err.message || 'Failed to fetch cloud models');
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Fetch Router Configuration
  const fetchRouterConfig = async () => {
    try {
      const res = await fetch('/api/llm/router-config');
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          setRouterConfig(data.config);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch router config:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCloudModels();
      fetchRouterConfig();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleShowKey = (field: string) => {
    setShowKey(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSaveKey = (type: string, value: string) => {
    if (!value.trim()) return;
    if (type === 'ollama') {
      socket?.emit('set_ollama_cloud_key', { apiKey: value.trim() });
    } else if (type === 'ollama2') {
      socket?.emit('set_ollama_cloud_key_2', { apiKey: value.trim() });
    } else if (type === 'digitalocean') {
      socket?.emit('set_digitalocean_key', { apiKey: value.trim() });
    } else if (type === 'gemini') {
      socket?.emit('set_gemini_key', { apiKey: value.trim() });
    } else if (type === 'tavily') {
      socket?.emit('set_tavily_key', { apiKey: value.trim() });
    } else if (type === 'telegram') {
      socket?.emit('set_telegram_token', { token: value.trim() });
    } else if (type === 'duffel') {
      socket?.emit('set_duffel_key', { apiKey: value.trim() });
    }

    setSavedKeySuccess(prev => ({ ...prev, [type]: true }));
    setTimeout(() => {
      setSavedKeySuccess(prev => ({ ...prev, [type]: false }));
      setKeysInput(prev => ({ ...prev, [type]: '' }));
    }, 2500);
  };

  const handleSelectOllamaCloud = (modelName: string) => {
    const fullProvider = `ollama_cloud:${modelName}`;
    setOllamaCloudModel(modelName);
    setAiProvider(fullProvider);
    localStorage.setItem('frassist_ai_provider', fullProvider);
    socket?.emit('set_default_llm_provider', { provider: fullProvider, model: modelName });
  };

  const handleSelectProvider = (providerId: string) => {
    setAiProvider(providerId);
    localStorage.setItem('frassist_ai_provider', providerId);
    socket?.emit('set_default_llm_provider', { provider: providerId });
  };

  const handleSaveRouterConfig = async () => {
    setIsSavingRouter(true);
    try {
      const res = await fetch('/api/llm/router-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: routerConfig })
      });
      if (res.ok) {
        setRouterSaveSuccess(true);
        setTimeout(() => setRouterSaveSuccess(false), 2500);
      }
    } catch (e) {
      console.error('Failed to save router config:', e);
    } finally {
      setIsSavingRouter(false);
    }
  };

  const handleResetRouterConfig = async () => {
    try {
      const res = await fetch('/api/llm/router-reset', { method: 'POST' });
      const data = await res.json();
      if (data.config) {
        setRouterConfig(data.config);
        setRouterSaveSuccess(true);
        setTimeout(() => setRouterSaveSuccess(false), 2500);
      }
    } catch (e) {
      console.error('Failed to reset router config:', e);
    }
  };

  const handleTestProvider = async (targetProvider: string, targetModel?: string) => {
    setTestingProvider(targetProvider);
    setTestResult(null);
    try {
      const res = await fetch('/api/llm/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: targetProvider, model: targetModel })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || 'Connection failed' });
    } finally {
      setTestingProvider(null);
    }
  };

  // Curated Top Ollama Cloud Models
  const curatedCloudModels = [
    { name: 'glm-5.3:cloud', label: 'GLM 5.3 (Frontier Reasoning & Coding)', badge: 'Flagship', desc: 'Frontier open-weights bilingual reasoning and coding model by Zhipu AI with advanced multi-turn tool calling.' },
    { name: 'glm-5.3-flash:cloud', label: 'GLM 5.3 Flash (1M Context)', badge: 'Ultra Fast', desc: 'Next-generation frontier flash model with 1M context, high reasoning density and sub-second tool responses.' },
    { name: 'glm-5.2:cloud', label: 'GLM 5.2 (1M Context)', badge: 'Repo Scale', desc: 'Frontier open coding model for repo-scale refactors, migrations & long-horizon engineering.' },
    { name: 'deepseek-v4-flash:cloud', label: 'DeepSeek V4 Flash', badge: '284B MoE', desc: 'Fast 1M context MoE with 3 thinking modes, ideal for tool-using agents and hard debugging.' },
    { name: 'deepseek-v4-pro:cloud', label: 'DeepSeek V4 Pro', badge: '1.6T MoE', desc: 'Heavyweight reasoning variant for the most complex bugs, math and financial logic.' },
    { name: 'kimi-k2.7-code:cloud', label: 'Kimi K2.7 Code', badge: 'Agentic Code', desc: 'Optimized for agentic coding, Playwright flows, integration tests, GUI/browser automation.' },
    { name: 'minimax-m3:cloud', label: 'MiniMax M3', badge: '1M Context', desc: 'Frontier SWE-Bench & Terminal-Bench model, natural multilingual dialogue (Italian/English).' },
    { name: 'qwen3.5:397b-cloud', label: 'Qwen 3.5 397B', badge: 'Multilingual', desc: 'Multilingual generalist with strong coding and tool use; perfect for concierge and research.' },
    { name: 'gemma4:31b-cloud', label: 'Gemma 4 31B', badge: 'Sub-300ms', desc: 'Dense model with strong reasoning, HumanEval scores, clean code, docs & concise copy.' },
    { name: 'nemotron-3-ultra:cloud', label: 'Nemotron-3 Ultra', badge: '550B MoE', desc: 'NVIDIA high-throughput model built for long-running agent workflows & cron tasks.' },
    { name: 'gpt-oss:20b-cloud', label: 'GPT-OSS 20B', badge: 'Ultra Fast', desc: 'Lightweight fast general model for quick hints, small RAG queries & low-latency WhatsApp.' },
    { name: 'rafw007/deepseek-v4-flash-fast:latest', label: 'DeepSeek-V4 Flash Fast', badge: 'Ops & Terminal', desc: 'Custom low-bit DeepSeek tuned for autonomous terminal work, ops scripting and execution.' }
  ];

  const isAutoActive = aiProvider === 'auto' || aiProvider === 'auto_hybrid' || !aiProvider;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1.5rem'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '860px',
        maxHeight: '90vh',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(to right, #f8fafc, #ffffff)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)'
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>
                AI Model & Router Settings
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                Configure Smart Auto-Router, customize task models, and manage credentials
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              padding: '0.45rem',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.75rem 1.75rem',
          borderBottom: '1px solid #f1f5f9',
          background: '#f8fafc'
        }}>
          <button
            onClick={() => setActiveTab('providers')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: activeTab === 'providers' ? '#3b82f6' : 'transparent',
              background: activeTab === 'providers' ? '#ffffff' : 'transparent',
              color: activeTab === 'providers' ? '#1d4ed8' : '#64748b',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: activeTab === 'providers' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <Compass size={15} />
            Auto-Router & AI Providers
          </button>

          <button
            onClick={() => setActiveTab('keys')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: activeTab === 'keys' ? '#3b82f6' : 'transparent',
              background: activeTab === 'keys' ? '#ffffff' : 'transparent',
              color: activeTab === 'keys' ? '#1d4ed8' : '#64748b',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: activeTab === 'keys' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <Key size={15} />
            API Keys & Credentials
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: activeTab === 'diagnostics' ? '#3b82f6' : 'transparent',
              background: activeTab === 'diagnostics' ? '#ffffff' : 'transparent',
              color: activeTab === 'diagnostics' ? '#1d4ed8' : '#64748b',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: activeTab === 'diagnostics' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            <Zap size={15} />
            Diagnostics & Ping Test
          </button>
        </div>

        {/* Body Content */}
        <div style={{
          padding: '1.75rem',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem'
        }}>
          {activeTab === 'providers' && (
            <div>
              {/* ======================================================== */}
              {/* SMART HYBRID AUTO-ROUTER - FEATURED SPOTLIGHT */}
              {/* ======================================================== */}
              <div style={{
                background: isAutoActive 
                  ? 'linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)' 
                  : '#ffffff',
                border: isAutoActive ? '2px solid #6366f1' : '1px solid #cbd5e1',
                borderRadius: '14px',
                padding: '1.25rem',
                marginBottom: '1.5rem',
                boxShadow: isAutoActive ? '0 8px 24px rgba(99, 102, 241, 0.15)' : '0 2px 6px rgba(0,0,0,0.03)',
                transition: 'all 0.2s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                      color: 'white',
                      padding: '0.45rem',
                      borderRadius: '10px',
                      boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)'
                    }}>
                      <Compass size={20} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e1b4b' }}>
                          Smart Hybrid Auto-Router
                        </h3>
                        <span style={{
                          background: '#e0e7ff',
                          color: '#4338ca',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          border: '1px solid #c7d2fe'
                        }}>
                          ⚡ Recommended
                        </span>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: '#6366f1', fontWeight: 500 }}>
                        Dynamically selects the optimal model per task based on context, coding, vision, and intent (&lt;5ms latency).
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectProvider('auto')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.55rem 1rem',
                      borderRadius: '8px',
                      border: 'none',
                      background: isAutoActive ? '#4f46e5' : '#f1f5f9',
                      color: isAutoActive ? 'white' : '#475569',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      boxShadow: isAutoActive ? '0 4px 12px rgba(79, 70, 229, 0.3)' : 'none',
                      transition: 'all 0.15s'
                    }}
                  >
                    {isAutoActive ? <Check size={15} /> : <Play size={14} />}
                    {isAutoActive ? 'Active Provider' : 'Activate Router'}
                  </button>
                </div>

                {/* Router Model Mapping Customizer */}
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e0e7ff',
                  borderRadius: '10px',
                  padding: '1rem',
                  marginTop: '0.85rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Sliders size={15} color="#4f46e5" />
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b' }}>
                        Customize Route Model Assignments
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        onClick={handleResetRouterConfig}
                        title="Reset to defaults"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '6px',
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: '#64748b',
                          cursor: 'pointer'
                        }}
                      >
                        <RotateCcw size={12} />
                        Reset
                      </button>

                      <button
                        onClick={handleSaveRouterConfig}
                        disabled={isSavingRouter}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: routerSaveSuccess ? '#16a34a' : '#4f46e5',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.3rem 0.75rem',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: 'white',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {routerSaveSuccess ? <Check size={12} /> : null}
                        {routerSaveSuccess ? 'Saved!' : (isSavingRouter ? 'Saving...' : 'Save Routes')}
                      </button>
                    </div>
                  </div>

                  {/* Route Categories Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.65rem' }}>
                    {/* 1. Fast Chat */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                        <MessageSquare size={14} color="#0284c7" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>Fast Chat / WhatsApp</span>
                      </div>
                      <input
                        type="text"
                        value={routerConfig.fast_chat}
                        onChange={(e) => setRouterConfig({ ...routerConfig, fast_chat: e.target.value })}
                        placeholder="ollama_cloud:gemma4:31b"
                        style={{
                          width: '100%',
                          padding: '0.35rem 0.5rem',
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          boxSizing: 'border-box'
                        }}
                      />
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Low latency (&lt;300ms) conversation & concierge
                      </div>
                    </div>

                    {/* 2. Coding */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                        <Code size={14} color="#7c3aed" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>Coding & Developer</span>
                      </div>
                      <input
                        type="text"
                        value={routerConfig.coding}
                        onChange={(e) => setRouterConfig({ ...routerConfig, coding: e.target.value })}
                        placeholder="ollama_cloud:qwen2.5-coder:32b"
                        style={{
                          width: '100%',
                          padding: '0.35rem 0.5rem',
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          boxSizing: 'border-box'
                        }}
                      />
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Syntax, debugging, refactoring & algorithms
                      </div>
                    </div>

                    {/* 3. Vision & Heavy */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                        <ImageIcon size={14} color="#ea580c" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>Vision & 1M Context</span>
                      </div>
                      <input
                        type="text"
                        value={routerConfig.heavy_vision}
                        onChange={(e) => setRouterConfig({ ...routerConfig, heavy_vision: e.target.value })}
                        placeholder="gemini"
                        style={{
                          width: '100%',
                          padding: '0.35rem 0.5rem',
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          boxSizing: 'border-box'
                        }}
                      />
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Images, audio, browser tools & &gt;32k tokens
                      </div>
                    </div>

                    {/* 4. Research */}
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.65rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                        <Search size={14} color="#0d9488" />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>Research & Web Search</span>
                      </div>
                      <input
                        type="text"
                        value={routerConfig.research}
                        onChange={(e) => setRouterConfig({ ...routerConfig, research: e.target.value })}
                        placeholder="gemini"
                        style={{
                          width: '100%',
                          padding: '0.35rem 0.5rem',
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          boxSizing: 'border-box'
                        }}
                      />
                      <div style={{ fontSize: '0.65rem', color: '#64748b', marginTop: '0.25rem' }}>
                        Live factual search & Tavily web grounding
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* OLLAMA CLOUD SECTION */}
              {/* ======================================================== */}
              <div style={{
                background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
                border: '2px solid #bfdbfe',
                borderRadius: '12px',
                padding: '1.25rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ background: '#2563eb', color: 'white', padding: '0.35rem', borderRadius: '8px' }}>
                      <Cloud size={18} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e3a8a' }}>
                        Ollama Cloud Direct Selection
                      </h3>
                      <span style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 500 }}>
                        Lock all agent requests directly to a single Ollama Cloud model
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '9999px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      background: keyStatus.hasOllamaCloud ? '#dcfce7' : '#fee2e2',
                      color: keyStatus.hasOllamaCloud ? '#166534' : '#991b1b'
                    }}>
                      {keyStatus.hasOllamaCloud ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                      {keyStatus.hasOllamaCloud ? 'API Key Active' : 'Key Missing'}
                    </span>

                    <button
                      onClick={fetchCloudModels}
                      disabled={isLoadingModels}
                      title="Refresh Available Models"
                      style={{
                        background: 'white',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        padding: '0.35rem',
                        cursor: 'pointer',
                        color: '#2563eb'
                      }}
                    >
                      <RefreshCw size={13} className={isLoadingModels ? 'animate-spin' : ''} />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '0.8rem', color: '#475569', marginBottom: '0.85rem' }}>
                  Select a specific cloud model to override auto-routing:
                </div>

                {/* Curated Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.6rem' }}>
                  {curatedCloudModels.map((m) => {
                    const isSelected = aiProvider === `ollama_cloud:${m.name}` || (aiProvider === 'ollama_cloud' && ollamaCloudModel === m.name);
                    return (
                      <div
                        key={m.name}
                        onClick={() => handleSelectOllamaCloud(m.name)}
                        style={{
                          background: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)',
                          border: isSelected ? '2px solid #2563eb' : '1px solid #cbd5e1',
                          borderRadius: '10px',
                          padding: '0.75rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.15)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: isSelected ? '#1e40af' : '#1e293b' }}>
                              {m.label}
                            </span>
                            {m.badge && (
                              <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: '4px',
                                background: isSelected ? '#dbeafe' : '#f1f5f9',
                                color: isSelected ? '#1d4ed8' : '#475569'
                              }}>
                                {m.badge}
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <span style={{ background: '#2563eb', color: 'white', borderRadius: '50%', padding: '2px' }}>
                              <Check size={11} />
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.3 }}>
                          {m.desc}
                        </div>
                        <div style={{ marginTop: '0.4rem', fontSize: '0.68rem', fontFamily: 'monospace', color: '#3b82f6', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                          {m.name}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {modelsError && (
                  <div style={{ marginTop: '0.6rem', color: '#ef4444', fontSize: '0.75rem', background: '#fef2f2', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #fecaca' }}>
                    Note: {modelsError}
                  </div>
                )}

                {availableCloudModels.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                      Additional Discovered Models ({availableCloudModels.length}):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', maxHeight: '80px', overflowY: 'auto' }}>
                      {availableCloudModels.map((m: any) => {
                        const mName = typeof m === 'string' ? m : (m.name || m.id || String(m));
                        return (
                          <button
                            key={mName}
                            type="button"
                            onClick={() => handleSelectOllamaCloud(mName)}
                            style={{
                              background: aiProvider === `ollama_cloud:${mName}` ? '#2563eb' : 'white',
                              color: aiProvider === `ollama_cloud:${mName}` ? 'white' : '#334155',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.7rem',
                              fontFamily: 'monospace',
                              cursor: 'pointer'
                            }}
                          >
                            {mName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Custom Model Input */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.85rem' }}>
                  <input
                    type="text"
                    placeholder="Enter custom cloud model name (e.g. qwen3.5:397b, deepseek-v3)..."
                    value={customCloudModel}
                    onChange={(e) => setCustomCloudModel(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.45rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8rem',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    onClick={() => {
                      if (customCloudModel.trim()) {
                        handleSelectOllamaCloud(customCloudModel.trim());
                        setCustomCloudModel('');
                      }
                    }}
                    disabled={!customCloudModel.trim()}
                    style={{
                      background: customCloudModel.trim() ? '#2563eb' : '#e2e8f0',
                      color: customCloudModel.trim() ? 'white' : '#94a3b8',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.45rem 1rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: customCloudModel.trim() ? 'pointer' : 'default'
                    }}
                  >
                    Apply Model
                  </button>
                </div>
              </div>

              {/* Other Providers Grid */}
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
                  Manual Provider Direct Overrides
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.75rem' }}>
                  {/* DigitalOcean */}
                  <div
                    onClick={() => handleSelectProvider('digitalocean')}
                    style={{
                      border: aiProvider.startsWith('digitalocean') || aiProvider.startsWith('do:') ? '2px solid #0284c7' : '1px solid #e2e8f0',
                      background: aiProvider.startsWith('digitalocean') || aiProvider.startsWith('do:') ? '#f0f9ff' : 'white',
                      borderRadius: '10px',
                      padding: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Server size={15} color="#0284c7" />
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>DigitalOcean Serverless</span>
                      </div>
                      {(aiProvider.startsWith('digitalocean') || aiProvider.startsWith('do:')) && <Check size={13} color="#0284c7" />}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.73rem', color: '#64748b' }}>
                      Auto cost-optimized router with mistral-3 & gpt-oss support.
                    </p>
                  </div>

                  {/* Google Gemini / AI Studio */}
                  <div
                    onClick={() => handleSelectProvider('gemini')}
                    style={{
                      border: aiProvider === 'gemini' || aiProvider.startsWith('gemini') ? '2px solid #6366f1' : '1px solid #e2e8f0',
                      background: aiProvider === 'gemini' || aiProvider.startsWith('gemini') ? '#eef2ff' : 'white',
                      borderRadius: '10px',
                      padding: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Zap size={15} color="#6366f1" />
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>Google Gemini (Google AI Studio)</span>
                      </div>
                      {(aiProvider === 'gemini' || aiProvider.startsWith('gemini')) && <Check size={13} color="#6366f1" />}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.73rem', color: '#64748b' }}>
                      Gemini 3.7 Flash & 3.6 Flash via GEMINI_API_KEY with multimodal & tool calling capabilities.
                    </p>
                  </div>

                  {/* Local Ollama */}
                  <div
                    onClick={() => handleSelectProvider('ollama')}
                    style={{
                      border: aiProvider.startsWith('ollama') && !aiProvider.startsWith('ollama_cloud') ? '2px solid #16a34a' : '1px solid #e2e8f0',
                      background: aiProvider.startsWith('ollama') && !aiProvider.startsWith('ollama_cloud') ? '#f0fdf4' : 'white',
                      borderRadius: '10px',
                      padding: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Cpu size={15} color="#16a34a" />
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>Local Ollama (Offline)</span>
                      </div>
                      {aiProvider.startsWith('ollama') && !aiProvider.startsWith('ollama_cloud') && <Check size={13} color="#16a34a" />}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.73rem', color: '#64748b' }}>
                      Run local models on your GPU/CPU with no cloud dependency.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'keys' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8rem', color: '#475569' }}>
                🔑 API Keys are saved permanently to <code>backend/.env</code> and instantly loaded into memory for active agents.
              </div>

              {/* Keys list */}
              {([
                { id: 'ollama', name: 'Ollama Cloud API Key (Primary)', env: 'OLLAMA_API_KEY', configured: keyStatus.hasOllamaCloud, placeholder: 'Enter primary Ollama Cloud API Key...' },
                { id: 'ollama2', name: 'Ollama Cloud Backup Key (Failover)', env: 'OLLAMA_API_KEY_2', configured: keyStatus.hasOllamaCloud2, placeholder: 'Enter secondary/backup Ollama Cloud API Key...' },
                { id: 'digitalocean', name: 'DigitalOcean Inference Key', env: 'DIGITAL_OCEAN_API_KEY', configured: keyStatus.hasDigitalOcean, placeholder: 'Enter DigitalOcean API Key...' },
                { id: 'gemini', name: 'Google Gemini API Key (Google AI Studio)', env: 'GEMINI_API_KEY', configured: keyStatus.hasGemini, placeholder: 'Enter GEMINI_API_KEY from Google AI Studio...' },
                { id: 'tavily', name: 'Tavily Search API Key', env: 'TAVILY_API_KEY', configured: keyStatus.hasTavily, placeholder: 'Enter Tavily Search Key...' },
                { id: 'telegram', name: 'Telegram Bot Token', env: 'TELEGRAM_BOT_TOKEN', configured: keyStatus.hasTelegram, placeholder: 'Enter Telegram Bot Token...' },
                { id: 'duffel', name: 'Duffel Flights API Key', env: 'DUFFEL_API_KEY', configured: keyStatus.hasDuffel, placeholder: 'Enter Duffel API Key...' }
              ]).map(k => (
                <div
                  key={k.id}
                  style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>{k.name}</span>
                      <code style={{ fontSize: '0.7rem', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{k.env}</code>
                    </div>

                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      background: k.configured ? '#dcfce7' : '#fee2e2',
                      color: k.configured ? '#166534' : '#991b1b'
                    }}>
                      {k.configured ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
                      {k.configured ? 'Configured' : 'Not Set'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input
                        type={showKey[k.id] ? 'text' : 'password'}
                        placeholder={k.placeholder}
                        value={(keysInput as any)[k.id]}
                        onChange={(e) => setKeysInput({ ...keysInput, [k.id]: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.45rem 2.2rem 0.45rem 0.75rem',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.82rem',
                          boxSizing: 'border-box'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(k.id)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#94a3b8'
                        }}
                      >
                        {showKey[k.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>

                    <button
                      onClick={() => handleSaveKey(k.id, (keysInput as any)[k.id])}
                      disabled={!(keysInput as any)[k.id]?.trim()}
                      style={{
                        padding: '0.45rem 1rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: savedKeySuccess[k.id] ? '#16a34a' : ((keysInput as any)[k.id]?.trim() ? '#2563eb' : '#e2e8f0'),
                        color: (keysInput as any)[k.id]?.trim() || savedKeySuccess[k.id] ? 'white' : '#94a3b8',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: (keysInput as any)[k.id]?.trim() ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        transition: 'all 0.15s'
                      }}
                    >
                      {savedKeySuccess[k.id] ? <Check size={14} /> : 'Save'}
                      {savedKeySuccess[k.id] ? 'Saved!' : ''}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'diagnostics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                  Live Provider Latency & Health Check
                </h4>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.78rem', color: '#64748b' }}>
                  Send a lightweight diagnostic inference ping to test connectivity and measure response latency in milliseconds.
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleTestProvider('auto')}
                    disabled={!!testingProvider}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem 0.9rem',
                      borderRadius: '8px',
                      border: '1px solid #c7d2fe',
                      background: '#e0e7ff',
                      color: '#4338ca',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: testingProvider ? 'default' : 'pointer'
                    }}
                  >
                    <Compass size={14} />
                    Test Smart Auto-Router
                  </button>

                  <button
                    onClick={() => handleTestProvider('ollama_cloud', ollamaCloudModel)}
                    disabled={!!testingProvider}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem 0.9rem',
                      borderRadius: '8px',
                      border: '1px solid #bfdbfe',
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: testingProvider ? 'default' : 'pointer'
                    }}
                  >
                    <Cloud size={14} />
                    Test Ollama Cloud ({ollamaCloudModel})
                  </button>

                  <button
                    onClick={() => handleTestProvider('digitalocean')}
                    disabled={!!testingProvider}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem 0.9rem',
                      borderRadius: '8px',
                      border: '1px solid #bae6fd',
                      background: '#f0f9ff',
                      color: '#0369a1',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: testingProvider ? 'default' : 'pointer'
                    }}
                  >
                    <Server size={14} />
                    Test DigitalOcean Router
                  </button>

                  <button
                    onClick={() => handleTestProvider('gemini')}
                    disabled={!!testingProvider}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.5rem 0.9rem',
                      borderRadius: '8px',
                      border: '1px solid #c7d2fe',
                      background: '#eef2ff',
                      color: '#4338ca',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      cursor: testingProvider ? 'default' : 'pointer'
                    }}
                  >
                    <Zap size={14} />
                    Test Google Gemini (AI Studio)
                  </button>
                </div>
              </div>

              {testingProvider && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#2563eb', fontSize: '0.85rem', fontWeight: 600, padding: '1rem', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe' }}>
                  <RefreshCw size={16} className="animate-spin" />
                  Testing inference via {testingProvider}... please wait...
                </div>
              )}

              {testResult && !testingProvider && (
                <div style={{
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: testResult.success ? '1px solid #86efac' : '1px solid #fca5a5',
                  background: testResult.success ? '#f0fdf4' : '#fef2f2',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {testResult.success ? (
                        <div style={{ background: '#16a34a', color: 'white', borderRadius: '50%', padding: '3px', display: 'flex' }}>
                          <Check size={14} />
                        </div>
                      ) : (
                        <div style={{ background: '#dc2626', color: 'white', borderRadius: '50%', padding: '3px', display: 'flex' }}>
                          <AlertCircle size={14} />
                        </div>
                      )}
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: testResult.success ? '#166534' : '#991b1b' }}>
                        {testResult.success ? 'Inference Diagnostic Succeeded' : 'Inference Diagnostic Failed'}
                      </span>
                    </div>

                    {testResult.latency !== undefined && (
                      <span style={{
                        background: testResult.success ? '#dcfce7' : '#fee2e2',
                        color: testResult.success ? '#15803d' : '#b91c1c',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        fontFamily: 'monospace'
                      }}>
                        ⚡ {testResult.latency} ms
                      </span>
                    )}
                  </div>

                  {testResult.model && (
                    <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                      Model / Route: <code>{testResult.model}</code>
                    </div>
                  )}

                  {testResult.reply && (
                    <div style={{ fontSize: '0.8rem', color: '#1e293b', background: 'rgba(255, 255, 255, 0.7)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(0,0,0,0.05)', fontStyle: 'italic' }}>
                      &ldquo;{testResult.reply}&rdquo;
                    </div>
                  )}

                  {testResult.note && (
                    <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                      ℹ️ {testResult.note}
                    </div>
                  )}

                  {testResult.error && (
                    <div style={{ fontSize: '0.8rem', color: '#b91c1c', background: '#fee2e2', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                      Error: {testResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.75rem',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc'
        }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Current Active Mode: <strong style={{ color: '#0f172a' }}>{aiProvider === 'auto' ? 'Smart Hybrid Auto-Router' : aiProvider}</strong>
          </div>

          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              background: '#0f172a',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.85rem',
              cursor: 'pointer'
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
