import React from 'react';

export type Message = {
  id: string;
  sessionId?: string;
  channel?: 'web' | 'whatsapp' | 'telegram' | 'agent';
  role: 'user' | 'assistant';
  agentId?: string;
  content: string;
  images?: string[];
  audioUrl?: string;
  isTool?: boolean;
  isError?: boolean;
  model?: string;
  usage?: { promptTokens: number; candidatesTokens: number; totalTokens: number; durationMs?: number; model?: string };
  toolExecutions?: { toolName: string; args: string }[];
  steps?: { toolName: string; durationMs?: number; status: 'success' | 'error'; preview?: string; timestamp?: number }[];
  timestamp?: string;
};

export type ChatSession = {
  id: string;
  title: string;
  channel: 'web' | 'whatsapp' | 'telegram' | 'agent';
  targetAgent?: string;
  subagentsUsed: string[];
  createdAt: string;
  updatedAt: string;
};

export type LogEvent = {
  id: string;
  timestamp: string;
  agentId: string;
  sessionId?: string;
  type: string;
  level: string;
  message: string;
  data: any;
};

export type TaskActivityStep = {
  id: string;
  agentId: string;
  sessionId?: string;
  type: 'planning' | 'llm_reasoning' | 'tool_call' | 'tool_result' | 'subagent_delegation' | 'approval_request' | 'synthesis' | 'complete' | 'error';
  title: string;
  detail?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  timestamp: number;
  durationMs?: number;
  toolName?: string;
  toolArgs?: any;
  model?: string;
};

export type TaskActivityEvent = {
  id: string;
  agentId: string;
  sessionId?: string;
  action: 'start' | 'step' | 'llm_start' | 'llm_end' | 'tool_start' | 'tool_end' | 'subagent_start' | 'subagent_end' | 'approval_request' | 'synthesis' | 'heartbeat' | 'complete' | 'error' | 'stop';
  detail: string;
  timestamp: number;
  step?: number;
  provider?: string;
  model?: string;
  toolName?: string;
  args?: any;
  durationMs?: number;
  error?: string;
  subAgentId?: string;
  role?: string;
  task?: string;
};

export type Agent = {
  id: string;
  name: string;
  role: string;
  status: 'idle' | 'working' | 'waiting_approval' | string;
  icon?: React.ReactNode;
  progress?: number;
  estimate?: number;
  currentTask?: string;
  lastActivity?: number;
  activeTool?: string;
};

export type PendingApproval = {
  id: number;
  agentId: string;
  title: string;
  description?: string;
  content: string;
  type: 'draft_review' | 'action_approval' | 'telegram_draft' | 'email_draft' | string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  metadata?: string;
  createdAt: string;
  updatedAt?: string;
};

export type CronJob = {
  id: number;
  name: string;
  cron: string;
  task: string;
  agentId: string;
  status: 'active' | 'paused';
  lastRun?: string;
  timestamp?: string;
  isRunning?: boolean;
};

export type TrackerOverview = {
  agents: {
    id: string;
    name: string;
    role: string;
    status: string;
    isProcessing: boolean;
    lastActivity: number | null;
    currentTask: string;
  }[];
  pendingApprovals: PendingApproval[];
  jobs: CronJob[];
  timestamp: string;
};

export type AgentDetails = {
  agentId: string;
  rules: string;
  skills: any[];
  memory: {
    task: string;
    longTerm: string;
  };
  jobs?: CronJob[];
};

export type SystemStats = {
  total_input_tokens: number;
  total_output_tokens: number;
  total_requests: number;
  today_input_tokens?: number;
  today_output_tokens?: number;
  today_total_tokens?: number;
  today_requests?: number;
};

export type KeyStatus = {
  hasGemini: boolean;
  hasOllamaCloud?: boolean;
  hasOllamaCloud2?: boolean;
  hasDigitalOcean?: boolean;
  hasTavily: boolean;
  hasTelegram: boolean;
  hasPerplexity: boolean;
  hasDuffel?: boolean;
  defaultProvider?: string;
  defaultOllamaCloudModel?: string;
};

export type DetailedStat = {
  date: string;
  agentId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requests: number;
};

export type WhatsAppStatus = {
  connected: boolean;
  user: {
    id: string;
    phone: string;
    name: string;
  } | null;
  qr: string | null;
  isConnecting?: boolean;
};

export type WhatsAppChatSummary = {
  remoteJid: string;
  phone: string;
  contactName: string;
  lastMessage: {
    text: string;
    fromMe: boolean;
    timestamp: number;
  };
  latestTimestamp: number;
  unrepliedCount: number;
  totalMessages: number;
  autoReplyEnabled: boolean;
  updatedAt: number;
};

export type WhatsAppMessageItem = {
  id: string;
  remoteJid?: string;
  senderPhone?: string;
  senderName: string;
  contactName?: string;
  fromMe: boolean;
  text: string;
  replied: boolean;
  timestamp: number;
  createdAt?: string;
};

export type AutoReplyContact = {
  remoteJid: string;
  phone: string;
  contactName: string;
  enabled: boolean;
  updatedAt?: string;
};

export type WhatsAppScheduledMessage = {
  id: string;
  remoteJid?: string;
  phone?: string;
  contactName?: string;
  text: string;
  scheduledAt: number;
  scheduledAtIso: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  createdBy?: string;
  createdAt: string;
  sentAt?: string;
  errorMessage?: string;
  messageId?: string;
};



