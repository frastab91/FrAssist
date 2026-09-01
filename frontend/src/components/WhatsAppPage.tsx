import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  MessageSquare, 
  RefreshCw, 
  LogOut, 
  Send, 
  ShieldCheck, 
  Check, 
  CheckCheck,
  Zap, 
  Sparkles, 
  Pause, 
  Play, 
  Download, 
  AlertOctagon, 
  Search,
  Bot,
  Trash2,
  Clock,
  Calendar,
  CalendarClock,
  X,
  History
} from 'lucide-react';
import { Socket } from 'socket.io-client';
import type { WhatsAppStatus, WhatsAppChatSummary, WhatsAppMessageItem, AutoReplyContact, WhatsAppScheduledMessage } from '../types';

type WhatsAppPageProps = {
  status: WhatsAppStatus;
  socket: Socket | null;
  onBackToWorkspace?: () => void;
};

function formatMessageTime(timestamp: number) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 24 && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffHours < 48) {
    return 'Yesterday';
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatScheduledTime(timestamp: number) {
  if (!timestamp) return { formatted: '', relative: '' };
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffMins = Math.round(diffMs / (1000 * 60));

  let relative = '';
  if (diffMs < 0) {
    relative = 'due now';
  } else if (diffMins < 60) {
    relative = `in ${diffMins} min${diffMins === 1 ? '' : 's'}`;
  } else if (diffHours < 24) {
    const hrs = Math.floor(diffHours);
    const mins = diffMins % 60;
    relative = mins > 0 ? `in ${hrs}h ${mins}m` : `in ${hrs} hour${hrs === 1 ? '' : 's'}`;
  } else {
    const days = Math.round(diffHours / 24);
    relative = `in ${days} day${days === 1 ? '' : 's'}`;
  }

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = date.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  if (isToday) {
    return { formatted: `Today at ${timeStr}`, relative };
  }
  if (isTomorrow) {
    return { formatted: `Tomorrow at ${timeStr}`, relative };
  }
  return {
    formatted: `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`,
    relative
  };
}

function getDefaultScheduleDatetime() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getPresetDatetime(preset: string) {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const toLocalIso = (d: Date) => {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  if (preset === '30m') {
    return toLocalIso(new Date(now.getTime() + 30 * 60 * 1000));
  }
  if (preset === '1h') {
    return toLocalIso(new Date(now.getTime() + 60 * 60 * 1000));
  }
  if (preset === '3h') {
    return toLocalIso(new Date(now.getTime() + 3 * 60 * 60 * 1000));
  }
  if (preset === 'tonight') {
    const d = new Date(now);
    d.setHours(20, 0, 0, 0);
    if (d.getTime() <= now.getTime()) {
      d.setDate(d.getDate() + 1);
    }
    return toLocalIso(d);
  }
  if (preset === 'tomorrow_morning') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return toLocalIso(d);
  }
  if (preset === 'tomorrow_afternoon') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(14, 30, 0, 0);
    return toLocalIso(d);
  }
  if (preset === 'tomorrow_evening') {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(18, 30, 0, 0);
    return toLocalIso(d);
  }
  if (preset === 'next_monday') {
    const d = new Date(now);
    const diff = (1 - now.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    d.setHours(9, 0, 0, 0);
    return toLocalIso(d);
  }
  return getDefaultScheduleDatetime();
}

export function WhatsAppPage({ status, socket, onBackToWorkspace }: WhatsAppPageProps) {
  const [chats, setChats] = useState<WhatsAppChatSummary[]>([]);
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<WhatsAppMessageItem[]>([]);
  const [, setAutoReplies] = useState<AutoReplyContact[]>([]);
  const [filter, setFilter] = useState<'all' | 'unreplied' | 'autoreply'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dedicated WhatsApp AI Model Selection (independent of main app)
  const [whatsappModel, setWhatsappModel] = useState<string>(() => {
    return localStorage.getItem('whatsapp_ai_model') || 'gemini';
  });
  const [availableOllamaModels, setAvailableOllamaModels] = useState<any[]>([]);

  // Composer state
  const [messageInput, setMessageInput] = useState('');
  const [securityCode, setSecurityCode] = useState('1234');
  const [isSending, setIsSending] = useState(false);
  const [isClearingHistory, setIsClearingHistory] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [aiPreview, setAiPreview] = useState<{ loading: boolean; text?: string; reason?: string } | null>(null);

  // Scheduled Messages State
  const [scheduledMessages, setScheduledMessages] = useState<WhatsAppScheduledMessage[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showScheduledQueueModal, setShowScheduledQueueModal] = useState(false);
  const [scheduleModalText, setScheduleModalText] = useState('');
  const [scheduleTargetTime, setScheduleTargetTime] = useState<string>(() => getDefaultScheduleDatetime());
  const [schedulePreset, setSchedulePreset] = useState<string>('1h');
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleFeedback, setScheduleFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeQueueTab, setActiveQueueTab] = useState<'pending' | 'history'>('pending');
  const [scheduledSearchQuery, setScheduledSearchQuery] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedChat = useMemo(() => {
    return chats.find(c => c.remoteJid === selectedJid) || null;
  }, [chats, selectedJid]);

  const pendingScheduledMessages = useMemo(() => {
    return scheduledMessages.filter(m => m.status === 'pending');
  }, [scheduledMessages]);

  const historyScheduledMessages = useMemo(() => {
    return scheduledMessages.filter(m => m.status !== 'pending');
  }, [scheduledMessages]);

  const chatPendingScheduled = useMemo(() => {
    if (!selectedChat) return [];
    const cleanChatPhone = (selectedChat.phone || '').replace(/[^0-9]/g, '');
    return pendingScheduledMessages.filter(m => 
      m.remoteJid === selectedChat.remoteJid || 
      (m.phone && cleanChatPhone && m.phone.replace(/[^0-9]/g, '').includes(cleanChatPhone))
    );
  }, [selectedChat, pendingScheduledMessages]);

  const pendingScheduledCount = pendingScheduledMessages.length;

  // Initial fetch and socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.emit('whatsapp_get_chats');
    socket.emit('whatsapp_get_auto_replies');
    socket.emit('whatsapp_get_model');
    socket.emit('whatsapp_get_scheduled_messages');
    socket.emit('poll_ollama');

    const handleModelSelected = (data: { model: string }) => {
      if (data?.model) {
        setWhatsappModel(data.model);
        localStorage.setItem('whatsapp_ai_model', data.model);
      }
    };

    const handleOllamaStatus = (data: any) => {
      if (data && Array.isArray(data.availableModels)) {
        setAvailableOllamaModels(data.availableModels);
      }
    };

    const handleChatsList = (data: { chats: WhatsAppChatSummary[] }) => {
      if (data && Array.isArray(data.chats)) {
        setChats(data.chats);
      }
    };

    const handleChatMessagesList = (data: { remoteJid: string; messages: WhatsAppMessageItem[] }) => {
      if (data && data.remoteJid === selectedJid && Array.isArray(data.messages)) {
        setActiveMessages(data.messages);
      }
    };

    const handleAutoRepliesList = (list: AutoReplyContact[]) => {
      if (Array.isArray(list)) {
        setAutoReplies(list);
      }
    };

    const handleScheduledMessagesList = (data: { scheduledMessages: WhatsAppScheduledMessage[] }) => {
      if (data && Array.isArray(data.scheduledMessages)) {
        setScheduledMessages(data.scheduledMessages);
      }
    };

    const handleScheduledMessageSent = (data: any) => {
      setSendFeedback({
        type: 'success',
        text: `Scheduled message dispatched to ${data?.contactName || data?.phone}!`
      });
      socket.emit('whatsapp_get_scheduled_messages');
      socket.emit('whatsapp_get_chats');
      if (selectedJid) {
        socket.emit('whatsapp_get_chat_messages', { remoteJid: selectedJid });
      }
    };

    const handleIncomingMessage = (newMsg: WhatsAppMessageItem) => {
      if (newMsg.remoteJid === selectedJid) {
        setActiveMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      }
      socket.emit('whatsapp_get_chats');
    };

    socket.on('whatsapp_chats_list', handleChatsList);
    socket.on('whatsapp_chat_messages_list', handleChatMessagesList);
    socket.on('whatsapp_auto_replies_list', handleAutoRepliesList);
    socket.on('whatsapp_scheduled_messages_list', handleScheduledMessagesList);
    socket.on('whatsapp_scheduled_message_sent', handleScheduledMessageSent);
    socket.on('whatsapp_message', handleIncomingMessage);
    socket.on('whatsapp_model_selected', handleModelSelected);
    socket.on('ollama_status', handleOllamaStatus);

    return () => {
      socket.off('whatsapp_chats_list', handleChatsList);
      socket.off('whatsapp_chat_messages_list', handleChatMessagesList);
      socket.off('whatsapp_auto_replies_list', handleAutoRepliesList);
      socket.off('whatsapp_scheduled_messages_list', handleScheduledMessagesList);
      socket.off('whatsapp_scheduled_message_sent', handleScheduledMessageSent);
      socket.off('whatsapp_message', handleIncomingMessage);
      socket.off('whatsapp_model_selected', handleModelSelected);
      socket.off('ollama_status', handleOllamaStatus);
    };
  }, [socket, selectedJid]);

  // Load chat messages when selecting a chat
  useEffect(() => {
    if (selectedJid && socket) {
      setActiveMessages([]);
      setSendFeedback(null);
      setAiPreview(null);
      socket.emit('whatsapp_get_chat_messages', { remoteJid: selectedJid, limit: 300 });
    }
  }, [selectedJid, socket]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages]);

  const handleSelectChat = (remoteJid: string) => {
    setSelectedJid(remoteJid);
  };

  const handleToggleAutoReply = (chat: WhatsAppChatSummary) => {
    if (!socket) return;
    const newEnabled = !chat.autoReplyEnabled;

    // Optimistic update
    setChats(prev => prev.map(c => {
      if (c.remoteJid === chat.remoteJid) {
        return { ...c, autoReplyEnabled: newEnabled };
      }
      return c;
    }));

    socket.emit('whatsapp_toggle_auto_reply', {
      phone: chat.phone,
      remoteJid: chat.remoteJid,
      contactName: chat.contactName,
      enabled: newEnabled
    });
  };

  const handleMarkReplied = (remoteJid: string) => {
    if (!socket) return;
    socket.emit('whatsapp_mark_replied', { remoteJid });
    setChats(prev => prev.map(c => {
      if (c.remoteJid === remoteJid) {
        return { ...c, unrepliedCount: 0 };
      }
      return c;
    }));
    setActiveMessages(prev => prev.map(m => ({ ...m, replied: true })));
  };

  const handleClearChatHistory = (chat: WhatsAppChatSummary) => {
    if (!socket || !chat) return;
    const confirmMsg = `⚠️ Clear chat history for ${chat.contactName} (${chat.phone || chat.remoteJid})?\n\nThis will permanently delete all saved message history for this contact from the database so you can start completely fresh. This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setIsClearingHistory(true);
    socket.emit('whatsapp_clear_chat_history', {
      remoteJid: chat.remoteJid,
      phone: chat.phone
    }, (response: { success?: boolean; error?: string }) => {
      setIsClearingHistory(false);
      if (response && response.success) {
        setActiveMessages([]);
        setChats(prev => prev.map(c => {
          if (c.remoteJid === chat.remoteJid) {
            return {
              ...c,
              totalMessages: 0,
              unrepliedCount: 0,
              lastMessage: { text: '', fromMe: false, timestamp: Date.now() }
            };
          }
          return c;
        }));
        setSendFeedback({
          type: 'success',
          text: `Chat history cleared for ${chat.contactName}. Chat is empty and ready for a fresh message!`
        });
        socket.emit('whatsapp_get_chats');
        setTimeout(() => {
          composerTextareaRef.current?.focus();
        }, 100);
      } else {
        setSendFeedback({
          type: 'error',
          text: response?.error || 'Failed to clear chat history.'
        });
      }
    });
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedChat || !messageInput.trim()) return;

    if (!securityCode.trim()) {
      setSendFeedback({ type: 'error', text: 'Security code is required to authorize dispatch.' });
      return;
    }

    setIsSending(true);
    setSendFeedback(null);

    const targetJid = selectedChat.remoteJid;
    const targetPhone = selectedChat.phone;
    const textToSend = messageInput.trim();

    if (socket) {
      socket.emit('whatsapp_send_message', {
        remoteJid: targetJid,
        phone: targetPhone,
        text: textToSend,
        securityCode: securityCode.trim()
      }, (response: { success: boolean; result?: any; error?: string }) => {
        setIsSending(false);
        if (response && response.success) {
          setMessageInput('');
          setSendFeedback({ type: 'success', text: `Message dispatched to ${selectedChat.contactName}!` });
          // Refresh active messages and conversation summaries
          socket.emit('whatsapp_get_chat_messages', { remoteJid: targetJid, limit: 300 });
          socket.emit('whatsapp_get_chats');
        } else {
          setSendFeedback({
            type: 'error',
            text: response?.error || 'Failed to send message. Please verify security code and WhatsApp pairing.'
          });
        }
      });
    }
  };

  const handleOpenScheduleModal = () => {
    if (!selectedChat || !messageInput.trim()) return;
    setScheduleModalText(messageInput.trim());
    setSchedulePreset('1h');
    setScheduleTargetTime(getPresetDatetime('1h'));
    setScheduleFeedback(null);
    setShowScheduleModal(true);
  };

  const handleApplyPreset = (presetKey: string) => {
    setSchedulePreset(presetKey);
    setScheduleTargetTime(getPresetDatetime(presetKey));
  };

  const handleConfirmSchedule = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedChat || !scheduleModalText.trim() || !scheduleTargetTime) return;

    if (!securityCode.trim()) {
      setScheduleFeedback({ type: 'error', text: 'Security code is required to authorize scheduling.' });
      return;
    }

    const scheduledDate = new Date(scheduleTargetTime);
    if (isNaN(scheduledDate.getTime()) || scheduledDate.getTime() < Date.now() - 30000) {
      setScheduleFeedback({ type: 'error', text: 'Please pick a valid delivery date/time in the future.' });
      return;
    }

    setIsScheduling(true);
    setScheduleFeedback(null);

    if (socket) {
      socket.emit('whatsapp_schedule_message', {
        remoteJid: selectedChat.remoteJid,
        phone: selectedChat.phone,
        text: scheduleModalText.trim(),
        scheduledAt: scheduledDate.getTime(),
        securityCode: securityCode.trim(),
        createdBy: 'ui'
      }, (response: { success: boolean; scheduledMessage?: any; error?: string; message?: string }) => {
        setIsScheduling(false);
        if (response && response.success) {
          setMessageInput('');
          setShowScheduleModal(false);
          setSendFeedback({
            type: 'success',
            text: `Message successfully scheduled for ${formatScheduledTime(scheduledDate.getTime()).formatted}!`
          });
          socket.emit('whatsapp_get_scheduled_messages');
        } else {
          setScheduleFeedback({
            type: 'error',
            text: response?.error || 'Failed to schedule message. Please check parameters.'
          });
        }
      });
    }
  };

  const handleCancelScheduled = (id: string) => {
    if (socket) {
      socket.emit('whatsapp_cancel_scheduled_message', { id }, (res: any) => {
        if (res?.success) {
          socket.emit('whatsapp_get_scheduled_messages');
        }
      });
    }
  };

  const handleDeleteScheduled = (id: string) => {
    if (socket) {
      socket.emit('whatsapp_delete_scheduled_message', { id }, (res: any) => {
        if (res?.success) {
          socket.emit('whatsapp_get_scheduled_messages');
        }
      });
    }
  };

  const handleSendScheduledNow = (id: string) => {
    if (socket) {
      socket.emit('whatsapp_send_scheduled_now', { id, securityCode: securityCode.trim() }, (res: any) => {
        if (res?.success) {
          socket.emit('whatsapp_get_scheduled_messages');
          socket.emit('whatsapp_get_chats');
          if (selectedJid) {
            socket.emit('whatsapp_get_chat_messages', { remoteJid: selectedJid });
          }
        }
      });
    }
  };

  const handleChangeModel = (newModel: string) => {
    setWhatsappModel(newModel);
    localStorage.setItem('whatsapp_ai_model', newModel);
    if (socket) {
      socket.emit('whatsapp_set_model', { model: newModel });
    }
  };

  const handleSimulateAiReply = () => {
    if (!selectedChat) return;
    const lastIncoming = [...activeMessages].reverse().find(m => !m.fromMe);
    if (!lastIncoming) {
      setAiPreview({ loading: false, reason: 'No guest inquiry found to evaluate in this conversation.' });
      return;
    }

    setAiPreview({ loading: true });

    if (socket) {
      socket.emit('whatsapp_generate_ai_draft', {
        remoteJid: selectedChat.remoteJid,
        phone: selectedChat.phone,
        contactName: selectedChat.contactName,
        model: whatsappModel
      }, (response: { success: boolean; draft?: string; shouldReply?: boolean; reason?: string; error?: string; model?: string }) => {
        if (response && response.success && response.draft) {
          setMessageInput(response.draft);
          setAiPreview({
            loading: false,
            text: `✨ AI draft generated via ${response.model || whatsappModel} and placed in the message box below.`
          });
          setTimeout(() => {
            composerTextareaRef.current?.focus();
          }, 100);
        } else if (response && response.reason === 'NO_KNOWLEDGE_MATCH') {
          const fallbackDraft = `Ciao ${selectedChat.contactName}! Grazie per il messaggio. Ti ricontattiamo a breve con tutti i dettagli.`;
          setMessageInput(fallbackDraft);
          setAiPreview({
            loading: false,
            reason: `ℹ️ No knowledge base match found for this question (${response.model || whatsappModel}). Default greeting draft loaded.`
          });
          setTimeout(() => {
            composerTextareaRef.current?.focus();
          }, 100);
        } else {
          const defaultDraft = `Ciao ${selectedChat.contactName}! Grazie per averci contattato. Come possiamo aiutarti per il tuo soggiorno a Scalea?`;
          setMessageInput(defaultDraft);
          setAiPreview({
            loading: false,
            text: `✨ Draft reply loaded into message box below (${response?.model || whatsappModel}).`
          });
          setTimeout(() => {
            composerTextareaRef.current?.focus();
          }, 100);
        }
      });
    }
  };

  const handleEmergencyStop = () => {
    if (confirm('🚨 EMERGENCY STOP: Are you sure you want to FORCE-DISABLE all WhatsApp Auto-Replies immediately?')) {
      if (socket) {
        socket.emit('whatsapp_emergency_stop');
      }
      setChats(prev => prev.map(c => ({ ...c, autoReplyEnabled: false })));
      setAutoReplies(prev => prev.map(a => ({ ...a, enabled: false })));
    }
  };

  const handleDisconnect = () => {
    if (confirm('Are you sure you want to unpair WhatsApp? You will need to scan the QR code again to reconnect.')) {
      if (socket) {
        socket.emit('whatsapp_disconnect');
      }
    }
  };

  const handleRefreshQr = () => {
    if (socket) {
      socket.emit('whatsapp_request_qr');
    }
  };

  // Filter & Search chats
  const filteredChats = useMemo(() => {
    let list = [...chats];

    if (filter === 'unreplied') {
      list = list.filter(c => c.unrepliedCount > 0);
    } else if (filter === 'autoreply') {
      list = list.filter(c => c.autoReplyEnabled);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(c => 
        c.contactName.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.lastMessage?.text || '').toLowerCase().includes(q) ||
        c.remoteJid.toLowerCase().includes(q)
      );
    }

    return list;
  }, [chats, filter, searchQuery]);

  const totalUnrepliedCount = useMemo(() => {
    return chats.reduce((acc, c) => acc + (c.unrepliedCount > 0 ? 1 : 0), 0);
  }, [chats]);

  const totalAutoReplyCount = useMemo(() => {
    return chats.filter(c => c.autoReplyEnabled).length;
  }, [chats]);

  // If WhatsApp is NOT connected, show QR pairing screen
  if (!status.connected) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        overflowY: 'auto'
      }}>
        <div style={{
          maxWidth: '520px',
          width: '100%',
          background: '#ffffff',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
          border: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: '#25D366',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: '0 8px 20px rgba(37, 211, 102, 0.3)'
          }}>
            <MessageSquare size={32} />
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem' }}>
            Connect WhatsApp Web
          </h2>
          <p style={{ fontSize: '0.88rem', color: '#64748b', margin: '0 0 1.75rem', lineHeight: 1.4 }}>
            Pair your phone to sync chats, view guest inquiries, and authorize automated knowledge-grounded concierge replies.
          </p>

          {status.qr ? (
            <div style={{
              background: '#f8fafc',
              border: '2px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'inline-block',
              marginBottom: '1.5rem'
            }}>
              <img 
                src={status.qr} 
                alt="WhatsApp Pairing QR Code" 
                style={{ width: '220px', height: '220px', display: 'block', borderRadius: '8px' }} 
              />
            </div>
          ) : (
            <div style={{
              padding: '3rem 1.5rem',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem'
            }}>
              <RefreshCw size={28} className="spin" color="#3b82f6" />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>
                Generating secure pairing QR code...
              </div>
            </div>
          )}

          <div style={{
            textAlign: 'left',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            marginBottom: '1.5rem',
            fontSize: '0.82rem',
            color: '#1e40af'
          }}>
            <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>How to link:</div>
            <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <li>Open <strong>WhatsApp</strong> on your phone.</li>
              <li>Go to <strong>Settings</strong> or <strong>Menu</strong> &gt; <strong>Linked Devices</strong>.</li>
              <li>Tap <strong>Link a Device</strong> and point your camera at this QR code.</li>
            </ol>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={handleRefreshQr}
              style={{
                background: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.65rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
              }}
            >
              <RefreshCw size={15} /> Refresh QR Code
            </button>
            {onBackToWorkspace && (
              <button
                type="button"
                onClick={onBackToWorkspace}
                style={{
                  background: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '0.65rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Back to Workspace
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Full-page WhatsApp Workspace Layout (100% viewport fit, zero horizontal overflow)
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      minHeight: 0,
      width: '100%',
      background: '#f1f5f9',
      overflow: 'hidden'
    }}>
      {/* Top Bar Banner / Action Controls */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0.6rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        gap: '0.75rem',
        zIndex: 5
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: '#25D366',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(37, 211, 102, 0.25)',
            flexShrink: 0
          }}>
            <MessageSquare size={17} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                WhatsApp Concierge
              </span>
              <span style={{
                background: '#dcfce7',
                color: '#15803d',
                border: '1px solid #86efac',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                whiteSpace: 'nowrap'
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e' }}></span>
                {status.user?.phone || 'Connected'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {chats.length} synced chats • {totalUnrepliedCount} awaiting reply • {totalAutoReplyCount} auto-reply active
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0, flexWrap: 'wrap' }}>
          {/* Dedicated WhatsApp AI Model Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            padding: '0.25rem 0.5rem'
          }}>
            <Bot size={13} color="#0284c7" />
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap' }}>AI Model:</span>
            <select
              value={whatsappModel}
              onChange={(e) => handleChangeModel(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: '#0f172a',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <optgroup label="🚀 Smart Routing (Recommended)">
                <option value="auto">⚡ Smart Hybrid Auto-Router</option>
              </optgroup>
              <optgroup label="⚡ Ollama Cloud (Top Frontier Models)">
                <option value="ollama_cloud:glm-5.3-flash:cloud">GLM 5.3 Flash (1M Context - Ultra Fast)</option>
                <option value="ollama_cloud:gemma4:31b-cloud">Gemma 4 31B (Sub-300ms Fast)</option>
                <option value="ollama_cloud:minimax-m3:cloud">MiniMax M3 (Multilingual Concierge)</option>
                <option value="ollama_cloud:qwen3.5:397b-cloud">Qwen 3.5 397B (Italian/English)</option>
                <option value="ollama_cloud:deepseek-v4-flash:cloud">DeepSeek V4 Flash (284B MoE)</option>
                <option value="ollama_cloud:deepseek-v4-pro:cloud">DeepSeek V4 Pro (1.6T MoE Reasoning)</option>
                <option value="ollama_cloud:kimi-k2.7-code:cloud">Kimi K2.7 Code (Agentic Flows)</option>
                <option value="ollama_cloud:glm-5.2:cloud">GLM 5.2 (1M Context)</option>
                <option value="ollama_cloud:nemotron-3-ultra:cloud">Nemotron-3 Ultra (550B MoE)</option>
                <option value="ollama_cloud:gpt-oss:20b-cloud">GPT-OSS 20B (Ultra-Fast)</option>
                <option value="ollama_cloud:rafw007/deepseek-v4-flash-fast:latest">DeepSeek-V4 Flash Fast (Ops)</option>
                <option value="ollama_cloud">Ollama Cloud (Default)</option>
              </optgroup>
              <optgroup label="Google Gemini (Google AI Studio)">
                <option value="gemini">Google Gemini 3.7 Flash (Default)</option>
                <option value="gemini:gemini-3.7-flash">Google Gemini 3.7 Flash</option>
                <option value="gemini:gemini-3.6-flash">Google Gemini 3.6 Flash</option>
                <option value="gemini:gemini-flash-latest">Google Gemini Flash (Latest)</option>
              </optgroup>
              <optgroup label="Other Cloud Models">
                <option value="digitalocean">DigitalOcean Serverless Router</option>
                <option value="groq:openai/gpt-oss-120b">Groq (GPT-OSS-120B - Fast)</option>
                <option value="groq:qwen/qwen3.6-27b">Groq (Qwen 3.6 27B)</option>
              </optgroup>
              <optgroup label="Local Models (Ollama)">
                {availableOllamaModels.length > 0 ? (
                  availableOllamaModels.map((m: any) => (
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
          </div>

          <button
            type="button"
            onClick={handleEmergencyStop}
            style={{
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              color: '#b91c1c',
              borderRadius: '6px',
              padding: '0.35rem 0.6rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Force-disable all auto-replies immediately"
          >
            <AlertOctagon size={13} /> Disarm All
          </button>

          <button
            type="button"
            onClick={() => setShowScheduledQueueModal(true)}
            style={{
              background: pendingScheduledCount > 0 ? '#eff6ff' : '#ffffff',
              border: `1px solid ${pendingScheduledCount > 0 ? '#93c5fd' : '#cbd5e1'}`,
              color: pendingScheduledCount > 0 ? '#1d4ed8' : '#334155',
              borderRadius: '6px',
              padding: '0.35rem 0.65rem',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="View and manage scheduled WhatsApp messages"
          >
            <Clock size={13} color={pendingScheduledCount > 0 ? '#2563eb' : '#64748b'} />
            <span>Scheduled</span>
            {pendingScheduledCount > 0 && (
              <span style={{
                background: '#2563eb',
                color: 'white',
                fontSize: '0.65rem',
                fontWeight: 800,
                borderRadius: '10px',
                padding: '0px 5px',
                lineHeight: '14px'
              }}>
                {pendingScheduledCount}
              </span>
            )}
          </button>

          <a
            href="/api/whatsapp/export"
            download="whatsapp_conversations_export.json"
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              borderRadius: '6px',
              padding: '0.35rem 0.6rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Download size={13} /> Export JSON
          </a>

          <button
            type="button"
            onClick={() => {
              if (socket) socket.emit('whatsapp_get_chats');
            }}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#475569',
              borderRadius: '6px',
              padding: '0.35rem 0.55rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Refresh conversations list"
          >
            <RefreshCw size={13} /> Refresh
          </button>

          <button
            type="button"
            onClick={handleDisconnect}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#dc2626',
              borderRadius: '6px',
              padding: '0.35rem 0.55rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Unlink WhatsApp session"
          >
            <LogOut size={13} /> Unlink
          </button>
        </div>
      </div>

      {/* Main 2-Column WhatsApp Web Interface (Fit Screen, Zero Horizontal Scroll) */}
      <div style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        width: '100%',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Left Column: Conversation Sidebar */}
        <aside style={{
          width: '320px',
          minWidth: '280px',
          maxWidth: '350px',
          background: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          flexShrink: 0,
          overflow: 'hidden'
        }}>
          {/* Search Bar */}
          <div style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '0.45rem 0.75rem',
              gap: '0.5rem'
            }}>
              <Search size={16} color="#94a3b8" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search guest, phone, or message..."
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  fontSize: '0.82rem',
                  color: '#0f172a',
                  width: '100%'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, fontSize: '0.75rem' }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Filter Tabs */}
          <div style={{
            display: 'flex',
            gap: '0.25rem',
            padding: '0.4rem 0.75rem',
            background: '#ffffff',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <button
              type="button"
              onClick={() => setFilter('all')}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: filter === 'all' ? '#e0f2fe' : 'transparent',
                color: filter === 'all' ? '#0369a1' : '#64748b'
              }}
            >
              All ({chats.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unreplied')}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: filter === 'unreplied' ? '#fee2e2' : 'transparent',
                color: filter === 'unreplied' ? '#b91c1c' : '#64748b'
              }}
            >
              Needs Reply {totalUnrepliedCount > 0 && `(${totalUnrepliedCount})`}
            </button>
            <button
              type="button"
              onClick={() => setFilter('autoreply')}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: '6px',
                padding: '0.35rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                background: filter === 'autoreply' ? '#dcfce7' : 'transparent',
                color: filter === 'autoreply' ? '#15803d' : '#64748b'
              }}
            >
              Auto-Reply ({totalAutoReplyCount})
            </button>
          </div>

          {/* Conversation List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {filteredChats.length === 0 ? (
              <div style={{
                padding: '3rem 1.5rem',
                textAlign: 'center',
                color: '#94a3b8',
                fontSize: '0.85rem'
              }}>
                No conversations found matching criteria.
              </div>
            ) : (
              filteredChats.map((c) => {
                const isSelected = c.remoteJid === selectedJid;
                const initials = (c.contactName || 'G').charAt(0).toUpperCase();

                return (
                  <div
                    key={c.remoteJid}
                    onClick={() => handleSelectChat(c.remoteJid)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 0.85rem',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f8fafc',
                      background: isSelected ? '#f0f9ff' : c.unrepliedCount > 0 ? '#fffbf5' : '#ffffff',
                      borderLeft: isSelected ? '4px solid #0284c7' : '4px solid transparent',
                      transition: 'background 0.15s ease'
                    }}
                  >
                    {/* Contact Avatar */}
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      background: isSelected ? '#bae6fd' : c.unrepliedCount > 0 ? '#ffedd5' : '#f1f5f9',
                      color: isSelected ? '#0369a1' : c.unrepliedCount > 0 ? '#c2410c' : '#475569',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      flexShrink: 0
                    }}>
                      {initials}
                    </div>

                    {/* Chat Item Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                        <span style={{
                          fontSize: '0.88rem',
                          fontWeight: isSelected || c.unrepliedCount > 0 ? 700 : 600,
                          color: '#0f172a',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {c.contactName}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', flexShrink: 0, marginLeft: '4px' }}>
                          {formatMessageTime(c.latestTimestamp)}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                        <span style={{
                          fontSize: '0.78rem',
                          color: c.unrepliedCount > 0 ? '#334155' : '#64748b',
                          fontWeight: c.unrepliedCount > 0 ? 600 : 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {c.totalMessages === 0 ? (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Fresh (ready for new message)</span>
                          ) : (
                            <>
                              {c.lastMessage?.fromMe && <span style={{ color: '#0284c7', fontWeight: 600 }}>You: </span>}
                              {c.lastMessage?.text || 'No message content'}
                            </>
                          )}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                          {c.autoReplyEnabled && (
                            <span title="Auto-Reply is active for this contact" style={{ color: '#16a34a' }}>
                              <Zap size={13} fill="#22c55e" color="#16a34a" />
                            </span>
                          )}
                          {c.unrepliedCount > 0 && (
                            <span style={{
                              background: '#ef4444',
                              color: '#ffffff',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '10px'
                            }}>
                              {c.unrepliedCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Column: Active Conversation Stream / Overview */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          background: '#f8fafc',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {selectedChat ? (
            <>
              {/* Active Conversation Header */}
              <div style={{
                background: '#ffffff',
                borderBottom: '1px solid #e2e8f0',
                padding: '0.65rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    flexShrink: 0
                  }}>
                    {(selectedChat.contactName || 'G').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <h2 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selectedChat.contactName}
                      </h2>
                      {selectedChat.phone && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>
                          ({selectedChat.phone})
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedChat.totalMessages === 0 ? 'Fresh conversation (0 messages)' : `${selectedChat.totalMessages} message${selectedChat.totalMessages > 1 ? 's' : ''} in history`} • JID: {selectedChat.remoteJid}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  {chatPendingScheduled.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveQueueTab('pending');
                        setShowScheduledQueueModal(true);
                      }}
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#1d4ed8',
                        borderRadius: '8px',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        whiteSpace: 'nowrap'
                      }}
                      title="View scheduled messages for this contact"
                    >
                      <Clock size={13} color="#2563eb" />
                      <span>{chatPendingScheduled.length} scheduled</span>
                    </button>
                  )}

                  {/* Auto-reply toggle */}
                  <button
                    type="button"
                    onClick={() => handleToggleAutoReply(selectedChat)}
                    style={{
                      background: selectedChat.autoReplyEnabled ? '#dcfce7' : '#f8fafc',
                      border: `1px solid ${selectedChat.autoReplyEnabled ? '#86efac' : '#cbd5e1'}`,
                      color: selectedChat.autoReplyEnabled ? '#15803d' : '#64748b',
                      borderRadius: '8px',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {selectedChat.autoReplyEnabled ? (
                      <><Pause size={12} /> Auto-Reply ON</>
                    ) : (
                      <><Play size={12} /> Enable Auto-Reply</>
                    )}
                  </button>

                  {selectedChat.unrepliedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => handleMarkReplied(selectedChat.remoteJid)}
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#1d4ed8',
                        borderRadius: '8px',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      <Check size={13} /> Mark Answered
                    </button>
                  )}

                  {/* Clean / Clear Chat History Button */}
                  <button
                    type="button"
                    onClick={() => handleClearChatHistory(selectedChat)}
                    disabled={isClearingHistory}
                    style={{
                      background: '#fff1f2',
                      border: '1px solid #fecdd3',
                      color: '#e11d48',
                      borderRadius: '8px',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: isClearingHistory ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      whiteSpace: 'nowrap'
                    }}
                    title={`Clean all message history for ${selectedChat.contactName} to start fresh`}
                  >
                    <Trash2 size={13} /> {isClearingHistory ? 'Cleaning...' : 'Clean History'}
                  </button>
                </div>
              </div>

              {/* Message Thread Scroll Area */}
              <div style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                overflowX: 'hidden',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                background: '#f8fafc'
              }}>
                {activeMessages.length === 0 ? (
                  <div style={{
                    margin: 'auto',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: '0.85rem',
                    padding: '2.5rem 1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.6rem'
                  }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: '#f1f5f9',
                      color: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Sparkles size={22} />
                    </div>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                      Conversation is Clean & Fresh
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#94a3b8', maxWidth: '300px', lineHeight: 1.4 }}>
                      No messages in this chat history. Send a message below to start a fresh thread with {selectedChat.contactName}.
                    </div>
                  </div>
                ) : (
                  activeMessages.map((msg) => (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignSelf: msg.fromMe ? 'flex-end' : 'flex-start',
                        maxWidth: '75%',
                        minWidth: 0
                      }}
                    >
                      <div style={{
                        background: msg.fromMe ? '#0284c7' : '#ffffff',
                        color: msg.fromMe ? '#ffffff' : '#0f172a',
                        border: msg.fromMe ? 'none' : '1px solid #e2e8f0',
                        borderRadius: msg.fromMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                        padding: '0.65rem 0.85rem',
                        fontSize: '0.85rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        position: 'relative',
                        wordBreak: 'break-word',
                        overflowWrap: 'anywhere'
                      }}>
                        {!msg.fromMe && (
                          <div style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: '#0369a1',
                            marginBottom: '2px'
                          }}>
                            {msg.senderName || selectedChat.contactName}
                          </div>
                        )}
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                          {msg.text}
                        </div>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: '3px',
                          marginTop: '4px',
                          fontSize: '0.65rem',
                          color: msg.fromMe ? '#bae6fd' : '#94a3b8'
                        }}>
                          <span>{formatMessageTime(msg.timestamp)}</span>
                          {msg.fromMe && <CheckCheck size={12} color="#bae6fd" />}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* AI Concierge Simulation Panel (if triggered) */}
              {aiPreview && (
                <div style={{
                  background: '#f0fdf4',
                  borderTop: '1px solid #bbf7d0',
                  padding: '0.65rem 1.25rem',
                  fontSize: '0.78rem',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Sparkles size={16} color="#16a34a" />
                    <div>
                      <strong>AI Concierge Evaluator:</strong> {aiPreview.loading ? 'Evaluating inquiry against Scalea knowledge base...' : (aiPreview.text || aiPreview.reason)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAiPreview(null)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#166534', fontSize: '0.75rem' }}
                  >
                    ✕ Dismiss
                  </button>
                </div>
              )}

              {/* Message Composer & Authorization Footer */}
              <div style={{
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                padding: '0.85rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                flexShrink: 0
              }}>
                {sendFeedback && (
                  <div style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: sendFeedback.type === 'success' ? '#dcfce7' : '#fee2e2',
                    color: sendFeedback.type === 'success' ? '#15803d' : '#b91c1c',
                    border: `1px solid ${sendFeedback.type === 'success' ? '#86efac' : '#fca5a5'}`
                  }}>
                    {sendFeedback.text}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                    Send Message to {selectedChat.contactName}
                  </span>
                  <button
                    type="button"
                    onClick={handleSimulateAiReply}
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      color: '#15803d',
                      borderRadius: '6px',
                      padding: '0.25rem 0.6rem',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Evaluate what the AI concierge would answer from knowledge base"
                  >
                    <Sparkles size={12} color="#16a34a" /> Test AI Answer
                  </button>
                </div>

                <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <textarea
                      ref={composerTextareaRef}
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={`Reply to ${selectedChat.contactName}... (Press Enter to send)`}
                      rows={2}
                      style={{
                        width: '100%',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        padding: '0.55rem 0.75rem',
                        fontSize: '0.85rem',
                        outline: 'none',
                        resize: 'none',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '130px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ShieldCheck size={13} color="#2563eb" />
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: '#475569' }}>Security Code</span>
                    </div>
                    <input
                      type="password"
                      value={securityCode}
                      onChange={(e) => setSecurityCode(e.target.value)}
                      placeholder="1234"
                      style={{
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        padding: '0.35rem 0.5rem',
                        fontSize: '0.8rem',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    disabled={isSending || !messageInput.trim()}
                    onClick={handleOpenScheduleModal}
                    style={{
                      background: !messageInput.trim() ? '#f8fafc' : '#eff6ff',
                      color: !messageInput.trim() ? '#94a3b8' : '#1d4ed8',
                      border: `1px solid ${!messageInput.trim() ? '#cbd5e1' : '#bfdbfe'}`,
                      borderRadius: '8px',
                      padding: '0.65rem 0.85rem',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: !messageInput.trim() ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      height: '42px',
                      whiteSpace: 'nowrap'
                    }}
                    title="Schedule message for optimal future delivery"
                  >
                    <Clock size={14} color={!messageInput.trim() ? '#94a3b8' : '#2563eb'} /> Schedule
                  </button>

                  <button
                    type="submit"
                    disabled={isSending || !messageInput.trim()}
                    style={{
                      background: isSending || !messageInput.trim() ? '#94a3b8' : '#0284c7',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.65rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: isSending || !messageInput.trim() ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      height: '42px',
                      boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
                    }}
                  >
                    <Send size={15} /> Send
                  </button>
                </form>
              </div>
            </>
          ) : (
            /* Empty State: No chat selected */
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              padding: '2rem',
              textAlign: 'center'
            }}>
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '16px',
                background: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem'
              }}>
                <MessageSquare size={28} />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem' }}>
                Select a WhatsApp Conversation
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#64748b', maxWidth: '420px', margin: '0 0 1.75rem', lineHeight: 1.4 }}>
                Choose a guest from the left sidebar to view message history, reply with security validation, or manage automated concierge replies.
              </p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                maxWidth: '520px',
                width: '100%'
              }}>
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1rem',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7' }}>{chats.length}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Total Synced Chats</div>
                </div>
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1rem',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ef4444' }}>{totalUnrepliedCount}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Needs Reply</div>
                </div>
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1rem',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16a34a' }}>{totalAutoReplyCount}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Auto-Reply Active</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Message Modal */}
      {showScheduleModal && selectedChat && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '540px',
              padding: '1.5rem',
              borderRadius: '14px',
              background: '#ffffff',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CalendarClock size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                    Schedule WhatsApp Message
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                    Send to <strong>{selectedChat.contactName}</strong> ({selectedChat.phone})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {scheduleFeedback && (
              <div style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                marginBottom: '1rem',
                background: scheduleFeedback.type === 'success' ? '#dcfce7' : '#fee2e2',
                color: scheduleFeedback.type === 'success' ? '#15803d' : '#b91c1c',
                border: `1px solid ${scheduleFeedback.type === 'success' ? '#86efac' : '#fca5a5'}`
              }}>
                {scheduleFeedback.text}
              </div>
            )}

            <form onSubmit={handleConfirmSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Message preview / edit */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Message Content:
                </label>
                <textarea
                  value={scheduleModalText}
                  onChange={(e) => setScheduleModalText(e.target.value)}
                  rows={3}
                  placeholder="Enter message to schedule..."
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    padding: '0.6rem 0.75rem',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                  required
                />
              </div>

              {/* Quick Presets */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Optimal Delivery Presets:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {[
                    { key: '30m', label: '⚡ In 30 min' },
                    { key: '1h', label: '⚡ In 1 hour' },
                    { key: '3h', label: '⚡ In 3 hours' },
                    { key: 'tonight', label: '🌙 Tonight (20:00)' },
                    { key: 'tomorrow_morning', label: '🌅 Tomorrow (09:00)' },
                    { key: 'tomorrow_afternoon', label: '☀️ Tomorrow (14:30)' },
                    { key: 'tomorrow_evening', label: '🌆 Tomorrow (18:30)' },
                    { key: 'next_monday', label: '📅 Next Mon (09:00)' },
                  ].map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handleApplyPreset(p.key)}
                      style={{
                        background: schedulePreset === p.key ? '#2563eb' : '#f8fafc',
                        color: schedulePreset === p.key ? '#ffffff' : '#334155',
                        border: `1px solid ${schedulePreset === p.key ? '#2563eb' : '#cbd5e1'}`,
                        borderRadius: '6px',
                        padding: '0.35rem 0.65rem',
                        fontSize: '0.73rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date & Time Picker */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '0.85rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Calendar size={14} color="#0284c7" /> Custom Delivery Date & Time:
                  </label>
                  <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                    Local Timezone
                  </span>
                </div>
                <input
                  type="datetime-local"
                  value={scheduleTargetTime}
                  onChange={(e) => {
                    setScheduleTargetTime(e.target.value);
                    setSchedulePreset('custom');
                  }}
                  min={getDefaultScheduleDatetime().slice(0, 16)}
                  style={{
                    width: '100%',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.85rem',
                    outline: 'none',
                    background: '#ffffff'
                  }}
                  required
                />
                
                {/* Calculated Time Preview Banner */}
                {scheduleTargetTime && (
                  <div style={{
                    marginTop: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.75rem',
                    color: '#0369a1',
                    background: '#e0f2fe',
                    padding: '0.4rem 0.65rem',
                    borderRadius: '6px'
                  }}>
                    <Clock size={13} />
                    <span>
                      Will dispatch: <strong>{formatScheduledTime(new Date(scheduleTargetTime).getTime()).formatted}</strong> ({formatScheduledTime(new Date(scheduleTargetTime).getTime()).relative})
                    </span>
                  </div>
                )}
              </div>

              {/* Security Code Verification */}
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <ShieldCheck size={16} color="#16a34a" />
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534' }}>Security Code Authorization</div>
                    <div style={{ fontSize: '0.68rem', color: '#15803d' }}>Required to authorize automated dispatch</div>
                  </div>
                </div>
                <input
                  type="password"
                  value={securityCode}
                  onChange={(e) => setSecurityCode(e.target.value)}
                  placeholder="1234"
                  style={{
                    width: '100px',
                    borderRadius: '6px',
                    border: '1px solid #86efac',
                    padding: '0.35rem 0.5rem',
                    fontSize: '0.82rem',
                    outline: 'none',
                    textAlign: 'center'
                  }}
                  required
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '0.6rem 1rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isScheduling || !scheduleModalText.trim()}
                  style={{
                    background: isScheduling || !scheduleModalText.trim() ? '#94a3b8' : '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.6rem 1.2rem',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    cursor: isScheduling || !scheduleModalText.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
                  }}
                >
                  <CalendarClock size={15} />
                  {isScheduling ? 'Scheduling...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scheduled Messages Manager Modal */}
      {showScheduledQueueModal && (
        <div className="modal-overlay" onClick={() => setShowScheduledQueueModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '680px',
              width: '90%',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '1.5rem',
              borderRadius: '16px',
              background: '#ffffff',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden'
            }}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '1rem',
              borderBottom: '1px solid #e2e8f0',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Clock size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                    Scheduled WhatsApp Messages
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                    Persistent automated dispatch queue powered by SQLite background runner
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduledQueueModal(false)}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Filter Tabs & Search */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              padding: '0.85rem 0',
              borderBottom: '1px solid #f1f5f9',
              flexShrink: 0,
              flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => setActiveQueueTab('pending')}
                  style={{
                    background: activeQueueTab === 'pending' ? '#eff6ff' : 'transparent',
                    color: activeQueueTab === 'pending' ? '#1d4ed8' : '#64748b',
                    border: `1px solid ${activeQueueTab === 'pending' ? '#bfdbfe' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <Clock size={13} /> Active Queue ({pendingScheduledMessages.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveQueueTab('history')}
                  style={{
                    background: activeQueueTab === 'history' ? '#f1f5f9' : 'transparent',
                    color: activeQueueTab === 'history' ? '#0f172a' : '#64748b',
                    border: `1px solid ${activeQueueTab === 'history' ? '#cbd5e1' : '#e2e8f0'}`,
                    borderRadius: '8px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <History size={13} /> History ({historyScheduledMessages.length})
                </button>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.3rem 0.6rem',
                gap: '0.4rem',
                minWidth: '180px'
              }}>
                <Search size={14} color="#94a3b8" />
                <input
                  type="text"
                  value={scheduledSearchQuery}
                  onChange={(e) => setScheduledSearchQuery(e.target.value)}
                  placeholder="Filter messages..."
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '0.75rem',
                    width: '100%'
                  }}
                />
                {scheduledSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setScheduledSearchQuery('')}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* List Body */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '0.75rem 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              {(() => {
                const targetList = (activeQueueTab === 'pending' ? pendingScheduledMessages : historyScheduledMessages)
                  .filter(m => {
                    if (!scheduledSearchQuery.trim()) return true;
                    const q = scheduledSearchQuery.toLowerCase();
                    return (
                      (m.contactName && m.contactName.toLowerCase().includes(q)) ||
                      (m.phone && m.phone.includes(q)) ||
                      (m.text && m.text.toLowerCase().includes(q))
                    );
                  });

                if (targetList.length === 0) {
                  return (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '3rem 1rem',
                      textAlign: 'center',
                      color: '#64748b'
                    }}>
                      <div style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '50%',
                        background: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94a3b8',
                        marginBottom: '0.75rem'
                      }}>
                        {activeQueueTab === 'pending' ? <CalendarClock size={24} /> : <History size={24} />}
                      </div>
                      <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                        {activeQueueTab === 'pending' ? 'No Pending Scheduled Messages' : 'No Scheduled Message History'}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.78rem', maxWidth: '360px', lineHeight: 1.4 }}>
                        {activeQueueTab === 'pending'
                          ? 'You can schedule messages anytime by clicking "Schedule" in the chat composer, or by asking the AI agent in chat.'
                          : 'Delivered, cancelled, and failed scheduled dispatches will appear here.'}
                      </p>
                    </div>
                  );
                }

                return targetList.map((m) => {
                  const timeInfo = formatScheduledTime(m.scheduledAt);
                  const isPending = m.status === 'pending';
                  const isSent = m.status === 'sent';
                  const isFailed = m.status === 'failed';
                  const isCancelled = m.status === 'cancelled';

                  let statusBg = '#f1f5f9';
                  let statusColor = '#475569';
                  let statusBorder = '#cbd5e1';
                  let statusLabel: string = m.status;

                  if (isPending) {
                    statusBg = '#eff6ff';
                    statusColor = '#1d4ed8';
                    statusBorder = '#bfdbfe';
                    statusLabel = 'Pending Dispatch';
                  } else if (isSent) {
                    statusBg = '#dcfce7';
                    statusColor = '#15803d';
                    statusBorder = '#86efac';
                    statusLabel = 'Sent';
                  } else if (isFailed) {
                    statusBg = '#fee2e2';
                    statusColor = '#b91c1c';
                    statusBorder = '#fca5a5';
                    statusLabel = 'Failed';
                  } else if (isCancelled) {
                    statusBg = '#f1f5f9';
                    statusColor = '#64748b';
                    statusBorder = '#e2e8f0';
                    statusLabel = 'Cancelled';
                  }

                  return (
                    <div
                      key={m.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '0.9rem 1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.6rem',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        transition: 'border-color 0.15s ease'
                      }}
                    >
                      {/* Top row: Recipient & Status */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: 0 }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: '#e0f2fe',
                            color: '#0284c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            flexShrink: 0
                          }}>
                            {(m.contactName || 'G').charAt(0).toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {m.contactName || m.phone}
                              </span>
                              {m.phone && (
                                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                  ({m.phone})
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                              Scheduled by: {m.createdBy === 'agent' ? '🤖 AI Agent' : '👤 User (UI)'} • Created: {new Date(m.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                          <span style={{
                            background: statusBg,
                            color: statusColor,
                            border: `1px solid ${statusBorder}`,
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'capitalize'
                          }}>
                            {statusLabel}
                          </span>
                        </div>
                      </div>

                      {/* Scheduled Delivery Time Bar */}
                      <div style={{
                        background: '#f8fafc',
                        borderRadius: '6px',
                        padding: '0.4rem 0.65rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.74rem'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#334155' }}>
                          <CalendarClock size={13} color="#2563eb" />
                          <span>Delivery: <strong>{timeInfo.formatted}</strong></span>
                        </div>
                        <span style={{
                          color: isPending ? '#2563eb' : '#64748b',
                          fontWeight: 700,
                          fontSize: '0.72rem'
                        }}>
                          {timeInfo.relative}
                        </span>
                      </div>

                      {/* Message Preview Box */}
                      <div style={{
                        background: '#ffffff',
                        border: '1px solid #f1f5f9',
                        borderRadius: '8px',
                        padding: '0.6rem 0.75rem',
                        fontSize: '0.82rem',
                        color: '#1e293b',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: 1.4
                      }}>
                        {m.text}
                      </div>

                      {/* Error banner if failed */}
                      {isFailed && m.errorMessage && (
                        <div style={{
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                          borderRadius: '6px',
                          padding: '0.35rem 0.6rem',
                          fontSize: '0.72rem',
                          color: '#b91c1c'
                        }}>
                          <strong>Error:</strong> {m.errorMessage}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.2rem' }}>
                        {isPending && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleSendScheduledNow(m.id)}
                              style={{
                                background: '#f0fdf4',
                                border: '1px solid #86efac',
                                color: '#15803d',
                                borderRadius: '6px',
                                padding: '0.3rem 0.65rem',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Send this message right now"
                            >
                              <Send size={12} /> Send Now
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelScheduled(m.id)}
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                color: '#64748b',
                                borderRadius: '6px',
                                padding: '0.3rem 0.65rem',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Cancel scheduled delivery"
                            >
                              <X size={12} /> Cancel
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteScheduled(m.id)}
                          style={{
                            background: '#fee2e2',
                            border: '1px solid #fca5a5',
                            color: '#b91c1c',
                            borderRadius: '6px',
                            padding: '0.3rem 0.5rem',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Delete from list"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
