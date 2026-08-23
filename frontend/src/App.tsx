import { useState, useRef, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { Bot } from 'lucide-react';
import './index.css';

import type { Message, LogEvent, Agent, AgentDetails, KeyStatus, ChatSession, TrackerOverview, TaskActivityStep, TaskActivityEvent } from './types';
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
import { WhatsAppPage } from './components/WhatsAppPage';
import { MissionControlModal } from './components/MissionControlModal';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am your Multi-Agent Personal Assistant. How can I help you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [, setIsTyping] = useState(false);
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
  const [aiProvider, setAiProvider] = useState<'gemini' | 'ollama' | 'perplexity' | 'ollama_qwen' | 'vertex_research' | 'digitalocean'>('digitalocean');
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
  const [inspectorTab, setInspectorTab] = useState<'rules' | 'skills' | 'schedule' | 'memory'>('rules');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedAgentDetails, setSelectedAgentDetails] = useState<AgentDetails | null>(null);
  const [, setIsFetchingDetails] = useState(false);
  const [agentIdea, setAgentIdea] = useState('');
  const [isGeneratingAgent, setIsGeneratingAgent] = useState(false);
  const [networkIp, setNetworkIp] = useState<string>('');
  const [showUsageDashboard, setShowUsageDashboard] = useState(false);
  const [detailedStats, setDetailedStats] = useState<any[]>([]);
  const [whatsappStatus, setWhatsappStatus] = useState<{ connected: boolean; user: any; qr: string | null }>({
    connected: false,
    user: null,
    qr: null
  });

  // Mission Control & Tracker State
  const [showMissionControl, setShowMissionControl] = useState(false);
  const [trackerData, setTrackerData] = useState<TrackerOverview>({
    agents: [],
    pendingApprovals: [],
    jobs: [],
    timestamp: ''
  });

  const fetchTrackerData = async () => {
    try {
      const res = await fetch('/api/tracker/overview');
      if (res.ok) {
        const data = await res.json();
        setTrackerData(data);
      }
    } catch (err) {
      console.error('Failed to fetch tracker data:', err);
    }
  };

  useEffect(() => {
    fetchTrackerData();
  }, []);

  // Multi-Session & Channel State
  const [activeChannel, setActiveChannel] = useState<'web' | 'whatsapp' | 'telegram' | 'agent'>('web');
  const [activeSessionId, setActiveSessionId] = useState<string>('session_default');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [subagentsUsed, setSubagentsUsed] = useState<string[]>([]);
  
  // Multi-Session Background Execution Tracking
  const [sessionTaskSteps, setSessionTaskSteps] = useState<Record<string, TaskActivityStep[]>>({});
  const [sessionWorkingMap, setSessionWorkingMap] = useState<Record<string, boolean>>({});
  const [sessionStatusMap, setSessionStatusMap] = useState<Record<string, string>>({});
  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

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
  const [, setIsFetchingFiles] = useState(false);

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
            role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
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

    newSocket.on('session_working_status', ({ sessionId, isWorking }: { sessionId: string; isWorking: boolean }) => {
      setSessionWorkingMap(prev => ({ ...prev, [sessionId]: isWorking }));
    });

    newSocket.on('active_session_runs', (runs: string[]) => {
      const map: Record<string, boolean> = {};
      runs.forEach(id => { map[id] = true; });
      setSessionWorkingMap(map);
    });

    newSocket.on('agent_message', (data: { sessionId?: string; agentId: string; content: string; image?: string; images?: string[]; usage?: any; isTool?: boolean }) => {
      const targetSession = data.sessionId || activeSessionIdRef.current;
      if (targetSession === activeSessionIdRef.current) {
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (
            lastMsg &&
            lastMsg.role === 'assistant' &&
            lastMsg.agentId === data.agentId &&
            lastMsg.content === data.content &&
            JSON.stringify(lastMsg.usage) === JSON.stringify(data.usage)
          ) {
            return prev;
          }

          return [
            ...prev,
            {
              id: Date.now().toString() + Math.random().toString(36).substring(7),
              sessionId: targetSession,
              role: 'assistant',
              agentId: data.agentId,
              content: data.content,
              images: data.images ? data.images : (data.image ? [data.image] : undefined),
              usage: data.usage,
              isTool: data.isTool
            },
          ];
        });
        if (data.content && !data.isTool) {
          speak(data.content);
        }
      }
    });

    newSocket.on('agent_status', (data: { sessionId?: string; agentId: string; status: 'idle' | 'working', message?: string; toolName?: string }) => {
      const targetSession = data.sessionId || activeSessionIdRef.current;
      if (targetSession) {
        setSessionWorkingMap(prev => ({ ...prev, [targetSession]: data.status === 'working' }));
        setSessionStatusMap(prev => ({ ...prev, [targetSession]: data.status === 'idle' ? '' : (data.message || '') }));
      }

      if (data.agentId === 'orchestrator' || !data.agentId) {
        if (targetSession === activeSessionIdRef.current) {
          setIsTyping(data.status === 'working');
          if (data.status === 'idle') setCurrentStatus('');
          else if (data.message) setCurrentStatus(data.message);
        }
      }
      setActiveAgents((prev) => {
        const found = prev.find(a => a.id === data.agentId);
        if (found) {
          return prev.map(a => a.id === data.agentId ? {
            ...a,
            status: data.status,
            currentTask: data.message || a.currentTask,
            activeTool: data.toolName
          } : a);
        }
        return [
          ...prev,
          {
            id: data.agentId,
            name: data.agentId,
            role: 'Agent',
            status: data.status,
            currentTask: data.message,
            activeTool: data.toolName,
            icon: <Bot size={16} />
          }
        ];
      });
    });

    newSocket.on('task_activity', (act: TaskActivityEvent) => {
      const sId = act.sessionId || activeSessionIdRef.current;
      setSessionTaskSteps(prevMap => {
        const currentSteps = prevMap[sId] || [];
        let updatedSteps = currentSteps;
        if (act.action === 'start') {
          updatedSteps = [
            {
              id: act.id,
              agentId: act.agentId,
              sessionId: sId,
              type: 'planning',
              title: act.detail,
              status: 'completed',
              timestamp: act.timestamp,
              durationMs: 200
            }
          ];
        } else if (act.action === 'llm_start') {
          updatedSteps = [
            ...currentSteps.map(s => s.status === 'running' ? { ...s, status: 'completed' as const, durationMs: s.durationMs || (Date.now() - s.timestamp) } : s),
            {
              id: act.id,
              agentId: act.agentId,
              sessionId: sId,
              type: 'llm_reasoning',
              title: act.detail,
              model: act.model || act.provider,
              status: 'running',
              timestamp: act.timestamp
            }
          ];
        } else if (act.action === 'llm_end') {
          updatedSteps = currentSteps.map(s => (s.status === 'running' && s.type === 'llm_reasoning') ? {
            ...s,
            status: 'completed',
            detail: act.detail,
            durationMs: act.durationMs || (Date.now() - s.timestamp)
          } : s);
        } else if (act.action === 'tool_start') {
          updatedSteps = [
            ...currentSteps.map(s => s.status === 'running' ? { ...s, status: 'completed' as const, durationMs: s.durationMs || (Date.now() - s.timestamp) } : s),
            {
              id: act.id,
              agentId: act.agentId,
              sessionId: sId,
              type: 'tool_call',
              title: act.detail,
              toolName: act.toolName,
              toolArgs: act.args,
              status: 'running',
              timestamp: act.timestamp
            }
          ];
        } else if (act.action === 'tool_end') {
          updatedSteps = currentSteps.map(s => (s.status === 'running' && s.type === 'tool_call') ? {
            ...s,
            status: act.error ? 'error' : 'completed',
            detail: act.detail,
            durationMs: act.durationMs || (Date.now() - s.timestamp)
          } : s);
        } else if (act.action === 'subagent_start') {
          updatedSteps = [
            ...currentSteps.map(s => s.status === 'running' ? { ...s, status: 'completed' as const, durationMs: s.durationMs || (Date.now() - s.timestamp) } : s),
            {
              id: act.id,
              agentId: act.agentId,
              sessionId: sId,
              type: 'subagent_delegation',
              title: act.detail,
              detail: act.task,
              status: 'running',
              timestamp: act.timestamp
            }
          ];
        } else if (act.action === 'subagent_end') {
          updatedSteps = currentSteps.map(s => (s.status === 'running' && s.type === 'subagent_delegation') ? {
            ...s,
            status: 'completed',
            detail: act.detail,
            durationMs: Date.now() - s.timestamp
          } : s);
        } else if (act.action === 'synthesis') {
          updatedSteps = [
            ...currentSteps.map(s => s.status === 'running' ? { ...s, status: 'completed' as const, durationMs: s.durationMs || (Date.now() - s.timestamp) } : s),
            {
              id: act.id,
              agentId: act.agentId,
              sessionId: sId,
              type: 'synthesis',
              title: 'Synthesizing response & formatting',
              detail: act.detail,
              status: 'running',
              timestamp: act.timestamp
            }
          ];
        } else if (act.action === 'heartbeat') {
          updatedSteps = currentSteps.map(s => s.status === 'running' ? {
            ...s,
            detail: act.detail || s.detail
          } : s);
        } else if (act.action === 'complete') {
          updatedSteps = currentSteps.map(s => s.status === 'running' ? { ...s, status: 'completed' as const, durationMs: s.durationMs || (Date.now() - s.timestamp) } : s);
        }
        return { ...prevMap, [sId]: updatedSteps };
      });
    });

    newSocket.on('agent_health', (data: { sessionId?: string; agentId: string; status: string; toolName?: string; elapsedSeconds: number; health: string }) => {
      const targetSession = data.sessionId || activeSessionIdRef.current;
      if (targetSession === activeSessionIdRef.current && data.elapsedSeconds >= 10) {
        setCurrentStatus(`⚡ ${data.toolName || 'Processing'} (${data.elapsedSeconds}s — running smoothly)`);
      }
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

    newSocket.on('whatsapp_status', (status: any) => {
      setWhatsappStatus(status);
    });

    newSocket.on('whatsapp_qr', (data: { qr: string }) => {
      setWhatsappStatus((prev) => ({ ...prev, qr: data.qr }));
    });

    newSocket.on('sessions_list', (list: ChatSession[]) => {
      setSessions(list);
    });

    newSocket.on('session_created', ({ session }: { session: ChatSession }) => {
      setActiveSessionId(session.id);
      setSessionTitle(session.title);
      setSubagentsUsed(session.subagentsUsed || []);
      setCurrentStatus('');
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: `Started new session: **${session.title}**`
        }
      ]);
    });

    newSocket.on('session_loaded', ({ sessionId, session, messages: loadedMessages }: { sessionId: string; session: ChatSession; messages: Message[] }) => {
      setActiveSessionId(sessionId);
      setSessionTitle(session?.title || '');
      setSubagentsUsed(session?.subagentsUsed || []);
      setCurrentStatus(sessionStatusMap[sessionId] || '');
      if (session?.channel) setActiveChannel(session.channel);
      if (session?.targetAgent && session.targetAgent !== 'orchestrator') {
        setSelectedAgentId(session.targetAgent);
      }
      setMessages(loadedMessages && loadedMessages.length > 0 ? loadedMessages : [
        {
          id: '1',
          role: 'assistant',
          content: 'Hello! I am your Multi-Agent Personal Assistant. How can I help you today?'
        }
      ]);
    });

    newSocket.on('agent_log', (data: LogEvent) => {
      setLogs((prev) => {
        if (data.id && prev.some((l) => l.id === data.id)) {
          return prev;
        }
        const next = [...prev, data];
        // Cap at 2000 entries to prevent memory bloat; oldest are trimmed first
        return next.length > 2000 ? next.slice(next.length - 2000) : next;
      });
      if (data.agentId === 'orchestrator') {
        setCurrentStatus(data.message);
      }
    });

    newSocket.on('log_history', (history: LogEvent[]) => {
      // FIX: MERGE history with existing in-memory logs instead of replacing.
      // On every reconnect the backend only sends the last 200 persisted entries.
      // Replacing would wipe any logs that arrived after the last file write.
      setLogs((prev) => {
        if (!prev.length) return history;
        // Build a Set of already-known IDs so we don't add duplicates
        const knownIds = new Set(prev.map((l) => l.id));
        const newEntries = history.filter((l) => !knownIds.has(l.id));
        // Prepend historical entries that aren't already in state (they're older)
        const merged = [...newEntries, ...prev];
        return merged.length > 2000 ? merged.slice(merged.length - 2000) : merged;
      });
    });

    newSocket.on('ollama_status', (data: any) => {
      setOllamaStatus(data);
    });

    newSocket.on('system_stats', (data: any) => {
      setSystemStats(data);
    });

    newSocket.on('tracker_update', (data: TrackerOverview) => {
      setTrackerData(data);
    });

    newSocket.on('tracker_overview', (data: TrackerOverview) => {
      setTrackerData(data);
    });

    newSocket.on('pending_approval_created', (approval: any) => {
      setTrackerData(prev => ({
        ...prev,
        pendingApprovals: [approval, ...(prev.pendingApprovals || []).filter(a => a.id !== approval.id)]
      }));
    });

    newSocket.on('pending_approval_updated', (approval: any) => {
      setTrackerData(prev => ({
        ...prev,
        pendingApprovals: (prev.pendingApprovals || []).map(a => a.id === approval.id ? approval : a)
      }));
    });
    
    // Poll for Ollama status
    const pollOllama = () => {
      newSocket.emit('poll_ollama');
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

    newSocket.on('agent_error', (data: { agentId: string; error: string }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'assistant',
          agentId: data.agentId,
          content: `⚠️ **Agent Error:** ${data.error}`,
        },
      ]);
      setIsTyping(false);
      setIsFetchingDetails(false);
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



  const handleSuggestionClick = (cmd: string) => {
    setInput(cmd);
    setShowSuggestions(false);
  };

  const handleStop = (sessionIdToStop?: string) => {
    const target = sessionIdToStop || activeSessionId;
    if (socket) socket.emit('stop_generation', { sessionId: target });
    setSessionWorkingMap(prev => ({ ...prev, [target]: false }));
    setSessionStatusMap(prev => ({ ...prev, [target]: '' }));
    if (target === activeSessionId) {
      setIsTyping(false);
      setCurrentStatus('');
    }
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
    if (!input.trim() && selectedImages.length === 0) return;

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
      // FIX: Do NOT wipe logs on /new — logs are a system audit trail, not chat history.
      // The user can use the "Clear Logs" button in the log panel if they want to clear them.
      if (socket) socket.emit('clear_history', { agentId: 'orchestrator' });
      setInput('');
      return;
    }

    if (input === '/stop') {
      handleStop(activeSessionId);
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
          targetAgentId: selectedAgentId,
          channel: activeChannel,
          sessionId: activeSessionId
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
    if (!newAgent.name || !newAgent.role) return;

    const agentId = newAgent.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
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

  const handleNewChat = () => {
    setSelectedImages([]);
    setInput('');
    socket?.emit('create_session', {
      channel: activeChannel,
      targetAgentId: selectedAgentId || 'orchestrator'
    });
  };

  const handleDeleteSession = (sessionId: string) => {
    socket?.emit('delete_session', { sessionId });
    setSessionWorkingMap(prev => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    setSessionStatusMap(prev => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    setSessionTaskSteps(prev => {
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
    if (activeSessionId === sessionId) {
      setMessages([{
        id: '1',
        role: 'assistant',
        content: 'Hello! I am your Multi-Agent Personal Assistant. How can I help you today?'
      }]);
      setActiveSessionId('session_default');
      setSessionTitle('');
      setSubagentsUsed([]);
    }
  };

  return (
    <div className={`app-container ${isDragging ? 'dragging' : ''}`}>
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
        activeChannel={activeChannel}
        setActiveChannel={setActiveChannel}
        activeSessionId={activeSessionId}
        setActiveSessionId={setActiveSessionId}
        sessions={sessions}
        sessionWorkingMap={sessionWorkingMap}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onOpenWhatsApp={() => {
          setActiveChannel('whatsapp');
          setSelectedAgentId(null);
        }}
        whatsappConnected={whatsappStatus.connected}
      />
      
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
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
          onOpenWhatsApp={() => {
            setActiveChannel('whatsapp');
            setSelectedAgentId(null);
          }}
          whatsappConnected={whatsappStatus.connected}
          onOpenMissionControl={() => {
            fetchTrackerData();
            setShowMissionControl(true);
          }}
          workingAgentsCount={(trackerData.agents || []).filter(a => a.status === 'working' || a.status === 'waiting_approval').length}
          pendingApprovalsCount={(trackerData.pendingApprovals || []).filter(a => a.status === 'pending').length}
          currentStatus={sessionStatusMap[activeSessionId] || currentStatus}
          handleStop={() => handleStop(activeSessionId)}
        />

        {activeChannel === 'whatsapp' ? (
          <WhatsAppPage
            status={whatsappStatus}
            socket={socket}
            onBackToWorkspace={() => setActiveChannel('web')}
          />
        ) : (
          <>
            <ChatArea
              messages={messages}
              activeAgents={activeAgents}
              logs={logs}
              currentStatus={sessionStatusMap[activeSessionId] || currentStatus}
              taskSteps={sessionTaskSteps[activeSessionId] || []}
              isCurrentSessionWorking={Boolean(sessionWorkingMap[activeSessionId])}
              setEnlargedImage={setEnlargedImage}
              messagesEndRef={messagesEndRef}
              handleStop={() => handleStop(activeSessionId)}
              activeChannel={activeChannel}
              selectedAgentId={selectedAgentId}
              sessionTitle={sessionTitle}
              subagentsUsed={subagentsUsed}
              onOpenLogs={() => setShowLogs(true)}
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
          </>
        )}
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

      <MissionControlModal
        isOpen={showMissionControl}
        onClose={() => setShowMissionControl(false)}
        trackerData={trackerData}
        onRefresh={fetchTrackerData}
        socket={socket}
        onInspectAgent={(agentId) => {
          setSelectedAgentId(agentId);
          setShowInspector(true);
          socket?.emit('request_agent_details', { agentId });
        }}
      />
    </div>
  );
}
