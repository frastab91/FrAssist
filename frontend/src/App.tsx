import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Terminal, Plus, X, Brain, Shield, Folder, FileText, Image as ImageIcon, Globe, Mic, Volume2, VolumeX } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import './index.css';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  agentId?: string;
  content: string;
  images?: string[];
  isTool?: boolean;
  usage?: { promptTokens: number; candidatesTokens: number; totalTokens: number };
  toolExecutions?: { toolName: string; args: string }[];
};

type LogEvent = {
  id: string;
  timestamp: string;
  agentId: string;
  type: string;
  level: string;
  message: string;
  data: any;
};

type Agent = {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'working';
  icon: React.ReactNode;
  progress?: number;
  estimate?: number;
};

type AgentDetails = {
  agentId: string;
  rules: string;
  skills: any[];
  memory: {
    task: string;
    longTerm: string;
  };
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am your Multi-Agent Personal Assistant. How can I help you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result: any) => result.transcript)
          .join('');
        setInput(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsRecording(false);
      };
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  const speak = (text: string) => {
    if (!isTtsEnabled) return;
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  const toggleTts = () => {
    setIsTtsEnabled(!isTtsEnabled);
    if (!isTtsEnabled === false) {
      window.speechSynthesis.cancel();
    }
  };

  const [currentStatus, setCurrentStatus] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState<any>(null);
  const [keyStatus, setKeyStatus] = useState({ hasGemini: false, hasTavily: false, hasTelegram: false, hasPerplexity: false });
  const [isConfiguringKey, setIsConfiguringKey] = useState<'gemini' | 'tavily' | 'telegram' | 'perplexity' | null>(null);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'ollama' | 'perplexity' | 'ollama_qwen' | 'vertex_research'>('gemini');
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  
  const [activeAgents, setActiveAgents] = useState<Agent[]>([
    { id: 'orchestrator', name: 'Orchestrator', role: 'Main Controller', status: 'idle', icon: <Bot size={16} /> },
  ]);

  const [socket, setSocket] = useState<Socket | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: '', role: '', task: '', scope: '', memory: '' });
  
  const [showInspector, setShowInspector] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'rules' | 'skills' | 'memory'>('rules');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentDetails, setSelectedAgentDetails] = useState<AgentDetails | null>(null);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);
  const [agentIdea, setAgentIdea] = useState('');
  const [isGeneratingAgent, setIsGeneratingAgent] = useState(false);
  const [networkIp, setNetworkIp] = useState<string>('');

  useEffect(() => {
    const fetchNetworkInfo = async () => {
      try {
        const res = await fetch('/api/network-info');
        const data = await res.json();
        // Find the first non-internal IPv4 address
        for (const iface of Object.values(data)) {
          if (Array.isArray(iface) && iface.length > 0) {
            setNetworkIp(iface[0]);
            break;
          }
        }
      } catch (err) {
        console.error('Failed to fetch network info:', err);
      }
    };
    fetchNetworkInfo();
  }, []);
  const [showFiles, setShowFiles] = useState(false);
  const [files, setFiles] = useState<Record<string, string[]>>({});
  const [selectedFile, setSelectedFile] = useState<{ dir: string, file: string, content: string } | null>(null);
  const [isFetchingFiles, setIsFetchingFiles] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [systemStats, setSystemStats] = useState({ total_input_tokens: 0, total_output_tokens: 0, total_requests: 0 });
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  const scrollLogsToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    scrollLogsToBottom();
  }, [logs]);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('chat_history', (data: { agentId: string; history: any[] }) => {
      if (data.agentId === 'orchestrator') {
        const mappedMessages: Message[] = data.history.map((h, idx) => {
          // Extract text and images, ignore raw tool calls/results in history
          const textParts = h.parts.filter((p: any) => p.text).map((p: any) => p.text);
          const content = textParts.join('\n').trim();

          return {
            id: `hist-${idx}-${Date.now()}`,
            role: h.role === 'user' ? 'user' : 'assistant',
            agentId: data.agentId,
            content: content,
          };
        }).filter(m => m.content !== '');
        
        setMessages([
          {
            id: '1',
            role: 'assistant',
            content: 'Hello! I am your Multi-Agent Personal Assistant. How can I help you today?',
          },
          ...mappedMessages
        ]);
      }
    });

    newSocket.on('agent_message', (data: { agentId: string; content: string; image?: string; usage?: any; isTool?: boolean }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          agentId: data.agentId,
          content: data.content,
          images: data.image ? [data.image] : undefined,
          usage: data.usage,
          isTool: data.isTool
        },
      ]);
      if (data.content && !data.isTool) {
        speak(data.content);
      }
    });

    newSocket.on('agent_status', (data: { agentId: string; status: 'idle' | 'working' }) => {
      if (data.agentId === 'orchestrator') {
        setIsTyping(data.status === 'working');
        if (data.status === 'idle') setCurrentStatus('');
      }
      setActiveAgents((prev) => 
        prev.map(a => a.id === data.agentId ? { ...a, status: data.status } : a)
      );
    });
    newSocket.on('active_agents', (agents: any[]) => {
      setActiveAgents(agents.map(a => ({
        ...a,
        icon: <Bot size={16} />
      })));
    });

    newSocket.on('agent_spawned', (data: { agentId: string; name: string; role: string }) => {
      setActiveAgents((prev) => {
        if (prev.find(a => a.id === data.agentId)) return prev;
        return [
          ...prev,
          { 
            id: data.agentId, 
            name: data.name, 
            role: data.role, 
            status: 'working', 
            icon: <Bot size={16} /> 
          }
        ];
      });
    });

    newSocket.on('api_key_status', (data: { hasGemini: boolean; hasTavily: boolean; hasTelegram: boolean; hasPerplexity: boolean }) => {
      setKeyStatus(data);
      if (!data.hasGemini && !data.hasTavily && !data.hasTelegram && !data.hasPerplexity) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Welcome! Please configure your **Gemini** or **Tavily** API keys to enable full functionality.',
          },
        ]);
      }
    });

    newSocket.on('agent_log', (data: LogEvent) => {
      setLogs((prev) => [...prev, data]);
      if (data.agentId === 'orchestrator') {
        setCurrentStatus(data.message);
      }
    });

    newSocket.on('ollama_status', (data: any) => {
      setOllamaStatus(data);
    });

    newSocket.on('system_stats', (data: any) => {
      setSystemStats(data);
    });
    
    // Poll for Ollama status
    const pollOllama = () => {
      newSocket.emit('user_message', { 
        content: 'system_internal_poll: monitor_ollama', 
        provider: 'ollama', 
        internal: true 
      });
    };
    const interval = setInterval(pollOllama, 30000);
    pollOllama();
    
    newSocket.on('task_estimate', (data: { agentId: string; seconds: number }) => {
      setActiveAgents((prev) => 
        prev.map(a => a.id === data.agentId ? { ...a, estimate: data.seconds, progress: 0 } : a)
      );
    });

    newSocket.on('task_progress', (data: { agentId: string; progress: number }) => {
      setActiveAgents((prev) => 
        prev.map(a => a.id === data.agentId ? { ...a, progress: data.progress } : a)
      );
    });

    newSocket.on('agent_details', (data: AgentDetails) => {
      setSelectedAgentDetails(data);
      setIsFetchingDetails(false);
      setShowInspector(true);
    });

    newSocket.on('agent_config_generated', (config: any) => {
      setNewAgent(config);
      setIsGeneratingAgent(false);
    });

    return () => {
      clearInterval(interval);
      newSocket.disconnect();
    };
  }, []);

  const fetchFiles = async () => {
    setIsFetchingFiles(true);
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    } finally {
      setIsFetchingFiles(false);
    }
  };

  const readFile = async (dir: string, file: string) => {
    try {
      const res = await fetch(`/api/files/${dir}/${file}`);
      const data = await res.json();
      setSelectedFile({ dir, file, content: data.content });
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  };

  useEffect(() => {
    if (showFiles) {
      fetchFiles();
    }
  }, [showFiles]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      const data = await res.json();
      setSystemStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  const launchChrome = async () => {
    try {
      await fetch('/api/chrome/launch', { method: 'POST' });
      alert('Chrome launch command sent. Please ensure Chrome was closed before clicking this.');
    } catch (err) {
      console.error('Failed to launch Chrome:', err);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000); // Refresh stats every 10s
    return () => clearInterval(interval);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    
    if (val === '/') {
      setSuggestions(['/new', '/learn', '/help']);
      setShowSuggestions(true);
    } else if (val.startsWith('/')) {
      const list = ['/new', '/learn', '/help'].filter(s => s.startsWith(val));
      setSuggestions(list);
      setShowSuggestions(list.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (cmd: string) => {
    setInput(cmd);
    setShowSuggestions(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    setShowSuggestions(false);

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      images: selectedImages.length > 0 ? [...selectedImages] : undefined,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    if (input === '/new') {
      setMessages([]);
      setLogs([]);
      if (socket) socket.emit('clear_history', { agentId: 'orchestrator' });
      setInput('');
      return;
    }
    
    if (socket) {
      if (isConfiguringKey === 'gemini') {
        socket.emit('set_gemini_key', { apiKey: input });
        setIsConfiguringKey(null);
      } else if (isConfiguringKey === 'tavily') {
        socket.emit('set_tavily_key', { apiKey: input });
        setIsConfiguringKey(null);
      } else if (isConfiguringKey === 'perplexity') {
        socket.emit('set_perplexity_key', { apiKey: input });
        setIsConfiguringKey(null);
      } else if (isConfiguringKey === 'telegram') {
        socket.emit('set_telegram_token', { token: input });
        setIsConfiguringKey(null);
      } else {
        socket.emit('user_message', { 
          content: input, 
          provider: aiProvider,
          images: selectedImages 
        });
      }
    }
    setSelectedImages([]);
  };

  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 1280;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setSelectedImages(prev => [...prev, compressed]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const compressed = await compressImage(reader.result as string);
            setSelectedImages(prev => [...prev, compressed]);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgent.name.trim()) return;

    const agentId = newAgent.name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now().toString().substring(8);
    
    if (socket) {
      socket.emit('spawn_agent_manual', { 
        agentId, 
        name: newAgent.name, 
        role: newAgent.role, 
        task: newAgent.task, 
        scope: newAgent.scope, 
        memory: newAgent.memory 
      });
    }

    setShowCreateModal(false);
    setNewAgent({ name: '', role: '', task: '', scope: '', memory: '' });
  };

  return (
    <div className="app-container">
      {/* Agent Tracker Sidebar */}
      <aside className="sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>Agent Tracker</h2>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="add-agent-btn"
            style={{ 
              background: '#3b82f6', 
              color: 'white', 
              border: 'none', 
              borderRadius: '50%', 
              width: '28px', 
              height: '28px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="agent-list" style={{ flex: 1, overflowY: 'auto' }}>
          {activeAgents.map((agent) => (
            <div 
              key={agent.id} 
              className={`agent-card ${selectedAgentId === agent.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedAgentId(agent.id);
                setShowInspector(true);
                socket?.emit('request_agent_details', { agentId: agent.id });
              }}
            >
              <div className="agent-header">
                <div className="agent-info">
                  <div className="agent-icon">{agent.icon}</div>
                  <div>
                    <div className="agent-name">{agent.name}</div>
                    <div className="agent-role">{agent.role}</div>
                  </div>
                </div>
                <div className={`status-indicator ${agent.status}`}></div>
              </div>
            </div>
          ))}
        </div>

        {ollamaStatus && (
          <div className="ollama-monitor shadow-sm" style={{ margin: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
              <span>Local LLM Status</span>
              <span style={{ color: '#4ade80' }}>● Live</span>
            </div>
            {ollamaStatus.models?.map((m: any, i: number) => (
              <div key={i} style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9' }}>{m.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94a3b8' }}>
                  <span>Size: {m.size}</span>
                  <span>Used: {m.size}</span>
                </div>
              </div>
            )) || <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>No models active</div>}
          </div>
        )}

        <div className="system-usage shadow-sm" style={{ margin: '1rem', padding: '0.75rem', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#3b82f6', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Brain size={12} /> Cumulative Usage
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
              <div style={{ fontWeight: 600, color: '#334155' }}>{(systemStats.total_input_tokens / 1000).toFixed(1)}k</div>
              In Tokens
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
              <div style={{ fontWeight: 600, color: '#334155' }}>{(systemStats.total_output_tokens / 1000).toFixed(1)}k</div>
              Out Tokens
            </div>
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.65rem', color: '#94a3b8', textAlign: 'right' }}>
            Total Requests: {systemStats.total_requests}
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="main-content">
        <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Workspace</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div className="key-indicators" style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => setIsConfiguringKey('gemini')}
                className={`key-badge ${keyStatus.hasGemini ? 'active' : ''}`}
                title="Configure Vertex AI Project"
              >
                Vertex {keyStatus.hasGemini ? '✅' : '❌'}
              </button>
              <button 
                onClick={() => setIsConfiguringKey('tavily')}
                className={`key-badge ${keyStatus.hasTavily ? 'active' : ''}`}
                title="Configure Tavily Key"
              >
                Tavily {keyStatus.hasTavily ? '✅' : '❌'}
              </button>
              <button 
                onClick={() => setIsConfiguringKey('telegram')}
                className={`key-badge ${keyStatus.hasTelegram ? 'active' : ''}`}
                title="Configure Telegram Bot"
              >
                Telegram {keyStatus.hasTelegram ? '✅' : '❌'}
              </button>
              <button 
                onClick={() => setIsConfiguringKey('perplexity')}
                className={`key-badge ${keyStatus.hasPerplexity ? 'active' : ''}`}
                title="Configure Perplexity Key"
              >
                Perplexity {keyStatus.hasPerplexity ? '✅' : '❌'}
              </button>
            </div>
            <select 
              value={aiProvider} 
              onChange={(e) => setAiProvider(e.target.value as any)}
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0', background: 'white' }}
            >
              <option value="gemini">Vertex Agents (Gemini 2.0)</option>
              <option value="vertex_research">Deep Research Agent</option>
              <option value="perplexity">Perplexity Sonar</option>
              <option value="ollama">Ollama (gemma4:e2b)</option>
              <option value="ollama_qwen">Ollama (qwen2.5-coder:14b)</option>
            </select>
            <button 
              onClick={() => setShowFiles(!showFiles)}
              style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              title="Knowledge Base"
            >
              <Folder size={16} />
              <span className="hide-mobile">Knowledge Base</span>
            </button>
            <button 
              onClick={toggleTts}
              style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #e2e8f0', background: isTtsEnabled ? '#f0fdf4' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: isTtsEnabled ? '#166534' : '#64748b' }}
              title="Toggle Text-to-Speech"
            >
              {isTtsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span className="hide-mobile">{isTtsEnabled ? 'Voice' : 'Muted'}</span>
            </button>

            {networkIp && (
              <div style={{ fontSize: '0.7rem', color: '#64748b', background: '#f8fafc', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                <Globe size={12} style={{ marginRight: '0.2rem' }} />
                Network: http://{networkIp}:3001
              </div>
            )}

            <button 
              onClick={launchChrome}
              style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              title="Launch Chrome with Remote Debugging"
            >
              <Globe size={16} color="#4285F4" />
              <span className="hide-mobile">Connect Chrome</span>
            </button>
            <button 
              onClick={() => setShowLogs(!showLogs)}
              style={{ padding: '0.5rem 1rem', borderRadius: '4px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}
            >
              {showLogs ? 'Hide Logs' : 'Show Logs'}
            </button>
            <button 
              onClick={() => {
                setMessages([]);
                setLogs([]);
                if (socket) socket.emit('clear_history', { agentId: 'orchestrator' });
              }}
              style={{ 
                padding: '0.5rem 1rem', 
                borderRadius: '4px', 
                border: '1px solid #ef4444', 
                background: '#fee2e2', 
                color: '#b91c1c',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Reset Workspace
            </button>
          </div>
        </header>

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
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.images && msg.images.length > 0 && (
                  <div className="message-images" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {msg.images.map((img, i) => (
                      <div 
                        key={i} 
                        className="message-image" 
                        style={{ 
                          width: '120px', 
                          height: '120px', 
                          borderRadius: '8px', 
                          overflow: 'hidden', 
                          border: '1px solid #e2e8f0',
                          cursor: 'zoom-in',
                          transition: 'transform 0.2s ease'
                        }}
                        onClick={() => setEnlargedImage(img)}
                      >
                        <img 
                          src={img} 
                          alt="Uploaded content" 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        />
                      </div>
                    ))}
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
            <div key={`typing-${agent.id}`} className="message-row assistant">
              <div className="message-bubble shadow-sm typing-bubble">
                <div className="message-header">
                  <span className="agent-icon animate-pulse">
                    <Bot size={14} />
                  </span>
                  <span className="agent-name">{agent.name}</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                  <span className="text-sm text-gray-500 italic">
                    {agent.id === 'orchestrator' ? currentStatus || 'Thinking...' : 'Working...'}
                  </span>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
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
                    {s === '/new' ? 'Analyze session and reset workspace' : 
                     s === '/learn' ? 'Extract insights and architectural proposals' : 
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
                background: 'none',
                border: 'none',
                padding: '0.5rem',
                cursor: 'pointer',
                color: isRecording ? '#ef4444' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.2s ease',
                marginRight: '0.5rem'
              }}
              title={isRecording ? "Stop Recording" : "Start Voice Input"}
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
                if (val === '/') {
                  setSuggestions(['/new', '/learn', '/help']);
                  setShowSuggestions(true);
                } else if (val.startsWith('/')) {
                  const list = ['/new', '/learn', '/help'].filter(s => s.startsWith(val));
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
              <button type="submit" disabled={!input.trim() && selectedImages.length === 0}>
                <Send size={18} />
              </button>
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

        </div>
      </main>

      {/* Log Explorer Sidebar */}
      {showLogs && (
        <aside className="log-sidebar" style={{ width: '350px', borderLeft: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
          <div className="log-header" style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Log Explorer</h2>
            <button onClick={() => setLogs([])} style={{ fontSize: '0.8rem', cursor: 'pointer', background: 'none', border: 'none', color: '#64748b' }}>Clear</button>
          </div>
          <div className="log-list" style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {logs.map(log => (
              <div key={log.id} style={{ fontSize: '0.8rem', padding: '0.5rem', background: 'white', borderRadius: '4px', borderLeft: `3px solid ${log.level === 'error' ? '#ef4444' : log.level === 'warning' ? '#f59e0b' : '#3b82f6'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', color: '#64748b', fontSize: '0.7rem' }}>
                  <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <span style={{ fontWeight: 600 }}>{log.type}</span>
                </div>
                <div style={{ color: '#334155' }}>{log.message}</div>
                {log.data && (
                  <pre style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f1f5f9', borderRadius: '4px', overflowX: 'auto', fontSize: '0.7rem' }}>
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </aside>
      )}

      {/* Knowledge Explorer Sidebar */}
      {showFiles && (
        <aside className="log-sidebar" style={{ width: '400px', borderLeft: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
          <div className="log-header" style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Brain size={18} color="#3b82f6" /> Knowledge Base
            </h2>
            <button onClick={fetchFiles} style={{ fontSize: '0.8rem', cursor: 'pointer', background: 'none', border: 'none', color: '#3b82f6' }}>Refresh</button>
          </div>
          <div className="file-explorer-content" style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
            {Object.entries(files).map(([dir, fileList]) => (
              <div key={dir} style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Folder size={12} /> {dir}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {fileList.map(file => (
                    <button 
                      key={file} 
                      onClick={() => readFile(dir, file)}
                      style={{ 
                        textAlign: 'left', 
                        padding: '0.4rem 0.6rem', 
                        fontSize: '0.8rem', 
                        background: selectedFile?.file === file ? '#eff6ff' : 'white', 
                        border: '1px solid', 
                        borderColor: selectedFile?.file === file ? '#3b82f6' : '#e2e8f0', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        color: selectedFile?.file === file ? '#1e40af' : '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <FileText size={14} color={selectedFile?.file === file ? '#3b82f6' : '#94a3b8'} />
                      {file}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {selectedFile && (
            <div className="file-content-preview" style={{ height: '40%', borderTop: '2px solid #e2e8f0', background: 'white', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '0.5rem 1rem', background: '#f1f5f9', fontSize: '0.75rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{selectedFile.dir} / {selectedFile.file}</span>
                <button onClick={() => setSelectedFile(null)}><X size={14} /></button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', fontSize: '0.85rem' }}>
                {selectedFile.file.endsWith('.md') ? (
                  <ReactMarkdown>{selectedFile.content}</ReactMarkdown>
                ) : (
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{selectedFile.content}</pre>
                )}
              </div>
            </div>
          )}
        </aside>
      )}
      {/* Agent Creation Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Create New Agent</h2>
              <button onClick={() => setShowCreateModal(false)}><X size={20} /></button>
            </div>
            
            {/* AI Generation Section */}
            <div className="ai-gen-section">
              <label>Describe your Agent Idea</label>
              <div className="ai-gen-input">
                <textarea 
                  placeholder="e.g. A senior dev that specializes in Supabase and can help me with database migrations..."
                  value={agentIdea}
                  onChange={e => setAgentIdea(e.target.value)}
                  rows={2}
                />
                <button 
                  onClick={() => {
                    if (!agentIdea.trim()) return;
                    setIsGeneratingAgent(true);
                    socket?.emit('generate_agent_from_prompt', { prompt: agentIdea });
                  }}
                  disabled={isGeneratingAgent}
                  className="ai-gen-btn"
                >
                  {isGeneratingAgent ? 'Generating...' : 'Magic Define'}
                </button>
              </div>
              <div className="ai-gen-hint">The AI will populate the fields below based on your description.</div>
            </div>

            <div className="divider"><span>OR DEFINE MANUALLY</span></div>

            <form onSubmit={handleCreateAgent}>
              <div className="form-group">
                <label>Agent Name</label>
                <input 
                  autoFocus
                  placeholder="e.g. Code Reviewer" 
                  value={newAgent.name} 
                  onChange={e => setNewAgent({...newAgent, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <input 
                  placeholder="e.g. Senior Backend Engineer" 
                  value={newAgent.role} 
                  onChange={e => setNewAgent({...newAgent, role: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Primary Task</label>
                <textarea 
                  placeholder="What should this agent do?" 
                  rows={3}
                  value={newAgent.task}
                  onChange={e => setNewAgent({...newAgent, task: e.target.value})}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label><Shield size={14} /> Scope</label>
                  <input 
                    placeholder="e.g. Only backend/ folder" 
                    value={newAgent.scope} 
                    onChange={e => setNewAgent({...newAgent, scope: e.target.value})}
                  />
                </div>
                <div className="form-group">
                  <label><Brain size={14} /> Initial Memory</label>
                  <input 
                    placeholder="e.g. Context about PR #42" 
                    value={newAgent.memory} 
                    onChange={e => setNewAgent({...newAgent, memory: e.target.value})}
                  />
                </div>
              </div>
              <button type="submit" className="submit-btn">Initialize Agent</button>
            </form>
          </div>
        </div>
      )}

      {/* Agent Inspector Modal */}
      {showInspector && selectedAgentDetails && (
        <div className="modal-overlay">
          <div className="modal-content inspector-modal">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Bot size={24} color="#3b82f6" />
                <div>
                  <h2 style={{ margin: 0 }}>Agent Inspector</h2>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{selectedAgentDetails.agentId}</p>
                </div>
              </div>
              <button onClick={() => setShowInspector(false)}><X size={20} /></button>
            </div>
            
            <div className="inspector-tabs">
              <button 
                className={inspectorTab === 'rules' ? 'active' : ''} 
                onClick={() => setInspectorTab('rules')}
              >
                <Shield size={14} /> Rules
              </button>
              <button 
                className={inspectorTab === 'skills' ? 'active' : ''} 
                onClick={() => setInspectorTab('skills')}
              >
                <Terminal size={14} /> Skills
              </button>
              <button 
                className={inspectorTab === 'memory' ? 'active' : ''} 
                onClick={() => setInspectorTab('memory')}
              >
                <Brain size={14} /> Memory
              </button>
            </div>

            <div className="inspector-body">
              {inspectorTab === 'rules' && (
                <div className="inspector-pane">
                  <ReactMarkdown>{selectedAgentDetails.rules}</ReactMarkdown>
                </div>
              )}
              {inspectorTab === 'skills' && (
                <div className="inspector-pane">
                  <div className="skills-grid">
                    {selectedAgentDetails.skills.map((skill: any, idx: number) => (
                      <div key={idx} className="skill-item">
                        <div className="skill-name">{skill.name}</div>
                        <div className="skill-desc">{skill.description}</div>
                        {skill.parameters?.properties && (
                          <div className="skill-params">
                            {Object.keys(skill.parameters.properties).map(p => (
                              <span key={p} className="param-tag">{p}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {inspectorTab === 'memory' && (
                <div className="inspector-pane">
                  <div className="memory-section">
                    <h3>Active Task</h3>
                    <div className="task-preview">
                      <ReactMarkdown>{selectedAgentDetails.memory.task}</ReactMarkdown>
                    </div>
                  </div>
                  <div className="memory-section" style={{ marginTop: '1.5rem' }}>
                    <h3>Long-term Knowledge</h3>
                    <div className="knowledge-base">
                      <ReactMarkdown>{selectedAgentDetails.memory.longTerm}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {enlargedImage && (
        <div className="image-modal-overlay" onClick={() => setEnlargedImage(null)}>
          <img src={enlargedImage} className="image-modal-content" alt="Enlarged view" />
          <button className="close-modal-btn" onClick={() => setEnlargedImage(null)}>
            <X size={24} />
          </button>
        </div>
      )}
    </div>
  );
}
