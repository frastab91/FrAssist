import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Bot, 
  Layers, 
  MessageSquare, 
  FileText, 
  Search, 
  Equal, 
  MoreHorizontal, 
  Trash2, 
  Pin, 
  Loader2, 
  X,
  Settings,
  Brain,
  ChevronDown,
  Plus,
  Clock,
  Bookmark
} from 'lucide-react';
import type { Agent, SystemStats, ChatSession } from '../types';
import { Socket } from 'socket.io-client';

type SidebarProps = {
  setShowCreateModal: (show: boolean) => void;
  activeAgents: Agent[];
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  setShowInspector: (show: boolean) => void;
  socket: Socket | null;
  ollamaStatus: any;
  systemStats: SystemStats;
  heartbeat: any;
  onUsageClick: () => void;
  activeChannel: 'web' | 'whatsapp' | 'telegram' | 'agent';
  setActiveChannel: (channel: 'web' | 'whatsapp' | 'telegram' | 'agent') => void;
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  sessions: ChatSession[];
  sessionWorkingMap?: Record<string, boolean>;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
  onOpenWhatsApp: () => void;
  whatsappConnected: boolean;
  onOpenSkills?: () => void;
  onOpenArtifacts?: () => void;
  onOpenBookmarks?: () => void;
  bookmarksCount?: number;
  isBookmarksActive?: boolean;
  onOpenMessaging?: () => void;
  onToggleSidebar?: () => void;
};

function GridDotIcon({ size = 12, color = '#2563eb' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill={color} style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
      <rect x="0" y="0" width="2.5" height="2.5" rx="0.5" />
      <rect x="4.75" y="0" width="2.5" height="2.5" rx="0.5" />
      <rect x="9.5" y="0" width="2.5" height="2.5" rx="0.5" />
      <rect x="0" y="4.75" width="2.5" height="2.5" rx="0.5" />
      <rect x="4.75" y="4.75" width="2.5" height="2.5" rx="0.5" />
      <rect x="9.5" y="4.75" width="2.5" height="2.5" rx="0.5" />
      <rect x="0" y="9.5" width="2.5" height="2.5" rx="0.5" />
      <rect x="4.75" y="9.5" width="2.5" height="2.5" rx="0.5" />
      <rect x="9.5" y="9.5" width="2.5" height="2.5" rx="0.5" />
    </svg>
  );
}

function SidebarToggleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="2.5" />
      <line x1="6.5" y1="2" x2="6.5" y2="14" />
    </svg>
  );
}

function PinHelperIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(-45deg)', flexShrink: 0 }}>
      <line x1="12" y1="17" x2="12" y2="22" />
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.89A2 2 0 0 1 15 10.77V6a3 3 0 0 0-6 0v4.77a2 2 0 0 1-1.11 1.79l-1.78.89A2 2 0 0 0 5 15.24Z" />
    </svg>
  );
}

function formatRelativeTime(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (isNaN(diffSec) || diffSec < 90) return 'now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
    if (diffSec < 172800) return '1d';
    return `${Math.floor(diffSec / 86400)}d`;
  } catch (e) {
    return 'now';
  }
}

export function Sidebar({
  setShowCreateModal,
  activeAgents,
  selectedAgentId,
  setSelectedAgentId,
  setShowInspector,
  socket,
  ollamaStatus,
  systemStats,
  heartbeat,
  onUsageClick,
  activeChannel,
  setActiveChannel,
  activeSessionId,
  setActiveSessionId,
  sessions,
  sessionWorkingMap = {},
  onNewChat,
  onDeleteSession,
  onOpenWhatsApp,
  whatsappConnected,
  onOpenSkills,
  onOpenArtifacts,
  onOpenBookmarks,
  bookmarksCount = 0,
  isBookmarksActive = false,
  onOpenMessaging,
  onToggleSidebar,
}: SidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [menuOpenSessionId, setMenuOpenSessionId] = useState<string | null>(null);
  const [showStatusDrawer, setShowStatusDrawer] = useState(false);
  
  // Pinned Sessions State (persisted in localStorage)
  const [pinnedSessionIds, setPinnedSessionIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('frassist_pinned_sessions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Inspect specialized agent handler
  const handleInspectAgent = (agentId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedAgentId(agentId);
    setShowInspector(true);
    socket?.emit('request_agent_details', { agentId });
  };

  // Delete specialized agent handler
  const handleDeleteAgent = (agentId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete ${agentId}?`)) {
      socket?.emit('delete_agent', { agentId });
      if (selectedAgentId === agentId) {
        setSelectedAgentId(null);
        setActiveChannel('web');
      }
    }
  };

  // Sync pinned sessions to localStorage
  const togglePinSession = (sessionId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setPinnedSessionIds(prev => {
      const next = prev.includes(sessionId)
        ? prev.filter(id => id !== sessionId)
        : [...prev, sessionId];
      try {
        localStorage.setItem('frassist_pinned_sessions', JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save pinned sessions', err);
      }
      return next;
    });
    setMenuOpenSessionId(null);
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenSessionId(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Keyboard shortcut listener: Shift + N for new agent / chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'N' || e.key === 'n') && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setShowCreateModal(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setShowCreateModal]);

  // Focus search input when toggled open
  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  // Handle session item click (supports Shift+Click to pin)
  const handleSessionClick = (session: ChatSession, e: React.MouseEvent) => {
    if (e.shiftKey) {
      togglePinSession(session.id, e);
      return;
    }
    setActiveSessionId(session.id);
    if (session.channel && session.channel !== 'cron' && session.channel !== activeChannel) {
      setActiveChannel(session.channel);
    } else if (session.channel === 'cron' && activeChannel !== 'web') {
      setActiveChannel('web');
    }
    socket?.emit('load_session', { sessionId: session.id });
  };

  // Filter sessions based on search query
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(s => s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  // Filter active agents based on search query
  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return activeAgents;
    const q = searchQuery.toLowerCase();
    return activeAgents.filter(a => a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q) || a.id.toLowerCase().includes(q));
  }, [activeAgents, searchQuery]);

  // Separate pinned and unpinned sessions
  const pinnedSessions = useMemo(() => {
    return filteredSessions.filter(s => pinnedSessionIds.includes(s.id));
  }, [filteredSessions, pinnedSessionIds]);

  const regularSessions = useMemo(() => {
    return filteredSessions.filter(s => !pinnedSessionIds.includes(s.id));
  }, [filteredSessions, pinnedSessionIds]);

  return (
    <aside className="macos-sidebar">
      {/* Top Header Icons (Toggle Sidebar, Search) */}
      <div className="macos-sidebar-top-bar">
        <button
          onClick={onToggleSidebar}
          className="top-bar-icon-btn"
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <SidebarToggleIcon size={16} />
        </button>

        <button
          onClick={() => {
            setIsSearchOpen(!isSearchOpen);
            if (isSearchOpen) setSearchQuery('');
          }}
          className={`top-bar-icon-btn ${isSearchOpen ? 'active' : ''}`}
          title="Search chats & agents"
          aria-label="Search chats & agents"
        >
          <Search size={16} />
        </button>
      </div>

      {/* Inline Search Bar (Expands smoothly) */}
      {isSearchOpen && (
        <div className="macos-sidebar-search-box">
          <Search size={13} className="search-box-icon" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search chats & agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-box-input"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="search-box-clear">
              <X size={12} />
            </button>
          )}
        </div>
      )}

      {/* Primary Top Action Navigation */}
      <div className="macos-nav-list">
        {/* 0. New chat */}
        <button 
          onClick={onNewChat}
          className="macos-nav-item new-chat-nav-item"
        >
          <div className="nav-item-left">
            <Plus size={17} className="nav-item-icon" />
            <span className="nav-item-label">New chat</span>
          </div>
        </button>

        {/* 1. New agent */}
        <button 
          onClick={() => setShowCreateModal(true)}
          className="macos-nav-item"
        >
          <div className="nav-item-left">
            <Bot size={17} className="nav-item-icon" />
            <span className="nav-item-label">New agent</span>
          </div>
          <div className="kbd-shortcut-group">
            <span className="kbd-badge">⇧</span>
            <span className="kbd-badge">N</span>
          </div>
        </button>

        {/* 2. Skills */}
        <button 
          onClick={() => {
            if (onOpenSkills) {
              onOpenSkills();
            } else {
              setShowInspector(true);
            }
          }}
          className="macos-nav-item"
        >
          <div className="nav-item-left">
            <Layers size={17} className="nav-item-icon" />
            <span className="nav-item-label">Skills</span>
          </div>
        </button>

        {/* 3. Messaging */}
        <button 
          onClick={() => {
            if (onOpenMessaging) {
              onOpenMessaging();
            } else {
              onOpenWhatsApp();
            }
          }}
          className={`macos-nav-item ${activeChannel === 'whatsapp' ? 'active-channel' : ''}`}
        >
          <div className="nav-item-left">
            <MessageSquare size={17} className="nav-item-icon" />
            <span className="nav-item-label">Messaging</span>
          </div>
          {whatsappConnected && (
            <span className="channel-indicator-dot" title="WhatsApp Connected" />
          )}
        </button>

        {/* 4. Artifacts */}
        <button 
          onClick={() => {
            if (onOpenArtifacts) {
              onOpenArtifacts();
            }
          }}
          className="macos-nav-item"
        >
          <div className="nav-item-left">
            <FileText size={17} className="nav-item-icon" />
            <span className="nav-item-label">Artifacts</span>
          </div>
        </button>

        {/* 5. Bookmarks */}
        <button 
          onClick={() => {
            if (onOpenBookmarks) {
              onOpenBookmarks();
            }
          }}
          className={`macos-nav-item ${isBookmarksActive ? 'active-bookmark' : ''}`}
          title="View Saved Bookmarks"
        >
          <div className="nav-item-left">
            <Bookmark size={17} className="nav-item-icon" color="#d97706" />
            <span className="nav-item-label">Bookmarks</span>
          </div>
          {bookmarksCount > 0 && (
            <span style={{
              background: '#fef3c7',
              color: '#b45309',
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '10px',
              border: '1px solid #fde68a'
            }}>
              {bookmarksCount}
            </span>
          )}
        </button>
      </div>

      {/* Main Scrollable Content Area */}
      <div className="macos-sidebar-scroll-body">
        
        {/* SECTION 1: PINNED */}
        <div className="macos-section">
          <div className="macos-section-header">
            <GridDotIcon size={12} color="#2563eb" />
            <span className="section-title-text">PINNED</span>
          </div>

          {pinnedSessions.length === 0 ? (
            <div className="pinned-empty-state">
              <PinHelperIcon size={14} />
              <span>Shift click to pin a chat</span>
            </div>
          ) : (
            <div className="session-items-list">
              {pinnedSessions.map((session) => {
                const isSelected = activeSessionId === session.id;
                const isWorking = Boolean(sessionWorkingMap[session.id]);
                const isMenuOpen = menuOpenSessionId === session.id;

                return (
                  <div
                    key={`pinned-${session.id}`}
                    onClick={(e) => handleSessionClick(session, e)}
                    className={`session-row ${isSelected ? 'selected' : ''}`}
                    title={`${session.title} (Shift-click to unpin)`}
                  >
                    {isSelected ? (
                      <div className="row-left-handle">
                        <Equal size={14} className="handle-icon" />
                      </div>
                    ) : (
                      <div className="row-left-dot">
                        <Pin size={11} className="pinned-row-pin-icon" />
                      </div>
                    )}

                    <span className="session-title-text" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {(session.channel === 'cron' || session.id.startsWith('session_cron_')) && (
                        <Clock size={12} style={{ color: '#2563eb', flexShrink: 0 }} />
                      )}
                      <span>{session.title || 'Untitled Session'}</span>
                    </span>

                    {isSelected ? (
                      <div className="row-right-actions" onClick={e => e.stopPropagation()}>
                        <span className="session-timestamp">
                          {isWorking ? (
                            <Loader2 size={11} className="spin-icon text-blue" />
                          ) : (
                            formatRelativeTime(session.updatedAt)
                          )}
                        </span>
                        <button
                          onClick={() => setMenuOpenSessionId(isMenuOpen ? null : session.id)}
                          className="row-menu-btn"
                          title="More options"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="row-hover-actions" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => togglePinSession(session.id, e)}
                          className="hover-action-btn"
                          title="Unpin chat"
                        >
                          <Pin size={11} className="active-pin" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this chat?')) onDeleteSession(session.id);
                          }}
                          className="hover-action-btn hover-delete"
                          title="Delete session"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}

                    {/* Context Dropdown Menu */}
                    {isMenuOpen && (
                      <div className="session-context-menu" ref={menuRef}>
                        <button
                          onClick={(e) => togglePinSession(session.id, e)}
                          className="menu-dropdown-item"
                        >
                          <Pin size={13} /> Unpin from top
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenSessionId(null);
                            if (confirm('Delete this chat session?')) {
                              onDeleteSession(session.id);
                            }
                          }}
                          className="menu-dropdown-item text-danger"
                        >
                          <Trash2 size={13} /> Delete chat
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: SPECIALIZED AGENTS */}
        <div className="macos-section">
          <div className="macos-section-header">
            <GridDotIcon size={12} color="#2563eb" />
            <span className="section-title-text">SPECIALIZED AGENTS</span>
            <span className="section-count-badge">{filteredAgents.length}</span>
            <button
              onClick={() => setShowCreateModal(true)}
              className="section-header-add-btn"
              title="Create new specialized agent"
            >
              <Plus size={12} />
            </button>
          </div>

          <div className="session-items-list">
            {filteredAgents.length === 0 ? (
              <div className="empty-sessions-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Loader2 size={12} className="spin-icon text-blue" />
                <span>Loading agents...</span>
              </div>
            ) : (
              filteredAgents.map((agent) => {
                const isSelected = selectedAgentId === agent.id && activeChannel === 'agent';
                const isWorking = agent.status === 'working';

                return (
                  <div
                    key={agent.id}
                    onClick={() => {
                      setSelectedAgentId(agent.id);
                      setActiveChannel('agent');
                      const agentSession = sessions.find(s => s.targetAgent === agent.id && s.channel === 'agent');
                      if (agentSession) {
                        setActiveSessionId(agentSession.id);
                        socket?.emit('load_session', { sessionId: agentSession.id });
                      } else {
                        socket?.emit('create_session', {
                          channel: 'agent',
                          targetAgentId: agent.id,
                          title: `${agent.name} Chat`
                        });
                      }
                    }}
                    className={`session-row ${isSelected ? 'selected' : ''}`}
                    title={`${agent.name} (${agent.role}) - Click to chat, click gear to inspect`}
                  >
                    {isSelected ? (
                      <div className="row-left-handle">
                        <Equal size={14} className="handle-icon" />
                      </div>
                    ) : (
                      <div className="row-left-dot">
                        <span className={`agent-status-indicator ${isWorking ? 'working' : 'idle'}`} />
                      </div>
                    )}

                    <div className="agent-row-info">
                      <span className="session-title-text">{agent.name}</span>
                      <span className="agent-role-caption">{agent.role}</span>
                    </div>

                    {/* Always accessible actions on selected, and hover actions on unselected */}
                    <div className={isSelected ? "row-right-actions" : "row-hover-actions"} onClick={e => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleInspectAgent(agent.id, e)}
                        className="hover-action-btn"
                        title="Inspect agent rules, skills & memory"
                      >
                        <Settings size={12} />
                      </button>
                      {agent.id !== 'orchestrator' && (
                        <button
                          onClick={(e) => handleDeleteAgent(agent.id, e)}
                          className="hover-action-btn hover-delete"
                          title="Delete agent"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SECTION 3: SESSIONS / PAST CHATS */}
        <div className="macos-section">
          <div className="macos-section-header">
            <GridDotIcon size={12} color="#2563eb" />
            <span className="section-title-text">CHATS</span>
            <span className="section-count-badge">{regularSessions.length}</span>
            <button
              onClick={onNewChat}
              className="section-header-add-btn"
              title="Start new chat"
            >
              <Plus size={12} />
            </button>
          </div>

          <div className="session-items-list">
            {regularSessions.length === 0 ? (
              <div className="empty-sessions-hint">
                No past chat sessions yet.
              </div>
            ) : (
              regularSessions.map((session) => {
                const isSelected = activeSessionId === session.id;
                const isWorking = Boolean(sessionWorkingMap[session.id]);
                const isMenuOpen = menuOpenSessionId === session.id;

                return (
                  <div
                    key={session.id}
                    onClick={(e) => handleSessionClick(session, e)}
                    className={`session-row ${isSelected ? 'selected' : ''}`}
                    title={`${session.title} (Shift-click to pin)`}
                  >
                    {isSelected ? (
                      <div className="row-left-handle">
                        <Equal size={14} className="handle-icon" />
                      </div>
                    ) : (
                      <div className="row-left-dot">
                        <span className={`bullet-dot ${isWorking ? 'working-pulse' : ''}`} />
                      </div>
                    )}

                    <span className="session-title-text" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {(session.channel === 'cron' || session.id.startsWith('session_cron_')) && (
                        <Clock size={12} style={{ color: '#2563eb', flexShrink: 0 }} />
                      )}
                      <span>{session.title || 'Untitled Session'}</span>
                    </span>

                    {isSelected ? (
                      <div className="row-right-actions" onClick={e => e.stopPropagation()}>
                        <span className="session-timestamp">
                          {isWorking ? (
                            <Loader2 size={11} className="spin-icon text-blue" />
                          ) : (
                            formatRelativeTime(session.updatedAt)
                          )}
                        </span>
                        <button
                          onClick={() => setMenuOpenSessionId(isMenuOpen ? null : session.id)}
                          className="row-menu-btn"
                          title="More options"
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="row-hover-actions" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => togglePinSession(session.id, e)}
                          className="hover-action-btn"
                          title="Pin chat (Shift-click)"
                        >
                          <Pin size={11} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Delete this chat?')) onDeleteSession(session.id);
                          }}
                          className="hover-action-btn hover-delete"
                          title="Delete session"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    )}

                    {/* Context Dropdown Menu */}
                    {isMenuOpen && (
                      <div className="session-context-menu" ref={menuRef}>
                        <button
                          onClick={(e) => togglePinSession(session.id, e)}
                          className="menu-dropdown-item"
                        >
                          <Pin size={13} /> Pin to top
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuOpenSessionId(null);
                            if (confirm('Delete this chat session?')) {
                              onDeleteSession(session.id);
                            }
                          }}
                          className="menu-dropdown-item text-danger"
                        >
                          <Trash2 size={13} /> Delete chat
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Minimalist Collapsible Status / Usage Bar at Bottom */}
      <div className="macos-sidebar-footer">
        <div 
          className="footer-status-bar"
          onClick={() => setShowStatusDrawer(!showStatusDrawer)}
          title="Click to view System Status & Token Usage"
        >
          <div className="status-bar-left">
            <span className="system-indicator-dot" />
            <span className="status-bar-label">
              {ollamaStatus?.status === 'Running' || ollamaStatus?.status === 'Active' ? 'Ollama Active' : 'System Ready'}
            </span>
          </div>
          <div className="status-bar-right">
            <span className="status-tokens-text">
              {((systemStats.total_input_tokens + systemStats.total_output_tokens) / 1000).toFixed(1)}k tok
            </span>
            <ChevronDown 
              size={12} 
              className={`footer-chevron ${showStatusDrawer ? 'open' : ''}`} 
            />
          </div>
        </div>

        {/* Expanded Details Drawer */}
        {showStatusDrawer && (
          <div className="footer-drawer-content">
            {heartbeat && (
              <div className="drawer-metric-row">
                <span className="metric-name">CPU / MEM</span>
                <span className="metric-val">
                  {heartbeat.cpu?.[0]?.toFixed(1) || '0.0'}% / {heartbeat.mem?.usage?.toFixed(0) || '0'}%
                </span>
              </div>
            )}
            <div 
              className="drawer-metric-row clickable"
              onClick={onUsageClick}
            >
              <span className="metric-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Brain size={12} color="#3b82f6" /> Usage Dashboard
              </span>
              <span className="metric-link">View &rarr;</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
