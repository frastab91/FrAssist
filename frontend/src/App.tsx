import React, { useState, useRef, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { Bot } from 'lucide-react';
import './index.css';

import type { Message, LogEvent, Agent, AgentDetails, KeyStatus } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ChatArea } from './components/ChatArea';
import { InputArea } from './components/InputArea';
import { LogSidebar } from './components/LogSidebar';
import { KnowledgeExplorer } from './components/KnowledgeExplorer';
import { AgentCreateModal } from './components/AgentCreateModal';
import { AgentInspectorModal } from './components/AgentInspectorModal';
import { ImageModal } from './components/ImageModal';
import { UsageDashboard } from './components/UsageDashboard';

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
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({ hasGemini: false, hasTavily: false, hasTelegram: false, hasPerplexity: false });
  const [isConfiguringKey, setIsConfiguringKey] = useState<'gemini' | 'tavily' | 'telegram' | 'perplexity' | null>(null);
  const [aiProvider, setAiProvider] = useState<'gemini' | 'ollama' | 'perplexity' | 'ollama_qwen' | 'vertex_research'>('gemini');
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  
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
  const [showUsageDashboard, setShowUsageDashboard] = useState(false);
  const [detailedStats, setDetailedStats] = useState<any[]>([]);

  useEffect(() => {
    const fetchNetworkInfo = async () => {
      try {
        const res = await fetch('/api/network-info');
        const data = await res.json();
        // Find the first non-internal IPv4 address
        for (const iface of Object.values(data)) {
          if (Array.isArray(iface) && (iface as any[]).length > 0) {
            setNetworkIp((iface as any[])[0]);
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
  const [heartbeat, setHeartbeat] = useState<any>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
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
    const handler = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setShowSettingsMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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

    newSocket.on('agent_status', (data: { agentId: string; status: 'idle' | 'working', message?: string }) => {
      if (data.agentId === 'orchestrator') {
        setIsTyping(data.status === 'working');
        if (data.status === 'idle') setCurrentStatus('');
        else if (data.message) setCurrentStatus(data.message);
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

    newSocket.on('api_key_status', (data: KeyStatus) => {
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
    
    newSocket.on('tool_output', (data: { tool: string; content: string; type?: string }) => {
      setLogs((prev) => [...prev, {
        id: Date.now().toString() + Math.random().toString(36).substring(7),
        timestamp: new Date().toISOString(),
        agentId: 'system',
        type: 'tool_output',
        level: data.type === 'stderr' ? 'error' : 'info',
        message: data.content,
        data: { tool: data.tool }
      }]);
    });
    
    newSocket.on('system_heartbeat', (data: any) => {
      setHeartbeat(data);
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

    newSocket.on('voice_message', (data: { url: string; text: string }) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        agentId: 'orchestrator',
        content: '',
        audioUrl: data.url,
      }]);
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

  const fetchDetailedStats = async () => {
    try {
      const res = await fetch('/api/stats/detailed');
      const data = await res.json();
      setDetailedStats(data);
    } catch (err) {
      console.error('Failed to fetch detailed stats:', err);
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
    const statsInterval = setInterval(fetchStats, 10000); // Refresh stats every 10s
    return () => clearInterval(statsInterval);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    
    if (val === '/') {
      setSuggestions(['/new', '/stop', '/learn', '/help']);
      setShowSuggestions(true);
    } else if (val.startsWith('/')) {
      const list = ['/new', '/stop', '/learn', '/help'].filter(s => s.startsWith(val));
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

  const handleStop = () => {
    if (socket) socket.emit('stop_generation');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the drop zone entirely (not a child element)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    droppedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setSelectedImages(prev => [...prev, compressed]);
      };
      reader.readAsDataURL(file);
    });
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

    if (input === '/stop') {
      handleStop();
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
          images: selectedImages,
          targetAgentId: selectedAgentId
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
    const uploadFiles = e.target.files;
    if (!uploadFiles) return;

    Array.from(uploadFiles).forEach(file => {
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

  const currentContextTokens = useMemo(() => {
    const messagesWithUsage = messages.filter(m => m.usage);
    if (messagesWithUsage.length === 0) return 0;
    return messagesWithUsage[messagesWithUsage.length - 1].usage!.promptTokens;
  }, [messages]);

  return (
    <div className="app-container">
      <Sidebar
        setShowCreateModal={setShowCreateModal}
        activeAgents={activeAgents}
        selectedAgentId={selectedAgentId}
        setSelectedAgentId={setSelectedAgentId}
        setShowInspector={setShowInspector}
        socket={socket}
        ollamaStatus={ollamaStatus}
        systemStats={systemStats}
        heartbeat={heartbeat}
        onUsageClick={() => {
          fetchDetailedStats();
          setShowUsageDashboard(true);
        }}
      />
      
      <main className="main-content">
        <Header
          aiProvider={aiProvider}
          setAiProvider={setAiProvider}
          showSettingsMenu={showSettingsMenu}
          setShowSettingsMenu={setShowSettingsMenu}
          settingsMenuRef={settingsMenuRef}
          keyStatus={keyStatus}
          setIsConfiguringKey={setIsConfiguringKey}
          showFiles={showFiles}
          setShowFiles={setShowFiles}
          showLogs={showLogs}
          setShowLogs={setShowLogs}
          isTtsEnabled={isTtsEnabled}
          toggleTts={toggleTts}
          launchChrome={launchChrome}
          networkIp={networkIp}
          setMessages={setMessages}
          setLogs={setLogs}
          socket={socket}
          ollamaStatus={ollamaStatus}
        />

        <ChatArea
          messages={messages}
          activeAgents={activeAgents}
          logs={logs}
          currentStatus={currentStatus}
          setEnlargedImage={setEnlargedImage}
          messagesEndRef={messagesEndRef}
          handleStop={handleStop}
        />

        <InputArea
          isDragging={isDragging}
          handleDragOver={handleDragOver}
          handleDragLeave={handleDragLeave}
          handleDrop={handleDrop}
          showSuggestions={showSuggestions}
          suggestions={suggestions}
          handleSuggestionClick={handleSuggestionClick}
          handleSubmit={handleSubmit}
          toggleRecording={toggleRecording}
          isRecording={isRecording}
          textareaRef={textareaRef}
          input={input}
          setInput={setInput}
          setShowSuggestions={setShowSuggestions}
          setSuggestions={setSuggestions}
          handlePaste={handlePaste}
          isConfiguringKey={isConfiguringKey}
          fileInputRef={fileInputRef}
          handleImageUpload={handleImageUpload}
          activeAgents={activeAgents}
          handleStop={handleStop}
          selectedImages={selectedImages}
          removeImage={removeImage}
          currentContextTokens={currentContextTokens}
          logs={logs}
          selectedAgentId={selectedAgentId}
        />
      </main>

      {showLogs && (
        <LogSidebar
          logs={logs}
          setLogs={setLogs}
          logsEndRef={logsEndRef}
        />
      )}

      {showFiles && (
        <KnowledgeExplorer
          files={files}
          fetchFiles={fetchFiles}
          readFile={readFile}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
        />
      )}

      {showCreateModal && (
        <AgentCreateModal
          setShowCreateModal={setShowCreateModal}
          agentIdea={agentIdea}
          setAgentIdea={setAgentIdea}
          isGeneratingAgent={isGeneratingAgent}
          setIsGeneratingAgent={setIsGeneratingAgent}
          socket={socket}
          newAgent={newAgent}
          setNewAgent={setNewAgent}
          handleCreateAgent={handleCreateAgent}
        />
      )}

      {showInspector && selectedAgentDetails && (
        <AgentInspectorModal
          selectedAgentDetails={selectedAgentDetails}
          setShowInspector={setShowInspector}
          inspectorTab={inspectorTab}
          setInspectorTab={setInspectorTab}
        />
      )}

      {showUsageDashboard && (
        <UsageDashboard
          detailedStats={detailedStats}
          systemStats={systemStats}
          onClose={() => setShowUsageDashboard(false)}
        />
      )}

      <ImageModal
        enlargedImage={enlargedImage}
        setEnlargedImage={setEnlargedImage}
      />
    </div>
  );
}
