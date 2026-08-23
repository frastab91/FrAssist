import { useState, useEffect, useMemo } from 'react';
import { MessageSquare, X, CheckCircle2, QrCode, Smartphone, RefreshCw, LogOut, Send, AlertCircle, ShieldCheck, Inbox, Check, Zap, Sparkles, Pause, Play, Download, ChevronDown, ChevronUp, AlertOctagon } from 'lucide-react';
import { Socket } from 'socket.io-client';

type WhatsAppStatus = {
  connected: boolean;
  user: {
    id: string;
    phone: string;
    name: string;
  } | null;
  qr: string | null;
  isConnecting?: boolean;
};

type WhatsAppMsg = {
  id: string;
  senderPhone?: string;
  from?: string;
  remoteJid?: string;
  senderName: string;
  fromMe: boolean;
  text: string;
  replied: boolean;
  timestamp: number;
};

type AutoReplyContact = {
  remoteJid: string;
  phone: string;
  contactName: string;
  enabled: boolean;
};

type ContactConversation = {
  contactKey: string;
  contactPhone: string;
  contactName: string;
  remoteJid?: string;
  latestTimestamp: number;
  unrepliedCount: number;
  messages: WhatsAppMsg[];
};

type WhatsAppModalProps = {
  show: boolean;
  onClose: () => void;
  status: WhatsAppStatus;
  socket: Socket | null;
};

export function WhatsAppModal({ show, onClose, status, socket }: WhatsAppModalProps) {
  const [activeTab, setActiveTab] = useState<'messages' | 'send'>('messages');
  const [messages, setMessages] = useState<WhatsAppMsg[]>([]);
  const [autoReplies, setAutoReplies] = useState<AutoReplyContact[]>([]);
  const [filter, setFilter] = useState<'all' | 'unreplied' | 'latest'>('unreplied');
  const [expandedContacts, setExpandedContacts] = useState<{ [key: string]: boolean }>({});
  const [testNumber, setTestNumber] = useState('');
  const [testMessage, setTestMessage] = useState('Hello from FrAssist Agent! 🚀');
  const [securityCode, setSecurityCode] = useState('1234');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!socket || !show) return;

    // Fetch initial messages and auto-replies
    socket.emit('whatsapp_get_messages', { filter: 'all' });
    socket.emit('whatsapp_get_auto_replies');

    const handleMessagesList = (data: { messages: WhatsAppMsg[] }) => {
      if (data && data.messages) {
        setMessages(data.messages);
      }
    };

    const handleAutoRepliesList = (list: AutoReplyContact[]) => {
      if (Array.isArray(list)) {
        setAutoReplies(list);
      }
    };

    const handleIncomingMessage = (newMsg: WhatsAppMsg) => {
      const normalized: WhatsAppMsg = {
        ...newMsg,
        senderPhone: newMsg.senderPhone || newMsg.from || ''
      };
      setMessages(prev => [normalized, ...prev.filter(m => m.id !== normalized.id)]);
    };

    socket.on('whatsapp_messages_list', handleMessagesList);
    socket.on('whatsapp_auto_replies_list', handleAutoRepliesList);
    socket.on('whatsapp_message', handleIncomingMessage);

    return () => {
      socket.off('whatsapp_messages_list', handleMessagesList);
      socket.off('whatsapp_auto_replies_list', handleAutoRepliesList);
      socket.off('whatsapp_message', handleIncomingMessage);
    };
  }, [socket, show]);

  const isContactAutoReplyActive = (phone: string, remoteJid?: string, contactName?: string) => {
    const clean = (phone || '').replace(/[^0-9]/g, '');
    const cleanRemoteJid = (remoteJid || '').trim();
    const cleanName = (contactName || '').trim().toLowerCase();

    const entry = autoReplies.find(a => {
      // 1. Direct remoteJid match
      if (cleanRemoteJid && a.remoteJid && a.remoteJid === cleanRemoteJid) {
        return true;
      }
      // 2. Clean phone / digit match
      const aClean = (a.phone || '').replace(/[^0-9]/g, '');
      const jClean = (a.remoteJid || '').replace(/[^0-9]/g, '');
      if (clean && clean.length >= 6) {
        if (aClean && (aClean === clean || clean.includes(aClean) || aClean.includes(clean))) return true;
        if (jClean && (jClean === clean || clean.includes(jClean) || jClean.includes(clean))) return true;
      }
      // 3. Name match if name is meaningful
      if (cleanName && cleanName !== 'guest' && cleanName !== 'me') {
        const aName = (a.contactName || '').trim().toLowerCase();
        if (aName && aName === cleanName) return true;
      }
      return false;
    });
    return Boolean(entry && entry.enabled);
  };

  const handleToggleAutoReply = (phone: string, contactName: string, remoteJid?: string) => {
    const clean = (phone || '').replace(/[^0-9]/g, '');
    const currentlyActive = isContactAutoReplyActive(phone, remoteJid, contactName);
    const newEnabled = !currentlyActive;

    // Instant optimistic UI update
    setAutoReplies(prev => {
      let matched = false;
      const updated = prev.map(a => {
        const aClean = (a.phone || '').replace(/[^0-9]/g, '');
        const jClean = (a.remoteJid || '').replace(/[^0-9]/g, '');
        const aName = (a.contactName || '').trim().toLowerCase();
        const cleanName = (contactName || '').trim().toLowerCase();

        const matchJid = Boolean(remoteJid && a.remoteJid === remoteJid);
        const matchPhone = Boolean(clean && clean.length >= 6 && (aClean === clean || jClean === clean));
        const matchName = Boolean(cleanName && cleanName !== 'guest' && cleanName !== 'me' && aName === cleanName);

        if (matchJid || matchPhone || matchName) {
          matched = true;
          return {
            ...a,
            phone: phone || a.phone,
            remoteJid: remoteJid || a.remoteJid,
            contactName: contactName || a.contactName,
            enabled: newEnabled
          };
        }
        return a;
      });

      if (matched) {
        return updated;
      }

      return [...prev, {
        remoteJid: remoteJid || (clean ? `${clean}@s.whatsapp.net` : `${(contactName || 'contact').toLowerCase()}@s.whatsapp.net`),
        phone: phone || (clean ? `+${clean}` : contactName || ''),
        contactName: contactName || '',
        enabled: newEnabled
      }];
    });

    if (socket) {
      socket.emit('whatsapp_toggle_auto_reply', {
        phone: phone || (clean ? `+${clean}` : ''),
        remoteJid: remoteJid || '',
        contactName: contactName || '',
        enabled: newEnabled
      });
    }
  };

  const handleEmergencyStopAutoReply = () => {
    if (confirm('🚨 EMERGENCY STOP: Are you sure you want to FORCE-DISABLE all WhatsApp Auto-Replies immediately?')) {
      setAutoReplies(prev => prev.map(a => ({ ...a, enabled: false })));
      if (socket) {
        socket.emit('whatsapp_emergency_stop');
      }
    }
  };

  const handleToggleExpand = (key: string) => {
    setExpandedContacts(prev => ({
      ...prev,
      [key]: prev[key] === undefined ? false : !prev[key]
    }));
  };

  const handleRefreshQr = () => {
    if (socket) {
      socket.emit('whatsapp_request_qr');
    }
  };

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to unpair WhatsApp? You will need to scan the QR code again to reconnect.')) {
      if (socket) {
        socket.emit('whatsapp_disconnect');
      }
    }
  };

  const handleMarkReplied = (msgIdOrPhone: string) => {
    if (socket) {
      socket.emit('whatsapp_mark_replied', { phone: msgIdOrPhone, id: msgIdOrPhone });
      setMessages(prev => prev.map(m => {
        if (m.id === msgIdOrPhone || m.senderPhone === msgIdOrPhone) {
          return { ...m, replied: true };
        }
        return m;
      }));
    }
  };

  const handleSendTestMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testNumber.trim() || !testMessage.trim()) return;

    if (!securityCode.trim()) {
      setSendResult({ type: 'error', text: 'Security code is required to authorize sending.' });
      return;
    }

    setIsSending(true);
    setSendResult(null);

    if (socket) {
      socket.emit('user_message', {
        content: `/tool send_whatsapp_message {"recipient":"${testNumber.trim()}","message":"${testMessage.trim()}","security_code":"${securityCode.trim()}"}`,
        provider: 'gemini'
      });
      setTimeout(() => {
        setIsSending(false);
        setSendResult({ type: 'success', text: `Message dispatched with security validation to ${testNumber}!` });
        socket.emit('whatsapp_get_messages', { filter: 'all' });
      }, 1200);
    }
  };

  // Group messages into clean conversations by contact
  const groupedConversations = useMemo(() => {
    const groups: { [key: string]: ContactConversation } = {};

    messages.forEach(msg => {
      const phone = msg.senderPhone || msg.from || '';
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const remoteJid = msg.remoteJid || '';
      const cleanRemoteJid = remoteJid.replace(/[^0-9]/g, '');
      const key = cleanPhone || cleanRemoteJid || remoteJid || msg.senderName || msg.id;

      if (!groups[key]) {
        const cleanName = (!msg.fromMe && msg.senderName && !msg.senderName.startsWith('+')) ? msg.senderName.replace(/^~/, '') : (msg.senderName || phone || 'Guest');
        groups[key] = {
          contactKey: key,
          contactPhone: phone || (cleanPhone ? `+${cleanPhone}` : ''),
          contactName: cleanName,
          remoteJid: remoteJid,
          latestTimestamp: msg.timestamp,
          unrepliedCount: 0,
          messages: []
        };
      }

      if (remoteJid && !groups[key].remoteJid) {
        groups[key].remoteJid = remoteJid;
      }

      if (groups[key].contactName === 'Guest' && !msg.fromMe && msg.senderName) {
        groups[key].contactName = msg.senderName.replace(/^~/, '');
      }

      if (!groups[key].contactPhone && phone) {
        groups[key].contactPhone = phone;
      }

      if (!msg.fromMe && !msg.replied) {
        groups[key].unrepliedCount += 1;
      }

      if (msg.timestamp > groups[key].latestTimestamp) {
        groups[key].latestTimestamp = msg.timestamp;
      }

      groups[key].messages.push(msg);
    });

    // Sort messages in each conversation chronologically
    Object.values(groups).forEach(g => {
      g.messages.sort((a, b) => a.timestamp - b.timestamp);
    });

    // Sort conversations by latest timestamp descending
    let list = Object.values(groups).sort((a, b) => b.latestTimestamp - a.latestTimestamp);

    if (filter === 'unreplied') {
      list = list.filter(c => c.unrepliedCount > 0);
    }

    return list;
  }, [messages, filter]);

  const totalUnrepliedMessages = useMemo(() => {
    return messages.filter(m => !m.fromMe && !m.replied).length;
  }, [messages]);

  if (!show) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content" 
        style={{ maxWidth: '640px', width: '92%', maxHeight: '88vh', overflowY: 'auto', padding: '1.75rem', borderRadius: '16px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: '#25D366',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)'
            }}>
              <MessageSquare size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a' }}>WhatsApp Multi-Device</h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                {status.connected ? 'Device Linked & Active • Grouped by Contact' : 'Pair as WhatsApp Web Device'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Connected State */}
        {status.connected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '12px',
              padding: '1rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#15803d', fontSize: '0.95rem' }}>
                    {status.user?.phone || 'Connected'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#166534' }}>
                    {status.user?.name || 'WhatsApp Web Active'} • Inquiries & Messaging Enabled
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <a
                  href="/api/whatsapp/export"
                  download="whatsapp_conversations_export.json"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #86efac',
                    color: '#15803d',
                    borderRadius: '8px',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  <Download size={14} /> Export JSON
                </a>
                <button
                  onClick={handleDisconnect}
                  style={{
                    background: '#fee2e2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    borderRadius: '8px',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <LogOut size={14} /> Unlink
                </button>
              </div>
            </div>

            {/* Strict Guardrail Notice & Emergency Stop */}
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              padding: '0.65rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              fontSize: '0.75rem',
              color: '#1e40af'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={16} color="#2563eb" style={{ flexShrink: 0 }} />
                <div>
                  <strong>Strict Live-Only Grounding:</strong> The assistant only replies to live messages (&lt;60s) if the answer is explicitly found in your knowledge base. Historical synced messages are never answered.
                </div>
              </div>
              <button
                type="button"
                onClick={handleEmergencyStopAutoReply}
                style={{
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#b91c1c',
                  borderRadius: '6px',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
                title="Force stop all automated replies"
              >
                <AlertOctagon size={13} /> Disarm All
              </button>
            </div>

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setActiveTab('messages')}
                style={{
                  background: activeTab === 'messages' ? '#e0f2fe' : 'transparent',
                  color: activeTab === 'messages' ? '#0369a1' : '#64748b',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 0.85rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <Inbox size={15} /> Conversations ({groupedConversations.length}) {totalUnrepliedMessages > 0 && <span style={{ background: '#ef4444', color: 'white', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px' }}>{totalUnrepliedMessages} new</span>}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('send')}
                style={{
                  background: activeTab === 'send' ? '#e0f2fe' : 'transparent',
                  color: activeTab === 'send' ? '#0369a1' : '#64748b',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 0.85rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <Send size={15} /> Send with Security Code
              </button>
            </div>

            {/* Tab: Grouped Conversations Feed */}
            {activeTab === 'messages' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                    Chats by Contact ({groupedConversations.length})
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      onClick={() => setFilter('unreplied')}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: filter === 'unreplied' ? '#3b82f6' : '#fff',
                        color: filter === 'unreplied' ? '#fff' : '#475569',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      Needs Reply ({totalUnrepliedMessages})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilter('all')}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: filter === 'all' ? '#3b82f6' : '#fff',
                        color: filter === 'all' ? '#fff' : '#475569',
                        cursor: 'pointer',
                        fontWeight: 600
                      }}
                    >
                      All Chats
                    </button>
                  </div>
                </div>

                <div style={{
                  maxHeight: '340px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  paddingRight: '4px'
                }}>
                  {groupedConversations.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                      No {filter === 'unreplied' ? 'unreplied' : ''} conversations found.
                    </div>
                  ) : (
                    groupedConversations.map((conv) => {
                      const autoReplyActive = isContactAutoReplyActive(conv.contactPhone, conv.remoteJid, conv.contactName);
                      const isExpanded = expandedContacts[conv.contactKey] !== false; // expanded by default

                      return (
                        <div
                          key={conv.contactKey}
                          style={{
                            background: conv.unrepliedCount > 0 ? '#fffdfa' : '#ffffff',
                            border: `1px solid ${conv.unrepliedCount > 0 ? '#fed7aa' : '#e2e8f0'}`,
                            borderRadius: '12px',
                            padding: '0.85rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.6rem',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                          }}
                        >
                          {/* Contact Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: conv.unrepliedCount > 0 ? '#ffedd5' : '#f1f5f9',
                                color: conv.unrepliedCount > 0 ? '#c2410c' : '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.85rem'
                              }}>
                                {conv.contactName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                                  {conv.contactName} {conv.contactPhone && <span style={{ fontWeight: 500, color: '#64748b', fontSize: '0.8rem' }}>({conv.contactPhone})</span>}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                  {conv.messages.length} message{conv.messages.length > 1 ? 's' : ''} • Last active {new Date(conv.latestTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {autoReplyActive && (
                                <span style={{
                                  fontSize: '0.65rem',
                                  background: '#dcfce7',
                                  border: '1px solid #86efac',
                                  color: '#166534',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 700,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}>
                                  <Zap size={11} /> Auto-Reply ON
                                </span>
                              )}
                              {conv.unrepliedCount > 0 ? (
                                <span style={{
                                  fontSize: '0.7rem',
                                  background: '#fee2e2',
                                  color: '#b91c1c',
                                  border: '1px solid #fecaca',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  fontWeight: 700
                                }}>
                                  {conv.unrepliedCount} Needs Reply
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '0.7rem',
                                  background: '#f0fdf4',
                                  color: '#166534',
                                  border: '1px solid #bbf7d0',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  fontWeight: 600
                                }}>
                                  Answered
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Message Bubbles Thread (Collapsible) */}
                          {isExpanded && (
                            <div style={{
                              background: '#f8fafc',
                              border: '1px solid #f1f5f9',
                              borderRadius: '8px',
                              padding: '0.65rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.45rem',
                              maxHeight: '180px',
                              overflowY: 'auto'
                            }}>
                              {conv.messages.map((m) => (
                                <div
                                  key={m.id}
                                  style={{
                                    alignSelf: m.fromMe ? 'flex-end' : 'flex-start',
                                    maxWidth: '85%',
                                    background: m.fromMe ? '#0284c7' : '#ffffff',
                                    color: m.fromMe ? '#ffffff' : '#1e293b',
                                    border: m.fromMe ? 'none' : '1px solid #e2e8f0',
                                    borderRadius: m.fromMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                                    padding: '0.45rem 0.65rem',
                                    fontSize: '0.8rem',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                                  }}
                                >
                                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>
                                    {m.text}
                                  </div>
                                  <div style={{
                                    fontSize: '0.65rem',
                                    color: m.fromMe ? '#bae6fd' : '#94a3b8',
                                    textAlign: 'right',
                                    marginTop: '2px'
                                  }}>
                                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Thread Footer & Actions */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '0.45rem' }}>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                type="button"
                                onClick={() => {
                                  setTestNumber(conv.contactPhone || conv.contactKey);
                                  setActiveTab('send');
                                }}
                                style={{
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  color: '#1d4ed8',
                                  borderRadius: '6px',
                                  padding: '0.25rem 0.55rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <Send size={11} /> Reply
                              </button>

                              {conv.unrepliedCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkReplied(conv.contactPhone || conv.contactKey)}
                                  style={{
                                    background: 'transparent',
                                    border: '1px solid #e2e8f0',
                                    color: '#64748b',
                                    borderRadius: '6px',
                                    padding: '0.25rem 0.55rem',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}
                                >
                                  <Check size={12} /> Mark Answered
                                </button>
                              )}
                            </div>

                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleToggleAutoReply(conv.contactPhone || conv.contactKey, conv.contactName, conv.remoteJid)}
                                style={{
                                  background: autoReplyActive ? '#fef2f2' : '#f0fdf4',
                                  border: `1px solid ${autoReplyActive ? '#fecaca' : '#bbf7d0'}`,
                                  color: autoReplyActive ? '#b91c1c' : '#15803d',
                                  borderRadius: '6px',
                                  padding: '0.25rem 0.55rem',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                {autoReplyActive ? (
                                  <><Pause size={11} /> Pause Auto-Reply</>
                                ) : (
                                  <><Play size={11} /> Enable Auto-Reply</>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleExpand(conv.contactKey)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                  padding: '3px',
                                  display: 'flex',
                                  alignItems: 'center'
                                }}
                                title={isExpanded ? 'Collapse' : 'Expand'}
                              >
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Tab: Send Message with Security Code */}
            {activeTab === 'send' && (
              <form onSubmit={handleSendTestMessage} style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Smartphone size={15} /> Authorized Dispatch via Agent
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                    Recipient Phone (with country code):
                  </label>
                  <input
                    type="text"
                    placeholder="+393401234567"
                    value={testNumber}
                    onChange={(e) => setTestNumber(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>
                    Message Content:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Type a message..."
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#0369a1', fontWeight: 600, marginBottom: '0.25rem' }}>
                    <ShieldCheck size={14} /> Security Validation Code:
                  </label>
                  <input
                    type="password"
                    placeholder="Enter security code (e.g. 1234)"
                    value={securityCode}
                    onChange={(e) => setSecurityCode(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid #93c5fd',
                      background: '#f0f9ff',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      letterSpacing: '2px'
                    }}
                  />
                  <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '3px', display: 'block' }}>
                    Configured via WHATSAPP_SECURITY_CODE in .env (default: 1234)
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSending || !testNumber.trim() || !testMessage.trim() || !securityCode.trim()}
                  style={{
                    background: '#25D366',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.55rem 1rem',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: isSending ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                    marginTop: '0.25rem'
                  }}
                >
                  <Send size={15} /> {isSending ? 'Verifying & Sending...' : 'Validate Code & Send Message'}
                </button>

                {sendResult && (
                  <div style={{
                    fontSize: '0.75rem',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '6px',
                    background: sendResult.type === 'success' ? '#dcfce7' : '#fee2e2',
                    color: sendResult.type === 'success' ? '#166534' : '#991b1b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem'
                  }}>
                    {sendResult.type === 'success' ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                    {sendResult.text}
                  </div>
                )}
              </form>
            )}
          </div>
        ) : (
          /* Pairing QR Code State */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{
              width: '260px',
              height: '260px',
              background: '#ffffff',
              border: '2px solid #e2e8f0',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.75rem',
              boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
              position: 'relative'
            }}>
              {status.qr ? (
                <img
                  src={status.qr}
                  alt="WhatsApp Pairing QR Code"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '8px' }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: '#64748b' }}>
                  <QrCode size={48} color="#94a3b8" style={{ animation: 'pulse 1.5s infinite' }} />
                  <span style={{ fontSize: '0.8rem', textAlign: 'center' }}>Connecting to WhatsApp...</span>
                </div>
              )}
            </div>

            {/* Steps Card */}
            <div style={{
              width: '100%',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1rem',
              fontSize: '0.8rem',
              color: '#334155',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '0.25rem' }}>How to link:</div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ background: '#e2e8f0', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>1</span>
                <span>Open <strong>WhatsApp</strong> on your phone</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ background: '#e2e8f0', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>2</span>
                <span>Tap <strong>Settings</strong> &gt; <strong>Linked Devices</strong></span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ background: '#e2e8f0', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>3</span>
                <span>Tap <strong>Link a Device</strong> and point your camera at this screen</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRefreshQr}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'none',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.45rem 0.85rem',
                fontSize: '0.8rem',
                color: '#475569',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} /> Refresh QR Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
