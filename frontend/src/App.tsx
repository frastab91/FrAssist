import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Bot } from 'lucide-react';
import './index.css';

import type { Message, LogEvent, Agent, AgentDetails, KeyStatus, ChatSession, TrackerOverview, TaskActivityStep, TaskActivityEvent, BookmarkItem } from './types';
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
import { SettingsModal } from './components/SettingsModal';
import { BookmarksPage } from './components/BookmarksPage';
import { BacklogBoard } from './components/BacklogBoard';
import { globalAudio } from './lib/audioManager';

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
  const isRecordingRef = useRef(false);
  const userStoppedRef = useRef(false);
  const baseInputRef = useRef('');

  // Keep isRecordingRef in sync with state
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const initRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      return null;
    }

    try {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'it-IT';

      recognition.onstart = () => {
        setIsRecording(true);
        isRecordingRef.current = true;
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const newSpeech = (finalTranscript + interimTranscript).trim();
        const base = baseInputRef.current;
        if (newSpeech) {
          setInput(base ? `${base} ${newSpeech}` : newSpeech);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error event:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          userStoppedRef.current = true;
          setIsRecording(false);
          isRecordingRef.current = false;
          alert('Microphone access was denied. Please allow microphone permissions in your browser address bar.');
        } else if (event.error === 'audio-capture') {
          userStoppedRef.current = true;
          setIsRecording(false);
          isRecordingRef.current = false;
          alert('No microphone was detected on your system.');
        }
        // 'no-speech' and other minor network hiccups do not force-terminate; auto-keepalive will resume
      };

      recognition.onend = () => {
        // If user didn't explicitly click stop, auto-restart to keep continuous recording active
        if (isRecordingRef.current && !userStoppedRef.current) {
          try {
            recognition.start();
          } catch {
            setIsRecording(false);
            isRecordingRef.current = false;
          }
        } else {
          setIsRecording(false);
          isRecordingRef.current = false;
        }
      };

      return recognition;
    } catch (e) {
      console.error('Failed to initialize SpeechRecognition:', e);
      return null;
    }
  }, []);

  const toggleRecording = () => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      alert('Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    if (isRecording) {
      userStoppedRef.current = true;
      setIsRecording(false);
      isRecordingRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch (e) {
        console.error('Error stopping speech recognition:', e);
      }
    } else {
      userStoppedRef.current = false;
      baseInputRef.current = input.trim();
      
      try {
        if (recognitionRef.current) {
          try { recognitionRef.current.abort(); } catch {}
        }
        const instance = initRecognition();
        if (instance) {
          recognitionRef.current = instance;
          instance.start();
          setIsRecording(true);
          isRecordingRef.current = true;
        }
      } catch (err: any) {
        console.error('Error starting speech recognition:', err);
        setIsRecording(false);
        isRecordingRef.current = false;
      }
    }
  };

  const speak = async (text: string) => {
    if (!isTtsEnabled || !text || !text.trim()) return;
    try {
      globalAudio.stop();
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audioUrl) {
          globalAudio.playUrl(data.audioUrl);
          return;
        }
      }
    } catch (err) {
      console.warn('[TTS] Google Cloud TTS synthesis error, fallback to WebSpeech:', err);
    }

    // Fallback if network or backend TTS fails
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      const voices = window.speechSynthesis.getVoices();
      const usVoice = voices.find(v => v.lang === 'en-US' || v.lang === 'en_US') ||
                      voices.find(v => v.lang.startsWith('en-US')) ||
                      voices.find(v => v.lang.startsWith('en'));
      if (usVoice) utterance.voice = usVoice;
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleTts = () => {
    const next = !isTtsEnabled;
    setIsTtsEnabled(next);
    if (!next) {
      globalAudio.stop();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
  };

  const [, setCurrentStatus] = useState('');
  const [ollamaStatus, setOllamaStatus] = useState<any>(null);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({ hasGemini: false, hasTavily: false, hasTelegram: false, hasPerplexity: false });
  const [isConfiguringKey, setIsConfiguringKey] = useState<'gemini' | 'tavily' | 'telegram' | 'perplexity' | 'ollama' | 'digitalocean' | 'duffel' | null>(null);
  const [aiProvider, setAiProvider] = useState<string>(() => localStorage.getItem('frassist_ai_provider') || 'ollama_cloud:nemotron-3-nano:30b');
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
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

  // Bookmarks State & Handlers
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [currentView, setCurrentView] = useState<'workspace' | 'bookmarks' | 'backlog'>('workspace');

  const fetchBookmarks = useCallback(async () => {
    try {
      const res = await fetch('/api/bookmarks');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setBookmarks(data.bookmarks || []);
          setBookmarkedIds(new Set(data.bookmarkedMessageIds || []));
        }
      }
    } catch (err) {
      console.error('Failed to fetch bookmarks:', err);
    }
  }, []);

  const handleToggleBookmark = async (msg: Message) => {
    const isCurrentlyBookmarked = bookmarkedIds.has(msg.id);
    if (isCurrentlyBookmarked) {
      try {
        const res = await fetch(`/api/bookmarks/message/${encodeURIComponent(msg.id)}`, {
          method: 'DELETE'
        });
        if (res.ok) {
          setBookmarkedIds(prev => {
            const next = new Set(prev);
            next.delete(msg.id);
            return next;
          });
          setBookmarks(prev => prev.filter(b => b.messageId !== msg.id));
        }
      } catch (err) {
        console.error('Failed to remove bookmark:', err);
      }
    } else {
      try {
        const res = await fetch('/api/bookmarks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId: msg.id,
            content: msg.content,
            role: msg.role,
            agentId: msg.agentId,
            sessionId: activeSessionIdRef.current || 'session_default',
            model: msg.model || (msg.usage && msg.usage.model),
            date: msg.timestamp || new Date().toISOString()
          })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.bookmark) {
            setBookmarkedIds(prev => new Set(prev).add(msg.id));
            setBookmarks(prev => [data.bookmark, ...prev.filter(b => b.messageId !== msg.id)]);
          }
        }
      } catch (err) {
        console.error('Failed to save bookmark:', err);
      }
    }
  };

  const handleDeleteBookmark = async (filename: string) => {
    try {
      const res = await fetch(`/api/bookmarks/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        const itemToDelete = bookmarks.find(b => b.filename === filename);
        if (itemToDelete && itemToDelete.messageId) {
          setBookmarkedIds(prev => {
            const next = new Set(prev);
            next.delete(itemToDelete.messageId);
            return next;
          });
        }
        setBookmarks(prev => prev.filter(b => b.filename !== filename));
      }
    } catch (err) {
      console.error('Failed to delete bookmark:', err);
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);

  // Multi-Session & Channel State
  const [activeChannel, setActiveChannel] = useState<'web' | 'whatsapp' | 'telegram' | 'agent'>('web');
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlParam = searchParams.get('session');
      if (urlParam) return urlParam;

      // Fallback: check if any query key itself is a session ID (e.g. ?session_178849...=)
      for (const key of searchParams.keys()) {
        if (key.startsWith('session_') || key.startsWith('telegram_')) {
          return key;
        }
      }
      const saved = localStorage.getItem('frassist_active_session_id');
      if (saved) return saved;
    } catch (_) {}
    return 'session_default';
  });
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [subagentsUsed, setSubagentsUsed] = useState<string[]>([]);
  
  // Multi-Session Background Execution Tracking
  const [sessionTaskSteps, setSessionTaskSteps] = useState<Record<string, TaskActivityStep[]>>({});
  const [sessionWorkingMap, setSessionWorkingMap] = useState<Record<string, boolean>>({});
  const [sessionStatusMap, setSessionStatusMap] = useState<Record<string, string>>({});
  const [sessionToolMap, setSessionToolMap] = useState<Record<string, string | undefined>>({});
  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
    try {
      localStorage.setItem('frassist_active_session_id', activeSessionId);
      const currentUrl = new URL(window.location.href);
      let urlChanged = false;

      // Remove any stray or bare session keys (e.g. ?session_1788...=)
      const strayKeys: string[] = [];
      currentUrl.searchParams.forEach((_, key) => {
        if (key !== 'session' && (key.startsWith('session_') || key.startsWith('telegram_'))) {
          strayKeys.push(key);
        }
      });
      strayKeys.forEach(k => {
        currentUrl.searchParams.delete(k);
        urlChanged = true;
      });

      if (currentUrl.searchParams.get('session') !== activeSessionId) {
        currentUrl.searchParams.set('session', activeSessionId);
        urlChanged = true;
      }
      if (urlChanged) {
        window.history.replaceState({}, '', currentUrl.toString());
      }
    } catch (_) {}
  }, [activeSessionId]);

  const handleChannelChange = (channel: 'web' | 'whatsapp' | 'telegram' | 'agent') => {
    setCurrentView('workspace');
    setActiveChannel(channel);
    if (channel === 'telegram') {
      const tgSession = sessions.find(s => s.channel === 'telegram' || s.id.startsWith('telegram_'));
      if (tgSession) {
        setActiveSessionId(tgSession.id);
        socket?.emit('load_session', { sessionId: tgSession.id });
      } else {
        const newTgId = `telegram_main`;
        setActiveSessionId(newTgId);
        socket?.emit('load_session', { sessionId: newTgId });
      }
    } else if (channel === 'web') {
      if (activeSessionId.startsWith('telegram_')) {
        const webSession = sessions.find(s => s.channel === 'web' && !s.id.startsWith('telegram_'));
        const targetId = webSession ? webSession.id : 'session_default';
        setActiveSessionId(targetId);
        socket?.emit('load_session', { sessionId: targetId });
      }
    }
  };

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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
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

    newSocket.on('connect', () => {
      newSocket.emit('get_active_agents');
      newSocket.emit('get_sessions');
      const targetSession = activeSessionIdRef.current || localStorage.getItem('frassist_active_session_id') || 'session_default';
      newSocket.emit('load_session', { sessionId: targetSession });
    });

    newSocket.on('session_working_status', ({ sessionId, isWorking }: { sessionId: string; isWorking: boolean }) => {
      setSessionWorkingMap(prev => ({ ...prev, [sessionId]: isWorking }));
      if (!isWorking) {
        setSessionStatusMap(prev => ({ ...prev, [sessionId]: '' }));
        setSessionToolMap(prev => ({ ...prev, [sessionId]: undefined }));
      }
      if (sessionId === activeSessionIdRef.current) {
        setIsTyping(isWorking);
        if (!isWorking) setCurrentStatus('');
      }
    });

    newSocket.on('active_session_runs', (runs: string[]) => {
      const map: Record<string, boolean> = {};
      runs.forEach(id => { map[id] = true; });
      setSessionWorkingMap(map);
      if (!map[activeSessionIdRef.current]) {
        setIsTyping(false);
        setCurrentStatus('');
      }
    });

    newSocket.on('agent_message', (data: { sessionId?: string; agentId: string; content: string; image?: string; images?: string[]; audioUrl?: string; usage?: any; isTool?: boolean; isError?: boolean; steps?: any[] }) => {
      if (data.sessionId && data.sessionId !== activeSessionIdRef.current) return;
      const targetSession = data.sessionId || activeSessionIdRef.current;
      if (targetSession === activeSessionIdRef.current) {
        setMessages((prev) => {
          const lastMsg = prev[prev.length - 1];
          if (
            lastMsg &&
            lastMsg.role === 'assistant' &&
            lastMsg.agentId === data.agentId &&
            lastMsg.content === data.content &&
            lastMsg.audioUrl === data.audioUrl &&
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
              audioUrl: data.audioUrl,
              usage: data.usage,
              isTool: data.isTool,
              isError: data.isError,
              steps: data.steps
            },
          ];
        });
        if (data.content && !data.isTool && !data.isError && !data.audioUrl) {
          speak(data.content);
        }
      }
    });

    newSocket.on('agent_status', (data: { sessionId?: string; agentId: string; status: 'idle' | 'working', message?: string; toolName?: string }) => {
      if (data.sessionId) {
        setSessionWorkingMap(prev => ({ ...prev, [data.sessionId!]: data.status === 'working' }));
        setSessionStatusMap(prev => ({ ...prev, [data.sessionId!]: data.status === 'idle' ? '' : (data.message || '') }));
        setSessionToolMap(prev => ({ ...prev, [data.sessionId!]: data.status === 'idle' ? undefined : data.toolName }));
      }

      const isCurrentSession = !data.sessionId || data.sessionId === activeSessionIdRef.current;

      // Only update active UI (isTyping, currentStatus) if event belongs to current active session
      if (isCurrentSession) {
        if (data.agentId === 'orchestrator' || !data.agentId) {
          setIsTyping(data.status === 'working');
          if (data.status === 'idle') setCurrentStatus('');
          else if (data.message) setCurrentStatus(data.message);
        }

        // Only update activeAgents' visible task/tool if this event belongs to current active session
        // This strictly prevents background/cron tasks from contaminating the active chat UI!
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
      }
    });

    newSocket.on('task_activity', (act: TaskActivityEvent) => {
      // CRITICAL: Do NOT fall back to activeSessionIdRef.current if act.sessionId is missing.
      // Unscoped background activity must NEVER pollute the active session's task activity stream!
      const sId = act.sessionId;
      if (!sId) return;
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
        if (updatedSteps.length > 50) {
          updatedSteps = updatedSteps.slice(updatedSteps.length - 50);
        }
        return { ...prevMap, [sId]: updatedSteps };
      });
    });

    newSocket.on('agent_health', (data: { sessionId?: string; agentId: string; status: string; toolName?: string; elapsedSeconds: number; health: string }) => {
      if (data.sessionId && data.sessionId !== activeSessionIdRef.current) return;
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
      setIsTyping(false);
      setSessionWorkingMap(prev => ({ ...prev, [session.id]: false }));
      setSessionStatusMap(prev => ({ ...prev, [session.id]: '' }));
      setSessionToolMap(prev => ({ ...prev, [session.id]: undefined }));
      setSessionTaskSteps(prev => ({ ...prev, [session.id]: [] }));
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
      setIsTyping(Boolean(sessionWorkingMap[sessionId]));
      if (session?.channel && session.channel !== 'cron') {
        setActiveChannel(session.channel);
      } else {
        setActiveChannel('web');
      }
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
        // Cap at 200 entries to prevent memory bloat and browser crashes
        return next.length > 200 ? next.slice(next.length - 200) : next;
      });
      // ONLY update currentStatus if this log is for the CURRENT active session
      if (data.agentId === 'orchestrator' && data.sessionId && data.sessionId === activeSessionIdRef.current) {
        setCurrentStatus(data.message);
        setSessionStatusMap(prev => ({ ...prev, [data.sessionId!]: data.message }));
      }
    });

    newSocket.on('log_history', (history: LogEvent[]) => {
      // FIX: MERGE history with existing in-memory logs (capped at 200)
      setLogs((prev) => {
        if (!prev.length) return (history || []).slice(-200);
        const knownIds = new Set(prev.map((l) => l.id));
        const newEntries = (history || []).filter((l) => !knownIds.has(l.id));
        const merged = [...newEntries, ...prev];
        return merged.length > 200 ? merged.slice(merged.length - 200) : merged;
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

    newSocket.on('voice_message', (data: { url: string; text?: string; sessionId?: string }) => {
      if (data.sessionId && data.sessionId !== activeSessionIdRef.current) {
        return;
      }
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === 'assistant' && !last.audioUrl) {
          return prev.map((m, idx) => idx === prev.length - 1 ? { ...m, audioUrl: data.url } : m);
        }
        return [...prev, {
          id: Date.now().toString() + Math.random().toString(36).substring(7),
          sessionId: data.sessionId || activeSessionIdRef.current,
          role: 'assistant',
          agentId: 'orchestrator',
          content: '',
          audioUrl: data.url,
        }];
      });
    });

    newSocket.on('bookmarks_updated', () => {
      fetchBookmarks();
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
    setSessionToolMap(prev => ({ ...prev, [target]: undefined }));
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
      } else if (isConfiguringKey === 'ollama') {
        socket.emit('set_ollama_cloud_key', { apiKey: input });
        setIsConfiguringKey(null);
      } else if (isConfiguringKey === 'digitalocean') {
        socket.emit('set_digitalocean_key', { apiKey: input });
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
      } else if (isConfiguringKey === 'duffel') {
        socket.emit('set_duffel_key', { apiKey: input });
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
    setCurrentView('workspace');
    setSelectedImages([]);
    setInput('');
    socket?.emit('create_session', {
      channel: activeChannel,
      targetAgentId: selectedAgentId || 'orchestrator'
    });
  };

  const handleSelectSession = (sessionId: string) => {
    setCurrentView('workspace');
    setActiveSessionId(sessionId);
    socket?.emit('load_session', { sessionId });
    const target = sessions.find(s => s.id === sessionId);
    if (target?.channel && target.channel !== 'cron') {
      setActiveChannel(target.channel);
    } else {
      setActiveChannel('web');
    }
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
    setSessionToolMap(prev => {
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
      {isSidebarOpen && (
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
          setActiveChannel={handleChannelChange}
          activeSessionId={activeSessionId}
          setActiveSessionId={(id) => {
            setCurrentView('workspace');
            setActiveSessionId(id);
          }}
          sessions={sessions}
          sessionWorkingMap={sessionWorkingMap}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          onOpenWhatsApp={() => {
            setCurrentView('workspace');
            setActiveChannel('whatsapp');
            setSelectedAgentId(null);
          }}
          whatsappConnected={whatsappStatus.connected}
          onOpenSkills={() => {
            setInspectorTab('skills');
            setShowInspector(true);
            const agentToInspect = selectedAgentId || 'orchestrator';
            setSelectedAgentId(agentToInspect);
            socket?.emit('request_agent_details', { agentId: agentToInspect });
          }}
          onOpenArtifacts={() => {
            fetchFiles();
            setShowFiles(true);
          }}
          onOpenBookmarks={() => {
            fetchBookmarks();
            setCurrentView(prev => prev === 'bookmarks' ? 'workspace' : 'bookmarks');
          }}
          bookmarksCount={bookmarks.length}
          isBookmarksActive={currentView === 'bookmarks'}
          onOpenBacklog={() => {
            setCurrentView(prev => prev === 'backlog' ? 'workspace' : 'backlog');
          }}
          isBacklogActive={currentView === 'backlog'}
          onOpenMessaging={() => {
            setCurrentView('workspace');
            setActiveChannel(activeChannel === 'whatsapp' ? 'web' : 'whatsapp');
            setSelectedAgentId(null);
          }}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />
      )}
      
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <Header
          toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
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
            setCurrentView('workspace');
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
          currentStatus={sessionStatusMap[activeSessionId] || ''}
          isCurrentSessionWorking={Boolean(sessionWorkingMap[activeSessionId])}
          handleStop={() => handleStop(activeSessionId)}
          onOpenSettings={() => setShowSettingsModal(true)}
          onOpenBookmarks={() => {
            fetchBookmarks();
            setCurrentView(prev => prev === 'bookmarks' ? 'workspace' : 'bookmarks');
          }}
          bookmarksCount={bookmarks.length}
          isBookmarksActive={currentView === 'bookmarks'}
          activeSessionId={activeSessionId}
        />

        {currentView === 'backlog' ? (
          <BacklogBoard socket={socket} />
        ) : currentView === 'bookmarks' ? (
          <BookmarksPage
            bookmarks={bookmarks}
            onRefresh={fetchBookmarks}
            onDeleteBookmark={handleDeleteBookmark}
            onSelectSession={(sessionId) => {
              handleSelectSession(sessionId);
              setCurrentView('workspace');
            }}
            onBackToWorkspace={() => setCurrentView('workspace')}
          />
        ) : activeChannel === 'whatsapp' ? (
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
              currentStatus={sessionStatusMap[activeSessionId] || ''}
              activeTool={sessionToolMap[activeSessionId]}
              taskSteps={sessionTaskSteps[activeSessionId] || []}
              isCurrentSessionWorking={Boolean(sessionWorkingMap[activeSessionId])}
              activeSessionId={activeSessionId}
              setEnlargedImage={setEnlargedImage}
              messagesEndRef={messagesEndRef}
              handleStop={() => handleStop(activeSessionId)}
              activeChannel={activeChannel}
              selectedAgentId={selectedAgentId}
              sessionTitle={sessionTitle}
              subagentsUsed={subagentsUsed}
              onOpenLogs={() => setShowLogs(true)}
              bookmarkedMessageIds={bookmarkedIds}
              onToggleBookmark={handleToggleBookmark}
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
              handleStop={() => handleStop(activeSessionId)}
              isCurrentSessionWorking={Boolean(sessionWorkingMap[activeSessionId])}
              activeSessionId={activeSessionId}
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
          onClose={() => setShowLogs(false)}
        />
      )}

      {showFiles && (
        <KnowledgeExplorer
          files={files}
          fetchFiles={fetchFiles}
          readFile={readFile}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          onClose={() => setShowFiles(false)}
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

      {showUsageDashboard && (
        <UsageDashboard
          detailedStats={detailedStats}
          systemStats={systemStats}
          onClose={() => setShowUsageDashboard(false)}
        />
      )}

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
        onSelectSession={(sessionId) => {
          handleSelectSession(sessionId);
          setShowMissionControl(false);
        }}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        aiProvider={aiProvider}
        setAiProvider={setAiProvider}
        keyStatus={keyStatus}
        socket={socket}
        ollamaStatus={ollamaStatus}
      />

      {showInspector && selectedAgentDetails && (
        <AgentInspectorModal
          selectedAgentDetails={selectedAgentDetails}
          setShowInspector={setShowInspector}
          inspectorTab={inspectorTab}
          setInspectorTab={setInspectorTab}
        />
      )}

      <ImageModal
        enlargedImage={enlargedImage}
        setEnlargedImage={setEnlargedImage}
      />
    </div>
  );
}
