import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Bookmark, 
  Search, 
  X, 
  Trash2, 
  Download, 
  Copy, 
  Check, 
  Calendar, 
  Bot, 
  User, 
  Folder, 
  RefreshCw, 
  FileText, 
  ExternalLink,
  Code,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import type { BookmarkItem } from '../types';

type BookmarksPageProps = {
  bookmarks: BookmarkItem[];
  onRefresh: () => void;
  onDeleteBookmark: (filename: string) => void;
  onSelectSession?: (sessionId: string) => void;
  onBackToWorkspace?: () => void;
};

export function BookmarksPage({
  bookmarks,
  onRefresh,
  onDeleteBookmark,
  onSelectSession,
  onBackToWorkspace,
}: BookmarksPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'assistant' | 'user'>('all');
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const [isRawView, setIsRawView] = useState(false);
  const [copied, setCopied] = useState(false);

  // Filter and sort bookmarks
  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter(b => {
      // Role filter
      if (roleFilter !== 'all' && b.role !== roleFilter) return false;
      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        b.title.toLowerCase().includes(q) ||
        b.content.toLowerCase().includes(q) ||
        (b.agentId && b.agentId.toLowerCase().includes(q)) ||
        b.filename.toLowerCase().includes(q)
      );
    });
  }, [bookmarks, roleFilter, searchQuery]);

  // Selected item
  const selectedItem = useMemo(() => {
    if (!selectedFilename && filteredBookmarks.length > 0) {
      return filteredBookmarks[0];
    }
    return filteredBookmarks.find(b => b.filename === selectedFilename) || null;
  }, [filteredBookmarks, selectedFilename]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (filename: string) => {
    window.open(`/api/bookmarks/download/${encodeURIComponent(filename)}`, '_blank');
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      width: '100%',
      background: '#f8fafc',
      overflow: 'hidden'
    }}>
      {/* Top Banner / Navigation Header */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        gap: '1rem',
        zIndex: 5
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #fde68a',
            boxShadow: '0 2px 6px rgba(217, 119, 6, 0.15)',
            flexShrink: 0
          }}>
            <Bookmark size={20} color="#d97706" fill="#d97706" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Saved Bookmarks
              </h2>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                background: '#fef3c7',
                color: '#b45309',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid #fde68a'
              }}>
                {bookmarks.length} {bookmarks.length === 1 ? 'note' : 'notes'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
              <Folder size={13} color="#94a3b8" />
              <span>Saved as Markdown files in <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: '4px', color: '#334155', border: '1px solid #e2e8f0' }}>backend/bookmarks/</code></span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button
            onClick={onRefresh}
            title="Refresh bookmarks list"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.85rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#475569',
              fontSize: '0.82rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
            onMouseLeave={e => (e.currentTarget.style.background = '#ffffff')}
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>

          {onBackToWorkspace && (
            <button
              onClick={onBackToWorkspace}
              title="Return to Chat Workspace"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#eff6ff';
                e.currentTarget.style.borderColor = '#93c5fd';
                e.currentTarget.style.color = '#1d4ed8';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.borderColor = '#cbd5e1';
                e.currentTarget.style.color = '#0f172a';
              }}
            >
              <ArrowLeft size={14} />
              <span>Back to Chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div style={{
        padding: '0.75rem 1.5rem',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        background: '#ffffff',
        flexShrink: 0
      }}>
        {/* Search Box */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '0.45rem 0.85rem',
          width: '360px'
        }}>
          <Search size={15} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search bookmarks by title or content..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '0.82rem',
              width: '100%',
              color: '#1e293b'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', marginRight: '0.25rem' }}>Filter:</span>
          {(['all', 'assistant', 'user'] as const).map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              style={{
                padding: '0.35rem 0.8rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid',
                borderColor: roleFilter === role ? '#3b82f6' : '#e2e8f0',
                background: roleFilter === role ? '#eff6ff' : '#ffffff',
                color: roleFilter === role ? '#1d4ed8' : '#64748b',
                transition: 'all 0.15s ease'
              }}
            >
              {role === 'all' ? 'All' : role === 'assistant' ? 'Assistant' : 'User'}
            </button>
          ))}
        </div>
      </div>

      {/* Master-Detail Body */}
      <div style={{
        display: 'flex',
        flex: '1 1 0%',
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* Left List Pane */}
        <div style={{
          width: '380px',
          borderRight: '1px solid #e2e8f0',
          overflowY: 'auto',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          {filteredBookmarks.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: '2.5rem',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '14px',
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.85rem'
              }}>
                <Bookmark size={26} color="#94a3b8" />
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#1e293b' }}>
                {bookmarks.length === 0 ? 'No bookmarks saved yet' : 'No matching bookmarks'}
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: '0.4rem', lineHeight: '1.45', color: '#64748b' }}>
                {bookmarks.length === 0 
                  ? 'Click the bookmark icon on any message in chat to save it as a Markdown file.' 
                  : 'Try clearing your search query or adjusting the role filter.'}
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    marginTop: '1rem',
                    padding: '0.4rem 0.85rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: 'white',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: '#2563eb',
                    cursor: 'pointer'
                  }}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div style={{ padding: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filteredBookmarks.map((item) => {
                const isSelected = selectedItem?.filename === item.filename;
                return (
                  <div
                    key={item.filename}
                    onClick={() => setSelectedFilename(item.filename)}
                    style={{
                      padding: '0.85rem',
                      borderRadius: '10px',
                      background: isSelected ? '#ffffff' : 'transparent',
                      border: '1px solid',
                      borderColor: isSelected ? '#3b82f6' : 'transparent',
                      boxShadow: isSelected ? '0 4px 12px rgba(59, 130, 246, 0.08)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.4rem',
                      position: 'relative'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.background = '#ffffff';
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }
                    }}
                  >
                    {/* Title & Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{
                        fontWeight: 600,
                        fontSize: '0.86rem',
                        color: isSelected ? '#1d4ed8' : '#0f172a',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                      }}>
                        {item.title || 'Untitled Note'}
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        color: '#94a3b8',
                        flexShrink: 0
                      }}>
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    {/* Preview Snippet */}
                    <p style={{
                      margin: 0,
                      fontSize: '0.78rem',
                      color: '#64748b',
                      lineHeight: '1.45',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {item.preview || 'No content preview available'}
                    </p>

                    {/* Badges footer */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.2rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.68rem',
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        background: item.role === 'assistant' ? '#eff6ff' : '#f1f5f9',
                        color: item.role === 'assistant' ? '#2563eb' : '#475569',
                        border: '1px solid',
                        borderColor: item.role === 'assistant' ? '#dbeafe' : '#e2e8f0'
                      }}>
                        {item.role === 'assistant' ? <Bot size={11} /> : <User size={11} />}
                        {item.agentId || (item.role === 'assistant' ? 'Orchestrator' : 'User')}
                      </span>

                      {item.model && (
                        <span style={{
                          fontSize: '0.66rem',
                          color: '#64748b',
                          background: '#f8fafc',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          border: '1px solid #e2e8f0'
                        }}>
                          {item.model}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Detail Pane */}
        <div style={{
          flex: '1 1 0%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          overflow: 'hidden'
        }}>
          {selectedItem ? (
            <>
              {/* Detail Header Bar */}
              <div style={{
                padding: '1rem 1.75rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                background: '#ffffff',
                flexShrink: 0
              }}>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    color: '#0f172a',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {selectedItem.title}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.3rem', fontSize: '0.75rem', color: '#64748b', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={13} /> {selectedItem.filename}
                    </span>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} /> {new Date(selectedItem.createdAt).toLocaleString()}
                    </span>
                    {selectedItem.size > 0 && (
                      <>
                        <span>•</span>
                        <span>{(selectedItem.size / 1024).toFixed(1)} KB</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Actions Toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  {/* Raw / Formatted Toggle */}
                  <button
                    onClick={() => setIsRawView(!isRawView)}
                    title={isRawView ? 'View Rendered Markdown' : 'View Raw Markdown & Frontmatter'}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: isRawView ? '#f1f5f9' : '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    <Code size={14} />
                    <span>{isRawView ? 'Formatted' : 'Raw'}</span>
                  </button>

                  {/* Copy Button */}
                  <button
                    onClick={() => handleCopy(selectedItem.rawContent || selectedItem.content)}
                    title="Copy markdown content to clipboard"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: copied ? '#ecfdf5' : '#ffffff',
                      color: copied ? '#059669' : '#334155',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>

                  {/* Download Button */}
                  <button
                    onClick={() => handleDownload(selectedItem.filename)}
                    title="Download Markdown file"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: '#334155',
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={14} />
                    <span>Export</span>
                  </button>

                  {/* Jump to Session */}
                  {selectedItem.sessionId && onSelectSession && (
                    <button
                      onClick={() => {
                        onSelectSession(selectedItem.sessionId!);
                      }}
                      title="Jump to original chat session"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.4rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid #e2e8f0',
                        background: '#eff6ff',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        color: '#2563eb',
                        cursor: 'pointer'
                      }}
                    >
                      <ExternalLink size={14} />
                      <span>Chat</span>
                    </button>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete bookmark "${selectedItem.title}"? This will remove the file from your bookmarks directory.`)) {
                        onDeleteBookmark(selectedItem.filename);
                      }
                    }}
                    title="Delete bookmark"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      borderRadius: '6px',
                      border: '1px solid #fee2e2',
                      background: '#fff5f5',
                      color: '#dc2626',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#dc2626';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = '#fff5f5';
                      e.currentTarget.style.color = '#dc2626';
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Content Reader Body */}
              <div style={{
                flex: '1 1 0%',
                minHeight: 0,
                overflowY: 'auto',
                padding: '2rem',
                fontSize: '0.94rem',
                lineHeight: '1.7',
                color: '#1e293b'
              }}>
                {isRawView ? (
                  <pre style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.25rem',
                    fontSize: '0.84rem',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0
                  }}>
                    {selectedItem.rawContent || selectedItem.content}
                  </pre>
                ) : (
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {selectedItem.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#94a3b8'
            }}>
              <Sparkles size={36} color="#cbd5e1" />
              <span style={{ marginTop: '0.75rem', fontSize: '0.9rem' }}>Select a bookmark to view its contents</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
